// Sequencer page: track tabs, tools, the drum beat library, the quick sound bar and device pattern sync.

import { S, out, prof, cur, label, tcol, hasFl } from "../state.js";
import { $, el, wrap, grp, btn, sel, rngL, range, clamp } from "../ui/dom.js";
import { NN, SCALES, CH_LIST } from "../music/theory.js";
import { DRUMSETS, VEL, LN, parseLay, genDrums } from "../music/drum-library.js";
import { ensurePattern, curTr, allNotesOff, lanesOf, hist } from "../sequencer/pattern.js";
import { R, SNAPS, dirty, sizeRoll, initialScroll, lenText, quant, legato, human, shift, dup, del, undo, clearTrack, audition } from "../sequencer/roll.js";
import { markScale } from "../sequencer/keyboard.js";
import { setTempo } from "../sequencer/clock.js";
import { rpc, desc, names, selectTrack, pullPattern, pushPattern, CMD } from "../device/fl-device.js";
import { parseDump } from "../protocol/fl.js";
import { writeV14 } from "../lib/encoding.js";
import { exportMidi } from "../session.js";

const status = (t) => { S.seqMsg = t; const m = $("#seq-msg"); if (m) m.textContent = t; };

export function drawSeq() {
  const s = cur(), p = prof(s), pat = ensurePattern(s), o = out(s);
  $("#seq-title").textContent = `DEVICE ${s.i + 1} · ${o ? label(o) : "NO OUTPUT"}${o && label(o).toUpperCase() === p.name ? "" : " · " + p.name}`;
  $("#seq-hint").textContent = o ? "" : "No MIDI output yet: press CONNECT, then choose one on the Devices page.";
  const tabs = $("#tracks");
  tabs.replaceChildren();
  pat.tracks.forEach((t, i) => {
    const b = el("button", "tab" + (t.mute ? " muted" : ""), t.name);
    b.role = "tab"; b.type = "button";
    b.setAttribute("aria-selected", String(i === s.tr));
    b.style.setProperty("--tc", tcol(i));
    b.title = `Channel ${t.ch}${t.drum ? " · drum grid" : ""}${t.notes.length ? ` · ${t.notes.length} notes` : ""}`;
    b.onclick = () => { s.tr = i; drawSeq(); };
    tabs.append(b);
  });
  const t = pat.tracks[s.tr], tools = $("#seq-tools");
  tools.replaceChildren();
  tools.append(
    grp("TRACK",
      wrap("CHANNEL", sel(range(1, 16, (c) => "CH " + c), t.ch, (v) => { o && allNotesOff(s, o); t.ch = +v; })),
      btn(t.drum ? "DRUM GRID" : "NOTES", false, () => {
        if (t.notes.length && !confirm("Switching grid type clears this track. Continue?")) return;
        t.drum = !t.drum; t.notes = []; t._sc = 0; drawSeq();
      }),
      btn(t.mute ? "MUTED" : "MUTE", t.mute, () => { t.mute = !t.mute; drawSeq(); })),
    grp("TIMING",
      wrap("LENGTH", Object.assign(el("span", "mode"), { id: "len-label", textContent: lenText(t), title: "Drag the red flag on the ruler to change the number of bars" })),
      rngL("SWING", 0, 100, t.swing, (v) => (t.swing = v))),
    grp("KEY & CHORDS",
      wrap("KEY", sel(NN.map((n, i) => [n, i]), S.key, (v) => { S.key = +v; markScale(); dirty(); })),
      wrap("SCALE", sel(Object.keys(SCALES).map((k) => [k, k]), S.scale, (v) => { S.scale = v; markScale(); dirty(); })),
      wrap("CHORD", sel(CH_LIST.map((c) => [c, c]), S.chord, (v) => { S.chord = v; })),
      btn("SNAP TO KEY", S.snap, () => { S.snap = !S.snap; drawSeq(); })),
    grp("TOOL",
      btn("POINTER", R.tool === "ptr", () => { R.tool = "ptr"; drawSeq(); }),
      btn("PENCIL", R.tool === "pen", () => { R.tool = "pen"; drawSeq(); }),
      wrap("GRID", sel(SNAPS, R.snap, (v) => { R.snap = +v; dirty(); })),
      wrap("ZOOM", Object.assign(el("input"), { type: "range", min: 16, max: 160, value: R.zoom, oninput: (e) => { R.zoom = +e.target.value; sizeRoll(); } }))),
    grp("EDIT (selection, or all)",
      btn("QUANTISE", false, quant), btn("LEGATO", false, legato), btn("HUMANISE", false, human),
      btn("−OCT", false, () => shift(-12)), btn("−1", false, () => shift(-1)), btn("+1", false, () => shift(1)), btn("+OCT", false, () => shift(12)),
      btn("DUPLICATE", false, dup), btn("DELETE", false, del), btn("CLEAR", false, () => confirm("Clear every note of this track?") && clearTrack()),
      btn("UNDO", false, () => undo(true)), btn("REDO", false, () => undo(false))),
    patternTools(s, t));
  $("#roll").parentElement.style.setProperty("--tc", tcol(s.tr));
  initialScroll(t);
  renderQuick();
  renderDrumLib();
  sizeRoll();
}

