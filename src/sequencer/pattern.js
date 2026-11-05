// Each device slot holds a pattern: one track per firmware track, notes free-form in ticks.

import { S, trackDefs } from "../state.js";
import { GM_LANES } from "../firmware/common.js";
import { restorePattern, patternKey } from "../session.js";

export const TPB = 96; // ticks per beat; notes are {t, d, p, v} in ticks

export const mkTrack = ({ name, ch, lanes }) => ({
  name, ch, lanes: lanes || null, drum: !!lanes, mute: false, len: 4, swing: 0, cur: 0, posA: -1, posT: 0,
  notes: [], hist: [], redo: [], bank: 0, pc: 0,
});
export const lanesOf = (t) => t.lanes || GM_LANES;

/** The slot's pattern, rebuilt (empty) when the firmware — and so the track layout — changes. */
export function ensurePattern(s) {
  const key = patternKey(s);
  if (s.pat?.key === key) return s.pat;
  s.pat = restorePattern(s) || { key, tracks: trackDefs(s).map(mkTrack) };
  s.tr = Math.min(s.tr, s.pat.tracks.length - 1);
  return s.pat;
}
export const curTr = () => { const s = S.slots[S.sel]; return ensurePattern(s).tracks[s.tr]; };

/** Fire every note that starts inside this clock pulse (4 ticks), with swing and sub-pulse timing. */
export function fireWin(o, tr, a, t, now, iv) {
  if (tr.mute || !tr.notes.length) return;
  const ch = (tr.ch - 1) & 15, tk = iv / 4;
  for (const n of tr.notes) {
    if (n.t < a || n.t >= a + 4) continue;
    const sw = tr.swing && n.t % 48 === 24 ? (tr.swing / 100) * 12 : 0, at = Math.max(now, t + (n.t - a + sw) * tk);
    o.send([0x90 | ch, n.p, n.v], at);
    o.send([0x80 | ch, n.p, 0], at + Math.max(n.d * tk * 0.98, 8));
  }
}
export function allNotesOff(s, o) {
  for (const tr of ensurePattern(s).tracks) o.send([0xb0 | ((tr.ch - 1) & 15), 123, 0]);
}

// ---------- undo history (per track) ----------
export function hist(t) { t.hist.push(JSON.stringify(t.notes)); if (t.hist.length > 80) t.hist.shift(); t.redo.length = 0; }
export function undo(t, back) {
  const from = back ? t.hist : t.redo, to = back ? t.redo : t.hist;
  if (!from.length) return false;
  to.push(JSON.stringify(t.notes)); t.notes = JSON.parse(from.pop());
  return true;
}
