export const CMP_BINARY = 0; // Binary compression
export const CMP_ASCII = 1; // Ascii compression
export const CMP_NO_ERROR = 0;
export const CMP_INVALID_DICTSIZE = 1;
export const CMP_INVALID_MODE = 2;
export const CMP_BAD_DATA = 3;
export const CMP_ABORT = 4;
export const CMP_IMPLODE_DICT_SIZE1 = 1024; // Dictionary size of 1024
export const CMP_IMPLODE_DICT_SIZE2 = 2048; // Dictionary size of 2048
export const CMP_IMPLODE_DICT_SIZE3 = 4096; // Dictionary size of 4096

export const PKDCL_OK = 0;
export const PKDCL_STREAM_END = 1; // All data from the input stream is read
export const PKDCL_NEED_DICT = 2; // Need more data (dictionary)
export const PKDCL_CONTINUE = 10; // Internal flag, not returned to user
export const PKDCL_GET_INPUT = 11; // Internal flag, not returned to user

const DistBits = new Uint8Array([
  0x02, 0x04, 0x04, 0x05, 0x05, 0x05, 0x05, 0x06, 0x06, 0x06, 0x06, 0x06, 0x06, 0x06, 0x06, 0x06,
  0x06, 0x06, 0x06, 0x06, 0x06, 0x06, 0x07, 0x07, 0x07, 0x07, 0x07, 0x07, 0x07, 0x07, 0x07, 0x07,
  0x07, 0x07, 0x07, 0x07, 0x07, 0x07, 0x07, 0x07, 0x07, 0x07, 0x07, 0x07, 0x07, 0x07, 0x07, 0x07,
  0x08, 0x08, 0x08, 0x08, 0x08, 0x08, 0x08, 0x08, 0x08, 0x08, 0x08, 0x08, 0x08, 0x08, 0x08, 0x08
]);

const DistCode = new Uint8Array([
  0x03, 0x0D, 0x05, 0x19, 0x09, 0x11, 0x01, 0x3E, 0x1E, 0x2E, 0x0E, 0x36, 0x16, 0x26, 0x06, 0x3A,
  0x1A, 0x2A, 0x0A, 0x32, 0x12, 0x22, 0x42, 0x02, 0x7C, 0x3C, 0x5C, 0x1C, 0x6C, 0x2C, 0x4C, 0x0C,
  0x74, 0x34, 0x54, 0x14, 0x64, 0x24, 0x44, 0x04, 0x78, 0x38, 0x58, 0x18, 0x68, 0x28, 0x48, 0x08,
  0xF0, 0x70, 0xB0, 0x30, 0xD0, 0x50, 0x90, 0x10, 0xE0, 0x60, 0xA0, 0x20, 0xC0, 0x40, 0x80, 0x00
]);

const ExLenBits = new Uint8Array([
  0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08
]);

const LenBase = new Uint16Array([
  0x0000, 0x0001, 0x0002, 0x0003, 0x0004, 0x0005, 0x0006, 0x0007,
  0x0008, 0x000A, 0x000E, 0x0016, 0x0026, 0x0046, 0x0086, 0x0106
]);

const LenBits = new Uint8Array([
  0x03, 0x02, 0x03, 0x03, 0x04, 0x04, 0x04, 0x05, 0x05, 0x05, 0x05, 0x06, 0x06, 0x06, 0x07, 0x07
]);

const LenCode = new Uint8Array([
  0x05, 0x03, 0x01, 0x06, 0x0A, 0x02, 0x0C, 0x14, 0x04, 0x18, 0x08, 0x30, 0x10, 0x20, 0x40, 0x00
]);

