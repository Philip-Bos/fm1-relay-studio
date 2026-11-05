// Byte encodings used by the FL editor protocol (Felucca and its forks).
// Every data byte inside a SysEx frame is 7 bit; wider values are split LSB first.

export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

/** v14: value + 8192 in two 7-bit bytes, LSB first (range -8192..8191). */
export const readV14 = (d, i) => (d[i] | (d[i + 1] << 7)) - 8192;
export function writeV14(v) {
  const u = clamp(Math.round(v), -8192, 8191) + 8192;
  return [u & 127, u >> 7];
}

/** An unsigned value spread over n 7-bit bytes, LSB first (u35 = 5 bytes). */
export function readBits(d, i, n) {
  let v = 0;
  for (let k = n - 1; k >= 0; k--) v = v * 128 + (d[i + k] & 127);
  return v;
}
export function writeBits(v, n) {
  const out = [];
  for (let k = 0; k < n; k++) { out.push(v % 128); v = Math.floor(v / 128); }
  return out;
}

/** A 0-terminated ASCII string starting at p.i; advances p.i past the terminator. */
export function readCString(d, p) {
  let s = "";
  while (p.i < d.length && d[p.i] !== 0 && d[p.i] !== 0xf7) s += String.fromCharCode(d[p.i++]);
  p.i++;
  return s;
}
export const writeCString = (s) => [...String(s)].map((c) => c.charCodeAt(0) & 127).concat(0);

/** pack7: groups of up to 7 bytes, each preceded by a byte holding their top bits. */
export function pack7(bytes) {
  const out = [];
  for (let i = 0; i < bytes.length; i += 7) {
    const g = bytes.slice(i, i + 7);
    let hi = 0;
    g.forEach((b, j) => { if (b & 0x80) hi |= 1 << j; });
    out.push(hi, ...g.map((b) => b & 0x7f));
  }
  return out;
}
export function unpack7(d, start = 0, end = d.length) {
  const out = [];
  for (let i = start; i < end; ) {
    const hi = d[i++];
    for (let j = 0; j < 7 && i < end; j++, i++) out.push((d[i] & 0x7f) | (hi & (1 << j) ? 0x80 : 0));
  }
  return out;
}

/** CRC-32 (zlib), used to check backup objects. */
let CRC_TABLE = null;
export function crc32(bytes) {
  if (!CRC_TABLE) {
    CRC_TABLE = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      CRC_TABLE[n] = c >>> 0;
    }
  }
  let c = 0xffffffff;
  for (const b of bytes) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

export function toBase64(bytes) {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return typeof btoa === "function" ? btoa(s) : Buffer.from(s, "binary").toString("base64");
}
