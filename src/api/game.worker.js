import DiabloBinary from './Diablo.wasm';
import DiabloModule from './Diablo.jscc';
import SpawnBinary from './DiabloSpawn.wasm';
import SpawnModule from './DiabloSpawn.jscc';

/* eslint-disable-next-line no-restricted-globals */
const worker = self;

let canvas = null, context = null;
let files = null;
let renderBatch = null;
let drawBelt = null;

const DApi = {
  exit_error(error) {
    worker.postMessage({action: "error", error});
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

const DApi_renderLegacy = {
  draw_begin() {
    renderBatch = {
      images: [],
      text: [],
      clip: null,
      belt: drawBelt,
    };
    drawBelt = null;
  },
  draw_blit(x, y, w, h, data) {
    renderBatch.images.push({x, y, w, h, data: data.slice()});
  },
  draw_clip_text(x0, y0, x1, y1) {
    renderBatch.clip = {x0, y0, x1, y1};
  },
  draw_text(x, y, text, color) {
    renderBatch.text.push({x, y, text, color});
  },
  draw_end() {
    const transfer = renderBatch.images.map(({data}) => data.buffer);
    if (renderBatch.belt) {
      transfer.push(renderBatch.belt.buffer);
    }
    worker.postMessage({action: "render", batch: renderBatch}, transfer);
    renderBatch = null;
  },
  draw_belt(items) {
    drawBelt = items.slice();
  },
};

const DApi_renderOffscreen = {
  draw_begin() {
    context.save();
    context.font = 'bold 13px Times New Roman';
  },
  draw_blit(x, y, w, h, data) {
    const image = context.createImageData(w, h);
    image.data.set(data);
    context.putImageData(image, x, y);
  },
  draw_clip_text(x0, y0, x1, y1) {
    context.beginPath();
    context.rect(x0, y0, x1 - x0, y1 - y0);
    context.clip();
  },
  draw_text(x, y, text, color) {
    const r = ((color >> 16) & 0xFF);
    const g = ((color >> 8) & 0xFF);
    const b = (color & 0xFF);
    context.fillStyle = `rgb(${r}, ${g}, ${b})`;
    context.fillText(text, x, y + 22);
  },
  draw_end() {
    context.restore();
    const bitmap = canvas.transferToImageBitmap();
    const transfer = [bitmap];
    if (drawBelt) {
      transfer.push(drawBelt.buffer);
    }
    worker.postMessage({action: "render", batch: {bitmap, belt: drawBelt}}, transfer);
    drawBelt = null;
  },
  draw_belt(items) {
    drawBelt = items.slice();
  },
};

let audioBatch = null, audioTransfer = null;
let maxSoundId = 0, maxBatchId = 0;
["create_sound", "duplicate_sound"].forEach(func => {
  DApi[func] = function(...params) {
    if (audioBatch) {
      maxBatchId = params[0] + 1;
      audioBatch.push({func, params});
      if (func === "create_sound") {
        audioTransfer.push(params[1].buffer);
      }
    } else {
      maxSoundId = params[0] + 1;
      const transfer = [];
      if (func === "create_sound") {
        transfer.push(params[1].buffer);
      }
      worker.postMessage({action: "audio", func, params}, transfer);
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
  audioTransfer = [];
  wasm["_" + func](...params);
  if (audioBatch.length) {
    maxSoundId = maxBatchId;
    worker.postMessage({action: "audioBatch", batch: audioBatch}, audioTransfer);
    audioBatch = null;
    audioTransfer = null;
  }
}

async function init_game(mpq, offscreen) {
  if (mpq) {
    /* eslint-disable-next-line no-undef */
    const reader = new FileReaderSync();
    const data = reader.readAsArrayBuffer(mpq);
    files.set('diabdat.mpq', new Uint8Array(data));
  }

  if (offscreen) {
    canvas = new OffscreenCanvas(640, 480);
    context = canvas.getContext("2d");
    Object.assign(DApi, DApi_renderOffscreen);
  } else {
    Object.assign(DApi, DApi_renderLegacy);
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
    init_game(data.mpq, data.offscreen).then(
      () => worker.postMessage({action: "loaded"}),
      e => {debugger;worker.postMessage({action: "failed", error: e.message || e.name});});
    break;
  case "event":
    call_api(data.func, ...data.params);
    break;
  }
});
