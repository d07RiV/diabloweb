import { explode } from './explode';

function pkzip_decompress(data, out_size) {
  if (data.length === out_size) {
    return data;
  }

  const output = new Uint8Array(out_size);
  let in_pos = 0;
  let out_pos = 0;
  function read_buf(dst) {
    const count = Math.min(data.length - in_pos, dst.length);
    dst.set(data.subarray(in_pos, count));
    in_pos += count;
    return count;
  }
  function write_buf(src) {
    if (out_pos + src.length > out_size) {
      throw Error('decompress buffer overflow');
    }
    output.set(src, out_pos);
    out_pos += src.length;
  }

  if (explode(read_buf, write_buf) || out_pos !== out_size) {
    return null;
  }

  return output;
}

const hashtable = (function() {
  const hashtable = new Uint32Array(1280);
  let seed = 0x00100001;
  for (let i = 0; i < 256; i++) {
    for (let j = i; j < 1280; j += 256) {
      seed = (seed * 125 + 3) % 0x2AAAAB;
      const a = (seed & 0xFFFF) << 16;
      seed = (seed * 125 + 3) % 0x2AAAAB;
      const b = (seed & 0xFFFF);
      hashtable[j] = a | b;
    }
  }
  return hashtable;
})();
function decrypt(u32, key) {
  let seed = 0xEEEEEEEE;
  for (let i = 0; i < u32.length; ++i) {
    seed += hashtable[0x400 + (key & 0xFF)];
    u32[i] ^= seed + key;
    seed = (u32[i] + seed * 33 + 3) | 0;
    key = ((~key << 0x15) + 0x11111111) | (key >>> 0x0B);
  }
}
function decrypt8(u8, key) {
  decrypt(new Uint32Array(u8.buffer, u8.byteOffset, u8.length >> 2), key);
}
function hash(name, type) {
  let seed1 = 0x7FED7FED;
  let seed2 = 0xEEEEEEEE;
  for (let i = 0; i < name.length; ++i) {
    let ch = name.charCodeAt(i);
    if (ch >= 0x61 && ch <= 0x7A) {
      ch -= 0x20;
    }
    if (ch === 0x2F) {
      ch = 0x5C;
    }
    seed1 = hashtable[type * 256 + ch] ^ (seed1 + seed2);
    seed2 = (ch + seed1 + seed2 * 33 + 3) | 0;
  }
  return seed1 >>> 0;
}

function path_name(name) {
  const pos = Math.max(name.lastIndexOf('/'), name.lastIndexOf('\\'));
  return name.substring(pos + 1);
}

const Flags = {
  CompressPkWare: 0x00000100,
  CompressMulti: 0x00000200,
  Compressed: 0x0000FF00,
  Encrypted: 0x00010000,
  FixSeed: 0x00020000,
  PatchFile: 0x00100000,
  SingleUnit: 0x01000000,
  DummyFile: 0x02000000,
  SectorCrc: 0x04000000,
  Exists: 0x80000000,
};

class MpqReader {
  constructor(buffer) {
    this.buffer = buffer;
    this.u8 = new Uint8Array(buffer);
    this.u32 = new Uint32Array(buffer);

    this.readHeader();
  }

  readHeader() {
    const {u8, u32} = this;
    if (u32[0] !== 0x1A51504D) {
      throw Error('invalid MPQ header');
    }
    const sizeId = u8[14] + (u8[15] << 8);
    const hashOffset = u32[4];
    const blockOffset = u32[5];
    const hashCount = u32[6];
    const blockCount = u32[7];
    this.hashTable = this.readTable(hashOffset, hashCount, "(hash table)");
    this.blockTable = this.readTable(blockOffset, blockCount, "(block table)");
    this.blockSize = 1 << (9 + sizeId);
  }

  readTable(offset, count, key) {
    const buffer = new Uint32Array(this.buffer.slice(offset, offset + count * 16));
    decrypt(buffer, hash(key, 3));
    return buffer;
  }

  fileIndex(name) {
    const {hashTable} = this;
    const length = hashTable.length >> 2;
    const index = hash(name, 0) % length;
    const keyA = hash(name, 1), keyB = hash(name, 2);
    for (let i = index, count = 0; hashTable[i * 4 + 3] !== 0xFFFFFFFF && count < length; i = (i + 1) % length, ++count) {
      if (hashTable[i * 4] === keyA && hashTable[i * 4 + 1] === keyB && hashTable[i * 4 + 3] !== 0xFFFFFFFE) {
        return i;
      }
    }
  }

  read(name) {
    const index = this.fileIndex(name);
    if (index == null) {
      return;
    }
    const block = this.hashTable[index * 4 + 3];
    const filePos = this.blockTable[block * 4];
    let cmpSize = this.blockTable[block * 4 + 1];
    const fileSize = this.blockTable[block * 4 + 2];
    const flags = this.blockTable[block * 4 + 3];

    if (flags & Flags.PatchFile) {
      return;
    }
    if (!(flags & Flags.Compressed)) {
      cmpSize = fileSize;
    }

    let key = hash(path_name(name), 3);
    if (flags & Flags.FixSeed) {
      key = (key + filePos) ^ fileSize;
    }

    if (flags & Flags.SingleUnit) {
      const raw = new Uint8Array(this.buffer, filePos, cmpSize);
      if (raw.length !== cmpSize) {
        return;
      }
      if (flags & Flags.Encrypted) {
        decrypt8(raw, key);
      }
      if (flags & Flags.CompressMulti) {
        return;
      } else if (flags & Flags.CompressPkWare) {
        return pkzip_decompress(raw, fileSize);
      }
      return raw;
    } else if (!(flags & Flags.Compressed)) {
      const raw = Uint8Array(this.buffer, filePos, fileSize);
      if (raw.length !== fileSize) {
        return;
      }
      if (flags & Flags.Encrypted) {
        for (let i = 0; i < fileSize; i += this.blockSize) {
          decrypt8(raw.subarray(i, Math.min(fileSize, i + this.blockSize)), key + i / this.blockSize);
        }
      }
      return raw;
    } else {
      const numBlocks = Math.floor((fileSize + this.blockSize - 1) / this.blockSize);
      const tableSize = numBlocks + 1 + ((flags & Flags.SectorCrc) ? 1 : 0);
      const blocks = new Uint32Array(this.buffer, filePos, tableSize);
      if (blocks.length !== tableSize) {
        return;
      }
      if (flags & Flags.Encrypted) {
        decrypt(blocks, key - 1);
      }
      const output = new Uint8Array(fileSize);
      for (let i = 0; i < numBlocks; ++i) {
        const oPos = i * this.blockSize;
        const cSize = blocks[i + 1] - blocks[i];
        const uSize = Math.min(this.blockSize, fileSize - oPos);
        let tmp = new Uint8Array(this.buffer, filePos + blocks[i], cSize);
        if (tmp.length !== cSize) {
          return;
        }
        if (flags & Flags.Encrypted) {
          decrypt8(tmp, key + i);
        }
        if (flags & Flags.CompressMulti) {
          return;
        } else if (flags & Flags.CompressPkWare) {
          tmp = pkzip_decompress(tmp, uSize);
        }
        if (!tmp || tmp.length !== uSize) {
          return;
        }
        output.set(tmp, oPos);
      }
      return output;
    }
  }
}

export default function getPlayerName(data) {
  debugger;
  try {
    const reader = new MpqReader(data);
    const hero = reader.read("hero");
    return '';
  } catch (e) {
    return null;
  }
}
