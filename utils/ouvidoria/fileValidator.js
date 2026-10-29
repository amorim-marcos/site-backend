"use strict";

const fs = require("fs");
const { OuvidoriaError } = require("./errors");

/**
 * Validação do arquivo enviado à Ouvidoria.
 *
 * Regras: a extensão precisa estar na allowlist E o conteúdo
 * (magic bytes) precisa corresponder ao tipo esperado para essa extensão.
 * O `Content-Type` informado pelo cliente nunca é usado.
 *
 * Documentos de escritório e texto têm regras próprias:
 * - docx/xlsx/pptx são ZIP com partes conhecidas; doc/xls/ppt são contêineres OLE2.
 *   Arquivo com macro (VBA) é recusado, e docx/xlsx/pptx protegido por senha (que o
 *   Office grava como OLE2 criptografado) também, pois o antivírus não consegue lê-lo.
 * - txt/csv não têm assinatura: o arquivo inteiro não pode ter byte nulo nem
 *   caractere de controle (aceita UTF-8, ANSI e UTF-16 com BOM).
 * A varredura de malware em si é do GuardDuty, depois do envio ao S3.
 */

// extensão -> família de conteúdo esperada
const EXTENSIONS = {
  jpg: "jpeg",
  jpeg: "jpeg",
  png: "png",
  webp: "webp",
  gif: "gif",
  // Fotos de iPhone (e de alguns Android): mesmo contêiner dos vídeos, marca própria.
  heic: "heif",
  heif: "heif",
  pdf: "pdf",
  docx: "docx",
  xlsx: "xlsx",
  pptx: "pptx",
  doc: "doc",
  xls: "xls",
  ppt: "ppt",
  txt: "text",
  csv: "text",
  mp4: "isobmff",
  mov: "isobmff",
  webm: "webm",
};

const MIME_BY_KIND = {
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
  heif: "image/heic",
  pdf: "application/pdf",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  doc: "application/msword",
  xls: "application/vnd.ms-excel",
  ppt: "application/vnd.ms-powerpoint",
  text: "text/plain",
  isobmff: "video/mp4",
  webm: "video/webm",
};

// Quando o tipo da extensão difere do padrão da família de conteúdo.
const MIME_BY_EXTENSION = {
  heif: "image/heif",
  csv: "text/csv",
};

const ZIP_MAGIC = Buffer.from([0x50, 0x4b, 0x03, 0x04]);
const OLE2_MAGIC = Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]);

const utf16 = (text) => Buffer.from(text, "utf16le");

// Documentos de escritório: contêiner esperado, marcas que a estrutura do formato exige
// e marcas de macro. Os nomes das partes do ZIP e dos fluxos do OLE2 ficam em claro
// (ASCII e UTF-16LE, respectivamente), então uma busca simples no arquivo basta.
const OFFICE = {
  docx: { container: "zip", required: [["[Content_Types].xml"], ["word/"]], macro: ["vbaProject.bin"] },
  xlsx: { container: "zip", required: [["[Content_Types].xml"], ["xl/"]], macro: ["vbaProject.bin"] },
  pptx: { container: "zip", required: [["[Content_Types].xml"], ["ppt/"]], macro: ["vbaProject.bin"] },
  doc: { container: "ole2", required: [[utf16("WordDocument")]], macro: [utf16("_VBA_PROJECT")] },
  xls: { container: "ole2", required: [[utf16("Workbook"), utf16("Book")]], macro: [utf16("_VBA_PROJECT")] },
  ppt: { container: "ole2", required: [[utf16("PowerPoint Document")]], macro: [utf16("_VBA_PROJECT")] },
};
const ENCRYPTED_PACKAGE = utf16("EncryptedPackage");
const SCAN_CHUNK = 1024 * 1024;

// Marcas principais (bytes 8 a 12 do `ftyp`) de imagens HEIF/HEIC.
const HEIF_BRANDS = ["heic", "heix", "heim", "heis", "hevc", "hevx", "mif1", "msf1"];

const HEAD_BYTES = 1024;

// Átomos QuickTime antigos (.mov sem `ftyp`).
const QUICKTIME_ATOMS = ["moov", "mdat", "free", "wide", "skip", "pnot"];

function ascii(buffer, start, end) {
  return buffer.slice(start, end).toString("latin1");
}

