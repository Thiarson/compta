import fp from 'fastify-plugin';
import { startEmailWorker } from '../workers/email.worker.js';

export default fp(async function emailWorkerPlugin(app) {
  startEmailWorker(app);
});
