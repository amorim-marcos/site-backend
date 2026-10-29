"use strict";

const fs = require("fs");
const path = require("path");
const { expect } = require("chai");
const h = require("./helpers/ouvidoria");
const { sweepTempDir, ensureTempDir } = require("../utils/ouvidoria/tempDir");

describe("ouvidoria/tempDir", () => {
  const MIN = 60 * 1000;
  let dir;

  beforeEach(() => {
    dir = h.tmpDir();
  });

  const age = (name, minutes) => {
    const filePath = h.writeTemp(dir, name, "x");
    const when = new Date(Date.now() - minutes * MIN);
    fs.utimesSync(filePath, when, when);
  };

  describe("sweepTempDir", () => {
    it("remove apenas arquivos parados além do prazo", async () => {
      age("orfao.bin", 120);
      age("recente.bin", 5);
      age("limite.bin", 59);

      const removed = await sweepTempDir({ dir, maxAgeMs: 60 * MIN, log: h.silentLog() });

      expect(removed).to.equal(1);
      expect(fs.readdirSync(dir).sort()).to.deep.equal(["limite.bin", "recente.bin"]);
    });

    it("ignora subdiretórios", async () => {
      fs.mkdirSync(path.join(dir, "sub"));
      age("orfao.bin", 600);
      await sweepTempDir({ dir, maxAgeMs: 60 * MIN, log: h.silentLog() });
      expect(fs.readdirSync(dir)).to.deep.equal(["sub"]);
    });

    it("não falha se o diretório não existe ou não está configurado", async () => {
      expect(await sweepTempDir({ dir: path.join(dir, "nao-existe"), maxAgeMs: 60 * MIN })).to.equal(0);
      expect(await sweepTempDir({ dir: "", maxAgeMs: 60 * MIN })).to.equal(0);
    });
  });

  describe("ensureTempDir", () => {
    it("cria o diretório com modo 0700 quando não existe", () => {
      const target = path.join(dir, "novo", "privado");
      expect(ensureTempDir(target)).to.deep.equal({ ok: true });
      expect(fs.statSync(target).mode & 0o777).to.equal(0o700);
    });

    it("restringe o modo de um diretório que já existia mais aberto", () => {
      const target = path.join(dir, "aberto");
      fs.mkdirSync(target, { mode: 0o755 });
      expect(ensureTempDir(target).ok).to.equal(true);
      expect(fs.statSync(target).mode & 0o777).to.equal(0o700);
    });

    it("informa o erro quando não é possível criar ou escrever", () => {
      const file = h.writeTemp(dir, "arquivo", "x");
      const result = ensureTempDir(path.join(file, "dentro"));
      expect(result.ok).to.equal(false);
      expect(result.error).to.be.a("string");
    });
  });
});