// ---------- the device's own sequencer ----------
function patternTools(s, t) {
  const g = grp("PATTERN");
  if (hasFl(s)) {
    const go = (fn, what) => async () => {
      if (s.busy) return;
      s.busy = true; status(what + "…");
      try { status((await fn(s, s.tr, status)) ? `${what}: done.` : `${what}: the device did not answer.`); }
      catch (e) { console.error(e); status(`${what} failed.`); }
      s.busy = false; drawSeq();
    };
    const pull = btn("⇩ PULL FROM DEVICE", false, go(pullPattern, "Reading the device's pattern"));
    pull.title = "Replace this track with the pattern stored on the device (undoable)";
    const push = btn("⇧ PUSH TO DEVICE", false, () => confirm(`Overwrite ${t.name}'s pattern on the device with this one?`) && go(pushPattern, "Writing the pattern to the device")());
    push.title = "Write this track into the device's own step sequencer (up to 4 notes per step)";
    g.append(pull, push);
  }
  g.append(btn("⬇ EXPORT .MID", false, () => exportMidi(s) || status("Nothing to export: every track is empty.")));
  g.append(Object.assign(el("span", "seq-msg"), { id: "seq-msg", textContent: S.seqMsg || "" }));
  return g;
}

// ---------- drum beats: 100 built-in grooves + your own saved beats (drum tracks only) ----------
const DG = Object.keys(DRUMSETS), MYK = "fm1-relay-my-beats", ROWS3 = { K: 0, B: 0, S: 1, C: 1, N: 1, R: 1 };
const myBeats = () => { try { return JSON.parse(localStorage.getItem(MYK)) || []; } catch { return []; } };
const myStore = (a) => { try { localStorage.setItem(MYK, JSON.stringify(a)); return true; } catch { return false; } };
const laneLetter = (p) => Object.keys(LN).find((k) => LN[k] === p) || "H";

function mini(hits, tc) { // tiny preview of the first bar: kick / snare+clap / everything else
  const c = el("canvas", "mini-c");
  c.width = 128; c.height = 42; c.setAttribute("aria-hidden", "true");
  const x = c.getContext("2d");
  if (!x) return c;
  for (let i = 0; i < 16; i += 4) { x.fillStyle = "#ffffff0a"; x.fillRect(i * 8, 0, 32, 42); }
  const colr = [tc, "#e6e4de", "#8b8f98"];
  hits.forEach(([i, r]) => { x.fillStyle = colr[r]; x.fillRect(i * 8 + 1, r * 14 + 2, 6, 10); });
  return c;
}
const hitsOfLayers = (lay) => Object.entries(lay).flatMap(([l, pt]) => [...pt].map((ch, i) => (VEL[ch] ? [i, ROWS3[l] ?? 2] : null)).filter(Boolean));
const hitsOfNotes = (notes) => notes.filter((n) => n.t < 384).map((n) => [Math.min(15, Math.round(n.t / 24)), ROWS3[laneLetter(n.p)] ?? 2]);

