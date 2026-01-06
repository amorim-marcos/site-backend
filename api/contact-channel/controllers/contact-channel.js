"use strict";

const ContactChannelQueue = require("../../../scripts/bull/src/queues/ContactChannelQueue");

const ccqueue = ContactChannelQueue.queue;
const ccqueueName = ContactChannelQueue.queueName;

module.exports = {
  sendForm: async (ctx) => {
    const contactChannelId = ctx.params.id;

    const contactChannel = await strapi
      .query("contact-channel")
      .findOne({ id: contactChannelId });

    const data = ctx.request.body;
    data.service_code = contactChannel.service_code;
    data.channel = contactChannel.name;

    try {
      ccqueue.add(ccqueueName, data, { timeout: 60000 });
      ctx.response.status = 201;
      ctx.send({ message: "Job added to queue" });
    } catch (err) {
      console.log(err);
      ctx.response.status = 500;
      ctx.send({ error: err });
    }
  },
};
