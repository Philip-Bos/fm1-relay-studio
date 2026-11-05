import { STANDARD_CC, MOD_CC, synth, drums } from "../common.js";

// Felucca by Leo Kuroshita / Hügelton Instruments — https://github.com/hugelton/Felucca (documented against 1.7.0).
export default {
  id: "felucca",
  name: "FELUCCA",
  author: "Leo Kuroshita (Hügelton Instruments)",
  documented: "1.7.0",
  links: {
    source: "https://github.com/hugelton/Felucca",
    editor: "https://hugelton.github.io/Felucca/",
  },
  detect: { info: /felucca/i },
  protocol: "fl",
  tracks: [synth("TRK 1", 1), synth("TRK 2", 2), synth("TRK 3", 3), drums("DRUMS", 4)],
  setup: [
    "Clock: MENU › CLOCK › CLK = USB.",
    "MIDI IN routing: MENU › MIDI › MIDI IN = CH1-4 (channels 1–4 play tracks 1–4; TRACK lets you set each one).",
    "Firmware before 1.0 ignores CCs and Program Change; update if a control does nothing.",
  ],
  cc: [...STANDARD_CC, ...MOD_CC],
  programChange: { label: "PRESET", note: "Program n loads preset n on the track the channel plays." },
};
