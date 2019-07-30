import DiabloBinary from './Diablo.wasm';
import DiabloModule from './Diablo.jscc';
import SpawnBinary from './DiabloSpawn.wasm';
import SpawnModule from './DiabloSpawn.jscc';

/* eslint-disable-next-line no-restricted-globals */
const worker = self;

let files = null;
let renderBatch = null;

const DApi = {
  exit_error(error) {
    worker.postMessage({action: "error", error});
  },

  draw_begin() {
    renderBatch = {
      images: [],
      text: [],
      clip: null
    };
  },
  draw_blit(x, y, w, h, data) {
    if (ImageData.length) {
      const image = new ImageData(w, h);
      image.data.set(data);
      renderBatch.images.push({x, y, image});
    } else {
      renderBatch.images.push({x, y, w, h, data: data.slice});
    }
  },
  draw_clip_text(x0, y0, x1, y1) {
    renderBatch.clip = {x0, y0, x1, y1};
  },
  draw_text(x, y, text, color) {
    renderBatch.text.push({x, y, text, color});
  },
  draw_end() {
    worker.postMessage({action: "render", batch: renderBatch});
    renderBatch = null;
  },

  get_file_size(path) {
    const data = files.get(path.toLowerCase());
    return data ? data.byteLength : 0;
  },
  get_file_contents(path, array, offset) {
    const data = files.get(path.toLowerCase());
    if (data) {
      array.set(data.subarray(offset, offset + array.length));
    }
  },
  put_file_contents(path, array) {
    path = path.toLowerCase();
    // if (!path.match(/^(spawn\d+\.sv|single_\d+\.sv|config\.ini)$/i)) {
    //   alert(`Bad file name: ${path}`);
    // }
    files.set(path, array);
    worker.postMessage({action: "fs", func: "update", params: [path, array]});
  },
  remove_file(path) {
    path = path.toLowerCase();
    files.delete(path);
    worker.postMessage({action: "fs", func: "delete", params: [path]});
  },

  set_cursor(x, y) {
    worker.postMessage({action: "cursor", x, y});
  },
  open_keyboard() {
    worker.postMessage({action: "keyboard", open: true});
  },
  close_keyboard() {
    worker.postMessage({action: "keyboard", open: false});
  },
};

let audioBatch = null;
let maxSoundId = 0, maxBatchId = 0;
["create_sound", "duplicate_sound"].forEach(func => {
  DApi[func] = function(...params) {
    if (audioBatch) {
      maxBatchId = params[0] + 1;
      audioBatch.push({func, params});
    } else {
      maxSoundId = params[0] + 1;
      worker.postMessage({action: "audio", func, params});
    }
  };
});
["play_sound", "set_volume", "stop_sound", "delete_sound"].forEach(func => {
  DApi[func] = function(...params) {
    if (audioBatch && params[0] >= maxSoundId) {
      audioBatch.push({func, params});
    } else {
      worker.postMessage({action: "audio", func, params});
    }
  }
});

worker.DApi = DApi;

let wasm = null;

function call_api(func, ...params) {
  audioBatch = [];
  wasm["_" + func](...params);
  if (audioBatch.length) {
    maxSoundId = maxBatchId;
    worker.postMessage({action: "audioBatch", batch: audioBatch});
    audioBatch = null;
  }
}

async function init_game(mpq) {
  if (mpq) {
    /* eslint-disable-next-line no-undef */
    const reader = new FileReaderSync();
    const data = reader.readAsArrayBuffer(mpq);
    files.set('diabdat.mpq', new Uint8Array(data));
  }

  wasm = await (mpq ? DiabloModule : SpawnModule)({
    locateFile(name) {
      if (name === 'DiabloSpawn.wasm') {
        return SpawnBinary;
      } else if (name === 'Diablo.wasm') {
        return DiabloBinary;
      } else {
        return name;
      }
    }
  }).ready;

  wasm._DApi_Init(Math.floor(performance.now()));

  setInterval(() => {
    call_api("DApi_Render", Math.floor(performance.now()));
  }, 50);
}

worker.addEventListener("message", ({data}) => {
  switch (data.action) {
  case "init":
    files = data.files;
    init_game(data.mpq).then(
      () => worker.postMessage({action: "loaded"}),
      e => worker.postMessage({action: "failed", error: e.message}));
    break;
  case "event":
    call_api(data.func, ...data.params);
    break;
  }
});
