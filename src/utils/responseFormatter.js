/**
 * responseFormatter.js
 * --------------------------------------------------
 * Padroniza TODAS as respostas da API.
 * Sucesso é sucesso, erro é erro — sem gambiarra.
 * --------------------------------------------------
 */

/**
 * Formata resposta de sucesso
 *
 * @param {Object} params
 * @param {string} params.query               Valor pesquisado
 * @param {Array}  params.results             Resultados retornados
 * @param {boolean} params.cached             Veio do cache ou não
 * @param {number} params.executionTimeMs     Tempo de execução em ms
 * @returns {Object}
 */
function formatSuccess({ query, results = [], cached = false, executionTimeMs = 0 }) {
  return {
    success: true,
    query,
    results,
    count: Array.isArray(results) ? results.length : 0,
    cached,
    execution_time_ms: Math.round(executionTimeMs),
  };
}

/**
 * Formata resposta de erro
 *
 * @param {Object} params
 * @param {string} params.message             Mensagem de erro
 * @param {number} [params.statusCode=400]    HTTP status
 * @param {string} [params.errorCode]         Código interno opcional
 * @returns {Object}
 */
function formatError({ message = 'Erro desconhecido', statusCode = 400, errorCode }) {
  const payload = {
    success: false,
    error: message,
    code: statusCode,
  };

  if (errorCode) {
    payload.error_code = errorCode;
  }

  return payload;
}

/**
 * Export centralizado
 */
module.exports = {
  formatSuccess,
  formatError,
};
