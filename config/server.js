module.exports = ({ env }) => ({
  host: env('HOST', '0.0.0.0'),
  port: env.int('PORT', 1337),
  url: env('URL', 'http://localhost:1337'),
  // Ligar (PROXY_ENABLED=true) só depois de confirmar que a borda (ALB/proxy)
  // sobrescreve X-Forwarded-For; do contrário o IP do cliente é forjável.
  proxy: env.bool('PROXY_ENABLED', false),
  admin: {
    auth: {
      secret: env('ADMIN_JWT_SECRET', 'a4817b9800018572a778dbab1c238fc5'),
    },
    url: env('ADMIN_URL', '/painel-bnk')
  },
});
