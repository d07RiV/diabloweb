// Webpack loader used by the single-file build in place of worker-loader.
//
// `import Worker from './game.worker.js'` normally hands webpack a separate
// chunk to emit as its own file. Here the worker has already been compiled by
// an earlier webpack pass (see scripts/build-single-html.js); this loader
// reads that output and turns the import into a factory that builds the worker
// from the inlined source (real Worker, or the main-thread fallback).
'use strict';

const fs = require('fs');
const path = require('path');

function asStringLiteral(text) {
  return JSON.stringify(text)
    // U+2028/U+2029 are legal in JSON but not in JS string literals (pre-ES2019)
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}

module.exports = function inlineWorker() {
  if (this.cacheable) {
    this.cacheable();
  }
  const options = typeof this.query === 'object' && this.query !== null ? this.query : {};
  if (!options.workerDir) {
    throw new Error('worker-inline-loader: missing "workerDir" option');
  }
  const name = path.basename(this.resourcePath);
  const built = path.join(options.workerDir, name);
  if (!fs.existsSync(built)) {
    throw new Error(`worker-inline-loader: ${built} not found - build the workers first`);
  }
  this.addDependency(built);
  const code = fs.readFileSync(built, 'utf8');
  const helper = path.join(__dirname, 'create-worker.js');
  return [
    `var factory = require(${JSON.stringify(helper)}).createWorkerFactory;`,
    `module.exports = factory(${asStringLiteral(code)});`,
    '',
  ].join('\n');
};
