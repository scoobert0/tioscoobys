class SearchController {
    constructor(searchService, logger) {
        this.searchService = searchService;
        this.logger = logger;
    }

    _handleError(reply, error, reqId) {
        this.logger.error({
            reqId,
            error_message: error.message,
            error_stack: error.stack
        }, 'Search API Error');
        reply.status(500).send({
            success: false,
            error: error.message || 'Internal Server Error',
            details: error.stack || (error.message ? error.message : 'No specific error details available.')
        });
    }

    _sendResponse(reply, data, reqId) {
        if (!data || Object.keys(data).every(db => data[db].length === 0)) {
            this.logger.info({ reqId }, 'No results found');
            reply.status(404).send({ success: false, message: 'No results found', data: {} });
        } else {
            this.logger.info({ reqId, data_length: JSON.stringify(data).length }, 'Search successful');
            reply.send({ success: true, data: data });
        }
    }

    // GET /search/nome/:search
    async searchNome(request, reply) {
        const { search } = request.params;
        const { level } = request.query; // 'basic', 'medium', 'advanced'
        try {
            const decodedSearch = decodeURIComponent(search);
            const results = await this.searchService.searchByNameOrCpf(decodedSearch, level);
            this._sendResponse(reply, results, request.id);
        } catch (error) {
            this._handleError(reply, error, request.id);
        }
    }

    // GET /search/telefone/:telefone
    async searchTelefone(request, reply) {
        const { telefone } = request.params;
        const { level } = request.query;
        try {
            const results = await this.searchService.searchByPhone(telefone, level);
            this._sendResponse(reply, results, request.id);
        } catch (error) {
            this._handleError(reply, error, request.id);
        }
    }

    // GET /search/cep/:cep
    async searchCep(request, reply) {
        const { cep } = request.params;
        const { level } = request.query;
        try {
            const results = await this.searchService.searchByCep(cep, level);
            this._sendResponse(reply, results, request.id);
        } catch (error) {
            this._handleError(reply, error, request.id);
        }
    }

    // GET /search/cpf/:cpf
    async searchCpf(request, reply) {
        const { cpf } = request.params;
        const { level } = request.query;
        try {
            const results = await this.searchService.searchByCpf(cpf, level);
            this._sendResponse(reply, results, request.id);
        } catch (error) {
            this._handleError(reply, error, request.id);
        }
    }

    // GET /search/placa/:placa
    async searchPlaca(request, reply) {
        const { placa } = request.params;
        const { level } = request.query;
        try {
            const results = await this.searchService.searchByPlaca(placa, level);
            this._sendResponse(reply, results, request.id);
        } catch (error) {
            this._handleError(reply, error, request.id);
        }
    }

    // GET /search/placa_antiga/:placa
    async searchPlacaAntiga(request, reply) {
        const { placa } = request.params;
        const { level } = request.query;
        try {
            const results = await this.searchService.searchByPlacaAntiga(placa, level);
            this._sendResponse(reply, results, request.id);
        } catch (error) {
            this._handleError(reply, error, request.id);
        }
    }

    // GET /search/placa_nova/:placa
    async searchPlacaNova(request, reply) {
        const { placa } = request.params;
        const { level } = request.query;
        try {
            const results = await this.searchService.searchByPlacaNova(placa, level);
            this._sendResponse(reply, results, request.id);
        } catch (error) {
            this._handleError(reply, error, request.id);
        }
    }

    // GET /search/chassi/:chassi
    async searchChassi(request, reply) {
        const { chassi } = request.params;
        const { level } = request.query;
        try {
            const results = await this.searchService.searchByChassi(chassi, level);
            this._sendResponse(reply, results, request.id);
        } catch (error) {
            this._handleError(reply, error, request.id);
        }
    }

    // GET /search/mae/:mae
    async searchMae(request, reply) {
        const { mae } = request.params;
        const { level } = request.query;
        try {
            const results = await this.searchService.searchByMae(mae, level);
            this._sendResponse(reply, results, request.id);
        } catch (error) {
            this._handleError(reply, error, request.id);
        }
    }

    // GET /search/score/cpf/:cpf
    async searchScoreCpf(request, reply) {
        const { cpf } = request.params;
        const { level } = request.query;
        try {
            const results = await this.searchService.searchScoreByCpf(cpf, level);
            this._sendResponse(reply, results, request.id);
        } catch (error) {
            this._handleError(reply, error, request.id);
        }
    }

    // GET /search/rg/:rg
    async searchRg(request, reply) {
        const { rg } = request.params;
        const { level } = request.query;
        try {
            const results = await this.searchService.searchByRg(rg, level);
            this._sendResponse(reply, results, request.id);
        } catch (error) {
            this._handleError(reply, error, request.id);
        }
    }

    // GET /search/foto/cpf/:cpf
    async searchFotoCpf(request, reply) {
        const { cpf } = request.params;
        const { level } = request.query;
        try {
            const results = await this.searchService.searchPhotoByCpf(cpf, level);
            this._sendResponse(reply, results, request.id);
        } catch (error) {
            this._handleError(reply, error, request.id);
        }
    }

    // GET /familiares/irmaos/:mae
    async searchFamiliaresIrmaos(request, reply) {
        const { mae } = request.params;
        const { level } = request.query;
        try {
            const results = await this.searchService.searchFamiliaresIrmaos(mae, level);
            this._sendResponse(reply, results, request.id);
        } catch (error) {
            this._handleError(reply, error, request.id);
        }
    }
}

module.exports = SearchController;