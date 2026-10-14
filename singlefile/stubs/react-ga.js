// No-op replacement for react-ga used by the single-file build.
//
// A standalone HTML document should not phone home to Google Analytics
// (and usually cannot, e.g. when opened straight from disk).
const noop = () => {};

const ReactGA = {
  initialize: noop,
  ga: noop,
  set: noop,
  send: noop,
  pageview: noop,
  modalview: noop,
  timing: noop,
  event: noop,
  exception: noop,
  testModeAPI: {},
  outboundLink: (args, hitCallback) => {
    if (typeof hitCallback === 'function') {
      hitCallback();
    }
  },
  plugin: {
    require: noop,
    execute: noop,
  },
};

export default ReactGA;
