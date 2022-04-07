"use strict";

const ContactChannelQueue = require("../../../scripts/bull/src/queues/ContactChannelQueue");

const queue = ContactChannelQueue.queue;
const queueName = ContactChannelQueue.queueName;

module.exports = {
  create: async (ctx) => {
    const data = {};

    try {
      queue.add(queueName, data);
      ctx.response.status = 201;
      ctx.send({ message: "Job added to queue" });
    } catch (err) {
      console.log(err);
      ctx.response.status = 500;
      ctx.send({ error: err });
    }
  },
};
