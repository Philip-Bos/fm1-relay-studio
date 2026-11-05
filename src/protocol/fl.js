// The "FL" editor protocol: SysEx F0 7D 46 4C <cmd> <args…> F7.
// Defined by Felucca (web/EDITOR_PROTOCOL.md) and kept by its forks (SLOOP, Skiff, JIANT, …).
// Commands 1–32 are shared; numbers from 33 up differ per fork, so those live with the firmware
// profile that documents them (see src/firmware/profiles).

import { readV14, writeV14, readCString, readBits, writeBits, unpack7 } from "../lib/encoding.js";

export const HEADER = [0xf0, 0x7d, 0x46, 0x4c];
export const CMD = {
  INFO: 1, GET: 2, SET: 3, DUMP: 4, DESC: 5, STEP_GET: 6, STEP_SET: 7, PRESET: 8, PROJECT: 9, NAMES: 10,
  UP_LIST: 16, UP_GET: 17, UP_PUT: 18, UP_STORE: 19, UP_LOAD: 20, UP_ERASE: 21,
  WATCH: 22, CHANGED: 23, RELOAD: 24, PING: 25, STEP_CHANGED: 26,
  TRACK: 27, TRACK_MIX: 28, TRACK_DUMP: 29, TRACK_STEP: 30, TRACK_PARAM: 31, TRACK_CHANGED: 32,
};
/** Commands the device sends on its own while WATCH is on; never replies. */
export const PUSH = new Set([CMD.CHANGED, CMD.RELOAD, CMD.STEP_CHANGED, CMD.TRACK_CHANGED]);

/** Parameter display formats (core.h). 14 and 15 are SLOOP additions. */
export const FMT = { INT: 0, PCT: 1, BIPCT: 2, TIME: 3, LFOHZ: 4, CUTOFF: 5, DB: 6, SEMI: 7, ENUM: 8, BPM: 9, NOTE: 10, ONOFF: 11, OCT: 12, STEPS: 13, SWING: 14, FILT: 15 };
export const SCOPE = { TRACK: 0, GLOBAL: 1 };
export const TIME = { NOTE: 0, TIE: 1, REST: 2 };

export const frame = (cmd, args = []) => [...HEADER, cmd, ...args, 0xf7];
export const isFl = (d) => d && d[0] === 0xf0 && d[1] === 0x7d && d[2] === 0x46 && d[3] === 0x4c;

// ---------- reply parsers (d is the whole frame; arguments start at index 5) ----------

/**
 * INFO: version, NENGINES, P_COUNT, G_COUNT, NSTEP, P_E0, engine names, then (v3) NTRK, then a
 * fork-specific tail: SLOOP appends its protocol version; Skiff appends CHAIN_ROWS and tagged blocks.
 */
export function parseInfo(d) {
  const p = { i: 5 };
  const info = { version: readCString(d, p), engines: [], ntrk: 1, tail: [], tags: {} };
  const n = d[p.i];
  if (n === undefined || n === 0xf7) return info;
  info.pc = d[p.i + 1]; info.gc = d[p.i + 2]; info.nstep = d[p.i + 3]; info.pe0 = d[p.i + 4];
  p.i += 5;
  for (let k = 0; k < n && p.i < d.length; k++) info.engines.push(readCString(d, p));
  if (p.i < d.length - 1) info.ntrk = d[p.i++];
  while (p.i < d.length - 1) info.tail.push(d[p.i++]);
  // Skiff-style tags after a CHAIN_ROWS byte: <tag> 01 <payload>
  const sizes = { 0x55: 1, 0x4e: 1, 0x54: 4, 0x49: 4 };
  for (let i = 1; i + 1 < info.tail.length && info.tail[i + 1] === 1 && sizes[info.tail[i]]; ) {
    const tag = info.tail[i], len = sizes[tag];
    info.tags[tag] = info.tail.slice(i + 2, i + 2 + len);
    i += 2 + len;
  }
  const wide = info.tags[0x49];
  if (wide) { info.pc = wide[0] | (wide[1] << 7); info.pe0 = wide[2] | (wide[3] << 7); }
  return info;
}

export function parseDesc(d) {
  const p = { i: 14 };
  const o = { scope: d[5], id: d[6], fmt: d[7], min: readV14(d, 8), max: readV14(d, 10), def: readV14(d, 12) };
  o.label = readCString(d, p);
  o.unit = readCString(d, p);
  if (o.fmt === FMT.ENUM) {
    o.names = [];
    for (let i = 0; i <= Math.min(64, o.max - o.min) && p.i < d.length - 1; i++) o.names.push(readCString(d, p));
  }
  return o;
}

export function parseDump(d, info) {
  const P = [], G = [];
  for (let i = 0; i < info.pc; i++) P.push(readV14(d, 7 + i * 2));
  for (let i = 0; i < info.gc; i++) G.push(readV14(d, 7 + info.pc * 2 + i * 2));
  return { engine: d[5], preset: d[6], P, G };
}

export function parseNames(d) {
  const p = { i: 7 }, names = [];
  for (let i = 0; i < d[6]; i++) names.push(readCString(d, p));
  return { engine: d[5], names };
}

export function parseTrack(d) {
  const ntrk = d[6], tracks = [];
  let i = 7;
  for (let k = 0; k < ntrk; k++, i += 6) {
    tracks.push({ engine: d[i], preset: d[i + 1], level: readV14(d, i + 2), mute: !!d[i + 4], armed: !!d[i + 5] });
  }
  const solo = i < d.length - 1 ? d[i] : 0;
  tracks.forEach((t, k) => (t.solo = !!(solo & (1 << k))));
  return { selected: d[5], ntrk, tracks };
}

