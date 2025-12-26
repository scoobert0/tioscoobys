const getWorkerPool = require('../workers/dbWorkerPool');
const config = require('../config');

// Path to the worker script
const DB_WORKER_PATH = require.resolve('../workers/dbWorker.js');
let dbWorkerPool = null;

class DatabaseManager {
  constructor(logger) {
    this.logger = logger;
  }

  connectAll() {
    if (!dbWorkerPool) {
      dbWorkerPool = getWorkerPool(DB_WORKER_PATH);
      this.logger.info('DB Worker Pool initialized for dbManager.');
    }
  }

  /**
   * Verifica se o pool de workers está ativo e pronto para processar requisições.
   * @returns {boolean}
   */
  isConnected() {
    return dbWorkerPool !== null;
  }

  // Fecha todas as conexões ativas
  async closeAll() {
    if (dbWorkerPool) {
      await dbWorkerPool.terminate();
      dbWorkerPool = null;
      this.logger.info('DB Worker Pool for dbManager terminated.');
    }
  }

  async queryAll(queryFn, params) {
    if (!dbWorkerPool) {
      throw new Error('Database worker pool is not initialized.');
    }
    // Serialize the queryFn to a string to pass it to the worker
    const queryFnString = queryFn.toString();
    try {
      const results = await dbWorkerPool.runTask('dbManager.queryAll', { queryFnString, params });
      return results;
    } catch (error) {
      this.logger.error({ err: error }, 'Error executing query in worker:');
      throw error;
    }
  }
}

// Export a factory function
module.exports = (logger) => new DatabaseManager(logger);
