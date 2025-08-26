"use strict";

const { expect } = require("chai");
const { generateSlug } = require("../utils/slug-generator");

describe("generateSlug", () => {
  it("should handle empty input", () => {
    expect(generateSlug("")).to.equal("");
    expect(generateSlug(null)).to.equal("");
  });

  it("should convert basic text", () => {
    expect(generateSlug("Hello World")).to.equal("hello-world");
    expect(generateSlug("Sala de Estar")).to.equal("sala-de-estar");
  });

  it("should remove accents", () => {
    expect(generateSlug("Olá Café")).to.equal("ola-cafe");
    expect(generateSlug("São João")).to.equal("sao-joao");
  });

  it("should preserve Chinese characters", () => {
    expect(generateSlug("你好世界")).to.equal("你好世界");
    expect(generateSlug("测试 公寓")).to.equal("测试-公寓");
  });

  it("should remove special characters", () => {
    expect(generateSlug("Hello@World!")).to.equal("helloworld");
    expect(generateSlug("Product (New)")).to.equal("product-new");
  });

  it("should handle multiple spaces and hyphens", () => {
    expect(generateSlug("Hello    World")).to.equal("hello-world");
    expect(generateSlug("--Test--")).to.equal("test");
  });
});
