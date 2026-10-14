'use strict';

// Smoke test for the single-file build's worker plumbing (not part of the app).
//
// The compiled worker bundle is executed twice, once per code path the build
// can take at runtime:
//
//   1. "main thread" - through singlefile/inline-worker.js, i.e. the sandboxed
//      fallback used when the page is opened from disk (file://),
//   2. "worker scope" - inside a vm context that mimics a real
//      WorkerGlobalScope (self/importScripts, no window, no document), which is
//      what a blob: worker gets when the page is served over http(s).
//
// Both runs feed the game a bogus spawn.mpq, so the expected result is that the
// WebAssembly module instantiates, DApi_Init runs and the archive parser
// reports "invalid MPQ file" back through postMessage.
//
//   node scripts/test-single-file.js

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const babel = require('@babel/core');

const rootDir = path.resolve(__dirname, '..');
const workerFile = path.join(rootDir, 'build', 'single', 'workers', 'game.worker.js');

if (!fs.existsSync(workerFile)) {
  process.stderr.write(`${workerFile} not found - run "npm run build:single -- --keep-tmp" first.\n`);
  process.exit(1);
}

const workerCode = fs.readFileSync(workerFile, 'utf8');

function loadModule(file) {
  const source = fs.readFileSync(file, 'utf8');
  const {code} = babel.transformSync(source, {
    babelrc: false,
    configFile: false,
    filename: file,
    presets: [[require.resolve('@babel/preset-env'), {targets: {node: 'current'}}]],
  });
  const module = {exports: {}};
  new Function('module', 'exports', 'require', '__dirname', code)(module, module.exports, require, path.dirname(file));
  return module.exports;
}

const inlineWorkerModule = loadModule(path.join(rootDir, 'singlefile', 'inline-worker.js'));
const InlineWorker = inlineWorkerModule.default || inlineWorkerModule;

// The Emscripten glue touches document in its browser branch, and axios picks
// its adapter from the presence of XMLHttpRequest and parses a URL through an
// <a> element at load time. Neither is used for the inlined data: URIs, but
// both have to exist for the bundle to boot.
function createAnchor() {
  const anchor = {
    style: {},
    href: '',
    setAttribute(name, value) {
      if (name === 'href') {
        this.href = value;
      }
    },
    getAttribute(name) {
      return name === 'href' ? this.href : null;
    },
    appendChild() {},
  };
  for (const key of ['protocol', 'host', 'hostname', 'port', 'pathname', 'search', 'hash']) {
    Object.defineProperty(anchor, key, {
      get() {
        try {
          return new URL(this.href, 'http://localhost/')[key];
        } catch (e) {
          return key === 'pathname' ? '/' : '';
        }
      },
    });
  }
  return anchor;
}

class XMLHttpRequestStub {
  open() {}
  setRequestHeader() {}
  addEventListener() {}
  send() {
    throw new Error('XMLHttpRequest should not be used - everything is inlined');
  }
}

const documentStub = {
  currentScript: null,
  title: '',
  cookie: '',
  createElement: tag => (tag === 'a' ? createAnchor() : {style: {}, setAttribute() {}, appendChild() {}}),
};

function fakeFiles() {
  const files = new Map();
  files.set('spawn.mpq', new Uint8Array(4096));
  return files;
}

// --- scenario 1: main-thread fallback (file://) ---------------------------
function runInline() {
  globalThis.document = documentStub;
  globalThis.XMLHttpRequest = XMLHttpRequestStub;
  // axios reads window.location.href while it boots; Node has no location.
  if (typeof globalThis.location === 'undefined') {
    Object.defineProperty(globalThis, 'location', {
      value: {href: 'file:///tmp/diabloweb.html', protocol: 'file:'},
      configurable: true,
      writable: true,
    });
  }
  const worker = new InlineWorker(workerCode);
  setTimeout(() => {
    worker.postMessage({action: 'init', files: fakeFiles(), mpq: null, spawn: true, offscreen: false}, []);
  }, 50);
  return worker;
}

