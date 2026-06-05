module.exports = {
  load: {
    before: ["rateLimit"],
  },
  settings: {
    rateLimit: {
      enabled: true,
      interval: { min: 1 },
      max: 1000,
      prefixKey: 'rl',
    },
    parser: {
      enabled: true,
      multipart: true,
      formidable: {
        maxFileSize: 250 * 1024 * 1024, // allow to upload files up to 250mb
      },
    },
  },
};
