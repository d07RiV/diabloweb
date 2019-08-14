import Peer from 'peerjs';

class buffer_reader {
  constructor(buffer) {
    this.buffer = (buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer));
    this.pos = 0;
  }
  done() {
    return this.pos === this.buffer.byteLength;
  }
  read8() {
    if (this.pos >= this.buffer.byteLength) {
      throw Error('packet too small');
    }
    return this.buffer[this.pos++];
  }
  read16() {
    const {pos, buffer} = this;
    if (pos + 2 > buffer.byteLength) {
      throw Error('packet too small');
    }
    const result = buffer[pos] | (buffer[pos + 1] << 8);
    this.pos += 2;
    return result;
  }
  read32() {
    const {pos, buffer} = this;
    if (pos + 4 > buffer.byteLength) {
      throw Error('packet too small');
    }
    const result = buffer[pos] | (buffer[pos + 1] << 8) | (buffer[pos + 2] << 16) | (buffer[pos + 3] << 24);
    this.pos += 4;
    return result;
  }
  read_str() {
    const length = this.read8();
    const {pos, buffer} = this;
    if (pos + length > buffer.byteLength) {
      throw Error('packet too small');
    }
    const result = String.fromCharCode(...buffer.subarray(pos, pos + length));
    this.pos += length;
    return result;
  }
  rest() {
    const result = this.buffer.subarray(this.pos);
    this.pos = this.buffer.length;
    return result;
  }
}
class buffer_writer {
  constructor(length) {
    this.buffer = new Uint8Array(length);
    this.pos = 0;
  }
  get result() {
    return this.buffer.buffer;
  }
  write8(value) {
    this.buffer[this.pos++] = value;
    return this;
  }
  write16(value) {
    const {pos, buffer} = this;
    buffer[pos] = value;
    buffer[pos + 1] = value >> 8;
    this.pos += 2;
    return this;
  }
  write32(value) {
    const {pos, buffer} = this;
    buffer[pos] = value;
    buffer[pos + 1] = value >> 8;
    buffer[pos + 2] = value >> 16;
    buffer[pos + 3] = value >> 24;
    this.pos += 4;
    return this;
  }
  write_str(value) {
    const length = value.length;
    this.write8(length);
    const {pos, buffer} = this;
    for (let i = 0; i < length; ++i) {
      buffer[pos + i] = value.charCodeAt(i);
    }
    this.pos += length;
    return this;
  }
  rest(value) {
    this.buffer.set(value, this.pos);
    return this;
  }
}

const RejectionReason = {
  JOIN_SUCCESS: 0x00,
  JOIN_ALREADY_IN_GAME: 0x01,
  JOIN_GAME_NOT_FOUND: 0x02,
  JOIN_INCORRECT_PASSWORD: 0x03,
  JOIN_VERSION_MISMATCH: 0x04,
  JOIN_GAME_FULL: 0x05,
  CREATE_GAME_EXISTS: 0x06,
};

const server_packet = {
  info: {
    code: 0x32,
    read: reader => ({version: reader.read32()}),
    write: ({version}) => new buffer_writer(5).write8(server_packet.info.code).write32(version).result,
  },
  game_list: {
    code: 0x21,
    read: reader => {
      const count = reader.read8();
      const games = [];
      for (let i = 0; i < count; ++i) {
        games.push({type: reader.read32(), name: reader.read_str()});
      }
      return {games};
    },
    write: ({games}) => {
      const writer = new buffer_writer(games.reduce((sum, {name}) => sum + 5 + name.length, 2));
      writer.write8(server_packet.game_list.code);
      writer.write8(games.length);
      for (let {code, name} of games) {
        writer.write32(code);
        writer.write_str(name);
      }
      return writer.result;
    },
  },
  join_accept: {
    code: 0x12,
    read: reader => ({cookie: reader.read32(), index: reader.read8(), seed: reader.read32(), difficulty: reader.read32()}),
    write: ({cookie, index, seed, difficulty}) => new buffer_writer(14).write8(server_packet.join_accept.code).write32(cookie).write8(index).write32(seed).write32(difficulty).result,
  },
  join_reject: {
    code: 0x15,
    read: reader => ({cookie: reader.read32(), reason: reader.read8()}),
    write: ({cookie, reason}) => new buffer_writer(6).write8(server_packet.join_reject.code).write32(cookie).write8(reason).result,
  },
  connect: {
    code: 0x13,
    read: reader => ({id: reader.read8()}),
    write: ({id}) => new buffer_writer(2).write8(server_packet.connect.code).write8(id).result,
  },
  disconnect: {
    code: 0x14,
    read: reader => ({id: reader.read8(), reason: reader.read32()}),
    write: ({id, reason}) => new buffer_writer(6).write8(server_packet.disconnect.code).write8(id).write32(reason).result,
  },
  message: {
    code: 0x01,
    read: reader => ({id: reader.read8(), payload: reader.rest()}),
    write: ({id, payload}) => new buffer_writer(2 + payload.byteLength).write8(server_packet.message.code).write8(id).rest(payload).result,
  },
  turn: {
    code: 0x02,
    read: reader => ({id: reader.read8(), turn: reader.read32()}),
    write: ({id, turn}) => new buffer_writer(6).write8(server_packet.turn.code).write8(id).write32(turn).result,
  },
};

