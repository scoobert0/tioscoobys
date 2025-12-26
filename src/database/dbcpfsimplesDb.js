const BaseExternalDbManager = require('./BaseExternalDbManager');

class DbCpfSimplesDb extends BaseExternalDbManager {
    constructor(workerPool) {
        super('dbcpfsimples.db', workerPool);
        this.mainTableName = 'pessoas';
    }

    async findByCpf(cpf) {
        const sql = `SELECT * FROM ${this.mainTableName} WHERE cpf = ?`;
        const result = await this.query(sql, [cpf]);
        return result;
    }

    async findByName(name) {
        const sql = `SELECT * FROM ${this.mainTableName} WHERE nome_completo LIKE ? COLLATE NOCASE`;
        const result = await this.query(sql, [`%${name}%`]);
        return result;
    }
}

module.exports = DbCpfSimplesDb;