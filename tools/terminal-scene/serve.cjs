const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '../../app/src/main/assets/terminal');
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.txt': 'text/plain' };
const server = http.createServer((req, res) => {
  const pathname = new URL(req.url, 'http://localhost').pathname;
  const name = pathname === '/' ? '/index.html' : pathname;
  const file = path.resolve(root, '.' + name);
  if (!file.startsWith(root + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
    res.writeHead(404).end(); return;
  }
  res.writeHead(200, { 'Content-Type': mime[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
  fs.createReadStream(file).pipe(res);
});
const port = Number(process.env.PORT || 4317);
server.listen(port, '127.0.0.1', () => console.log(`Terminal scene: http://127.0.0.1:${port}/`));
