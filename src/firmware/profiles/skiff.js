import { STANDARD_CC, MOD_CC, synth, drums } from "../common.js";

// Skiff by illuminus5 — https://github.com/illuminus5/skiff (documented against 2.0.3).
// Six tracks; any track can run the DRUM / DRUM-X engines, so the last one defaults to a drum grid.
export default {
  id: "skiff",
  name: "SKIFF",
  author: "illuminus5",
  documented: "2.0.3",
  links: {
    source: "https://github.com/illuminus5/skiff",
    editor: "https://illuminus5.github.io/skiff/webapp/editor/",
  },
  detect: { info: /skiff/i, port: /skiff/i },
  protocol: "fl",
  tracks: [synth("TRK 1", 1), synth("TRK 2", 2), synth("TRK 3", 3), synth("TRK 4", 4), synth("TRK 5", 5), drums("TRK 6", 6)],
  setup: [
    "Clock: MENU › MIDI › CLOCK = USB.",
    "MENU › MIDI › MIDI IN = CH1-6 (or set T1–T6 CHANNEL; defaults 1–6).",
    "Engine parameters above id 127 can't be reached by this app yet; use Skiff's own editor for those.",
  ],
  cc: [...STANDARD_CC, ...MOD_CC],
  programChange: { label: "PRESET", note: "Program n loads the track's n-th preset." },
};
