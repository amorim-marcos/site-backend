"use strict";

const { expect } = require("chai");

const { syncChannelFlow } = require("../utils/ouvidoria/channelFlow");
const h = require("./helpers/ouvidoria");

function fakeStrapi(channels) {
  const rows = channels.map((channel) => ({ ...channel }));
  const updates = [];
  const query = {
    find: async () => rows.map((row) => ({ ...row, localizations: row.localizations || [] })),
    update: async ({ id }, data) => {
      updates.push({ id, ...data });
      Object.assign(rows.find((row) => row.id === id), data);
    },
  };
  return { strapi: { query: () => query }, rows, updates };
}

const on = { enabled: true, channelName: "Ouvidoria" };
const off = { enabled: false, channelName: "Ouvidoria" };

describe("ouvidoria/channelFlow", () => {
  const log = h.silentLog();

  it("com a funcionalidade ligada, marca o canal e as traduções dele", async () => {
    const { strapi, rows } = fakeStrapi([
      { id: 45, name: "Ouvidoria", flow: null, localizations: [{ id: 46 }, { id: 47 }] },
      { id: 46, name: "Ombudsman", flow: null },
      { id: 47, name: "Defensoría", flow: "default" },
      { id: 10, name: "Jurídico", flow: null },
    ]);
    const result = await syncChannelFlow({ strapi, config: on, log });
    expect(result.changed).to.equal(3);
    expect(rows.filter((r) => r.flow === "ouvidoria").map((r) => r.id).sort()).to.deep.equal([45, 46, 47]);
    expect(rows.find((r) => r.id === 10).flow).to.equal(null);
  });

  it("reconhece o nome sem diferenciar maiúsculas e espaços", async () => {
    const { strapi, rows } = fakeStrapi([{ id: 1, name: "  OUVIDORIA ", flow: null }]);
    await syncChannelFlow({ strapi, config: on, log });
    expect(rows[0].flow).to.equal("ouvidoria");
  });

  it("é idempotente", async () => {
    const { strapi, updates } = fakeStrapi([{ id: 45, name: "Ouvidoria", flow: "ouvidoria" }]);
    const result = await syncChannelFlow({ strapi, config: on, log });
    expect(result.changed).to.equal(0);
    expect(updates).to.have.length(0);
  });

  it("com a funcionalidade desligada, devolve ao fluxo padrão qualquer canal em ouvidoria", async () => {
    const { strapi, rows } = fakeStrapi([
      { id: 45, name: "Ouvidoria", flow: "ouvidoria" },
      { id: 46, name: "Ombudsman", flow: "ouvidoria" },
      { id: 10, name: "Jurídico", flow: null },
    ]);
    const result = await syncChannelFlow({ strapi, config: off, log });
    expect(result.changed).to.equal(2);
    expect(rows.filter((r) => r.flow === "ouvidoria")).to.have.length(0);
    expect(rows.find((r) => r.id === 10).flow).to.equal(null);
  });

  it("desligada e sem canais marcados, não altera nada", async () => {
    const { strapi, updates } = fakeStrapi([{ id: 45, name: "Ouvidoria", flow: null }]);
    expect((await syncChannelFlow({ strapi, config: off, log })).changed).to.equal(0);
    expect(updates).to.have.length(0);
  });

  it("avisa quando não há canal com o nome configurado", async () => {
    const warnings = [];
    const { strapi } = fakeStrapi([{ id: 10, name: "Jurídico", flow: null }]);
    const result = await syncChannelFlow({ strapi, config: on, log: { ...log, warn: (m) => warnings.push(m) } });
    expect(result.changed).to.equal(0);
    expect(warnings).to.have.length(1);
  });
});
