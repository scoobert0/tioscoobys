const BaseExternalDbManager = require('./BaseExternalDbManager');

class FotorjDb extends BaseExternalDbManager {
    constructor(workerPool) {
        super('fotorj.db', workerPool, 'fotorj_fts');
        this.mainTableName = 'pessoas';
    }

    async findByCpf(cpf) {
        const sql = `SELECT cpf, nome, data_nascimento, nome_mae, rg FROM ${this.mainTableName} WHERE cpf = ?`;
        const result = await this.query(sql, [cpf]);
        return result;
    }

    async findByName(name) {
        const sql = `SELECT f.* FROM ${this.mainTableName} f JOIN ${this.ftsTableName} fts ON f.rowid = fts.rowid WHERE fts.nome MATCH ?`;
        const result = await this.query(sql, [name]);
        return result;
    }

    async findByMae(nomeMae) {
        const sql = `SELECT f.* FROM ${this.mainTableName} f JOIN ${this.ftsTableName} fts ON f.rowid = fts.rowid WHERE fts.nome_mae MATCH ?`;
        const result = await this.query(sql, [nomeMae]);
        return result;
    }

    async findByRg(rg) {
        const sql = `SELECT cpf, nome, data_nascimento, nome_mae, rg FROM ${this.mainTableName} WHERE rg = ?`;
        const result = await this.query(sql, [rg]);
        return result;
    }

    async findByCpfWithPhoto(cpf) {
        const sql = `SELECT cpf, nome, data_nascimento, nome_mae, rg, foto_base64 FROM ${this.mainTableName} WHERE cpf = ?`;
        const result = await this.query(sql, [cpf]);
        return result;
    }
}

module.exports = FotorjDb;