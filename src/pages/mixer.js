// Mixer page: one strip per track. FL firmwares are mixed over SysEx (and follow the device live);
// everything else gets CC 7 / CC 10 on each track's channel.

import { S, out, prof, cur, hasFl, tcol } from "../state.js";
import { $, el, btn } from "../ui/dom.js";
import { ensurePattern } from "../sequencer/pattern.js";
import { readMixer, setMix, setPan, watch, CMD } from "../device/fl-device.js";

const mstat = (t) => ($("#mixer-status").textContent = t);

function fader(val, min, max, fn, labelText) {
  const x = el("input", "fader");
  x.type = "range"; x.min = min; x.max = max; x.value = val;
  x.setAttribute("aria-label", labelText);
  let last = 0;
  x.oninput = () => { const t = performance.now(); if (t - last > 50) { last = t; fn(+x.value); } };
  x.onchange = () => fn(+x.value);
  return x;
}

function onPush(s, cmd) {
  if (cur() !== s || S.page !== "mixer") return;
  if (cmd === CMD.TRACK_CHANGED || cmd === CMD.CHANGED || cmd === CMD.RELOAD) {
    clearTimeout(s.mixT);
    s.mixT = setTimeout(async () => { await readMixer(s); renderMixer(); }, 120);
  }
}

async function load(s) {
  mstat("READING…");
  const m = await readMixer(s);
  mstat(m ? "LIVE · follows the device" : "NO REPLY");
  if (m) { watch(s, true, onPush); renderMixer(); }
}

export function renderMixer() {
  const s = cur(), box = $("#mixer-body"), p = prof(s), o = out(s);
  box.replaceChildren();
  $("#mixer-target").textContent = `${p.name} · DEVICE ${s.i + 1}`;
  if (!o) return box.append(el("p", "sh-hint", "Choose a MIDI output for this device first (Devices page)."));
  const tracks = ensurePattern(s).tracks, fl = hasFl(s);
  if (fl && !s.mix) { box.append(el("p", "sh-hint", "Reading the mix…")); if (!s.mixLoading) { s.mixLoading = true; load(s).finally(() => (s.mixLoading = false)); } return; }
  const send = (t, cc, v) => o.send([0xb0 | ((t.ch - 1) & 15), cc, v]);
  const strips = el("div", "strips");
  tracks.forEach((t, k) => {
    const m = fl ? s.mix.tracks[k] : null, st = el("div", "strip");
    st.style.setProperty("--tc", tcol(k));
    st.append(el("b", "strip-name", t.name));
    st.append(el("span", "strip-sub", fl && m ? (m.engine < s.info.engines.length ? s.info.engines[m.engine] : "DRUMS") : `CH ${t.ch}`));
    const lvl = fl ? m?.level ?? 100 : t.ccLevel ?? 100, val = el("em", "strip-val", String(lvl));
    const f = fader(lvl, 0, 127, (v) => {
      val.textContent = v;
      if (fl) { m.level = v; setMix(s, k, v, m.mute); } else { t.ccLevel = v; send(t, 7, v); }
    }, `${t.name} level`);
    st.append(f, val);
    const panVal = fl ? m?.pan : t.ccPan ?? 64;
    if (panVal !== undefined) {
      const pan = el("input", "pan");
      pan.type = "range";
      pan.min = fl ? -64 : 0; pan.max = fl ? 63 : 127; pan.value = panVal;
      pan.setAttribute("aria-label", `${t.name} pan`);
      pan.oninput = () => { if (fl) { m.pan = +pan.value; setPan(s, k, +pan.value); } else { t.ccPan = +pan.value; send(t, 10, +pan.value); } };
      pan.ondblclick = () => { pan.value = fl ? 0 : 64; pan.oninput(); };
      st.append(el("span", "strip-sub", "PAN"), pan);
    }
    const muted = fl ? m?.mute : t.mute;
    st.append(btn(muted ? "MUTED" : "MUTE", muted, () => {
      if (fl) { m.mute = !m.mute; setMix(s, k, m.level, m.mute); } else t.mute = !t.mute;
      renderMixer();
    }, "mini mute"));
    if (fl && m?.solo) st.append(el("span", "capb on", "SOLO"));
    if (fl && m?.armed) st.append(el("span", "capb rec", "REC"));
    strips.append(st);
  });
  box.append(strips);
  box.append(el("p", "sh-hint", fl
    ? "Mixed on the device over SysEx: these are the FM-1's own track levels, pans and mutes. Double-click a pan to centre it."
    : `${p.name} has no editor protocol: level is CC 7, pan CC 10 on each track's channel; MUTE silences this app's sequencer for that track.`));
  if (fl) box.append(btn("↻ READ AGAIN", false, () => load(s)));
}
