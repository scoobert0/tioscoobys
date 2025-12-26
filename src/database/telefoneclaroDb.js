const BaseExternalDbManager = require('./BaseExternalDbManager');

class TelefoneClaroDb extends BaseExternalDbManager {
    constructor(workerPool) {
        super('telefoneclaro.db', workerPool, 'telefoneclaro_fts');
        this.mainTableName = 'claro';
    }

    async findByCpf(cpf) {
        const sql = `SELECT * FROM ${this.mainTableName} WHERE cpf = ?`;
        const result = await this.query(sql, [cpf]);
        return result;
    }

    async findByName(name) {
        const sql = `SELECT t.* FROM ${this.mainTableName} t JOIN ${this.ftsTableName} fts ON t.rowid = fts.rowid WHERE fts.nome MATCH ?`;
        const result = await this.query(sql, [name]);
        return result;
    }

    async findByPhone(ddd, fone) {
        const sql = `SELECT * FROM ${this.mainTableName} WHERE ddd = ? AND fone = ?`;
        const result = await this.query(sql, [ddd, fone]);
        return result;
    }
}

module.exports = TelefoneClaroDb;