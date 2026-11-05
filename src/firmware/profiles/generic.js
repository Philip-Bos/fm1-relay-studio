import { synth, drums } from "../common.js";

// Fallbacks: a device that answers the FL protocol but isn't a firmware listed here, and plain MIDI.

export const flGeneric = {
  id: "fl",
  name: "FL-COMPATIBLE",
  author: "Felucca fork",
  links: {},
  detect: {},
  protocol: "fl",
  // Built from INFO: NTRK tracks on channels 1..NTRK, the last one a drum grid when there are 4.
  tracks: (info) => {
    const n = info?.ntrk || 4;
    return Array.from({ length: n }, (_, i) => (n === 4 && i === 3 ? drums("DRUMS", 4) : synth("TRK " + (i + 1), i + 1)));
  },
  setup: ["Answers the Felucca editor protocol. Track channels are assumed to be 1..N; change them per track if needed."],
  cc: [],
  programChange: { label: "PROGRAM" },
};

export const official = {
  id: "official",
  name: "M-VAVE",
  author: "M-VAVE",
  documented: "V15 / V16",
  links: { home: "https://www.m-vave.com/product?id=fm-1", source: "https://github.com/m-vave/fm1_open" },
  detect: {},
  protocol: null,
  tracks: [synth("FM", 1)],
  setup: [
    "Official FM synth firmware: one part on channel 1.",
    "M-VAVE publishes its CC chart as a separate PDF (V15); use the CUSTOM CC control or the device's own editor.",
  ],
  cc: [],
  programChange: { label: "PROGRAM" },
};

export const generic = {
  id: "generic",
  name: "GENERIC",
  links: {},
  detect: {},
  protocol: null,
  tracks: [synth("LEAD", 1), drums("DRUMS", 10)],
  setup: ["Firmware not identified: a lead on channel 1 and GM drums on channel 10. Pick the firmware on the device card if you know it."],
  cc: [],
  programChange: { label: "PROGRAM" },
};
