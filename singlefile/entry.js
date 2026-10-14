// Entry point for the single-file (standalone HTML) build.
//
// This is the same as src/index.js, minus the service worker registration:
// a standalone HTML document has no service-worker.js to register, and
// registering one would only produce a 404 (or fail outright on file://).
import React from 'react';
import ReactDOM from 'react-dom';

import '../src/reset.css';
import App from '../src/App';

ReactDOM.render(<App />, document.getElementById('root'));
