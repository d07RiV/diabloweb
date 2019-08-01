import create_fs from './fs';

const fs = create_fs();
window.addEventListener('message', ({data, source}) => {
  if (data.method === 'transfer') {
    fs.then(({files}) => {
      source.postMessage({method: 'storage', files}, '*');
    });
  } else if (data.method === 'clear') {
    fs.then(({clear}) => clear());
  }
});