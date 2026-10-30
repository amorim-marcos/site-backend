"use strict";

const { ENTITY_ATTRIBUTES, getConfig, missingSeVariables } = require("../../../../../../utils/ouvidoria/config");
const { workflowTitle } = require("../../../../../../utils/ouvidoria/submission");
const { createStorage, SCAN_CLEAN } = require("../../../../../../utils/ouvidoria/s3Storage");
const { createSeClient } = require("../seClient");

/**
 * Envio de uma denúncia ao SE Suite, em estágios idempotentes:
 *
 *   varredura do anexo (se houver) -> newWorkflow -> editEntityRecord -> executeActivity
 *
 * O anexo já está no S3 (gravado na request). O SE recebe só a URL do download
 * seguro, em `anexo1`, e apenas depois que o GuardDuty libera o arquivo, para o
 * analista nunca abrir um link que ainda não funciona. Se o arquivo for retido
 * (ou a varredura não terminar no prazo), a denúncia segue sem o link: perder o
 * texto por causa de um anexo seria pior.
 *
 * Cada estágio concluído é gravado em `job.data.state`. Em uma nova tentativa
 * (falha do SE, reinício do processo) o job retoma do primeiro estágio pendente
 * e não cria outro workflow. Limite: se o SE concluir um estágio e o processo
 * cair antes de gravarmos o estado, aquele estágio se repete (prefere-se uma
 * duplicata a uma denúncia perdida).
 *
 * Não registrar em log nenhum dado do formulário nem a chave do anexo.
 */

const LOG = "[OUVIDORIA]";

// Falhas seguidas ao consultar a tag antes de desistir de esperar a varredura.
const MAX_SCAN_ERRORS = 3;

const NOTE_QUARANTINED = "Anexo retido pela verificação de segurança; não está disponível.";
const NOTE_SCAN_TIMEOUT = "A verificação de segurança do anexo não terminou a tempo; o anexo não está disponível.";

const defaultSleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// O node-soap pode rejeitar com objetos sem `message` (falha HTTP ou fault do SOAP).
// Só vão ao log o status, o código e um trecho curto da resposta do SE, nunca os dados enviados.
function describeSeError(error) {
  if (!error) return "erro desconhecido";
  const parts = [];
  const status = error.statusCode || (error.response && error.response.status);
  if (status) parts.push(`http=${status}`);
  if (error.code) parts.push(`code=${error.code}`);
  const message = error.message || (typeof error === "string" ? error : "");
  if (message) parts.push(`message=${message}`);
  const body = error.root && error.root.Envelope && error.root.Envelope.Body;
  const fault = body && body.Fault;
  if (fault) parts.push(`fault=${String(fault.faultstring || fault.Reason || "").slice(0, 200)}`);
  if (typeof error.body === "string" && error.body) parts.push(`body=${error.body.slice(0, 200)}`);
  if (parts.length === 0) parts.push(`tipo=${typeof error} chaves=${Object.keys(error).join(",")}`);
  return parts.join(" ");
}

async function callSe(step, call) {
  try {
    return await call();
  } catch (error) {
    throw new Error(`${step} falhou: ${describeSeError(error)}`);
  }
}

function assertSuccess(step, result) {
  if (!result || result.Status === "FAILURE") {
    const code = result && result.Code;
    const detail = result && result.Detail;
    throw new Error(`${step} falhou no SE (code=${code}, detail=${detail})`);
  }
  return result;
}

function entityAttributes(data, config, attachment = {}) {
  const { fields } = data;
  const map = [
    [ENTITY_ATTRIBUTES.name, fields.name],
    [ENTITY_ATTRIBUTES.email, fields.email],
    [ENTITY_ATTRIBUTES.message, fields.message],
    [ENTITY_ATTRIBUTES.phone, fields.phone],
    [ENTITY_ATTRIBUTES.state, fields.state],
    [ENTITY_ATTRIBUTES.company, fields.company],
    [ENTITY_ATTRIBUTES.city, fields.city],
    [ENTITY_ATTRIBUTES.channel, data.channel],
    [ENTITY_ATTRIBUTES.roleId, data.serviceCode],
    [ENTITY_ATTRIBUTES.attachment, attachment.url],
  ];
  if (config.se.attachmentNoteAttribute) {
    map.push([config.se.attachmentNoteAttribute, attachment.note]);
  }
  // Atributos vazios são omitidos (campos opcionais, modo anônimo, sem anexo).
  return map
    .filter(([, value]) => value !== undefined && value !== null && String(value) !== "")
    .map(([id, value]) => ({ EntityAttributeID: id, EntityAttributeValue: String(value) }));
}

/**
 * Espera o GuardDuty aplicar a tag de varredura. O prazo conta a partir do
 * recebimento da denúncia, não do início deste job, para valer também depois de
 * um reinício ou de uma nova tentativa.
 *
 * @returns {Promise<{outcome: 'clean'|'quarantined'|'timeout'|'unverified', status?: string}>}
 */
