// Axios wrapper used by the single-file build.
//
// Everything the app needs is bundled into one HTML document, so the binary
// assets (WebAssembly modules, the MPQ file list, ...) are referenced as
// `data:` URIs instead of real files. Rather than relying on every browser
// supporting multi-megabyte XHR requests to data: URIs (and on progress
// events that never fire for them), those requests are answered locally.
//
// The same hook is used for assets embedded at build time (--embed-spawn),
// which are matched by file name.
import axios from 'axios/index.js';
import EMBEDDED from 'embedded-assets';

function base64ToBytes(base64) {
  const binary = atob(base64);
  const length = binary.length;
  const bytes = new Uint8Array(length);
  for (let i = 0; i < length; ++i) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function bytesToBuffer(bytes) {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
}

function base64ToText(base64) {
  const bytes = base64ToBytes(base64);
  if (typeof TextDecoder !== 'undefined') {
    return new TextDecoder('utf-8').decode(bytes);
  }
  let text = '';
  for (let i = 0; i < bytes.length; ++i) {
    text += String.fromCharCode(bytes[i]);
  }
  return text;
}

// A tiny lazy view over some bundled bytes.
function payload(mime, decodeBuffer, decodeText) {
  return {mime, decodeBuffer, decodeText};
}

function parseDataUri(url) {
  if (typeof url !== 'string' || url.slice(0, 5) !== 'data:') {
    return null;
  }
  const comma = url.indexOf(',');
  if (comma < 0) {
    return null;
  }
  const meta = url.slice(5, comma);
  const isBase64 = /;base64$/i.test(meta);
  const mime = (isBase64 ? meta.slice(0, -7) : meta).split(';')[0] || 'text/plain';
  const body = url.slice(comma + 1);
  if (isBase64) {
    return payload(
      mime,
      () => bytesToBuffer(base64ToBytes(body)),
      () => base64ToText(body)
    );
  }
  return payload(
    mime,
    () => bytesToBuffer(base64ToBytes(btoa(decodeURIComponent(body)))),
    () => decodeURIComponent(body)
  );
}

function findEmbedded(url) {
  if (typeof url !== 'string' || !EMBEDDED) {
    return null;
  }
  const path = url.split('?')[0].split('#')[0].toLowerCase();
  for (const name of Object.keys(EMBEDDED)) {
    const key = name.toLowerCase();
    if (path === key || path.slice(-key.length - 1) === `/${key}`) {
      const entry = EMBEDDED[name];
      return payload(
        entry.mime || 'application/octet-stream',
        () => bytesToBuffer(base64ToBytes(entry.base64)),
        () => base64ToText(entry.base64)
      );
    }
  }
  return null;
}

function wantsText(config, mime) {
  if (config.responseType === 'text') {
    return true;
  }
  if (config.responseType && config.responseType !== 'json') {
    return false;
  }
  return /^(text\/|application\/json)/i.test(mime || '');
}

function localResponse(config, source) {
  const asText = wantsText(config, source.mime);
  const data = asText ? source.decodeText() : source.decodeBuffer();
  const total = asText ? data.length : data.byteLength;
  if (typeof config.onDownloadProgress === 'function') {
    setTimeout(() => {
      config.onDownloadProgress({loaded: total, total, lengthComputable: true});
    }, 0);
  }
  return {
    data,
    status: 200,
    statusText: 'OK',
    headers: {},
    config,
    request: {},
  };
}

function tryLocal(config) {
  const source = parseDataUri(config.url) || findEmbedded(config.url);
  return source ? localResponse(config, source) : null;
}

function friendlyError(config, error) {
  if (!/spawn\.mpq(\?|#|$)/i.test(config.url || '')) {
    return error;
  }
  const message = `Could not download the shareware data (${config.url}). ` +
    'This standalone page ships without any game data, so it either needs network access to that URL, ' +
    'or a local file: drop spawn.mpq (the shareware data) or your own DIABDAT.MPQ onto the page.';
  if (error && error.message) {
    error.message = `${message}\n(${error.message})`;
  }
  return error || new Error(message);
}

function request(config) {
  if (typeof config === 'string') {
    config = {url: config};
  }
  config = config || {};
  const local = tryLocal(config);
  if (local) {
    return Promise.resolve(local);
  }
  return axios.request(config).catch(error => {
    throw friendlyError(config, error);
  });
}

function method(name, hasBody) {
  return function(url, a, b) {
    const config = typeof url === 'object' ? Object.assign({}, url) : Object.assign({}, hasBody ? b : a, {url});
    if (hasBody && typeof url !== 'object') {
      config.data = a;
    }
    config.method = name;
    return request(config);
  };
}

const shim = Object.assign(
  function(configOrUrl, maybeConfig) {
    return request(typeof configOrUrl === 'string'
      ? Object.assign({}, maybeConfig, {url: configOrUrl})
      : configOrUrl);
  },
  axios,
  {
    request,
    get: method('get', false),
    delete: method('delete', false),
    head: method('head', false),
    options: method('options', false),
    post: method('post', true),
    put: method('put', true),
    patch: method('patch', true),
    create: config => Object.assign({}, axios.create(config), {request}),
  }
);

export default shim;
