"use strict";

const Koa = require("koa");
const { expect } = require("chai");
const { applyTrustedProxyHops } = require("../utils/trusted-proxy");

// Usa o Koa real do projeto para provar a semântica de `ctx.ip`.
function ipFor(app, forwardedFor) {
  const ctx = app.createContext(
    { headers: { "x-forwarded-for": forwardedFor }, socket: { remoteAddress: "10.0.0.1" } },
    { getHeader() {}, setHeader() {} }
  );
  return ctx.request.ip;
}

describe("trusted-proxy", () => {
  it("sem proxy ligado não mexe em nada e ignora o X-Forwarded-For", () => {
    const app = new Koa();
    expect(applyTrustedProxyHops(app, { PROXY_TRUSTED_HOPS: "1" })).to.equal(0);
    expect(ipFor(app, "6.6.6.6")).to.equal("10.0.0.1");
  });

  it("proxy ligado sem limite: o primeiro IP é forjável (comportamento padrão do Koa)", () => {
    const app = new Koa();
    app.proxy = true;
    expect(ipFor(app, "6.6.6.6, 1.2.3.4")).to.equal("6.6.6.6");
  });

  it("1 salto (ALB): usa o último IP, o que a ALB acrescentou, e ignora o forjado", () => {
    const app = new Koa();
    app.proxy = true;
    expect(applyTrustedProxyHops(app, {})).to.equal(1);
    expect(ipFor(app, "6.6.6.6, 1.2.3.4")).to.equal("1.2.3.4");
  });

  it("2 saltos (CloudFront + ALB): usa o IP do cliente, ignorando o que veio forjado antes", () => {
    const app = new Koa();
    app.proxy = true;
    expect(applyTrustedProxyHops(app, { PROXY_TRUSTED_HOPS: "2" })).to.equal(2);
    expect(ipFor(app, "6.6.6.6, 1.2.3.4, 52.1.1.1")).to.equal("1.2.3.4");
  });

  it("valor inválido falha em vez de deixar o IP forjável", () => {
    const app = new Koa();
    app.proxy = true;
    ["abc", "-1", "0", "1.5"].forEach((value) => {
      expect(() => applyTrustedProxyHops(app, { PROXY_TRUSTED_HOPS: value })).to.throw(/PROXY_TRUSTED_HOPS/);
    });
  });
});
