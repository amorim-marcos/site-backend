const Queue = require("bull");
const config = require("../../utils/config");

const QUEUE_NAME = "contact-channel";

const ContactChannelQueue = new Queue(QUEUE_NAME, {
  redis: config.connection,
  limiter: config.limiter,
});

module.exports = {
  queueName: QUEUE_NAME,
  queue: ContactChannelQueue,
};
