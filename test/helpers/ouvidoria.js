"use strict";

const fs = require("fs");
const os = require("os");
const path = require("path");

const PDF = Buffer.from("%PDF-1.4\n1 0 obj\n<<>>\nendobj\n", "latin1");
const JPG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00]);
const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(16)]);
const WEBP = Buffer.concat([Buffer.from("RIFF", "latin1"), Buffer.alloc(4), Buffer.from("WEBPVP8 ", "latin1")]);
const MP4 = Buffer.concat([Buffer.from([0, 0, 0, 0x18]), Buffer.from("ftypisom", "latin1"), Buffer.alloc(16)]);
const MOV_FTYP = Buffer.concat([Buffer.from([0, 0, 0, 0x14]), Buffer.from("ftypqt  ", "latin1"), Buffer.alloc(16)]);
const MOV_ATOM = Buffer.concat([Buffer.from([0, 0, 0, 0x14]), Buffer.from("moov", "latin1"), Buffer.alloc(16)]);
const GIF = Buffer.concat([Buffer.from("GIF89a", "latin1"), Buffer.alloc(16)]);
const HEIC = Buffer.concat([Buffer.from([0, 0, 0, 0x18]), Buffer.from("ftypheic", "latin1"), Buffer.alloc(16)]);
const HEIF_MIF1 = Buffer.concat([Buffer.from([0, 0, 0, 0x18]), Buffer.from("ftypmif1", "latin1"), Buffer.alloc(16)]);
const WEBM = Buffer.concat([Buffer.from([0x1a, 0x45, 0xdf, 0xa3]), Buffer.alloc(16)]);
const EXE = Buffer.concat([Buffer.from("MZ", "latin1"), Buffer.alloc(32)]);

const PK = Buffer.from([0x50, 0x4b, 0x03, 0x04]);
const OLE2 = Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]);
const utf16 = (text) => Buffer.from(text, "utf16le");

/** ZIP mínimo com nomes de partes em claro (o validador só olha o contêiner e os nomes). */
function ooxml(parts, { macro = false } = {}) {
  const names = ["[Content_Types].xml", ...parts, ...(macro ? ["word/vbaProject.bin"] : [])];
  return Buffer.concat([PK, Buffer.alloc(26), Buffer.from(names.join("\0"), "latin1"), Buffer.alloc(32)]);
}

/** Contêiner OLE2 mínimo com nomes de fluxo em UTF-16LE. */
function ole2(streams, { macro = false } = {}) {
  const names = [...streams, ...(macro ? ["_VBA_PROJECT"] : [])];
  return Buffer.concat([OLE2, Buffer.alloc(504), ...names.map((name) => Buffer.concat([utf16(name), Buffer.alloc(8)]))]);
}

const DOCX = ooxml(["word/document.xml"]);
const XLSX = ooxml(["xl/workbook.xml"]);
const PPTX = ooxml(["ppt/presentation.xml"]);
const DOC = ole2(["WordDocument"]);
const XLS = ole2(["Workbook"]);
const PPT = ole2(["PowerPoint Document"]);

const createdDirs = [];

function tmpDir(prefix = "ouvidoria-test-") {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  createdDirs.push(dir);
  return dir;
}

// Hook global do mocha: remove os diretórios temporários criados pelos testes.
if (typeof after === "function") {
  after(() => {
    createdDirs.forEach((dir) => fs.rmSync(dir, { recursive: true, force: true }));
  });
}

function writeTemp(dir, name, content) {
  const filePath = path.join(dir, name);
  fs.writeFileSync(filePath, content);
  return filePath;
}

function silentLog() {
  return { log() {}, info() {}, warn() {}, error() {} };
}

function baseConfig(overrides = {}) {
  const config = {
    enabled: true,
    allowAnonymous: false,
    maxFileBytes: 50 * 1024 * 1024,
    maxBodyBytes: 51 * 1024 * 1024,
    temp: { dir: "/tmp/ouvidoria-temp-test", maxAgeMs: 3600000, sweepIntervalMs: 900000, maxConcurrentUploads: 3 },
    s3: { bucket: "bucket-test", region: "sa-east-1", accessKeyId: "", secretAccessKey: "", prefix: "", endpoint: "" },
    attachment: { baseUrl: "https://anexos.test/arquivo" },
    scan: { wait: true, timeoutMs: 600000, pollIntervalMs: 10000 },
    rate: { ipMax: 3, ipWindowMs: 600000, globalMaxPerHour: 60 },
    formToken: { secret: "test-secret", minAgeSeconds: 3, maxAgeMs: 3600000 },
    job: { attempts: 8, backoffMs: 30000, timeoutMs: 600000, concurrency: 1 },
    se: {
      wsdlUrl: "http://se.test/wsdl",
      wsdlLocation: "http://se.test/ws",
      authToken: "token",
      processId: "CPL002",
      userId: "ouvidoria",
      entityId: "ouvidoria",
      activityId: "ATV.0591",
      actionSequence: "1",
      attachmentNoteAttribute: "",
    },
  };
  return { ...config, ...overrides };
}

function readAll(stream) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    stream.on("data", (chunk) => chunks.push(chunk));
    stream.on("end", () => resolve(Buffer.concat(chunks)));
    stream.on("error", reject);
  });
}

/**
 * Cliente S3 em memória com a superfície usada por `s3Storage`
 * (`putObject` e `getObjectTagging`, ambos com `.promise()`).
 *
 * @param {{failPuts?: number, autoScan?: string}} [options] `failPuts`: quantos `putObject`
 *   iniciais devem falhar; `autoScan`: status de varredura devolvido para todo objeto
 *   que ainda não tem tag (simula o GuardDuty respondendo na hora)
 */
function fakeS3(options = {}) {
  const objects = {};
  const tags = {};
  const calls = { put: [], tagging: [], delete: [] };
  let failPuts = options.failPuts || 0;

  const fake = {
    objects,
    calls,
    autoScan: options.autoScan,
    setScan(key, status) {
      tags[key] = [{ Key: "GuardDutyMalwareScanStatus", Value: status }];
    },
    putObject(params) {
      calls.put.push(params);
      return {
        promise: async () => {
          const body = await readAll(params.Body);
          if (failPuts > 0) {
            failPuts -= 1;
            throw Object.assign(new Error("S3 indisponível"), { code: "ServiceUnavailable" });
          }
          objects[params.Key] = { body, params };
          return {};
        },
      };
    },
    deleteObject(params) {
      calls.delete.push(params);
      return {
        promise: async () => {
          delete objects[params.Key];
          return {};
        },
      };
    },
    getObjectTagging(params) {
      calls.tagging.push(params);
      return {
        promise: async () => {
          if (!objects[params.Key]) {
            throw Object.assign(new Error("The specified key does not exist."), { code: "NoSuchKey" });
          }
          if (!tags[params.Key] && fake.autoScan) {
            return { TagSet: [{ Key: "GuardDutyMalwareScanStatus", Value: fake.autoScan }] };
          }
          return { TagSet: tags[params.Key] || [] };
        },
      };
    },
  };
  return fake;
}

module.exports = { ooxml, ole2, utf16, DOCX, XLSX, PPTX, DOC, XLS, PPT, fakeS3, readAll, GIF, HEIC, HEIF_MIF1, PDF, JPG, PNG, WEBP, MP4, MOV_FTYP, MOV_ATOM, WEBM, EXE, tmpDir, writeTemp, silentLog, baseConfig };
