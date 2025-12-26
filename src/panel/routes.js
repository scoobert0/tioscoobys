'use strict';

const simpleAuthFactory = require('../auth/simpleAuth');
const adminControllerFactory = require('./adminController'); // Add this line

module.exports = (panelController, pixRoutes, saasDbManager, authMiddleware) => { // Add authMiddleware here
    const simpleAuth = simpleAuthFactory(saasDbManager); // Initialize simpleAuth with the manager
    const adminController = adminControllerFactory(saasDbManager); // Initialize adminController

    return async function panelRoutes(fastify) {

        /* ======================================================
         * ROTAS PÚBLICAS
         * ====================================================== */

        fastify.get('/login', panelController.renderLoginPage);
        fastify.post('/login', simpleAuth.handleLogin);

        fastify.get('/register', panelController.renderRegisterPage);
        fastify.post('/register', simpleAuth.handleRegister);


        /* ======================================================
         * ROTAS PROTEGIDAS (USUÁRIO LOGADO)
         * ====================================================== */

        fastify.register(async function (fastify) {
            fastify.addHook('preHandler', simpleAuth.requireAuth);

            // Register PIX routes under this authenticated scope
            fastify.register(pixRoutes);

            // Dashboard & Core
            fastify.get('/dashboard', panelController.renderDashboard);
            fastify.post('/dashboard/logout', panelController.handleLogout);

            // API Keys
            fastify.get('/api-keys', panelController.renderApiKeysPage);
            fastify.post('/api-keys', panelController.handleCreateApiKey);
            fastify.post('/api-keys/:keyId/regenerate', panelController.handleRegenerateApiKey);
            fastify.post('/api-keys/:keyId/delete', panelController.handleDeleteApiKey); // Using POST for delete for simplicity

            // Billing / PIX
            fastify.get('/billing', panelController.renderBillingPage);
            // The POST route is obsolete, PIX is now generated via the GET /pix/receber API endpoint
            // fastify.post('/billing/pix', panelController.handleGeneratePix);

            // Logs
            fastify.get('/logs', panelController.renderLogsPage);

            // User Profile
            fastify.get('/profile', panelController.renderProfilePage);
            fastify.post('/profile/password', panelController.handleChangePassword);
            
            // Docs
            fastify.get('/docs', panelController.renderDocsPage);

            // Dedicated Search Pages
            fastify.get('/search/cpf', panelController.renderSearchCpfPage);
            fastify.get('/search/name-cpf', panelController.renderSearchNameCpfPage);
            fastify.get('/search/phone', panelController.renderSearchPhonePage);
            fastify.get('/search/cep', panelController.renderSearchCepPage);
            fastify.get('/search/plate', panelController.renderSearchPlatePage);
            fastify.get('/search/chassi', panelController.renderSearchChassiPage);
            fastify.get('/search/mother-name', panelController.renderSearchMotherNamePage);
            fastify.get('/search/score-cpf', panelController.renderSearchScoreCpfPage);
            fastify.get('/search/rg', panelController.renderSearchRgPage);
            fastify.get('/search/photo-cpf', panelController.renderSearchPhotoCpfPage);
            fastify.get('/search/siblings', panelController.renderSearchSiblingsPage);

            // Admin Routes
            fastify.register(async function (fastify) {
                fastify.addHook('preHandler', authMiddleware.adminOnly); // Apply adminOnly middleware

                fastify.get('/admin', adminController.renderAdminPanel);
                fastify.post('/admin/create-user', adminController.handleCreateUser);
                fastify.post('/admin/create-key', adminController.handleCreateApiKey);
                fastify.post('/admin/toggle-key/:keyId', adminController.handleToggleApiKey);
                // Add other admin routes here
            });

        });
    }
}