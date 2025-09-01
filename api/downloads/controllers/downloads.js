'use strict';

/**
 * Read the documentation (https://strapi.io/documentation/developer-docs/latest/development/backend-customization.html#core-controllers)
 * to customize this controller
 */


const { orderByCustomOrderAndCreatedAt } = require("../../../utils/sort");

module.exports = {
  async find(ctx) {
    const { _sort } = ctx.query;

    if (_sort === "custom_order_and_created_at") {
      const results = await strapi
        .query("downloads")
        .model.query(orderByCustomOrderAndCreatedAt)
        .fetchAll();
      return results.toJSON();
    }

    // default sorting
    const sort = _sort ? _sort : "created_at:DESC";
    const results = await strapi.services.downloads.find({
      _sort: sort,
    });
    return results;
  },
};