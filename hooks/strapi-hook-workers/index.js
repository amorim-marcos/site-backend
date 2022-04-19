module.exports = (strapi) => {
  return {
    initialize: async () => {
      require("../../scripts/bull/src/workers/index");
    },
  };
};
