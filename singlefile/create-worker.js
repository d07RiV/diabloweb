// Worker construction for the single-file build.
//
// worker-loader is not used here: both workers are compiled separately and
// their source is inlined into the page as a string, so this module decides
// how to turn that string into something worker-shaped:
//
//   * a real Worker built from a blob: URL (the normal case), or
//   * InlineWorker, which runs the same code on the main thread - required
//     when the page is opened from disk, because browsers refuse to create
//     workers from blob:/data: URLs in a file:// document.
import InlineWorker from './inline-worker';

function usingFileProtocol() {
  try {
    return typeof location !== 'undefined' && location.protocol === 'file:';
  } catch (e) {
    return false;
  }
}

function supportsBlobWorkers() {
  return typeof Worker === 'function'
    && typeof Blob === 'function'
    && typeof URL === 'function'
    && typeof URL.createObjectURL === 'function';
}

export function createWorker(code) {
  if (!usingFileProtocol() && supportsBlobWorkers()) {
    let url = null;
    try {
      url = URL.createObjectURL(new Blob([code], {type: 'application/javascript'}));
      const worker = new Worker(url);
      // The app only listens for "message"; make script failures visible anyway.
      worker.addEventListener('error', event => {
        // eslint-disable-next-line no-console
        console.error('[diabloweb] worker failed:', event && (event.message || event.type));
      });
      // The script is fetched right away; drop the URL once it has had time to load.
      setTimeout(() => {
        try {
          URL.revokeObjectURL(url);
        } catch (e) {
          /* ignore */
        }
      }, 60000);
      return worker;
    } catch (e) {
      if (url) {
        try {
          URL.revokeObjectURL(url);
        } catch (ignored) {
          /* ignore */
        }
      }
      // eslint-disable-next-line no-console
      console.warn('[diabloweb] could not start a real worker, falling back to the main thread:', e);
    }
  }
  if (typeof window !== 'undefined') {
    window.__diablowebInlineWorker = true;
  }
  return new InlineWorker(code);
}

// `new Worker()` in the app code keeps working: a constructor that returns an
// object yields that object.
export function createWorkerFactory(code) {
  return function InlinedWorker() {
    return createWorker(code);
  };
}

export default createWorker;