function detectKind(head) {
  if (head.length >= 3 && head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff) {
    return "jpeg";
  }
  if (
    head.length >= 8 &&
    head[0] === 0x89 &&
    ascii(head, 1, 4) === "PNG" &&
    head[4] === 0x0d &&
    head[5] === 0x0a &&
    head[6] === 0x1a &&
    head[7] === 0x0a
  ) {
    return "png";
  }
  if (head.length >= 12 && ascii(head, 0, 4) === "RIFF" && ascii(head, 8, 12) === "WEBP") {
    return "webp";
  }
  if (head.length >= 6 && ["GIF87a", "GIF89a"].includes(ascii(head, 0, 6))) {
    return "gif";
  }
  // A especificação do PDF tolera lixo antes do cabeçalho nos primeiros 1024 bytes.
  if (head.indexOf("%PDF-", 0, "latin1") !== -1) {
    return "pdf";
  }
  if (head.length >= 8) {
    const box = ascii(head, 4, 8);
    if (box === "ftyp") {
      return head.length >= 12 && HEIF_BRANDS.includes(ascii(head, 8, 12)) ? "heif" : "isobmff";
    }
    if (QUICKTIME_ATOMS.includes(box)) return "isobmff";
  }
  if (head.length >= 4 && head[0] === 0x1a && head[1] === 0x45 && head[2] === 0xdf && head[3] === 0xa3) {
    return "webm";
  }
  return null;
}

/**
 * Normaliza o nome informado pelo cliente. Rejeita nomes que tentam sair do
 * diretório; o nome nunca é usado como caminho (o arquivo é salvo com nome
 * gerado), apenas como metadado enviado ao SE.
 */
function sanitizeFileName(rawName) {
  if (typeof rawName !== "string" || rawName.length === 0) {
    throw new OuvidoriaError(400, "FILE_NAME_INVALID", "Nome de arquivo inválido");
  }
  if (/[\u0000/\\]/.test(rawName)) {
    throw new OuvidoriaError(400, "FILE_NAME_INVALID", "Nome de arquivo inválido");
  }
  // Remove caracteres de controle e limita o tamanho.
  const cleaned = rawName.replace(/[\u0001-\u001f\u007f]/g, "").trim();
  if (cleaned === "" || cleaned === "." || cleaned === "..") {
    throw new OuvidoriaError(400, "FILE_NAME_INVALID", "Nome de arquivo inválido");
  }
  return cleaned.length > 120 ? cleaned.slice(-120) : cleaned;
}

function extensionOf(name) {
  const index = name.lastIndexOf(".");
  if (index <= 0 || index === name.length - 1) return "";
  return name.slice(index + 1).toLowerCase();
}

async function readHead(filePath) {
  const handle = await fs.promises.open(filePath, "r");
  try {
    const buffer = Buffer.alloc(HEAD_BYTES);
    const { bytesRead } = await handle.read(buffer, 0, HEAD_BYTES, 0);
    return buffer.slice(0, bytesRead);
  } finally {
    await handle.close();
  }
}

/**
 * Procura marcas no arquivo inteiro, em blocos, sem carregá-lo na memória.
 *
 * @param {string} filePath
 * @param {Array<string|Buffer>} needles
 * @returns {Promise<Set<number>>} índices das marcas encontradas
 */
async function scanFor(filePath, needles) {
  const patterns = needles.map((needle) => (Buffer.isBuffer(needle) ? needle : Buffer.from(needle, "latin1")));
  const overlap = Math.max(...patterns.map((pattern) => pattern.length)) - 1;
  const found = new Set();

  const handle = await fs.promises.open(filePath, "r");
  try {
    const chunk = Buffer.alloc(SCAN_CHUNK);
    let tail = Buffer.alloc(0);
    for (;;) {
      const { bytesRead } = await handle.read(chunk, 0, SCAN_CHUNK, null);
      if (bytesRead === 0) break;
      // A marca pode atravessar a divisa entre dois blocos: reaproveita o fim do anterior.
      const window = Buffer.concat([tail, chunk.slice(0, bytesRead)]);
      patterns.forEach((pattern, index) => {
        if (!found.has(index) && window.indexOf(pattern) !== -1) found.add(index);
      });
      tail = window.slice(Math.max(0, window.length - overlap));
    }
  } finally {
    await handle.close();
  }
  return found;
}

