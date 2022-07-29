module.exports = () => ({
  meilisearch: {
    host: "http://localhost:7700",
    apiKey: "test_api_key",
  },
  lema: {
    sections: [
      {
        code: "ambients", // Galeria de Ambientes
      },
      {
        code: "pages", // Páginas institucionais
      },
      {
        code: "bps", // BPs
      },
      {
        code: "products", // Páginas de Produto
      },
      {
        code: "bnk_channel", // Canal BNK
      },
      {
        code: "contact", // Fale Conosco
      },
      {
        code: "legislation", // Legislação
      },
      {
        code: "where_to_buy", // Onde Comprar
      }
    ]
  }
})
