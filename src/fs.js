import IdbKvStore from  'idb-kv-store';

/*const importStorage = () => new Promise((resolve, reject) => {
  let done = false;
  const frame = document.createElement('iframe');
  window.addEventListener('message', ({data}) => {
    if (data.method === 'storage' && !done) {
      done = true;
      resolve(data.files);
      frame.contentWindow.postMessage({method: 'clear'}, '*');
    }
  });
  frame.addEventListener('load', () => {
    frame.contentWindow.postMessage({method: 'transfer'}, '*');
  });
  frame.addEventListener('error', () => {
    if (!done) {
      done = true;
      resolve(null);
    }
  });
  frame.src = "https://diablo.rivsoft.net/storage.html";
  frame.style.display = "none";
  document.body.appendChild(frame);
  setTimeout(() => {
    if (!done) {
      done = true;
      resolve(null);
    }
  }, 10000);
});*/

async function downloadFile(store, name) {
  const file = await store.get(name.toLowerCase());
  if (file) {
    const blob = new Blob([file], {type: 'binary/octet-stream'});
    const url = URL.createObjectURL(blob);
    const lnk = document.createElement('a');
    lnk.setAttribute('href', url);
    lnk.setAttribute('download', name);
    document.body.appendChild(lnk);
    lnk.click();
    document.body.removeChild(lnk);
    URL.revokeObjectURL(url);
  } else {
    console.error(`File ${name} does not exist`);
  }
}

async function downloadSaves(store) {
  for (let name of await store.keys()) {
    if (name.match(/\.sv$/i)) {
      downloadFile(store, name);
    }
  }
}

const readFile = file => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(reader.result);
  reader.onerror = () => reject(reader.error);
  reader.onabort = () => reject();
  reader.readAsArrayBuffer(file);
});
async function uploadFile(store, files, file) {
  const data = new Uint8Array(await readFile(file));
  files.set(file.name.toLowerCase(), data);
  return store.set(file.name.toLowerCase(), data);
}

export default async function create_fs(load) {
  try {
    const store = new IdbKvStore('diablo_fs');
    const files = new Map();
    for (let [name, data] of Object.entries(await store.json())) {
      files.set(name, data);
    }
    /*if (load) {
      const files = await importStorage();
      if (files) {
        for (let [name, data] of files) {
          files.set(name, data);
          store.set(name, data);
        }
      }
    }*/
    window.DownloadFile = name => downloadFile(store, name);
    window.DownloadSaves = () => downloadSaves(store);
    return {
      files,
      update: (name, data) => store.set(name, data),
      delete: name => store.remove(name),
      clear: () => store.clear(),
      download: name => downloadFile(store, name),
      upload: file => uploadFile(store, files, file),
      fileUrl: async name => {
        const file = await store.get(name.toLowerCase());
        if (file) {
          const blob = new Blob([file], {type: 'binary/octet-stream'});
          return URL.createObjectURL(blob);
        }
      },
    };
  } catch (e) {
    window.DownloadFile = () => console.error('IndexedDB is not supported');
    window.DownloadSaves = () => console.error('IndexedDB is not supported');
    return {
      files: new Map(),
      update: () => Promise.resolve(),
      delete: () => Promise.resolve(),
      clear: () => Promise.resolve(),
      download: () => Promise.resolve(),
      upload: () => Promise.resolve(),
      fileUrl: () => Promise.resolve(),
    };
  }  
}
