const BaseExternalDbManager = require('./BaseExternalDbManager');

class CredilinkDb extends BaseExternalDbManager {
    constructor(workerPool) {
        super('credilink.db', workerPool);
        this.mainTableName = 'credilink_basic';
    }

    // You might want a generic find method in the base class
    async find(field, value) {
        const sql = `SELECT * FROM ${this.mainTableName} WHERE ${field} = ? COLLATE NOCASE`;
        const result = await this.query(sql, [value]);
        return result.length > 0 ? result : null;
    }

    async findByCpf(cpf) {
        const sql = `
            SELECT 
                b.*,
                (SELECT GROUP_CONCAT(t.TELEFONES, ', ') FROM telefone t WHERE t.CPF = b.CPF) AS TELEFONES
            FROM 
                ${this.mainTableName} b
            WHERE 
                b.CPF = ?
        `;
        const result = await this.query(sql, [cpf]);
        return result.length > 0 ? result : null;
    }

    async findByName(name) {
        // Prepara o termo de busca para o FTS5.
        // Transforma "ROGERIO CASSOL" em "ROGERIO* AND CASSOL*".
        const ftsQuery = name.split(' ').map(term => `${term}*`).join(' AND ');

        const sql = `
            SELECT
                main.*
            FROM
                credilink_basic main
            JOIN
                credilink_basic_fts fts ON main.rowid = fts.rowid
            WHERE
                fts.NOME MATCH ?
            LIMIT 50;
        `;
        
        const result = await this.query(sql, [ftsQuery]);
        return result.length > 0 ? result : null;
    }

    async findByMae(mae) {
        const sql = `SELECT * FROM ${this.mainTableName} WHERE NOME_MAE LIKE ? COLLATE NOCASE`;
        const result = await this.query(sql, [`%${mae}%`]);
        return result.length > 0 ? result : null;
    }

    async findByCep(cep) {
        const sql = `SELECT * FROM ${this.mainTableName} WHERE CEP = ?`;
        const result = await this.query(sql, [cep]);
        return result.length > 0 ? result : null;
    }

        async findByPhone(phone) {
            const sql = `SELECT CPF, TELEFONES FROM telefone WHERE TELEFONES = ?`;
            const result = await this.query(sql, [phone]);
            return result.length > 0 ? result : null;
        }}

module.exports = CredilinkDb;