const client_packet = {
  info: {
    code: 0x31,
    read: reader => ({version: reader.read32()}),
    write: ({version}) => new buffer_writer(5).write8(client_packet.info.code).write32(version).result,
  },
  game_list: {
    code: 0x21,
    read: () => ({}),
    write: () => new buffer_writer(1).write8(client_packet.game_list.code).result,
  },
  create_game: {
    code: 0x22,
    read: reader => ({cookie: reader.read32(), name: reader.read_str(), password: reader.read_str(), difficulty: reader.read32()}),
    write: ({cookie, name, password, difficulty}) => new buffer_writer(11 + name.length + password.length)
      .write8(client_packet.create_game.code).write32(cookie).write_str(name).write_str(password).write32(difficulty).result,
  },
  join_game: {
    code: 0x23,
    read: reader => ({cookie: reader.read32(), name: reader.read_str(), password: reader.read_str()}),
    write: ({cookie, name, password}) => new buffer_writer(7 + name.length + password.length)
      .write8(client_packet.join_game.code).write32(cookie).write_str(name).write_str(password).result,
  },
  leave_game: {
    code: 0x24,
    read: () => ({}),
    write: () => new buffer_writer(1).write8(client_packet.leave_game.code).result,
  },
  drop_player: {
    code: 0x03,
    read: reader => ({id: reader.read8(), reason: reader.read32()}),
    write: ({id, reason}) => new buffer_writer(6).write8(client_packet.drop_player.code).write8(id).write32(reason).result,
  },
  message: {
    code: 0x01,
    read: reader => ({id: reader.read8(), payload: reader.rest()}),
    write: ({id, payload}) => new buffer_writer(2 + payload.byteLength).write8(client_packet.message.code).write8(id).rest(payload).result,
  },
  turn: {
    code: 0x02,
    read: reader => ({turn: reader.read32()}),
    write: ({turn}) => new buffer_writer(5).write8(client_packet.turn.code).write32(turn).result,
  },
};

/*function log_packet(data, type) {
  const reader = new buffer_reader(data);
  const id = reader.read8();
  for (let [name, {code, read}] of Object.entries(type)) {
    if (code === id && (name !== 'message' && name !== 'turn')) {
      console.log(`${type === client_packet ? 'client_packet' : 'server_packet'}.${name} ${JSON.stringify(read(reader))}`);
    }
  }
}*/

const PeerID = name => `diabloweb_${name}`;
const MAX_PLRS = 4;

