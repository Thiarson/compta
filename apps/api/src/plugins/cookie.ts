import fp from 'fastify-plugin';
import cookie from '@fastify/cookie';

export default fp(async function cookiePlugin(app) {
  await app.register(cookie);
});
