const BaseExternalDbManager = require('./BaseExternalDbManager');

class VeiculosDb extends BaseExternalDbManager {
    constructor(workerPool) {
        super('veiculos.db', workerPool);
        this.mainTableName = 'vehicles';
    }

    async findByPlaca(placa) {
        const sql = `SELECT * FROM ${this.mainTableName} WHERE placa = ?`;
        const result = await this.query(sql, [placa]);
        return result;
    }

    async findByPlacaAntiga(placaAntiga) {
        const sql = `SELECT * FROM ${this.mainTableName} WHERE placa_modelo_antigo = ?`;
        const result = await this.query(sql, [placaAntiga]);
        return result;
    }

    async findByPlacaNova(placaNova) {
        const sql = `SELECT * FROM ${this.mainTableName} WHERE placa_modelo_novo = ?`;
        const result = await this.query(sql, [placaNova]);
        return result;
    }

    async findByChassi(chassi) {
        const sql = `SELECT * FROM ${this.mainTableName} WHERE chassi = ?`;
        const result = await this.query(sql, [chassi]);
        return result;
    }
}

module.exports = VeiculosDb;