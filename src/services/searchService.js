const ContatosDb = require('../database/contatosDb');
const ScoresDb = require('../database/scoresDb');
const CadsusDb = require('../database/cadsusDb');
const FotorjDb = require('../database/fotorjDb');
const VeiculosDb = require('../database/veiculosDb');
const TelefoneTimDb = require('../database/telefonetimDb');
const CredilinkDb = require('../database/credilinkDb');
const TelefoneClaroDb = require('../database/telefoneclaroDb');
const DbCpfSimplesDb = require('../database/dbcpfsimplesDb');

class SearchService {
    constructor(logger, workerPool, referenceService) { // Accept workerPool and referenceService in constructor
        this.logger = logger;
        this.workerPool = workerPool; // Store workerPool
        this.referenceService = referenceService; // Store referenceService

        // Instantiate DB managers, passing the workerPool
        this.dbs = {
            contatos: new ContatosDb(this.workerPool),
            scores: new ScoresDb(this.workerPool),
            cadsus: new CadsusDb(this.workerPool),
            fotorj: new FotorjDb(this.workerPool),
            veiculos: new VeiculosDb(this.workerPool),
            telefonetim: new TelefoneTimDb(this.workerPool),
            credilink: new CredilinkDb(this.workerPool),
            telefoneclaro: new TelefoneClaroDb(this.workerPool),
            dbcpfsimples: new DbCpfSimplesDb(this.workerPool)
        };

        // Set logger for all DB managers
        for (const dbName in this.dbs) {
            this.dbs[dbName].setLogger(this.logger);
        }

        // Define mappings for each DB's basic/medium fields once
        this.mappings = {
            contatos: { basic: ['cpf', 'nome', 'ddd', 'fone'], medium: ['cpf', 'nome', 'pessoa', 'ddd', 'fone'] },
            scores: { basic: ['cpf_consulta', 'score_risco_csb'], medium: ['cpf_consulta', 'score_risco_csb', 'nivel_risco_descricao'] },
            cadsus: { basic: ['cpf', 'mae', 'telefone'], medium: ['cpf', 'pai', 'mae', 'municipio', 'telefone', 'cep', 'logradouro'] }, // Updated cadsus mapping
            fotorj: { basic: ['cpf', 'nome', 'data_nascimento'], medium: ['cpf', 'nome', 'data_nascimento', 'nome_mae', 'rg', 'foto_base64'] },
            veiculos: { 
                basic: ['placa', 'marca_modelo', 'ano_fabricacao', 'ano_modelo', 'cor_veiculo', 'municipio', 'uf_placa'], 
                medium: ['placa', 'chassi', 'marca_modelo', 'ano_fabricacao', 'ano_modelo', 'cor_veiculo', 'municipio', 'uf_placa', 'combustivel', 'potencia', 'cilindradas', 'motor', 'situacao_veiculo', 'restricao_1'] 
            },
            telefonetim: { basic: ['DOC', 'NOME', 'DDD', 'TEL'], medium: ['DOC', 'NOME', 'DDD', 'TEL', 'LOGRAD', 'NUM', 'BAIRRO', 'CIDADE', 'UF', 'CEP'] },
            credilink: { basic: ['CPF', 'NOME', 'CEP', 'CIDADE'], medium: ['CPF', 'NOME', 'LOGRADOURO', 'NUMERO', 'BAIRRO', 'CIDADE', 'UF', 'CEP', 'DT_NASCIMENTO', 'NOME_MAE', 'TELEFONES'] },
            telefoneclaro: { basic: ['cpf', 'nome', 'ddd', 'fone'], medium: ['cpf', 'nome', 'pessoa', 'ddd', 'fone'] },
            dbcpfsimples: { basic: ['cpf', 'nome_completo'], medium: ['cpf', 'nome_completo', 'sexo_genero', 'data_nascimento'] }
        };
    }