async function waitForScan({ storage, key, config, receivedAt, sleep, now, log, jobId }) {
  const deadline = receivedAt + config.scan.timeoutMs;
  let errors = 0;

  for (;;) {
    let status = null;
    try {
      status = await storage.scanStatus(key);
      errors = 0;
    } catch (error) {
      errors += 1;
      log.error(`${LOG} job ${jobId}: falha ao consultar a varredura (${error.code || error.message}), tentativa ${errors}`);
      if (errors >= MAX_SCAN_ERRORS) return { outcome: "unverified" };
    }

    if (status === SCAN_CLEAN) return { outcome: "clean", status };
    if (status !== null) return { outcome: "quarantined", status };
    if (now() >= deadline) return { outcome: "timeout" };

    await sleep(config.scan.pollIntervalMs);
  }
}

async function OuvidoriaSendJob(job, deps = {}) {
  const startedAt = Date.now();
  const getCfg = deps.getConfig || getConfig;
  const makeClient = deps.createSeClient || createSeClient;
  const makeStorage = deps.createStorage || createStorage;
  const sleep = deps.sleep || defaultSleep;
  const now = deps.now || (() => Date.now());
  const log = deps.log || console;

  const config = getCfg();
  const missing = missingSeVariables(config);
  if (missing.length > 0) {
    throw new Error(`Configuração do SE incompleta: ${missing.join(", ")}`);
  }

  const { se } = config;
  const data = job.data;
  const state = { ...(data.state || {}) };

  const persist = async () => {
    await job.update({ ...job.data, state: { ...state } });
  };

  log.log(`${LOG} job ${job.id} iniciado (tentativa ${job.attemptsMade + 1})`);
  await job.progress(10);

  // 0. Anexo: espera a varredura e define o que o SE recebe em `anexo1`.
  if (!state.attachment) {
    state.attachment = {};
    if (data.file) {
      const storage = makeStorage(config);

      let scan = { outcome: "unverified" };
      if (config.scan.wait) {
        scan = await waitForScan({
          storage,
          key: data.file.key,
          config,
          receivedAt: Date.parse(data.receivedAt) || startedAt,
          sleep,
          now,
          log,
          jobId: job.id,
        });
      } else {
        scan = { outcome: "skipped" };
      }

      if (scan.outcome === "quarantined") {
        log.warn(`${LOG} job ${job.id}: anexo retido pela varredura (status=${scan.status}); a denúncia segue sem o link`);
        state.attachment = { note: NOTE_QUARANTINED };
      } else if (scan.outcome === "timeout") {
        log.warn(`${LOG} job ${job.id}: varredura do anexo não terminou no prazo; a denúncia segue sem o link`);
        state.attachment = { note: NOTE_SCAN_TIMEOUT };
      } else {
        // Liberado, ou sem como confirmar (a política de leitura da TI já nega o download sem a tag).
        if (scan.outcome === "unverified") {
          log.warn(`${LOG} job ${job.id}: não foi possível confirmar a varredura; o link segue assim mesmo`);
        }
        state.attachment = { url: storage.urlFor(data.file.key) };
      }
    }
    await persist();
  }
  await job.progress(25);

  const client = await makeClient(se);

  // 1. newWorkflow: cria a instância do processo no SE e devolve o ID do workflow
  if (!state.workflowId) {
    const workflow = assertSuccess(
      "newWorkflow",
      await callSe("newWorkflow", () =>
        client.newWorkflow({
          ProcessID: se.processId,
          WorkflowTitle: workflowTitle(data.fields, new Date(data.receivedAt)),
          UserID: se.userId,
        })
      )
    );
    if (!workflow.RecordID) throw new Error("newWorkflow não retornou RecordID");
    state.workflowId = workflow.RecordID;
    await persist();
  }
  await job.progress(50);

  // 2. editEntityRecord: grava os campos da denúncia (e a URL do anexo) na entidade do workflow
  if (!state.entityEdited) {
    assertSuccess(
      "editEntityRecord",
      await callSe("editEntityRecord", () =>
        client.editEntityRecord({
          WorkflowID: state.workflowId,
          EntityID: se.entityId,
          EntityAttributeList: { EntityAttribute: entityAttributes(data, config, state.attachment) },
        })
      )
    );
    state.entityEdited = true;
    await persist();
  }
  await job.progress(80);

  // 3. executeActivity: executa a atividade do solicitante e libera o workflow para a equipe
  if (!state.activityExecuted) {
    assertSuccess(
      "executeActivity",
      await callSe("executeActivity", () =>
        client.executeActivity({
          WorkflowID: state.workflowId,
          ActivityID: se.activityId,
          ActionSequence: se.actionSequence,
          UserID: se.userId,
        })
      )
    );
    state.activityExecuted = true;
    await persist();
  }

  await job.progress(100);
  log.log(`${LOG} job ${job.id} concluído em ${Date.now() - startedAt}ms (workflow ${state.workflowId})`);
  return { workflowID: state.workflowId };
}

module.exports = { OuvidoriaSendJob, entityAttributes, waitForScan };
