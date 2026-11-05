// Piano roll: free-position notes at 96 ticks per beat, a velocity lane and a ruler with the loop end.

import { S, out, cur, tcol } from "../state.js";
import { $, fit, clamp, inField } from "../ui/dom.js";
import { NN, inScale, pcOf, noteName, chordNotes, snapNote } from "../music/theory.js";
import { TPB, curTr, lanesOf, hist, undo as undoTrack } from "./pattern.js";
import { interval } from "./clock.js";
import { noteOn, noteOff } from "./keyboard.js";
import { drawSeq } from "../pages/sequencer.js";

export const MAXB = 256, KW = 64;
export const R = { tool: "ptr", snap: 24, zoom: 48, len: 48, vel: 100, recQ: true, dirty: true, drag: null, clip: [], vd: null, lenDrag: false };
export const SNAPS = [["1/4", 96], ["1/8", 48], ["1/8T", 32], ["1/16", 24], ["1/16T", 16], ["1/32", 12], ["OFF", 1]];

const lanesRev = (t) => lanesOf(t).map((l) => l[1]).reverse();
const nLanes = (t) => lanesOf(t).length;
export const rh = (t) => (t.drum ? 22 : 14);
export const pxt = () => R.zoom / TPB;
const W = () => Math.min(MAXB, curTr().len + 32) * R.zoom;
const H = (t) => (t.drum ? nLanes(t) : 128) * rh(t);
const rowOf = (t, p) => (t.drum ? lanesRev(t).indexOf(p) : 127 - p);
const pitchOf = (t, r) => (t.drum ? lanesRev(t)[clamp(r, 0, nLanes(t) - 1)] : clamp(127 - r, 0, 127));
export const dirty = () => (R.dirty = true);
export const minLen = () => (R.snap > 1 ? R.snap : 6);
const snapV = (v) => Math.round(v / R.snap) * R.snap;
export const tickNow = (t) => { const L = t.len * TPB, x = t.posA + ((performance.now() - t.posT) / interval()) * 4; return ((x % L) + L) % L; };
export const lenText = (t) => (t.len % 4 ? `${t.len} BEATS` : `${t.len / 4} BAR${t.len > 4 ? "S" : ""}`);

export function audition(t, notes) {
  const o = out(cur());
  if (!o) return;
  const ch = (t.ch - 1) & 15, now = performance.now();
  notes.forEach((n) => { o.send([0x90 | ch, n, 100]); o.send([0x80 | ch, n, 0], now + 180); });
}

function noteAt(t, x, y) {
  const P = pxt();
  for (let i = t.notes.length - 1; i >= 0; i--) {
    const n = t.notes[i], r = rowOf(t, n.p);
    if (r < 0) continue;
    const x0 = n.t * P, x1 = x0 + Math.max(n.d * P, 5), y0 = r * rh(t);
    if (x >= x0 && x <= x1 && y >= y0 && y < y0 + rh(t)) return { n, edge: x1 - x < 7 && x1 - x0 > 14 };
  }
  return null;
}

