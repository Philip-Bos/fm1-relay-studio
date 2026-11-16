import { synth, drums } from "../common.js";

// SLOOP 3 by isod89 — https://github.com/isod89/sloop3-fm1 (documented against 3.3.7, editor protocol 2).
// A rewrite of SLOOP from scratch, not an update of 2.8: it has its own SysEx editor protocol (F0 7D 53 33 …,
// app/edproto.h) instead of the FL protocol, so it doesn't answer FL INFO and the studio's FL features (sound editor,
// SysEx mixer, pattern sync, library) don't reach it. Everything over plain MIDI does. Facts from app/midi.c,
// fw/main.c (midi_in, midi_program, remote_cc, midi_fx, PK_NAME) and docs/GUIDE.md.

const WHITE = [0, 2, 4, 5, 7, 9, 11];
// fw/main.c PK_NAME: the white keys' 16, then the black keys' 11 (the same effects and order as SLOOP 2.8)
const FX = [
  "LOOP 1/4", "LOOP 1/8", "LOOP 1/16", "LOOP 1/32", "STUTTER", "REVERSE", "TAPE STOP", "HALF SPEED",
  "LP SWEEP", "HP SWEEP", "PHONE", "BIT CRUSH", "ALIAS", "GATE 1/16", "ECHO", "WOBBLE",
];
const FX_BLACK = ["KILL LOW", "KILL MID", "KILL HIGH", "REWIND", "OCT UP", "FLANGER", "AUTO-PAN", "FREEZE", "LOOP 8T", "MONO", "FADE OUT"];
const fxPads = () => {
  let w = 0, b = 0;
  return Array.from({ length: 27 }, (_, k) => {
    const note = 53 + k, white = WHITE.includes(note % 12);
    return { note, white, label: white ? FX[w++] : FX_BLACK[b++] };
  });
};

// app/midi.c GM_OUT with DRUM MAP = GM: the 16 drum sounds in pad order (the low tom is 41 here, not 2.8's 43)
const LANES = [
  ["KICK", 36], ["KICK 2", 35], ["SNARE", 38], ["CLAP", 39], ["HAT", 42], ["OPEN HAT", 46], ["PEDAL", 44], ["RIM", 37],
  ["SNARE 2", 40], ["LOW TOM", 41], ["HI TOM", 48], ["CRASH", 49], ["RIDE", 51], ["SHAKER", 70], ["CONGA", 63], ["COWBELL", 56],
];

export default {
  id: "sloop3",
  name: "SLOOP 3",
  author: "isod89",
  documented: "3.3.7",
  links: {
    source: "https://github.com/isod89/sloop3-fm1",
    manual: "https://github.com/isod89/sloop3-fm1/blob/main/docs/GUIDE.md",
    editor: "https://isod89.github.io/sloop3-fm1/editor.html",
  },
  // USB port "FM-1 SLOOP 3"; its own INFO (F0 7D 53 33 01) answers with the version, e.g. "3.3.7"
  detect: { port: /sloop\s*3/i, info: /^sloop\s*3/i },
  protocol: null,
  tracks: [synth("SYN 1", 1), synth("SYN 2", 2), synth("SYN 3", 3), synth("SYN 4", 4), drums("DRUMS", 10, LANES)],
  setup: [
    "Clock: GLO (tap until MIDI 4/6) › SYNC = EXT. The default is INT, which ignores the clock. With EXT, SLOOP 3 follows clock, START, CONTINUE and STOP, and returns to its own tempo 0.5 s after the clock stops.",
    "Notes: GLO › MIDI 4/6 › IN = TRACKS (the default): SYN 1–4 on channels 1–4, the drums on 10. SEL sends every channel to the selected track.",
    "Drums: GLO › 5/6 › DRUM = GM (the default) for these lanes; PADS plays the 16 sounds on notes 36–51.",
    "Leave GLO › MIDI 4/6 › CLK off: SLOOP 3 sends its own clock only while SYNC is INT.",
    "Program Change: the n-th factory sound (CC 0 = 1 for sounds 129 and up, CC 0 = 8 for your 32 sounds); on channel 10 it picks kit n.",
    "SLOOP 3 has its own editor protocol, not FL: the sound editor, SysEx mixer, pattern sync and library don't reach it yet. Use its web editor for those.",
  ],
  // app/midi.c midi_cc: SLOOP 2.8's numbers. 11 (expression) is gone; 76 (LFO rate) is new.
  cc: [
    { cc: 7, label: "LEVEL", def: 100, group: "mix" },
    { cc: 10, label: "PAN", def: 64, bipolar: true, group: "mix" },
    { cc: 74, label: "CUTOFF", def: 64, group: "tone", hint: "the engine's cutoff; on engines without one, the track filter (64 = off, below low-pass, above high-pass)" },
    { cc: 71, label: "RESONANCE", def: 0, group: "tone" },
    { cc: 5, label: "GLIDE", def: 0, group: "tone" },
    { cc: 73, label: "ATTACK", def: 0, group: "envelope" },
    { cc: 75, label: "DECAY", def: 64, group: "envelope" },
    { cc: 72, label: "RELEASE", def: 64, group: "envelope" },
    { cc: 76, label: "LFO RATE", def: 64, group: "tone" },
    { cc: 91, label: "REVERB", def: 0, group: "sends" },
    { cc: 93, label: "CHORUS", def: 0, group: "sends" },
    { cc: 94, label: "DELAY", def: 0, group: "sends" },
    { cc: 1, label: "MOD WHEEL", def: 0, group: "performance", hint: "the LFO to the pitch" },
  ],
  programChange: { label: "PRESET", drums: "KIT", bankSelect: true, note: "Program n loads the n-th factory sound (bank 8: your 32 sounds); on the drum channel it loads kit n." },
  remote: {
    setting: "GLO › 5/6 › REMOTE",
    firstCc: 102,
    buttons: ["FX", "SEL", "ENV", "LFO", "EDIT", "GLO", "HOME", "SAVE", "ARP", "SEQ", "PLAY", "REC", "OCT−", "OCT+"],
  },
  fx: { setting: "GLO › 5/6 › FX CH", pads: fxPads() },
  // engine/drumkits.c gb_dkit_names: 37 factory kits, your 4 sampled kits (and 3+4 together), 4 SYN kits
  kits: ["ACOUSTIC", "DEEP", "TIGHT", "BRIGHT", "DUST", "808", "909", "606", "80S", "VINTAGE", "TRAP", "DRILL", "BOOMBAP", "LO-FI", "PHONK", "HOUSE", "D.HOUSE", "TECHNO", "MINIMAL", "ELECTRO", "DISCO", "GARAGE", "JUNGLE", "DUBSTEP", "DEMBOW", "AMAPIANO", "AFRO", "LATIN", "TRIBAL", "SYNTHWV", "CHIP", "ARCADE", "GLITCH", "INDUSTR", "HYPER", "AMBIENT", "JAZZ", "USR1", "USR2", "USR3", "USR4", "USR3+4", "SYN1", "SYN2", "SYN3", "SYN4"],
};
