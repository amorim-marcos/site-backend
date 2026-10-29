"use strict";

const fs = require("fs");
const { expect } = require("chai");
const h = require("./helpers/ouvidoria");
const formToken = require("../utils/ouvidoria/formToken");
const { createHandlers } = require("../utils/ouvidoria/handlers");
const { createStorage } = require("../utils/ouvidoria/s3Storage");

const validBody = {
  name: "Maria Silva",
  email: "maria@exemplo.com.br",
  phone: "41988885544",
  city: "Curitiba",
  state: "PR",
  message: "Relato",
};

describe("ouvidoria/handlers", () => {
  let tmp;
  let s3;
  let config;
  let added;
  let queueError;
  let channel;
  let handlers;

  const queue = {
    add: async (name, data, opts) => {
      if (queueError) throw queueError;
      added.push({ name, data, opts });
    },
  };

  const makeCtx = ({ body = validBody, files = {}, id = "45" } = {}) => ({
    params: { id },
    state: { ouvidoriaForm: { fields: body, files } },
    status: 404,
    body: undefined,
    set() {},
  });

  const upload = (name, content) => ({ path: h.writeTemp(tmp, `up-${Math.random()}`, content), name });
  const storedKeys = () => Object.keys(s3.objects);

  beforeEach(() => {
    tmp = h.tmpDir();
    s3 = h.fakeS3();
    config = h.baseConfig();
    added = [];
    queueError = null;
    channel = { id: 45, name: "Ouvidoria", service_code: "MKT001.02.12", flow: "ouvidoria" };
    handlers = createHandlers({
      getConfig: () => config,
      findChannel: async () => channel,
      queue,
      queueName: "ouvidoria",
      storageFactory: (cfg) => createStorage(cfg, { client: s3 }),
      now: () => 1_700_000_000_000,
      log: h.silentLog(),
    });
  });

  describe("ouvidoriaConfig", () => {
    it("entrega token válido e as regras do formulário", async () => {
      const ctx = makeCtx();
      await handlers.ouvidoriaConfig(ctx);
      expect(ctx.status).to.equal(200);
      expect(ctx.body.maxFileBytes).to.equal(config.maxFileBytes);
      expect(ctx.body.allowedExtensions).to.include.members(["pdf", "jpg", "mp4"]);
      expect(ctx.body.allowAnonymous).to.equal(false);
      const check = formToken.verify(ctx.body.token, config.formToken.secret, {
        now: 1_700_000_000_000 + 5000,
        minAgeSeconds: 3,
        maxAgeMs: 3600000,
      });
      expect(check.ok).to.equal(true);
    });

    it("responde 404 se desligado, canal inexistente ou canal comum", async () => {
      config = { ...config, enabled: false };
      let ctx = makeCtx();
      await handlers.ouvidoriaConfig(ctx);
      expect(ctx.status).to.equal(404);

      config = h.baseConfig();
      channel = null;
      ctx = makeCtx();
      await handlers.ouvidoriaConfig(ctx);
      expect(ctx.status).to.equal(404);

      channel = { id: 1, name: "Jurídico", flow: "default" };
      ctx = makeCtx();
      await handlers.ouvidoriaConfig(ctx);
      expect(ctx.status).to.equal(400);
      expect(ctx.body.code).to.equal("CHANNEL_NOT_OUVIDORIA");
    });
  });

  describe("sendOuvidoria", () => {
    it("aceita um envio sem arquivo e enfileira com as opções de retry", async () => {
      const ctx = makeCtx();
      await handlers.sendOuvidoria(ctx);
      expect(ctx.status).to.equal(202);
      expect(added).to.have.length(1);
      const { name, data, opts } = added[0];
      expect(name).to.equal("ouvidoria");
      expect(data.channel).to.equal("Ouvidoria");
      expect(data.serviceCode).to.equal("MKT001.02.12");
      expect(data.fields.email).to.equal("maria@exemplo.com.br");
      expect(data.file).to.equal(null);
      expect(data.state).to.deep.equal({});
      expect(opts).to.include({ attempts: 8, removeOnComplete: true, removeOnFail: false, jobId: data.submissionId });
      expect(opts.backoff).to.deep.equal({ type: "exponential", delay: 30000 });
    });

    it("envia o arquivo ao S3 com nome gerado, guarda só a referência no job e descarta o temporário", async () => {
      const file = upload("denuncia final.pdf", h.PDF);
      const ctx = makeCtx({ files: { file } });
      await handlers.sendOuvidoria(ctx);
      expect(ctx.status).to.equal(202);

      const { data } = added[0];
      expect(data.file.originalName).to.equal("denuncia final.pdf");
      expect(data.file.key).to.match(/^[0-9a-f]{32}\.pdf$/);
      expect(data.file).to.not.have.property("path");
      expect(storedKeys()).to.deep.equal([data.file.key]);
      expect(s3.objects[data.file.key].body.equals(h.PDF)).to.equal(true);
      expect(s3.objects[data.file.key].params.ContentType).to.equal("application/pdf");
      expect(fs.existsSync(file.path)).to.equal(false);
    });

    it("descarta em silêncio (202) quando o honeypot é preenchido, sem enfileirar", async () => {
      const file = upload("a.pdf", h.PDF);
      const ctx = makeCtx({ body: { ...validBody, website: "http://spam" }, files: { file } });
      await handlers.sendOuvidoria(ctx);
      expect(ctx.status).to.equal(202);
      expect(added).to.have.length(0);
      expect(storedKeys()).to.have.length(0);
      expect(fs.existsSync(file.path)).to.equal(false);
    });

    it("recusa campos inválidos com 400 e detalha os campos", async () => {
      const file = upload("a.pdf", h.PDF);
      const ctx = makeCtx({ body: { ...validBody, email: "ruim" }, files: { file } });
      await handlers.sendOuvidoria(ctx);
      expect(ctx.status).to.equal(400);
      expect(ctx.body.code).to.equal("VALIDATION_ERROR");
      expect(ctx.body.fields).to.deep.equal([{ field: "email", code: "INVALID" }]);
      expect(added).to.have.length(0);
      expect(storedKeys()).to.have.length(0);
      expect(fs.existsSync(file.path)).to.equal(false);
    });

    it("recusa arquivo com conteúdo diferente da extensão (415) e não guarda nada", async () => {
      const ctx = makeCtx({ files: { file: upload("a.pdf", h.EXE) } });
      await handlers.sendOuvidoria(ctx);
      expect(ctx.status).to.equal(415);
      expect(ctx.body.code).to.equal("FILE_CONTENT_MISMATCH");
      expect(added).to.have.length(0);
      expect(storedKeys()).to.have.length(0);
    });

    it("recusa arquivo acima do limite (413)", async () => {
      config = { ...config, maxFileBytes: 10 };
      const ctx = makeCtx({ files: { file: upload("a.pdf", h.PDF) } });
      await handlers.sendOuvidoria(ctx);
      expect(ctx.status).to.equal(413);
      expect(ctx.body.code).to.equal("FILE_TOO_LARGE");
    });

    it("recusa mais de um arquivo e campo de arquivo com outro nome", async () => {
      let ctx = makeCtx({ files: { file: [upload("a.pdf", h.PDF), upload("b.pdf", h.PDF)] } });
      await handlers.sendOuvidoria(ctx);
      expect(ctx.status).to.equal(400);
      expect(ctx.body.code).to.equal("TOO_MANY_FILES");

      ctx = makeCtx({ files: { anexo: upload("a.pdf", h.PDF) } });
      await handlers.sendOuvidoria(ctx);
      expect(ctx.body.code).to.equal("FILE_INVALID");
      expect(storedKeys()).to.have.length(0);
    });

    it("responde 503 e descarta o temporário se a fila estiver indisponível", async () => {
      queueError = new Error("redis fora do ar");
      const file = upload("a.pdf", h.PDF);
      const ctx = makeCtx({ files: { file } });
      await handlers.sendOuvidoria(ctx);
      expect(ctx.status).to.equal(503);
      expect(ctx.body.code).to.equal("QUEUE_UNAVAILABLE");
      expect(fs.existsSync(file.path)).to.equal(false);
      expect(s3.calls.delete).to.have.length(1);
      expect(storedKeys()).to.have.length(0);
    });

    it("responde 503 sem enfileirar se o S3 estiver indisponível, e descarta o temporário", async () => {
      s3 = h.fakeS3({ failPuts: 5 });
      const file = upload("a.pdf", h.PDF);
      const ctx = makeCtx({ files: { file } });
      await handlers.sendOuvidoria(ctx);
      expect(ctx.status).to.equal(503);
      expect(ctx.body.code).to.equal("STORAGE_UNAVAILABLE");
      expect(added).to.have.length(0);
      expect(fs.existsSync(file.path)).to.equal(false);
    });

    it("não envia nada ao S3 em um envio sem arquivo", async () => {
      await handlers.sendOuvidoria(makeCtx());
      expect(s3.calls.put).to.have.length(0);
    });

    it("recusa canal que não é a Ouvidoria e canal inexistente", async () => {
      channel = { id: 1, name: "Jurídico", flow: "default" };
      let ctx = makeCtx();
      await handlers.sendOuvidoria(ctx);
      expect(ctx.status).to.equal(400);

      channel = null;
      ctx = makeCtx();
      await handlers.sendOuvidoria(ctx);
      expect(ctx.status).to.equal(404);
      expect(added).to.have.length(0);
    });

    it("trata canal sem o campo flow (nulo) como canal comum", async () => {
      channel = { id: 45, name: "Ouvidoria", flow: null };
      const ctx = makeCtx();
      await handlers.sendOuvidoria(ctx);
      expect(ctx.status).to.equal(400);
    });

    it("recusa envio sem relato e sem arquivo (EMPTY_SUBMISSION), mesmo com identificação completa", async () => {
      const ctx = makeCtx({ body: { ...validBody, message: "  " } });
      await handlers.sendOuvidoria(ctx);
      expect(ctx.status).to.equal(400);
      expect(ctx.body.code).to.equal("EMPTY_SUBMISSION");
      expect(added).to.have.length(0);
    });

    it("sem identificação nenhuma, aceita só o relato", async () => {
      config = { ...config, allowAnonymous: true };
      const ctx = makeCtx({ body: { message: "Relato" } });
      await handlers.sendOuvidoria(ctx);
      expect(ctx.status).to.equal(202);
      expect(added[0].data.fields).to.deep.equal({
        name: "",
        email: "",
        phone: "",
        city: "",
        state: "",
        company: "",
        message: "Relato",
      });
    });

    it("sem identificação nenhuma, aceita só um arquivo como prova", async () => {
      config = { ...config, allowAnonymous: true };
      const ctx = makeCtx({ body: {}, files: { file: upload("prova.pdf", h.PDF) } });
      await handlers.sendOuvidoria(ctx);
      expect(ctx.status).to.equal(202);
      expect(added[0].data.fields.message).to.equal("");
      expect(added[0].data.file.originalName).to.equal("prova.pdf");
    });

    it("com a identificação obrigatória (allowAnonymous desligado), campos faltando seguem sendo recusados", async () => {
      config = { ...config, allowAnonymous: false };
      const ctx = makeCtx({ body: { message: "Relato" } });
      await handlers.sendOuvidoria(ctx);
      expect(ctx.status).to.equal(400);
      expect(ctx.body.code).to.equal("VALIDATION_ERROR");
    });

    it("aceita envio anônimo quando configurado", async () => {
      config = { ...config, allowAnonymous: true };
      const ctx = makeCtx({ body: { message: "Relato" } });
      await handlers.sendOuvidoria(ctx);
      expect(ctx.status).to.equal(202);
      expect(added[0].data.fields.email).to.equal("");
    });
  });
});
