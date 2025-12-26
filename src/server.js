/**
 * Entrypoint do servidor. Usa a factory em `app.js` e gerencia
 * startup / graceful shutdown de infra e serviços.
 */

const { buildServer } = require('./app');
const config = require('./config');
const validateEnv = require('./config/validateEnv'); // Import the validation function
const pino = require('pino'); // Import pino logger
const fs = require('fs'); // For file system checks
const path = require('path'); // For path manipulation

const panelControllerFactory = require('./panel/controller');
const panelRoutesFactory = require('./panel/routes');

// External Database Managers
const contatosDb = require('./database/contatosDb');
const scoresDb = require('./database/scoresDb');
const cadsusDb = require('./database/cadsusDb');
const fotorjDb = require('./database/fotorjDb');
const veiculosDb = require('./database/veiculosDb');
const telefoneTimDb = require('./database/telefonetimDb');
const credilinkDb = require('./database/credilinkDb');
const telefoneClaroDb = require('./database/telefoneclaroDb');
const dbCpfSimplesDb = require('./database/dbcpfsimplesDb');

// Worker Pool for External DBs
const ExternalDbWorkerPool = require('./workers/externalDbWorkerPool');

// Search Service & Controller
const SearchService = require('./services/searchService');
const referenceServiceFactory = require('./services/referenceService');
const SearchController = require('./controllers/searchController');
const authServiceFactory = require('./auth/authService');
const authMiddlewareFactory = require('./auth/authMiddleware'); // Add this line
const searchRoutesFactory = require('./routes/searchRoutes');

// PIX Service & Controller
const saasDbManager = require('./database/saasDb');
const pixServiceFactory = require('./pix/pixService');
const pixControllerFactory = require('./pix/pixController');
const pixRoutesFactory = require('./pix/pixRoutes');
const responseFormatter = require('./utils/responseFormatter');

// Centralized logger for the application
const logger = pino({
  level: config.server.env === 'development' ? 'info' : 'warn',
  transport:
    config.server.env === 'development'
      ? { target: 'pino-pretty', options: { translateTime: 'HH:MM:ss Z', ignore: 'pid,hostname' } }
      : undefined,
});

// Initialize external DB worker pool
const externalDbWorkerPool = new ExternalDbWorkerPool();
externalDbWorkerPool.setLogger(logger);

// Initialize Managers
saasDbManager.setLogger(logger);

// Initialize Auth Service
const { authService, PLAN_LIMITS } = authServiceFactory(saasDbManager);

// Initialize Auth Middleware
const authMiddleware = authMiddlewareFactory(authService, saasDbManager);

// Initialize Reference Service
const referenceService = referenceServiceFactory(logger);

// Initialize Search Service and Controller
const searchService = new SearchService(logger, externalDbWorkerPool, referenceService); // Pass workerPool and referenceService to SearchService
const searchController = new SearchController(searchService, logger);

// Initialize PIX Service and Controller
const pixService = pixServiceFactory(saasDbManager); // Pass the correct manager
const pixController = pixControllerFactory(pixService, responseFormatter);
const pixRoutes = pixRoutesFactory(pixController);

// Initialize Controllers and Routes
const panelController = panelControllerFactory(saasDbManager); // Pass the worker-based manager
const panelRoutes = panelRoutesFactory(panelController, pixRoutes, saasDbManager, authMiddleware);
const searchRoutes = searchRoutesFactory(searchController, authMiddleware, authService);


/**
 * Checks if essential database files exist.
 * Logs warnings if files are missing.
 * @returns {boolean} True if all essential files exist, false otherwise.
 */
function checkDatabaseFilesExist() {
  let allExist = true;

  // List of all external DB files to check
  const externalDbFiles = [
    'saas.db', // Main SaaS DB
    'contatos.db',
    'scores.db',
    'cadsus.sqlite',
    'fotorj.db',
    'veiculos.db',
    'telefonetim.db',
    'credilink.db',
    'telefoneclaro.db',
    'dbcpfsimples.db'
  ];

  for (const dbFile of externalDbFiles) {
    const dbPath = path.resolve(__dirname, '..', dbFile);
    if (!fs.existsSync(dbPath)) {
      logger.warn(`Essential database file missing: ${dbPath}. Please ensure it exists.`);
      allExist = false;
    }
  }
  return allExist;
}

let server;

async function start() {
  validateEnv(); // Validate environment variables at startup

  // Carrega os dados de referência em memória
  await referenceService.loadReferences();

  // The worker now handles its own database initialization.
  
  // Check if essential database files exist
  checkDatabaseFilesExist();

  server = buildServer({ logger, config, authService });

  // Register routes
  server.register(panelRoutes);
  server.register(searchRoutes, { prefix: '/api' }); // Search routes are prefixed with /api

  server.get('/', (req, reply) => reply.redirect('/dashboard'));

  // Health endpoint
  server.get('/health', async (req, reply) => {
    const uptime = process.uptime();
    
    const health = {
      status: 'ok',
      uptime,
      env: config.server.env,
      timestamp: new Date().toISOString(),
    };

    reply.send(health);
  });

  try {
    await server.listen({ port: config.server.port, host: config.server.host });

    server.log.info({ msg: 'Server started', host: config.server.host, port: config.server.port });
  } catch (err) {
    if (server && server.log) server.log.error(err);
    logger.error('Failed to start server:', err);
    await shutdown(1);
  }
}

let shuttingDown = false;
async function shutdown(exitCode = 0) {
  if (shuttingDown) return;
  shuttingDown = true;

  server.log.info('Graceful shutdown initiated...');

      try {
      // Stop accepting new requests
      if (server) await server.close();
  
      // Terminate the external DB worker pool
      await externalDbWorkerPool.terminate();
  
      // Close all external DB connections that might still be open (this should be handled by worker pool now, but as fallback)
      for (const dbName in searchService.dbs) {
        searchService.dbs[dbName].close();
      }

    server.log.info('Shutdown complete.');
  } catch (err) {
    server.log.error({ err }, 'Error during shutdown');
  } finally {
    process.exit(exitCode);
  }
}

process.on('SIGINT', () => {
  logger.info('SIGINT received');
  shutdown(0);
});

process.on('SIGTERM', () => {
  logger.info('SIGTERM received');
  shutdown(0);
});

process.on('uncaughtException', (err) => {
  logger.fatal({ err }, 'uncaughtException');
  shutdown(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.fatal({ err: reason, promise }, 'unhandledRejection');
  shutdown(1);
});

// If this file is started directly, run start
if (require.main === module) {
  start();
}

module.exports = { start, shutdown };
