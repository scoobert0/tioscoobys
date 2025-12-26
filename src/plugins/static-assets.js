const fp = require('fastify-plugin');
const path = require('path');
const fastifyStatic = require('@fastify/static');

async function staticAssetsPlugin(fastify, opts) {
  fastify.register(fastifyStatic, {
    root: path.join(__dirname, '..', '..', 'public'),
    prefix: '/public/',
    decorateReply: false,
  });
}

module.exports = fp(staticAssetsPlugin);
