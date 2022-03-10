module.exports = () => ({
  meilisearch: {
    host: "http://localhost:7700",
    apiKey: "test_api_key",
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
