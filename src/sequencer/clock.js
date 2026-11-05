// MIDI clock master: 24 PPQN to every running device, with the pattern notes on the same timeline.
// Messages are timestamped LOOK ms ahead so the browser's timer jitter never reaches the clock.

import { S, PPQN, TICK, LOOK, out, running, prof } from "../state.js";
import { ensurePattern, fireWin, allNotesOff, TPB } from "./pattern.js";
import { $ } from "../ui/dom.js";
import { render } from "../pages/devices.js";

export const interval = () => 60000 / (S.bpm * PPQN);

function schedule() {
  const now = performance.now(), horizon = now + LOOK, iv = interval();
  for (const s of S.slots) {
    if (!s.running) continue;
    const o = out(s);
    if (!o) { s.running = false; continue; }
    while (s.next < horizon) {
      const t = s.next;
      if (t < now - 2) { s.next += iv; s.pulse++; continue; }
      try {
        o.send([0xf8], t);
        for (const tr of ensurePattern(s).tracks) {
          const a = (s.pulse * 4) % (tr.len * TPB);
          tr.posA = a; tr.posT = t;
          fireWin(o, tr, a, t, now, iv);
        }
      } catch (e) { console.error(e); s.running = false; break; }
      s.last = t; s.next += iv; s.pulse++;
    }
  }
  if (!running().length && S.timer !== null) { clearInterval(S.timer); S.timer = null; render(); }
}

export function startDevice(s) {
  const o = out(s);
  if (!s.armed || !o || s.running) return;
  const now = performance.now();
  Object.assign(s, { running: true, pulse: 0, next: now + 10, last: now });
  // a firmware that ignores clock (ECHOFIELD before 0.2.9) can still follow START / STOP through its play CC
  const playCc = prof(s).transport?.playCc;
  try { o.send(playCc != null ? [0xfa, 0xb0, playCc, 127] : [0xfa], now); } catch (e) { console.error(e); s.running = false; return render(s); }
  if (S.timer === null) S.timer = setInterval(schedule, TICK);
  render(s);
}

export function stopDevice(s) {
  const o = out(s);
  if (!s.running) return;
  s.running = false;
  ensurePattern(s).tracks.forEach((t) => (t.posA = -1));
  if (o) try { o.clear?.(); allNotesOff(s, o); const playCc = prof(s).transport?.playCc; o.send(playCc != null ? [0xfc, 0xb0, playCc, 0] : [0xfc], performance.now()); } catch (e) { console.warn(e); }
  render(s);
}

export function setTempo(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return;
  const bpm = Math.max(30, Math.min(300, Math.round(n)));
  if (bpm !== S.bpm) {
    S.bpm = bpm;
    const now = performance.now(), iv = interval();
    S.slots.forEach((s) => { if (s.running) s.next = Math.max(s.last + iv, now + 1); });
  }
  $("#tempo").value = $("#tempo-range").value = bpm;
}

/** Tap tempo: the average of the last few taps, reset after a 2 s pause. */
const taps = [];
export function tap() {
  const t = performance.now();
  if (taps.length && t - taps[taps.length - 1] > 2000) taps.length = 0;
  taps.push(t);
  if (taps.length > 5) taps.shift();
  if (taps.length >= 2) setTempo(60000 / ((taps[taps.length - 1] - taps[0]) / (taps.length - 1)));
}
