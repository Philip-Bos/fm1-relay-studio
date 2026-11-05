// Sound page: every parameter of the selected track and the globals, over the FL editor protocol.
// While open it follows the device live (WATCH): knob turns on the FM-1 move the controls here.

import { S, out, prof, cur, hasFl, tcol } from "../state.js";
import { $, el, wrap, btn, sel, link } from "../ui/dom.js";
import { noteName } from "../music/theory.js";
import { curTr } from "../sequencer/pattern.js";
import { readSound, setParam, rpc, names, identify, watch, pushValue, CMD, FMT } from "../device/fl-device.js";
import { showPage } from "../main.js";

const PRIO = /^(LEVEL|VOL|PAN|CUT|FILT|FLT|RES|ATK|ATT|DEC|REL|SUS|REV|DLY|DELAY|CHO|GLIDE|SWG|KIT)/i;
const sstat = (t) => ($("#sound-status").textContent = t);
const controls = new Map(); // "scope:id" -> setter, for live sync

/** Show a value the way the device would (close enough; the protocol says exact formatting isn't required). */
export function fmtValue(d, v) {
  switch (d.fmt) {
    case FMT.PCT: return Math.round((v * 100) / (d.max || 1)) + "%";
    case FMT.BIPCT: return (v > 0 ? "+" : "") + v;
    case FMT.ENUM: return d.names?.[v - d.min] ?? String(v);
    case FMT.ONOFF: return v ? "ON" : "OFF";
    case FMT.NOTE: return noteName(v);
    case FMT.SEMI: return (v > 0 ? "+" : "") + v + " st";
    case FMT.OCT: return (v > 0 ? "+" : "") + v + " oct";
    case FMT.SWING: return (50 + v / 4).toFixed(v % 4 ? 1 : 0) + "%";
    case FMT.FILT: return v === 0 ? "OFF" : v < 0 ? `LP ${Math.round((-v * 100) / 64)}%` : `HP ${Math.round((v * 100) / 63)}%`;
    case FMT.BPM: return v + " BPM";
    default: return v + (d.unit ? " " + d.unit : "");
  }
}

async function load(s) {
  if (!s.info) await identify(s);
  if (!hasFl(s)) { sstat("THIS FIRMWARE HAS NO EDITOR PROTOCOL — USE CONTROLS"); return renderSound(); }
  sstat("READING…");
  const snd = await readSound(s, sstat);
  if (!snd) return sstat("NO REPLY");
  sstat(`TRACK ${snd.tr + 1} · ${s.info.engines[snd.eng] || "DRUMS"}`);
  renderSound();
  follow(s);
}

/** Pushes from the device while this page is open. */
function onPush(s, cmd, d) {
  if (cur() !== s || S.page !== "sound") return;
  if (cmd === CMD.CHANGED && s.snd) {
    const { scope, id, v } = pushValue(d);
    (scope ? s.snd.G : s.snd.P)[id] = v;
    controls.get(`${scope}:${id}`)?.(v);
  } else if (cmd === CMD.RELOAD) {
    clearTimeout(s.reloadT);
    s.reloadT = setTimeout(() => { if (d[7] !== undefined && d[7] !== 0xf7) s.tr = d[7]; load(s); }, 150);
  }
}
export const follow = (s) => hasFl(s) && watch(s, true, onPush);

function ctl(s, scope, id, d, val) {
  const l = el("label", "prm"), name = el("span", "", d.label), shown = el("em", "", fmtValue(d, val));
  const send = (v) => { if (s.snd?.tr !== s.tr) return sstat("TRACK CHANGED — READ AGAIN"); (scope ? s.snd.G : s.snd.P)[id] = v; setParam(s, scope, id, v); };
  l.title = `${d.label}${d.unit ? ` (${d.unit})` : ""} · ${d.min}…${d.max}, default ${fmtValue(d, d.def)} · double-click to reset`;
  if ((d.fmt === FMT.ENUM && d.names?.length) || d.fmt === FMT.ONOFF) {
    const opts = d.fmt === FMT.ONOFF ? [["OFF", 0], ["ON", 1]] : d.names.map((n, i) => [n, d.min + i]);
    const x = sel(opts, val, (v) => send(+v));
    l.append(name, x);
    controls.set(`${scope}:${id}`, (v) => (x.value = v));
    return l;
  }
  const x = el("input");
  let last = 0;
  x.type = "range"; x.min = d.min; x.max = d.max; x.value = val;
  x.oninput = () => { shown.textContent = fmtValue(d, +x.value); const t = performance.now(); if (t - last > 60) { last = t; send(+x.value); } };
  x.onchange = () => send(+x.value);
  l.ondblclick = () => { x.value = d.def; shown.textContent = fmtValue(d, d.def); send(d.def); };
  l.append(name, x, shown);
  controls.set(`${scope}:${id}`, (v) => { x.value = v; shown.textContent = fmtValue(d, v); l.classList.add("flash"); setTimeout(() => l.classList.remove("flash"), 300); });
  return l;
}

