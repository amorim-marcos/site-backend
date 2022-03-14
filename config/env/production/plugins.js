module.exports = () => ({
  meilisearch: {
    host: "http://localhost:7700",
    apiKey: process.env.MEILISEARCH_API_KEY,
  },
  lema: {
    sections: [
      {
        code: "ambients",
        label: "Ambients"
      },
      {
        code: "pages",
        label: "Pages"
      },
      {
        code: "products",
        label: "BPs"
      },
      {
        code: "canal-bnk",
        label: "Canal BNK"
      },
      {
        code: "legislation",
        label: "Legislation"
      }
    ]
  }
})
