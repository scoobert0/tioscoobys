const fastify = require('fastify');

const rateLimitPlugin = require('./plugins/rate-limit');
const formBodyPlugin = require('./plugins/formbody');
const cookiePlugin = require('./plugins/cookie');
const sessionPlugin = require('./plugins/session');
const viewEnginePlugin = require('./plugins/view-engine');
const staticAssetsPlugin = require('./plugins/static-assets');

function buildServer({ logger, config, authService } = {}) {
  const server = fastify({
    logger,
    disableRequestLogging: true,
  });

  /* =========================
     CORE PLUGINS (ORDEM IMPORTA)
  ========================= */

  // Parse form POST
  server.register(formBodyPlugin);

  // Cookies (OBRIGATÓRIO antes da session)
  server.register(cookiePlugin);

  // Session (SEM ISSO LOGIN NUNCA FUNCIONA)
  server.register(sessionPlugin, {
    secret: config?.server?.sessionSecret || 'dev-secret-mude-isso',
  });

  // Rate limit depois da session
  server.register(rateLimitPlugin);

  // Views (EJS, etc)
  server.register(viewEnginePlugin);

  // Arquivos estáticos
  server.register(staticAssetsPlugin);

  /* =========================
     HOOKS GLOBAIS
  ========================= */

  // Log de sessão para debug
  server.addHook('preHandler', (req, _reply, done) => {
    req.log.debug({ session: req.session }, 'SESSION DEBUG');
    done();
  });

  // Hook para registrar o uso da API após a resposta ser enviada
  server.addHook('onResponse', (request, reply, done) => {
    // Verifica se a chave da API foi validada e anexada no request
    if (request.keyData) {
      authService.recordApiUsage(
        request.keyData,
        request.routerPath,
        reply.statusCode
      ).catch(err => request.log.error({ err }, 'Failed to record API usage in onResponse hook'));
    }
    done();
  });

  /* =========================
     HANDLERS GLOBAIS
  ========================= */

  server.setNotFoundHandler((req, reply) => {
    reply.status(404).send({
      success: false,
      error: 'Not Found',
      code: 404,
    });
  });

  server.setErrorHandler((error, req, reply) => {
    req.log.error({ err: error }, error.message);
    reply.status(error.statusCode || 500).send({
      success: false,
      error: error.message || 'Internal Server Error',
      code: error.statusCode || 500,
    });
  });

  return server;
}

module.exports = { buildServer };
