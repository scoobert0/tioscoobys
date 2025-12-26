const fp = require('fastify-plugin');
const path = require('path');
const pointOfView = require('point-of-view');
const ejs = require('ejs');

async function viewEnginePlugin(fastify, opts) {
  fastify.register(pointOfView, {
    engine: { ejs },
    root: path.join(__dirname, '..', 'panel', 'views'),
    viewExt: 'ejs',
  });
}

module.exports = fp(viewEnginePlugin);
