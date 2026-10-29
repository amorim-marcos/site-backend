"use strict";

const { expect } = require("chai");
const h = require("./helpers/ouvidoria");
const formToken = require("../utils/ouvidoria/formToken");
const { createGuard, matches } = require("../utils/ouvidoria/guard");
const { createRateLimiter } = require("../utils/ouvidoria/rateLimiter");

const NOW = 5_000_000;

function makeCtx({ method = "POST", path = "/contact-channels/45/sendOuvidoria", headers = {}, multipart = true, ip = "9.9.9.9" } = {}) {
  const lower = {};
  Object.keys(headers).forEach((k) => (lower[k.toLowerCase()] = headers[k]));
  const responseHeaders = {};
  return {
    method,
    path,
    status: 404,
    body: undefined,
    state: {},
    req: { headers: { "content-type": "multipart/form-data; boundary=x" } },
    responseHeaders,
    request: { ip, is: () => (multipart ? "multipart/form-data" : false) },
    get: (name) => lower[name.toLowerCase()] || "",
    set: (name, value) => {
      responseHeaders[name] = value;
    },
  };
}

describe("ouvidoria/guard", () => {
  let config;
  let limiter;
  let guard;
  let validToken;
  let parsed;
  let parseError;
  let tempResult;

  const run = async (ctx) => {
    let passed = false;
    await guard(ctx, async () => {
      passed = true;
    });
    return passed;
  };

  const goodHeaders = (extra = {}) => ({
    "x-ouvidoria-token": validToken,
    "content-length": "1000",
    ...extra,
  });

  beforeEach(() => {
    config = h.baseConfig();
    limiter = createRateLimiter({ now: () => NOW });
    parsed = { fields: { message: "x" }, files: {} };
    parseError = null;
    tempResult = { ok: true };
    guard = createGuard({
      getConfig: () => config,
      limiter,
      now: () => NOW,
      log: h.silentLog(),
      parse: async () => {
        if (parseError) throw parseError;
        return parsed;
      },
      ensureTemp: () => tempResult,
    });
    validToken = formToken.issue(config.formToken.secret, NOW - 10_000);
  });

  it("não interfere em outras rotas", async () => {
    expect(await run(makeCtx({ path: "/contact-channels/45/sendForm" }))).to.equal(true);
    expect(await run(makeCtx({ method: "GET" }))).to.equal(true);
  });

  it("reconhece a rota sem diferenciar maiúsculas, com barra final ou codificada", () => {
    expect(matches("/contact-channels/45/sendOuvidoria")).to.equal(true);
    expect(matches("/contact-channels/45/sendouvidoria")).to.equal(true);
    expect(matches("/contact-channels/45/sendOuvidoria/")).to.equal(true);
    expect(matches("/contact-channels/45/send%4Fuvidoria")).to.equal(true);
    expect(matches("/contact-channels/45/sendForm")).to.equal(false);
  });

  it("aplica o guard também com variação de maiúsculas na URL", async () => {
    const ctx = makeCtx({ path: "/contact-channels/45/SENDOUVIDORIA", headers: {} });
    expect(await run(ctx)).to.equal(false);
    expect(ctx.status).to.equal(403);
  });

  it("responde 404 quando a funcionalidade está desligada", async () => {
    config = { ...config, enabled: false };
    const ctx = makeCtx({ headers: goodHeaders() });
    expect(await run(ctx)).to.equal(false);
    expect(ctx.status).to.equal(404);
  });

  it("responde 503 e bloqueia quando falta configuração", async () => {
    config = { ...config, temp: { ...config.temp, dir: "" } };
    const ctx = makeCtx({ headers: goodHeaders() });
    expect(await run(ctx)).to.equal(false);
    expect(ctx.status).to.equal(503);
  });

  it("deixa passar um envio válido", async () => {
    const ctx = makeCtx({ headers: goodHeaders() });
    expect(await run(ctx)).to.equal(true);
  });

  it("aplica rate limit por IP com Retry-After, antes de ler o corpo", async () => {
    for (let i = 0; i < 3; i += 1) expect(await run(makeCtx({ headers: goodHeaders() }))).to.equal(true);
    const ctx = makeCtx({ headers: goodHeaders() });
    expect(await run(ctx)).to.equal(false);
    expect(ctx.status).to.equal(429);
    expect(ctx.body.code).to.equal("RATE_LIMITED");
    expect(ctx.responseHeaders["Retry-After"]).to.equal("600");
  });

  it("recusa token ausente, inválido ou expirado com 403", async () => {
    let ctx = makeCtx({ headers: goodHeaders({ "x-ouvidoria-token": "" }) });
    expect(await run(ctx)).to.equal(false);
    expect(ctx.status).to.equal(403);
    expect(ctx.body.code).to.equal("FORM_TOKEN_INVALID");

    ctx = makeCtx({ ip: "2.2.2.2", headers: goodHeaders({ "x-ouvidoria-token": formToken.issue(config.formToken.secret, NOW - 4_000_000) }) });
    expect(await run(ctx)).to.equal(false);
    expect(ctx.body.code).to.equal("FORM_TOKEN_EXPIRED");
  });

  it("requisição sem token válido não consome a cota de rate limit", async () => {
    for (let i = 0; i < 20; i += 1) {
      await run(makeCtx({ headers: goodHeaders({ "x-ouvidoria-token": "" }) }));
    }
    expect(await run(makeCtx({ headers: goodHeaders() }))).to.equal(true);
  });

  it("recusa envio rápido demais com 429 e Retry-After", async () => {
    const fresh = formToken.issue(config.formToken.secret, NOW - 500);
    const ctx = makeCtx({ headers: goodHeaders({ "x-ouvidoria-token": fresh }) });
    expect(await run(ctx)).to.equal(false);
    expect(ctx.status).to.equal(429);
    expect(ctx.body.code).to.equal("FORM_TOO_FAST");
  });

  it("recusa corpo que não é multipart", async () => {
    const ctx = makeCtx({ headers: goodHeaders(), multipart: false });
    expect(await run(ctx)).to.equal(false);
    expect(ctx.status).to.equal(415);
  });

  it("exige Content-Length e recusa transferência chunked", async () => {
    let ctx = makeCtx({ headers: goodHeaders({ "content-length": "" }) });
    expect(await run(ctx)).to.equal(false);
    expect(ctx.status).to.equal(411);

    ctx = makeCtx({ ip: "3.3.3.3", headers: goodHeaders({ "transfer-encoding": "chunked" }) });
    expect(await run(ctx)).to.equal(false);
    expect(ctx.status).to.equal(411);

    ctx = makeCtx({ ip: "4.4.4.4", headers: goodHeaders({ "content-length": "abc" }) });
    expect(await run(ctx)).to.equal(false);
    expect(ctx.status).to.equal(411);
  });

  it("recusa corpo acima de 50 MB + folga e aceita no limite", async () => {
    let ctx = makeCtx({ headers: goodHeaders({ "content-length": String(config.maxBodyBytes + 1) }) });
    expect(await run(ctx)).to.equal(false);
    expect(ctx.status).to.equal(413);
    expect(ctx.body.code).to.equal("BODY_TOO_LARGE");

    ctx = makeCtx({ ip: "5.5.5.5", headers: goodHeaders({ "content-length": String(config.maxBodyBytes) }) });
    expect(await run(ctx)).to.equal(true);
  });

  it("recusa 250 MB, o limite global do parser do Strapi", async () => {
    const ctx = makeCtx({ headers: goodHeaders({ "content-length": String(250 * 1024 * 1024) }) });
    expect(await run(ctx)).to.equal(false);
    expect(ctx.status).to.equal(413);
  });

  describe("leitura do multipart", () => {
    it("entrega campos e arquivos ao handler em ctx.state e esconde o multipart do parser global", async () => {
      const ctx = makeCtx({ headers: goodHeaders() });
      let seenContentType;
      await guard(ctx, async () => {
        seenContentType = ctx.req.headers["content-type"];
        expect(ctx.state.ouvidoriaForm).to.equal(parsed);
      });
      expect(seenContentType).to.equal("application/x-ouvidoria-parsed");
    });

    it("traduz erro de leitura em resposta, sem chamar o parser global", async () => {
      const { OuvidoriaError } = require("../utils/ouvidoria/errors");
      parseError = new OuvidoriaError(400, "MALFORMED_MULTIPART", "Corpo multipart inválido");
      const ctx = makeCtx({ headers: goodHeaders() });
      expect(await run(ctx)).to.equal(false);
      expect(ctx.status).to.equal(400);
      expect(ctx.body.code).to.equal("MALFORMED_MULTIPART");
    });

    it("propaga erro inesperado em vez de escondê-lo", async () => {
      parseError = new Error("bug");
      let error;
      try {
        await run(makeCtx({ headers: goodHeaders() }));
      } catch (e) {
        error = e;
      }
      expect(error.message).to.equal("bug");
    });

    it("responde 503 se o diretório temporário não está disponível", async () => {
      tempResult = { ok: false, error: "EACCES" };
      const ctx = makeCtx({ headers: goodHeaders() });
      expect(await run(ctx)).to.equal(false);
      expect(ctx.status).to.equal(503);
      expect(ctx.body.code).to.equal("STORAGE_UNAVAILABLE");
    });

    it("apaga os temporários ao fim da request, inclusive se o handler falhar", async () => {
      const dir = h.tmpDir();
      const one = h.writeTemp(dir, "um", "x");
      const two = h.writeTemp(dir, "dois", "x");
      parsed = { fields: {}, files: { file: [{ path: one }, { path: two }] } };

      let error;
      try {
        await guard(makeCtx({ headers: goodHeaders() }), async () => {
          throw new Error("falha depois do parser");
        });
      } catch (e) {
        error = e;
      }
      expect(error.message).to.equal("falha depois do parser");
      await new Promise((resolve) => setTimeout(resolve, 20));
      expect(require("fs").readdirSync(dir)).to.have.length(0);
    });
  });

  describe("prazo de recebimento do corpo", () => {
    it("recusa com 408, derruba a conexão e libera a vaga se o corpo não chega a tempo", async () => {
      config = { ...config, temp: { ...config.temp, maxConcurrentUploads: 1 } };
      const slow = createGuard({
        getConfig: () => config,
        limiter: createRateLimiter({ now: () => NOW }),
        now: () => NOW,
        log: h.silentLog(),
        parse: () => new Promise(() => {}),
        ensureTemp: () => ({ ok: true }),
        parseTimeoutMs: 20,
      });
      const ctx = makeCtx({ headers: goodHeaders() });
      let destroyed = false;
      ctx.req.destroy = () => {
        destroyed = true;
      };
      let passed = false;
      await slow(ctx, async () => {
        passed = true;
      });
      expect(passed).to.equal(false);
      expect(ctx.status).to.equal(408);
      expect(ctx.body.code).to.equal("UPLOAD_TIMEOUT");
      expect(destroyed).to.equal(true);

      const next = makeCtx({ ip: "9.9.9.9", headers: goodHeaders() });
      next.req.destroy = () => {};
      await slow(next, async () => {});
      expect(next.body.code).to.equal("UPLOAD_TIMEOUT");
    });
  });

  describe("teto de envios simultâneos", () => {
    // Mantém o `next` pendente (upload em andamento) até `release()`.
    const hold = (ctx) => {
      let release;
      const pending = guard(ctx, () => new Promise((resolve) => (release = resolve)));
      return { release: () => release(), pending };
    };

    beforeEach(() => {
      config = { ...config, rate: { ...config.rate, ipMax: 100, globalMaxPerHour: 100 }, temp: { ...config.temp, maxConcurrentUploads: 2 } };
    });

    it("recusa com 503 e Retry-After quando o teto é atingido", async () => {
      const first = hold(makeCtx({ headers: goodHeaders() }));
      const second = hold(makeCtx({ headers: goodHeaders() }));

      const third = makeCtx({ headers: goodHeaders() });
      expect(await run(third)).to.equal(false);
      expect(third.status).to.equal(503);
      expect(third.body.code).to.equal("BUSY");
      expect(third.responseHeaders["Retry-After"]).to.equal("30");

      first.release();
      second.release();
      await Promise.all([first.pending, second.pending]);
    });

    it("libera a vaga quando o envio termina, inclusive com erro", async () => {
      const first = hold(makeCtx({ headers: goodHeaders() }));
      const failing = guard(makeCtx({ headers: goodHeaders() }), async () => {
        throw new Error("parser falhou");
      }).catch(() => {});
      await failing;

      // Uma vaga ocupada (first) e uma liberada pelo erro: cabe mais um.
      const next = hold(makeCtx({ headers: goodHeaders() }));
      const blocked = makeCtx({ headers: goodHeaders() });
      expect(await run(blocked)).to.equal(false);
      expect(blocked.status).to.equal(503);

      first.release();
      next.release();
      await Promise.all([first.pending, next.pending]);

      expect(await run(makeCtx({ headers: goodHeaders() }))).to.equal(true);
    });
  });
});