const ChBitsAsc = new Uint8Array([
  0x0B, 0x0C, 0x0C, 0x0C, 0x0C, 0x0C, 0x0C, 0x0C, 0x0C, 0x08, 0x07, 0x0C, 0x0C, 0x07, 0x0C, 0x0C,
  0x0C, 0x0C, 0x0C, 0x0C, 0x0C, 0x0C, 0x0C, 0x0C, 0x0C, 0x0C, 0x0D, 0x0C, 0x0C, 0x0C, 0x0C, 0x0C,
  0x04, 0x0A, 0x08, 0x0C, 0x0A, 0x0C, 0x0A, 0x08, 0x07, 0x07, 0x08, 0x09, 0x07, 0x06, 0x07, 0x08,
  0x07, 0x06, 0x07, 0x07, 0x07, 0x07, 0x08, 0x07, 0x07, 0x08, 0x08, 0x0C, 0x0B, 0x07, 0x09, 0x0B,
  0x0C, 0x06, 0x07, 0x06, 0x06, 0x05, 0x07, 0x08, 0x08, 0x06, 0x0B, 0x09, 0x06, 0x07, 0x06, 0x06,
  0x07, 0x0B, 0x06, 0x06, 0x06, 0x07, 0x09, 0x08, 0x09, 0x09, 0x0B, 0x08, 0x0B, 0x09, 0x0C, 0x08,
  0x0C, 0x05, 0x06, 0x06, 0x06, 0x05, 0x06, 0x06, 0x06, 0x05, 0x0B, 0x07, 0x05, 0x06, 0x05, 0x05,
  0x06, 0x0A, 0x05, 0x05, 0x05, 0x05, 0x08, 0x07, 0x08, 0x08, 0x0A, 0x0B, 0x0B, 0x0C, 0x0C, 0x0C,
  0x0D, 0x0D, 0x0D, 0x0D, 0x0D, 0x0D, 0x0D, 0x0D, 0x0D, 0x0D, 0x0D, 0x0D, 0x0D, 0x0D, 0x0D, 0x0D,
  0x0D, 0x0D, 0x0D, 0x0D, 0x0D, 0x0D, 0x0D, 0x0D, 0x0D, 0x0D, 0x0D, 0x0D, 0x0D, 0x0D, 0x0D, 0x0D,
  0x0D, 0x0D, 0x0D, 0x0D, 0x0D, 0x0D, 0x0D, 0x0D, 0x0D, 0x0D, 0x0D, 0x0D, 0x0D, 0x0D, 0x0D, 0x0D,
  0x0C, 0x0C, 0x0C, 0x0C, 0x0C, 0x0C, 0x0C, 0x0C, 0x0C, 0x0C, 0x0C, 0x0C, 0x0C, 0x0C, 0x0C, 0x0C,
  0x0C, 0x0C, 0x0C, 0x0C, 0x0C, 0x0C, 0x0C, 0x0C, 0x0C, 0x0C, 0x0C, 0x0C, 0x0C, 0x0C, 0x0C, 0x0C,
  0x0C, 0x0C, 0x0C, 0x0C, 0x0C, 0x0C, 0x0C, 0x0C, 0x0C, 0x0C, 0x0C, 0x0C, 0x0C, 0x0C, 0x0C, 0x0C,
  0x0D, 0x0C, 0x0D, 0x0D, 0x0D, 0x0C, 0x0D, 0x0D, 0x0D, 0x0C, 0x0D, 0x0D, 0x0D, 0x0D, 0x0C, 0x0D,
  0x0D, 0x0D, 0x0C, 0x0C, 0x0C, 0x0D, 0x0D, 0x0D, 0x0D, 0x0D, 0x0D, 0x0D, 0x0D, 0x0D, 0x0D, 0x0D
]);