    // Helper to filter data based on level
    _filterData(data, level, dbName) { // Changed 'mapping' to 'dbName'
        if (!data) return null;
        if (level === 'advanced') return data;
        const mapping = this.mappings[dbName]; // Use class-level mappings
        if (!mapping) return data; // Return full data if no mapping defined

        let filteredData = {};
        const fieldsToInclude = level === 'basic' ? mapping.basic : mapping.medium;

        for (const field of fieldsToInclude) {
            if (data.hasOwnProperty(field)) {
                filteredData[field] = data[field];
            }
        }
        return Object.keys(filteredData).length > 0 ? filteredData : null;
    }

    _normalizeCpf(cpf) {
        return cpf ? cpf.replace(/\D/g, '') : null;
    }

    _normalizePhone(phone) {
        return phone ? phone.replace(/\D/g, '') : null;
    }

    // =========================================================
    // Search by Name or CPF
    // =========================================================
    async searchByNameOrCpf(query, level = 'basic') {
        const queryPromises = {};
        const normalizedQuery = query.toUpperCase();

        const isCpf = /^\d{11}$/.test(this._normalizeCpf(query));

        if (isCpf) {
            const cpf = this._normalizeCpf(query);
            queryPromises.contatos = this.dbs.contatos.findByCpf(cpf);
            queryPromises.credilink = this.dbs.credilink.findByCpf(cpf);
            queryPromises.telefonetim = this.dbs.telefonetim.findByCpf(cpf);
            queryPromises.telefoneclaro = this.dbs.telefoneclaro.findByCpf(cpf);
            queryPromises.dbcpfsimples = this.dbs.dbcpfsimples.findByCpf(cpf);
            queryPromises.cadsus = this.dbs.cadsus.findByCpf(cpf);
            queryPromises.fotorj = this.dbs.fotorj.findByCpfWithPhoto(cpf);
            queryPromises.scores = this.dbs.scores.findByCpf(cpf);
        } else { // This is the name search part
            queryPromises.credilink = this.dbs.credilink.findByName(normalizedQuery);
        }

        const dbNames = Object.keys(queryPromises);
        const rawResults = await Promise.all(Object.values(queryPromises));
        const results = {};
        dbNames.forEach((dbName, index) => {
            results[dbName] = rawResults[index];
        });
        
        const aggregatedResults = {};
        for (const dbName in results) {
            if (results[dbName]) {
                const dbResults = Array.isArray(results[dbName]) ? results[dbName] : [results[dbName]];
                aggregatedResults[dbName] = dbResults
                    .map(item => this._filterData(item, level, dbName)) // Pass dbName for mapping
                    .filter(item => item !== null);
            }
        }
        return aggregatedResults;
    }

    // =========================================================
    // Search by Phone
    // =========================================================
    async searchByPhone(fullPhone, level = 'basic') {
        const queryPromises = {};
        const normalizedPhone = this._normalizePhone(fullPhone);

        if (!normalizedPhone || normalizedPhone.length < 8) {
            throw new Error('Número de telefone inválido.');
        }

        let ddd = normalizedPhone.substring(0, 2);
        let phone = normalizedPhone.substring(2);

            queryPromises.telefonetim = this.dbs.telefonetim.findByPhone(ddd, phone);
            queryPromises.telefoneclaro = this.dbs.telefoneclaro.findByPhone(ddd, phone);
            queryPromises.credilink = this.dbs.credilink.findByPhone(normalizedPhone);        
        const dbNames = Object.keys(queryPromises);
        const rawResults = await Promise.all(Object.values(queryPromises));
        const results = {};
        dbNames.forEach((dbName, index) => {
            results[dbName] = rawResults[index];
        });

        const aggregatedResults = {};
        for (const dbName in results) {
            if (results[dbName]) {
                let dbResults = Array.isArray(results[dbName]) ? results[dbName] : [results[dbName]];

                // Special handling for credilink phone search: get full details from credilink_basic
                if (dbName === 'credilink') {
                    const fullCredilinkDetails = [];
                    for (const phoneResult of dbResults) {
                        if (phoneResult.CPF) {
                            const cpfDetails = await this.dbs.credilink.findByCpf(phoneResult.CPF);
                            if (cpfDetails) {
                                // Ensure cpfDetails is an array if findByCpf can return multiple or single
                                const cpfDetailsArray = Array.isArray(cpfDetails) ? cpfDetails : [cpfDetails];
                                for (const detail of cpfDetailsArray) {
                                    fullCredilinkDetails.push({ ...detail, TELEFONES: phoneResult.TELEFONES }); // Include phone
                                }
                            }
                        }
                    }
                    dbResults = fullCredilinkDetails;
                }

                aggregatedResults[dbName] = dbResults
                    .map(item => this._filterData(item, level, dbName))
                    .filter(item => item !== null);
            }
        }
        return aggregatedResults;
    }

