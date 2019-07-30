import IdbKvStore from  'idb-kv-store';

export default async function create_fs() {
  try {
    const store = new IdbKvStore('diablo_fs');
    const files = new Map();
    for (let [name, data] of Object.entries(await store.json())) {
      files.set(name, data);
    }
    return {
      files,
      update: (name, data) => store.set(name, data),
      delete: name => store.remove(name),
    };
  } catch (e) {
    return {
      files: new Map(),
      update: () => Promise.resolve(),
      delete: () => Promise.resolve(),
    };
  }  
}
