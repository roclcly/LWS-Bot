const http = require('http');

const port = Number(process.env.PORT || 10000);

const server = http.createServer((request, response) => {
  response.writeHead(200, { 'content-type': 'text/plain; charset=utf-8' });
  response.end('State 4500 Discord bot is running.\n');
});

server.listen(port, '0.0.0.0', () => {
  console.log(`[render] health server listening on ${port}`);
  require('./state-verify-bot');
});
