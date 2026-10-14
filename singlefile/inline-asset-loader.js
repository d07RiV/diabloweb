// Webpack loader: turns a binary/text asset into a JS module exporting a
// data: URI, so that it can live inside the single HTML document.
'use strict';

const path = require('path');

const MIME = {
  wasm: 'application/octet-stream',
  txt: 'text/plain',
  json: 'application/json',
  svg: 'image/svg+xml',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  ico: 'image/x-icon',
  mpq: 'application/octet-stream',
  mp3: 'audio/mpeg',
  wav: 'audio/wav',
  woff: 'font/woff',
  woff2: 'font/woff2',
  ttf: 'font/ttf',
};

module.exports = function inlineAsset(content) {
  if (this.cacheable) {
    this.cacheable();
  }
  const ext = path.extname(this.resourcePath).slice(1).toLowerCase();
  const mime = MIME[ext] || 'application/octet-stream';
  const base64 = Buffer.from(content).toString('base64');
  return `module.exports = "data:${mime};base64,${base64}";\n`;
};

module.exports.raw = true;
