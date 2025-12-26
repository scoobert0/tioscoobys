// src/auth/apiAuthMiddleware.js

// This is a simplified API Key authentication middleware
module.exports = (saasDb, authService) => {

    const planLimits = {
        teste: 1, // Plano de teste com 1 requisição por dia
        basico: 100,
        pro: 1000,
        default: 10, // Limite padrão para planos não encontrados
    };

    // Helper para verificar se a data é anterior a hoje (ignorando a hora)
    const isOlderThanToday = (date) => {
        const today = new Date();
        today.setHours(0, 0, 0, 0); // Zera a hora para comparar apenas a data
        const otherDate = new Date(date);
        otherDate.setHours(0, 0, 0, 0);
        return otherDate < today;
    };

    const apiAuthMiddleware = {
        apiKeyAuth: async (request, reply) => {
            const apiKey = request.headers['x-api-key'];

            if (!apiKey) {
                return reply.status(401).send({ success: false, error: 'X-API-Key header is missing. Access denied.' });
            }

            // Find key in saasDb. Assumindo que findKeyByValue é async
            const keyData = await saasDb.findKeyByValue(apiKey);

            if (!keyData) {
                return reply.status(401).send({ success: false, error: 'Invalid API Key. Access denied.' });
            }

            // Check if key is active
            if (!keyData.active) {
                return reply.status(401).send({ success: false, error: 'API Key is deactivated.' });
            }

            // Check if key is expired
            if (new Date(keyData.expires_at) < new Date()) {
                return reply.status(402).send({ success: false, error: 'API Key expired.' });
            }

            // --- IMPLEMENTAÇÃO DO RATE LIMIT ---

            // 1. Verifica se o contador diário precisa ser resetado
            if (isOlderThanToday(keyData.last_used_at)) {
                await saasDb.resetKeyUsage(keyData.id);
                keyData.requests_today = 0; // Zera para a verificação atual
            }

            // 2. Verifica o limite do plano
            const plan = keyData.plan || 'default';
            const limit = planLimits[plan] ?? planLimits.default;

            if (keyData.requests_today >= limit) {
                return reply.status(429).send({ 
                    success: false, 
                    error: `Too Many Requests. Your plan ("${plan}") is limited to ${limit} requests per day.` 
                });
            }

            // --- FIM DO RATE LIMIT ---

            request.keyData = keyData; // Anexa os dados da chave na requisição

        }
    };
    return apiAuthMiddleware;
};