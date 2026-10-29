"use strict";

const { expect } = require("chai");
const formToken = require("../utils/ouvidoria/formToken");

const secret = "segredo";
const opts = { minAgeSeconds: 3, maxAgeMs: 60 * 60 * 1000 };

describe("ouvidoria/formToken", () => {
  const issuedAt = 1_000_000;
  const token = formToken.issue(secret, issuedAt);

  it("aceita um token com idade entre o mínimo e o máximo", () => {
    expect(formToken.verify(token, secret, { ...opts, now: issuedAt + 5000 })).to.deep.equal({ ok: true });
  });

  it("recusa token usado cedo demais", () => {
    expect(formToken.verify(token, secret, { ...opts, now: issuedAt + 1000 })).to.deep.equal({ ok: false, reason: "TOO_FAST" });
  });

  it("recusa token expirado", () => {
    expect(formToken.verify(token, secret, { ...opts, now: issuedAt + opts.maxAgeMs + 1 })).to.deep.equal({
      ok: false,
      reason: "EXPIRED",
    });
  });

  it("recusa token adulterado ou assinado com outro segredo", () => {
    const [ts, nonce, sig] = token.split(".");
    const forged = `${Number(ts) - 100000}.${nonce}.${sig}`;
    expect(formToken.verify(forged, secret, { ...opts, now: issuedAt + 5000 }).reason).to.equal("BAD_SIGNATURE");
    expect(formToken.verify(token, "outro", { ...opts, now: issuedAt + 5000 }).reason).to.equal("BAD_SIGNATURE");
  });

  it("recusa token ausente ou malformado", () => {
    expect(formToken.verify(undefined, secret, opts).reason).to.equal("MISSING");
    expect(formToken.verify("", secret, opts).reason).to.equal("MISSING");
    expect(formToken.verify("abc", secret, opts).reason).to.equal("MALFORMED");
    expect(formToken.verify("1.zz.ab", secret, opts).reason).to.equal("MALFORMED");
  });

  it("não é de uso único (reenvio legítimo)", () => {
    const now = issuedAt + 5000;
    expect(formToken.verify(token, secret, { ...opts, now }).ok).to.equal(true);
    expect(formToken.verify(token, secret, { ...opts, now }).ok).to.equal(true);
  });
});