function putBeat(notes, len, sw, bpm, name, key) {
  const t = curTr(), lanes = lanesOf(t).map((l) => l[1]);
  hist(t);
  t.notes = notes.filter((n) => lanes.includes(n.p));
  t.len = len; t.cur = 0; t.swing = sw; t.beat = key;
  if (S.beatTempo && bpm) setTempo(bpm);
  const lost = notes.length - t.notes.length;
  S.dmsg = `Loaded “${name}”${bpm ? ` · ${bpm} BPM` : ""} · ${len / 4} bars${lost ? ` · ${lost} hits have no lane on this kit` : ""} — Ctrl+Z undoes it.`;
  drawSeq();
}
const loadBeat = (g, i) => { const G = DRUMSETS[g], p = G.list[i]; putBeat(genDrums(p, i + DG.indexOf(g), G), 64, G.sw, p[1], p[0], g + ":" + i); };
const loadMine = (b) => putBeat(b.notes.map(([t, d, p, v]) => ({ t, d, p, v })), b.len, b.swing || 0, b.bpm, b.name, "MY:" + b.id);

function saveBeat(name) {
  const t = curTr(), all = myBeats();
  if (!t.notes.length) { S.dmsg = "Nothing to save yet — this drum track is empty."; return renderDrumLib(); }
  name = (name || "").trim() || `My beat ${all.length + 1}`;
  const dupI = all.findIndex((b) => b.name.toLowerCase() === name.toLowerCase());
  if (dupI >= 0 && !confirm(`You already have a beat called “${name}”. Replace it?`)) return;
  const b = { id: Date.now(), name, bpm: S.bpm, len: t.len, swing: t.swing, notes: t.notes.map((n) => [n.t, n.d, n.p, n.v]) };
  if (dupI >= 0) all.splice(dupI, 1);
  all.unshift(b);
  if (!myStore(all)) { S.dmsg = "Couldn't save: this browser blocks local storage. Open the page normally (not a private window)."; return renderDrumLib(); }
  S.dg = "MY BEATS"; S.dmsg = `Saved “${name}” to MY BEATS.`; t.beat = "MY:" + b.id;
  renderDrumLib();
}

function renderDrumLib() {
  const box = $("#drumlib");
  if (!box) return;
  const t = curTr(), s = cur(), tc = tcol(s.tr);
  box.replaceChildren();
  box.hidden = !t.drum;
  if (!t.drum) return;
  box.style.setProperty("--tc", tc);
  const head = el("div", "dl-head");
  head.append(el("b", "dl-title", "DRUM BEATS"), el("span", "dl-sub", "100 grooves in 10 genres, 16 bars each. Click one to load it into this track."),
    btn(S.dopen ? "▾ HIDE" : "▸ SHOW", false, () => { S.dopen = !S.dopen; renderDrumLib(); }));
  box.append(head);
  if (!S.dopen) return;
  const mine = myBeats(), tabs = el("div", "dl-genres");
  tabs.setAttribute("role", "tablist");
  [...DG, "MY BEATS"].forEach((g, k) => {
    const b = el("button", "gchip" + (g === "MY BEATS" ? " mine" : ""), g === "MY BEATS" ? `★ MY BEATS (${mine.length})` : g);
    b.role = "tab"; b.type = "button";
    b.setAttribute("aria-selected", String(S.dg === g));
    b.style.setProperty("--gc", tcol(k));
    b.onclick = () => { S.dg = g; renderDrumLib(); };
    tabs.append(b);
  });
  const list = el("div", "dl-cards");
  if (S.dg === "MY BEATS") {
    if (!mine.length) list.append(el("p", "sh-hint", "No saved beats yet. Program a drum pattern below, name it, and press SAVE — it will appear here and stay in this browser."));
    mine.forEach((b) => {
      const w = el("div", "bwrap"), c = el("button", "bcard");
      c.type = "button"; c.setAttribute("aria-pressed", String(t.beat === "MY:" + b.id));
      c.append(mini(hitsOfNotes(b.notes.map(([tt, , p]) => ({ t: tt, p }))), tc), el("b", "", b.name), el("span", "bpm", `${b.bpm} BPM · ${b.len / 4} bars`));
      c.onclick = () => loadMine(b);
      const x = el("button", "bdel", "✕");
      x.type = "button"; x.title = "Delete this beat"; x.setAttribute("aria-label", `Delete ${b.name}`);
      x.onclick = () => { if (!confirm(`Delete “${b.name}” permanently?`)) return; myStore(myBeats().filter((m) => m.id !== b.id)); renderDrumLib(); };
      w.append(c, x);
      list.append(w);
    });
  } else {
    DRUMSETS[S.dg].list.forEach((p, i) => {
      const c = el("button", "bcard");
      c.type = "button"; c.setAttribute("aria-pressed", String(t.beat === S.dg + ":" + i));
      c.append(mini(hitsOfLayers(parseLay(p[2])), tc), el("b", "", p[0]), el("span", "bpm", `${p[1]} BPM`));
      c.title = `${p[0]} · ${p[1]} BPM`;
      c.onclick = () => loadBeat(S.dg, i);
      list.append(c);
    });
  }
  const foot = el("div", "dl-foot"), nm = Object.assign(el("input", "dl-name"), { placeholder: "Name your beat…", maxLength: 40 });
  nm.setAttribute("aria-label", "Beat name");
  nm.onkeydown = (e) => { if (e.key === "Enter") saveBeat(nm.value); };
  const tl = el("label", "dl-check"), cb = Object.assign(el("input"), { type: "checkbox", checked: S.beatTempo });
  cb.onchange = () => (S.beatTempo = cb.checked);
  tl.append(cb, " Also set the tempo to the beat's BPM");
  const msg = el("div", "dl-msg", S.dmsg || "Tip: load a beat, then edit it in the roll below. Right-click removes a hit; drag the red flag on the ruler to change the number of bars.");
  msg.setAttribute("role", "status");
  foot.append(tl, el("span", "dl-gap"), nm, btn("★ SAVE THIS BEAT", false, () => saveBeat(nm.value)));
  box.append(tabs, list, foot, msg);
}

