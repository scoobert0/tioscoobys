const fp = require('fastify-plugin');
const session = require('@fastify/session');

async function sessionPlugin(fastify, opts) {
  fastify.register(session, {
    secret: opts.secret || 'dev-session-secret',
    saveUninitialized: false,
    cookie: {
      secure: false,          // TRUE só com HTTPS real
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      maxAge: 1000 * 60 * 60 * 24, // 1 dia
    },
  });
}

module.exports = fp(sessionPlugin);