/** A step at offset o: n, note0..3, time, flags, vel, then (SLOOP v5) lvl, hi, rat. */
export function parseStep(d, o) {
  const n = d[o], notes = [d[o + 1], d[o + 2], d[o + 3], d[o + 4]].slice(0, n);
  const step = { n, notes, time: d[o + 5], flags: d[o + 6], vel: d[o + 7] };
  if (o + 10 < d.length - 1) {
    const hi = d[o + 9];
    step.lvl = d[o + 8] | (hi & 1 ? 0x80 : 0);
    step.rat = d[o + 10] | (hi & 2 ? 0x80 : 0);
  }
  return step;
}
export function encodeStep({ notes = [], time = TIME.NOTE, flags = 0, vel = 100, lvl = 0, rat = 0 }, v5 = false) {
  const ns = notes.slice(0, 4), out = [ns.length, ...[0, 1, 2, 3].map((k) => ns[k] ?? 0), time, flags & 127, vel & 127];
  if (v5) out.push(lvl & 127, ((lvl >> 7) & 1) | (((rat >> 7) & 1) << 1), rat & 127);
  return out;
}

/** SLOOP v5 DRUM_STEP: 16 lane bits, 2-bit level and ratchet per lane. */
export function parseDrumStep(d) {
  const on = readBits(d, 6, 3), lvl = readBits(d, 9, 5), rat = readBits(d, 14, 5);
  const lanes = [];
  for (let l = 0; l < 16; l++) if (on & (1 << l)) lanes.push({ lane: l, lvl: Math.floor(lvl / 4 ** l) % 4, rat: Math.floor(rat / 4 ** l) % 4 });
  return { index: d[5], lanes };
}
export function encodeDrumStep(index, lanes) {
  let on = 0, lvl = 0, rat = 0;
  for (const h of lanes) { on |= 1 << h.lane; lvl += (h.lvl & 3) * 4 ** h.lane; rat += (h.rat & 3) * 4 ** h.lane; }
  return [index, ...writeBits(on, 3), ...writeBits(lvl, 5), ...writeBits(rat, 5)];
}

export function parseUpList(d) {
  const p = { i: 8 }, slots = [];
  for (let k = 0; k < d[6]; k++) {
    const used = !!d[p.i], engine = d[p.i + 1];
    p.i += 2;
    slots.push({ slot: d[5] + k, used, engine, name: readCString(d, p) });
  }
  return { start: d[5], total: d[7], slots };
}

export function parseBackupList(d) {
  const objects = [];
  for (let k = 0, i = 7; k < d[6]; k++, i += 11) objects.push({ id: d[i], length: readBits(d, i + 1, 5), crc: readBits(d, i + 6, 5) });
  return { rc: d[5], objects };
}
export const parseBackupChunk = (d) => ({ id: d[5], rc: d[6], offset: readBits(d, 7, 5), count: d[12] | (d[13] << 7), data: unpack7(d, 14, d.length - 1) });

// ---------- request builders ----------
export const args = {
  set: (scope, id, v) => [scope, id, ...writeV14(v)],
  trackMix: (track, level, mute) => (level === undefined ? [track] : [track, ...writeV14(level), mute ? 1 : 0]),
  trackParam: (track, id, v) => (v === undefined ? [track, id] : [track, id, ...writeV14(v)]),
  backupGet: (id, offset, count) => [id, ...writeBits(offset, 5), count & 127, count >> 7],
};

// ---------- client ----------

/**
 * One request at a time per device (the firmware holds a single incoming frame). Replies are
 * matched by command number; pushes are handed to listeners at any time.
 */
export class FlClient {
  constructor({ output, input, timeout = 900 }) {
    this.output = output;
    this.input = input;
    this.timeout = timeout;
    this.queue = Promise.resolve();
    this.waiting = null;
    this.pushListeners = new Set();
    this.watchTimer = null;
    this.opened = false;
    this.onMessage = (e) => this.receive(e.data);
    input.addEventListener("midimessage", this.onMessage);
  }

  receive(d) {
    if (!isFl(d)) return;
    const cmd = d[4];
    if (PUSH.has(cmd)) { this.pushListeners.forEach((fn) => fn(cmd, d)); return; }
    if (this.waiting?.cmd === cmd) this.waiting.done(d);
  }

  onPush(fn) { this.pushListeners.add(fn); return () => this.pushListeners.delete(fn); }

  /** Resolves with the reply frame, or null after a timeout (older firmware ignores unknown commands). */
  request(cmd, a = [], ms = this.timeout) {
    const run = async () => {
      if (!this.opened) { try { await this.input.open?.(); } catch { /* already open */ } this.opened = true; }
      return new Promise((resolve) => {
        const to = setTimeout(() => done(null), ms);
        const done = (d) => { clearTimeout(to); this.waiting = null; resolve(d); };
        this.waiting = { cmd, done };
        try { this.output.send(frame(cmd, a)); } catch { done(null); }
      });
    };
    this.queue = this.queue.then(run, run);
    return this.queue;
  }

  async info() { const d = await this.request(CMD.INFO); return d ? parseInfo(d) : null; }

  /** Live sync: WATCH, kept alive with PING every second. mode 3 also asks for TRACK_CHANGED (v4). */
  async watch(on, mode = 3) {
    clearInterval(this.watchTimer);
    this.watchTimer = null;
    const d = await this.request(CMD.WATCH, [on ? mode : 0]);
    if (on && d) this.watchTimer = setInterval(() => this.request(CMD.PING, [], 500), 1000);
    return d ? d[5] : null;
  }

  close() {
    clearInterval(this.watchTimer);
    this.input.removeEventListener("midimessage", this.onMessage);
    this.pushListeners.clear();
  }
}
