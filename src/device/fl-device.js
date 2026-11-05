// Everything the app does with a device over the FL editor protocol, per slot.

import { S, out, prof, fwKey } from "../state.js";
import { FlClient, CMD, SCOPE, parseDesc, parseDump, parseNames, parseTrack, parseStep, encodeStep, parseDrumStep, encodeDrumStep,
  parseUpList, parseBackupList, parseBackupChunk, args, FMT } from "../protocol/fl.js";
import { readV14, writeCString, crc32, toBase64 } from "../lib/encoding.js";
import { detectProfile, protoLevel } from "../firmware/index.js";
import { ensurePattern, lanesOf, hist, TPB } from "../sequencer/pattern.js";
import { stepsToNotes, notesToSteps, drumStepsToNotes, notesToDrumSteps, ticksPerStep } from "../sequencer/steps.js";

/** The MIDI input that belongs to an output: same port name (the virtual device has its own pair). */
export const inputFor = (o) => (o && S.demo?.output === o ? S.demo.input : [...(S.midi?.inputs.values() || [])].find((i) => i.name === o?.name));

/** The slot's FL client, (re)built when its port changed. Null without SysEx or a matching input. */
export function client(s) {
  const o = out(s), inp = inputFor(o);
  if (!o || !inp || !(S.sysex || o === S.demo?.output)) { closeClient(s); return null; }
  if (s.fl?.output !== o) { closeClient(s); s.fl = new FlClient({ output: o, input: inp }); }
  return s.fl;
}
export function closeClient(s) { s.fl?.close(); s.fl = null; s.watching = false; }
export const rpc = (s, cmd, a = [], ms) => client(s)?.request(cmd, a, ms) ?? Promise.resolve(null);
export const proto = (s) => protoLevel(fwKey(s), s.info);

/** Read INFO and pick a profile; falls back to the port name when the device stays silent. */
export async function identify(s) {
  const o = out(s);
  Object.assign(s, { fw: null, raw: "", info: null, snd: null, qs: null, nm: {}, dc: {}, mix: null, lib: null });
  if (!o) return;
  s.fw = detectProfile({ portName: o.name });
  const fl = client(s);
  if (!fl) { s.raw = S.sysex ? "NO INPUT" : "NO SYSEX"; return; }
  s.raw = "…";
  const info = await fl.info();
  if (!info) { s.raw = "NO REPLY"; return; }
  s.info = info;
  s.raw = info.version || "UNNAMED";
  s.fw = detectProfile({ portName: o.name, info }) || "fl";
}

// ---------- parameters ----------
export async function desc(s, scope, id, eng) {
  const k = scope ? "g" + id : id >= s.info.pe0 ? `p${id}@${eng}` : "p" + id;
  if (s.dc[k]) return s.dc[k];
  const d = await rpc(s, CMD.DESC, [scope, id]);
  return d ? (s.dc[k] = parseDesc(d)) : null;
}
export async function names(s, eng) {
  if (s.nm[eng]) return s.nm[eng];
  const d = await rpc(s, CMD.NAMES, [eng]);
  return d ? (s.nm[eng] = parseNames(d).names) : [];
}
/** Find a track parameter by its label (ids move between firmware versions; labels don't). */
export async function findParam(s, re) {
  for (let i = 0; i < Math.min(s.info.pe0, 127); i++) {
    const d = await desc(s, SCOPE.TRACK, i, 0);
    if (d && re.test(d.label)) return { id: i, d };
  }
  return null;
}
export async function selectTrack(s, tr) {
  const q = await rpc(s, CMD.TRACK);
  if (!q) return null;
  if (q[5] !== tr && tr < q[6]) return parseTrack(await rpc(s, CMD.TRACK, [tr]) || q);
  return parseTrack(q);
}

