"use strict";

/**
 * Read the documentation (https://strapi.io/documentation/developer-docs/latest/development/backend-customization.html#lifecycle-hooks)
 * to customize this model
 */

const useLifecycles = require("../../../scripts/meilisearch/PagesCustomIndex");

module.exports = {
  ...useLifecycles("mdf-berneck"),
};
