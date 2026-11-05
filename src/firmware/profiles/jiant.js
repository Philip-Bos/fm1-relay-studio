import { STANDARD_CC, synth } from "../common.js";

// JIANT FM by juanjiant-bit — https://github.com/juanjiant-bit/JIANT (built on Felucca).
export default {
  id: "jiant",
  name: "JIANT",
  author: "juanjiant-bit",
  documented: "par12 / add15-beta",
  links: {
    source: "https://github.com/juanjiant-bit/JIANT",
    editor: "https://juanjiant-bit.github.io/JIANT/webapp/editor/",
  },
  detect: { info: /jiant/i, port: /jiant/i },
  protocol: "fl",
  tracks: [1, 2, 3, 4, 5, 6].map((n) => synth("T" + n, n)),
  setup: [
    "Clock: GLO › GLOBAL › CLOCK = USB.",
    "MIDI IN ROUT = CH1-6: channels 1–6 play tracks T1–T6.",
    "MENU › USB › AUDIO STEMS sends each track to the computer on its own audio channel.",
  ],
  cc: STANDARD_CC,
  ccUnverified: true,
  programChange: null,
};
