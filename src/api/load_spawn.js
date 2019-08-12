import axios from 'axios';

const SpawnSizes = [50274091, 25830791];

export { SpawnSizes };

export default async function load_spawn(api, fs) {
  let file = fs.files.get('spawn.mpq');
  if (file && !SpawnSizes.includes(file.byteLength)) {
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
          api.onProgress({text: 'Downloading...', loaded: e.loaded, total: e.total || SpawnSizes[1]});
        }
      },
      headers: {
        'Cache-Control': 'max-age=31536000'
      }
    });
    if (!SpawnSizes.includes(spawn.data.byteLength)) {
      throw Error("Invalid spawn.mpq size. Try clearing cache and refreshing the page.");
    }
    const data = new Uint8Array(spawn.data);
    fs.files.set('spawn.mpq', data);
    fs.update('spawn.mpq', data.slice());
  }
  return fs;
}
