'use strict';
const bcrypt = require('bcryptjs'); // For password hashing

/**
 * Panel Controller
 * Centraliza renderizações, ações do usuário e ações administrativas
 * Tudo em um lugar só, sem espalhar lógica pelo projeto
 */

module.exports = (saasDb) => { // Now accepts saasDb
    const panelController = {

        /* ======================================================
         * HELPERS
         * ====================================================== */

        /**
         * Retorna o usuário completo a partir da sessão,
         * injetando dados extras necessários para o layout e funcionalidades.
         */
        async getUserData(request) {
            if (!request.session.user || !request.session.user.username) {
                return null;
            }

            const { username } = request.session.user;
            const user = saasDb.findUserByUsername(username);
            if (!user) {
                return null;
            }

            // Get API keys count and the first API key value
            const apiKeys = saasDb.getUserKeys(username);
            user.apiKeysCount = apiKeys.length;
            if (apiKeys.length > 0) {
                user.api_key_value = apiKeys[0].api_key;
            } else {
                user.api_key_value = 'NO_API_KEY_AVAILABLE'; // Placeholder if no keys
            }

            // Get plan info
            user.plan = saasDb.getPlanInfoForUser(username);

            // Get dashboard stats
            user.stats = saasDb.getDashboardStats(username);
            
            return user;
        },

        /* ======================================================
         * RENDERIZAÇÃO DE PÁGINAS
         * ====================================================== */

        renderLoginPage(request, reply) {
            if (request.session.user && request.session.user.username) {
                return reply.redirect('/dashboard');
            }

            return reply.view('login.ejs', {
                title: 'Login',
                error: request.query.error || null
            });
        },

        renderRegisterPage(request, reply) {
            if (request.session.user && request.session.user.username) {
                return reply.redirect('/dashboard');
            }

            return reply.view('register.ejs', {
                title: 'Register',
                error: request.query.error || null,
                message: request.query.message || null
            });
        },

        async renderDashboard(request, reply) {
            const user = await this.getUserData(request);
            if (!user) {
                await request.session.destroy(); // Clear session if user not found in DB
                return reply.redirect('/login');
            }
            return reply.view('dashboard.ejs', {
                title: 'Dashboard',
                username: user.username,
                user: user,
                plan: user.plan,
                stats: user.stats,
                apiKeysCount: user.apiKeysCount
            });
        },

        async renderApiKeysPage(request, reply) {
            const user = await this.getUserData(request);
            if (!user) {
                await request.session.destroy();
                return reply.redirect('/login');
            }
            const apiKeys = saasDb.getUserKeys(user.username);
            return reply.view('api-keys.ejs', {
                title: 'API Keys',
                username: user.username,
                user: user,
                apiKeys: apiKeys,
                message: request.query.message || null,
                error: request.query.error || null
            });
        },

        async renderBillingPage(request, reply) {
            const user = await this.getUserData(request);
            if (!user) {
                await request.session.destroy();
                return reply.redirect('/login');
            }
            const pixTransactions = saasDb.getUserPixTransactions(user.username);
            return reply.view('billing.ejs', {
                title: 'Billing & Plans',
                username: user.username,
                user: user,
                plan: user.plan,
                pixTransactions: pixTransactions,
                message: request.query.message || null,
                error: request.query.error || null
            });
        },

        async renderLogsPage(request, reply) {
            const user = await this.getUserData(request);
            if (!user) {
                await request.session.destroy();
                return reply.redirect('/login');
            }
            const activityLogs = saasDb.getActivityLogs(user.username);
            return reply.view('logs.ejs', {
                title: 'Activity Logs',
                username: user.username,
                user: user,
                activityLogs: activityLogs,
                message: request.query.message || null,
                error: request.query.error || null
            });
        },

        async renderProfilePage(request, reply) {
            const user = await this.getUserData(request);
            if (!user) {
                await request.session.destroy();
                return reply.redirect('/login');
            }
            return reply.view('profile.ejs', {
                title: 'User Profile',
                username: user.username,
                user: user,
                message: request.query.message || null,
                error: request.query.error || null
            });
        },

        async renderDocsPage(request, reply) {
            const user = await this.getUserData(request);
            if (!user) {
                await request.session.destroy();
                return reply.redirect('/login');
            }
            return reply.view('docs.ejs', {
                title: 'Documentation',
                username: user.username,
                user: user,
                message: request.query.message || null,
                error: request.query.error || null
            });
        },

        // ======================================================
        // RENDERIZAÇÃO DE PÁGINAS DE CONSULTA
        // ======================================================
        async renderSearchCpfPage(request, reply) {
            const user = await this.getUserData(request);
            if (!user) { await request.session.destroy(); return reply.redirect('/login'); }
            return reply.view('search/cpf.ejs', { title: 'Consulta por CPF', username: user.username, user: user });
        },
        async renderSearchNameCpfPage(request, reply) {
            const user = await this.getUserData(request);
            if (!user) { await request.session.destroy(); return reply.redirect('/login'); }
            return reply.view('search/name-cpf.ejs', { title: 'Consulta por Nome/CPF', username: user.username, user: user });
        },
        async renderSearchPhonePage(request, reply) {
            const user = await this.getUserData(request);
            if (!user) { await request.session.destroy(); return reply.redirect('/login'); }
            return reply.view('search/phone.ejs', { title: 'Consulta por Telefone', username: user.username, user: user });
        },
        async renderSearchCepPage(request, reply) {
            const user = await this.getUserData(request);
            if (!user) { await request.session.destroy(); return reply.redirect('/login'); }
            return reply.view('search/cep.ejs', { title: 'Consulta por CEP', username: user.username, user: user });
        },
        async renderSearchPlatePage(request, reply) {
            const user = await this.getUserData(request);
            if (!user) { await request.session.destroy(); return reply.redirect('/login'); }
            return reply.view('search/plate.ejs', { title: 'Consulta por Placa', username: user.username, user: user });
        },
        async renderSearchChassiPage(request, reply) {
            const user = await this.getUserData(request);
            if (!user) { await request.session.destroy(); return reply.redirect('/login'); }
            return reply.view('search/chassi.ejs', { title: 'Consulta por Chassi', username: user.username, user: user });
        },
        async renderSearchMotherNamePage(request, reply) {
            const user = await this.getUserData(request);
            if (!user) { await request.session.destroy(); return reply.redirect('/login'); }
            return reply.view('search/mother-name.ejs', { title: 'Consulta por Nome da Mãe', username: user.username, user: user });
        },
        async renderSearchScoreCpfPage(request, reply) {
            const user = await this.getUserData(request);
            if (!user) { await request.session.destroy(); return reply.redirect('/login'); }
            return reply.view('search/score-cpf.ejs', { title: 'Consulta de Score por CPF', username: user.username, user: user });
        },
        async renderSearchRgPage(request, reply) {
            const user = await this.getUserData(request);
            if (!user) { await request.session.destroy(); return reply.redirect('/login'); }
            return reply.view('search/rg.ejs', { title: 'Consulta por RG', username: user.username, user: user });
        },
        async renderSearchPhotoCpfPage(request, reply) {
            const user = await this.getUserData(request);
            if (!user) { await request.session.destroy(); return reply.redirect('/login'); }
            return reply.view('search/photo-cpf.ejs', { title: 'Consulta de Foto por CPF', username: user.username, user: user });
        },
        async renderSearchSiblingsPage(request, reply) {
            const user = await this.getUserData(request);
            if (!user) { await request.session.destroy(); return reply.redirect('/login'); }
            return reply.view('search/siblings.ejs', { title: 'Consulta de Familiares (Irmãos)', username: user.username, user: user });
        },

        /* ======================================================
         * AÇÕES DO USUÁRIO
         * ====================================================== */

        async handleLogout(request, reply) {
            await request.session.destroy();
            return reply.redirect('/login');
        },

        async handleCreateApiKey(request, reply) {
            const user = await this.getUserData(request);
            if (!user) {
                await request.session.destroy();
                return reply.status(401).send('Unauthorized');
            }
            // For simplicity, always create 'test' plan key
            saasDb.createApiKey(user.username, 'test', 30);
            return reply.redirect('/api-keys?message=API+Key+created+successfully.');
        },

        async handleRegenerateApiKey(request, reply) {
            const user = await this.getUserData(request);
            if (!user) {
                await request.session.destroy();
                return reply.status(401).send('Unauthorized');
            }
            const keyId = request.params.keyId;
            const newKey = saasDb.regenerateApiKey(keyId, user.username);
            if (newKey) {
                return reply.redirect('/api-keys?message=API+Key+regenerated+successfully.');
            }
            return reply.redirect('/api-keys?error=Failed+to+regenerate+API+Key.');
        },

        async handleDeleteApiKey(request, reply) {
            const user = await this.getUserData(request);
            if (!user) {
                await request.session.destroy();
                return reply.status(401).send('Unauthorized');
            }
            const keyId = request.params.keyId;
            const deleted = saasDb.deleteApiKey(keyId, user.username);
            if (deleted) {
                return reply.redirect('/api-keys?message=API+Key+deleted+successfully.');
            }
            return reply.redirect('/api-keys?error=Failed+to+delete+API+Key.');
        },

        async handleGeneratePix(request, reply) {
            const user = await this.getUserData(request);
            if (!user) {
                await request.session.destroy();
                return reply.status(401).send('Unauthorized');
            }
            const { amount } = request.body;
            if (!amount || isNaN(amount) || amount <= 0) {
                return reply.redirect('/billing?error=Invalid+amount+for+PIX.');
            }
            // For simplicity, clientIdentifier and expiresAt are generated here
            const clientIdentifier = `pix-${Date.now()}`;
            const expiresAt = new Date();
            expiresAt.setMinutes(expiresAt.getMinutes() + 30); // 30 minutes to expire
            
            saasDb.createPixTransaction(user.username, parseFloat(amount), clientIdentifier, expiresAt);
            return reply.redirect('/billing?message=PIX+generated+successfully.+Waiting+for+payment.');
        },

        async handleChangePassword(request, reply) {
            const user = await this.getUserData(request);
            if (!user) {
                await request.session.destroy();
                return reply.status(401).send('Unauthorized');
            }
            const { current_password, new_password, new_password_confirm } = request.body;

            const userFromDb = saasDb.findUserByUsername(user.username);
            if (!userFromDb || !(await bcrypt.compare(current_password, userFromDb.password_hash))) {
                return reply.redirect('/profile?error=Incorrect+current+password.');
            }

            if (new_password !== new_password_confirm) {
                return reply.redirect('/profile?error=New+passwords+do+not+match.');
            }

            if (new_password.length < 6) { 
                return reply.redirect('/profile?error=New+password+is+too+short.');
            }

            const newPasswordHash = await bcrypt.hash(new_password, 10);
            saasDb.updateUserPasswordByUsername(user.username, newPasswordHash);
            return reply.redirect('/profile?message=Password+changed+successfully.');
        }
    };
    
    // Bind all methods to the panelController instance
    for (const key in panelController) {
        if (typeof panelController[key] === 'function') {
            panelController[key] = panelController[key].bind(panelController);
        }
    }

    return panelController;
}
