const fp = require('fastify-plugin');
const cookie = require('@fastify/cookie');

async function cookiePlugin(fastify, opts) {
  fastify.register(cookie);
}

module.exports = fp(cookiePlugin);