const ChCodeAsc = new Uint16Array([
  0x0490, 0x0FE0, 0x07E0, 0x0BE0, 0x03E0, 0x0DE0, 0x05E0, 0x09E0,
  0x01E0, 0x00B8, 0x0062, 0x0EE0, 0x06E0, 0x0022, 0x0AE0, 0x02E0,
  0x0CE0, 0x04E0, 0x08E0, 0x00E0, 0x0F60, 0x0760, 0x0B60, 0x0360,
  0x0D60, 0x0560, 0x1240, 0x0960, 0x0160, 0x0E60, 0x0660, 0x0A60,
  0x000F, 0x0250, 0x0038, 0x0260, 0x0050, 0x0C60, 0x0390, 0x00D8,
  0x0042, 0x0002, 0x0058, 0x01B0, 0x007C, 0x0029, 0x003C, 0x0098,
  0x005C, 0x0009, 0x001C, 0x006C, 0x002C, 0x004C, 0x0018, 0x000C,
  0x0074, 0x00E8, 0x0068, 0x0460, 0x0090, 0x0034, 0x00B0, 0x0710,
  0x0860, 0x0031, 0x0054, 0x0011, 0x0021, 0x0017, 0x0014, 0x00A8,
  0x0028, 0x0001, 0x0310, 0x0130, 0x003E, 0x0064, 0x001E, 0x002E,
  0x0024, 0x0510, 0x000E, 0x0036, 0x0016, 0x0044, 0x0030, 0x00C8,
  0x01D0, 0x00D0, 0x0110, 0x0048, 0x0610, 0x0150, 0x0060, 0x0088,
  0x0FA0, 0x0007, 0x0026, 0x0006, 0x003A, 0x001B, 0x001A, 0x002A,
  0x000A, 0x000B, 0x0210, 0x0004, 0x0013, 0x0032, 0x0003, 0x001D,
  0x0012, 0x0190, 0x000D, 0x0015, 0x0005, 0x0019, 0x0008, 0x0078,
  0x00F0, 0x0070, 0x0290, 0x0410, 0x0010, 0x07A0, 0x0BA0, 0x03A0,
  0x0240, 0x1C40, 0x0C40, 0x1440, 0x0440, 0x1840, 0x0840, 0x1040,
  0x0040, 0x1F80, 0x0F80, 0x1780, 0x0780, 0x1B80, 0x0B80, 0x1380,
  0x0380, 0x1D80, 0x0D80, 0x1580, 0x0580, 0x1980, 0x0980, 0x1180,
  0x0180, 0x1E80, 0x0E80, 0x1680, 0x0680, 0x1A80, 0x0A80, 0x1280,
  0x0280, 0x1C80, 0x0C80, 0x1480, 0x0480, 0x1880, 0x0880, 0x1080,
  0x0080, 0x1F00, 0x0F00, 0x1700, 0x0700, 0x1B00, 0x0B00, 0x1300,
  0x0DA0, 0x05A0, 0x09A0, 0x01A0, 0x0EA0, 0x06A0, 0x0AA0, 0x02A0,
  0x0CA0, 0x04A0, 0x08A0, 0x00A0, 0x0F20, 0x0720, 0x0B20, 0x0320,
  0x0D20, 0x0520, 0x0920, 0x0120, 0x0E20, 0x0620, 0x0A20, 0x0220,
  0x0C20, 0x0420, 0x0820, 0x0020, 0x0FC0, 0x07C0, 0x0BC0, 0x03C0,
  0x0DC0, 0x05C0, 0x09C0, 0x01C0, 0x0EC0, 0x06C0, 0x0AC0, 0x02C0,
  0x0CC0, 0x04C0, 0x08C0, 0x00C0, 0x0F40, 0x0740, 0x0B40, 0x0340,
  0x0300, 0x0D40, 0x1D00, 0x0D00, 0x1500, 0x0540, 0x0500, 0x1900,
  0x0900, 0x0940, 0x1100, 0x0100, 0x1E00, 0x0E00, 0x0140, 0x1600,
  0x0600, 0x1A00, 0x0E40, 0x0640, 0x0A40, 0x0A00, 0x1200, 0x0200,
  0x1C00, 0x0C00, 0x1400, 0x0400, 0x1800, 0x0800, 0x1000, 0x0000  
]);

/**
 * @param {Uint8Array} positions [out] Table of positions
 * @param {Uint8Array} start_indexes Table of start indexes
 * @param {Uint8Array} length_bits Table of lengths. Each length is stored as number of bits
 * @param {number} elements Number of elements in start_indexes and length_bits
 */
