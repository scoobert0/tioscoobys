const BaseExternalDbManager = require('./BaseExternalDbManager');

class ScoresDb extends BaseExternalDbManager {
    constructor(workerPool) {
        super('scores.db', workerPool);
        this.mainTableName = 'scores';
    }

    async findByCpf(cpf) {
        const sql = `SELECT * FROM ${this.mainTableName} WHERE cpf_consulta = ?`;
        const result = await this.query(sql, [cpf]);
        return result;
    }
}

module.exports = ScoresDb;