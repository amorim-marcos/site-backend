module.exports = {
  maxAttempts: 10,
  maxAttemptsForEmail: 5,

  backoffDelay: 2000,

  concurrency: parseInt(process.env.QUEUE_CONCURRENCY || "1"),
  connection: {
    host: process.env.REDIS_HOST,
    port: parseInt(process.env.REDIS_PORT || "6379"),
    password: process.env.REDIS_PASSWORD,
  },

  hostname: process.env.REDIS_HOST || "http://localhost",
};