function GenDecodeTabs(positions, start_indexes, length_bits, elements) {
  for (let i = 0; i < elements; i++) {
    const length = 1 << length_bits[i];   // Get the length in bytes
    for (let index = start_indexes[i]; index < 0x100; index += length) {
      positions[index] = i;
    }
  }
}

function GenAscTabs(pWork) {
  let pChCodeAsc = 0xFF;

  for (let count = 0x00FF; pChCodeAsc >= 0; pChCodeAsc--, count--) {
    let bits_asc = pWork.ChBitsAsc[count];
    let acc;

    if (bits_asc <= 8) {
      const add = (1 << bits_asc);
      acc = ChCodeAsc[pChCodeAsc];

      do {
        pWork.offs2C34[acc] = count;
        acc += add;
      } while(acc < 0x100);
    } else if ((acc = (ChCodeAsc[pChCodeAsc] & 0xFF)) !== 0) {
      pWork.offs2C34[acc] = 0xFF;

      if (ChCodeAsc[pChCodeAsc] & 0x3F) {
        bits_asc -= 4;
        pWork.ChBitsAsc[count] = bits_asc;

        const add = (1 << bits_asc);
        acc = ChCodeAsc[pChCodeAsc] >> 4;
        do {
          pWork.offs2D34[acc] = count;
          acc += add;
        } while(acc < 0x100);
      } else {
        bits_asc -= 6;
        pWork.ChBitsAsc[count] = bits_asc;

        const add = (1 << bits_asc);
        acc = ChCodeAsc[pChCodeAsc] >> 6;
        do {
          pWork.offs2E34[acc] = count;
          acc += add;
        } while(acc < 0x80);
      }
    } else {
      bits_asc -= 8;
      pWork.ChBitsAsc[count] = bits_asc;

      const add = (1 << bits_asc);
      acc = ChCodeAsc[pChCodeAsc] >> 8;
      do {
        pWork.offs2EB4[acc] = count;
        acc += add;
      } while(acc < 0x100);
    }
  }
}

//-----------------------------------------------------------------------------
// Removes given number of bits in the bit buffer. New bits are reloaded from
// the input buffer, if needed.
// Returns: PKDCL_OK:         Operation was successful
//          PKDCL_STREAM_END: There are no more bits in the input buffer
function WasteBits(pWork, nBits) {
  // If number of bits required is less than number of (bits in the buffer) ?
  if (nBits <= pWork.extra_bits) {
    pWork.extra_bits -= nBits;
    pWork.bit_buff >>>= nBits;
    return PKDCL_OK;
  }

  // Load input buffer if necessary
  pWork.bit_buff >>= pWork.extra_bits;
  if (pWork.in_pos === pWork.in_bytes) {
    if ((pWork.in_bytes = pWork.read_buf(pWork.in_buff)) === 0) {
      return PKDCL_STREAM_END;
    }
    pWork.in_pos = 0;
  }

  // Update bit buffer
  pWork.bit_buff |= (pWork.in_buff[pWork.in_pos++] << 8);
  pWork.bit_buff >>>= (nBits - pWork.extra_bits);
  pWork.extra_bits = (pWork.extra_bits - nBits) + 8;
  return PKDCL_OK;
}

