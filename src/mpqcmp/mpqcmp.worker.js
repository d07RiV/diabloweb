import MpqBinary from './MpqCmp.wasm';
import MpqModule from './MpqCmp.jscc';
import axios from 'axios';

const MpqSize = 356747;

/* eslint-disable-next-line no-restricted-globals */
const worker = self;

let input_file = null;
let output_file = null;
let last_progress = 0;
function progress(text, loaded, total) {
  worker.postMessage({action: "progress", text, loaded, total});
}

const DApi = {
  exit_error(error) {
    throw Error(error);
  },

  get_file_contents(array, offset) {
    array.set(input_file.subarray(offset, offset + array.byteLength));
  },
  put_file_size(size) {
    debugger;
    output_file = new Uint8Array(size);
  },
  put_file_contents(array, offset) {
    output_file.set(array, offset);
  },

  progress(done, total) {
    if (done === total || performance.now() > last_progress + 100) {
      progress("Processing...", done, total);
      last_progress = performance.now();
    }
  },
};

worker.DApi = DApi;

let wasm = null;

const readFile = (file, progress) => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => {
    if (progress) {
      progress({loaded: file.size});
    }
    resolve(reader.result);
  };
  reader.onerror = () => reject(reader.error);
  reader.onabort = () => reject();
  if (progress) {
    reader.addEventListener("progress", progress);
  }
  reader.readAsArrayBuffer(file);
});

async function initWasm(progress) {
  const binary = await axios.request({
    url: MpqBinary,
    responseType: 'arraybuffer',
    onDownloadProgress: progress,
  });
  const result = await MpqModule({
    wasmBinary: binary.data,
  }).ready;
  progress({loaded: MpqSize});
  return result;
}

async function run(mpq) {
  progress("Loading...");
  let mpqLoaded = 0, mpqTotal = (mpq ? mpq.size : 0), wasmLoaded = 0, wasmTotal = MpqSize;
  const wasmWeight = 5;
  function updateProgress() {
    progress("Loading...", mpqLoaded + wasmLoaded * wasmWeight, mpqTotal + wasmTotal * wasmWeight);
  }
  const loadWasm = initWasm(e => {
    wasmLoaded = Math.min(e.loaded, wasmTotal);
    updateProgress();
  });
  let loadMpq = mpq ? readFile(mpq, e => {
    mpqLoaded = e.loaded;
    updateProgress();
  }) : Promise.resolve(null);
  [wasm, mpq] = await Promise.all([loadWasm, loadMpq]);

  input_file = new Uint8Array(mpq);

  progress("Processing...");

  wasm._DApi_MpqCmp(input_file.length);

  return output_file.buffer;
}

worker.addEventListener("message", ({data}) => {
  switch (data.action) {
  case "run":
    run(data.mpq).then(
      result => worker.postMessage({action: "result", result}, [result]),
      err => worker.postMessage({action: "error", error: err.toString(), stack: err.stack}));
    break;
  default:
  }
});