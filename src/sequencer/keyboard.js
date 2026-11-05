// Play and record into the sequencer: on-screen piano, computer keys and any external MIDI keyboard.

import { S, out, cur } from "../state.js";
import { $, el, inField } from "../ui/dom.js";
import { chordNotes, snapNote, inScale, pcOf } from "../music/theory.js";
import { TPB, curTr, lanesOf, hist } from "./pattern.js";
import { R, dirty, minLen, tickNow } from "./roll.js";
import { interval } from "./clock.js";

const KEYS = "awsedftgyhujkolp".split(""), WHITE = [0, 2, 4, 5, 7, 9, 11];
const laneFor = (t, n) => { const i = lanesOf(t).findIndex((l) => l[1] === n); return i >= 0 ? i : n % lanesOf(t).length; };

function writeStep(s, tr, h) {
  hist(tr);
  const L = tr.len * TPB, live = s.running && tr.posA >= 0;
  let k = live ? Math.round(tickNow(tr)) : tr.cur;
  if (live && R.recQ) k = Math.round(k / R.snap) * R.snap;
  k = ((k % L) + L) % L;
  h.k = k; h.live = live;
  h.made = h.notes.map((p) => { const n = { t: k, d: Math.max(minLen(), R.snap), p, v: h.vel }; tr.notes.push(n); return n; });
}

export function noteOn(id, n, lane, vel = 100) {
  if (S.held.has(id)) return;
  const s = cur(), o = out(s), tr = curTr(), ch = (tr.ch - 1) & 15, lanes = lanesOf(tr);
  const notes = tr.drum ? [lanes[lane % lanes.length][1]] : chordNotes(S.snap ? snapNote(n) : n);
  const h = { notes, ch, o, lane, vel, t0: performance.now(), k: -1 };
  if (o) notes.forEach((x) => o.send([0x90 | ch, x, vel]));
  S.held.set(id, h);
  if (S.recOn) { writeStep(s, tr, h); dirty(); }
  document.querySelector(`[data-id="${id}"]`)?.classList.add("down");
}

export function noteOff(id) {
  const h = S.held.get(id);
  if (!h) return;
  S.held.delete(id);
  if (h.o) h.notes.forEach((x) => h.o.send([0x80 | h.ch, x, 0]));
  document.querySelector(`[data-id="${id}"]`)?.classList.remove("down");
  if (!S.recOn || !h.made) return;
  const tr = curTr();
  if (h.live && !tr.drum) {
    let d = ((performance.now() - h.t0) / interval()) * 4;
    d = R.recQ ? Math.max(minLen(), Math.round(d / R.snap) * R.snap) : Math.max(6, Math.round(d));
    h.made.forEach((n) => (n.d = d));
  }
  if (!h.live && !S.held.size) tr.cur = (h.k + Math.max(minLen(), R.snap)) % (tr.len * TPB); // step entry: advance one grid unit
  dirty();
}

export const stepBy = (d) => { const t = curTr(), L = t.len * TPB; t.cur = (((t.cur + d * Math.max(minLen(), R.snap)) % L) + L) % L; dirty(); };

/** Tint the piano: out-of-key keys dim, the key's root gets a dot. */
export function markScale() {
  document.querySelectorAll("#piano .pk").forEach((k) => {
    const off = +k.dataset.off;
    k.classList.toggle("outkey", !inScale(off));
    k.classList.toggle("root", pcOf(off) === 0);
  });
}

export function buildPiano() {
  const p = $("#piano");
  p.replaceChildren();
  for (let w = 0; w < 14; w++) {
    const off = Math.floor(w / 7) * 12 + WHITE[w % 7], b = el("button", "pk");
    b.dataset.id = "p" + off; b.dataset.off = off; b.setAttribute("aria-label", "Key " + (w + 1));
    p.append(b);
    if ([0, 1, 3, 4, 5].includes(w % 7)) {
      const k = el("button", "pk blk");
      k.dataset.id = "p" + (off + 1); k.dataset.off = off + 1; k.style.left = ((w + 1) / 14) * 100 + "%";
      k.setAttribute("aria-label", "Black key");
      p.append(k);
    }
  }
  p.querySelectorAll(".pk").forEach((k) => {
    const off = +k.dataset.off, id = k.dataset.id;
    k.onpointerdown = (e) => { e.preventDefault(); k.setPointerCapture(e.pointerId); noteOn(id, 12 * (S.koct + 1) + off, off); };
    k.onpointerup = k.onpointercancel = () => noteOff(id);
  });
  markScale();
}

/** Any MIDI keyboard that isn't one of the devices plays and records into the selected track. */
export function hookInputs() {
  S.midi?.inputs.forEach((i) => {
    if (S.outs.some((o) => o.name === i.name)) { i.onmidimessage = null; return; }
    i.onmidimessage = (e) => {
      const [a, n, v] = e.data, c = a & 0xf0, tr = curTr();
      if (c === 0x90 && v > 0) noteOn("m" + n, n, laneFor(tr, n), v);
      else if (c === 0x80 || c === 0x90) noteOff("m" + n);
    };
  });
}

export function bindComputerKeys() {
  addEventListener("keydown", (e) => {
    if (S.page !== "seq" || inField(e) || e.metaKey || e.ctrlKey || e.altKey || e.repeat) return;
    const i = KEYS.indexOf(e.key.toLowerCase());
    if (i >= 0) { e.preventDefault(); noteOn("p" + i, 12 * (S.koct + 1) + i, i); }
  });
  addEventListener("keyup", (e) => { const i = KEYS.indexOf(e.key.toLowerCase()); if (i >= 0) noteOff("p" + i); });
}