// ---------- edits: act on the selection, or on everything if nothing is selected ----------
const sels = (t) => { const a = t.notes.filter((n) => n.sel); return a.length ? a : t.notes; };
const edit = (fn) => { const t = curTr(); hist(t); fn(t, sels(t)); dirty(); };
export const quant = () => edit((t, a) => a.forEach((n) => { n.t = clamp(snapV(n.t), 0, t.len * TPB - 1); n.d = Math.max(minLen(), snapV(n.d)); }));
export const shift = (dp, dt = 0) => edit((t, a) => a.forEach((n) => { if (!t.drum) n.p = clamp(n.p + dp, 0, 127); n.t = clamp(n.t + dt, 0, (MAXB - 1) * TPB); }));
export const human = () => edit((t, a) => a.forEach((n) => { n.t = Math.max(0, n.t + Math.round(Math.random() * 8 - 4)); n.v = clamp(n.v + Math.round(Math.random() * 16 - 8), 1, 127); }));
export const legato = () => edit((t, a) => {
  const st = [...new Set(a.map((n) => n.t))].sort((x, y) => x - y);
  a.forEach((n) => { const nx = st.find((x) => x > n.t); if (nx !== undefined) n.d = nx - n.t; });
});
export const del = () => { const t = curTr(); hist(t); t.notes = t.notes.some((n) => n.sel) ? t.notes.filter((n) => !n.sel) : t.notes; dirty(); };
export const clearTrack = () => { const t = curTr(); if (!t.notes.length) return; hist(t); t.notes = []; dirty(); };
const selAll = () => { curTr().notes.forEach((n) => (n.sel = true)); dirty(); };
export const undo = (back) => { if (undoTrack(curTr(), back)) dirty(); };
export function dup() {
  const t = curTr(), a = t.notes.filter((n) => n.sel);
  if (!a.length) return;
  hist(t);
  const lo = Math.min(...a.map((n) => n.t)), hi = Math.max(...a.map((n) => n.t + n.d)), off = hi - lo;
  a.forEach((n) => (n.sel = false));
  a.forEach((n) => t.notes.push({ ...n, t: n.t + off, sel: true }));
  t.len = Math.min(MAXB, Math.max(t.len, Math.ceil((hi + off) / TPB)));
  sizeRoll(); drawSeq();
}
const copy = () => { const t = curTr(), a = t.notes.filter((n) => n.sel); if (!a.length) return; const lo = Math.min(...a.map((n) => n.t)); R.clip = a.map((n) => ({ dt: n.t - lo, d: n.d, p: n.p, v: n.v })); };
function paste() {
  const t = curTr();
  if (!R.clip.length) return;
  hist(t); t.notes.forEach((n) => (n.sel = false));
  R.clip.forEach((c) => t.notes.push({ t: t.cur + c.dt, d: c.d, p: c.p, v: c.v, sel: true }));
  dirty();
}
function create(t, m) {
  hist(t);
  const p = pitchOf(t, Math.floor(m.y / rh(t))), tick = clamp(Math.floor(m.x / pxt() / R.snap) * R.snap, 0, t.len * TPB - 1);
  const ps = !t.drum && S.chord !== "OFF" ? chordNotes(S.snap ? snapNote(p) : p) : [p];
  t.notes.forEach((n) => (n.sel = false));
  const made = ps.map((pp) => { const n = { t: tick, d: R.len, p: pp, v: R.vel, sel: true }; t.notes.push(n); return n; });
  audition(t, ps);
  R.drag = { mode: "size", gx: m.x, gy: m.y, moved: false, t, pushed: true, orig: made.map((n) => ({ n, t: n.t, d: n.d, p: n.p, r: rowOf(t, n.p) })) };
  dirty();
}

