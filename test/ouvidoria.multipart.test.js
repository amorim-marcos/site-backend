"use strict";

const fs = require("fs");
const http = require("http");
const request = require("supertest");
const { expect } = require("chai");
const h = require("./helpers/ouvidoria");
const { parseMultipart } = require("../utils/ouvidoria/multipart");

/**
 * Leitura do multipart contra um servidor HTTP real: o formidable precisa receber
 * o corpo de verdade para os limites e a limpeza em erro serem testados.
 */
describe("ouvidoria/multipart", () => {
  let dir;
  let server;
  let maxBodyBytes;
  let outcome;

  before((done) => {
    server = http.createServer(async (req, res) => {
      try {
        outcome = { parsed: await parseMultipart(req, { uploadDir: dir, maxBodyBytes }) };
        res.statusCode = 200;
      } catch (error) {
        outcome = { error };
        res.statusCode = error.status || 500;
      }
      res.end();
    });
    server.listen(0, "127.0.0.1", done);
  });

  after((done) => server.close(done));

  beforeEach(() => {
    dir = h.tmpDir();
    maxBodyBytes = 1024 * 1024;
    outcome = null;
  });

  const post = () => request(server).post("/");

  it("grava o arquivo no diretório dedicado e devolve campos e arquivo no formato do formidable", async () => {
    const res = await post().field("message", "Relato").field("name", "Maria").attach("file", h.PDF, "denuncia.pdf");
    expect(res.status).to.equal(200);

    const { fields, files } = outcome.parsed;
    expect(fields).to.include({ message: "Relato", name: "Maria" });
    expect(files.file.name).to.equal("denuncia.pdf");
    expect(files.file.size).to.equal(h.PDF.length);
    expect(require("path").dirname(files.file.path)).to.equal(dir);
    expect(fs.readFileSync(files.file.path).equals(h.PDF)).to.equal(true);
  });

  it("aceita envio sem arquivo", async () => {
    const res = await post().field("message", "Relato");
    expect(res.status).to.equal(200);
    expect(outcome.parsed.files).to.deep.equal({});
  });

  it("dois arquivos no mesmo campo viram array, para o handler recusar", async () => {
    await post().attach("file", h.PDF, "a.pdf").attach("file", h.PDF, "b.pdf");
    expect([].concat(outcome.parsed.files.file)).to.have.length(2);
  });

  it("recusa corpo acima do teto (413) e não deixa arquivo parcial", async () => {
    maxBodyBytes = 2048;
    const res = await post().attach("file", Buffer.concat([h.PDF, Buffer.alloc(5000)]), "grande.pdf");
    expect(res.status).to.equal(413);
    expect(outcome.error.code).to.equal("BODY_TOO_LARGE");
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(fs.readdirSync(dir)).to.have.length(0);
  });

  it("recusa excesso de campos de texto (413)", async () => {
    let req = post();
    for (let i = 0; i < 40; i += 1) req = req.field(`f${i}`, "x");
    const res = await req;
    expect(res.status).to.equal(413);
  });

  it("recusa multipart malformado (400)", async () => {
    const res = await post().set("Content-Type", "multipart/form-data; boundary=abc").send("isto não é multipart");
    expect(res.status).to.equal(400);
    expect(outcome.error.code).to.equal("MALFORMED_MULTIPART");
  });

  it("recusa Content-Type que não é multipart (400)", async () => {
    const res = await post().set("Content-Type", "application/json").send({ a: 1 });
    expect(res.status).to.equal(400);
    expect(outcome.error.code).to.equal("MALFORMED_MULTIPART");
  });

  it("devolve 503 se o diretório temporário não existe, sem deixar nada para trás", async () => {
    fs.rmSync(dir, { recursive: true, force: true });
    const res = await post().attach("file", h.PDF, "a.pdf");
    expect(res.status).to.equal(503);
    expect(outcome.error.code).to.equal("STORAGE_UNAVAILABLE");
  });
});
