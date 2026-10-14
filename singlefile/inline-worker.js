// Minimal in-page stand-in for a real Web Worker.
//
// The single-file build inlines the worker source into the page and normally
// starts it through a blob: URL. That does not work when the document is
// opened straight from disk (file:// pages run with an opaque origin, and
// browsers refuse to create workers from blob:/data: URLs there), so in that
// case the very same code is evaluated on the main thread instead, inside a
// sandboxed global object that mimics a worker scope and shuttles messages
// back and forth asynchronously, exactly like postMessage does.
//
// It is not a real worker: there is no parallelism and no structured cloning
// (messages are passed by reference, transfer lists are ignored). That is
// enough for this app, and it is strictly better than not starting at all.

function createSandbox(worker) {
  const target = {
    postMessage: (data, transfer) => worker._post(data, transfer),
    addEventListener: (type, fn) => worker._addInner(type, fn),
    removeEventListener: (type, fn) => worker._removeInner(type, fn),
    dispatchEvent: () => true,
    close: () => worker._close(),
    // A worker scope has importScripts(); keeping it undefined is what makes
    // bundled code (Emscripten, axios, ...) pick its browser code paths.
    importScripts: undefined,
  };
  target.self = target;
  target.window = target;
  target.globalThis = target;

  for (const type of ['message', 'error']) {
    Object.defineProperty(target, `on${type}`, {
      get: () => worker._innerOn[type] || null,
      set: fn => {
        worker._innerOn[type] = typeof fn === 'function' ? fn : null;
      },
      enumerable: true,
      configurable: true,
    });
  }

  const globals = typeof window !== 'undefined' ? window
    : typeof globalThis !== 'undefined' ? globalThis : {};

  return new Proxy(target, {
    get(store, key) {
      if (typeof key !== 'string') {
        return undefined;
      }
      if (key in store) {
        return store[key];
      }
      const value = globals[key];
      // Bind host functions so that things like document.createElement or
      // URL.createObjectURL keep working when called off the sandbox.
      return typeof value === 'function' ? value.bind(globals) : value;
    },
    set(store, key, value) {
      store[key] = value;
      return true;
    },
    has(store, key) {
      return key in store || key in globals;
    },
    deleteProperty(store, key) {
      delete store[key];
      return true;
    },
    defineProperty(store, key, descriptor) {
      return Reflect.defineProperty(store, key, descriptor);
    },
    getOwnPropertyDescriptor(store, key) {
      return Reflect.getOwnPropertyDescriptor(store, key);
    },
  });
}

export default class InlineWorker {
  constructor(code) {
    this._outer = {};
    this._inner = {};
    this._innerOn = {};
    this._stopped = false;
    this._closed = false;
    this.onmessage = null;
    this.onerror = null;

    const sandbox = createSandbox(this);
    let run = null;
    try {
      // eslint-disable-next-line no-new-func
      run = new Function(
        'self', 'window', 'globalThis', 'postMessage',
        'addEventListener', 'removeEventListener', 'close', 'importScripts',
        code
      );
    } catch (e) {
      setTimeout(() => this._fail(e), 0);
      return;
    }
    // Real workers start asynchronously; keep the same timing so that the
    // caller can attach its listeners first.
    setTimeout(() => {
      if (this._stopped) {
        return;
      }
      try {
        run(
          sandbox, sandbox, sandbox, sandbox.postMessage,
          sandbox.addEventListener, sandbox.removeEventListener, sandbox.close, undefined
        );
      } catch (e) {
        this._fail(e);
      }
    }, 0);
  }

  // --- worker side -------------------------------------------------------
  _addInner(type, fn) {
    if (typeof fn !== 'function') {
      return;
    }
    (this._inner[type] = this._inner[type] || []).push(fn);
  }

  _removeInner(type, fn) {
    const list = this._inner[type];
    if (list) {
      const index = list.indexOf(fn);
      if (index >= 0) {
        list.splice(index, 1);
      }
    }
  }

  _post(data) {
    // worker -> page (a closed worker still delivers what it already queued)
    setTimeout(() => {
      if (this._stopped) {
        return;
      }
      this._dispatch(data, 'message', this._outer, this.onmessage);
    }, 0);
  }

  _close() {
    this._closed = true;
  }

  // --- page side ---------------------------------------------------------
  postMessage(data) {
    // page -> worker
    setTimeout(() => {
      if (this._stopped || this._closed) {
        return;
      }
      this._dispatch(data, 'message', this._inner, this._innerOn.message);
    }, 0);
  }

  addEventListener(type, fn) {
    if (typeof fn !== 'function') {
      return;
    }
    (this._outer[type] = this._outer[type] || []).push(fn);
  }

  removeEventListener(type, fn) {
    const list = this._outer[type];
    if (list) {
      const index = list.indexOf(fn);
      if (index >= 0) {
        list.splice(index, 1);
      }
    }
  }

  terminate() {
    this._stopped = true;
    this._closed = true;
    this._outer = {};
    this.onmessage = null;
    this.onerror = null;
  }

  _dispatch(data, type, registry, onHandler) {
    const event = {data, type, target: this};
    for (const fn of (registry[type] || []).slice()) {
      try {
        fn(event);
      } catch (e) {
        this._fail(e);
      }
    }
    if (typeof onHandler === 'function') {
      try {
        onHandler(event);
      } catch (e) {
        this._fail(e);
      }
    }
  }

  _fail(error) {
    // eslint-disable-next-line no-console
    console.error('[diabloweb] inline worker error:', error);
    const event = {
      type: 'error',
      message: error && error.stack ? String(error.stack) : String(error),
      error,
      target: this,
    };
    for (const fn of (this._outer.error || []).slice()) {
      try {
        fn(event);
      } catch (e) {
        // eslint-disable-next-line no-console
        console.error(e);
      }
    }
    if (typeof this.onerror === 'function') {
      try {
        this.onerror(event);
      } catch (e) {
        // eslint-disable-next-line no-console
        console.error(e);
      }
    }
  }
}