function paramList(box, s, d, scope) {
  const D = scope ? d.dG : d.dP, V = scope ? d.G : d.P, f = el("input", "filter"), list = el("div", "prms");
  f.placeholder = "Filter parameters…"; f.setAttribute("aria-label", "Filter parameters");
  box.append(f, list);
  const items = D.map((x, i) => x && x.label && x.min !== x.max && { x, i }).filter(Boolean)
    .sort((a, b) => PRIO.test(b.x.label) - PRIO.test(a.x.label) || a.i - b.i);
  const draw = () => {
    list.replaceChildren();
    items.filter((it) => it.x.label.toLowerCase().includes(f.value.toLowerCase())).forEach((it) => list.append(ctl(s, scope, it.i, it.x, V[it.i])));
  };
  f.oninput = draw;
  draw();
}

function presetTab(box, s, d) {
  const E = s.info.engines, row = el("div", "sh-row");
  box.append(row);
  if (d.eng >= E.length) return row.append(el("p", "sh-hint", "Drum track: choose the kit under PARAMETERS (KIT), or from the quick sound bar on the Sequencer page."));
  const go = async (eng, pre) => { sstat("LOADING PRESET…"); await rpc(s, CMD.PRESET, [eng, pre]); await load(s); };
  const n = d.names.length;
  row.append(
    wrap("ENGINE", sel(E.map((x, i) => [x, i]), d.eng, async (v) => { d.names = await names(s, +v); go(+v, 0); })),
    wrap("PRESET", sel(d.names.map((x, i) => [`${i + 1}. ${x}`, i]), d.pre, (v) => go(d.eng, +v))),
    btn("◀ PREV", false, () => go(d.eng, (d.pre + n - 1) % n)), btn("NEXT ▶", false, () => go(d.eng, (d.pre + 1) % n)));
  box.append(el("p", "sh-hint", "Loading a preset changes the sound only; the pattern and the mix stay. Your own presets live on the LIBRARY page."));
}

export function renderSound() {
  const s = cur(), t = curTr(), box = $("#sound-body"), tabs = $("#sound-tabs"), p = prof(s);
  box.replaceChildren(); tabs.replaceChildren(); controls.clear();
  box.style.setProperty("--tc", tcol(s.tr));
  [["preset", "PRESET"], ["params", "PARAMETERS"], ["global", "GLOBAL"]].forEach(([k, l]) => tabs.append(btn(l, S.stab === k, () => { S.stab = k; renderSound(); })));
  $("#sound-target").textContent = `${p.name} · TRACK ${s.tr + 1} (${t.name})`;
  $("#sound-load").hidden = !hasFl(s);
  if (!out(s)) return box.append(el("p", "sh-hint", "Choose a MIDI output for this device first (Devices page)."));
  if (!hasFl(s)) {
    const m = el("p", "sh-hint", `${p.name} doesn't answer the editor protocol, so its sound can't be read. Use the CONTROLS page for what it takes over plain MIDI${p.links?.editor ? ", or its own editor: " : "."}`);
    if (p.links?.editor) m.append(link("open editor ↗", p.links.editor));
    box.append(m, btn("OPEN CONTROLS", false, () => showPage("controls")));
    return;
  }
  const d = s.snd;
  if (!d || d.tr !== s.tr) {
    box.append(el("p", "sh-hint", "Reading this track's sound…"));
    if (!s.loadingSound) { s.loadingSound = true; load(s).finally(() => (s.loadingSound = false)); }
    return;
  }
  if (S.stab === "preset") return presetTab(box, s, d);
  paramList(box, s, d, S.stab === "global" ? 1 : 0);
  box.append(el("p", "sh-hint", "Live: turn a knob on the FM-1 and it moves here. Double-click a control to reset it."));
}

export function bindSound() {
  $("#sound-load").onclick = () => load(cur());
}
