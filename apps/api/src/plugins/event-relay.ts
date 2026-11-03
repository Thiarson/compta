import fp from 'fastify-plugin';
import { startEventRelay } from '../workers/event.relay.js';

export default fp(async function eventRelayPlugin(app) {
  startEventRelay(app);
});
