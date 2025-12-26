module.exports = (searchController, authMiddleware, authService) => {
    return async function searchRoutes(fastify) {

        // Apply API Key authentication to all search routes
        fastify.addHook('preHandler', authMiddleware.apiKeyAuth);

        // GET /search/nome/:search: Pesquisa por nome ou CPF.
        fastify.get('/search/nome/:search', searchController.searchNome.bind(searchController));

        // GET /search/telefone/:telefone: Pesquisa por número de telefone.
        fastify.get('/search/telefone/:telefone', searchController.searchTelefone.bind(searchController));

        // GET /search/cep/:cep: Pesquisa por CEP.
        fastify.get('/search/cep/:cep', searchController.searchCep.bind(searchController));

        // GET /search/cpf/:cpf: Pesquisa por CPF.
        fastify.get('/search/cpf/:cpf', searchController.searchCpf.bind(searchController));

        // GET /search/placa/:placa: Pesquisa por placa de veículo.
        fastify.get('/search/placa/:placa', searchController.searchPlaca.bind(searchController));
        
        // GET /search/placa_antiga/:placa: Pesquisa por placa no modelo antigo.
        fastify.get('/search/placa_antiga/:placa', searchController.searchPlacaAntiga.bind(searchController));
        
        // GET /search/placa_nova/:placa: Pesquisa por placa no modelo novo.
        fastify.get('/search/placa_nova/:placa', searchController.searchPlacaNova.bind(searchController));

        // GET /search/chassi/:chassi: Pesquisa por número de chassi.
        fastify.get('/search/chassi/:chassi', searchController.searchChassi.bind(searchController));

        // GET /search/mae/:mae: Pesquisa por nome da mãe.
        fastify.get('/search/mae/:mae', searchController.searchMae.bind(searchController));

        // GET /search/score/cpf/:cpf: Pesquisa scores por CPF.
        fastify.get('/search/score/cpf/:cpf', searchController.searchScoreCpf.bind(searchController));

        // GET /search/rg/:rg: Pesquisa por RG .
        fastify.get('/search/rg/:rg', searchController.searchRg.bind(searchController));

        // GET /search/foto/cpf/:cpf: Pesquisa foto por CPF.
        fastify.get('/search/foto/cpf/:cpf', searchController.searchFotoCpf.bind(searchController));

        // GET /familiares/irmaos/:mae: Encontra irmãos com base no nome da mãe
        fastify.get('/familiares/irmaos/:mae', searchController.searchFamiliaresIrmaos.bind(searchController));
    }
}