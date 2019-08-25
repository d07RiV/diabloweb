const W = new Uint32Array(80);

const SHA1CircularShift = (shift, value) => ((value << shift) | (value >> (32 - shift)));

class SHA1 {
  digest = new Uint32Array(5);
  count = 0;

  input8(u8) {
    const u32 = new Uint32Array(u8.buffer, u8.byteOffset, 16);
    this.input(u32);
  }
  input(u32) {
    this.count += u32.length * 32;
    for (let i = 0; i < 16; ++i) {
      W[i] = u32[i];
    }
    for (let i = 16; i < 80; ++i) {
      W[i] = W[i - 16] ^ W[i - 14] ^ W[i - 8] ^ W[i - 3];
    }
    let A = this.digest[0];
    let B = this.digest[1];
    let C = this.digest[2];
    let D = this.digest[3];
    let E = this.digest[4];

    for (let i = 0; i < 20; i++) {
      const temp = SHA1CircularShift(5, A) + ((B & C) | ((~B) & D)) + E + W[i] + 0x5A827999;
      E = D;
      D = C;
      C = SHA1CircularShift(30, B);
      B = A;
      A = temp | 0;
    }

    for (let i = 20; i < 40; i++) {
      const temp = SHA1CircularShift(5, A) + (B ^ C ^ D) + E + W[i] + 0x6ED9EBA1;
      E = D;
      D = C;
      C = SHA1CircularShift(30, B);
      B = A;
      A = temp | 0;
    }

    for (let i = 40; i < 60; i++) {
      const temp = SHA1CircularShift(5, A) + ((B & C) | (B & D) | (C & D)) + E + W[i] + 0x8F1BBCDC;
      E = D;
      D = C;
      C = SHA1CircularShift(30, B);
      B = A;
      A = temp | 0;
    }

    for (let i = 60; i < 80; i++) {
      const temp = SHA1CircularShift(5, A) + (B ^ C ^ D) + E + W[i] + 0xCA62C1D6;
      E = D;
      D = C;
      C = SHA1CircularShift(30, B);
      B = A;
      A = temp | 0;
    }

    this.digest[0] += A;
    this.digest[1] += B;
    this.digest[2] += C;
    this.digest[3] += D;
    this.digest[4] += E;
  }

  constructor() {
	  this.digest[0] = 0x67452301;
	  this.digest[1] = 0xEFCDAB89;
	  this.digest[2] = 0x98BADCFE;
	  this.digest[3] = 0x10325476;
    this.digest[4] = 0xC3D2E1F0;
    
    this.digest8 = new Uint8Array(this.digest.buffer);
  }
}

class Random {
  constructor(seed) {
    this.seed = seed;
  }
  next() {
    this.seed = (((this.seed * 3) << 16) + ((this.seed * 67) << 8) + (this.seed * 253) + 2531011) | 0;
    return (this.seed >> 16) & 0x7FFF;
  }
}

function codec_init_key(password) {
  const rand = new Random(0x7058);
  const key = new Uint8Array(136);
  const k32 = new Uint32Array(key.buffer);
  for (let i = 0; i < 136; ++i) {
    key[i] = rand.next();
  }
  const pw = new Uint8Array(64);
  for (let i = 0; i < 64; ++i) {
    pw[i] = password.charCodeAt(i % password.length);
  }

  let sha = new SHA1();
  sha.input8(pw);

  for (let i = 0; i < 34; ++i) {
    k32[i] ^= sha.digest[i % sha.digest.length];
  }

  sha = new SHA1();
  sha.input(k32.subarray(18));
  return sha;
}

export default function codec_decode(data, password) {
  if (data.length <= 8) {
    return;
  }
  const size = data.length - 8;
  if (size % 64) {
    return;
  }

  if (data[size + 4]) {
    return;
  }

  const last_size = data[size + 5];
  const result_size = size + last_size - 64;
  const result = new Uint8Array(result_size);

  const sha = codec_init_key(password);
  const size32 = size >> 2;
  const data32 = new Uint32Array(data.buffer, data.byteOffset, size32 + 1);
  const buf32 = new Uint32Array(16);
  const buf = new Uint8Array(buf32.buffer);

  for (let i = 0; i < size32; i += 16) {
    for (let j = 0; j < 16; ++j) {
      buf32[j] = data32[i + j] ^ sha.digest[j % sha.digest.length];
    }
    sha.input(buf32);
    result.set(i === size32 - 16 ? buf.subarray(0, last_size) : buf, i * 4);
  }
  if (data32[size32] !== sha.digest[0]) {
    return;
  }
  return result;
}
