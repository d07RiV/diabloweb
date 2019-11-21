import Peer from 'peerjs';
import { buffer_reader, read_packet, write_packet, client_packet, server_packet, RejectionReason } from './packet';

/*function log_packet(data, type) {
  const reader = new buffer_reader(data);
  const id = reader.read8();
  for (let [name, {code, read}] of Object.entries(type)) {
    if (code === id && (name !== 'message' && name !== 'turn')) {
      console.log(`${type === client_packet ? 'client_packet' : 'server_packet'}.${name} ${JSON.stringify(read(reader))}`);
    }
  }
}*/

const PeerID = name => `diabloweb_dDv62yHQrZJP28tBEHL_${name}`;
const Options = {port: 443, secure: true};
const MAX_PLRS = 4;

class webrtc_server {
  constructor(version, {cookie, name, password, difficulty}, onMessage, onClose) {
    this.version = version;
    this.name = name;
    this.password = password;
    this.difficulty = difficulty;
    this.onMessage = onMessage;
    this.onClose = onClose;

    this.peer = new Peer(PeerID(name), Options);
    this.peer.on('connection', conn => this.onConnect(conn));
    this.players = [];
    this.myplr = 0;

    this.seed = Math.floor(Math.random() * Math.pow(2, 32));

    const onError = () => {
      onMessage(write_packet(server_packet.join_reject, {cookie, reason: RejectionReason.CREATE_GAME_EXISTS}));
      onClose();
      this.peer.off('error', onError);
      this.peer.off('open', onOpen);
    };
    const onOpen = () => {
      //console.log('peer open');
      setTimeout(() => {
        onMessage(write_packet(server_packet.join_accept, {cookie, index: 0, seed: this.seed, difficulty}));
        onMessage(write_packet(server_packet.connect, {id: 0}));
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
      const {type, packet: pkt} = read_packet(reader, client_packet);
      switch (type.code) {
      case client_packet.info.code:
        peer.version = pkt.version;
        break;
      case client_packet.join_game.code:
        if (peer.version !== this.version) {
          conn.send(write_packet(server_packet.join_reject, {cookie: pkt.cookie, reason: RejectionReason.JOIN_VERSION_MISMATCH}));
        } else if (pkt.name !== this.name) {
          conn.send(write_packet(server_packet.join_reject, {cookie: pkt.cookie, reason: RejectionReason.JOIN_GAME_NOT_FOUND}));
        } else if (pkt.password !== this.password) {
          conn.send(write_packet(server_packet.join_reject, {cookie: pkt.cookie, reason: RejectionReason.JOIN_INCORRECT_PASSWORD}));
        } else {
          let i = 1;
          while (i < MAX_PLRS && this.players[i]) {
            ++i;
          }
          if (i >= MAX_PLRS) {
            conn.send(write_packet(server_packet.join_reject, {cookie: pkt.cookie, reason: RejectionReason.JOIN_GAME_FULL}));            
          } else {
            this.players[i] = peer;
            peer.id = i;
            conn.send(write_packet(server_packet.join_accept, {cookie: pkt.cookie, index: i, seed: this.seed, difficulty: this.difficulty}));
            this.send(0xFF, write_packet(server_packet.connect, {id: i}));
          }
        }
        break;
      default:
        if (peer.id != null) {
          this.handle(peer.id, type.code, pkt);
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
      this.onMessage(write_packet(server_packet.disconnect, {id, reason}));
      this.peer.destroy();
      this.onClose();
    } else if (this.players[id]) {
      this.send(0xFF, write_packet(server_packet.disconnect, {id, reason}));
      this.players[id].id = null;
      if (this.players[id].conn) {
        this.players[id].conn.close();
      }
      this.players[id] = null;
    }
  }

  handle(id, code, pkt) {
    switch (code) {
    case client_packet.leave_game.code:
      this.drop(id, 3);
      break;
    case client_packet.drop_player.code:
      this.drop(pkt.id, pkt.reason);
      break;
    case client_packet.message.code:
      this.send(pkt.id === 0xFF ? ~(1 << id) : (1 << pkt.id), write_packet(server_packet.message, {id, payload: pkt.payload}));
      break;
    case client_packet.turn.code:
      this.send(~(1 << id), write_packet(server_packet.turn, {id, turn: pkt.turn}));
      break;
    default:
      throw Error(`invalid packet ${code}`);
    }
  }
}

class webrtc_client {
  pending = [];

  constructor(version, {cookie, name, password}, onMessage, onClose) {
    this.peer = new Peer(Options);
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
      onMessage(write_packet(server_packet.join_reject, {cookie, reason: RejectionReason.JOIN_GAME_NOT_FOUND}));
      onClose();
      unreg();
    };
    const onOpen = () => {
      this.conn.send(write_packet(client_packet.info, {version}));
      this.conn.send(write_packet(client_packet.join_game, {cookie, name, password}));
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
      const {type, packet: pkt} = read_packet(reader, server_packet);
      switch (type.code) {
      case server_packet.join_accept.code:
        this.myplr = pkt.index;
        break;
      case server_packet.join_reject.code:
        onClose();
        break;
      case server_packet.disconnect.code:
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
      const {type, packet: pkt} = read_packet(reader, client_packet);
      switch (type.code) {
      case client_packet.info.code:
        version = pkt.version;
        break;
      case client_packet.create_game.code:
        if (server || client) {
          onMessage(write_packet(server_packet.join_reject, {cookie: pkt.cookie, reason: RejectionReason.JOIN_ALREADY_IN_GAME}));
        } else {
          server = new webrtc_server(version, pkt, onMessage, () => server = null);
        }
        break;
      case client_packet.join_game.code:
        if (server || client) {
          onMessage(write_packet(server_packet.join_reject, {cookie: pkt.cookie, reason: RejectionReason.JOIN_ALREADY_IN_GAME}));
        } else {
          client = new webrtc_client(version, pkt, onMessage, () => client = null);
        }
        break;
      default:
        if (server) {
          server.handle(0, type.code, pkt);
          if (type.code === client_packet.leave_game.code) {
            server = null;
          }
        } else if (client) {
          client.send(packet);
          if (type.code === client_packet.leave_game.code) {
            client = null;
          }
          return;
        } else if (type.code !== client_packet.leave_game.code) {
          throw Error(`invalid packet ${type.code}`);
        }
      }
      if (!reader.done()) {
        throw Error('packet too large');
      }
    },
  };
}
