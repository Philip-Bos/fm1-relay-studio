// The working session is kept in this browser (ports by name, firmware choices, patterns, tempo)
// and can be exported to / imported from a JSON file.

import { S, out, fwKey, trackDefs } from "./state.js";
import { mkTrack, ensurePattern } from "./sequencer/pattern.js";
import { writeSmf } from "./lib/smf.js";
import { download } from "./ui/dom.js";

const KEY = "fm1-relay-session";
const FORMAT = "fm1-relay-session";

const packTrack = (t) => ({ ch: t.ch, mute: t.mute, len: t.len, swing: t.swing, drum: t.drum, bank: t.bank, pc: t.pc, notes: t.notes.map((n) => [n.t, n.d, n.p, n.v]) });
const unpackTrack = (def, x) => Object.assign(mkTrack(def), {
  ch: x.ch ?? def.ch, mute: !!x.mute, len: x.len || 4, swing: x.swing || 0, drum: x.drum ?? !!def.lanes, bank: x.bank || 0, pc: x.pc || 0,
  notes: (x.notes || []).map(([t, d, p, v]) => ({ t, d, p, v })),
});
const patternKey = (s) => fwKey(s) + ":" + trackDefs(s).length;

export function snapshot() {
  return {
    format: FORMAT, version: 1, bpm: S.bpm, key: S.key, scale: S.scale, chord: S.chord, sel: S.sel,
    slots: S.slots.map((s) => {
      const o = out(s), p = s.pat || s.savedPat;
      return {
        midiName: o?.name || s.midiName, audioName: S.ins.find((d) => d.deviceId === s.audioId)?.label || s.audioName,
        armed: s.armed, ovr: s.ovr, mon: s.mon,
        pattern: p ? { key: p.key, tracks: p.tracks.map((t) => (t.notes ? packTrack(t) : t)) } : null,
      };
    }),
  };
}

export function apply(data) {
  if (data?.format !== FORMAT) return false;
  S.bpm = data.bpm || 120; S.key = data.key || 0; S.scale = data.scale || "MAJOR"; S.chord = data.chord || "OFF"; S.sel = data.sel || 0;
  data.slots?.forEach((x, i) => {
    const s = S.slots[i];
    if (!s || !x) return;
    Object.assign(s, { midiName: x.midiName || "", audioName: x.audioName || "", armed: !!x.armed, ovr: x.ovr || "auto", mon: !!x.mon });
    s.savedPat = x.pattern;
    s.pat = null;
  });
  return true;
}

/** Use a saved pattern when the slot's firmware (and so its track layout) matches the one it was saved with. */
export function restorePattern(s) {
  const sp = s.savedPat, key = patternKey(s);
  if (!sp || sp.key !== key) return null;
  s.savedPat = null;
  const defs = trackDefs(s);
  return { key, tracks: defs.map((d, k) => (sp.tracks[k] ? unpackTrack(d, sp.tracks[k]) : mkTrack(d))) };
}
export { patternKey };

/** Give slots back the ports they had last time, matched by name. */
export function restoreAssignments() {
  S.slots.forEach((s) => {
    if (s.midiId || !s.midiName) return;
    const o = S.outs.find((x) => x.name === s.midiName && !S.slots.some((y) => y.midiId === x.id));
    if (o) s.midiId = o.id;
  });
}

export function save() {
  try { localStorage.setItem(KEY, JSON.stringify(snapshot())); return true; } catch { return false; }
}
export function load() {
  try { return apply(JSON.parse(localStorage.getItem(KEY))); } catch { return false; }
}

export function exportSession() {
  download(new Blob([JSON.stringify(snapshot(), null, 1)], { type: "application/json" }), `fm1-relay-session-${new Date().toISOString().slice(0, 10)}.json`);
}
export async function importSession(file) {
  try { return apply(JSON.parse(await file.text())); } catch { return false; }
}

/** The selected device's pattern as a Standard MIDI File, every track on its own channel. */
export function exportMidi(s) {
  const tracks = ensurePattern(s).tracks.filter((t) => t.notes.length);
  if (!tracks.length) return false;
  const beats = Math.max(...tracks.map((t) => t.len));
  const name = (out(s)?.name || "fm1").replace(/[^\w-]+/g, "-").toLowerCase();
  return download(new Blob([writeSmf({ bpm: S.bpm, tracks, beats })], { type: "audio/midi" }), `${name}-pattern.mid`);
}
