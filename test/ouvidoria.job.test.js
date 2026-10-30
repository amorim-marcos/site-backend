"use strict";

const { expect } = require("chai");
const h = require("./helpers/ouvidoria");
const { createStorage } = require("../utils/ouvidoria/s3Storage");
const { OuvidoriaSendJob } = require("../scripts/bull/src/workers/OuvidoriaWorker/jobs/OuvidoriaSendJob");

const RECEIVED_AT = "2026-10-19T12:00:00.000Z";
const RECEIVED_MS = Date.parse(RECEIVED_AT);
const KEY = "0123456789abcdef0123456789abcdef.pdf";
const URL = `https://anexos.test/arquivo/${KEY}`;

describe("ouvidoria/OuvidoriaSendJob", () => {
  let config;
  let calls;
  let failOn;
  let responses;
  let s3;
  let clock;
  let sleeps;
  let logged;

  const makeClient = async () => {
    const call = (name) => async (args) => {
      calls.push({ name, args });
      if (failOn === name) throw new Error(`falha simulada em ${name}`);
      return responses[name] ? responses[name](args) : { Status: "SUCCESS" };
    };
    return {
      newWorkflow: call("newWorkflow"),
      editEntityRecord: call("editEntityRecord"),
      executeActivity: call("executeActivity"),
    };
  };

  // Imita o job do Bull: `update` substitui os dados persistidos.
  const makeJob = (data) => {
    const job = {
      id: "job-1",
      attemptsMade: 0,
      data,
      async update(next) {
        job.data = next;
      },
      async progress() {},
    };
    return job;
  };

  const baseData = (file = null) => ({
    submissionId: "abc",
    receivedAt: RECEIVED_AT,
    channel: "Ouvidoria",
    serviceCode: "MKT001.02.12",
    fields: {
      name: "Maria Silva",
      email: "maria@exemplo.com.br",
      phone: "41988885544",
      city: "Curitiba",
      state: "PR",
      company: "",
      message: "Relato",
    },
    file,
    state: {},
  });

  const fileData = () => ({ key: KEY, originalName: "denuncia.pdf", size: 10, ext: "pdf" });

  const log = () => ({
    log() {},
    warn: (m) => logged.push(["warn", m]),
    error: (m) => logged.push(["error", m]),
  });

  const run = (job, extra = {}) =>
    OuvidoriaSendJob(job, {
      getConfig: () => config,
      createSeClient: makeClient,
      createStorage: (cfg) => createStorage(cfg, { client: s3 }),
      // Relógio e espera simulados: cada `sleep` avança o tempo, sem esperar de verdade.
      now: () => clock,
      sleep: async (ms) => {
        sleeps.push(ms);
        clock += ms;
      },
      log: log(),
      ...extra,
    });

  const names = () => calls.map((c) => c.name);
  const attrs = () =>
    Object.fromEntries(
      calls.find((c) => c.name === "editEntityRecord").args.EntityAttributeList.EntityAttribute.map((a) => [
        a.EntityAttributeID,
        a.EntityAttributeValue,
      ])
    );

  // Coloca o objeto no bucket falso (a request o grava antes de enfileirar).
  const putObject = async () => {
    const dir = h.tmpDir();
    const filePath = h.writeTemp(dir, "tmp.pdf", h.PDF);
    await createStorage(config, { client: s3 }).upload({
      filePath,
      key: KEY,
      size: h.PDF.length,
      mime: "application/pdf",
      originalName: "denuncia.pdf",
    });
  };

  beforeEach(async () => {
    config = h.baseConfig();
    calls = [];
    failOn = null;
    responses = { newWorkflow: async () => ({ Status: "SUCCESS", RecordID: "WF-100" }) };
    s3 = h.fakeS3();
    clock = RECEIVED_MS + 1000;
    sleeps = [];
    logged = [];
    await putObject();
  });

  it("sem arquivo: executa o fluxo na ordem, sem consultar o S3 e sem anexo1", async () => {
    const result = await run(makeJob(baseData()));

    expect(result).to.deep.equal({ workflowID: "WF-100" });
    expect(names()).to.deep.equal(["newWorkflow", "editEntityRecord", "executeActivity"]);
    expect(s3.calls.tagging).to.have.length(0);

    expect(calls[0].args).to.deep.equal({ ProcessID: "CPL002", WorkflowTitle: "maria@exemplo.com.br", UserID: "ouvidoria" });
    expect(calls[1].args.WorkflowID).to.equal("WF-100");
    expect(calls[1].args.EntityID).to.equal("ouvidoria");
    expect(calls[2].args).to.deep.equal({ WorkflowID: "WF-100", ActivityID: "ATV.0591", ActionSequence: "1", UserID: "ouvidoria" });
    expect(attrs()).to.not.have.property("anexo1");
  });

  it("com arquivo liberado: entrega a URL do download seguro em anexo1", async () => {
    s3.setScan(KEY, "NO_THREATS_FOUND");
    await run(makeJob(baseData(fileData())));

    expect(names()).to.deep.equal(["newWorkflow", "editEntityRecord", "executeActivity"]);
    expect(attrs().anexo1).to.equal(URL);
    expect(sleeps).to.have.length(0);
  });

  describe("espera da varredura", () => {
    it("espera a tag aparecer e só então cria o workflow", async () => {
      const original = s3.getObjectTagging.bind(s3);
      let polls = 0;
      s3.getObjectTagging = (params) => {
        polls += 1;
        if (polls === 3) s3.setScan(KEY, "NO_THREATS_FOUND");
        return original(params);
      };

      await run(makeJob(baseData(fileData())));

      expect(polls).to.equal(3);
      expect(sleeps).to.deep.equal([10000, 10000]);
      expect(attrs().anexo1).to.equal(URL);
    });

    it("não cria workflow enquanto a varredura não termina", async () => {
      const job = makeJob(baseData(fileData()));
      let sawWorkflowWhileWaiting = false;
      await run(job, {
        sleep: async (ms) => {
          if (calls.length > 0) sawWorkflowWhileWaiting = true;
          clock += ms;
          s3.setScan(KEY, "NO_THREATS_FOUND");
        },
      });
      expect(sawWorkflowWhileWaiting).to.equal(false);
    });

    it("arquivo retido: a denúncia segue sem o link e o motivo vai para o log", async () => {
      s3.setScan(KEY, "THREATS_FOUND");
      const result = await run(makeJob(baseData(fileData())));

      expect(result.workflowID).to.equal("WF-100");
      expect(names()).to.deep.equal(["newWorkflow", "editEntityRecord", "executeActivity"]);
      expect(attrs()).to.not.have.property("anexo1");
      expect(logged.some(([level, msg]) => level === "warn" && msg.includes("THREATS_FOUND"))).to.equal(true);
      // Nem a chave do arquivo nem dados da denúncia vão para o log.
      expect(logged.every(([, msg]) => !msg.includes(KEY) && !msg.includes("maria@"))).to.equal(true);
    });

    ["UNSUPPORTED", "FAILED", "ACCESS_DENIED"].forEach((status) => {
      it(`trata ${status} como retido`, async () => {
        s3.setScan(KEY, status);
        await run(makeJob(baseData(fileData())));
        expect(attrs()).to.not.have.property("anexo1");
      });
    });

    it("sem tag no prazo: segue sem o link", async () => {
      await run(makeJob(baseData(fileData())));

      expect(names()).to.deep.equal(["newWorkflow", "editEntityRecord", "executeActivity"]);
      expect(attrs()).to.not.have.property("anexo1");
      expect(clock).to.be.at.least(RECEIVED_MS + config.scan.timeoutMs);
      expect(logged.some(([, msg]) => msg.includes("não terminou no prazo"))).to.equal(true);
    });

    it("conta o prazo a partir do recebimento, não do início do job", async () => {
      clock = RECEIVED_MS + config.scan.timeoutMs + 1; // reprocessado depois do prazo
      await run(makeJob(baseData(fileData())));
      expect(sleeps).to.have.length(0);
      expect(attrs()).to.not.have.property("anexo1");
    });

    it("se não consegue consultar a tag, desiste de esperar e entrega o link", async () => {
      s3.getObjectTagging = () => ({
        promise: async () => {
          throw Object.assign(new Error("negado"), { code: "AccessDenied" });
        },
      });
      await run(makeJob(baseData(fileData())));

      expect(attrs().anexo1).to.equal(URL);
      expect(logged.filter(([level]) => level === "error")).to.have.length(3);
    });

    it("com OUVIDORIA_WAIT_SCAN desligado, não consulta o S3 e entrega o link", async () => {
      config = { ...config, scan: { ...config.scan, wait: false } };
      await run(makeJob(baseData(fileData())));
      expect(s3.calls.tagging).to.have.length(0);
      expect(attrs().anexo1).to.equal(URL);
    });
  });

  it("preenche o atributo de observação do anexo quando configurado", async () => {
    config = { ...config, se: { ...config.se, attachmentNoteAttribute: "anexoobs" } };
    s3.setScan(KEY, "THREATS_FOUND");
    await run(makeJob(baseData(fileData())));
    expect(attrs().anexoobs).to.contain("retido");

    calls = [];
    s3.setScan(KEY, "NO_THREATS_FOUND");
    await run(makeJob(baseData(fileData())));
    expect(attrs()).to.not.have.property("anexoobs");
  });

  it("envia os atributos da entidade e omite os vazios", async () => {
    await run(makeJob(baseData()));
    expect(attrs()).to.deep.equal({
      solnome: "Maria Silva",
      solemail: "maria@exemplo.com.br",
      solmensagem: "Relato",
      solfone: "41988885544",
      soluf: "PR",
      solcidade: "Curitiba",
    });
  });

  it("usa título genérico quando a denúncia é anônima", async () => {
    const data = baseData();
    data.fields = { name: "", email: "", phone: "", city: "", state: "", company: "", message: "Relato" };
    await run(makeJob(data));
    expect(calls[0].args.WorkflowTitle).to.equal("Denúncia anônima 2026-10-19T12:00:00.000Z");
    expect(Object.keys(attrs())).to.not.include.members(["solnome", "solemail"]);
  });

  it("descreve falhas do SE que chegam sem `message` (HTTP ou fault do SOAP), sem expor o corpo enviado", async () => {
    const failWith = (rejection) => async () => ({
      newWorkflow: async () => {
        throw rejection;
      },
    });
    const outcome = async (rejection) => {
      let error;
      try {
        await run(makeJob(baseData()), { createSeClient: failWith(rejection) });
      } catch (e) {
        error = e;
      }
      return error.message;
    };

    const http = await outcome({ statusCode: 502, body: "<html>Bad Gateway</html>" });
    expect(http).to.contain("newWorkflow falhou");
    expect(http).to.contain("http=502");
    expect(http).to.contain("Bad Gateway");

    const fault = await outcome({ root: { Envelope: { Body: { Fault: { faultstring: "Usuário inválido" } } } } });
    expect(fault).to.contain("fault=Usuário inválido");

    const envelope = `<?xml version="1.0" encoding="ISO-8859-1"?><SOAP-ENV:Envelope xmlns:SOAP-ENV="http://schemas.xmlsoap.org/soap/envelope/"><SOAP-ENV:Body><SOAP-ENV:Fault><faultstring>Atributo inexistente</faultstring></SOAP-ENV:Fault></SOAP-ENV:Body></SOAP-ENV:Envelope>`;
    const soapBody = await outcome({ statusCode: 200, body: envelope });
    expect(soapBody).to.contain("faultstring=Atributo inexistente");
    expect(soapBody).to.not.contain("<?xml");

    const noFault = await outcome({
      statusCode: 200,
      body: `<?xml version="1.0"?><SOAP-ENV:Envelope xmlns:SOAP-ENV="x"><SOAP-ENV:Body><ns1:editEntityRecordResponse><Detail>Atributo anexo1 invalido</Detail></ns1:editEntityRecordResponse></SOAP-ENV:Body></SOAP-ENV:Envelope>`,
    });
    expect(noFault).to.contain("body=Atributo anexo1 invalido");
    expect(noFault).to.not.contain("<?xml");

    expect(await outcome({ code: "ECONNRESET" })).to.contain("code=ECONNRESET");
    expect(await outcome({})).to.contain("tipo=object");
    expect(await outcome("texto solto")).to.contain("message=texto solto");
  });

  it("falha de autenticação do gateway (401/403) descarta o job: sem novas tentativas", async () => {
    for (const statusCode of [401, 403]) {
      const job = makeJob(baseData());
      let discarded = 0;
      job.discard = () => {
        discarded += 1;
      };
      let error;
      try {
        await run(job, {
          createSeClient: async () => ({
            newWorkflow: async () => {
              throw { statusCode, body: "Valid GatewayJWT not found" };
            },
          }),
        });
      } catch (e) {
        error = e;
      }
      expect(error.message).to.contain(`http=${statusCode}`);
      expect(discarded).to.equal(1);
      expect(logged.some(([level, msg]) => level === "error" && /sem novas tentativas/.test(msg))).to.equal(true);
    }
  });

  it("outras falhas do SE continuam com novas tentativas (o job não é descartado)", async () => {
    const job = makeJob(baseData());
    let discarded = 0;
    job.discard = () => {
      discarded += 1;
    };
    failOn = "newWorkflow";
    try {
      await run(job);
    } catch (e) {
      /* esperado */
    }
    expect(discarded).to.equal(0);
  });

  it("retoma do estágio pendente e não cria outro workflow nem repete a varredura no retry", async () => {
    s3.setScan(KEY, "NO_THREATS_FOUND");
    const job = makeJob(baseData(fileData()));

    failOn = "executeActivity";
    let error;
    try {
      await run(job);
    } catch (e) {
      error = e;
    }
    expect(error.message).to.contain("executeActivity");
    expect(job.data.state).to.deep.equal({ attachment: { url: URL }, workflowId: "WF-100", entityEdited: true });

    calls = [];
    s3.calls.tagging.length = 0;
    failOn = null;
    job.attemptsMade = 1;
    const result = await run(job);

    expect(result.workflowID).to.equal("WF-100");
    expect(names()).to.deep.equal(["executeActivity"]);
    expect(s3.calls.tagging).to.have.length(0);
  });

  it("falha quando o SE responde FAILURE", async () => {
    responses.editEntityRecord = async () => ({ Status: "FAILURE", Code: "-5", Detail: "atributo inválido" });
    let error;
    try {
      await run(makeJob(baseData()));
    } catch (e) {
      error = e;
    }
    expect(error.message).to.contain("editEntityRecord falhou");
    expect(error.message).to.contain("atributo inválido");
    expect(names()).to.deep.equal(["newWorkflow", "editEntityRecord"]);
  });

  it("falha se newWorkflow não retornar RecordID", async () => {
    responses.newWorkflow = async () => ({ Status: "SUCCESS" });
    let error;
    try {
      await run(makeJob(baseData()));
    } catch (e) {
      error = e;
    }
    expect(error.message).to.contain("RecordID");
  });

  it("falha com mensagem clara se a configuração do SE estiver incompleta", async () => {
    config = { ...config, se: { ...config.se, processId: "", authToken: "" } };
    let error;
    try {
      await run(makeJob(baseData()));
    } catch (e) {
      error = e;
    }
    expect(error.message).to.contain("SE_OUVIDORIA_PROCESS_ID");
    expect(error.message).to.contain("SE_OUVIDORIA_AUTH_TOKEN");
    expect(calls).to.have.length(0);
  });
});