// --- scenario 2: real worker scope (http) ---------------------------------
function runWorkerScope() {
  const listeners = [];

  // A worker scope has no window/document/process/require; it does have
  // importScripts, self and location.
  const skip = new Set(['globalThis', 'window', 'document', 'global', 'process', 'require', 'module',
    'exports', '__dirname', '__filename', 'GLOBAL', 'root']);
  const sandbox = {};
  for (const key of Object.getOwnPropertyNames(globalThis)) {
    if (!skip.has(key)) {
      sandbox[key] = globalThis[key];
    }
  }
  delete sandbox.document;
  Object.assign(sandbox, {
    self: sandbox,
    globalThis: sandbox,
    importScripts: () => {
      throw new Error('importScripts should not be needed - everything is inlined');
    },
    location: {href: 'blob:https://localhost/fake-worker-url', protocol: 'blob:'},
    XMLHttpRequest: XMLHttpRequestStub,
    // worker -> page, delivered asynchronously like the real thing
    postMessage: data => setTimeout(() => {
      for (const {type, fn} of listeners.slice()) {
        if (type === 'message') {
          fn({data});
        }
      }
    }, 0),
    addEventListener: (type, fn) => listeners.push({type, fn, inner: true}),
    removeEventListener: () => {},
    close: () => {},
  });

  vm.runInContext(workerCode, vm.createContext(sandbox), {filename: 'game.worker.js'});

  const worker = {
    addEventListener(type, fn) {
      listeners.push({type, fn, inner: false});
    },
    postMessage(data) {
      setTimeout(() => {
        for (const {type, fn, inner} of listeners.slice()) {
          if (inner && type === 'message') {
            fn({data});
          }
        }
      }, 0);
    },
    terminate() {},
  };
  setTimeout(() => {
    worker.postMessage({action: 'init', files: fakeFiles(), mpq: null, spawn: true, offscreen: false});
  }, 10);
  return worker;
}

const scenarios = [
  ['main thread (file:// fallback)', runInline],
  ['worker scope (served over http)', runWorkerScope],
];

let failures = 0;

function runScenario(index) {
  if (index >= scenarios.length) {
    process.stdout.write(`\nRESULT: ${failures ? `${failures} scenario(s) failed` : 'ok'}\n`);
    process.exit(failures ? 1 : 0);
    return;
  }
  const [name, run] = scenarios[index];
  process.stdout.write(`\n=== ${name} ===\n`);

  let worker;
  try {
    worker = run();
  } catch (e) {
    failures++;
    process.stdout.write(`RESULT: fail - could not start: ${e.stack || e}\n`);
    runScenario(index + 1);
    return;
  }

  let settled = false;
  const finish = (ok, detail) => {
    if (settled) {
      return;
    }
    settled = true;
    if (!ok) {
      failures++;
    }
    process.stdout.write(`RESULT: ${ok ? 'ok' : 'fail'} - ${detail}\n`);
    worker.terminate();
    setTimeout(() => runScenario(index + 1), 10);
  };

  worker.addEventListener('message', ({data}) => {
    switch (data.action) {
      case 'progress':
        process.stdout.write(`  progress: ${data.text || ''}\n`);
        break;
      case 'loaded':
        finish(true, 'worker reported "loaded" (wasm instantiated, game API initialised)');
        break;
      case 'error':
        finish(true, `game reported an error through DApi as expected: ${String(data.error).split('\n')[0]}`);
        break;
      case 'failed':
        if (/invalid MPQ/i.test(String(data.error))) {
          finish(true, `game rejected the fake mpq as expected: ${String(data.error).split('\n')[0]}`);
        } else {
          finish(false, `worker failed to initialise: ${data.error}\n${data.stack || ''}`);
        }
        break;
      default:
        process.stdout.write(`  message: ${data.action}\n`);
    }
  });
  worker.addEventListener('error', event => finish(false, `uncaught error inside the worker: ${event.message}`));
  setTimeout(() => finish(false, 'timed out waiting for the worker'), 60000);
}

// Errors escaping the emulated scopes would otherwise take the test runner down.
process.on('unhandledRejection', reason => {
  process.stdout.write(`  unhandled rejection: ${(reason && reason.stack) || reason}\n`);
});
process.on('uncaughtException', error => {
  process.stdout.write(`  uncaught exception: ${error && error.stack || error}\n`);
});

process.stdout.write(`worker bundle: ${(workerCode.length / 1024 / 1024).toFixed(2)} MB\n`);
runScenario(0);
