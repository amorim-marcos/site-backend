"use strict";

/**
 * Integração da rota da Ouvidoria com o Strapi real (sqlite de teste) e a fila
 * simulada. Verifica o que os testes unitários não cobrem: o guard rodando
 * antes do parser, o formato de `ctx.request.files`, as rotas e as permissões.
 *
 * Só roda com OUVIDORIA_INTEGRATION=1 (demora ~1 min para subir o Strapi):
 *   source ~/.nvm/nvm.sh && nvm use 14
 *   OUVIDORIA_INTEGRATION=1 npx mocha --exit test/ouvidoria.integration.test.js
 */

const fs = require("fs");
const path = require("path");
const request = require("supertest");
const { expect } = require("chai");
const h = require("./helpers/ouvidoria");

const enabled = process.env.OUVIDORIA_INTEGRATION === "1";
(enabled ? describe : describe.skip)("ouvidoria/integração (Strapi)", function () {
  this.timeout(120000);

  const SECRET = "integration-secret";
  let tempDir;
  let s3;
  let channelId;
  let defaultChannelId;
  let added;
  let formToken;
  let server;

  const validFields = {
    name: "Maria Silva",
    email: "maria@exemplo.com.br",
    phone: "41988885544",
    city: "Curitiba",
    state: "PR",
    message: "Relato",
  };

  const token = (ageMs = 10000) => formToken.issue(SECRET, Date.now() - ageMs);

  const post = (id = channelId, headers = {}) => {
    let req = request(server).post(`/contact-channels/${id}/sendOuvidoria`);
    Object.keys(headers).forEach((k) => (req = req.set(k, headers[k])));
    return req;
  };

  const withFields = (req, fields = validFields) => {
    Object.keys(fields).forEach((k) => (req = req.field(k, fields[k])));
    return req;
  };

  before(async () => {
    process.env.NODE_ENV = "test";
    tempDir = path.join(h.tmpDir(), "ouvidoria-tmp");
    Object.assign(process.env, {
      OUVIDORIA_ENABLED: "true",
      OUVIDORIA_TEMP_DIR: tempDir,
      OUVIDORIA_S3_BUCKET: "bucket-teste",
      OUVIDORIA_S3_REGION: "sa-east-1",
      OUVIDORIA_ATTACHMENT_BASE_URL: "https://anexos.test/arquivo",
      OUVIDORIA_FORM_TOKEN_SECRET: SECRET,
      OUVIDORIA_RATE_IP_MAX: "1000",
      OUVIDORIA_RATE_GLOBAL_MAX_HOUR: "100000",
    });

    // S3 simulado: o cliente real é carregado sob demanda (`require` no momento do uso).
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

    const { setupStrapi } = require("./helpers/strapi");
    await setupStrapi();
    server = strapi.server;
    formToken = require("../utils/ouvidoria/formToken");

    // Fila simulada: sem Redis no ambiente de teste.
    added = [];
    require("../scripts/bull/src/queues/OuvidoriaQueue").queue.add = async (name, data, opts) => {
      added.push({ name, data, opts });
    };

    // Permissões públicas das ações novas (no ambiente real, passo do cutover).
    const publicRole = await strapi.query("role", "users-permissions").findOne({ type: "public" });
    for (const action of ["sendouvidoria", "ouvidoriaconfig", "findone"]) {
      await strapi
        .query("permission", "users-permissions")
        .update({ controller: "contact-channel", action, role: publicRole.id }, { enabled: true });
    }

    const ouvidoria = await strapi
      .query("contact-channel")
      .create({ name: "Ouvidoria", service_code: "MKT001.02.12", flow: "ouvidoria" });
    channelId = ouvidoria.id;
    const juridico = await strapi.query("contact-channel").create({ name: "Jurídico", service_code: "MKT001.02.07" });
    defaultChannelId = juridico.id;
  });

  beforeEach(() => {
    added.length = 0;
  });

  it("GET config entrega token e regras (rota pública)", async () => {
    const res = await request(server).get(`/contact-channels/${channelId}/ouvidoria/config`);
    expect(res.status).to.equal(200);
    expect(res.body.token).to.be.a("string");
    expect(res.body.maxFileBytes).to.equal(50 * 1024 * 1024);
  });

  it("GET /contact-channels/:id continua funcionando e expõe o campo flow", async () => {
    const res = await request(server).get(`/contact-channels/${channelId}`);
    expect(res.status).to.equal(200);
    expect(res.body.flow).to.equal("ouvidoria");
    const def = await request(server).get(`/contact-channels/${defaultChannelId}`);
    expect(def.body.flow).to.equal("default");
  });

  it("aceita multipart com PDF: 202, arquivo no S3, temporário apagado e job enfileirado", async () => {
    const res = await withFields(post(channelId, { "x-ouvidoria-token": token() })).attach("file", h.PDF, "denuncia.pdf");
    expect(res.status).to.equal(202);
    expect(added).to.have.length(1);

    const { data } = added[0];
    expect(data.fields.email).to.equal("maria@exemplo.com.br");
    expect(data.file.originalName).to.equal("denuncia.pdf");
    expect(data.file.key).to.match(/^[0-9a-f]{32}\.pdf$/);
    expect(s3.objects[data.file.key].body.equals(h.PDF)).to.equal(true);

    // O parser gravou o upload no diretório dedicado (o stream enviado ao S3 lê desse caminho),
    // criado restrito, e a request não deixou nada nele.
    const uploaded = s3.calls.put[s3.calls.put.length - 1];
    expect(path.dirname(uploaded.Body.path)).to.equal(tempDir);
    expect(fs.statSync(tempDir).mode & 0o777).to.equal(0o700);
    expect(fs.readdirSync(tempDir)).to.have.length(0);
  });

  it("o parser global do Strapi continua intacto: sem diretório próprio, só o limite de sempre", () => {
    const { formidable } = strapi.config.middleware.settings.parser;
    expect(formidable).to.deep.equal({ maxFileSize: 250 * 1024 * 1024 });
  });

  it("aceita relato sem nenhuma identificação (modo opcional)", async () => {
    const res = await post(channelId, { "x-ouvidoria-token": token() }).field("message", "Relato anônimo");
    expect(res.status).to.equal(202);
    expect(added[0].data.fields.email).to.equal("");
  });

  it("recusa envio sem relato e sem arquivo (400)", async () => {
    const res = await post(channelId, { "x-ouvidoria-token": token() }).field("name", "Maria");
    expect(res.status).to.equal(400);
    expect(res.body.code).to.equal("EMPTY_SUBMISSION");
  });

  it("recusa multipart malformado (400) sem deixar temporário", async () => {
    const res = await post(channelId, {
      "x-ouvidoria-token": token(),
      "Content-Type": "multipart/form-data; boundary=abc",
    }).send("isto não é multipart");
    expect(res.status).to.equal(400);
    expect(res.body.code).to.equal("MALFORMED_MULTIPART");
    expect(fs.readdirSync(tempDir)).to.have.length(0);
  });

  it("aceita envio sem arquivo", async () => {
    const res = await withFields(post(channelId, { "x-ouvidoria-token": token() }));
    expect(res.status).to.equal(202);
    expect(added[0].data.file).to.equal(null);
  });

  it("o guard roda antes do parser: sem token a rota recusa mesmo com corpo válido", async () => {
    const res = await withFields(post(channelId)).attach("file", h.PDF, "a.pdf");
    expect(res.status).to.equal(403);
    expect(res.body.code).to.equal("FORM_TOKEN_INVALID");
    expect(added).to.have.length(0);
  });

  it("recusas do guard também levam o cabeçalho CORS", async () => {
    const res = await withFields(post(channelId))
      .set("Origin", "http://localhost:3000")
      .attach("file", h.PDF, "a.pdf");
    expect(res.status).to.equal(403);
    expect(res.headers["access-control-allow-origin"]).to.be.a("string");
  });

  it("o guard vale para variações da URL (maiúsculas)", async () => {
    const res = await request(server).post(`/contact-channels/${channelId}/SENDOUVIDORIA`).field("name", "x");
    expect(res.status).to.equal(403);
  });

  it("CORS: o preflight do navegador permite o header X-Ouvidoria-Token", async () => {
    const res = await request(server)
      .options(`/contact-channels/${channelId}/sendOuvidoria`)
      .set("Origin", "https://www.berneck.com.br")
      .set("Access-Control-Request-Method", "POST")
      .set("Access-Control-Request-Headers", "x-ouvidoria-token");
    expect(res.status).to.be.oneOf([200, 204]);
    expect(String(res.headers["access-control-allow-headers"]).toLowerCase()).to.contain("x-ouvidoria-token");
  });

  it("recusa Content-Length acima do limite sem ler o corpo (413)", async () => {
    const res = await post(channelId, {
      "x-ouvidoria-token": token(),
      "Content-Type": "multipart/form-data; boundary=x",
      "Content-Length": String(60 * 1024 * 1024),
    }).send("--x--");
    expect(res.status).to.equal(413);
  });

  it("recusa JSON (415) e token recém-emitido (429)", async () => {
    let res = await post(channelId, { "x-ouvidoria-token": token() }).send(validFields);
    expect(res.status).to.equal(415);

    res = await withFields(post(channelId, { "x-ouvidoria-token": token(500) }));
    expect(res.status).to.equal(429);
    expect(res.body.code).to.equal("FORM_TOO_FAST");
  });

  it("recusa conteúdo que não confere com a extensão (415) sem enviar ao S3 nem deixar temporário", async () => {
    const objects = Object.keys(s3.objects).length;
    const res = await withFields(post(channelId, { "x-ouvidoria-token": token() })).attach("file", h.EXE, "a.pdf");
    expect(res.status).to.equal(415);
    expect(added).to.have.length(0);
    expect(Object.keys(s3.objects)).to.have.length(objects);
    expect(fs.readdirSync(tempDir)).to.have.length(0);
  });

  it("descarta honeypot preenchido com 202 e sem enfileirar", async () => {
    const res = await withFields(post(channelId, { "x-ouvidoria-token": token() }), { ...validFields, website: "x" });
    expect(res.status).to.equal(202);
    expect(added).to.have.length(0);
  });

  it("recusa canal que não é a Ouvidoria (400)", async () => {
    const res = await withFields(post(defaultChannelId, { "x-ouvidoria-token": token() }));
    expect(res.status).to.equal(400);
    expect(res.body.code).to.equal("CHANNEL_NOT_OUVIDORIA");
  });

  after(async () => {
    fs.rmSync(path.dirname(tempDir), { recursive: true, force: true });
    const db = path.join(process.cwd(), ".tmp", "test.db");
    if (fs.existsSync(db)) fs.unlinkSync(db);
  });
});