// ---------- drawing ----------
export function drawRoll() {
  const s = cur(), t = curTr(), sc = $("#scroll"), P = pxt(), r = rh(t), L = t.len * TPB, tc = tcol(s.tr);
  const roll = $("#roll"), ctx = fit(roll, sc.clientWidth, sc.clientHeight), w = roll._w, h = roll._h, ox = KW - sc.scrollLeft, oy = -sc.scrollTop;
  ctx.fillStyle = "#111214"; ctx.fillRect(0, 0, w, h);
  const nr = t.drum ? nLanes(t) : 128, r0 = Math.max(0, Math.floor(-oy / r)), r1 = Math.min(nr, Math.ceil((h - oy) / r));
  for (let i = r0; i < r1; i++) {
    const p = pitchOf(t, i), y = oy + i * r;
    ctx.fillStyle = !t.drum && NN[p % 12].length > 1 ? "#15171a" : "#1b1d21"; ctx.fillRect(KW, y, w - KW, r);
    if (!t.drum && !inScale(p)) { ctx.fillStyle = "#0007"; ctx.fillRect(KW, y, w - KW, r); }
    if (!t.drum && pcOf(p) === 0) { ctx.fillStyle = tc + "30"; ctx.fillRect(KW, y, w - KW, r); }
    ctx.fillStyle = "#2a2d33"; ctx.fillRect(KW, y + r - 1, w - KW, 1);
  }
  const step = R.snap * P >= 6 ? R.snap : TPB, kA = Math.floor(sc.scrollLeft / P / step) * step;
  for (let k = kA; k < (sc.scrollLeft + w) / P && k <= MAXB * TPB; k += step) {
    ctx.fillStyle = k % (4 * TPB) === 0 ? "#555a64" : k % TPB === 0 ? "#383c44" : "#25282d"; ctx.fillRect(ox + k * P, 0, 1, h);
  }
  if (L < MAXB * TPB) { ctx.fillStyle = "#08090acc"; ctx.fillRect(Math.max(KW, ox + L * P), 0, w, h); }
  for (const n of t.notes) {
    const rr = rowOf(t, n.p);
    if (rr < 0) continue;
    const x = ox + n.t * P, y = oy + rr * r, ww = Math.max(n.d * P, 4);
    if (x + ww < KW || x > w || y + r < 0 || y > h) continue;
    ctx.globalAlpha = (n.t >= L ? 0.3 : 1) * (0.5 + (0.5 * n.v) / 127); ctx.fillStyle = tc; ctx.fillRect(x, y + 1, ww - 1, r - 2); ctx.globalAlpha = 1;
    if (n.sel) { ctx.strokeStyle = "#fff"; ctx.lineWidth = 1.5; ctx.strokeRect(x + 0.5, y + 1.5, ww - 2, r - 3); }
    if (ww > 26 && r >= 14 && !t.drum) { ctx.fillStyle = "#111"; ctx.font = "600 10px 'Barlow Condensed',sans-serif"; ctx.fillText(noteName(n.p), x + 3, y + r - 4); }
  }
  if (s.running && t.posA >= 0) { ctx.fillStyle = "#fff"; ctx.fillRect(ox + tickNow(t) * P, 0, 2, h); }
  if (S.recOn && !s.running) { ctx.fillStyle = "#e5533d"; ctx.fillRect(ox + t.cur * P, 0, 2, h); }
  const d = R.drag;
  if (d?.mode === "marq") {
    ctx.strokeStyle = "#fff9"; ctx.setLineDash([4, 3]);
    ctx.strokeRect(KW - sc.scrollLeft + Math.min(d.gx, d.x1), -sc.scrollTop + Math.min(d.gy, d.y1), Math.abs(d.x1 - d.gx), Math.abs(d.y1 - d.gy));
    ctx.setLineDash([]);
  }
  ctx.fillStyle = "#16171a"; ctx.fillRect(0, 0, KW, h); // keys / lane names
  ctx.font = "600 11px 'Barlow Condensed',sans-serif";
  for (let i = r0; i < r1; i++) {
    const p = pitchOf(t, i), y = oy + i * r;
    if (t.drum) {
      ctx.fillStyle = "#23262b"; ctx.fillRect(0, y, KW - 1, r - 1);
      ctx.fillStyle = "#cfd2d8"; ctx.fillText(lanesOf(t).find((l) => l[1] === p)?.[0] || noteName(p), 4, y + 15);
      continue;
    }
    const blk = NN[p % 12].length > 1;
    ctx.fillStyle = "#e6e3d9"; ctx.fillRect(0, y, KW - 1, r - 1);
    if (blk) { ctx.fillStyle = "#17181b"; ctx.fillRect(0, y, KW * 0.62, r - 1); }
    else if (p % 12 === 0) { ctx.fillStyle = "#111"; ctx.fillText(noteName(p), KW - 24, y + r - 4); }
  }
  const ru = $("#ruler"), rc = fit(ru, sc.clientWidth, 22);
  rc.fillStyle = "#17191c"; rc.fillRect(0, 0, ru._w, 22);
  rc.fillStyle = "#08090a"; rc.fillRect(Math.max(KW, ox + L * P), 0, ru._w, 22);
  rc.font = "13px VT323,monospace"; rc.fillStyle = "#8b8f98";
  for (let k = Math.floor(sc.scrollLeft / P / TPB) * TPB; k < (sc.scrollLeft + w) / P && k < MAXB * TPB; k += TPB) {
    const x = ox + k * P;
    if (x < KW) continue;
    rc.fillRect(x, k % (4 * TPB) ? 14 : 4, 1, 22);
    if (k % (4 * TPB) === 0) rc.fillText(String(k / 384 + 1), x + 3, 13);
  }
  const cx = ox + t.cur * P; // step-entry cursor
  if (cx >= KW) { rc.fillStyle = "#f0c244"; rc.beginPath(); rc.moveTo(cx - 5, 22); rc.lineTo(cx + 5, 22); rc.lineTo(cx, 13); rc.fill(); }
  const ex = ox + L * P; // loop end: drag this red flag to change the number of bars
  if (ex > KW - 20 && ex < ru._w + 20) {
    rc.fillStyle = "#e5533d"; rc.fillRect(ex - 2, 0, 3, 22); rc.fillRect(ex - 18, 0, 17, 13);
    rc.fillStyle = "#220d09"; for (let g = 0; g < 3; g++) rc.fillRect(ex - 14 + g * 4, 3, 1.5, 7);
  }
  const vl = $("#vel"), vc = fit(vl, sc.clientWidth, 70);
  vc.fillStyle = "#111214"; vc.fillRect(0, 0, vl._w, 70);
  for (const n of t.notes) {
    const x = ox + n.t * P, bh = (n.v / 127) * 60;
    if (x < KW || x > vl._w) continue;
    vc.fillStyle = n.sel ? "#fff" : tc; vc.globalAlpha = n.t >= L ? 0.3 : 1; vc.fillRect(x, 66 - bh, 5, bh); vc.globalAlpha = 1;
  }
  vc.fillStyle = "#16171a"; vc.fillRect(0, 0, KW, 70);
  vc.fillStyle = "#8b8f98"; vc.font = "600 11px 'Barlow Condensed',sans-serif"; vc.fillText("VELOCITY", 4, 14);
}

