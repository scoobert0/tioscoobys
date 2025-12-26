const { formatError } = require('../utils/responseFormatter');

module.exports = (authService, saasDbManager) => {
  const authMiddleware = {
    apiKeyAuth: async (request, reply) => {
      const apiKey = request.headers['x-api-key'];

      if (!apiKey) {
        return reply.status(401).send(formatError({ message: 'X-API-Key ausente. Sem chave, sem acesso.', statusCode: 401 }));
      }

      const verification = await authService.verifyApiKey(apiKey, request.routerPath);

      if (!verification.valid) {
        return reply.status(verification.code).send(formatError({ message: verification.error || 'Chave inválida ou rota não autorizada.', statusCode: verification.code }));
      }

      request.keyData = verification.keyData;

      await saasDbManager.updateUserFirstRequestMade(request.keyData.username);
    },

    sessionAuth: async (request, reply) => {
      if (!request.session.user || !request.session.user.username) {
        return reply.redirect('/login');
      }
    },

    adminOnly: async (request, reply) => {
      if (!request.session.user || request.session.user.role !== 'admin') {
        request.log.warn(`Tentativa de acesso admin bloqueada | user=${request.session.user?.username || 'desconhecido'}`);
        return reply.status(403).send(formatError({ message: 'Acesso negado. Área restrita pra admins.', statusCode: 403 }));
      }
    }
  };
  return authMiddleware;
}
