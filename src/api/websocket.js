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
  let ws = null, batch = [], intr = null;
  const proxy = {
    get readyState() {
      return ws ? ws.readyState : 0;
    },
    send(msg) {
      batch.push(msg.slice());
    },
    close() {
      if (intr) {
        clearInterval(intr);
        intr = null;
      }
      if (ws) {
        ws.close();
      } else {
        batch = null;
      }
    },
  };
  do_websocket_open(url, handler).then(sock => {
    ws = sock;
    if (batch) {
      intr = setInterval(() => {
        if (!batch.length) {
          return;
        }
        const size = batch.reduce((sum, msg) => sum + msg.byteLength, 3);
        const buffer = new Uint8Array(size);
        buffer[0] = 0;
        buffer[1] = (batch.length & 0xFF);
        buffer[2] = batch.length >> 8;
        let pos = 3;
        for (let msg of batch) {
          buffer.set(msg, pos);
          pos += msg.byteLength;
        }
        ws.send(buffer);
        batch.length = 0;
      }, 100);
    } else {
      ws.close();
    }
    finisher(0);
  }, err => {
    finisher(err);
  });
  return proxy;
}
