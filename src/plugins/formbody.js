const fp = require('fastify-plugin');
const formBody = require('@fastify/formbody');

async function formBodyPlugin(fastify, opts) {
  fastify.register(formBody);
}

module.exports = fp(formBodyPlugin);
