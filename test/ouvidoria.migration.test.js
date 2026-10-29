"use strict";

const { expect } = require("chai");
const knex = require("knex");
const migration = require("../migrations/schemas/20261019120000_add_flow_to_contact_channels");

describe("ouvidoria/migration add_flow_to_contact_channels", () => {
  let db;

  beforeEach(async () => {
    db = knex({ client: "sqlite3", connection: { filename: ":memory:" }, useNullAsDefault: true });
    await db.schema.createTable("contact_channels", (table) => {
      table.increments("id");
      table.string("name");
    });
    await db("contact_channels").insert({ name: "Ouvidoria" });
  });

  afterEach(() => db.destroy());

  it("up cria a coluna flow com padrão 'default' para registros existentes e novos", async () => {
    await migration.up(db);
    expect(await db.schema.hasColumn("contact_channels", "flow")).to.equal(true);
    const [row] = await db("contact_channels").select("flow");
    expect(row.flow).to.equal("default");
    await db("contact_channels").insert({ name: "Jurídico" });
    const rows = await db("contact_channels").select("name", "flow");
    expect(rows.every((r) => r.flow === "default")).to.equal(true);
  });

  it("down remove a coluna sem perder os registros", async () => {
    await migration.up(db);
    await migration.down(db);
    expect(await db.schema.hasColumn("contact_channels", "flow")).to.equal(false);
    expect(await db("contact_channels").count({ total: "*" })).to.deep.equal([{ total: 1 }]);
  });

  it("up é idempotente: não falha se o Strapi já criou a coluna na subida (autoMigration)", async () => {
    // O Strapi cria a coluna a partir do modelo: string, anulável, padrão 'default'.
    await db.schema.alterTable("contact_channels", (table) => {
      table.string("flow").nullable().defaultTo("default");
    });
    await db("contact_channels").insert({ name: "Jurídico", flow: "ouvidoria" });

    await migration.up(db);

    const rows = await db("contact_channels").select("name", "flow").orderBy("id");
    expect(rows.map((r) => r.flow)).to.deep.equal(["default", "ouvidoria"]);
  });

  it("up pode rodar duas vezes seguidas", async () => {
    await migration.up(db);
    await migration.up(db);
    expect(await db.schema.hasColumn("contact_channels", "flow")).to.equal(true);
  });

  it("down não falha se a coluna não existe", async () => {
    await migration.down(db);
    expect(await db.schema.hasColumn("contact_channels", "flow")).to.equal(false);
  });
});
