import IdbKvStore from  'idb-kv-store';

const importStorage = () => new Promise((resolve, reject) => {
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
});

export default async function create_fs(load) {
  try {
    const store = new IdbKvStore('diablo_fs');
    const files = new Map();
    for (let [name, data] of Object.entries(await store.json())) {
      files.set(name, data);
    }
    if (load) {
      const files = await importStorage();
      if (files) {
        for (let [name, data] of files) {
          files.set(name, data);
          store.set(name, data);
        }
      }
    }
    return {
      files,
      update: (name, data) => store.set(name, data),
      delete: name => store.remove(name),
      clear: () => store.clear(),
    };
  } catch (e) {
    return {
      files: new Map(),
      update: () => Promise.resolve(),
      delete: () => Promise.resolve(),
      clear: () => Promise.resolve(),
    };
  }  
}
