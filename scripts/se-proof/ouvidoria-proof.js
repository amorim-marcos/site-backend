#!/usr/bin/env node
"use strict";

/**
 * Prova da integração da Ouvidoria com o SE Suite.
 *
 * Roda o MESMO job de produção (OuvidoriaSendJob + seClient) contra o ambiente
 * apontado pelas variáveis de ambiente (use a QAS). O S3 é simulado: a varredura
 * devolve "sem ameaças" e a URL de download é só uma URL de teste. Responde:
 *   - o fluxo CPL002 / ouvidoria / ATV.0591 funciona de ponta a ponta?
 *   - a entidade `ouvidoria` aceita os mesmos atributos do `pfaleconosco`?
 *   - o campo `anexo1` recebe a URL (EntityAttributeID confere)?
 *
 * ATENÇÃO: com --run cria workflows REAIS no ambiente alvo (títulos marcados com
 * "[TESTE]"). Avise a TI Berneck. Sem --run nada é enviado.
 *
 * Uso (rede com acesso ao SE, ex.: VPN):
 *   source ~/.nvm/nvm.sh && nvm use 14
 *   export SE_WSDL_URL=... SE_WSDL_LOCATION=... SE_OUVIDORIA_AUTH_TOKEN=...      # token da Ouvidoria (QAS)
 *   export SE_OUVIDORIA_PROCESS_ID=CPL002 SE_OUVIDORIA_USER_ID=ouvidoria \
 *          SE_OUVIDORIA_ENTITY_ID=ouvidoria SE_OUVIDORIA_ACTIVITY_ID=ATV.0591
 *   node scripts/se-proof/ouvidoria-proof.js --describe         # só lê o WSDL (não cria nada)
 *   node scripts/se-proof/ouvidoria-proof.js --run --no-file    # fluxo sem anexo
 *   node scripts/se-proof/ouvidoria-proof.js --run              # com URL de anexo de teste em anexo1
 */

const soap = require("soap");

const { getConfig, missingSeVariables } = require("../../utils/ouvidoria/config");
const { SCAN_CLEAN } = require("../../utils/ouvidoria/s3Storage");
const { OuvidoriaSendJob } = require("../bull/src/workers/OuvidoriaWorker/jobs/OuvidoriaSendJob");

const OPERATIONS = ["newWorkflow", "editEntityRecord", "executeActivity"];
const TEST_BASE_URL = "https://anexos.invalid/arquivo";

function parseArgs(argv) {
  const args = { run: false, describe: false, noFile: false };
  argv.forEach((arg) => {
    if (arg === "--run") args.run = true;
    else if (arg === "--describe") args.describe = true;
    else if (arg === "--no-file") args.noFile = true;
    else throw new Error(`Argumento desconhecido: ${arg}`);
  });
  return args;
}

async function describeWsdl(se) {
  const options = se.wsdlLocation ? { endpoint: se.wsdlLocation } : {};
  const client = await soap.createClientAsync(se.wsdlUrl, options);
  const description = client.describe();
  console.log("\n=== Operações do WSDL (entrada de cada uma) ===");
  Object.keys(description).forEach((service) => {
    Object.keys(description[service]).forEach((port) => {
      OPERATIONS.forEach((operation) => {
        const found = description[service][port][operation];
        if (!found) return console.log(`- ${operation}: NÃO ENCONTRADA em ${service}/${port}`);
        console.log(`- ${operation}:`, JSON.stringify(found.input));
      });
    });
  });
}

/** S3 simulado: sem rede, varredura limpa e URL de teste. */
function fakeStorage(config) {
  const baseUrl = (config.attachment && config.attachment.baseUrl) || TEST_BASE_URL;
  return {
    scanStatus: async () => SCAN_CLEAN,
    urlFor: (key) => `${baseUrl}/${key}`,
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const config = getConfig();

  const missing = missingSeVariables(config);
  if (missing.length > 0) {
    console.error(`Variáveis faltando: ${missing.join(", ")}`);
    process.exit(2);
  }

  const { se } = config;
  console.log("Alvo:", { wsdl: se.wsdlUrl, location: se.wsdlLocation || "(do WSDL)", processo: se.processId, entidade: se.entityId, atividade: se.activityId, usuario: se.userId });

  if (args.describe) return describeWsdl(se);

  if (!args.run) {
    console.log(`\nDry-run (${args.noFile ? "sem anexo" : "com URL de anexo de teste"}): nada foi enviado. Use --run para criar o workflow de teste no ambiente alvo.`);
    return;
  }

  const job = {
    id: "proof",
    attemptsMade: 0,
    data: {
      submissionId: "proof",
      receivedAt: new Date().toISOString(),
      channel: "Ouvidoria",
      serviceCode: process.env.PROOF_SERVICE_CODE || "MKT001.02.12",
      fields: {
        name: "[TESTE] Descartar",
        email: process.env.PROOF_EMAIL || "teste@coinov.com.br",
        phone: "41999990000",
        city: "Curitiba",
        state: "PR",
        company: "Coinov",
        message: "[TESTE] Envio de teste da integração do canal de Ouvidoria. Pode descartar.",
      },
      file: args.noFile ? null : { key: "teste/prova.pdf", originalName: "prova.pdf", size: 1024, ext: "pdf" },
      state: {},
    },
    async update(next) {
      this.data = next;
      console.log("  estado:", JSON.stringify(next.state));
    },
    async progress() {},
  };

  const startedAt = Date.now();
  try {
    const result = await OuvidoriaSendJob(job, { createStorage: fakeStorage });
    console.log(`\nOK em ${Date.now() - startedAt} ms. Workflow criado: ${result.workflowID}`);
  } catch (error) {
    console.error(`\nFALHOU em ${Date.now() - startedAt} ms: ${error.message}`);
    console.error("Estado no momento da falha:", JSON.stringify(job.data.state));
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