export function sizeRoll() {
  const t = curTr(), sp = $("#spacer");
  sp.style.width = KW + W() + "px"; sp.style.height = H(t) + "px";
  $("#scroll").style.height = t.drum ? Math.min(H(t) + 18, 560) + "px" : "";
  dirty();
}

/** Scroll a synth track to middle C the first time it is shown. */
export function initialScroll(t) {
  if (t._sc) return;
  t._sc = 1;
  $("#scroll").scrollTop = t.drum ? 0 : (127 - 79) * 14;
}

export function buildRoll() {
  const c = $("#roll"), sc = $("#scroll"), v = $("#vel");
  const pos = (e) => { const b = c.getBoundingClientRect(); return { x: e.clientX - b.left, y: e.clientY - b.top }; };
  const g = (q) => ({ x: q.x - KW + sc.scrollLeft, y: q.y + sc.scrollTop });
  sc.onscroll = dirty;
  c.oncontextmenu = (e) => {
    e.preventDefault();
    const t = curTr(), q = pos(e);
    if (q.x < KW) return;
    const m = g(q), h = noteAt(t, m.x, m.y);
    if (h) { hist(t); t.notes.splice(t.notes.indexOf(h.n), 1); dirty(); }
  };
  c.onpointerdown = (e) => {
    if (e.button !== 0) return;
    const t = curTr(), q = pos(e);
    c.setPointerCapture(e.pointerId);
    if (q.x < KW) {
      const p = pitchOf(t, Math.floor((q.y + sc.scrollTop) / rh(t))), id = "k" + p;
      noteOn(id, p, Math.max(0, lanesOf(t).findIndex((l) => l[1] === p)));
      R.drag = { mode: "key", id };
      return;
    }
    const m = g(q), h = noteAt(t, m.x, m.y), base = { gx: m.x, gy: m.y, moved: false, t };
    if (h) {
      if (e.shiftKey) { h.n.sel = !h.n.sel; dirty(); return; }
      if (!h.n.sel) { t.notes.forEach((n) => (n.sel = false)); h.n.sel = true; }
      R.drag = { ...base, mode: h.edge ? "size" : "move", orig: t.notes.filter((n) => n.sel).map((n) => ({ n, t: n.t, d: n.d, p: n.p, r: rowOf(t, n.p) })) };
      audition(t, [h.n.p]); R.len = h.n.d; dirty();
      return;
    }
    if (R.tool === "pen") return create(t, m);
    if (!e.shiftKey) t.notes.forEach((n) => (n.sel = false));
    R.drag = { ...base, mode: "marq", x1: m.x, y1: m.y };
    dirty();
  };
  c.onpointermove = (e) => {
    const t = curTr(), q = pos(e), d = R.drag, P = pxt();
    if (!d) {
      const h = q.x >= KW && noteAt(t, ...Object.values(g(q)));
      c.style.cursor = q.x < KW ? "pointer" : h ? (h.edge ? "ew-resize" : "grab") : R.tool === "pen" ? "crosshair" : "default";
      return;
    }
    if (d.mode === "key") return;
    const m = g(q);
    if (d.mode === "marq") {
      d.x1 = m.x; d.y1 = m.y;
      const x0 = Math.min(d.gx, m.x), x1 = Math.max(d.gx, m.x), y0 = Math.min(d.gy, m.y), y1 = Math.max(d.gy, m.y);
      t.notes.forEach((n) => { const ny = rowOf(t, n.p) * rh(t), nx = n.t * P; n.sel = nx < x1 && nx + Math.max(n.d * P, 5) > x0 && ny < y1 && ny + rh(t) > y0; });
      dirty();
      return;
    }
    if (!d.moved && Math.abs(m.x - d.gx) < 3 && Math.abs(m.y - d.gy) < 3) return;
    if (!d.moved) { d.moved = true; if (!d.pushed) hist(t); }
    const dk = Math.round((m.x - d.gx) / P / R.snap) * R.snap;
    if (d.mode === "size") { d.orig.forEach((o) => (o.n.d = Math.max(minLen(), o.d + dk))); R.len = d.orig[0].n.d; }
    else {
      const dr = Math.round((m.y - d.gy) / rh(t));
      d.orig.forEach((o) => { o.n.t = clamp(o.t + dk, 0, (MAXB - 1) * TPB); o.n.p = t.drum ? pitchOf(t, o.r + dr) : clamp(o.p - dr, 0, 127); });
      if (d.orig[0].n.p !== d.lastP) { d.lastP = d.orig[0].n.p; audition(t, [d.lastP]); }
    }
    dirty();
  };
  c.onpointerup = c.onpointercancel = () => { const d = R.drag; R.drag = null; if (d?.mode === "key") noteOff(d.id); dirty(); };
  c.ondblclick = (e) => {
    const q = pos(e);
    if (q.x < KW) return;
    const t = curTr(), m = g(q);
    if (!noteAt(t, m.x, m.y)) { create(t, m); R.drag = null; }
  };
  const vmove = (e) => {
    const t = curTr(), b = v.getBoundingClientRect(), nv = clamp(Math.round((1 - (e.clientY - b.top - 4) / 62) * 127), 1, 127), dv = nv - R.vd.v;
    (R.vd.sel ? t.notes.filter((n) => n.sel) : [R.vd]).forEach((n) => (n.v = clamp(n.v + dv, 1, 127)));
    dirty();
  };
  v.onpointerdown = (e) => {
    const t = curTr(), b = v.getBoundingClientRect(), x = e.clientX - b.left - KW + sc.scrollLeft, P = pxt();
    let best = null, bd = 9;
    t.notes.forEach((n) => { const dd = Math.abs(n.t * P + 2 - x); if (dd < bd) { bd = dd; best = n; } });
    if (!best) return;
    hist(t); R.vd = best; v.setPointerCapture(e.pointerId); vmove(e);
  };
  v.onpointermove = (e) => R.vd && vmove(e);
  v.onpointerup = v.onpointercancel = () => (R.vd = null);
  const ru = $("#ruler"), endX = (t) => KW - sc.scrollLeft + t.len * TPB * pxt();
  const setLen = (e) => { // snap to whole bars; hold Shift for single beats
    const t = curTr(), b = ru.getBoundingClientRect(), tick = (e.clientX - b.left - KW + sc.scrollLeft) / pxt(), st = e.shiftKey ? 1 : 4;
    t.len = clamp(Math.round(tick / TPB / st) * st, st, MAXB);
    t.cur = Math.min(t.cur, t.len * TPB - 1);
    if (e.clientX > b.right - 24) sc.scrollLeft += 24;
    const ll = $("#len-label");
    if (ll) ll.textContent = lenText(t);
    sizeRoll();
  };
  ru.onpointerdown = (e) => {
    const t = curTr(), b = ru.getBoundingClientRect(), x = e.clientX - b.left, ex = endX(t);
    if (x >= ex - 20 && x <= ex + 8) { R.lenDrag = true; ru.setPointerCapture(e.pointerId); return; }
    t.cur = clamp(Math.round((x - KW + sc.scrollLeft) / pxt() / R.snap) * R.snap, 0, t.len * TPB - 1);
    dirty();
  };
  ru.onpointermove = (e) => {
    if (R.lenDrag) return setLen(e);
    const x = e.clientX - ru.getBoundingClientRect().left, ex = endX(curTr());
    ru.style.cursor = x >= ex - 20 && x <= ex + 8 ? "ew-resize" : "pointer";
  };
  ru.onpointerup = ru.onpointercancel = () => (R.lenDrag = false);
  addEventListener("resize", dirty);
  addEventListener("keydown", (e) => {
    if (S.page !== "seq" || inField(e)) return;
    const t = curTr(), k = e.key.toLowerCase(), mod = e.ctrlKey || e.metaKey, any = t.notes.some((n) => n.sel);
    if (mod) {
      const f = { z: () => undo(!e.shiftKey), y: () => undo(false), a: selAll, c: copy, v: paste, d: dup }[k];
      if (f) { e.preventDefault(); f(); }
      return;
    }
    if ((k === "delete" || k === "backspace") && any) { e.preventDefault(); del(); }
    else if (k === "q") quant();
    else if (k.startsWith("arrow") && any) {
      e.preventDefault();
      if (k === "arrowleft") shift(0, -R.snap);
      else if (k === "arrowright") shift(0, R.snap);
      else shift((k === "arrowup" ? 1 : -1) * (e.shiftKey ? 12 : 1));
    }
  });
}
