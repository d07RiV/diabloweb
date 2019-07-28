import SpawnBinary from './DiabloSpawn.wasm';
import SpawnModule from './DiabloSpawn.jscc';
import axios from 'axios';

const SpawnSize = 50274091;

export default async function init_spawn(api) {
  const fs = await(api.fs);
  let size = fs.get_file_size('spawn.mpq');
  if (size !== SpawnSize) {
    fs.remove_file('spawn.mpq');
    size = 0;
  }
  if (!size) {
    const spawn = await axios.request({
      url: '/spawn.mpq',
      responseType: 'arraybuffer',
      onDownloadProgress: e => {
        if (api.onProgress) {
          api.onProgress(e.loaded / (e.total || SpawnSize));
        }
      },
      headers: {
        'Cache-Control': 'max-age=31536000'
      }
    })
    if (spawn.data.byteLength !== SpawnSize) {
      throw Error("Invalid spawn.mpq size. Try clearing cache and refreshing the page.");
    }
    fs.put_file_contents('spawn.mpq', new Uint8Array(spawn.data));
  }

  const wasm = SpawnModule({
    locateFile(name) {
      if (name === 'DiabloSpawn.wasm') {
        return SpawnBinary;
      } else {
        return name;
      }
    }
  });

  return await wasm.ready;
}
