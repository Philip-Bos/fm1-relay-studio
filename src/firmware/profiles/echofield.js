import { synth } from "../common.js";

// ECHOFIELD by Philip Bos — https://github.com/Philip-Bos/echofield-fm1 (documented against 0.2.9).
// A granular sampler: one voice played from the keys (C4 = the sample's own pitch), no FL editor protocol.
// CCs from app/params.c (PI[].cc) and app/app.c midi_in; values 0..127 cover each parameter's range linearly.
export default {
  id: "echofield",
  name: "ECHOFIELD",
  author: "Philip Bos",
  documented: "0.2.9",
  links: {
    source: "https://github.com/Philip-Bos/echofield-fm1",
    editor: "https://philip-bos.github.io/echofield-fm1/",
    emulator: "https://philip-bos.github.io/echofield-fm1/emulator/",
  },
  detect: { port: /echofield/i },
  protocol: null,
  tracks: [synth("GRAINS", 1)],
  setup: [
    "ECHOFIELD listens on every channel unless GLO › MIDI CH picks one (then use that channel here).",
    "0.2.9 and later follow MIDI clock: START / STOP play and stop the endless sound, PULSE and the delay lock to the tempo.",
    "Older versions ignore clock: this app also sends CC 104 (play) with START and STOP, so they still start and stop together.",
  ],
  // CC 104 = 127 with START, 0 with STOP: syncs ECHOFIELD before its clock support (src/sequencer/clock.js)
  transport: { playCc: 104 },
  cc: [
    { cc: 7, label: "LEVEL", def: 95, group: "mix" },
    { cc: 14, label: "POSITION", def: 45, group: "grains" },
    { cc: 15, label: "TEXTURE", def: 91, group: "grains" },
    { cc: 16, label: "SCATTER", def: 57, group: "grains" },
    { cc: 17, label: "DRIFT", def: 44, group: "grains" },
    { cc: 18, label: "EVOLVE", def: 44, group: "grains" },
    { cc: 22, label: "HARMONY", def: 38, group: "grains" },
    { cc: 24, label: "SIZE", def: 64, bipolar: true, group: "grains" },
    { cc: 25, label: "DENSITY", def: 64, bipolar: true, group: "grains" },
    { cc: 74, label: "CUTOFF", def: 104, group: "tone" },
    { cc: 71, label: "RESONANCE", def: 13, group: "tone" },
    { cc: 29, label: "DRIVE", def: 6, group: "tone" },
    { cc: 73, label: "ATTACK", def: 19, group: "envelope" },
    { cc: 72, label: "RELEASE", def: 57, group: "envelope" },
    { cc: 85, label: "DELAY TIME", def: 65, group: "sends", hint: "20 … 1000 ms; snaps to note values while a clock runs (0.2.9+)" },
    { cc: 86, label: "DELAY FB", def: 62, group: "sends" },
    { cc: 87, label: "ECHO", def: 23, group: "sends" },
    { cc: 91, label: "REVERB", def: 83, group: "sends" },
    { cc: 93, label: "SHIMMER", def: 28, group: "sends" },
    { cc: 103, label: "FREEZE", def: 0, group: "performance", hint: "64 and above freezes the cloud" },
  ],
  programChange: { label: "PRESET", note: "Program n loads preset n." },
};
