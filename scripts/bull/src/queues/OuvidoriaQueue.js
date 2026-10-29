const Queue = require("bull");
const config = require("../../utils/config");

const QUEUE_NAME = "ouvidoria";

// Sem `limiter`: as tentativas de reenvio ao SE não devem ficar presas ao
// limite de 5 jobs/min da fila do Fale Conosco.
const OuvidoriaQueue = new Queue(QUEUE_NAME, {
  redis: config.connection,
});

module.exports = {
  queueName: QUEUE_NAME,
  queue: OuvidoriaQueue,
};
