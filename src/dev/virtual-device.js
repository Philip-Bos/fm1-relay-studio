// A software FM-1 that answers the FL editor protocol like a small SLOOP. It looks like a Web MIDI
// output/input pair, so the app (demo mode) and the tests can talk to it exactly as to hardware.
// It makes no sound and models only what an editor can see.

import { writeV14, readV14, writeCString, writeBits, pack7, crc32 } from "../lib/encoding.js";
import { CMD, FMT, isFl, encodeStep, parseStep, encodeDrumStep } from "../protocol/fl.js";
import { GM_LANES } from "../firmware/common.js";

const ENGINES = ["ANALOG", "DIGITAL", "PHASE"];
const PRESETS = [["808 BOOM", "SUB BASS", "WARM PAD", "SYN BRASS"], ["DX RHODES", "MARIMBA", "FM BASS", "GLASS PAD"], ["CZ BASS", "CZ STRING", "RESO PLUCK", "SOFT KEYS"]];
const KITS = ["ACOUSTIC", "808", "909", "TRAP", "HOUSE", "TECHNO", "LO-FI", "JAZZ"];
const d = (label, fmt, min, max, def, unit = "", names) => ({ label, fmt, min, max, def, unit, names });
const P = [
  d("LEVEL", FMT.PCT, 0, 127, 100), d("ATK", FMT.TIME, 0, 127, 0, "ms"), d("DEC", FMT.TIME, 0, 127, 64, "ms"),
  d("SUS", FMT.PCT, 0, 127, 90), d("REL", FMT.TIME, 0, 127, 40, "ms"), d("PAN", FMT.BIPCT, -64, 63, 0),
  d("MUTE", FMT.ONOFF, 0, 1, 0), d("LEN", FMT.STEPS, 1, 64, 16), d("REV", FMT.PCT, 0, 127, 20), d("DLY", FMT.PCT, 0, 127, 0),
  d("CUT", FMT.CUTOFF, 0, 127, 90), d("RES", FMT.PCT, 0, 127, 20), d("ENV", FMT.BIPCT, -64, 63, 10), d("DRV", FMT.PCT, 0, 127, 0),
  d("WAVE", FMT.ENUM, 0, 3, 0, "", ["SAW", "SQR", "TRI", "SIN"]), d("DETN", FMT.INT, 0, 127, 0), d("LFO", FMT.LFOHZ, 0, 127, 30), d("DPTH", FMT.PCT, 0, 127, 0),
];
const PE0 = 10, KIT_DESC = d("KIT", FMT.ENUM, 0, KITS.length - 1, 0, "", KITS);
const G = [d("BPM", FMT.BPM, 40, 240, 120), d("SWING", FMT.SWING, 0, 100, 0), d("DUST", FMT.PCT, 0, 127, 0), d("DUCK", FMT.PCT, 0, 127, 0), d("FILT", FMT.FILT, -64, 63, 0), d("DR LVL", FMT.PCT, 0, 127, 100)];
const DRLVL = 5;
const NSTEP = 64, NTRK = 4, DRUM = 3;

const emptyStep = () => ({ notes: [], time: 2, flags: 0, vel: 100, lvl: 0, rat: 0 });

