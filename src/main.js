// FM-1 Relay — entry point: wires the transport, the pages and the animation loop.

import { S, running, cur } from "./state.js";
import { $, typing } from "./ui/dom.js";
import { PPQN } from "./state.js";
import { startDevice, stopDevice, setTempo, tap } from "./sequencer/clock.js";
import { armedSlots } from "./state.js";
import { curTr } from "./sequencer/pattern.js";
import { R, KW, buildRoll, drawRoll, tickNow, pxt, dirty } from "./sequencer/roll.js";
import { buildPiano, bindComputerKeys, stepBy, markScale } from "./sequencer/keyboard.js";
import { hist } from "./sequencer/pattern.js";
import { connectMidi, enableDemo, refreshAudio, primeAudio, msg } from "./midi/access.js";
import { watch } from "./device/fl-device.js";
import { buildDevices, render } from "./pages/devices.js";
import { drawSeq, bindSeqKeys } from "./pages/sequencer.js";
import { renderSound, bindSound } from "./pages/sound.js";
import { renderMixer } from "./pages/mixer.js";
import { renderControls } from "./pages/controls.js";
import { renderLibrary } from "./pages/library.js";
import { bindRecord, setRec } from "./pages/record.js";
import { load as loadSession, save as saveSession } from "./session.js";

const PAGES = { seq: drawSeq, sound: renderSound, mixer: renderMixer, controls: renderControls, library: renderLibrary };
const PAGE_IDS = ["devices", "seq", "sound", "mixer", "controls", "library", "capture"];
const LIVE = new Set(["sound", "mixer"]); // pages that follow the device over WATCH

export function refreshPage() { PAGES[S.page]?.(); }

export function showPage(p) {
  const leaving = S.page;
  S.page = p;
  document.querySelectorAll(".page").forEach((e) => (e.hidden = e.dataset.page !== p));
  document.querySelectorAll("#pages button").forEach((b) => b.setAttribute("aria-selected", String(b.dataset.p === p)));
  if (LIVE.has(leaving) && !LIVE.has(p)) S.slots.forEach((s) => s.watching && watch(s, false));
  try { history.replaceState(null, "", "#" + p); } catch { /* sandboxed */ }
  refreshPage();
}

// ---------- animation: transport readout + piano roll ----------
function frame() {
  const r = running(), s = cur(), t = curTr(), pulse = r.length ? r[0].pulse : 0;
  $("#bar-readout").textContent = `${String(Math.floor(pulse / (PPQN * 4)) + 1).padStart(3, "0")}.${String((Math.floor(pulse / PPQN) % 4) + 1).padStart(2, "0")}`;
  $("#clock-state").textContent = r.length ? "RUN" : "STOP";
  $("#play").classList.toggle("active", r.length > 0);
  $("#kmode").textContent = !S.recOn ? "KEYS · REC OFF" : s.running ? "LIVE RECORD" : "STEP ENTRY";
  if (S.page === "seq") {
    if (s.running && t.posA >= 0) { // keep the playhead in view
      const sc = $("#scroll"), x = tickNow(t) * pxt();
      if (x < sc.scrollLeft || x > sc.scrollLeft + sc.clientWidth - KW - 20) sc.scrollLeft = Math.max(0, x - 40);
    }
    if (R.dirty || s.running) { drawRoll(); R.dirty = false; }
  }
  requestAnimationFrame(frame);
}

function wire() {
  $("#connect-midi").onclick = connectMidi;
  $("#demo").onclick = () => { enableDemo(); showPage("devices"); };
  $("#play").onclick = () => { const a = armedSlots(); a.length ? a.forEach(startDevice) : msg("ARM A MIDI OUTPUT"); };
  $("#stop").onclick = () => S.slots.forEach((s) => s.running && stopDevice(s));
  $("#tempo").onchange = (e) => setTempo(e.target.value);
  $("#tempo").onkeydown = (e) => { if (e.key === "Enter") { setTempo(e.target.value); e.target.blur(); } };
  $("#tempo-range").oninput = (e) => setTempo(e.target.value);
  $("#tempo-down").onclick = () => setTempo(S.bpm - 1);
  $("#tempo-up").onclick = () => setTempo(S.bpm + 1);
  $("#tap").onclick = tap;
  $("#refresh-audio").onclick = async () => { await primeAudio(); await refreshAudio(); setRec(`${S.ins.length} AUDIO INPUTS FOUND`); };
  navigator.mediaDevices?.addEventListener?.("devicechange", refreshAudio);
  $("#krec").onclick = (e) => { S.recOn = !S.recOn; e.currentTarget.classList.toggle("active", S.recOn); };
  $("#oct-dn").onclick = () => ($("#oct-val").textContent = S.koct = Math.max(0, S.koct - 1));
  $("#oct-up").onclick = () => ($("#oct-val").textContent = S.koct = Math.min(8, S.koct + 1));
  $("#krest").onclick = () => stepBy(1);
  $("#kback").onclick = () => { stepBy(-1); const t = curTr(); hist(t); t.notes = t.notes.filter((n) => n.t !== t.cur); dirty(); };
  $("#kq").onclick = (e) => { R.recQ = !R.recQ; e.currentTarget.classList.toggle("active", R.recQ); };
  document.querySelectorAll("#pages button").forEach((b) => (b.onclick = () => showPage(b.dataset.p)));
  // Space = global start/stop (ignored while typing in a text field or an open dropdown)
  addEventListener("keydown", (e) => {
    if (e.code !== "Space" || e.repeat || typing(e)) return;
    e.preventDefault();
    running().length ? $("#stop").click() : $("#play").click();
  });
  addEventListener("keyup", (e) => { if (e.code === "Space" && e.target.tagName === "BUTTON") e.preventDefault(); });
  document.addEventListener("device-identified", () => refreshPage());
  addEventListener("hashchange", () => { const p = location.hash.slice(1); if (p !== S.page && PAGE_IDS.includes(p)) showPage(p); });
  // keep the session: every few seconds and when the page goes away
  setInterval(saveSession, 4000);
  addEventListener("pagehide", saveSession);
}

const params = new URLSearchParams(location.search);
if (!params.has("fresh")) loadSession(); // ?fresh starts without the saved session (for testing)
buildDevices();
buildPiano();
buildRoll();
bindComputerKeys();
bindSeqKeys();
bindSound();
bindRecord();
wire();
setTempo(S.bpm);
markScale();
const start = location.hash.slice(1);
showPage(PAGE_IDS.includes(start) ? start : "devices");
if (params.has("demo")) enableDemo();
render();
requestAnimationFrame(frame);
