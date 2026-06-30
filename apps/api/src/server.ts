import http from 'http';

const server = http.createServer();

server.listen(8000, () => {
  console.log(`Api listening on port 8000`);
});
