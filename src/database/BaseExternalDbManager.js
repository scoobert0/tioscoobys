const path = require('path');

class BaseExternalDbManager {
    constructor(dbFileName, workerPool, ftsTableName = null) {
        this.dbFileName = dbFileName;
        this.workerPool = workerPool; // Store the worker pool instance
        this.logger = console; // Default logger, can be overridden
        this.ftsTableName = ftsTableName;
    }

    setLogger(logger) {
        this.logger = logger;
    }

    // No longer opens/closes DB directly, just ensures workerPool is set
    open() {
        if (!this.workerPool) {
            this.logger.error(`Worker pool not set for ${this.dbFileName}.`);
            throw new Error(`Worker pool not set for ${this.dbFileName}.`);
        }
    }

    // No longer closes DB directly, workerPool handles it on terminate
    close() {
        // The worker manages its own database connections.
        // This method becomes a no-op here as the connections are within the worker.
        // Actual closing happens when the workerPool is terminated.
        this.logger.info(`BaseExternalDbManager close() called for ${this.dbFileName}. Worker handles connection.`);
    }

    async query(sql, params = []) {
        this.open(); // Ensure workerPool is ready
        try {
            return await this.workerPool.runTask(this.dbFileName, sql, params, 'all', this.ftsTableName);
        } catch (error) {
            this.logger.error(`Error executing query on ${this.dbFileName} via worker:`, error);
            throw error;
        }
    }

    async queryOne(sql, params = []) {
        this.open(); // Ensure workerPool is ready
        try {
            return await this.workerPool.runTask(this.dbFileName, sql, params, 'get', this.ftsTableName);
        } catch (error) {
            this.logger.error(`Error executing query on ${this.dbFileName} via worker:`, error);
            throw error;
        }
    }

    // These methods relied on direct db access and are now handled by the worker
    getColumns(tableName) {
        this.logger.warn(`getColumns not directly supported by BaseExternalDbManager in worker mode. Worker discovers table names.`);
        return []; // Placeholder
    }

    discoverMainTableName() {
        this.logger.warn(`discoverMainTableName not directly supported by BaseExternalDbManager in worker mode. Worker discovers table names.`);
        return null; // Placeholder
    }
}

module.exports = BaseExternalDbManager;