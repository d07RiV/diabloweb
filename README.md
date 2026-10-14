## Diablo 1 for web browsers!

This project is based on https://github.com/diasurgical/devilution.

Source code to build the WebAssembly modules is here: https://github.com/d07RiV/devilution

I've modified the code to remove all dependencies and exposed the minimal required interface with JS, allowing the game to be compiled into WebAssembly.

Event handling (especially in the menus) had to be modified significantly to fit the JS model.

The project is hosted on https://d07RiV.github.io/diabloweb/ along with spawn.mpq from the shareware version (place it in the public folder to run locally).
This allows shareware version to be played anywhere, even on mobile phones. To play the full game, you must use your own DIABDAT.MPQ that you can obtain
with the original copy of the game from [GoG](url=https://www.gog.com/game/diablo).

## Single-file build

The whole app can be packed into ONE self-contained HTML document - no server,
no extra files, no build step for whoever receives it:

```bash
npm install
npm run build:single          # writes dist/diabloweb.html (~4.5 MB)
```

Open `dist/diabloweb.html` in a browser (double-clicking works), or serve it:

```bash
npm run serve:single          # http://localhost:8000/
```

What ends up inside the document:

* the React app, its CSS and the favicon,
* both WebAssembly modules (`Diablo.wasm`, `DiabloSpawn.wasm`) and the MPQ
  compressor, base64-encoded,
* the two web workers, inlined as source and started from a `blob:` URL - or,
  when the page is opened from disk, emulated on the main thread (browsers
  refuse to create workers from `blob:`/`data:` URLs in a `file://` document),
* no analytics, no service worker, no source-map remapping.

Game data is **not** part of the repository, so it is still needed at runtime:

* drop your own `DIABDAT.MPQ` onto the page (or use *Select MPQ*), or
* click *Play Shareware*, which downloads `spawn.mpq` from the URL given by
  `--public-url` (default: the official hosted build,
  `https://d07riv.github.io/diabloweb`), or
* bake a local copy in so the shareware version works offline:
  `npm run build:single -- --embed-spawn=public/spawn.mpq`.

Notes and limitations:

* Serving over http(s) is the better experience: real web workers are used and
  save games persist in IndexedDB. From `file://` the worker code runs on the
  main thread (the UI is less responsive while the game loads) and some
  browsers refuse IndexedDB, in which case saves only live for the session.
* Downloading the shareware data from another origin requires that host to
  allow cross-origin requests; if it is blocked, drop a local `spawn.mpq`
  onto the page instead.
* Multiplayer still talks to the public PeerJS/WebSocket servers, so it needs
  network access.

Build options: `--out=<file>`, `--public-url=<url>`, `--embed-spawn[=<path>]`,
`--keep-tmp`. Smoke tests for the result (they need `--keep-tmp`):

```bash
npm run build:single -- --keep-tmp
npm run test:single
```

Implementation: `config/webpack.singlefile.js` (two webpack passes) plus the
runtime helpers and loaders in `singlefile/`, driven by
`scripts/build-single-html.js`. The regular `npm run build` is untouched.
