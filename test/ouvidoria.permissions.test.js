"use strict";

const { expect } = require("chai");

const { ensurePublicPermissions, ACTIONS } = require("../utils/ouvidoria/permissions");
const h = require("./helpers/ouvidoria");

function fakeStrapi({ role = { id: 2, type: "public" }, permissions = [] } = {}) {
  const rows = permissions.map((row, index) => ({ id: index + 1, ...row }));
  const calls = { create: [], update: [] };
  const matches = (row, where) => Object.keys(where).every((key) => row[key] === where[key]);

  const queries = {
    role: { findOne: async (where) => (role && matches(role, where) ? role : null) },
    permission: {
      findOne: async (where) => rows.find((row) => matches(row, where)) || null,
      create: async (data) => {
        calls.create.push(data);
        rows.push({ id: rows.length + 1, ...data });
      },
      update: async (where, data) => {
        calls.update.push({ where, data });
        Object.assign(rows.find((row) => matches(row, where)), data);
      },
    },
  };
  return { strapi: { query: (name) => queries[name] }, rows, calls };
}

const row = (action, enabled, roleId = 2) => ({ controller: "contact-channel", action, role: roleId, enabled });

describe("ouvidoria/permissions", () => {
  const log = h.silentLog();

  it("não altera nada com a funcionalidade desligada", async () => {
    const { strapi, calls } = fakeStrapi({ permissions: ACTIONS.map((a) => row(a, false)) });
    const result = await ensurePublicPermissions({ strapi, config: { enabled: false }, log });
    expect(result.changed).to.equal(0);
    expect(calls.create).to.have.length(0);
    expect(calls.update).to.have.length(0);
  });

  it("habilita as permissões desligadas do papel Public", async () => {
    const { strapi, rows } = fakeStrapi({ permissions: ACTIONS.map((a) => row(a, false)) });
    const result = await ensurePublicPermissions({ strapi, config: { enabled: true }, log });
    expect(result.changed).to.equal(2);
    expect(rows.every((r) => r.enabled)).to.equal(true);
  });

  it("cria as linhas que ainda não existem", async () => {
    const { strapi, rows, calls } = fakeStrapi();
    const result = await ensurePublicPermissions({ strapi, config: { enabled: true }, log });
    expect(result.changed).to.equal(2);
    expect(calls.create).to.have.length(2);
    expect(rows.map((r) => r.action).sort()).to.deep.equal([...ACTIONS].sort());
    expect(rows.every((r) => r.enabled && r.role === 2 && r.type === "application")).to.equal(true);
  });

  it("é idempotente: a segunda execução não muda nada", async () => {
    const { strapi } = fakeStrapi({ permissions: ACTIONS.map((a) => row(a, false)) });
    await ensurePublicPermissions({ strapi, config: { enabled: true }, log });
    const again = await ensurePublicPermissions({ strapi, config: { enabled: true }, log });
    expect(again.changed).to.equal(0);
  });

  it("não mexe nas permissões de outros papéis", async () => {
    const authenticated = ACTIONS.map((a) => row(a, false, 1));
    const { strapi, rows } = fakeStrapi({ permissions: [...authenticated, ...ACTIONS.map((a) => row(a, false, 2))] });
    await ensurePublicPermissions({ strapi, config: { enabled: true }, log });
    expect(rows.filter((r) => r.role === 1).every((r) => r.enabled === false)).to.equal(true);
    expect(rows.filter((r) => r.role === 2).every((r) => r.enabled === true)).to.equal(true);
  });

  it("avisa e segue se o papel Public não existir", async () => {
    const warnings = [];
    const { strapi, calls } = fakeStrapi({ role: null });
    const result = await ensurePublicPermissions({ strapi, config: { enabled: true }, log: { ...log, warn: (m) => warnings.push(m) } });
    expect(result.changed).to.equal(0);
    expect(calls.create).to.have.length(0);
    expect(warnings).to.have.length(1);
  });
});
