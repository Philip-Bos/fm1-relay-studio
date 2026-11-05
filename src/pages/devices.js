// Devices page: up to eight FM-1 slots (MIDI out, audio in, firmware) and setup help for the selected one.

import { S, MAX, out, prof, armedSlots, label, tcol, hasFl } from "../state.js";
import { $, el, link } from "../ui/dom.js";
import { PROFILES } from "../firmware/index.js";
import { startDevice, stopDevice } from "../sequencer/clock.js";

import { onPortChange, refreshAudio } from "../midi/access.js";
import { renderRecTargets } from "./record.js";
import { refreshPage } from "../main.js";

const cards = [];

function fill(sel, list, val, ph, key) {
  sel.replaceChildren(new Option(ph, ""));
  list.forEach((d) => sel.add(new Option(label(d), d[key])));
  sel.value = val;
}
export function refreshLists() {
  S.slots.forEach((s) => {
    const c = cards[s.i];
    if (!c) return;
    if (document.activeElement !== c.m) fill(c.m, S.outs, s.midiId, "Select output…", "id");
    if (document.activeElement !== c.a) fill(c.a, S.ins, s.audioId, "Select audio input…", "deviceId");
  });
  renderRecTargets();
}

export function drawCount() {
  $("#device-count").textContent = `${armedSlots().length}/${MAX} ARMED`;
  $("#midi-status").textContent = S.midi || S.demo ? `${S.outs.length} OUT · ${S.sysex ? "SYSEX" : S.demo ? "DEMO" : "NO SYSEX"}` : "NOT CONNECTED";
}

export function render(s) {
  if (!s) { S.slots.forEach(render); drawCount(); renderSetup(); return; }
  const c = cards[s.i];
  if (!c) return;
  const o = out(s), p = prof(s);
  c.el.style.setProperty("--tc", tcol(s.i));
  c.el.classList.toggle("armed", s.armed);
  c.el.classList.toggle("running", s.running);
  c.el.classList.toggle("picked", S.sel === s.i);
  c.name.textContent = o ? label(o) : "No output";
  c.fw.textContent = s.ovr !== "auto" ? p.name + " · SET" : s.fw ? p.name : s.raw || "—";
  c.fw.classList.toggle("ok", !!s.fw || s.ovr !== "auto");
  c.fw.title = s.raw ? "Reported: " + s.raw : "Firmware not read";
  c.f.value = s.ovr;
  c.sync.textContent = !o || !s.armed ? "OFFLINE" : s.running ? "CLOCKING" : "ARMED";
  c.sx.hidden = !hasFl(s);
  c.arm.setAttribute("aria-pressed", String(s.armed));
  c.mon.classList.toggle("active", s.mon);
  c.run.textContent = s.running ? "STOP" : "START";
  c.run.classList.toggle("running", s.running);
  c.run.disabled = !s.armed || !o;
  if (S.sel === s.i) { renderSetup(); refreshPage(); }
}

/** Setup help for the selected device: the firmware's menu paths, links and what this app can do with it. */
function renderSetup() {
  const box = $("#setup");
  if (!box) return;
  const s = S.slots[S.sel], p = prof(s), o = out(s);
  box.replaceChildren();
  box.style.setProperty("--tc", tcol(s.i));
  const head = el("div", "setup-head");
  head.append(el("b", "", `DEVICE ${s.i + 1} · ${p.name}`), el("span", "dim", o ? label(o) : "no output chosen"));
  if (s.info) head.append(el("span", "chip-t", s.info.version));
  box.append(head);
  if (!o) { box.append(el("p", "sh-hint", "Press CONNECT (or TRY DEMO DEVICE), then choose a MIDI output on a card. The firmware is detected automatically.")); return; }
  const ul = el("ul", "setup-list");
  p.setup.forEach((t) => ul.append(el("li", "", t)));
  box.append(ul);
  const caps = el("div", "chips");
  const cap = (on, text) => caps.append(el("span", "capb" + (on ? " on" : ""), text));
  cap(true, "CLOCK + NOTES");
  cap(hasFl(s), "SOUND EDITOR");
  cap(hasFl(s), "MIXER (SYSEX)");
  cap(hasFl(s), "PATTERN SYNC");
  cap(p.cc.length > 0, `${p.cc.length} CC CONTROLS${p.ccUnverified ? " (UNVERIFIED)" : ""}`);
  cap(!!p.programChange, "PROGRAM CHANGE");
  cap(!!p.remote, "REMOTE BUTTONS");
  cap(!!p.fx, "PUNCH-IN FX");
  box.append(caps);
  const links = el("div", "setup-links");
  Object.entries(p.links || {}).forEach(([k, href]) => links.append(link(k.toUpperCase() + " ↗", href)));
  if (links.childElementCount) box.append(links);
  if (!s.info && S.sysex && p.protocol === "fl") box.append(el("p", "warn", "This firmware speaks the editor protocol but didn't answer. Check the USB cable, then press IDENT."));
  if (!S.sysex && !S.demo) box.append(el("p", "warn", "SysEx permission was not granted, so sound editing, the SysEx mixer and pattern sync are off. Reconnect and allow SysEx."));
}

export function buildDevices() {
  const tpl = $("#device-template"), fwSel = (sel) => {
    sel.replaceChildren(new Option("Auto-detect", "auto"));
    PROFILES.forEach((p) => sel.add(new Option(p.name, p.id)));
  };
  S.slots.forEach((s) => {
    const elx = tpl.content.firstElementChild.cloneNode(true), q = (x) => elx.querySelector(x);
    const c = { el: elx, m: q(".midi-select"), a: q(".audio-select"), f: q(".fw-select"), name: q(".name"), fw: q(".fw"),
      sync: q(".sync"), arm: q(".arm"), mon: q(".monitor"), run: q(".run"), sx: q(".sx") };
    fwSel(c.f);
    cards[s.i] = c;
    q(".num").textContent = String(s.i + 1).padStart(2, "0");
    q(".slot-top").addEventListener("click", (e) => { if (e.target.closest(".arm")) return; S.sel = s.i; render(); });
    c.arm.onclick = () => { if (s.armed) stopDevice(s); s.armed = !s.armed; render(); };
    c.m.onchange = (e) => {
      stopDevice(s);
      s.midiId = e.target.value;
      s.midiName = out(s)?.name || "";
      s.armed = !!s.midiId;
      S.sel = s.i;
      onPortChange(s).then(refreshAudio);
      render();
    };
    c.a.onchange = (e) => { s.audioId = e.target.value; s.audioName = S.ins.find((d) => d.deviceId === s.audioId)?.label || ""; renderRecTargets(); };
    c.f.onchange = (e) => { s.ovr = e.target.value; render(); };
    c.mon.onclick = () => { s.mon = !s.mon; render(s); };
    q(".ident").onclick = () => onPortChange(s);
    c.run.onclick = () => (s.running ? stopDevice(s) : startDevice(s));
    $("#devices").append(elx);
  });
  render(); refreshLists();
}
