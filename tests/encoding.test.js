import { test } from "node:test";
import assert from "node:assert/strict";
import { readV14, writeV14, pack7, unpack7, readBits, writeBits, crc32, readCString, writeCString } from "../src/lib/encoding.js";

test("v14 round-trips the full range and clamps", () => {
  for (const v of [-8192, -1, 0, 1, 127, 128, 8191]) assert.equal(readV14(writeV14(v), 0), v);
  assert.deepEqual(writeV14(0), [0, 64]);
  assert.equal(readV14(writeV14(99999), 0), 8191);
});

test("pack7 / unpack7 round-trip bytes with the top bit set", () => {
  const bytes = Array.from({ length: 300 }, (_, i) => (i * 73) & 255);
  const packed = pack7(bytes);
  assert.ok(packed.every((b) => b < 128));
  assert.equal(packed.length, 300 + Math.ceil(300 / 7));
  assert.deepEqual(unpack7(packed), bytes);
});

test("u35 and other 7-bit integers", () => {
  for (const v of [0, 1, 127, 128, 2 ** 32 - 1]) assert.equal(readBits(writeBits(v, 5), 0, 5), v);
  assert.deepEqual(writeBits(0x3fff, 2), [127, 127]);
});

test("crc32 matches zlib", () => {
  assert.equal(crc32([..."123456789"].map((c) => c.charCodeAt(0))), 0xcbf43926);
});

test("C strings", () => {
  const d = [...writeCString("SLOOP"), ...writeCString("")], p = { i: 0 };
  assert.equal(readCString(d, p), "SLOOP");
  assert.equal(readCString(d, p), "");
});
