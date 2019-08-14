async function do_websocket_open(url, handler) {
  const socket = new WebSocket(url);
  socket.binaryType = "arraybuffer";
  let versionCbk = null;
  socket.addEventListener("message", ({data}) => {
    if (versionCbk) {
      versionCbk(data);
    }
    handler(data);
  });
  await new Promise((resolve, reject) => {
    const onError = err => reject(1);
    socket.addEventListener("error", onError);
    socket.addEventListener("open", () => {
      socket.removeEventListener("error", onError);
      resolve();
    });
  });
  await new Promise((resolve, reject) => {
    const to = setTimeout(() => {
      versionCbk = null;
      reject(1);
    }, 5000);
    versionCbk = data => {
      clearTimeout(to);
      const u8 = new Uint8Array(data);
      if (u8[0] === 0x32) {
        versionCbk = null;
        const version = u8[1] | (u8[2] << 8) | (u8[3] << 16) | (u8[4] << 24);
        if (version === 1) {
          resolve();
        } else {
          reject(2);
        }
      }
    };
  });

  const vers = process.env.VERSION.match(/(\d+)\.(\d+)\.(\d+)/);
  const clientInfo = new Uint8Array(5);
  clientInfo[0] = 0x31;
  clientInfo[1] = parseInt(vers[3]);
  clientInfo[2] = parseInt(vers[2]);
  clientInfo[3] = parseInt(vers[1]);
  clientInfo[4] = 0;
  socket.send(clientInfo);
  return socket;
}

export default function websocket_open(url, handler, finisher) {
  let ws = null, pending = [];
  const proxy = {
    get readyState() {
      return ws ? ws.readyState : 0;
    },
    send(msg) {
      if (ws) {
        ws.send(msg);
      } else {
        pending.push(msg.slice());
      }
    },
    close() {
      if (ws) {
        ws.close();
      } else {
        pending = null;
      }
    },
  };
  do_websocket_open(url, handler).then(sock => {
    ws = sock;
    if (pending) {
      for (let msg of pending) {
        ws.send(msg);
      }
    } else {
      ws.close();
    }
    finisher(0);
  }, err => {
    finisher(err);
  });
  return proxy;
}
