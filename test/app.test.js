require("dotenv").config();

const fs = require("fs");
var should = require("chai").should();
const { setupStrapi } = require("./helpers/strapi");
const {
  restoreConfig,
  dumpConfig,
} = require("../scripts/complete_config_management/src/functions");
const { expect } = require("chai");

process.env.NODE_ENV = "test";

describe("app", () => {
  before(async () => {
    await setupStrapi();
  });

  after(async () => {
    fs.rmdirSync(".tmp", { recursive: true });
  });

  it("strapi is defined", () => {
    should.exist(strapi);
  });

  it("should restore the config", async () => {
    let migrationsPath = process.cwd() + "/migrations/configs";
    let configExportPath = migrationsPath;
    await restoreConfig(
      strapi,
      "permission",
      "users-permissions",
      configExportPath + "/users-permissions_permission.json"
    );
  });

  it("should dump the users permissions", async () => {
    let migrationsPath = process.cwd() + "/.tmp/configs";
    let configExportPath = migrationsPath;

    if (!fs.existsSync(configExportPath)) {
      fs.mkdirSync(configExportPath);
    }
    await dumpConfig(
      "permission",
      "users-permissions",
      configExportPath + "/users-permissions_permission.json"
    );

    expect(fs.existsSync(".tmp/configs/users-permissions_permission.json")).to
      .be.true;
  });

  it("should dump the users permissions roles", async () => {
    let migrationsPath = process.cwd() + "/.tmp/configs";
    let configExportPath = migrationsPath;

    if (!fs.existsSync(configExportPath)) {
      fs.mkdirSync(configExportPath);
    }
    await dumpConfig(
      "role",
      "users-permissions",
      configExportPath + "/users-permisions_role.json"
    );

    expect(fs.existsSync(".tmp/configs/users-permisions_role.json")).to.be.true;
  });

  it("should dump the strapi permissions", async () => {
    let migrationsPath = process.cwd() + "/.tmp/configs";
    let configExportPath = migrationsPath;

    if (!fs.existsSync(configExportPath)) {
      fs.mkdirSync(configExportPath);
    }

    await dumpConfig(
      "strapi::permission",
      null,
      configExportPath + "/strapi_permission.json"
    );

    expect(fs.existsSync(".tmp/configs/strapi_permission.json")).to.be.true;
  });
  it("should dump the strapi roles", async () => {
    let migrationsPath = process.cwd() + "/.tmp/configs";
    let configExportPath = migrationsPath;

    if (!fs.existsSync(configExportPath)) {
      fs.mkdirSync(configExportPath);
    }

    await dumpConfig(
      "strapi::role",
      null,
      configExportPath + "/strapi_role.json"
    );

    expect(fs.existsSync(".tmp/configs/strapi_role.json")).to.be.true;
  });
  it("should dump the strapi i18n locales", async () => {
    let migrationsPath = process.cwd() + "/.tmp/configs";
    let configExportPath = migrationsPath;

    if (!fs.existsSync(configExportPath)) {
      fs.mkdirSync(configExportPath);
    }

    await dumpConfig(
      "plugins::i18n.locale",
      null,
      configExportPath + "/i18nlocale.json"
    );

    expect(fs.existsSync(".tmp/configs/i18nlocale.json")).to.be.true;
  });
});
