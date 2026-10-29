"use strict";

const { expect } = require("chai");
const { validateFields, workflowTitle } = require("../utils/ouvidoria/submission");

const valid = {
  name: "Maria Silva",
  email: "maria@exemplo.com.br",
  phone: "(41) 98888-5544",
  city: "Curitiba",
  state: "pr",
  company: "",
  message: "Relato da ocorrência",
};

describe("ouvidoria/submission", () => {
  it("aceita um envio válido e normaliza o estado", () => {
    const result = validateFields(valid, { allowAnonymous: false });
    expect(result.ok).to.equal(true);
    expect(result.values.state).to.equal("PR");
  });

  it("exige nome, e-mail, telefone, cidade e estado quando não é anônimo", () => {
    const result = validateFields({}, { allowAnonymous: false });
    expect(result.errors.map((e) => e.field)).to.have.members(["name", "email", "phone", "city", "state"]);
  });

  it("company e message são opcionais (paridade com o formulário atual)", () => {
    const result = validateFields({ ...valid, message: "", company: "" }, { allowAnonymous: false });
    expect(result.ok).to.equal(true);
  });

  it("no modo anônimo nada é obrigatório", () => {
    expect(validateFields({}, { allowAnonymous: true }).ok).to.equal(true);
  });

  it("no modo anônimo, valores informados continuam sendo validados", () => {
    const result = validateFields({ email: "invalido", state: "XX" }, { allowAnonymous: true });
    expect(result.errors).to.deep.include({ field: "email", code: "INVALID" });
    expect(result.errors).to.deep.include({ field: "state", code: "INVALID" });
  });

  it("recusa e-mail, telefone e UF inválidos", () => {
    const result = validateFields({ ...valid, email: "a@b", phone: "abc", state: "ZZ" }, { allowAnonymous: false });
    expect(result.errors.map((e) => e.field)).to.have.members(["email", "phone", "state"]);
  });

  it("aplica os limites do SE (255 e 4000)", () => {
    const longShort = validateFields({ ...valid, name: "x".repeat(256) }, { allowAnonymous: false });
    expect(longShort.errors).to.deep.include({ field: "name", code: "TOO_LONG" });
    const longMessage = validateFields({ ...valid, message: "x".repeat(4001) }, { allowAnonymous: false });
    expect(longMessage.errors).to.deep.include({ field: "message", code: "TOO_LONG" });
    expect(validateFields({ ...valid, message: "x".repeat(4000) }, { allowAnonymous: false }).ok).to.equal(true);
  });

  it("remove caracteres de controle e preserva quebras de linha na mensagem", () => {
    const result = validateFields({ ...valid, name: "Ma\u0000ria", message: "linha 1\nlinha 2\u0007" }, { allowAnonymous: false });
    expect(result.values.name).to.equal("Ma ria");
    expect(result.values.message).to.equal("linha 1\nlinha 2");
  });

  it("ignora campos desconhecidos", () => {
    const result = validateFields({ ...valid, admin: "true" }, { allowAnonymous: false });
    expect(result.values).to.not.have.property("admin");
  });

  it("usa o primeiro valor quando o campo vem repetido", () => {
    const result = validateFields({ ...valid, name: ["Primeiro", "Segundo"] }, { allowAnonymous: false });
    expect(result.values.name).to.equal("Primeiro");
  });

  describe("workflowTitle", () => {
    it("usa o e-mail quando existe", () => {
      expect(workflowTitle({ email: "a@b.com" })).to.equal("a@b.com");
    });
    it("gera título genérico se for anônimo", () => {
      expect(workflowTitle({ email: "" }, new Date("2026-10-19T12:00:00Z"))).to.equal(
        "Denúncia anônima 2026-10-19T12:00:00.000Z"
      );
    });
  });
});