function contentMismatch() {
  return new OuvidoriaError(415, "FILE_CONTENT_MISMATCH", "O conteúdo do arquivo não corresponde ao tipo informado");
}

function startsWith(head, magic) {
  return head.length >= magic.length && head.slice(0, magic.length).equals(magic);
}

/** docx/xlsx/pptx/doc/xls/ppt: contêiner, estrutura do formato e ausência de macro. */
async function assertOffice(filePath, ext, head) {
  const spec = OFFICE[ext];

  if (!startsWith(head, spec.container === "zip" ? ZIP_MAGIC : OLE2_MAGIC)) {
    // O Office grava docx/xlsx/pptx protegido por senha como OLE2 com `EncryptedPackage`.
    if (spec.container === "zip" && startsWith(head, OLE2_MAGIC)) {
      const found = await scanFor(filePath, [ENCRYPTED_PACKAGE]);
      if (found.size > 0) throw new OuvidoriaError(415, "FILE_ENCRYPTED", "Arquivos protegidos por senha não são aceitos");
    }
    throw contentMismatch();
  }

  // Uma única passagem pelo arquivo, procurando as marcas de estrutura e as de macro.
  const needles = [];
  const requiredGroups = spec.required.map((group) => group.map((needle) => needles.push(needle) - 1));
  const macroIndexes = spec.macro.map((needle) => needles.push(needle) - 1);
  const found = await scanFor(filePath, needles);

  if (macroIndexes.some((index) => found.has(index))) {
    throw new OuvidoriaError(415, "FILE_MACRO", "Arquivos com macro não são aceitos");
  }
  // Cada grupo exige pelo menos uma das marcas (ex.: "Workbook" ou "Book" no xls).
  if (!requiredGroups.every((group) => group.some((index) => found.has(index)))) throw contentMismatch();
}

/** txt/csv: sem assinatura; sem byte nulo nem caractere de controle (UTF-16 só com BOM). */
async function assertText(filePath, head) {
  const utf16Bom = head.length >= 2 && ((head[0] === 0xff && head[1] === 0xfe) || (head[0] === 0xfe && head[1] === 0xff));
  if (utf16Bom) return;

  for (let i = 0; i < head.length; i += 1) {
    const byte = head[i];
    // Permitidos: tab, LF, FF, CR.
    if (byte < 0x20 && ![0x09, 0x0a, 0x0c, 0x0d].includes(byte)) throw contentMismatch();
  }
  const found = await scanFor(filePath, [Buffer.from([0x00])]);
  if (found.size > 0) throw contentMismatch();
}

/**
 * @param {{path: string, name: string}} file arquivo recebido pelo parser
 * @param {{maxFileBytes: number}} config
 * @returns {Promise<{ext: string, kind: string, mime: string, safeName: string, size: number}>}
 */
async function validateFile(file, config) {
  if (!file || !file.path) {
    throw new OuvidoriaError(400, "FILE_INVALID", "Arquivo inválido");
  }

  const safeName = sanitizeFileName(file.name);
  const ext = extensionOf(safeName);

  if (!Object.prototype.hasOwnProperty.call(EXTENSIONS, ext)) {
    throw new OuvidoriaError(415, "FILE_TYPE_NOT_ALLOWED", "Tipo de arquivo não permitido");
  }

  // Tamanho real em disco, não o declarado pelo cliente.
  const { size } = await fs.promises.stat(file.path);
  if (size === 0) {
    throw new OuvidoriaError(400, "FILE_EMPTY", "Arquivo vazio");
  }
  if (size > config.maxFileBytes) {
    throw new OuvidoriaError(413, "FILE_TOO_LARGE", "Arquivo acima do tamanho máximo");
  }

  const head = await readHead(file.path);
  const expected = EXTENSIONS[ext];

  let kind = expected;
  if (expected === "text") {
    await assertText(file.path, head);
  } else if (Object.prototype.hasOwnProperty.call(OFFICE, expected)) {
    await assertOffice(file.path, expected, head);
  } else {
    kind = detectKind(head);
    if (kind === null || kind !== expected) throw contentMismatch();
  }

  return { ext, kind, mime: MIME_BY_EXTENSION[ext] || MIME_BY_KIND[kind], safeName, size };
}

function allowedExtensions() {
  return Object.keys(EXTENSIONS);
}

module.exports = {
  validateFile,
  sanitizeFileName,
  detectKind,
  allowedExtensions,
  EXTENSIONS,
};
