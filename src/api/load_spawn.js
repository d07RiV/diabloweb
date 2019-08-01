import axios from 'axios';

const SpawnSize = 50274091;

export { SpawnSize };

export default async function load_spawn(api, fs) {
  let file = fs.files.get('spawn.mpq');
  if (file && file.byteLength !== SpawnSize) {
    fs.files.delete('spawn.mpq');
    await fs.delete('spawn.mpq');
    file = null;
  }
  if (!file) {
    const spawn = await axios.request({
      url: process.env.PUBLIC_URL + '/spawn.mpq',
      responseType: 'arraybuffer',
      onDownloadProgress: e => {
        if (api.onProgress) {
          api.onProgress({text: 'Downloading...', loaded: e.loaded, total: e.total || SpawnSize});
        }
      },
      headers: {
        'Cache-Control': 'max-age=31536000'
      }
    });
    if (spawn.data.byteLength !== SpawnSize) {
      throw Error("Invalid spawn.mpq size. Try clearing cache and refreshing the page.");
    }
    const data = new Uint8Array(spawn.data);
    fs.files.set('spawn.mpq', data);
    fs.update('spawn.mpq', data.slice());
  }
  return fs;
}
