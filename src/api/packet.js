export class buffer_reader {
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
  read_buf() {
    const size = this.read32();
    const result = this.buffer.subarray(this.pos, this.pos + size);
    this.pos += size;
    return result;
  }
}
export class buffer_writer {
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
    this.pos += value.byteLength;
    return this;
  }
  write_buf(value) {
    this.write32(value.byteLength);
    this.rest(value);
    return this;
  }
}

export const RejectionReason = {
  JOIN_SUCCESS: 0x00,
  JOIN_ALREADY_IN_GAME: 0x01,
  JOIN_GAME_NOT_FOUND: 0x02,
  JOIN_INCORRECT_PASSWORD: 0x03,
  JOIN_VERSION_MISMATCH: 0x04,
  JOIN_GAME_FULL: 0x05,
  CREATE_GAME_EXISTS: 0x06,
};

export function read_packet(reader, types) {
  const code = reader.read8();
  const cls = Object.values(types).find(cls => cls.code === code);
  if (!cls) {
    throw Error('invalid packet code');
  }
  return {type: cls, packet: cls.read(reader)};
}
export function packet_size(type, packet) {
  return (typeof type.size === "function" ? type.size(packet) : type.size) + 1;
}
export function write_packet(type, packet) {
  const size = packet_size(type, packet);
  return type.write(new buffer_writer(size).write8(type.code), packet).result;
}

export function make_batch(types) {
  return {
    code: 0x00,
    read: reader => {
      const count = reader.read16();
      const packets = [];
      for (let i = 0; i < count; ++i) {
        packets.push(read_packet(reader, types()));
      }
      return packets;
    },
    size: packets => packets.reduce((sum, {type, packet}) => sum + packet_size(type, packet), 2),
    write: (writer, packets) => {
      writer.write16(packets.length);
      for (let {type, packet} of packets) {
        type.write(writer.write8(type.code), packet);
      }
      return writer;
    },
  };
}

export const server_packet = {
  info: {
    code: 0x32,
    read: reader => ({version: reader.read32()}),
    size: 4,
    write: (writer, {version}) => writer.write32(version),
  },
  game_list: {
    code: 0x21,
    read: reader => {
      const count = reader.read16();
      const games = [];
      for (let i = 0; i < count; ++i) {
        games.push({type: reader.read32(), name: reader.read_str()});
      }
      return {games};
    },
    size: ({games}) => games.reduce((sum, {name}) => sum + 5 + name.length, 2),
    write: (writer, {games}) => {
      writer.write16(games.length);
      for (let {type, name} of games) {
        writer.write32(type);
        writer.write_str(name);
      }
      return writer;
    },
  },
  join_accept: {
    code: 0x12,
    read: reader => ({cookie: reader.read32(), index: reader.read8(), seed: reader.read32(), difficulty: reader.read32()}),
    size: 13,
    write: (writer, {cookie, index, seed, difficulty}) => writer.write32(cookie).write8(index).write32(seed).write32(difficulty),
  },
  join_reject: {
    code: 0x15,
    read: reader => ({cookie: reader.read32(), reason: reader.read8()}),
    size: 5,
    write: (writer, {cookie, reason}) => writer.write32(cookie).write8(reason),
  },
  connect: {
    code: 0x13,
    read: reader => ({id: reader.read8()}),
    size: 1,
    write: (writer, {id}) => writer.write8(id),
  },
  disconnect: {
    code: 0x14,
    read: reader => ({id: reader.read8(), reason: reader.read32()}),
    size: 5,
    write: (writer, {id, reason}) => writer.write8(id).write32(reason),
  },
  message: {
    code: 0x01,
    read: reader => ({id: reader.read8(), payload: reader.read_buf()}),
    size: ({payload}) => 5 + payload.byteLength,
    write: (writer, {id, payload}) => writer.write8(id).write_buf(payload),
  },
  turn: {
    code: 0x02,
    read: reader => ({id: reader.read8(), turn: reader.read32()}),
    size: 5,
    write: (writer, {id, turn}) => writer.write8(id).write32(turn),
  },
  batch: make_batch(() => server_packet),
};

export const client_packet = {
  info: {
    code: 0x31,
    read: reader => ({version: reader.read32()}),
    size: 4,
    write: (writer, {version}) => writer.write32(version),
  },
  game_list: {
    code: 0x21,
    read: () => ({}),
    size: 0,
    write: writer => writer,
  },
  create_game: {
    code: 0x22,
    read: reader => ({cookie: reader.read32(), name: reader.read_str(), password: reader.read_str(), difficulty: reader.read32()}),
    size: ({name, password}) => 10 + name.length + password.length,
    write: (writer, {cookie, name, password, difficulty}) => writer.write32(cookie).write_str(name).write_str(password).write32(difficulty),
  },
  join_game: {
    code: 0x23,
    read: reader => ({cookie: reader.read32(), name: reader.read_str(), password: reader.read_str()}),
    size: ({name, password}) => 6 + name.length + password.length,
    write: (writer, {cookie, name, password}) => writer.write32(cookie).write_str(name).write_str(password),
  },
  leave_game: {
    code: 0x24,
    read: () => ({}),
    size: 0,
    write: writer => writer,
  },
  drop_player: {
    code: 0x03,
    read: reader => ({id: reader.read8(), reason: reader.read32()}),
    size: 5,
    write: (writer, {id, reason}) => writer.write8(id).write32(reason),
  },
  message: {
    code: 0x01,
    read: reader => ({id: reader.read8(), payload: reader.read_buf()}),
    size: ({payload}) => 5 + payload.byteLength,
    write: (writer, {id, payload}) => writer.write8(id).write_buf(payload),
  },
  turn: {
    code: 0x02,
    read: reader => ({turn: reader.read32()}),
    size: 4,
    write: (writer, {turn}) => writer.write32(turn),
  },
  batch: make_batch(() => server_packet),
};
