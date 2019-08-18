import Worker from './game.worker.js';
import init_sound from './sound';
import load_spawn from './load_spawn';
import webrtc_open from './webrtc';

function onRender(api, ctx, {bitmap, images, text, clip, belt}) {
  if (bitmap) {
    ctx.transferFromImageBitmap(bitmap);
  } else {
    for (let {x, y, w, h, data} of images) {
      const image = ctx.createImageData(w, h);
      image.data.set(data);
      ctx.putImageData(image, x, y);
    }
    if (text.length) {
      ctx.save();
      ctx.font = 'bold 13px Times New Roman';
      if (clip) {
        const {x0, y0, x1, y1} = clip;
        ctx.beginPath();
        ctx.rect(x0, y0, x1 - x0, y1 - y0);
        ctx.clip();
      }
      for (let {x, y, text: str, color} of text) {
        const r = ((color >> 16) & 0xFF);
        const g = ((color >> 8) & 0xFF);
        const b = (color & 0xFF);
        ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
        ctx.fillText(str, x, y + 22);
      }
      ctx.restore();
    }
  }

  api.updateBelt(belt);
}

function testOffscreen() {
  return false;
  // This works but I couldn't see any performance difference, and support for 2D canvas in workers is very poor.
  // In this mode, instead of sending a batch of areas to draw back to the main thread, the worker does all drawing on its own and sends a complete bitmap object back.
  // However, this effectively clears the worker's canvas, so we need to redraw the whole frame every time, which defeats the performance gained from reduced copying.
  /*try {
    const canvas = document.createElement("canvas");
    const offscreen = canvas.transferControlToOffscreen();
    const context = offscreen.getContext("2d");
    return context != null;
  } catch (e) {
    return false;
  }*/
}

async function do_load_game(api, audio, mpq, spawn) {
  const fs = await api.fs;
  if (spawn && !mpq) {
    await load_spawn(api, fs);
  }

  let context = null, offscreen = false;
  if (testOffscreen()) {
    context = api.canvas.getContext("bitmaprenderer");
    offscreen = true;
  } else {
    context = api.canvas.getContext("2d", {alpha: false});
  }
  return await new Promise((resolve, reject) => {
    try {
      const worker = new Worker();

      let packetQueue = [];
      const webrtc = webrtc_open(data => {
        packetQueue.push(data);
      });

      worker.addEventListener("message", ({data}) => {
        switch (data.action) {
        case "loaded":
          resolve((func, ...params) => worker.postMessage({action: "event", func, params}));
          break;
        case "render":
          onRender(api, context, data.batch);
          break;
        case "audio":
          audio[data.func](...data.params);
          break;
        case "audioBatch":
          for (let {func, params} of data.batch) {
            audio[func](...params);
          }
          break;
        case "fs":
          fs[data.func](...data.params);
          break;
        case "cursor":
          api.setCursorPos(data.x, data.y);
          break;
        case "keyboard":
          api.openKeyboard(data.rect);
          break;
        case "error":
          audio.stop_all();
          api.onError(data.error, data.stack);
          break;
        case "failed":
          reject({message: data.error, stack: data.stack});
          break;
        case "progress":
          api.onProgress({text: data.text, loaded: data.loaded, total: data.total});
          break;
        case "exit":
          api.onExit();
          break;
        case "current_save":
          api.setCurrentSave(data.name);
          break;
          case "packet":
          webrtc.send(data.buffer);
          break;
        case "packetBatch":
          for (let packet of data.batch) {
            webrtc.send(packet);
          }
          break;
        default:
        }
      });          
      const transfer= [];
      for (let [, file] of fs.files) {
        transfer.push(file.buffer);
      }
      worker.postMessage({action: "init", files: fs.files, mpq, spawn, offscreen}, transfer);
      setInterval(() => {
        if (packetQueue.length) {
          worker.postMessage({action: "packetBatch", batch: packetQueue}, packetQueue);
          packetQueue.length = 0;
        }
      }, 20);
      delete fs.files;
    } catch (e) {
      reject(e);
    }
  });
}

export default function load_game(api, mpq, spawn) {
  const audio = init_sound();
  return do_load_game(api, audio, mpq, spawn);
}
