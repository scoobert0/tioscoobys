const BaseExternalDbManager = require('./BaseExternalDbManager');

class ContatosDb extends BaseExternalDbManager {
    constructor(workerPool) {
        super('contatos.db', workerPool, 'contatos_fts');
        this.mainTableName = 'contatos';
    }

    // Generic search by column
    async search(column, value) {
        const cleanColumn = column.replace(/[^a-zA-Z0-9_]/g, '');
        const sql = `SELECT * FROM ${this.mainTableName} WHERE ${cleanColumn} LIKE ?`;
        const results = await this.query(sql, [`%${value}%`]);
        return results;
    }

    async findByCpf(cpf) {
        const sql = `SELECT * FROM ${this.mainTableName} WHERE cpf = ?`;
        const result = await this.query(sql, [cpf]);
        return result;
    }

    async findByName(name) {
        const sql = `SELECT c.* FROM ${this.mainTableName} c JOIN ${this.ftsTableName} fts ON c.rowid = fts.rowid WHERE fts.nome MATCH ?`;
        const result = await this.query(sql, [name]);
        return result;
    }

    async findByPhone(ddd, fone) {
        const sql = `SELECT * FROM ${this.mainTableName} WHERE ddd = ? AND fone = ?`;
        const result = await this.query(sql, [ddd, fone]);
        return result;
    }
}

module.exports = ContatosDb;