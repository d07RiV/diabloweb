#!/usr/bin/env node
'use strict';

// Tiny static server for the single-file build.
//
// The HTML document runs straight from disk, but serving it over http:// is
// nicer: real web workers are used (instead of the main-thread fallback), and
// IndexedDB (save games) behaves normally.
//
//   node scripts/serve-dist.js [directory] [port]

const fs = require('fs');
const http = require('http');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');
const args = process.argv.slice(2);
const distDir = path.resolve(args[0] ? path.resolve(rootDir, args[0]) : path.join(rootDir, 'dist'));
const port = parseInt(args[1] || process.env.PORT || '8000', 10);
const host = process.env.HOST || '0.0.0.0';

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.ico': 'image/x-icon',
  '.png': 'image/png',
  '.mpq': 'application/octet-stream',
  '.wasm': 'application/wasm',
};

function pickIndex() {
  for (const name of ['diabloweb.html', 'index.html']) {
    if (fs.existsSync(path.join(distDir, name))) {
      return name;
    }
  }
  const files = fs.readdirSync(distDir).filter(name => name.endsWith('.html'));
  return files[0] || null;
}

if (!fs.existsSync(distDir)) {
  process.stderr.write(`${distDir} does not exist - run "npm run build:single" first.\n`);
  process.exit(1);
}

const server = http.createServer((request, response) => {
  let pathname;
  try {
    pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
  } catch (e) {
    response.writeHead(400).end('Bad request');
    return;
  }
  if (pathname === '/') {
    const index = pickIndex();
    if (!index) {
      response.writeHead(404, {'Content-Type': 'text/plain'}).end('Nothing to serve - build the single file first.');
      return;
    }
    pathname = `/${index}`;
  }
  const file = path.join(distDir, path.normalize(pathname));
  if (!file.startsWith(distDir) || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
    response.writeHead(404, {'Content-Type': 'text/plain'}).end('Not found');
    return;
  }
  response.writeHead(200, {
    'Content-Type': TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream',
    'Content-Length': fs.statSync(file).size,
    'Cache-Control': 'no-store',
  });
  if (request.method === 'HEAD') {
    response.end();
    return;
  }
  fs.createReadStream(file).pipe(response);
});

server.listen(port, host, () => {
  process.stdout.write(`Serving ${distDir} on http://${host}:${port}/\n`);
});
