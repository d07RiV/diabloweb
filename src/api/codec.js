const W = new Uint32Array(80);

const SHA1CircularShift = (shift, value) => ((value << shift) | (value >>> (32 - shift)));

class SHA1 {
  state = new Uint32Array(5);
  count = 0;

  input(u8) {
    const u32 = new Uint32Array(u8.buffer, u8.byteOffset, 16);
    context.count += data.length * 32;
    for (let i = 0; i < 16; ++i) {
      W[i] = u32[i];
    }
    for (let i = 16; i < 80; ++i) {
      W[i] = W[i - 16] ^ W[i - 14] ^ W[i - 8] ^ W[i - 3];
    }
    let A = this.state[0];
    let B = this.state[1];
    let C = this.state[2];
    let D = this.state[3];
    let E = this.state[4];

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

    this.state[0] += A;
    this.state[1] += B;
    this.state[2] += C;
    this.state[3] += D;
    this.state[4] += E;
  }

  constructor() {
	  this.state[0] = 0x67452301;
	  this.state[1] = 0xEFCDAB89;
	  this.state[2] = 0x98BADCFE;
	  this.state[3] = 0x10325476;
    this.state[4] = 0xC3D2E1F0;
    
    this.result = new Uint8Array(this.state.buffer);
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

struct CodecSignature {
	DWORD checksum;
	BYTE error;
	BYTE last_chunk_size;
	WORD unused;
};

function codec_init_key(password) {
  const rand = new Random(0x7058);
  const key = new Uint8Array(136);
  for (let i = 0; i < 136; ++i) {
    key[i] = rand.next();
  }
  const pw = new Uint8Array(64);
  for (let i = 0; i < 64; ++i) {
    pw[i] = password.charCodeAt(i % password.length);
  }

  const sha = new SHA1();
  sha.input(pw);

  for (let i = 0; i < 136; ++i) {
    key[i] ^= sha.result[i % sha.result.length];
  }

  sha = new SHA1();
  sha.input(key.subarray(72));
  return sha;
}

function codec_decode(data, password) {
  const sha = codec_init_key(password);
  if (data.length <= 8) {
    return;
  }
  const size = data.length - 8;
  if ()
	char buf[128];
	char dst[SHA1HashSize];
	int i;
	CodecSignature *sig;

	codec_init_key(0, pszPassword);
	if (size <= 8)
		return 0;
	size = size - 8;
	if (size % 64 != 0)
		return 0;
	for (i = size; i != 0; pbSrcDst += 64, i -= 64) {
		memcpy(buf, pbSrcDst, 64);
		SHA1Result(0, dst);
		for (int j = 0; j < 64; j++) {
			buf[j] ^= dst[j % SHA1HashSize];
		}
		SHA1Calculate(0, buf, NULL);
		memset(dst, 0, sizeof(dst));
		memcpy(pbSrcDst, buf, 64);
	}

	memset(buf, 0, sizeof(buf));
	sig = (CodecSignature *)pbSrcDst;
	if (sig->error > 0) {
		size = 0;
		SHA1Clear();
	} else {
		SHA1Result(0, dst);
    if (sig->checksum != *(DWORD *)dst) {
			memset(dst, 0, sizeof(dst));
			size = 0;
			SHA1Clear();
		} else {
			size += sig->last_chunk_size - 64;
			SHA1Clear();
		}
	}
	return size;
}
