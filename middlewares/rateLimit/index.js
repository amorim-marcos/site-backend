"use strict";

module.exports = (strapi) => {
  return {
    initialize: function () {
      strapi.app.use(async (ctx, next) => {
        if(ctx.request.method == "POST" && ctx.request.url.includes('contact-channels')){
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
  
          return ratelimit.middleware({
            interval: { min: 1 },
            max: 50,
            prefixKey: "contact-channels",
            message,
          })(ctx, next);
        }

        await next()
      });
    },
  };
};
