module.exports = {
  load: {
    before: ["rateLimit"],
  },
  settings: {
    rateLimit: {
      enabled: true,
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