export function createVirtualDevice({ name = "Virtual SLOOP", version = "FELUCCA SLOOP 2.8.4 VIRTUAL", latency = 4 } = {}) {
  const listeners = new Set();
  const state = {
    selected: 0, watch: 0, solo: 0, notes: [],
    tracks: Array.from({ length: NTRK }, (_, i) => ({
      engine: i === DRUM ? ENGINES.length : i % ENGINES.length, preset: 0,
      p: P.map((x, k) => (i === DRUM && k === PE0 ? 1 : x.def)), steps: Array.from({ length: NSTEP }, emptyStep),
    })),
    drum: Array.from({ length: NSTEP }, () => []),
    g: G.map((x) => x.def),
    projects: [true, false, false, false],
    user: Array.from({ length: 32 }, (_, i) => (i < 2 ? { engine: i, name: ["MY BASS", "MY KEYS"][i] } : null)),
    backup: [{ id: 0, bytes: Array.from({ length: 300 }, (_, i) => (i * 37) & 255) }, { id: 1, bytes: Array.from({ length: 84 }, (_, i) => i) }],
  };
  // a starter beat so a pull shows something
  [0, 4, 8, 12].forEach((s) => state.drum[s].push({ lane: 0, lvl: 0, rat: 0 }));
  [4, 12].forEach((s) => state.drum[s].push({ lane: 3, lvl: 3, rat: 0 }));
  for (let s = 2; s < 16; s += 4) state.drum[s].push({ lane: 4, lvl: 1, rat: s === 14 ? 1 : 0 });
  [0, 3, 6, 10].forEach((s, k) => (state.tracks[0].steps[s] = { notes: [36 + [0, 0, 3, 5][k]], time: 0, flags: 0, vel: 100, lvl: 0, rat: 0 }));

  const emit = (data) => {
    const ev = { data: Uint8Array.from(data), timeStamp: Date.now() };
    listeners.forEach((fn) => fn(ev));
    input.onmidimessage?.(ev);
  };
  const reply = (cmd, a) => setTimeout(() => emit([0xf0, 0x7d, 0x46, 0x4c, cmd, ...a, 0xf7]), latency);
  const trk = (i = state.selected) => state.tracks[i];
  const desc = (scope, id, t = trk()) => (scope ? G[id] : t.engine === ENGINES.length && id === PE0 ? KIT_DESC : P[id]);
  const clampTo = (x, v) => Math.max(x.min, Math.min(x.max, v));
  const stepOut = (t, i) => {
    if (t === DRUM) {
      const lanes = state.drum[i].slice(0, 4);
      return encodeStep({ notes: lanes.map((h) => GM_LANES[h.lane][1]), time: lanes.length ? 0 : 2, flags: lanes.some((h) => h.lvl === 3) ? 1 : 0 }, true);
    }
    return encodeStep(state.tracks[t].steps[i], true);
  };
  const trackBytes = () => state.tracks.flatMap((t, i) => [t.engine, t.preset, ...writeV14(i === DRUM ? state.g[DRLVL] : t.p[0]), t.p[6] ? 1 : 0, 0]);

  function handle(a, cmd) {
    const t = trk();
    switch (cmd) {
      case CMD.INFO:
        return reply(cmd, [...writeCString(version), ENGINES.length, P.length, G.length, NSTEP, PE0, ...ENGINES.flatMap(writeCString), NTRK, 12]);
      case CMD.GET: return reply(cmd, [a[0], a[1], ...writeV14(a[0] ? state.g[a[1]] : t.p[a[1]])]);
      case CMD.SET: {
        const x = desc(a[0], a[1]); if (!x) return;
        const v = clampTo(x, readV14(a, 2));
        if (a[0]) state.g[a[1]] = v; else t.p[a[1]] = v;
        return reply(cmd, [a[0], a[1], ...writeV14(v)]);
      }
      case CMD.DUMP: return reply(cmd, [t.engine, t.preset, ...t.p.flatMap(writeV14), ...state.g.flatMap(writeV14)]);
      case CMD.DESC: {
        const x = desc(a[0], a[1]); if (!x) return;
        return reply(cmd, [a[0], a[1], x.fmt, ...writeV14(x.min), ...writeV14(x.max), ...writeV14(x.def), ...writeCString(x.label), ...writeCString(x.unit), ...(x.names || []).flatMap(writeCString)]);
      }
      case CMD.STEP_GET: return a[0] < NSTEP && reply(cmd, [a[0], ...stepOut(state.selected, a[0])]);
      case CMD.PRESET: if (t.engine < ENGINES.length) { t.engine = a[0]; t.preset = a[1]; } return reply(cmd, [t.engine, t.preset]);
      case CMD.PROJECT: if (a[0] === 1) state.projects[a[1]] = true; return reply(cmd, [a[0], a[1], state.projects[a[1]] ? 1 : 0]);
      case CMD.NAMES: return reply(cmd, [a[0], PRESETS[a[0]].length, ...PRESETS[a[0]].flatMap(writeCString), ...writeCString("OSC"), ...writeCString("FLT")]);
      case CMD.UP_LIST: {
        const n = Math.max(0, Math.min(a[1], 16, 32 - a[0]));
        return reply(cmd, [a[0], n, 32, ...Array.from({ length: n }, (_, k) => state.user[a[0] + k]).flatMap((u) => [u ? 1 : 0, u?.engine || 0, ...writeCString(u?.name || "")])]);
      }
      case CMD.UP_STORE: { const nm = String.fromCharCode(...a.slice(1, a.indexOf(0, 1))); state.user[a[0]] = { engine: t.engine, name: nm || `${ENGINES[t.engine]} ${a[0] + 1}` }; return reply(cmd, [a[0], 0]); }
      case CMD.UP_LOAD: { const u = state.user[a[0]]; if (u) t.engine = u.engine; return reply(cmd, [a[0], u ? 0 : 1]); }
      case CMD.UP_ERASE: state.user[a[0]] = null; return reply(cmd, [a[0], 0]);
      case CMD.WATCH: state.watch = a[0]; return reply(cmd, [a[0]]);
      case CMD.PING: return reply(cmd, [0]);
      case CMD.TRACK:
        if (a.length) state.selected = a[0] % NTRK;
        return reply(cmd, [state.selected, NTRK, ...trackBytes(), state.solo]);
      case CMD.TRACK_MIX: {
        const tt = state.tracks[a[0]];
        if (a.length > 1) { const v = Math.max(0, Math.min(127, readV14(a, 1))); if (a[0] === DRUM) state.g[DRLVL] = v; else tt.p[0] = v; tt.p[6] = a[3] ? 1 : 0; }
        return reply(cmd, [a[0], ...writeV14(a[0] === DRUM ? state.g[DRLVL] : tt.p[0]), tt.p[6]]);
      }
      case CMD.TRACK_DUMP: { const tt = state.tracks[a[0]]; return reply(cmd, [a[0], tt.engine, tt.preset, ...tt.p.flatMap(writeV14)]); }
      case CMD.TRACK_STEP: {
        if (a[1] >= NSTEP) return;
        if (a.length > 2) {
          const s = parseStep([0, 0, 0, 0, 0, ...a, 0xf7], 7);
          if (a[0] === DRUM) state.drum[a[1]] = s.time === 0 ? s.notes.map((n) => ({ lane: Math.max(0, GM_LANES.findIndex((l) => l[1] === n)), lvl: s.flags & 1 ? 3 : 0, rat: 0 })) : [];
          else state.tracks[a[0]].steps[a[1]] = { ...s, lvl: s.lvl || 0, rat: s.rat || 0 };
        }
        return reply(cmd, [a[0], a[1], ...stepOut(a[0], a[1])]);
      }
      case CMD.TRACK_PARAM: {
        const tt = state.tracks[a[0]], x = desc(0, a[1], tt); if (!x) return;
        if (a.length > 2) tt.p[a[1]] = clampTo(x, readV14(a, 2));
        return reply(cmd, [a[0], a[1], ...writeV14(tt.p[a[1]])]);
      }
      case 33: { // SLOOP DRUM_STEP
        if (a[0] >= NSTEP) return;
        if (a.length > 1) {
          const bits = (i, n) => { let v = 0; for (let k = n - 1; k >= 0; k--) v = v * 128 + a[i + k]; return v; };
          const on = bits(1, 3), lv = bits(4, 5), rt = bits(9, 5), lanes = [];
          for (let l = 0; l < 16; l++) if (on & (1 << l)) lanes.push({ lane: l, lvl: Math.floor(lv / 4 ** l) % 4, rat: Math.floor(rt / 4 ** l) % 4 });
          state.drum[a[0]] = lanes;
        }
        return reply(cmd, encodeDrumStep(a[0], state.drum[a[0]]));
      }
      case 34: // SLOOP BK_LIST
        return reply(cmd, [0, state.backup.length, ...state.backup.flatMap((o) => [o.id, ...writeBits(o.bytes.length, 5), ...writeBits(crc32(o.bytes), 5)])]);
      case 35: { // SLOOP BK_GET
        const o = state.backup.find((x) => x.id === a[0]); if (!o) return reply(cmd, [a[0], 1]);
        let off = 0; for (let k = 4; k >= 0; k--) off = off * 128 + a[1 + k];
        const n = a[6] | (a[7] << 7), chunk = o.bytes.slice(off, off + n);
        return reply(cmd, [a[0], 0, ...writeBits(off, 5), chunk.length & 127, chunk.length >> 7, ...pack7(chunk)]);
      }
      default: return undefined; // unknown commands get no reply, as on hardware
    }
  }

  const output = {
    id: "virtual-fm1-out", name, manufacturer: "fm1-relay", type: "output", state: "connected", connection: "open",
    send(data) {
      const a = Array.from(data);
      if (isFl(a)) return handle(a.slice(5, -1), a[4]);
      if ((a[0] & 0xf0) === 0x90 && a[2]) state.notes.push({ ch: a[0] & 15, note: a[1], vel: a[2] });
    },
    clear() {}, open: async () => output, close: async () => output,
  };
  const input = {
    id: "virtual-fm1-in", name, manufacturer: "fm1-relay", type: "input", state: "connected", connection: "open", onmidimessage: null,
    addEventListener: (type, fn) => type === "midimessage" && listeners.add(fn),
    removeEventListener: (type, fn) => listeners.delete(fn),
    open: async () => input, close: async () => input,
  };
  /** Pretend a knob on the device moved (pushes CHANGED while WATCH is on). */
  function turnKnob(scope, id, v) {
    if (scope) state.g[id] = v; else trk().p[id] = v;
    if (state.watch & 1) emit([0xf0, 0x7d, 0x46, 0x4c, CMD.CHANGED, scope, id, ...writeV14(v), 0xf7]);
  }
  return { output, input, state, turnKnob };
}