//-----------------------------------------------------------------------------
// Decodes next literal from the input (compressed) data.
// Returns : 0x000: One byte 0x00
//           0x001: One byte 0x01
//           ...
//           0x0FF: One byte 0xFF
//           0x100: Repetition, length of 0x02 bytes
//           0x101: Repetition, length of 0x03 bytes
//           ...
//           0x304: Repetition, length of 0x206 bytes
//           0x305: End of stream
//           0x306: Error
function DecodeLit(pWork) {
  if(pWork.bit_buff & 1) {
    // Remove one bit from the input data
    if(WasteBits(pWork, 1)) {
      return 0x306;
    }

    // The next 8 bits hold the index to the length code table
    let length_code = pWork.LengthCodes[pWork.bit_buff & 0xFF];

    // Remove the apropriate number of bits
    if(WasteBits(pWork, pWork.LenBits[length_code])) {
      return 0x306;
    }

    // Are there some extra bits for the obtained length code ?
    const extra_length_bits = pWork.ExLenBits[length_code];
    if(extra_length_bits !== 0) {
      const extra_length = pWork.bit_buff & ((1 << extra_length_bits) - 1);
      if(WasteBits(pWork, extra_length_bits)) {
        if((length_code + extra_length) != 0x10E) {
          return 0x306;
        }
      }
      length_code = pWork.LenBase[length_code] + extra_length;
    }

    // In order to distinguish uncompressed byte from repetition length,
    // we have to add 0x100 to the length.
    return length_code + 0x100;
  }

  // Remove one bit from the input data
  if(WasteBits(pWork, 1)) {
    return 0x306;
  }

  // If the binary compression type, read 8 bits and return them as one byte.
  if(pWork.ctype === CMP_BINARY) {
    const uncompressed_byte = pWork.bit_buff & 0xFF;

    if(WasteBits(pWork, 8)) {
      return 0x306;
    }
    return uncompressed_byte;
  }

  // When ASCII compression ...
  let value;
  if (pWork.bit_buff & 0xFF) {
    value = pWork.offs2C34[pWork.bit_buff & 0xFF];

    if (value == 0xFF) {
      if (pWork.bit_buff & 0x3F) {
        if (WasteBits(pWork, 4)) {
          return 0x306;
        }

        value = pWork.offs2D34[pWork.bit_buff & 0xFF];
      } else {
        if (WasteBits(pWork, 6)) {
          return 0x306;
        }

        value = pWork.offs2E34[pWork.bit_buff & 0x7F];
      }
    }
  } else {
    if(WasteBits(pWork, 8)) {
      return 0x306;
    }

    value = pWork.offs2EB4[pWork.bit_buff & 0xFF];
  }

  return WasteBits(pWork, pWork.ChBitsAsc[value]) ? 0x306 : value;
}

//-----------------------------------------------------------------------------
// Decodes the distance of the repetition, backwards relative to the
// current output buffer position
function DecodeDist(pWork, rep_length) {
  // Next 2-8 bits in the input buffer is the distance position code
  const dist_pos_code = pWork.DistPosCodes[pWork.bit_buff & 0xFF];
  const dist_pos_bits = pWork.DistBits[dist_pos_code];
  if (WasteBits(pWork, dist_pos_bits)) {
    return 0;
  }

  let distance;
  if (rep_length === 2) {
    // If the repetition is only 2 bytes length,
    // then take 2 bits from the stream in order to get the distance
    distance = (dist_pos_code << 2) | (pWork.bit_buff & 0x03);
    if (WasteBits(pWork, 2)) {
      return 0;
    }
  } else {
    // If the repetition is more than 2 bytes length,
    // then take "dsize_bits" bits in order to get the distance
    distance = (dist_pos_code << pWork.dsize_bits) | (pWork.bit_buff & pWork.dsize_mask);
    if (WasteBits(pWork, pWork.dsize_bits)) {
      return 0;
    }
  }
  return distance + 1;
}

