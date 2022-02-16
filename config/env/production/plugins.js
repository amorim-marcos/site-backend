module.exports = () => ({
  meilisearch: {
    host: "http://localhost:7700",
    apiKey: process.env.MEILISEARCH_API_KEY,
  }
})