// ---------- quick sound bar: change the sound of the track you're programming ----------
async function quickLoad(s) {
  if (!s.info || s.qsBusy) return;
  const tr = s.tr;
  s.qsBusy = true;
  try {
    if (s.info.ntrk > 1) await selectTrack(s, tr);
    const dm = await rpc(s, CMD.DUMP);
    if (!dm) throw new Error("no reply");
    const dump = parseDump(dm, s.info), eng = dump.engine, E = s.info.engines.length;
    let kit = null;
    if (eng >= E) { const d = await desc(s, 0, s.info.pe0, eng); if (d?.names) kit = { d, v: dump.P[s.info.pe0] }; }
    s.qs = { tr, eng, pre: dump.preset, names: eng < E ? await names(s, eng) : [], kit };
  } catch { s.qs = { tr, fail: true }; }
  s.qsBusy = false;
  if (S.page === "seq" && cur() === s) renderQuick();
}
async function qsGo(eng, pre) {
  const s = cur(), q = s.qs, t = curTr();
  if (!q || q.fail) return;
  if (s.info.ntrk > 1) await rpc(s, CMD.TRACK, [s.tr]);
  await rpc(s, CMD.PRESET, [eng, pre]);
  s.snd = null;
  if (eng !== q.eng) q.names = await names(s, eng);
  q.eng = eng; q.pre = pre;
  renderQuick(); audition(t, [60]);
}
async function qsKit(v) {
  const s = cur(), q = s.qs, t = curTr();
  if (!q?.kit) return;
  if (s.info.ntrk > 1) await rpc(s, CMD.TRACK, [s.tr]);
  await rpc(s, CMD.SET, [0, s.info.pe0, ...writeV14(v)]);
  s.snd = null; q.kit.v = v;
  renderQuick(); audition(t, [36]);
}
function qsStep(d) { // [ and ] keys, and the arrow buttons
  const s = cur(), q = s.qs, t = curTr();
  if (q && !q.fail) {
    if (q.kit) { const k = q.kit, lo = k.d.min, n = k.d.max - lo + 1; return qsKit(lo + ((((k.v - lo + d) % n) + n) % n)); }
    const n = q.names.length;
    if (n) return qsGo(q.eng, (q.pre + d + n) % n);
  }
  if (!out(s)) return;
  t.pc = ((((t.pc || 0) + d) % 128) + 128) % 128;
  sendPC(s, t); renderQuick();
}
export function sendPC(s, t) {
  const o = out(s), ch = (t.ch - 1) & 15;
  if (!o) return;
  o.send([0xb0 | ch, 0, t.bank || 0]);
  o.send([0xc0 | ch, t.pc || 0]);
  audition(t, t.drum ? [lanesOf(t)[0][1]] : [60]);
}