    // =========================================================
    // Search by CEP
    // =========================================================
    async searchByCep(cep, level = 'basic') {
        const queryPromises = {};
        const normalizedCep = cep ? cep.replace(/\D/g, '') : null;

        if (!normalizedCep || normalizedCep.length !== 8) {
            throw new Error('CEP inválido.');
        }

        queryPromises.credilink = this.dbs.credilink.findByCep(normalizedCep);
        
        const dbNames = Object.keys(queryPromises);
        const rawResults = await Promise.all(Object.values(queryPromises));
        const results = {};
        dbNames.forEach((dbName, index) => {
            results[dbName] = rawResults[index];
        });

        const aggregatedResults = {};
        for (const dbName in results) {
            if (results[dbName]) {
                const dbResults = Array.isArray(results[dbName]) ? results[dbName] : [results[dbName]];
                aggregatedResults[dbName] = dbResults
                    .map(item => this._filterData(item, level, dbName))
                    .filter(item => item !== null);
            }
        }
        return aggregatedResults;
    }

    // =========================================================
    // Search by CPF
    // =========================================================
    async searchByCpf(cpf, level = 'basic') {
        const queryPromises = {};
        const normalizedCpf = this._normalizeCpf(cpf);

        if (!normalizedCpf || normalizedCpf.length !== 11) {
            throw new Error('CPF inválido.');
        }

        queryPromises.contatos = this.dbs.contatos.findByCpf(normalizedCpf);
        queryPromises.credilink = this.dbs.credilink.findByCpf(normalizedCpf);
        queryPromises.telefonetim = this.dbs.telefonetim.findByCpf(normalizedCpf);
        queryPromises.telefoneclaro = this.dbs.telefoneclaro.findByCpf(normalizedCpf);
        queryPromises.dbcpfsimples = this.dbs.dbcpfsimples.findByCpf(normalizedCpf);
        queryPromises.cadsus = this.dbs.cadsus.findByCpf(normalizedCpf);
        queryPromises.fotorj = this.dbs.fotorj.findByCpf(normalizedCpf);
        queryPromises.scores = this.dbs.scores.findByCpf(normalizedCpf);
        
        const dbNames = Object.keys(queryPromises);
        const rawResults = await Promise.all(Object.values(queryPromises));
        const results = {};
        dbNames.forEach((dbName, index) => {
            results[dbName] = rawResults[index];
        });

        const aggregatedResults = {};
        for (const dbName in results) {
            if (results[dbName]) {
                const dbResults = Array.isArray(results[dbName]) ? results[dbName] : [results[dbName]];
                aggregatedResults[dbName] = dbResults
                    .map(item => this._filterData(item, level, dbName))
                    .filter(item => item !== null);
            }
        }
        return aggregatedResults;
    }

    async searchByPlaca(placa, level = 'basic') {
        const queryPromises = {};
        const normalizedPlaca = placa.toUpperCase();

        queryPromises.veiculos = this.dbs.veiculos.findByPlaca(normalizedPlaca);
        
        const dbNames = Object.keys(queryPromises);
        const rawResults = await Promise.all(Object.values(queryPromises));
        const results = {};
        dbNames.forEach((dbName, index) => {
            results[dbName] = rawResults[index];
        });

        const aggregatedResults = {};
        if (results.veiculos) {
            const dbResults = Array.isArray(results.veiculos) ? results.veiculos : [results.veiculos];
            aggregatedResults.veiculos = dbResults
                .map(item => this.referenceService.enrichVehicleData(item)) // Enrich the data
                .map(item => this._filterData(item, level, 'veiculos')) // Pass dbName for mapping
                .filter(item => item !== null);
        }
        return aggregatedResults;
    }