/** The selected track's sound: engine, preset, every parameter with its description. */
export async function readSound(s, progress = () => {}) {
  const info = s.info, tr = s.tr;
  if (info.ntrk > 1) await selectTrack(s, tr);
  const dm = await rpc(s, CMD.DUMP);
  if (!dm) return null;
  const dump = parseDump(dm, info), eng = dump.engine, dP = [], dG = [];
  const presetNames = eng < info.engines.length ? await names(s, eng) : [];
  let miss = 0;
  const pc = Math.min(info.pc, 127), gc = Math.min(info.gc, 127);
  for (let i = 0; i < pc && miss < 3; i++) { progress(`READING PARAMETERS ${i + 1}/${pc}`); const d = await desc(s, 0, i, eng); miss = d ? 0 : miss + 1; dP.push(d); }
  miss = 0;
  for (let i = 0; i < gc && miss < 3; i++) { const d = await desc(s, 1, i, eng); miss = d ? 0 : miss + 1; dG.push(d); }
  return (s.snd = { tr, eng, pre: dump.preset, names: presetNames, P: dump.P, G: dump.G, dP, dG });
}
export const setParam = (s, scope, id, v) => rpc(s, CMD.SET, args.set(scope, id, v));

// ---------- mixer ----------
export async function readMixer(s) {
  const d = await rpc(s, CMD.TRACK);
  if (!d) return null;
  const mix = parseTrack(d);
  if (proto(s) >= 4 || s.info.ntrk > 1) {
    const pan = s.mixPan ?? (s.mixPan = (await findParam(s, /^PAN$/))?.id ?? -1);
    if (pan >= 0) for (let k = 0; k < mix.ntrk; k++) {
      const r = await rpc(s, CMD.TRACK_PARAM, args.trackParam(k, pan), 300);
      if (r) mix.tracks[k].pan = readV14(r, 7);
    }
  }
  return (s.mix = mix);
}
export const setMix = (s, k, level, mute) => rpc(s, CMD.TRACK_MIX, args.trackMix(k, level, mute));
export const setPan = (s, k, v) => s.mixPan >= 0 && rpc(s, CMD.TRACK_PARAM, args.trackParam(k, s.mixPan, v));

// ---------- patterns: the device's own step sequencer ↔ this app's piano roll ----------
async function stepLayout(s) {
  const len = await findParam(s, /^(LEN|SLEN|STEPS)$/), div = await findParam(s, /^DIV$/);
  return { len, div };
}

export async function pullPattern(s, k, progress = () => {}) {
  const info = s.info, t = ensurePattern(s).tracks[k];
  const { len, div } = await stepLayout(s);
  let steps = info.nstep, tps = 24;
  if (len) { const r = await rpc(s, CMD.TRACK_PARAM, args.trackParam(k, len.id)); if (r) steps = Math.max(1, readV14(r, 7)); }
  if (div?.d.names) { const r = await rpc(s, CMD.TRACK_PARAM, args.trackParam(k, div.id)); if (r) tps = ticksPerStep(div.d.names[readV14(r, 7) - div.d.min]); }
  const drumLanes = t.drum && k === info.ntrk - 1 && proto(s) >= 5 && fwKey(s) === "sloop";
  const got = [];
  for (let i = 0; i < steps; i++) {
    progress(`READING STEP ${i + 1}/${steps}`);
    if (drumLanes) {
      // DRUM_STEP always addresses the drum track, so only use it for that one
      const d = await rpc(s, 33, [i]);
      got.push(d ? parseDrumStep(d) : null);
    } else {
      const d = await rpc(s, CMD.TRACK_STEP, [k, i]);
      got.push(d ? parseStep(d, 7) : null);
    }
  }
  if (got.every((x) => x === null)) return false;
  hist(t);
  t.notes = drumLanes ? drumStepsToNotes(got, lanesOf(t), tps) : stepsToNotes(got, tps);
  t.len = Math.max(1, Math.ceil((steps * tps) / TPB));
  return true;
}

