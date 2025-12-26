require('dotenv').config();

const config = {
  server: {
    port: process.env.PORT || 3000, // Porta do servidor
    host: process.env.HOST || '0.0.0.0', // Escuta geral (container / cloud safe)
    env: process.env.NODE_ENV || 'development', // Ambiente atual
    apiKey: process.env.API_KEY, // Chave mestre (se existir)
    sessionSecret: process.env.SESSION_SECRET, // Segredo da sessão (requerido em produção)
  },

  cache: {
    ttl: parseInt(process.env.CACHE_TTL_SECONDS, 10) || 60, // Tempo de vida do cache (segundos)
    redisUrl: process.env.REDIS_URL, // URL do Redis (opcional)
  },

  database: {
    // Caminhos dos bancos (separados por vírgula)
    paths: process.env.DB_PATHS
      ? process.env.DB_PATHS.split(',')
      : [],
  },

  security: {
    rateLimit: {
      max: 100, // Máx de requisições por janela
      timeWindow: '1 minute', // Janela de tempo
    },
  },
};



module.exports = config;
