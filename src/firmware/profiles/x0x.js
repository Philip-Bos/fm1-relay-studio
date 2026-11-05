import { synth, drums } from "../common.js";

// X0X by Charles Vestal — https://github.com/charlesvestal/fm1-x0x (manual: charlesvestal.github.io/fm1-x0x/manual/).
const X909 = [["KICK", 36], ["SNARE", 38], ["RIM", 37], ["CLAP", 39], ["CL HAT", 42], ["OP HAT", 46], ["LOW TOM", 41], ["MID TOM", 45], ["HI TOM", 50], ["CRASH", 49], ["RIDE", 51]];
const X808 = [...X909, ["COWBELL", 56]];
const SLICES = Array.from({ length: 8 }, (_, i) => ["SLICE " + (i + 1), 36 + i]);

export default {
  id: "x0x",
  name: "X0X",
  author: "Charles Vestal",
  documented: "0.10.3",
  links: {
    source: "https://github.com/charlesvestal/fm1-x0x",
    manual: "https://charlesvestal.github.io/fm1-x0x/manual/",
    emulator: "https://charlesvestal.github.io/fm1-x0x/emu/",
  },
  detect: { port: /x0x/i, info: /x0x/i },
  protocol: null,
  tracks: [drums("909", 10, X909), drums("808", 11, X808), synth("303A", 2), synth("303B", 3), drums("BREAK", 4, SLICES)],
  setup: [
    "X0X follows incoming MIDI clock by itself and returns to its own tempo half a second after it stops.",
    "Part channels are in GLO › MIDI (defaults: 909 = 10, 808 = 11, 303A = 2, 303B = 3, BREAK = 4).",
    "303 parts: overlapping notes slide, velocity 100 or more is an accent.",
  ],
  cc: [],
  programChange: null,
};
