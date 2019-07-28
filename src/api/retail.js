import DiabloBinary from './Diablo.wasm';
import DiabloModule from './Diablo.jscc';

const readFile = file => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(reader.result);
  reader.onerror = () => reject(reader.error);
  reader.onabort = () => reject();
  reader.readAsArrayBuffer(file);
});

export default async function init_retail(api, mpq) {
  api.files.delete('spawn.mpq');
  api.files.set('diabdat.mpq', new Uint8Array(await readFile(mpq)));
  
  const wasm = DiabloModule({
    locateFile(name) {
      if (name === 'Diablo.wasm') {
        return DiabloBinary;
      } else {
        return name;
      }
    }
  });

  return await wasm.ready;
}
