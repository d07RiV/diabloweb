'use strict';

// Smoke test for the assembled single-file document: loads dist/diabloweb.html
// into jsdom, runs the inlined bundle and checks that the app's start screen
// renders (React mounted, CSS extracted, no boot-time errors).
//
//   node scripts/test-single-html.js [path/to/file.html]
//
// jsdom has no IndexedDB/WebAssembly/Worker, which is fine here: the start
// screen must not need any of them, and src/fs.js is expected to degrade
// gracefully when IndexedDB is missing.

const fs = require('fs');
const path = require('path');
const {JSDOM, VirtualConsole} = require('jsdom');

const rootDir = path.resolve(__dirname, '..');
const file = path.resolve(process.argv[2] || path.join(rootDir, 'dist', 'diabloweb.html'));

if (!fs.existsSync(file)) {
  process.stderr.write(`${file} not found - run "npm run build:single" first.\n`);
  process.exit(1);
}

const errors = [];
const virtualConsole = new VirtualConsole();
// jsdom has no canvas backend; the touch-belt buttons call getContext('2d').
const IGNORABLE = /HTMLCanvasElement\.prototype\.getContext/;
virtualConsole.on('jsdomError', error => {
  if (!IGNORABLE.test(error.message)) {
    errors.push(`jsdomError: ${error.message}`);
  }
});
virtualConsole.on('error', (...args) => {
  const message = args.join(' ');
  if (!IGNORABLE.test(message)) {
    errors.push(`console.error: ${message}`);
  }
});
virtualConsole.on('warn', () => {});

const html = fs.readFileSync(file, 'utf8');
process.stdout.write(`Loading ${path.relative(rootDir, file)} (${(html.length / 1024 / 1024).toFixed(2)} MB)\n`);

const dom = new JSDOM(html, {
  runScripts: 'dangerously',
  url: 'https://localhost/diabloweb.html',
  virtualConsole,
  beforeParse(window) {
    // jsdom 11 provides neither of these; react-dom 16 wants rAF and the app
    // only touches blob URLs once the game is actually started.
    window.requestAnimationFrame = callback => window.setTimeout(() => callback(Date.now()), 16);
    window.cancelAnimationFrame = id => window.clearTimeout(id);
    window.URL.createObjectURL = () => 'blob:https://localhost/fake';
    window.URL.revokeObjectURL = () => {};
    Object.defineProperty(window, 'Worker', {
      value: function Worker() {
        throw new Error('Worker should not be constructed before the game starts');
      },
      writable: true,
    });
  },
});

const {window} = dom;
const document = window.document;

setTimeout(() => {
  const root = document.getElementById('root');
  const text = root ? root.textContent : '';
  const checks = [
    ['the document has a <style> block with CSS', document.querySelectorAll('style').length > 0 && /\./.test(document.querySelector('style:last-of-type').textContent)],
    ['React replaced the boot placeholder', !document.getElementById('boot')],
    ['the app shell rendered', !!document.querySelector('.App')],
    ['the canvas is there', !!document.querySelector('.App canvas')],
    ['the start screen offers the MPQ picker', /Select MPQ/.test(text)],
    ['the start screen offers the shareware version', /Play Shareware/.test(text)],
    ['no unexpected boot errors', errors.length === 0],
  ];

  let failed = 0;
  for (const [name, ok] of checks) {
    process.stdout.write(`  ${ok ? 'PASS' : 'FAIL'}  ${name}\n`);
    if (!ok) {
      ++failed;
    }
  }
  if (errors.length) {
    process.stdout.write(`\nErrors captured while booting:\n${errors.slice(0, 10).map(e => `  ${e}`).join('\n')}\n`);
  }
  if (!root || !root.children.length) {
    process.stdout.write(`\n#root is empty. Rendered text: ${JSON.stringify(text.slice(0, 200))}\n`);
  }
  process.stdout.write(`\nRESULT: ${failed ? `${failed} check(s) failed` : 'ok'}\n`);
  window.close();
  process.exit(failed ? 1 : 0);
}, 3000);