    async searchByPlacaAntiga(placa, level = 'basic') {
        const queryPromises = {};
        const normalizedPlaca = placa.toUpperCase();

        queryPromises.veiculos = this.dbs.veiculos.findByPlacaAntiga(normalizedPlaca);
        
        const dbNames = Object.keys(queryPromises);
        const rawResults = await Promise.all(Object.values(queryPromises));
        const results = {};
        dbNames.forEach((dbName, index) => {
            results[dbName] = rawResults[index];
        });
        
        const aggregatedResults = {};
        if (results.veiculos) {
            const dbResults = Array.isArray(results.veiculos) ? results.veiculos : [results.veiculos];
            aggregatedResults.veiculos = dbResults
                .map(item => this.referenceService.enrichVehicleData(item)) // Enrich the data
                .map(item => this._filterData(item, level, 'veiculos')) // Pass dbName for mapping
                .filter(item => item !== null);
        }
        return aggregatedResults;
    }

    async searchByPlacaNova(placa, level = 'basic') {
        const queryPromises = {};
        const normalizedPlaca = placa.toUpperCase();

        queryPromises.veiculos = this.dbs.veiculos.findByPlacaNova(normalizedPlaca);
        
        const dbNames = Object.keys(queryPromises);
        const rawResults = await Promise.all(Object.values(queryPromises));
        const results = {};
        dbNames.forEach((dbName, index) => {
            results[dbName] = rawResults[index];
        });
        
        const aggregatedResults = {};
        if (results.veiculos) {
            const dbResults = Array.isArray(results.veiculos) ? results.veiculos : [results[dbName]];
            aggregatedResults.veiculos = dbResults
                .map(item => this.referenceService.enrichVehicleData(item)) // Enrich the data
                .map(item => this._filterData(item, level, 'veiculos')) // Pass dbName for mapping
                .filter(item => item !== null);
        }
        return aggregatedResults;
    }

    async searchByChassi(chassi, level = 'basic') {
        const queryPromises = {};
        const normalizedChassi = chassi.toUpperCase();

        queryPromises.veiculos = this.dbs.veiculos.findByChassi(normalizedChassi);
        
        const dbNames = Object.keys(queryPromises);
        const rawResults = await Promise.all(Object.values(queryPromises));
        const results = {};
        dbNames.forEach((dbName, index) => {
            results[dbName] = rawResults[index];
        });
        
        const aggregatedResults = {};
        if (results.veiculos) {
            const dbResults = Array.isArray(results.veiculos) ? results.veiculos : [results.veiculos];
            aggregatedResults.veiculos = dbResults
                .map(item => this.referenceService.enrichVehicleData(item)) // Enrich the data
                .map(item => this._filterData(item, level, 'veiculos')) // Pass dbName for mapping
                .filter(item => item !== null);
        }
        return aggregatedResults;
    }

    // =========================================================
    // Search by Mother's Name
    // =========================================================
    async searchByMae(mae, level = 'basic') {
        const queryPromises = {};
        const normalizedMae = mae.toUpperCase();

        queryPromises.cadsus = this.dbs.cadsus.findByMae(normalizedMae);
        queryPromises.fotorj = this.dbs.fotorj.findByMae(normalizedMae);
        queryPromises.credilink = this.dbs.credilink.findByMae(normalizedMae);

        const dbNames = Object.keys(queryPromises);
        const rawResults = await Promise.all(Object.values(queryPromises));
        const results = {};
        dbNames.forEach((dbName, index) => {
            results[dbName] = rawResults[index];
        });

        const aggregatedResults = {};
        for (const dbName in results) {
            if (results[dbName]) {
                const dbResults = Array.isArray(results[dbName]) ? results[dbName] : [results[dbName]];
                aggregatedResults[dbName] = dbResults
                    .map(item => this._filterData(item, level, dbName)) // Pass dbName for mapping
                    .filter(item => item !== null);
            }
        }
        return aggregatedResults;
    }
    
