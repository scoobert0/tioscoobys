const fp = require('fastify-plugin');
const rateLimit = require('@fastify/rate-limit');
const config = require('../config');

async function rateLimitPlugin(fastify, opts) {
  fastify.register(rateLimit, config.security.rateLimit);
}

module.exports = fp(rateLimitPlugin);
