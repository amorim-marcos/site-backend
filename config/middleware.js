module.exports = {
  load: {
    // O guard roda antes do parser multipart; o cors vem antes dele para que as recusas também levem os cabeçalhos CORS.
    before: ["rateLimit", "cors", "ouvidoriaGuard"],
  },
  settings: {
    ouvidoriaGuard: {
      enabled: true,
    },
    cors: {
      enabled: true,
      // Padrões do Strapi + X-Ouvidoria-Token; sem ele o preflight bloqueia o envio.
      headers: ["Content-Type", "Authorization", "Origin", "Accept", "X-Ouvidoria-Token"],
    },
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
