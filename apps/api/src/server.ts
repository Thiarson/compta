import closeWithGrace from 'close-with-grace';
import buildServer from './app.js';

const server = await buildServer();

// Basic liveness check
server.get('/healthz', () => {
  return {
    status: 'ok',
    uptime: process.uptime(),
  };
});

closeWithGrace({ delay: 500 }, async function ({ signal, err }) {
  if (err) {
    server.log.error({ err }, 'server closing with error');
  } else {
    server.log.info(`${signal} received, server closing`);
  }

  await server.close();
});

const port = Number(server.config.PORT);

server.listen({ port: port }, function (err) {
  if (err) {
    server.log.error(err);
    process.exit(1);
  }
});
