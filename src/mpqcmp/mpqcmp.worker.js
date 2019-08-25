import MpqModule from './MpqCmp.jscc';

/* eslint-disable-next-line no-restricted-globals */
const worker = self;

let input_file = null;
let input_offset = 0;
let output_file = null;
let last_progress = 0;
function progress(value) {
  worker.postMessage({action: "progress", value});
}

const DApi = {
  exit_error(error) {
    throw Error(error);
  },

  get_file_contents(array, offset) {
    array.set(input_file.subarray(offset - input_offset, offset - input_offset + array.byteLength));
  },
  put_file_size(size) {
    output_file = new Uint8Array(size);
  },
  put_file_contents(array, offset) {
    output_file.set(array, offset);
  },

  progress(done, total) {
    if (done === total || performance.now() > last_progress + 100) {
      progress(done);
      last_progress = performance.now();
    }
  },
};

worker.DApi = DApi;

async function run({binary, mpq, input, offset, blockSize}) {
  const wasm = await MpqModule({wasmBinary: binary}).ready;

  input_file = new Uint8Array(mpq);
  input_offset = offset;

  const count = input.length / 6;
  const ptr = wasm._DApi_Alloc(input.byteLength);
  wasm.HEAPU32.set(input, ptr >> 2);

  const dst = wasm._DApi_Compress(offset + input_file.length, blockSize, count, ptr) >> 2;

  return [output_file.buffer, wasm.HEAPU32.slice(dst , dst + count * 4)];
}

worker.addEventListener("message", ({data}) => {
  switch (data.action) {
  case "run":
    run(data).then(
      ([buffer, blocks]) => worker.postMessage({action: "result", buffer, blocks}, [buffer, blocks.buffer]),
      err => worker.postMessage({action: "error", error: err.toString(), stack: err.stack}));
    break;
  default:
  }
});
