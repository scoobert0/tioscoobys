const bcrypt = require('bcryptjs');

// Custo do hash — quanto maior, mais seguro (e mais pesado)
const SALT_ROUNDS = 10;

// Limites por plano (request/dia)
const PLAN_LIMITS = {
  test: 1,
  weekly: 1000,
  monthly: 10000,
};

module.exports = (saasDbManager) => {
  const authService = {
    // =========================
    // AUTH DO PAINEL WEB
    // =========================

    // Gera o hash da senha (bcrypt raiz)
    async hashPassword(password) {
      return bcrypt.hash(password, SALT_ROUNDS);
    },

    // Compara senha digitada vs hash salvo
    async comparePassword(password, hash) {
      return bcrypt.compare(password, hash);
    },

    // Autentica o usuário do painel
    async authenticateUser(username, password) {
      const user = await saasDbManager.findUserByUsername(username); // AWAIT this call

      // Usuário fantasma = fora
      if (!user) {
        return null;
      }

      const match = await this.comparePassword(password, user.password_hash);

      if (match) {
        // Remove o hash antes de devolver os dados
        const { password_hash, ...userData } = user;
        return userData;
      }

      // Senha errada, tenta de novo
      return null;
    },

    // =========================
    // AUTH POR API KEY
    // =========================
    async verifyApiKey(apiKey, endpoint) { // Make verifyApiKey async
      const keyData = await saasDbManager.findKeyByValue(apiKey); // AWAIT this call

      // 1. Key não existe? Nem começa
      if (!keyData) {
        return { valid: false, code: 401, error: 'API Key inválida. Acesso negado.' };
      }

      // 2. Key existe mas tá desligada
      if (!keyData.active) {
        return { valid: false, code: 401, error: 'API Key desativada. Fala com o admin.' };
      }

      // 3. Plano expirado = game over
      if (new Date(keyData.expires_at) < new Date()) {
        return {
          valid: false,
          code: 402,
          error: 'Plano expirado. Renova pra continuar usando a API.'
        };
      }

      // 4. Estourou o limite diário
      const limit = PLAN_LIMITS[keyData.plan] || 0;
      if (keyData.requests_today >= limit) {
        return {
          valid: false,
          code: 429,
          error: `Limite diário de ${limit} requests estourado. Segura a mão aí.`
        };
      }

      // 5. Checagem de permissão por endpoint (exemplo)
      // Plano TESTE só acessa CPF e NOME
      if (
        keyData.plan === 'test' &&
        !endpoint.includes('/search/cpf/') &&
        !endpoint.includes('/search/nome/')
      ) {
        return {
          valid: false,
          code: 403,
          error: `Seu plano atual ('${keyData.plan}') não tem permissão pra esse endpoint.`
        };
      }

      // Tudo certo, pode passar
      return { valid: true, keyData };
    },

    // =========================
    // LOG & CONTROLE DE USO
    // =========================
    async recordApiUsage(keyData, endpoint, statusCode) {
      // Incrementa contador da key
      await saasDbManager.incrementKeyUsage(keyData.id); // AWAIT this call

      // Loga tudo (endpoint + status)
      await saasDbManager.logUsage(keyData.id, endpoint, statusCode); // AWAIT this call
    }
  };
  return { authService, PLAN_LIMITS };
};