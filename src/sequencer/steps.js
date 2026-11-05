// Convert between the app's free-form notes ({t, d, p, v} in ticks, 96 per beat) and an FM-1 firmware's
// step sequencer (up to 4 notes per step, ties, and on SLOOP a level and a ratchet per note / drum lane).

import { TIME } from "../protocol/fl.js";

export const TPB = 96;
/** Hit levels used by SLOOP: 0 NORM (as played), 1 GHOST, 2 SOFT, 3 HARD. */
export const levelToVel = (lvl, vel = 100) => [vel, 40, 70, 127][lvl & 3];
export const velToLevel = (v) => (v <= 50 ? 1 : v <= 85 ? 2 : v >= 115 ? 3 : 0);

/** Ticks per step from a DIV name such as "1/16", "1/8T" or "1/32" (default 1/16). */
export function ticksPerStep(div) {
  const m = /1\/(\d+)(T)?/i.exec(div || "");
  if (!m) return 24;
  return Math.max(1, Math.round(((TPB * 4) / +m[1]) * (m[2] ? 2 / 3 : 1)));
}

function ratchet(notes, base, tps, rat) {
  if (!rat) return notes.push(base);
  const n = rat + 1, d = Math.max(1, Math.floor(tps / n));
  for (let k = 0; k < n; k++) notes.push({ ...base, t: base.t + k * d, d });
}

/** Synth steps (STEP_GET / TRACK_STEP replies) → notes. Ties lengthen the notes of the step before. */
export function stepsToNotes(steps, tps = 24) {
  const notes = [];
  let open = [];
  steps.forEach((s, i) => {
    if (!s) { open = []; return; }
    if (s.time === TIME.TIE) { open.forEach((n) => (n.d += tps)); return; }
    open = [];
    if (s.time !== TIME.NOTE) return;
    s.notes.forEach((p, k) => {
      const lvl = s.lvl === undefined ? 0 : (s.lvl >> (2 * k)) & 3, rat = s.rat === undefined ? 0 : (s.rat >> (2 * k)) & 3;
      const v = lvl ? levelToVel(lvl) : s.flags & 1 ? 127 : s.vel || 100;
      const base = { t: i * tps, d: tps, p, v };
      if (rat) ratchet(notes, base, tps, rat); else { notes.push(base); open.push(base); }
    });
  });
  return notes;
}

/** Notes → synth steps. A note longer than a step becomes ties; at most 4 notes start in a step. */
export function notesToSteps(notes, nstep, tps = 24) {
  const steps = Array.from({ length: nstep }, () => ({ notes: [], time: TIME.REST, flags: 0, vel: 100, lvl: 0, rat: 0 }));
  const sorted = [...notes].sort((a, b) => a.t - b.t || a.p - b.p);
  for (const n of sorted) {
    const i = Math.round(n.t / tps);
    if (i >= nstep) continue;
    const s = steps[i];
    if (s.time === TIME.TIE) { s.time = TIME.REST; s.notes = []; }
    if (s.notes.length >= 4 || s.notes.includes(n.p)) continue;
    const k = s.notes.length;
    s.notes.push(n.p);
    s.time = TIME.NOTE;
    s.vel = Math.max(k ? s.vel : 0, n.v);
    s.lvl |= velToLevel(n.v) << (2 * k);
    if (n.v >= 115) s.flags |= 1;
    const len = Math.max(1, Math.round(n.d / tps));
    for (let j = 1; j < len && i + j < nstep; j++) if (steps[i + j].time === TIME.REST) steps[i + j].time = TIME.TIE;
  }
  return steps;
}

/** SLOOP drum steps ({lanes: [{lane, lvl, rat}]}) → notes, with lanes as [name, note] pairs. */
export function drumStepsToNotes(drumSteps, lanes, tps = 24) {
  const notes = [];
  drumSteps.forEach((s, i) => s?.lanes.forEach((h) => {
    if (!lanes[h.lane]) return;
    ratchet(notes, { t: i * tps, d: Math.min(12, tps), p: lanes[h.lane][1], v: levelToVel(h.lvl) }, tps, h.rat);
  }));
  return notes;
}

/** Notes → SLOOP drum steps. Several hits of one lane inside a step become a ratchet. */
export function notesToDrumSteps(notes, lanes, nstep, tps = 24) {
  const steps = Array.from({ length: nstep }, () => new Map());
  for (const n of notes) {
    const lane = lanes.findIndex((l) => l[1] === n.p), i = Math.floor((n.t + tps / 4) / tps);
    if (lane < 0 || i >= nstep) continue;
    const hit = steps[i].get(lane);
    if (hit) hit.rat = Math.min(3, hit.rat + 1);
    else steps[i].set(lane, { lane, lvl: velToLevel(n.v), rat: 0 });
  }
  return steps.map((m) => ({ lanes: [...m.values()] }));
}
