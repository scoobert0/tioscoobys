// src/workers/externalDbWorker.js
'use strict';

const { parentPort } = require('worker_threads');
const Database = require('better-sqlite3');
const path = require('path');

const dbs = new Map(); // Map > object (menos bugs, mais controle)

/* ==============================
 * Utils
 * ============================== */

function serializeError(err) {
    return {
        name: err?.name || 'Error',
        message: err?.message || 'Unknown error',
        code: err?.code || 'UNKNOWN_ERROR',
        stack: err?.stack || null
    };
}

function discoverMainTable(db) {
    const row = db
        .prepare(`
            SELECT name 
            FROM sqlite_master 
            WHERE type='table' 
              AND name NOT LIKE 'sqlite_%' 
            LIMIT 1
        `)
        .get();

    return row?.name || null;
}

/* ==============================
 * DB Handling
 * ============================== */

function openDb(dbPath, dbFileName) {
    if (dbs.has(dbPath)) {
        return dbs.get(dbPath);
    }

    const db = new Database(dbPath, { readonly: true });

    const mainTableName = discoverMainTable(db);

    dbs.set(dbPath, {
        db,
        mainTableName
    });

    return dbs.get(dbPath);
}

function closeAllDbs() {
    for (const { db } of dbs.values()) {
        try {
            db.close();
        } catch (_) {}
    }
    dbs.clear();
}

/* ==============================
 * Worker listener
 * ============================== */

parentPort.on('message', (task) => {
    const { id, dbFileName, sql, params, method = 'all', ftsTableName } = task;

    try {
        if (!sql || typeof sql !== 'string') {
            throw new Error('SQL inválido');
        }

        if (!['all', 'get'].includes(method)) {
            throw new Error(`Método não suportado: ${method}`);
        }

        const dbPath = path.resolve(__dirname, '../../', dbFileName);
        const instance = openDb(dbPath, dbFileName);

        let finalSql = sql;

        if (instance.mainTableName) {
            finalSql = finalSql.replace(
                /\$\{this\.mainTableName\}/g,
                instance.mainTableName
            );
        } else if (finalSql.includes('${this.mainTableName}')) {
            throw new Error(`Tabela principal não encontrada em ${dbFileName}`);
        }

        if (ftsTableName) {
            finalSql = finalSql.replace(
                /\$\{this\.ftsTableName\}/g,
                ftsTableName
            );
        } else if (finalSql.includes('${this.ftsTableName}')) {
            throw new Error(`FTS table name not provided for ${dbFileName}`);
        }

        const stmt = instance.db.prepare(finalSql);

        const safeParams = params ?? {};

        const result =
            method === 'get'
                ? stmt.get(safeParams)
                : stmt.all(safeParams);

        parentPort.postMessage({ id, result, error: null });

    } catch (err) {
        parentPort.postMessage({
            id,
            result: null,
            error: serializeError(err)
        });
    }
});

/* ==============================
 * Cleanup
 * ============================== */

process.on('exit', closeAllDbs);
process.on('SIGTERM', closeAllDbs);
process.on('SIGINT', closeAllDbs);
