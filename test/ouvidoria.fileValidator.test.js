"use strict";

const { expect } = require("chai");
const h = require("./helpers/ouvidoria");
const { validateFile, sanitizeFileName } = require("../utils/ouvidoria/fileValidator");

const config = { maxFileBytes: 1024 };

describe("ouvidoria/fileValidator", () => {
  let dir;
  before(() => {
    dir = h.tmpDir();
  });

  const check = async (name, content, cfg = config) =>
    validateFile({ path: h.writeTemp(dir, `f-${Math.random()}`, content), name }, cfg);

  const expectError = async (promise, status, code) => {
    try {
      await promise;
    } catch (error) {
      expect(error.status).to.equal(status);
      expect(error.code).to.equal(code);
      return;
    }
    throw new Error(`esperava erro ${code}`);
  };

  [
    ["a.pdf", h.PDF, "application/pdf"],
    ["a.jpg", h.JPG, "image/jpeg"],
    ["a.jpeg", h.JPG, "image/jpeg"],
    ["a.png", h.PNG, "image/png"],
    ["a.webp", h.WEBP, "image/webp"],
    ["a.mp4", h.MP4, "video/mp4"],
    ["a.mov", h.MOV_FTYP, "video/mp4"],
    ["a.mov", h.MOV_ATOM, "video/mp4"],
    ["a.webm", h.WEBM, "video/webm"],
    ["a.gif", h.GIF, "image/gif"],
    ["IMG_0001.HEIC", h.HEIC, "image/heic"],
    ["a.heic", h.HEIF_MIF1, "image/heic"],
    ["a.heif", h.HEIC, "image/heif"],
    ["FOTO.PDF", h.PDF, "application/pdf"],
    ["a.docx", h.DOCX, "application/vnd.openxmlformats-officedocument.wordprocessingml.document"],
    ["a.xlsx", h.XLSX, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"],
    ["a.pptx", h.PPTX, "application/vnd.openxmlformats-officedocument.presentationml.presentation"],
    ["a.doc", h.DOC, "application/msword"],
    ["a.xls", h.XLS, "application/vnd.ms-excel"],
    ["a.ppt", h.PPT, "application/vnd.ms-powerpoint"],
    ["a.txt", Buffer.from("Relato da ocorrência\r\nlinha 2\tcom tab", "utf8"), "text/plain"],
    ["a.txt", Buffer.from("relat\xf3rio em ANSI", "latin1"), "text/plain"],
    ["a.csv", Buffer.from("nome;valor\nx;1\n", "utf8"), "text/csv"],
    ["a.txt", Buffer.concat([Buffer.from([0xff, 0xfe]), h.utf16("texto em UTF-16")]), "text/plain"],
  ].forEach(([name, content, mime]) => {
    it(`aceita ${name} com conteúdo válido (${mime})`, async () => {
      const info = await check(name, content);
      expect(info.mime).to.equal(mime);
      expect(info.safeName).to.equal(name);
    });
  });

  it("aceita PDF com lixo antes do cabeçalho (primeiros 1024 bytes)", async () => {
    await check("a.pdf", Buffer.concat([Buffer.alloc(100, 0x20), h.PDF]));
  });

  it("recusa PNG renomeado para .pdf (conteúdo não confere)", async () => {
    await expectError(check("a.pdf", h.PNG), 415, "FILE_CONTENT_MISMATCH");
  });

  it("recusa executável renomeado para .pdf", async () => {
    await expectError(check("a.pdf", h.EXE), 415, "FILE_CONTENT_MISMATCH");
  });

  it("recusa JPG com extensão .png", async () => {
    await expectError(check("a.png", h.JPG), 415, "FILE_CONTENT_MISMATCH");
  });

  it("HEIC e MP4 não se confundem: cada um exige a sua marca no contêiner", async () => {
    await expectError(check("a.heic", h.MP4), 415, "FILE_CONTENT_MISMATCH");
    await expectError(check("a.mp4", h.HEIC), 415, "FILE_CONTENT_MISMATCH");
    await expectError(check("a.mov", h.HEIC), 415, "FILE_CONTENT_MISMATCH");
  });

  it("recusa GIF com outra extensão de imagem e vice-versa", async () => {
    await expectError(check("a.png", h.GIF), 415, "FILE_CONTENT_MISMATCH");
    await expectError(check("a.gif", h.PNG), 415, "FILE_CONTENT_MISMATCH");
  });

  describe("documentos de escritório e texto", () => {
    it("recusa docx, xlsx e pptx com macro (vbaProject.bin)", async () => {
      await expectError(check("a.docx", h.ooxml(["word/document.xml"], { macro: true })), 415, "FILE_MACRO");
      await expectError(check("a.xlsx", h.ooxml(["xl/workbook.xml"], { macro: true })), 415, "FILE_MACRO");
      await expectError(check("a.pptx", h.ooxml(["ppt/presentation.xml"], { macro: true })), 415, "FILE_MACRO");
    });

    it("recusa doc, xls e ppt com projeto VBA", async () => {
      await expectError(check("a.doc", h.ole2(["WordDocument"], { macro: true })), 415, "FILE_MACRO");
      await expectError(check("a.xls", h.ole2(["Workbook"], { macro: true })), 415, "FILE_MACRO");
      await expectError(check("a.ppt", h.ole2(["PowerPoint Document"], { macro: true })), 415, "FILE_MACRO");
    });

    it("recusa docx protegido por senha (OLE2 com EncryptedPackage)", async () => {
      await expectError(check("a.docx", h.ole2(["EncryptedPackage", "EncryptionInfo"])), 415, "FILE_ENCRYPTED");
      await expectError(check("a.xlsx", h.ole2(["EncryptedPackage"])), 415, "FILE_ENCRYPTED");
    });

    it("recusa ZIP comum renomeado para docx, xlsx ou pptx", async () => {
      const zip = h.ooxml(["leia-me.txt"]);
      await expectError(check("a.docx", zip), 415, "FILE_CONTENT_MISMATCH");
      await expectError(check("a.xlsx", zip), 415, "FILE_CONTENT_MISMATCH");
      await expectError(check("a.pptx", zip), 415, "FILE_CONTENT_MISMATCH");
    });

    it("não confunde formatos do Office entre si", async () => {
      await expectError(check("a.xlsx", h.DOCX), 415, "FILE_CONTENT_MISMATCH");
      await expectError(check("a.docx", h.XLSX), 415, "FILE_CONTENT_MISMATCH");
      await expectError(check("a.doc", h.XLS), 415, "FILE_CONTENT_MISMATCH");
      await expectError(check("a.ppt", h.DOC), 415, "FILE_CONTENT_MISMATCH");
      await expectError(check("a.docx", h.DOC), 415, "FILE_CONTENT_MISMATCH");
      await expectError(check("a.pdf", h.DOCX), 415, "FILE_CONTENT_MISMATCH");
    });

    it("aceita xls antigo cujo fluxo se chama Book", async () => {
      await check("a.xls", h.ole2(["Book"]));
    });

    it("acha as marcas mesmo quando atravessam a divisa entre dois blocos de leitura", async () => {
      const marker = Buffer.from("word/", "latin1");
      const filler = Buffer.alloc(1024 * 1024 - 2, 0x20);
      // "word/" começa 2 bytes antes do fim do primeiro bloco de 1 MiB.
      const body = Buffer.concat([Buffer.from([0x50, 0x4b, 0x03, 0x04]), Buffer.from("[Content_Types].xml", "latin1"), filler.slice(0, 1024 * 1024 - 4 - 19 - 2), marker]);
      await check("a.docx", body, { maxFileBytes: 4 * 1024 * 1024 });
    });

    it("recusa macro que fica depois do primeiro bloco de leitura", async () => {
      const body = Buffer.concat([h.DOCX, Buffer.alloc(3 * 1024 * 1024, 0x20), Buffer.from("word/vbaProject.bin", "latin1")]);
      await expectError(check("a.docx", body, { maxFileBytes: 8 * 1024 * 1024 }), 415, "FILE_MACRO");
    });

    it("recusa binário disfarçado de txt ou csv", async () => {
      await expectError(check("a.txt", h.EXE), 415, "FILE_CONTENT_MISMATCH");
      await expectError(check("a.csv", h.PNG), 415, "FILE_CONTENT_MISMATCH");
    });

    it("recusa txt com byte nulo depois do primeiro trecho", async () => {
      const body = Buffer.concat([Buffer.from("começa como texto ".repeat(100), "utf8"), Buffer.from([0x00]), Buffer.from("fim")]);
      await expectError(check("a.txt", body, { maxFileBytes: 8192 }), 415, "FILE_CONTENT_MISMATCH");
    });
  });

  it("recusa extensão fora da allowlist mesmo com conteúdo de PDF", async () => {
    await expectError(check("a.exe", h.PDF), 415, "FILE_TYPE_NOT_ALLOWED");
    await expectError(check("a.pdf.exe", h.PDF), 415, "FILE_TYPE_NOT_ALLOWED");
    await expectError(check("a.svg", h.PDF), 415, "FILE_TYPE_NOT_ALLOWED");
    await expectError(check("a.docm", h.DOCX), 415, "FILE_TYPE_NOT_ALLOWED");
    await expectError(check("a.xlsm", h.XLSX), 415, "FILE_TYPE_NOT_ALLOWED");
    await expectError(check("a.zip", h.DOCX), 415, "FILE_TYPE_NOT_ALLOWED");
    await expectError(check("a.rar", h.DOCX), 415, "FILE_TYPE_NOT_ALLOWED");
    await expectError(check("a.html", h.PDF), 415, "FILE_TYPE_NOT_ALLOWED");
  });

  it("recusa arquivo sem extensão ou terminado em ponto", async () => {
    await expectError(check("arquivo", h.PDF), 415, "FILE_TYPE_NOT_ALLOWED");
    await expectError(check("arquivo.", h.PDF), 415, "FILE_TYPE_NOT_ALLOWED");
  });

  it("recusa arquivo vazio", async () => {
    await expectError(check("a.pdf", Buffer.alloc(0)), 400, "FILE_EMPTY");
  });

  it("recusa arquivo acima do limite e aceita exatamente o limite", async () => {
    const body = Buffer.concat([h.PDF, Buffer.alloc(1024 - h.PDF.length)]);
    expect(body.length).to.equal(1024);
    await check("a.pdf", body);
    await expectError(check("a.pdf", Buffer.concat([body, Buffer.from("x")])), 413, "FILE_TOO_LARGE");
  });

  it("usa o tamanho real do arquivo, não o declarado", async () => {
    const filePath = h.writeTemp(dir, "real", Buffer.concat([h.PDF, Buffer.alloc(2000)]));
    await expectError(validateFile({ path: filePath, name: "a.pdf", size: 10 }, config), 413, "FILE_TOO_LARGE");
  });

  it("recusa nomes com separador de caminho ou byte nulo", async () => {
    await expectError(check("../a.pdf", h.PDF), 400, "FILE_NAME_INVALID");
    await expectError(check("dir/a.pdf", h.PDF), 400, "FILE_NAME_INVALID");
    await expectError(check("dir\\a.pdf", h.PDF), 400, "FILE_NAME_INVALID");
    await expectError(check("a\u0000.pdf", h.PDF), 400, "FILE_NAME_INVALID");
    await expectError(check("", h.PDF), 400, "FILE_NAME_INVALID");
  });

  it("recusa arquivo ausente", async () => {
    await expectError(validateFile(null, config), 400, "FILE_INVALID");
  });

  describe("sanitizeFileName", () => {
    it("remove caracteres de controle e limita o tamanho", () => {
      expect(sanitizeFileName("a\tb\n.pdf")).to.equal("ab.pdf");
      expect(sanitizeFileName(`${"x".repeat(300)}.pdf`)).to.have.length(120);
      expect(sanitizeFileName(`${"x".repeat(300)}.pdf`).endsWith(".pdf")).to.equal(true);
    });
  });
});