    // =========================================================
    // Search by RG
    // =========================================================
    async searchByRg(rg, level = 'basic') {
        const queryPromises = {};
        const normalizedRg = rg.replace(/\D/g, '');

        queryPromises.cadsus = this.dbs.cadsus.findByRg(normalizedRg);
        queryPromises.fotorj = this.dbs.fotorj.findByRg(normalizedRg);

        const dbNames = Object.keys(queryPromises);
        const rawResults = await Promise.all(Object.values(queryPromises));
        const results = {};
        dbNames.forEach((dbName, index) => {
            results[dbName] = rawResults[index];
        });

        const aggregatedResults = {};
        for (const dbName in results) {
            if (results[dbName]) {
                const dbResults = Array.isArray(results[dbName]) ? results[dbName] : [results[dbName]];
                aggregatedResults[dbName] = dbResults
                    .map(item => this._filterData(item, level, dbName)) // Pass dbName for mapping
                    .filter(item => item !== null);
            }
        }
        return aggregatedResults;
    }

    // =========================================================
    // Search Photo by CPF
    // =========================================================
    async searchPhotoByCpf(cpf, level = 'basic') {
        const queryPromises = {};
        const normalizedCpf = this._normalizeCpf(cpf);

        if (!normalizedCpf || normalizedCpf.length !== 11) {
            throw new Error('CPF inválido.');
        }

        queryPromises.fotorj = this.dbs.fotorj.findByCpfWithPhoto(normalizedCpf);

        const dbNames = Object.keys(queryPromises);
        const rawResults = await Promise.all(Object.values(queryPromises));
        const results = {};
        dbNames.forEach((dbName, index) => {
            results[dbName] = rawResults[index];
        });

        const aggregatedResults = {};
        if (results.fotorj) {
            const dbResults = Array.isArray(results.fotorj) ? results.fotorj : [results.fotorj];
            aggregatedResults.fotorj = dbResults
                .map(item => this._filterData(item, level, 'fotorj')) // Pass dbName for mapping
                .filter(item => item !== null);
        }
        return aggregatedResults;
    }

    // =========================================================
    // Search Score by CPF
    // =========================================================
    async searchScoreByCpf(cpf, level = 'basic') {
        const queryPromises = {};
        const normalizedCpf = this._normalizeCpf(cpf);

        if (!normalizedCpf || normalizedCpf.length !== 11) {
            throw new Error('CPF inválido.');
        }

        queryPromises.scores = this.dbs.scores.findByCpf(normalizedCpf);

        const dbNames = Object.keys(queryPromises);
        const rawResults = await Promise.all(Object.values(queryPromises));
        const results = {};
        dbNames.forEach((dbName, index) => {
            results[dbName] = rawResults[index];
        });

        const aggregatedResults = {};
        if (results.scores) {
            const dbResults = Array.isArray(results.scores) ? results.scores : [results.scores];
            aggregatedResults.scores = dbResults
                .map(item => this._filterData(item, level, 'scores')) // Pass dbName for mapping
                .filter(item => item !== null);
        }
        return aggregatedResults;
    }

    // =========================================================
    // Familiares Irmãos (Complex: requires mother's name)
    // =========================================================
    async searchFamiliaresIrmaos(mae, level = 'basic') {
        const queryPromises = {};
        const normalizedMae = mae.toUpperCase();

        queryPromises.cadsus = this.dbs.cadsus.findByMae(normalizedMae);
        queryPromises.fotorj = this.dbs.fotorj.findByMae(normalizedMae);
        queryPromises.credilink = this.dbs.credilink.findByMae(normalizedMae);

        const dbNames = Object.keys(queryPromises);
        const rawResults = await Promise.all(Object.values(queryPromises));
        const results = {};
        dbNames.forEach((dbName, index) => {
            results[dbName] = rawResults[index];
        });

        const aggregatedResults = {};
        for (const dbName in results) {
            if (results[dbName]) {
                const dbResults = Array.isArray(results[dbName]) ? results[dbName] : [results[dbName]];
                aggregatedResults[dbName] = dbResults
                    .map(item => this._filterData(item, level, dbName)) // Pass dbName for mapping
                    .filter(item => item !== null);
            }
        }
        return aggregatedResults;
    }
}

module.exports = SearchService;