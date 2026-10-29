"use strict";

const { expect } = require("chai");
const knex = require("knex");
const migration = require("../migrations/schemas/20260310000000_add_custom_order_to_bp_page_banners");

describe("migration add_custom_order_to_bp_page_banners", () => {
  let db;

  beforeEach(async () => {
    db = knex({ client: "sqlite3", connection: { filename: ":memory:" }, useNullAsDefault: true });
    await db.schema.createTable("bp_page_banners", (table) => {
      table.increments("id");
      table.string("name");
    });
    await db("bp_page_banners").insert({ name: "Banner" });
  });

  afterEach(() => db.destroy());

  it("up cria a coluna", async () => {
    await migration.up(db);
    expect(await db.schema.hasColumn("bp_page_banners", "custom_order")).to.equal(true);
  });

  it("up não falha se o Strapi já criou a coluna, e preserva os valores", async () => {
    await db.schema.alterTable("bp_page_banners", (table) => table.integer("custom_order").nullable());
    await db("bp_page_banners").update({ custom_order: 3 });

    await migration.up(db);

    const [row] = await db("bp_page_banners").select("custom_order");
    expect(row.custom_order).to.equal(3);
  });

  it("up pode rodar duas vezes", async () => {
    await migration.up(db);
    await migration.up(db);
    expect(await db.schema.hasColumn("bp_page_banners", "custom_order")).to.equal(true);
  });

  it("down remove a coluna e não falha se ela não existe", async () => {
    await migration.up(db);
    await migration.down(db);
    expect(await db.schema.hasColumn("bp_page_banners", "custom_order")).to.equal(false);
    await migration.down(db);
  });
});
