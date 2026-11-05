// Web MIDI and audio-input discovery, plus the virtual demo device.

import { S, out } from "../state.js";
import { $ } from "../ui/dom.js";
import { identify, closeClient } from "../device/fl-device.js";
import { stopDevice } from "../sequencer/clock.js";
import { hookInputs } from "../sequencer/keyboard.js";
import { createVirtualDevice } from "../dev/virtual-device.js";
import { render, refreshLists, drawCount } from "../pages/devices.js";
import { setRec } from "../pages/record.js";
import { restoreAssignments } from "../session.js";

export const msg = (t) => ($("#midi-status").textContent = t);

export async function connectMidi() {
  if (!navigator.requestMIDIAccess) return msg("WEB MIDI UNAVAILABLE · USE CHROME OR EDGE");
  try {
    try { S.midi = await navigator.requestMIDIAccess({ sysex: true }); S.sysex = true; }
    catch { S.midi = await navigator.requestMIDIAccess({ sysex: false }); S.sysex = false; }
    S.midi.onstatechange = refreshOutputs;
    refreshOutputs();
    await primeAudio();
    await refreshAudio();
  } catch (e) { console.error(e); msg("MIDI ACCESS DENIED"); }
}

/** Add a software FM-1 (SLOOP-like) so every page can be tried without hardware. */
export function enableDemo() {
  if (S.demo) return;
  S.demo = createVirtualDevice();
  refreshOutputs();
  const has = S.slots.find((s) => s.midiId === S.demo.output.id);
  const free = !has && S.slots.find((s) => !s.midiId);
  if (has) S.sel = has.i;
  if (free) { free.midiId = S.demo.output.id; free.midiName = S.demo.output.name; free.armed = true; S.sel = free.i; onPortChange(free); }
  refreshLists(); render();
}

export function refreshOutputs() {
  S.outs = [...(S.midi ? S.midi.outputs.values() : []), ...(S.demo ? [S.demo.output] : [])];
  restoreAssignments();
  S.slots.forEach((s) => {
    if (s.midiId && !out(s)) { stopDevice(s); closeClient(s); s.midiId = ""; s.armed = false; s.fw = null; s.info = null; }
    else if (s.midiId && !s.fw && !s.raw) onPortChange(s);
  });
  refreshLists(); render(); drawCount(); hookInputs();
}

export async function onPortChange(s) {
  closeClient(s);
  s.pat = null;
  render(s);
  await identify(s);
  render(s);
  document.dispatchEvent(new CustomEvent("device-identified", { detail: s }));
}

/** Browsers hide audio device names until the page has had microphone permission once. */
export async function primeAudio() {
  if (!navigator.mediaDevices?.getUserMedia) return;
  try { (await navigator.mediaDevices.getUserMedia({ audio: true })).getTracks().forEach((t) => t.stop()); }
  catch { setRec("ALLOW MICROPHONE ACCESS TO LIST AUDIO INPUTS"); }
}

/** Pick the audio input whose name matches the MIDI port ("JIANT", "Felucca"…). */
function autoPair() {
  S.slots.forEach((s) => {
    const o = out(s);
    if (s.audioId || !o) return;
    const key = o.name.toLowerCase().replace(/^\d+-\s*/, "").replace(/\s*midi\s*\d*$/, "").trim();
    if (!key) return;
    const m = S.ins.find((d) => d.label && !["default", "communications"].includes(d.deviceId) && d.label.toLowerCase().includes(key) && !S.slots.some((x) => x.audioId === d.deviceId));
    if (m) { s.audioId = m.deviceId; s.audioName = m.label; }
  });
}

export async function refreshAudio() {
  if (!navigator.mediaDevices?.enumerateDevices) return;
  try {
    S.ins = (await navigator.mediaDevices.enumerateDevices()).filter((d) => d.kind === "audioinput");
    S.slots.forEach((s) => {
      if (!s.audioId && s.audioName) { const m = S.ins.find((d) => d.label === s.audioName); if (m) s.audioId = m.deviceId; }
      if (s.audioId && !S.ins.some((d) => d.deviceId === s.audioId)) s.audioId = "";
    });
    autoPair();
    refreshLists();
  } catch (e) { console.error(e); }
}