function renderQuick() {
  const box = $("#qs");
  if (!box) return;
  box.replaceChildren();
  const s = cur(), t = curTr(), o = out(s), q = s.qs?.tr === s.tr ? s.qs : null, p = prof(s);
  box.style.setProperty("--tc", tcol(s.tr));
  box.append(el("span", "qs-t", "SOUND"), el("b", "qs-trk", t.name));
  if (!o) return box.append(el("span", "qs-note", "Choose a MIDI output on the Devices page to change sounds from here."));
  const lcd = (txt) => el("div", "qs-lcd", txt);
  const arrows = (fn, ...mid) => { const w = el("div", "qs-pick"); w.append(btn("◀", false, () => fn(-1)), ...mid, btn("▶", false, () => fn(1))); return w; };
  const refresh = btn("↻", false, () => { s.qs = null; quickLoad(s); renderQuick(); });
  refresh.title = "Read the current sound from the device"; refresh.setAttribute("aria-label", "Read sound from device");
  if (hasFl(s) && q && !q.fail && (q.kit || q.names.length)) {
    if (q.kit) {
      const nms = q.kit.d.names || [], curName = nms[q.kit.v - q.kit.d.min] || String(q.kit.v);
      box.append(wrap("DRUM KIT", sel(nms.map((n, i) => [n, q.kit.d.min + i]), q.kit.v, (v) => qsKit(+v))), arrows(qsStep, lcd(curName)));
    } else {
      const E = s.info.engines, curName = q.names[q.pre] || "—";
      box.append(wrap("ENGINE", sel(E.map((x, i) => [x, i]), q.eng, (v) => qsGo(+v, 0))),
        arrows(qsStep, lcd(`${String(q.pre + 1).padStart(3, "0")} ${curName}`)),
        wrap("BROWSE", sel(q.names.map((x, i) => [`${i + 1}. ${x}`, i]), q.pre, (v) => qsGo(q.eng, +v))));
    }
    box.append(refresh, el("span", "qs-note", "Keys [ and ] step through sounds"));
  } else if (hasFl(s) && !q) {
    box.append(el("span", "qs-note", "Reading this track's sound…"));
    quickLoad(s);
  } else if (p.programChange) {
    const bank = Object.assign(el("input"), { type: "number", min: 0, max: 127, value: t.bank || 0 });
    const pc = Object.assign(el("input"), { type: "number", min: 1, max: 128, value: (t.pc || 0) + 1 });
    bank.onchange = () => (t.bank = clamp(+bank.value, 0, 127));
    pc.onchange = () => { t.pc = clamp(+pc.value - 1, 0, 127); sendPC(s, t); renderQuick(); };
    const kits = t.drum && p.kits;
    box.append(arrows(qsStep, lcd(kits ? `KIT ${(t.pc || 0) + 1} ${p.kits[t.pc || 0] || ""}` : `${p.programChange.label} ${(t.pc || 0) + 1}`)), wrap("GO TO", pc));
    if (p.programChange.bankSelect !== false) box.append(wrap("BANK", bank));
    box.append(el("span", "qs-note", `Program Change on channel ${t.ch}${p.programChange.note ? " · " + p.programChange.note : ""}`));
    if (hasFl(s)) box.append(refresh);
  } else {
    box.append(el("span", "qs-note", `${p.name} doesn't document Program Change. Change sounds on the device.`));
  }
}

export function bindSeqKeys() {
  addEventListener("keydown", (e) => {
    if (S.page !== "seq" || /INPUT|SELECT|TEXTAREA/.test(e.target.tagName) || e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.key === "[") { e.preventDefault(); qsStep(-1); } else if (e.key === "]") { e.preventDefault(); qsStep(1); }
  });
}
