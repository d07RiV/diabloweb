#!/usr/bin/env node
'use strict';

// Builds the whole project into ONE self-contained HTML document.
//
//   node scripts/build-single-html.js [--out=<file>] [--public-url=<url>]
//                                     [--embed-spawn[=<path>]] [--keep-tmp]
//
// How it works
//   1. webpack pass #1 compiles src/api/game.worker.js and
//      src/mpqcmp/mpqcmp.worker.js into standalone scripts, with the
//      WebAssembly modules and other assets inlined as data: URIs.
//   2. webpack pass #2 compiles the React app; imports of those workers are
//      replaced by the compiled source from step 1 (singlefile/worker-inline-
//      loader.js), so at runtime they are started from a blob: URL - or, when
//      the page is opened from disk, on the main thread (singlefile/inline-
//      worker.js).
//   3. The resulting JS + CSS + favicon are pasted into singlefile/template.html.
//
// The output needs no server and no extra files. It still needs game data at
// runtime (DIABDAT.MPQ or the shareware spawn.mpq), because those are not part
// of this repository - pass --embed-spawn to bake a local spawn.mpq in.

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');

// webpack 4 hashes with md4, which OpenSSL 3 (Node 17+) rejects. Re-exec once
// with the legacy provider instead of forcing everyone to set NODE_OPTIONS.
function md4Available() {
  try {
    crypto.createHash('md4');
    return true;
  } catch (e) {
    return false;
  }
}
if (!md4Available() && !process.env.DIABLOWEB_SINGLE_FILE_REEXEC) {
  const {spawnSync} = require('child_process');
  const result = spawnSync(
    process.execPath,
    ['--openssl-legacy-provider', '--max-old-space-size=4096', __filename].concat(process.argv.slice(2)),
    {
      stdio: 'inherit',
      cwd: process.cwd(),
      env: Object.assign({}, process.env, {DIABLOWEB_SINGLE_FILE_REEXEC: '1'}),
    }
  );
  process.exit(result.status === null ? 1 : result.status);
}

const webpack = require('webpack');
const {DEFAULT_PUBLIC_URL, workerConfig, appConfig} = require('../config/webpack.singlefile');

const tmpDir = path.join(rootDir, 'build', 'single');
const workerDir = path.join(tmpDir, 'workers');
const appDir = path.join(tmpDir, 'app');

function parseArgs(argv) {
  const options = {
    out: path.join(rootDir, 'dist', 'diabloweb.html'),
    publicUrl: DEFAULT_PUBLIC_URL,
    embedSpawn: false,
    keepTmp: false,
  };
  for (const arg of argv) {
    const eq = arg.indexOf('=');
    const name = eq >= 0 ? arg.slice(0, eq) : arg;
    const value = eq >= 0 ? arg.slice(eq + 1) : null;
    switch (name) {
      case '--out':
      case '-o':
        options.out = path.resolve(rootDir, value || '');
        break;
      case '--public-url':
        options.publicUrl = (value || '').replace(/\/+$/, '');
        break;
      case '--embed-spawn':
        options.embedSpawn = value || true;
        break;
      case '--keep-tmp':
        options.keepTmp = true;
        break;
      case '--help':
      case '-h':
        options.help = true;
        break;
      default:
        throw new Error(`Unknown argument: ${arg}`);
    }
  }
  return options;
}

function help() {
  process.stdout.write(`Usage: node scripts/build-single-html.js [options]

  --out=<file>          output HTML file (default: dist/diabloweb.html)
  --public-url=<url>    where the shareware spawn.mpq is downloaded from at
                        runtime (default: ${DEFAULT_PUBLIC_URL})
  --embed-spawn[=<path>] bake spawn.mpq into the HTML so the shareware version
                        works offline (default path: public/spawn.mpq)
  --keep-tmp            keep the intermediate webpack output in build/single
`);
}

function runWebpack(config) {
  return new Promise((resolve, reject) => {
    const started = Date.now();
    webpack(config, (error, stats) => {
      const seconds = ((Date.now() - started) / 1000).toFixed(1);
      if (error) {
        reject(error);
        return;
      }
      if (stats.hasErrors()) {
        process.stderr.write(`${stats.toString({all: false, errors: true, errorDetails: true, moduleTrace: true})}\n`);
        reject(new Error(`webpack pass "${config.name}" failed`));
        return;
      }
      if (stats.hasWarnings()) {
        process.stderr.write(`${stats.toString({all: false, warnings: true})}\n`);
      }
      process.stdout.write(`  [${config.name}] compiled in ${seconds}s\n`);
      resolve(stats);
    });
  });
}

