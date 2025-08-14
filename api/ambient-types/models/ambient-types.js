"use strict";

/**
 * Read the documentation (https://strapi.io/documentation/developer-docs/latest/development/backend-customization.html#lifecycle-hooks)
 * to customize this model
 */

const { generateSlug } = require("../../../utils/slug-generator");

module.exports = {
  lifecycles: {
    async beforeCreate(data) {
      data.url_code = generateSlug(data.type);
    },
    async beforeUpdate(params, data) {
      if (data.type) {
        data.url_code = generateSlug(data.type);
      }
    },
  },
};
