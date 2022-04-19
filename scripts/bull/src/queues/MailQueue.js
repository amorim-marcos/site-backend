const Queue = require("bull");
const config = require("../../utils/config");

const QUEUE_NAME = "mail";

const MailQueue = new Queue(QUEUE_NAME, {
  redis: config.connection,
  limiter: config.limiter,
});

module.exports = {
  queueName: QUEUE_NAME,
  queue: MailQueue,
};
