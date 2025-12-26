'use strict';
const bcrypt = require('bcryptjs');

module.exports = (saasDb) => {
    const adminController = {
        async renderAdminPanel(request, reply) {
            const users = await saasDb.getAllUsers();
            const apiKeys = await saasDb.getAllApiKeysWithUsernames(); // You'll need to implement this
            
            // Dummy admin stats for now
            const adminStats = {
                totalUsers: users.length,
                suspendedUsers: users.filter(u => u.suspended).length,
                totalApiKeys: apiKeys.length,
                activeApiKeys: apiKeys.filter(key => key.active).length,
                pixStatusDistribution: {
                    COMPLETED: 0, // Implement real fetching from saasDb
                    PENDING: 0,
                    EXPIRED: 0
                }
            };

            return reply.view('admin.ejs', {
                title: 'Admin Panel',
                activePage: 'admin', // Add this line
                username: request.session.user.username,
                user: request.session.user, // Pass simplified user data
                users,
                apiKeys,
                adminStats,
                message: request.query.message || null,
                error: request.query.error || null
            });
        },

        async handleCreateUser(request, reply) {
            const { username, password, role } = request.body;
            if (!username || !password || !role) {
                return reply.redirect('/admin?error=Todos+os+campos+sao+obrigatorios.');
            }

            const existingUser = await saasDb.findUserByUsername(username);
            if (existingUser) {
                return reply.redirect('/admin?error=Username+ja+existe.');
            }

            try {
                const passwordHash = await bcrypt.hash(password, 10);
                await saasDb.createUser(username, passwordHash, role);
                return reply.redirect('/admin?message=Usuario+criado+com+sucesso.');
            } catch (error) {
                request.log.error(error, 'Error creating user');
                return reply.redirect('/admin?error=Erro+ao+criar+usuario.');
            }
        },

        async handleCreateApiKey(request, reply) {
            const { username, plan } = request.body;
            if (!username || !plan) {
                return reply.redirect('/admin?error=Username+e+plano+sao+obrigatorios.');
            }

            const user = await saasDb.findUserByUsername(username);
            if (!user) {
                return reply.redirect('/admin?error=Usuario+nao+encontrado.');
            }

            try {
                await saasDb.createApiKey(username, plan, 30); // Default 30 days
                return reply.redirect('/admin?message=API+Key+gerada+com+sucesso.');
            } catch (error) {
                request.log.error(error, 'Error creating API Key');
                return reply.redirect('/admin?error=Erro+ao+gerar+API+Key.');
            }
        },

        async handleToggleApiKey(request, reply) {
            const { keyId } = request.params;
            const key = await saasDb.findKeyById(keyId); // You'll need to implement findKeyById

            if (!key) {
                return reply.redirect('/admin?error=API+Key+nao+encontrada.');
            }

            const newStatus = !key.active;
            await saasDb.updateApiKeyStatus(keyId, newStatus); // Implement updateApiKeyStatus
            return reply.redirect('/admin?message=API+Key+status+atualizado.');
        }

        // Add other admin functions here (suspend user, change plan, etc.)
    };

    // Bind all methods
    for (const key in adminController) {
        if (typeof adminController[key] === 'function') {
            adminController[key] = adminController[key].bind(adminController);
        }
    }

    return adminController;
};
