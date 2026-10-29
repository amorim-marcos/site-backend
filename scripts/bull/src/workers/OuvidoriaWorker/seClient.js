"use strict";

const soap = require("soap");

/**
 * Cliente do web service de workflow do SE Suite (wf_ws.php).
 *
 * - `endpoint` é a opção documentada do node-soap para sobrescrever o endereço
 *   do WSDL (equivale ao `location` do SoapClient do PHP). A opção `location`
 *   usada em SendFormJob.js é ignorada pelo node-soap 0.43.
 * - Sem `trace`: dados da denúncia não podem ir para o log.
 * - O anexo não passa por aqui: vai ao S3 e o SE recebe só a URL do download
 *   seguro, num atributo da entidade (editEntityRecord).
 */

const CALL_TIMEOUT_MS = 60 * 1000;

async function createSeClient(se) {
  const options = {};
  if (se.wsdlLocation) options.endpoint = se.wsdlLocation;

  const client = await soap.createClientAsync(se.wsdlUrl, options);
  client.addHttpHeader("Authorization", se.authToken);

  // node-soap devolve [resultado, xmlBruto, cabeçalhos, xmlRequisição]; só o resultado interessa.
  const call = async (method, args, requestOptions) => (await client[`${method}Async`](args, requestOptions))[0];

  const callOptions = { timeout: CALL_TIMEOUT_MS };

  return {
    newWorkflow: (args) => call("newWorkflow", args, callOptions),
    editEntityRecord: (args) => call("editEntityRecord", args, callOptions),
    executeActivity: (args) => call("executeActivity", args, callOptions),
  };
}

module.exports = { createSeClient };
