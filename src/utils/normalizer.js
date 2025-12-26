/**
 * normalizer.js
 * --------------------------------------------------
 * Centraliza todas as funções de normalização usadas
 * em buscas, cache, banco e APIs.
 * Sem mágica, só limpeza de dados bem feita.
 * --------------------------------------------------
 */

/**
 * Normaliza strings:
 * - Remove acentos
 * - Converte para uppercase
 * - Evita erro com input zoado
 *
 * @param {string} str
 * @returns {string}
 */
function normalizeString(str) {
  if (!str || typeof str !== 'string') return '';

  return str
    .trim()
    .normalize('NFD')                 // separa acento da letra
    .replace(/[\u0300-\u036f]/g, '')  // remove acentos
    .toUpperCase();
}

/**
 * Normaliza CPF:
 * - Remove tudo que não for número
 *
 * @param {string} cpf
 * @returns {string}
 */
function normalizeCpf(cpf) {
  if (!cpf || typeof cpf !== 'string') return '';
  return cpf.replace(/\D/g, '');
}

/**
 * Normaliza telefone:
 * - Remove tudo que não for número
 * - Serve pra celular, fixo, TIM, Claro, o caos inteiro
 *
 * @param {string} phone
 * @returns {string}
 */
function normalizePhone(phone) {
  if (!phone || typeof phone !== 'string') return '';
  return phone.replace(/\D/g, '');
}

/**
 * Exporta tudo centralizado
 */
module.exports = {
  normalizeString,
  normalizeCpf,
  normalizePhone,
};
