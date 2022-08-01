module.exports = () => ({
  meilisearch: {
    host: "http://localhost:7700",
    apiKey: "test_api_key",
  },
  lema: {
    sections: [
      {
        code: "pages", // Páginas institucionais
        order: 0,
      },
      {
        code: "products", // Páginas de Produto
        order: 1
      },
      {
        code: "bps", // BPs
        order: 2
      },
      {
        code: "ambients", // Galeria de Ambientes
        order: 3,
      },
      {
        code: "bnkchannel", // Canal BNK
        order: 4
      },
      {
        code: "contact", // Fale Conosco
        order: 5
      },
      {
        code: "wherebuy", // Onde Comprar
        order: 6
      },
      {
        code: "legislation", // Legislação
        order: 7
      }
    ]
  }
})
