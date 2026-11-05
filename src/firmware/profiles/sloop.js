import { STANDARD_CC, MOD_CC, synth, drums } from "../common.js";

// SLOOP by isod89 — https://github.com/isod89/sloop-fm1 (documented against 2.8.4, protocol v12).
const WHITE = [0, 2, 4, 5, 7, 9, 11];
const FX = [
  "LOOP 1/4", "LOOP 1/8", "LOOP 1/16", "LOOP 1/32", "STUTTER", "REVERSE", "TAPE STOP", "HALF SPEED",
  "LP SWEEP", "HP SWEEP", "PHONE", "BIT CRUSH", "ALIAS", "GATE 1/16", "ECHO", "WOBBLE",
];
const FX_BLACK = ["KILL LOW", "KILL MID", "KILL HIGH", "REWIND", "OCT UP", "FLANGER", "AUTO-PAN", "FREEZE", "LOOP 8T", "MONO", "FADE OUT"];

/** The 27 keys F3..G5 (notes 53..79) with the effect each one holds on the FX channel (seq.c midi_fx). */
const fxPads = () => {
  let w = 0, b = 0;
  return Array.from({ length: 27 }, (_, k) => {
    const note = 53 + k, white = WHITE.includes(note % 12);
    return { note, white, label: white ? FX[w++] : FX_BLACK[b++] };
  });
};

export default {
  id: "sloop",
  name: "SLOOP",
  author: "isod89",
  documented: "2.8.4",
  links: {
    source: "https://github.com/isod89/sloop-fm1",
    manual: "https://github.com/isod89/sloop-fm1/blob/main/SLOOP.md",
    editor: "https://isod89.github.io/sloop-fm1/webapp/editor/",
  },
  detect: { info: /sloop(?!dx)/i },
  protocol: "fl",
  tracks: [synth("SYN 1", 1), synth("SYN 2", 2), synth("SYN 3", 3), drums("DRUMS", 10)],
  setup: [
    "Clock: GLO › SYSTEM › SYNC = USB (SLOOP follows clock, START, CONTINUE and STOP).",
    "Only clock from the computer: GLO › MIDI 2 › IN = CLOCK.",
    "Play this app's notes: leave GLO › MIDI 2 › IN on ALL. Send SLOOP's own sequence back: OUT = SEQ.",
    "Recording: HOME › AUDIO › USB AUDIO = FULL for a fixed capture level.",
  ],
  cc: [...STANDARD_CC, ...MOD_CC],
  programChange: { label: "PRESET", drums: "KIT", bankSelect: true, note: "Program n loads the n-th sound of the PRESETS list; on the drum channel it loads kit n." },
  remote: {
    setting: "GLO › MIDI 3 › REMOTE",
    firstCc: 102,
    buttons: ["FX", "SEL", "ENV", "LFO", "EDIT", "GLO", "HOME", "SAVE", "ARP", "SEQ", "PLAY", "REC", "OCT−", "OCT+"],
  },
  fx: { setting: "GLO › MIDI 3 › FX CH", pads: fxPads() },
  extensions: { drumStep: 5, backup: 6 },
  kits: ["ACOUSTIC", "DEEP", "TIGHT", "BRIGHT", "DUST", "808", "909", "606", "80S", "VINTAGE", "TRAP", "DRILL", "BOOMBAP", "LO-FI", "PHONK", "HOUSE", "D.HOUSE", "TECHNO", "MINIMAL", "ELECTRO", "DISCO", "GARAGE", "JUNGLE", "DUBSTEP", "DEMBOW", "AMAPIANO", "AFRO", "LATIN", "TRIBAL", "SYNTHWV", "CHIP", "ARCADE", "GLITCH", "INDUSTR", "HYPER", "AMBIENT", "JAZZ"],
};
