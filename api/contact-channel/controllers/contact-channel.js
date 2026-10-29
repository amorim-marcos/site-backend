"use strict";

const ContactChannelQueue = require("../../../scripts/bull/src/queues/ContactChannelQueue");
const OuvidoriaQueue = require("../../../scripts/bull/src/queues/OuvidoriaQueue");
const { createHandlers } = require("../../../utils/ouvidoria/handlers");

const ccqueue = ContactChannelQueue.queue;
const ccqueueName = ContactChannelQueue.queueName;

// Fluxo próprio da Ouvidoria (upload de arquivos).
const ouvidoria = createHandlers({
  findChannel: (id) => strapi.query("contact-channel").findOne({ id }),
  queue: OuvidoriaQueue.queue,
  queueName: OuvidoriaQueue.queueName,
});

module.exports = {
  ouvidoriaConfig: ouvidoria.ouvidoriaConfig,
  sendOuvidoria: ouvidoria.sendOuvidoria,
  sendForm: async (ctx) => {
    const contactChannelId = ctx.params.id;

    const contactChannel = await strapi
      .query("contact-channel")
      .findOne({ id: contactChannelId });

    const data = ctx.request.body;
    data.service_code = contactChannel.service_code;
    data.channel = contactChannel.name;

    try {
      ccqueue.add(ccqueueName, data, {
        timeout: 120000, // 2 minutos
        attempts: 3,
        backoff: {
          type: "exponential",
          delay: 2000,
        },
        removeOnComplete: true,
        removeOnFail: false,
      });
      ctx.response.status = 201;
      ctx.send({ message: "Job added to queue" });
    } catch (err) {
      console.log(err);
      ctx.response.status = 500;
      ctx.send({ error: err });
    }
  },
};
