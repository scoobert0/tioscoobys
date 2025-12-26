const BaseExternalDbManager = require('./BaseExternalDbManager');

class TelefoneTimDb extends BaseExternalDbManager {
    constructor(workerPool) {
        super('telefonetim.db', workerPool, 'telefonetim_fts');
        this.mainTableName = 'dados';
    }

    async findByCpf(cpf) {
        const sql = `SELECT * FROM ${this.mainTableName} WHERE DOC = ?`;
        const result = await this.query(sql, [cpf]);
        return result;
    }

    async findByName(name) {
        const sql = `SELECT t.* FROM ${this.mainTableName} t JOIN ${this.ftsTableName} fts ON t.rowid = fts.rowid WHERE fts.NOME MATCH ?`;
        const result = await this.query(sql, [name]);
        return result;
    }

    async findByPhone(ddd, tel) {
        const sql = `SELECT * FROM ${this.mainTableName} WHERE DDD = ? AND TEL = ?`;
        const result = await this.query(sql, [ddd, tel]);
        return result;
    }

    async findByCep(cep) {
        const sql = `SELECT * FROM ${this.mainTableName} WHERE CEP = ?`;
        const result = await this.query(sql, [cep]);
        return result.length > 0 ? result : null;
    }
}

module.exports = TelefoneTimDb;