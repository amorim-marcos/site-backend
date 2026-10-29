"use strict";

const fs = require("fs");
const http = require("http");
const path = require("path");
const soap = require("soap");
const { expect } = require("chai");
const { createSeClient } = require("../scripts/bull/src/workers/OuvidoriaWorker/seClient");

/**
 * Servidor SOAP local que imita o SE. Garante que:
 *  - o cliente respeita `endpoint` (o WSDL aponta para um endereço inválido);
 *  - o cabeçalho Authorization é enviado;
 *  - valores com caracteres especiais de XML (a URL do anexo, por exemplo) chegam
 *    íntegros, sem injeção;
 *  - o cliente não expõe mais o envio de anexo: o arquivo vai ao S3 e o SE recebe só a URL.
 */
describe("ouvidoria/seClient (servidor SOAP simulado)", function () {
  this.timeout(30000);

  let server;
  let port;
  let received;

  before((done) => {
    const wsdl = fs.readFileSync(path.join(__dirname, "helpers", "se-mock-full.wsdl"), "utf8");
    const ok = { Status: "SUCCESS", Code: "1", Detail: "ok", RecordID: "WF-1" };
    const service = {
      WfService: {
        WfPort: {
          newWorkflow(args, cb, headers, req) {
            received = { auth: req.headers.authorization, args };
            return ok;
          },
          editEntityRecord(args, cb, headers, req) {
            received = { auth: req.headers.authorization, args };
            return ok;
          },
          executeActivity(args, cb, headers, req) {
            received = { auth: req.headers.authorization, args };
            return ok;
          },
          newAttachment() {
            return ok;
          },
        },
      },
    };
    server = http.createServer((req, res) => {
      res.statusCode = 404;
      res.end();
    });
    server.listen(0, "127.0.0.1", () => {
      port = server.address().port;
      soap.listen(server, "/wf", service, wsdl);
      done();
    });
  });

  after((done) => server.close(done));

  const makeClient = () =>
    createSeClient({
      wsdlUrl: `http://127.0.0.1:${port}/wf?wsdl`,
      wsdlLocation: `http://127.0.0.1:${port}/wf`,
      authToken: "token-teste",
    });

  it("chama o SE no endpoint informado, com o cabeçalho Authorization", async () => {
    const client = await makeClient();
    const result = await client.newWorkflow({ ProcessID: "CPL002", WorkflowTitle: "t", UserID: "ouvidoria" });
    expect(result.Status).to.equal("SUCCESS");
    expect(result.RecordID).to.equal("WF-1");
    expect(received.auth).to.equal("token-teste");
    expect(received.args.ProcessID).to.equal("CPL002");
  });

  it("preserva caracteres especiais de XML nos atributos (sem injeção)", async () => {
    const client = await makeClient();
    const url = `https://anexos.test/arquivo/a.pdf?x=1&y=<b>"'</EntityAttributeValue><x/>`;
    const result = await client.editEntityRecord({
      WorkflowID: "W",
      EntityID: "ouvidoria",
      EntityAttributeList: { EntityAttribute: [{ EntityAttributeID: "anexo1", EntityAttributeValue: url }] },
    });
    expect(result.Status).to.equal("SUCCESS");
    const attr = [].concat(received.args.EntityAttributeList.EntityAttribute)[0];
    expect(attr.EntityAttributeID).to.equal("anexo1");
    expect(attr.EntityAttributeValue).to.equal(url);
  });

  it("executa a atividade", async () => {
    const client = await makeClient();
    const result = await client.executeActivity({ WorkflowID: "W", ActivityID: "A", ActionSequence: "1", UserID: "u" });
    expect(result.Status).to.equal("SUCCESS");
  });

  it("não expõe envio de anexo ao SE", async () => {
    const client = await makeClient();
    expect(client).to.not.have.property("newAttachment");
  });
});