class webrtc_server {
  constructor(version, {cookie, name, password, difficulty}, onMessage, onClose) {
    this.version = version;
    this.name = name;
    this.password = password;
    this.difficulty = difficulty;
    this.onMessage = onMessage;
    this.onClose = onClose;

    this.peer = new Peer(PeerID(name));
    this.peer.on('connection', conn => this.onConnect(conn));
    this.players = [];
    this.myplr = 0;

    this.seed = Math.floor(Math.random() * Math.pow(2, 32));

    const onError = () => {
      onMessage(server_packet.join_reject.write({cookie, reason: RejectionReason.CREATE_GAME_EXISTS}));
      onClose();
      this.peer.off('error', onError);
      this.peer.off('open', onOpen);
    };
    const onOpen = () => {
      //console.log('peer open');
      setTimeout(() => {
        onMessage(server_packet.join_accept.write({cookie, index: 0, seed: this.seed, difficulty}));
        onMessage(server_packet.connect.write({id: 0}));
      }, 0);
      this.peer.off('error', onError);
      this.peer.off('open', onOpen);
    };
    this.peer.on('error', onError);
    this.peer.on('open', onOpen);

    //this.peer.on('error', err => console.log('peer error:', err));
  }

  onConnect(conn) {
    //conn.on('error', err => console.log('conn error:', err));
    //console.log('conn open');
    const peer = {conn};
    conn.on('data', packet => {
      const reader = new buffer_reader(packet);
      const code = reader.read8();
      let pkt;
      switch (code) {
      case client_packet.info.code:
        pkt = client_packet.info.read(reader);
        peer.version = pkt.version;
        break;
      case client_packet.join_game.code:
        pkt = client_packet.join_game.read(reader);
        if (peer.version !== this.version) {
          conn.send(server_packet.join_reject.write({cookie: pkt.cookie, reason: RejectionReason.JOIN_VERSION_MISMATCH}));
        } else if (pkt.name !== this.name) {
          conn.send(server_packet.join_reject.write({cookie: pkt.cookie, reason: RejectionReason.JOIN_GAME_NOT_FOUND}));
        } else if (pkt.password !== this.password) {
          conn.send(server_packet.join_reject.write({cookie: pkt.cookie, reason: RejectionReason.JOIN_INCORRECT_PASSWORD}));
        } else {
          let i = 1;
          while (i < MAX_PLRS && this.players[i]) {
            ++i;
          }
          if (i >= MAX_PLRS) {
            conn.send(server_packet.join_reject.write({cookie: pkt.cookie, reason: RejectionReason.JOIN_GAME_FULL}));            
          } else {
            this.players[i] = peer;
            peer.id = i;
            conn.send(server_packet.join_accept.write({cookie: pkt.cookie, index: i, seed: this.seed, difficulty: this.difficulty}));
            this.send(0xFF, server_packet.connect.write({id: i}));
          }
        }
        break;
      default:
        if (peer.id != null) {
          this.handle(peer.id, code, reader);
        } else {
          return;
        }
      }
      if (!reader.done()) {
        throw Error('packet too large');
      }
    });
    conn.on('close', () => {
      //console.log('conn close');
      if (peer.id != null) {
        this.drop(peer.id, 0x40000006);
      }
    });
  }

  send(mask, pkt) {
    for (let i = 1; i < MAX_PLRS; ++i) {
      if ((mask & (1 << i)) && this.players[i]) {
        if (this.players[i].conn) {
          this.players[i].conn.send(pkt);
        }
      }
    }
    // self last since it will destroy the buffer
    if (mask & 1) {
      this.onMessage(pkt);
    }
  }

  drop(id, reason) {
    if (id === 0) {
      for (let i = 1; i < MAX_PLRS; ++i) {
        this.drop(i, 0x40000006);
      }
      this.onMessage(server_packet.disconnect.write({id, reason}));
      this.peer.destroy();
      this.onClose();
    } else if (this.players[id]) {
      this.send(0xFF, server_packet.disconnect.write({id, reason}));
      this.players[id].id = null;
      if (this.players[id].conn) {
        this.players[id].conn.close();
      }
      this.players[id] = null;
    }
  }

  handle(id, code, reader) {
    let pkt;
    switch (code) {
    case client_packet.leave_game.code:
      pkt = client_packet.leave_game.read(reader);
      this.drop(id, 3);
      break;
    case client_packet.drop_player.code:
      pkt = client_packet.drop_player.read(reader);
      this.drop(pkt.id, pkt.reason);
      break;
    case client_packet.message.code:
      pkt = client_packet.message.read(reader);
      this.send(pkt.id === 0xFF ? ~(1 << id) : (1 << pkt.id), server_packet.message.write({id, payload: pkt.payload}));
      break;
    case client_packet.turn.code:
      pkt = client_packet.turn.read(reader);
      this.send(~(1 << id), server_packet.turn.write({id, turn: pkt.turn}));
      break;
    default:
      throw Error(`invalid packet ${code}`);
    }
  }
}

