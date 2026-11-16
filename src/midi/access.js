// Web MIDI and audio-input discovery, plus the built-in synth (virtual devices that play in the browser).

import { S, out } from "../state.js";
import { $ } from "../ui/dom.js";
import { identify, closeClient } from "../device/fl-device.js";
import { stopDevice } from "../sequencer/clock.js";
import { hookInputs } from "../sequencer/keyboard.js";
import { createVirtualDevice } from "../dev/virtual-device.js";
import { createDemoSound } from "../dev/demo-synth.js";
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
    const b = $("#connect-midi");
    b.textContent = "CONNECTED"; b.classList.add("connected"); b.title = "MIDI is connected. Press again to look for new ports.";
    refreshOutputs();
    await primeAudio();
    await refreshAudio();
  } catch (e) { console.error(e); msg("MIDI ACCESS DENIED"); }
}

/** The audio "inputs" of the built-in synths: their synths' output streams, recordable like a real FM-1's USB audio. */
export const demoIns = () => S.demos.filter((d) => d.sound?.stream).map((d) => ({ kind: "audioinput", deviceId: `demo:${d.output.id}`, label: `${d.output.name} · AUDIO`, groupId: "demo", demo: d }));

/** Add a built-in synth: a software device that plays in the browser, so every page can be tried without hardware.
 *  Each press adds one more (up to eight). */
export function enableDemo(target = null) {
  if (S.demos.length >= S.slots.length) return;
  const n = S.demos.length + 1;
  const dev = createVirtualDevice({ name: `Built-in Synth ${n}`, id: n === 1 ? "virtual-fm1" : `virtual-fm1-${n}`, version: "FM-1 RELAY STUDIO BUILT-IN SYNTH 1.0" });
  try { dev.sound = createDemoSound(dev, { presetName: dev.presetName }); } catch (e) { console.warn("demo sound unavailable", e); }
  if (dev.sound) dev.output.onplay = (a, ts) => dev.sound.midi(a, ts);
  S.demos.push(dev);
  S.ins = [...S.ins.filter((d) => !d.demo), ...demoIns()];
  refreshOutputs();
  const has = !target && S.slots.find((s) => s.midiId === dev.output.id);
  const free = !has && (target || S.slots.find((s) => !s.midiId));
  const s = has || free;
  if (s) {
    S.sel = s.i;
    if ((!s.audioId || s === target) && dev.sound?.stream) { s.audioId = `demo:${dev.output.id}`; s.audioName = `${dev.output.name} · AUDIO`; }
    if (free) { free.midiId = dev.output.id; free.midiName = dev.output.name; free.armed = true; onPortChange(free); }
  }
  const b = $("#demo");
  if (b) { b.textContent = S.demos.length >= S.slots.length ? "8 BUILT-IN SYNTHS" : "ADD BUILT-IN SYNTH"; b.title = "Add another built-in synth, to try syncing several devices"; }
  refreshLists(); render();
}

export function refreshOutputs() {
  S.outs = [...(S.midi ? S.midi.outputs.values() : []), ...S.demos.map((d) => d.output)];
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
    S.ins = [...(await navigator.mediaDevices.enumerateDevices()).filter((d) => d.kind === "audioinput"), ...demoIns()];
    S.slots.forEach((s) => {
      if (!s.audioId && s.audioName) { const m = S.ins.find((d) => d.label === s.audioName); if (m) s.audioId = m.deviceId; }
      if (s.audioId && !S.ins.some((d) => d.deviceId === s.audioId)) s.audioId = "";
    });
    autoPair();
    refreshLists();
  } catch (e) { console.error(e); }
}
