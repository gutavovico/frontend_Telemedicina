import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, resolve, sep } from 'node:path';

const root = resolve('dist/frontend_Telemedicina/browser');
const types = {
  '.css': 'text/css',
  '.html': 'text/html',
  '.ico': 'image/x-icon',
  '.js': 'text/javascript',
  '.json': 'application/json',
  '.mjs': 'text/javascript',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};

const server = createServer(async (request, response) => {
  try {
    const pathname = decodeURIComponent(new URL(request.url, 'http://127.0.0.1').pathname);
    const file = resolve(root, `.${pathname}`);
    if (file !== root && !file.startsWith(root + sep)) {
      response.writeHead(403).end();
      return;
    }

    let target = file;
    try {
      if (!(await stat(target)).isFile()) target = resolve(root, 'index.html');
    } catch {
      if (extname(pathname)) {
        response.writeHead(404).end();
        return;
      }
      target = resolve(root, 'index.html');
    }

    response.writeHead(200, { 'Content-Type': types[extname(target)] ?? 'application/octet-stream' });
    if (request.method !== 'HEAD') response.end(await readFile(target));
    else response.end();
  } catch (error) {
    console.error(error);
    response.writeHead(500).end();
  }
});

server.listen(4200, '127.0.0.1', () => {
  console.log(`Cypress server ready at http://127.0.0.1:4200 (root: ${root})`);
});
