import MpqBinary from './MpqCmp.wasm';
import MpqModule from './MpqCmp.jscc';
import axios from 'axios';

const MpqSize = 356747;

/* eslint-disable-next-line no-restricted-globals */
const worker = self;

function onError(err, action="error") {
  if (err instanceof Error) {
    worker.postMessage({action, error: err.toString(), stack: err.stack});
  } else {
    worker.postMessage({action, error: err.toString()});
  }
}

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

async function initWasm(spawn, progress) {
  const binary = await axios.request({
    url: spawn ? SpawnBinary : DiabloBinary,
    responseType: 'arraybuffer',
    onDownloadProgress: progress,
  });
  const result = await (spawn ? SpawnModule : DiabloModule)({wasmBinary: binary.data}).ready;
  progress({loaded: 2000000});
  return result;
}

async function run(mpq) {
  progress("Loading...");
  let mpqLoaded = 0, mpqTotal = (mpq ? mpq.size : 0), wasmLoaded = 0, wasmTotal = (spawn ? SpawnSize : DiabloSize);
  const wasmWeight = 5;
  function updateProgress() {
    progress("Loading...", mpqLoaded + wasmLoaded * wasmWeight, mpqTotal + wasmTotal * wasmWeight);
  }
  const loadWasm = initWasm(spawn, e => {
    wasmLoaded = Math.min(e.loaded, wasmTotal);
    updateProgress();
  });
  let loadMpq = mpq ? readFile(mpq, e => {
    mpqLoaded = e.loaded;
    updateProgress();
  }) : Promise.resolve(null);
  [wasm, mpq] = await Promise.all([loadWasm, loadMpq]);

  input_file = new Uint8Array(mpq);

  progress("Initializing...");

  wasm._DApi_MpqCmp(input_file.length);

  return output_file.buffer;
}

worker.addEventListener("message", ({data}) => {
  switch (data.action) {
  case "run":
    init_game(data.mpq).then(
      res => worker.postMessage({action: "result", data: res}, [res]),
      e => onError(e, "failed"));
    break;
  default:
  }
});
