"use strict";

const { expect } = require("chai");
const { getConfig, missingRouteVariables } = require("../utils/ouvidoria/config");

describe("ouvidoria/config", () => {
  it("padrões: desligada, identificação opcional, 50 MB e limites enxutos", () => {
    const config = getConfig({});
    expect(config.enabled).to.equal(false);
    expect(config.allowAnonymous).to.equal(true);
    expect(config.maxFileBytes).to.equal(50 * 1024 * 1024);
    expect(config.maxBodyBytes).to.equal(51 * 1024 * 1024);
    expect(config.rate).to.deep.equal({ ipMax: 3, ipWindowMs: 600000, globalMaxPerHour: 10 });
    expect(config.temp).to.deep.include({ maxAgeMs: 3600000, sweepIntervalMs: 900000, maxConcurrentUploads: 3 });
    expect(config.scan).to.deep.equal({ wait: true, timeoutMs: 600000, pollIntervalMs: 10000 });
    expect(config.job).to.deep.include({ attempts: 8, concurrency: 2, timeoutMs: 20 * 60 * 1000 });
  });

  it("o token do SE é o da Ouvidoria, com o do Fale Conosco como reserva", () => {
    expect(getConfig({ SE_AUTH_TOKEN: "fale", SE_OUVIDORIA_AUTH_TOKEN: "ouv" }).se.authToken).to.equal("ouv");
    expect(getConfig({ SE_AUTH_TOKEN: "fale" }).se.authToken).to.equal("fale");
    expect(getConfig({}).se.authToken).to.equal("");
  });

  it("a identificação volta a ser obrigatória com OUVIDORIA_ALLOW_ANONYMOUS=false", () => {
    expect(getConfig({ OUVIDORIA_ALLOW_ANONYMOUS: "false" }).allowAnonymous).to.equal(false);
  });

  it("os limites vêm das variáveis de ambiente", () => {
    const config = getConfig({ OUVIDORIA_RATE_GLOBAL_MAX_HOUR: "60", OUVIDORIA_MAX_CONCURRENT_UPLOADS: "5", OUVIDORIA_MAX_FILE_MB: "20" });
    expect(config.rate.globalMaxPerHour).to.equal(60);
    expect(config.temp.maxConcurrentUploads).to.equal(5);
    expect(config.maxFileBytes).to.equal(20 * 1024 * 1024);
  });

  it("monta o endereço do download sem barra no fim", () => {
    expect(getConfig({ OUVIDORIA_ATTACHMENT_BASE_URL: "https://anexos.test/arquivo///" }).attachment.baseUrl).to.equal("https://anexos.test/arquivo");
  });

  describe("missingRouteVariables", () => {
    it("lista o que falta para a rota aceitar envios", () => {
      expect(missingRouteVariables(getConfig({}))).to.have.members([
        "OUVIDORIA_TEMP_DIR",
        "OUVIDORIA_S3_BUCKET",
        "OUVIDORIA_S3_REGION",
        "OUVIDORIA_ATTACHMENT_BASE_URL",
        "OUVIDORIA_FORM_TOKEN_SECRET",
      ]);
    });

    it("não lista nada com tudo configurado", () => {
      const config = getConfig({
        OUVIDORIA_TEMP_DIR: "/data/tmp",
        OUVIDORIA_S3_BUCKET: "b",
        OUVIDORIA_S3_REGION: "sa-east-1",
        OUVIDORIA_ATTACHMENT_BASE_URL: "https://anexos.test/arquivo",
        OUVIDORIA_FORM_TOKEN_SECRET: "s",
      });
      expect(missingRouteVariables(config)).to.deep.equal([]);
    });
  });
});
