import Worker from './mpqcmp.worker.js';

export default function compress(mpq, progress) {
  progress("Loading...");
  return new Promise((resolve, reject) => {
    try {
      const worker = new Worker();
      worker.addEventListener("message", ({data}) => {
        switch (data.action) {
        case "result":
          resolve(data.result);
          break;
        case "error":
          reject({message: data.error, stack: data.stack});
          break;
        case "progress":
          progress(data.text, data.loaded, data.total);
          break;
        default:
        }
      });
      worker.postMessage({action: "run", mpq});
    } catch (e) {
      reject(e);
    }
  });
}
