// Shared app state. Modules read and change it directly; pages re-render from it.

import { getProfile, tracksFor } from "./firmware/index.js";

export const MAX = 8, PPQN = 24, TICK = 5, LOOK = 20;
export const COL = ["#5b8def", "#4cc38a", "#f0c244", "#ff8c42", "#d96ad0", "#8e7cf0"];

const slot = (i) => ({
  i, armed: false, running: false, midiId: "", midiName: "", audioId: "", audioName: "", mon: false,
  pulse: 0, next: 0, last: 0, fw: null, raw: "", ovr: "auto", pat: null, tr: 0,
  info: null, fl: null, snd: null, qs: null, nm: {}, dc: {}, mix: null, lib: null,
});

export const S = {
  midi: null, sysex: false, outs: [], ins: [], bpm: 120, sel: 0, timer: null, rec: null, page: "devices",
  slots: Array.from({ length: MAX }, (_, i) => slot(i)),
  // keyboard / sequencer
  chord: "OFF", key: 0, scale: "MAJOR", snap: false, koct: 4, recOn: false, held: new Map(),
  // drum library
  dg: "HOUSE", dopen: true, beatTempo: false, dmsg: "",
  // sound / controls
  stab: "preset", takes: [], urls: [], demo: null,
};

export const out = (s) => S.outs.find((o) => o.id === s.midiId);
export const fwKey = (s) => (s.ovr !== "auto" ? s.ovr : s.fw || "generic");
export const prof = (s) => getProfile(fwKey(s));
export const trackDefs = (s) => tracksFor(prof(s), s.info);
export const armedSlots = () => S.slots.filter((s) => s.armed && out(s));
export const running = () => S.slots.filter((s) => s.running && out(s));
export const cur = () => S.slots[S.sel];
export const label = (d) => d?.name || d?.label || "Unknown device";
export const tcol = (i) => COL[i % COL.length];
/** True when the device can be edited over SysEx (an FL-protocol firmware that answered INFO). */
export const hasFl = (s) => !!(s.info && s.fl && prof(s).protocol === "fl");