export async function pushPattern(s, k, progress = () => {}) {
  const info = s.info, t = ensurePattern(s).tracks[k];
  const { len, div } = await stepLayout(s);
  let tps = 24;
  if (div?.d.names) { const r = await rpc(s, CMD.TRACK_PARAM, args.trackParam(k, div.id)); if (r) tps = ticksPerStep(div.d.names[readV14(r, 7) - div.d.min]); }
  const steps = Math.min(info.nstep, Math.max(1, Math.round((t.len * TPB) / tps)));
  const notes = t.notes.filter((n) => n.t < t.len * TPB);
  const v5 = proto(s) >= 5;
  if (t.drum && k === info.ntrk - 1 && v5 && fwKey(s) === "sloop") {
    const ds = notesToDrumSteps(notes, lanesOf(t), steps, tps);
    for (let i = 0; i < steps; i++) { progress(`WRITING STEP ${i + 1}/${steps}`); if (!(await rpc(s, 33, encodeDrumStep(i, ds[i].lanes)))) return false; }
  } else {
    const st = notesToSteps(notes, steps, tps);
    for (let i = 0; i < steps; i++) { progress(`WRITING STEP ${i + 1}/${steps}`); if (!(await rpc(s, CMD.TRACK_STEP, [k, i, ...encodeStep(st[i], v5)]))) return false; }
  }
  if (len) await rpc(s, CMD.TRACK_PARAM, args.trackParam(k, len.id, steps));
  return true;
}

// ---------- library: projects, user presets, backups ----------
export async function readLibrary(s) {
  const projects = [];
  for (let slot = 0; slot < 4; slot++) { const d = await rpc(s, CMD.PROJECT, [2, slot]); projects.push(d ? !!d[7] : null); }
  const user = [];
  let total = 32;
  for (let start = 0; start < total; start += 16) {
    const d = await rpc(s, CMD.UP_LIST, [start, 16]);
    if (!d) break;
    const l = parseUpList(d);
    total = l.total;
    user.push(...l.slots);
  }
  return (s.lib = { projects, user, total });
}
export const project = (s, op, slot) => rpc(s, CMD.PROJECT, [op, slot], op === 1 ? 4000 : 2000);
export const userLoad = (s, slot) => rpc(s, CMD.UP_LOAD, [slot]);
export const userStore = (s, slot, name) => rpc(s, CMD.UP_STORE, [slot, ...writeCString(name.toUpperCase().replace(/[^\x20-\x7e]/g, "").slice(0, 12))], 3000);
export const userErase = (s, slot) => rpc(s, CMD.UP_ERASE, [slot], 3000);

/** SLOOP v6+: read every backup object (projects, settings, presets, samples) into a JSON file. */
export async function backup(s, progress = () => {}) {
  const l = await rpc(s, 34, [], 2000);
  if (!l) return null;
  const list = parseBackupList(l);
  if (list.rc) return null;
  const objects = [];
  for (const o of list.objects) {
    const bytes = [];
    while (bytes.length < o.length) {
      progress(`OBJECT ${o.id} · ${Math.round((bytes.length / o.length) * 100)}%`);
      const c = await rpc(s, 35, args.backupGet(o.id, bytes.length, Math.min(256, o.length - bytes.length)), 2000);
      const chunk = c && parseBackupChunk(c);
      if (!chunk || chunk.rc || !chunk.data.length) return null;
      bytes.push(...chunk.data);
    }
    if (crc32(bytes) !== o.crc) return null;
    objects.push({ id: o.id, length: o.length, crc: o.crc, data: toBase64(bytes) });
  }
  return { format: "fm1-relay-backup", version: 1, firmware: s.info.version, created: new Date().toISOString(), objects };
}

// ---------- live sync ----------
/** Follow the device: knob turns, preset loads and other tracks' mix arrive as pushes while WATCH is on. */
export async function watch(s, on, onPush) {
  const fl = client(s);
  if (!fl) return;
  s.unpush?.();
  s.unpush = null;
  if (on) s.unpush = fl.onPush((cmd, d) => onPush(s, cmd, d));
  if (on !== !!s.watching) { s.watching = on; await fl.watch(on, proto(s) >= 4 || s.info?.ntrk > 1 ? 3 : 1); }
}
export const pushValue = (d) => ({ scope: d[5], id: d[6], v: readV14(d, 7) });
export const pushTrack = (d) => ({ track: d[5], id: d[6], v: readV14(d, 7) });
export { CMD, FMT, SCOPE };
export const flExtensions = (s) => ({ drumStep: fwKey(s) === "sloop" && proto(s) >= 5, backup: fwKey(s) === "sloop" && proto(s) >= 6 && !!prof(s).extensions?.backup });
