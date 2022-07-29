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
        code: "bnkchannel", // Canal BNK
      },
      {
        code: "contact", // Fale Conosco
      },
      {
        code: "legislation", // Legislação
      },
      {
        code: "wherebuy", // Onde Comprar
      }
    ]
  }
})
