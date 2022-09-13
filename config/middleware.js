module.exports = {
  load: {
    before: ['rateLimit'],
  },
  settings: {
    rateLimit: {
      enabled: true,
    },
  },
};
