const BaseExternalDbManager = require('./BaseExternalDbManager');

class CadsusDb extends BaseExternalDbManager {
    constructor(workerPool) {
        super('cadsus.sqlite', workerPool);
        this.mainTableName = 'datasus';
    }

    async findByCpf(cpf) {
        const sql = `SELECT * FROM ${this.mainTableName} WHERE cpf = ?`;
        const result = await this.query(sql, [cpf]);
        return result;
    }

    async findByMae(mae) {
        const sql = `SELECT * FROM ${this.mainTableName} WHERE mae LIKE ? COLLATE NOCASE`;
        const result = await this.query(sql, [`%${mae}%`]);
        return result;
    }

    async findByRg(rgNumero) {
        const sql = `SELECT * FROM ${this.mainTableName} WHERE rgNumero = ?`;
        const result = await this.query(sql, [rgNumero]);
        return result;
    }

    async findByPhone(telefone) {
        const sql = `
            SELECT * FROM ${this.mainTableName} 
            WHERE 
                REPLACE(REPLACE(REPLACE(telefone, ':', ''), '-', ''), ' ', '') = ?
                OR REPLACE(REPLACE(REPLACE(telefoneSecundario, ':', ''), '-', ''), ' ', '') = ?
        `;
        const result = await this.query(sql, [telefone, telefone]);
        return result;
    }
}

module.exports = CadsusDb;