class webrtc_client {
  pending = [];

  constructor(version, {cookie, name, password}, onMessage, onClose) {
    this.peer = new Peer();
    this.conn = this.peer.connect(PeerID(name));

    let needUnreg = true;
    const unreg = () => {
      if (!needUnreg) {
        return;
      }
      needUnreg = false;
      this.peer.off('error', onError);
      this.conn.off('error', onError);
      this.conn.off('open', onOpen);
      clearTimeout(timeout);
    };
    const onError = () => {
      onMessage(server_packet.join_reject.write({cookie, reason: RejectionReason.JOIN_GAME_NOT_FOUND}));
      onClose();
      unreg();
    };
    const onOpen = () => {
      this.conn.send(client_packet.info.write({version}));
      this.conn.send(client_packet.join_game.write({cookie, name, password}));
      for (let pkt of this.pending) {
        this.conn.send(pkt);
      }
      this.pending = null;
      this.conn.off('open', onOpen);
    };
    const timeout = setTimeout(onError, 10000);
    this.peer.on('error', onError);
    this.conn.on('error', onError);
    this.conn.on('open', onOpen);

    //this.peer.on('error', err => console.log('peer error:', err));
    //this.conn.on('error', err => console.log('conn error:', err));

    this.conn.on('data', data => {
      unreg();
      const reader = new buffer_reader(data);
      const code = reader.read8();
      let pkt;
      switch (code) {
      case server_packet.join_accept.code:
        pkt = server_packet.join_accept.read(reader);
        this.myplr = pkt.index;
        break;
      case server_packet.join_reject.code:
        onClose();
        break;
      case server_packet.disconnect.code:
        pkt = server_packet.disconnect.read(reader);
        if (pkt.id === 'myplr') {
          onClose();
        }
        break;
      default:
      }
      onMessage(data);
    });
    this.conn.on('close', data => {
      onClose();
    });
  }

  send(packet) {
    if (this.pending) {
      this.pending.push(packet);
    } else {
      this.conn.send(packet);
    }
  }
}

export default function webrtc_open(onMessage) {
  let server = null, client = null;

  let version = 0;

  /*const prevMessage = onMessage;
  onMessage = data => {
    log_packet(data, server_packet);
    prevMessage(data);
  };*/

  return {
    send: function(packet) {
      //log_packet(packet, client_packet);
      const reader = new buffer_reader(packet);
      const code = reader.read8();
      let pkt;
      switch (code) {
      case client_packet.info.code:
        pkt = client_packet.info.read(reader);
        version = pkt.version;
        break;
      case client_packet.create_game.code:
        pkt = client_packet.create_game.read(reader);
        if (server || client) {
          onMessage(server_packet.join_reject.write({cookie: pkt.cookie, reason: RejectionReason.JOIN_ALREADY_IN_GAME}));
        } else {
          server = new webrtc_server(version, pkt, onMessage, () => server = null);
        }
        break;
      case client_packet.join_game.code:
        pkt = client_packet.join_game.read(reader);
        if (server || client) {
          onMessage(server_packet.join_reject.write({cookie: pkt.cookie, reason: RejectionReason.JOIN_ALREADY_IN_GAME}));
        } else {
          client = new webrtc_client(version, pkt, onMessage, () => client = null);
        }
        break;
      default:
        if (server) {
          server.handle(0, code, reader);
          if (code === client_packet.leave_game.code) {
            server = null;
          }
        } else if (client) {
          client.send(packet);
          if (code === client_packet.leave_game.code) {
            client = null;
          }
          return;
        } else if (code !== client_packet.leave_game.code) {
          throw Error(`invalid packet ${code}`);
        }
      }
      if (!reader.done()) {
        throw Error('packet too large');
      }
    },
  };
}
