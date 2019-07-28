import IdbKvStore from  'idb-kv-store';

function simple_fs(api, writeFunc) {
  const files = api.files;
  return {
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
      files.set(path, array);
      if (writeFunc) {
        writeFunc(path, array);
      }
    },
    remove_file(path) {
      path = path.toLowerCase();
      files.delete(path)
      if (writeFunc) {
        writeFunc(path, null);
      }
    },
    download_file(path) {
      const data = files.get(path.toLowerCase());
      if (data) {
        const blob = new Blob([data], {type: 'binary/octet-stream'});
        const url = URL.createObjectURL(blob);
        const lnk = document.createElement('a');
        lnk.setAttribute('href', url);
        lnk.setAttribute('download', path);
        document.body.appendChild(lnk);
        lnk.click();
        document.body.removeChild(lnk);
        URL.revokeObjectURL(url);
      }
    },
  };
}

export default async function init_fs(api) {
  try {
    const store = new IdbKvStore('diablo_fs');
    const files = await store.json();
    for (let [name, data] of Object.entries(files)) {
      api.files.set(name, data);
    }
    return simple_fs(api, (name, data) => {
      if (data) {
        return store.set(name, data);
      } else {
        return store.remove(name);
      }
    });
  } catch (e) {
    return simple_fs(api);
  }  
}