function Expand(pWork) {
  let outputPos = 0x1000;          // Initialize output buffer position

  // Decode the next literal from the input data.
  // The returned literal can either be an uncompressed byte (next_literal < 0x100)
  // or an encoded length of the repeating byte sequence that
  // is to be copied to the current buffer position
  let result, next_literal;
  while ((result = next_literal = DecodeLit(pWork)) < 0x305) {
    // If the literal is greater than 0x100, it holds length
    // of repeating byte sequence
    // literal of 0x100 means repeating sequence of 0x2 bytes
    // literal of 0x101 means repeating sequence of 0x3 bytes
    // ...
    // literal of 0x305 means repeating sequence of 0x207 bytes
    if(next_literal >= 0x100) {
      // Get the length of the repeating sequence.
      // Note that the repeating block may overlap the current output position,
      // for example if there was a sequence of equal bytes
      let rep_length = next_literal - 0xFE;
      // Get backward distance to the repetition
      const minus_dist = DecodeDist(pWork, rep_length);
      if (minus_dist === 0) {
        result = 0x306;
        break;
      }

      // Target and source pointer
      let target = outputPos;
      let source = target - minus_dist;

      // Update buffer output position
      outputPos += rep_length;

      // Copy the repeating sequence
      const out_buff = pWork.out_buff;
      while (rep_length-- > 0) {
        out_buff[target++] = out_buff[source++];
      }
    } else {
      pWork.out_buff[outputPos++] = next_literal;
    }

    // Flush the output buffer, if number of extracted bytes has reached the end
    if (outputPos >= 0x2000) {
      // Copy decompressed data into user buffer
      pWork.write_buf(pWork.out_buff.subarray(0x1000, 0x2000));

      // Now copy the decompressed data to the first half of the buffer.
      // This is needed because the decompression might reuse them as repetitions.
      // Note that if the output buffer overflowed previously, the extra decompressed bytes
      // are stored in "out_buff_overflow", and they will now be
      // within decompressed part of the output buffer.
      pWork.out_buff.copyWithin(0, 0x1000, outputPos);
      outputPos -= 0x1000;
    }
  }

  // Flush any remaining decompressed bytes
  pWork.write_buf(pWork.out_buff.subarray(0x1000, outputPos));
  return result;
}

//-----------------------------------------------------------------------------
// Main exploding function.
export function explode(read_buf, write_buf) {
  const buffer = new ArrayBuffer(0x3104);
  const pWork = {
    read_buf,
    write_buf,
    in_pos: 3,
    extra_bits: 0,
    in_buff: new Uint8Array(buffer, 0, 0x800),
    DistPosCodes: new Uint8Array(buffer, 0x800, 0x100),
    LengthCodes: new Uint8Array(buffer, 0x900, 0x100),
    offs2C34: new Uint8Array(buffer, 0xA00, 0x100),
    offs2D34: new Uint8Array(buffer, 0xB00, 0x100),
    offs2E34: new Uint8Array(buffer, 0xC00, 0x80),
    offs2EB4: new Uint8Array(buffer, 0xC80, 0x100),
    ChBitsAsc: new Uint8Array(buffer, 0xD80, 0x100),
    DistBits: new Uint8Array(buffer, 0xE80, 0x40),
    LenBits: new Uint8Array(buffer, 0xEC0, 0x10),
    ExLenBits: new Uint8Array(buffer, 0xED0, 0x10),
    LenBase: new Uint16Array(buffer, 0xEE0, 0x10),
    out_buff: new Uint8Array(buffer, 0xF00, 0x2204),
  };
  pWork.in_bytes = read_buf(pWork.in_buff);
  if (pWork.in_bytes <= 4) {
    return CMP_BAD_DATA;
  }
  pWork.ctype = pWork.in_buff[0];
  pWork.dsize_bits = pWork.in_buff[1];
  pWork.bit_buff = pWork.in_buff[2];

  // Test for the valid dictionary size
  if(4 > pWork.dsize_bits || pWork.dsize_bits > 6) {
    return CMP_INVALID_DICTSIZE;
  }

  pWork.dsize_mask = 0xFFFF >> (0x10 - pWork.dsize_bits); // Shifted by 'sar' instruction

  if(pWork.ctype != CMP_BINARY) {
    if(pWork.ctype != CMP_ASCII) {
      return CMP_INVALID_MODE;
    }

    pWork.ChBitsAsc.set(ChBitsAsc);
    GenAscTabs(pWork);
  }

  pWork.LenBits.set(LenBits);
  GenDecodeTabs(pWork.LengthCodes, LenCode, pWork.LenBits, pWork.LenBits.length);
  pWork.ExLenBits.set(ExLenBits);
  pWork.LenBase.set(LenBase);
  pWork.DistBits.set(DistBits);
  GenDecodeTabs(pWork.DistPosCodes, DistCode, pWork.DistBits, pWork.DistBits.length);
  if(Expand(pWork) !== 0x306) {
    return CMP_NO_ERROR;
  }
      
  return CMP_ABORT;
}

export default explode;
