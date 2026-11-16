import { synth } from "../common.js";

// SHRUB by Xfer Records — https://shrub.audio (guide 1.0 for firmware V1.07, November 2026, beta).
// Serum 1 pared down for the FM-1: one 4-voice paraphonic part. No FL editor protocol: it doesn't answer INFO, and its
// editor at shrub.audio/editor talks to it over its own link. Facts below are from https://shrub.audio/guide
// ("MIDI and USB", "The presets", Appendix C "The factory MIDI CC map").
//
// Detection: on USB it shows up as the generic "USB Composite Device" (checked on a unit running V1.07), not a name of
// its own. That name is the only hint the app gets, so it maps to SHRUB; INFO-answering firmwares are matched first.
// Pick another firmware on the device card if a different one uses that name.

// Appendix C. The user can remap CCs in the editor (MIDI Learn, File › Load MIDI Map); the FM-1 keeps that map.
// The guide gives no ranges or defaults: 0..127 is assumed to cover each knob, and `def` is a neutral start.
const CC = [
  // mix
  { cc: 7, label: "LEVEL", def: 100, group: "mix", hint: "the preset's level" },
  { cc: 5, label: "GLIDE", def: 0, group: "mix" },
  // macros
  { cc: 16, label: "MACRO 1", def: 0, group: "macros" },
  { cc: 17, label: "MACRO 2", def: 0, group: "macros" },
  { cc: 18, label: "MACRO 3", def: 0, group: "macros" },
  { cc: 19, label: "MACRO 4", def: 0, group: "macros" },
  // oscillators
  { cc: 20, label: "A WT POS", def: 0, group: "oscillators" },
  { cc: 22, label: "A WARP", def: 0, group: "oscillators" },
  { cc: 24, label: "A LEVEL", def: 96, group: "oscillators" },
  { cc: 28, label: "A DETUNE", def: 32, group: "oscillators" },
  { cc: 30, label: "A BLEND", def: 96, group: "oscillators" },
  { cc: 21, label: "B WT POS", def: 0, group: "oscillators" },
  { cc: 23, label: "B WARP", def: 0, group: "oscillators" },
  { cc: 25, label: "B LEVEL", def: 0, group: "oscillators" },
  { cc: 29, label: "B DETUNE", def: 32, group: "oscillators" },
  { cc: 26, label: "SUB", def: 0, group: "oscillators" },
  { cc: 27, label: "NOISE", def: 0, group: "oscillators" },
  { cc: 79, label: "FAT", def: 0, group: "oscillators" },
  // filter (one filter shared by every voice)
  { cc: 74, label: "CUTOFF", def: 127, group: "filter" },
  { cc: 71, label: "RES", def: 0, group: "filter" },
  { cc: 70, label: "DRIVE", def: 0, group: "filter" },
  { cc: 31, label: "FILTER MIX", def: 127, group: "filter" },
  { cc: 80, label: "ENV 2 › CUTOFF", def: 64, bipolar: true, group: "filter", hint: "range not stated in the guide; assumed bipolar" },
  // envelopes
  { cc: 73, label: "ENV 1 ATTACK", def: 0, group: "envelopes" },
  { cc: 75, label: "ENV 1 DECAY", def: 64, group: "envelopes" },
  { cc: 78, label: "ENV 1 SUSTAIN", def: 127, group: "envelopes" },
  { cc: 72, label: "ENV 1 RELEASE", def: 20, group: "envelopes" },
  { cc: 81, label: "ENV 2 ATTACK", def: 0, group: "envelopes" },
  { cc: 82, label: "ENV 2 DECAY", def: 64, group: "envelopes" },
  { cc: 83, label: "ENV 2 SUSTAIN", def: 0, group: "envelopes" },
  { cc: 85, label: "ENV 2 RELEASE", def: 20, group: "envelopes" },
  // LFOs
  { cc: 76, label: "LFO 1 RATE", def: 64, group: "lfo" },
  { cc: 77, label: "LFO 2 RATE", def: 64, group: "lfo" },
  { cc: 86, label: "LFO 3 RATE", def: 64, group: "lfo" },
  { cc: 87, label: "LFO 4 RATE", def: 64, group: "lfo" },
  // effects
  { cc: 90, label: "HYPER MIX", def: 0, group: "fx" },
  { cc: 93, label: "CHORUS MIX", def: 0, group: "fx" },
  { cc: 95, label: "PHASER MIX", def: 0, group: "fx" },
  { cc: 102, label: "FLANGER MIX", def: 0, group: "fx" },
  { cc: 92, label: "DIST MIX", def: 0, group: "fx" },
  { cc: 104, label: "DIST DRIVE", def: 0, group: "fx" },
  { cc: 94, label: "DELAY MIX", def: 0, group: "fx" },
  { cc: 105, label: "DELAY FB", def: 40, group: "fx" },
  { cc: 91, label: "REVERB MIX", def: 0, group: "fx" },
  { cc: 106, label: "REVERB SIZE", def: 64, group: "fx" },
  { cc: 107, label: "REVERB DECAY", def: 64, group: "fx" },
  { cc: 110, label: "FX FILTER MIX", def: 0, group: "fx" },
  { cc: 108, label: "FX FILTER CUT", def: 64, group: "fx" },
  { cc: 109, label: "FX FILTER RES", def: 0, group: "fx" },
  { cc: 111, label: "EQ GAIN 1", def: 64, bipolar: true, group: "fx" },
  { cc: 112, label: "EQ GAIN 2", def: 64, bipolar: true, group: "fx" },
  { cc: 103, label: "COMP MIX", def: 0, group: "fx" },
  // arp
  { cc: 113, label: "ARP RATE", def: 64, group: "arp" },
  { cc: 114, label: "ARP GATE", def: 64, group: "arp" },
];

export default {
  id: "shrub",
  name: "SHRUB",
  author: "Xfer Records",
  documented: "V1.07",
  links: {
    home: "https://shrub.audio",
    manual: "https://shrub.audio/guide",
    editor: "https://shrub.audio/editor",
  },
  detect: { port: /^usb composite device$/i, genericPort: true, info: /shrub/i },
  protocol: null,
  tracks: [synth("SHRUB", 1)],
  setup: [
    "Channel: GLO › GLOBAL, page 3, KNOB 1 MIDI CH = OMNI or 1 (or the channel set on this track).",
    "Clock: nothing to set. SHRUB follows MIDI clock, START, STOP, CONTINUE and song position, and its tempo follows too (synced LFOs, delay, arp and the motion sequencer lanes). Press PLAY on the FM-1 to take the lead back.",
    "Program Change n picks preset slot n: 1–100 factory, 101–128 INIT.",
    "Four voices, one shared (paraphonic) filter. Keep chords to four notes.",
    "The CCs are SHRUB's factory map. A map changed in the editor (MIDI Learn) replaces it on the FM-1.",
  ],
  cc: CC,
  ccUnverified: false,
  programChange: { label: "PRESET", note: "Program n loads slot n (1–100 factory, 101–128 INIT)." },
};
