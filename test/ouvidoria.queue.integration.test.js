"use strict";

/**
 * Integração da fila da Ouvidoria com Redis REAL e SOAP simulado: handler ->
 * fila Bull -> worker -> job -> SE (mock). Cobre o que os testes unitários não
 * cobrem: `job.update` persistindo o estado, a espera da varredura do anexo, retry
 * com backoff retomando do estágio pendente (sem criar outro workflow nem repetir
 * a varredura) e falha definitiva retendo o job na fila. O S3 é simulado.
 *
 * Só roda com OUVIDORIA_REDIS_TEST=1. Exemplo (Redis descartável na porta 6390):
 *   docker run -d --name sb155-redis-test -p 127.0.0.1:6390:6379 redis:5.0 redis-server --requirepass testpass
 *   source ~/.nvm/nvm.sh && nvm use 14
 *   OUVIDORIA_REDIS_TEST=1 npx mocha --exit test/ouvidoria.queue.integration.test.js
 *   docker rm -f sb155-redis-test
 */

const fs = require("fs");
const http = require("http");
const path = require("path");
const soap = require("soap");
const { expect } = require("chai");
const h = require("./helpers/ouvidoria");

const enabled = process.env.OUVIDORIA_REDIS_TEST === "1";

(enabled ? describe : describe.skip)("ouvidoria/fila com Redis real", function () {
  this.timeout(60000);

  let seServer;
  let calls;
  let failures; // { operação: quantas chamadas ainda devem falhar }
  let queue;
  let handlers;
  let tempDir;
  let s3;
  let failedEvents;

  const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const waitFor = async (predicate, timeoutMs = 30000) => {
    const started = Date.now();
    while (!predicate()) {
      if (Date.now() - started > timeoutMs) throw new Error("tempo esgotado esperando condição");
      await wait(50);
    }
  };

  const names = () => calls.map((c) => c.op);
  const count = (op) => calls.filter((c) => c.op === op).length;

  before(async () => {
    tempDir = path.join(h.tmpDir(), "ouvidoria-tmp");

    // S3 simulado: o cliente real é carregado sob demanda pelo `s3Storage`.
    s3 = h.fakeS3();
    const s3Module = require.resolve("aws-sdk/clients/s3");
    require.cache[s3Module] = {
      id: s3Module,
      filename: s3Module,
      loaded: true,
      exports: function FakeS3() {
        return s3;
      },
    };

    Object.assign(process.env, {
      REDIS_HOST: "127.0.0.1",
      REDIS_PORT: "6390",
      REDIS_PASSWORD: "testpass",
      OUVIDORIA_ENABLED: "true",
      OUVIDORIA_TEMP_DIR: tempDir,
      OUVIDORIA_S3_BUCKET: "bucket-teste",
      OUVIDORIA_S3_REGION: "sa-east-1",
      OUVIDORIA_ATTACHMENT_BASE_URL: "https://anexos.test/arquivo",
      OUVIDORIA_SCAN_POLL_SECONDS: "1",
      OUVIDORIA_FORM_TOKEN_SECRET: "s",
      OUVIDORIA_JOB_ATTEMPTS: "3",
      OUVIDORIA_JOB_BACKOFF_SECONDS: "1",
      SE_AUTH_TOKEN: "t",
      SE_OUVIDORIA_PROCESS_ID: "CPL002",
      SE_OUVIDORIA_USER_ID: "ouvidoria",
      SE_OUVIDORIA_ENTITY_ID: "ouvidoria",
      SE_OUVIDORIA_ACTIVITY_ID: "ATV.0591",
    });

    // SE simulado com falha injetável por operação.
    calls = [];
    failures = {};
    const respond = (op, args) => {
      calls.push({ op, args, at: Date.now() });
      if (failures[op] > 0) {
        failures[op] -= 1;
        return { Status: "FAILURE", Code: "-1", Detail: "falha simulada" };
      }
      return { Status: "SUCCESS", Code: "1", Detail: "ok", RecordID: "WF-500" };
    };
    const service = { WfService: { WfPort: {} } };
    ["newWorkflow", "editEntityRecord", "newAttachment", "executeActivity"].forEach((op) => {
      service.WfService.WfPort[op] = (args) => respond(op, args);
    });
    seServer = http.createServer((req, res) => {
      res.statusCode = 404;
      res.end();
    });
    await new Promise((resolve) => seServer.listen(0, "127.0.0.1", resolve));
    const port = seServer.address().port;
    soap.listen(seServer, "/wf", service, fs.readFileSync(path.join(__dirname, "helpers", "se-mock-full.wsdl"), "utf8"));
    process.env.SE_WSDL_URL = `http://127.0.0.1:${port}/wf?wsdl`;
    process.env.SE_WSDL_LOCATION = `http://127.0.0.1:${port}/wf`;

    // Sobe a fila e o worker reais (módulos de produção).
    const OuvidoriaQueue = require("../scripts/bull/src/queues/OuvidoriaQueue");
    queue = OuvidoriaQueue.queue;
    await queue.obliterate({ force: true });
    failedEvents = [];
    queue.on("failed", (job) => failedEvents.push(job.id));
    require("../scripts/bull/src/workers/OuvidoriaWorker");

    const { createHandlers } = require("../utils/ouvidoria/handlers");
    handlers = createHandlers({
      findChannel: async () => ({ id: 45, name: "Ouvidoria", service_code: "MKT001.02.12", flow: "ouvidoria" }),
      queue,
      queueName: OuvidoriaQueue.queueName,
      log: h.silentLog(),
    });
  });

  beforeEach(() => {
    calls = [];
    failures = {};
    failedEvents = [];
    s3.calls.tagging.length = 0;
    s3.autoScan = undefined;
  });

  after(async () => {
    await queue.obliterate({ force: true }).catch(() => {});
    await queue.close();
    await new Promise((resolve) => seServer.close(resolve));
    fs.rmSync(path.dirname(tempDir), { recursive: true, force: true });
  });

  const body = {
    name: "Maria Silva",
    email: "maria@exemplo.com.br",
    phone: "41988885544",
    city: "Curitiba",
    state: "PR",
    message: "Relato",
  };

  const submit = async (withFile = true) => {
    const tmp = h.tmpDir();
    const files = withFile ? { file: { path: h.writeTemp(tmp, "up", h.PDF), name: "denuncia.pdf" } } : {};
    const ctx = { params: { id: "45" }, state: { ouvidoriaForm: { fields: body, files } }, status: 0, set() {} };
    await handlers.sendOuvidoria(ctx);
    expect(ctx.status).to.equal(202);
    return ctx;
  };

  const lastKey = () => Object.keys(s3.objects).pop();
  const anexo1 = (call) => {
    const list = [].concat(call.args.EntityAttributeList.EntityAttribute);
    const attr = list.find((item) => item.EntityAttributeID === "anexo1");
    return attr && attr.EntityAttributeValue;
  };

  it("espera a varredura e só então cria o workflow, entregando a URL em anexo1", async () => {
    await submit();
    const key = lastKey();
    expect(key).to.match(/^[0-9a-f]{32}\.pdf$/);

    // O GuardDuty "termina" depois de alguns segundos; o worker consulta de segundos em segundos.
    await wait(2500);
    expect(calls).to.have.length(0);
    const scannedAt = Date.now();
    s3.setScan(key, "NO_THREATS_FOUND");

    await waitFor(() => count("executeActivity") === 1);

    expect(names()).to.deep.equal(["newWorkflow", "editEntityRecord", "executeActivity"]);
    expect(calls[0].at).to.be.at.least(scannedAt);
    expect(anexo1(calls[1])).to.equal(`https://anexos.test/arquivo/${key}`);
    expect(s3.calls.tagging.length).to.be.at.least(3);
  });

  it("arquivo retido: a denúncia segue sem anexo1", async () => {
    await submit();
    s3.setScan(lastKey(), "THREATS_FOUND");

    await waitFor(() => count("executeActivity") === 1);

    expect(names()).to.deep.equal(["newWorkflow", "editEntityRecord", "executeActivity"]);
    expect(anexo1(calls[1])).to.equal(undefined);
  });

  it("no retry retoma do estágio pendente: um único workflow e a varredura não se repete", async () => {
    s3.autoScan = "NO_THREATS_FOUND";
    failures.editEntityRecord = 2;
    await submit();

    await waitFor(() => count("executeActivity") === 1, 40000);

    expect(count("newWorkflow")).to.equal(1);
    expect(count("editEntityRecord")).to.equal(3);
    expect(count("executeActivity")).to.equal(1);
    expect(s3.calls.tagging).to.have.length(1);
  });

  it("falha definitiva: esgota as tentativas e mantém o job (com o estado) na fila", async () => {
    s3.autoScan = "NO_THREATS_FOUND";
    failures.editEntityRecord = 99;
    await submit();

    await waitFor(() => count("editEntityRecord") === 3, 40000);
    await waitFor(() => failedEvents.length >= 3);
    await wait(300);

    expect(count("newWorkflow")).to.equal(1);
    expect(count("executeActivity")).to.equal(0);

    const failed = await queue.getFailed();
    expect(failed).to.have.length(1);
    expect(failed[0].data.state.workflowId).to.equal("WF-500");
    expect(failed[0].data.state.attachment.url).to.contain("https://anexos.test/arquivo/");
    expect(failed[0].data.state.entityEdited).to.equal(undefined);
    expect(failed[0].attemptsMade).to.equal(3);

    // limpeza para não afetar outros testes
    await queue.obliterate({ force: true });
  });

  it("envio sem arquivo não consulta o S3", async () => {
    await submit(false);
    await waitFor(() => count("executeActivity") === 1);
    expect(names()).to.deep.equal(["newWorkflow", "editEntityRecord", "executeActivity"]);
    expect(s3.calls.tagging).to.have.length(0);
  });
});
