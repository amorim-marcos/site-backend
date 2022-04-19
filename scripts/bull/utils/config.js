module.exports = {
  maxAttempts: 10,
  maxAttemptsForEmail: 5,

  backoffDelay: 2000,

  concurrency: parseInt(process.env.QUEUE_CONCURRENCY || "1"),
  limiter: {
    max: 5,
    duration: 1 * 60 * 1000, // 5jobs/min
    bounceBack: true, // When jobs get rate limited, they stay in the waiting queue and are not moved to the delayed queue
  },
  connection: {
    host: process.env.REDIS_HOST,
    port: parseInt(process.env.REDIS_PORT || "6379"),
    password: process.env.REDIS_PASSWORD,
  },

  hostname: process.env.REDIS_HOST || "http://localhost",
};
