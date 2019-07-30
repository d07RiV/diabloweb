import Worker from './game.worker.js';
import init_sound from './sound';
import load_spawn from './load_spawn';

async function do_load_game(api, audio, mpq) {
  const fs = await api.fs;
  if (mpq) {
    fs.files.delete('spawn.mpq');
  } else {
    await load_spawn(api, fs);
  }
  return await new Promise((resolve, reject) => {
    try {
      const worker = new Worker();
      worker.addEventListener("message", ({data}) => {
        switch (data.action) {
        case "loaded":
          resolve((func, ...params) => worker.postMessage({action: "event", func, params}));
          break;
        case "render":
          api.onRender(data.batch);
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
          api.openKeyboard(data.open);
          break;
        case "error":
          api.onError(data.error);
          break;
        case "failed":
          reject(Error(data.error));
          break;
        default:
        }
      });
      worker.postMessage({action: "init", files: fs.files, mpq});
      delete fs.files;
    } catch (e) {
      reject(e);
    }
  });
}

export default function load_game(api, mpq) {
  const audio = init_sound();
  return do_load_game(api, audio, mpq);
}
