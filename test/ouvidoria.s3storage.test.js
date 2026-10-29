"use strict";

const { expect } = require("chai");
const h = require("./helpers/ouvidoria");
const { createStorage, SCAN_TAG, SCAN_CLEAN } = require("../utils/ouvidoria/s3Storage");

describe("ouvidoria/s3Storage", () => {
  let dir;
  let s3;
  let storage;

  beforeEach(() => {
    dir = h.tmpDir();
    s3 = h.fakeS3();
    storage = createStorage(h.baseConfig(), { client: s3 });
  });

  describe("newKey / urlFor", () => {
    it("gera chave única, sem o nome do usuário, preservando a extensão", () => {
      const a = storage.newKey("pdf");
      const b = storage.newKey("pdf");
      expect(a).to.match(/^[0-9a-f]{32}\.pdf$/);
      expect(a).to.not.equal(b);
    });

    it("aplica o prefixo configurado, com uma barra no fim", () => {
      const withPrefix = createStorage(h.baseConfig({ s3: { ...h.baseConfig().s3, prefix: "/ouvidoria" } }), { client: s3 });
      expect(withPrefix.newKey("png")).to.match(/^ouvidoria\/[0-9a-f]{32}\.png$/);
    });

    it("monta a URL do download seguro: <baseUrl>/<chave>", () => {
      expect(storage.urlFor("abc.pdf")).to.equal("https://anexos.test/arquivo/abc.pdf");
      expect(storage.urlFor("pasta/abc.pdf")).to.equal("https://anexos.test/arquivo/pasta/abc.pdf");
    });

    it("a URL cabe no campo anexo1 do SE (255 caracteres)", () => {
      expect(storage.urlFor(storage.newKey("webm")).length).to.be.below(255);
    });
  });

  describe("upload", () => {
    it("envia o conteúdo, tamanho, tipo e nome original (codificado) ao bucket", async () => {
      const filePath = h.writeTemp(dir, "tmp.pdf", h.PDF);
      await storage.upload({ filePath, key: "k.pdf", size: h.PDF.length, mime: "application/pdf", originalName: "relatório final.pdf" });

      const stored = s3.objects["k.pdf"];
      expect(stored.body.equals(h.PDF)).to.equal(true);
      expect(stored.params).to.include({ Bucket: "bucket-test", ContentType: "application/pdf", ContentLength: h.PDF.length });
      expect(stored.params.Metadata["original-name"]).to.equal(encodeURIComponent("relatório final.pdf"));
    });

    it("tenta de novo com um stream novo quando a primeira tentativa falha", async () => {
      const flaky = h.fakeS3({ failPuts: 1 });
      const retrying = createStorage(h.baseConfig(), { client: flaky });
      const filePath = h.writeTemp(dir, "tmp.pdf", h.PDF);

      await retrying.upload({ filePath, key: "k.pdf", size: h.PDF.length, mime: "application/pdf", originalName: "a.pdf" });

      expect(flaky.calls.put).to.have.length(2);
      expect(flaky.objects["k.pdf"].body.equals(h.PDF)).to.equal(true);
    });

    it("propaga o erro depois de esgotar as tentativas", async () => {
      const down = h.fakeS3({ failPuts: 5 });
      const failing = createStorage(h.baseConfig(), { client: down });
      const filePath = h.writeTemp(dir, "tmp.pdf", h.PDF);

      let error;
      try {
        await failing.upload({ filePath, key: "k.pdf", size: h.PDF.length, mime: "application/pdf", originalName: "a.pdf" });
      } catch (e) {
        error = e;
      }
      expect(error).to.be.instanceOf(Error);
      expect(down.calls.put).to.have.length(2);
    });
  });

  describe("scanStatus", () => {
    beforeEach(async () => {
      const filePath = h.writeTemp(dir, "tmp.pdf", h.PDF);
      await storage.upload({ filePath, key: "k.pdf", size: h.PDF.length, mime: "application/pdf", originalName: "a.pdf" });
    });

    it("devolve null enquanto o GuardDuty não aplicou a tag", async () => {
      expect(await storage.scanStatus("k.pdf")).to.equal(null);
    });

    it("devolve o valor da tag de varredura", async () => {
      s3.setScan("k.pdf", SCAN_CLEAN);
      expect(await storage.scanStatus("k.pdf")).to.equal("NO_THREATS_FOUND");
      expect(SCAN_TAG).to.equal("GuardDutyMalwareScanStatus");
    });

    it("propaga o erro quando o objeto não existe", async () => {
      let error;
      try {
        await storage.scanStatus("outro.pdf");
      } catch (e) {
        error = e;
      }
      expect(error.code).to.equal("NoSuchKey");
    });
  });
});