function readEmbeddedAssets(options) {
  if (!options.embedSpawn) {
    return null;
  }
  const spawnPath = typeof options.embedSpawn === 'string'
    ? path.resolve(rootDir, options.embedSpawn)
    : path.join(rootDir, 'public', 'spawn.mpq');
  if (!fs.existsSync(spawnPath)) {
    throw new Error(`--embed-spawn: ${spawnPath} not found. Put the shareware spawn.mpq there (or pass its path).`);
  }
  const data = fs.readFileSync(spawnPath);
  return {'spawn.mpq': {mime: 'application/octet-stream', base64: data.toString('base64')}};
}

function writeEmbeddedAssets(embedded, workerEmbedded) {
  const appFile = path.join(tmpDir, 'embedded-assets.js');
  const workerFile = path.join(tmpDir, 'embedded-assets-empty.js');
  const toModule = value => `export default ${JSON.stringify(value)};\n`;
  fs.writeFileSync(appFile, toModule(embedded || {}));
  fs.writeFileSync(workerFile, toModule({}));
  return {appFile, workerFile};
}

function toDataUri(file, mime) {
  return `data:${mime};base64,${fs.readFileSync(file).toString('base64')}`;
}

// Inside <script>/<style> the only sequence that can end the element early is
// the matching closing tag; escaping the slash is invisible to JS and CSS.
function escapeForScript(code) {
  const escaped = code.replace(/<\/script/gi, '<\\/script');
  if (escaped !== code) {
    process.stdout.write(`  escaped ${'<'}script sequences inside the JS bundle\n`);
  }
  if (/<!--/.test(escaped)) {
    process.stderr.write('  warning: the bundle contains "<!--", which can confuse HTML script parsing\n');
  }
  return escaped;
}

function escapeForStyle(css) {
  return css.replace(/<\/style/gi, '<\\/style');
}

function formatSize(bytes) {
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    help();
    return;
  }

  process.env.NODE_ENV = 'production';
  process.env.BABEL_ENV = 'production';

  const embedded = readEmbeddedAssets(options);
  if (embedded) {
    const names = Object.keys(embedded).join(', ');
    process.stdout.write(`Embedding ${names}\n`);
  }

  fs.rmSync(tmpDir, {recursive: true, force: true});
  fs.mkdirSync(workerDir, {recursive: true});
  fs.mkdirSync(appDir, {recursive: true});

  const embeddedFiles = writeEmbeddedAssets(embedded);

  process.stdout.write('Building workers...\n');
  await runWebpack(workerConfig({
    workerDir,
    publicUrl: options.publicUrl,
    embeddedAssets: embeddedFiles.workerFile,
  }));

  process.stdout.write('Building app...\n');
  await runWebpack(appConfig({
    appDir,
    workerDir,
    publicUrl: options.publicUrl,
    embeddedAssets: embeddedFiles.appFile,
  }));

  process.stdout.write('Assembling HTML...\n');
  const jsFile = path.join(appDir, 'main.js');
  const cssFile = path.join(appDir, 'main.css');
  for (const file of [jsFile, cssFile]) {
    if (!fs.existsSync(file)) {
      throw new Error(`Missing build output: ${file}`);
    }
  }

  const template = fs.readFileSync(path.join(rootDir, 'singlefile', 'template.html'), 'utf8');
  const values = {
    __CSS__: escapeForStyle(fs.readFileSync(cssFile, 'utf8')),
    __JS__: escapeForScript(fs.readFileSync(jsFile, 'utf8')),
    __FAVICON__: toDataUri(path.join(rootDir, 'public', 'favicon.ico'), 'image/x-icon'),
  };
  const html = template.replace(/__CSS__|__JS__|__FAVICON__/g, token => values[token]);
  for (const token of Object.keys(values)) {
    if (html.includes(token)) {
      throw new Error(`Template token ${token} survived the build`);
    }
  }

  fs.mkdirSync(path.dirname(options.out), {recursive: true});
  fs.writeFileSync(options.out, html);

  if (!options.keepTmp) {
    fs.rmSync(tmpDir, {recursive: true, force: true});
  }

  const stats = fs.statSync(options.out);
  const relative = path.relative(rootDir, options.out);
  const label = relative.startsWith('..') ? options.out : relative;
  process.stdout.write(`\nWrote ${label} (${formatSize(stats.size)})\n`);
  process.stdout.write('Open it in a browser, or serve it:  node scripts/serve-dist.js\n');
  if (!embedded) {
    process.stdout.write(`Shareware data is downloaded at runtime from ${options.publicUrl}/spawn.mpq\n`);
    process.stdout.write('(or drop your own DIABDAT.MPQ / spawn.mpq onto the page)\n');
  }
}

main().catch(error => {
  process.stderr.write(`\n${error && error.stack || error}\n`);
  process.exit(1);
});
