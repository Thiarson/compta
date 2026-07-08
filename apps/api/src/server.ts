import closeWithGrace from 'close-with-grace';
import buildServer from './app.js';

const server = await buildServer();

closeWithGrace({ delay: 500 }, async function ({ signal, err }) {
  if (err) {
    server.log.error({ err }, 'server closing with error');
  } else {
    server.log.info(`${signal} received, server closing`);
  }

  await server.close();
});

const port = Number(server.config.PORT);
const host = server.config.HOST;

server.listen({ port, host }, function (err) {
  if (err) {
    server.log.error(err);
    process.exit(1);
  }
});
