"use strict";

module.exports = (strapi) => {
  return {
    initialize: function () {
      strapi.app.use(async (ctx, next) => {
        const ratelimit = require("koa2-ratelimit").RateLimit;

        const message = [
          {
            messages: [
              {
                id: "Auth.form.error.ratelimit",
                message: "Too many attempts, please try again in a minute.",
              },
            ],
          },
        ];

        return ratelimit.middleware(
          Object.assign(
            {},
            {
              interval: { min: 1 },
              max: 100,
              prefixKey: "contact-channels",
              message,
            },
            strapi.config.get("plugin.users-permissions.ratelimit")
          )
        )(ctx, next);
      });
    },
  };
};
