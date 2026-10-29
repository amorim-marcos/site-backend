"use strict";

const { expect } = require("chai");
const { createRateLimiter } = require("../utils/ouvidoria/rateLimiter");

const limits = { ipMax: 3, ipWindowMs: 10 * 60 * 1000, globalMaxPerHour: 5 };

describe("ouvidoria/rateLimiter", () => {
  let clock;
  let limiter;
  beforeEach(() => {
    clock = 1_000_000;
    limiter = createRateLimiter({ now: () => clock });
  });

  it("bloqueia o IP após o limite e informa quando tentar de novo", () => {
    for (let i = 0; i < 3; i += 1) expect(limiter.hit("1.1.1.1", limits).allowed).to.equal(true);
    const blocked = limiter.hit("1.1.1.1", limits);
    expect(blocked.allowed).to.equal(false);
    expect(blocked.scope).to.equal("ip");
    expect(blocked.retryAfterSeconds).to.equal(600);
  });

  it("conta IPs separadamente", () => {
    for (let i = 0; i < 3; i += 1) limiter.hit("1.1.1.1", limits);
    expect(limiter.hit("2.2.2.2", limits).allowed).to.equal(true);
  });

  it("libera o IP quando a janela termina", () => {
    for (let i = 0; i < 4; i += 1) limiter.hit("1.1.1.1", limits);
    clock += limits.ipWindowMs + 1;
    expect(limiter.hit("1.1.1.1", limits).allowed).to.equal(true);
  });

  it("aplica o teto global da rota", () => {
    ["a", "b", "c", "d", "e"].forEach((ip) => expect(limiter.hit(ip, limits).allowed).to.equal(true));
    const blocked = limiter.hit("f", limits);
    expect(blocked.allowed).to.equal(false);
    expect(blocked.scope).to.equal("global");
  });

  it("um IP já bloqueado não consome o teto global", () => {
    for (let i = 0; i < 10; i += 1) limiter.hit("1.1.1.1", limits); // 3 contam, 7 bloqueados
    // global usou 3 de 5: ainda cabem 2 envios de outros IPs
    expect(limiter.hit("x", limits).allowed).to.equal(true);
    expect(limiter.hit("y", limits).allowed).to.equal(true);
    expect(limiter.hit("z", limits).allowed).to.equal(false);
  });

  it("zera o teto global após uma hora", () => {
    ["a", "b", "c", "d", "e", "f"].forEach((ip) => limiter.hit(ip, limits));
    clock += 60 * 60 * 1000 + 1;
    expect(limiter.hit("g", limits).allowed).to.equal(true);
  });
});
