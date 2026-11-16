import { STANDARD_CC, MOD_CC, synth, drums } from "../common.js";

// The studio's own built-in synth (TRY BUILT-IN SYNTH): no hardware, it plays in the browser. It answers the same editor
// protocol as SLOOP, so every page works with it, and its audio can be recorded like an FM-1's.
export default {
  id: "builtin",
  name: "BUILT-IN SYNTH",
  author: "FM-1 Relay Studio",
  documented: "1.0",
  links: {},
  detect: { info: /BUILT-IN SYNTH/i },
  protocol: "fl",
  tracks: [synth("SYN 1", 1), synth("SYN 2", 2), synth("SYN 3", 3), drums("DRUMS", 10)],
  setup: [
    "The studio's own synth, playing in this browser: nothing to connect or set. Add up to eight to try syncing several devices.",
    "Three synth tracks and a drum kit. Choose sounds on the SOUND page or by Program Change; the CONTROLS page's CCs work too.",
    "Its audio is an input like an FM-1's USB audio, so RECORD keeps it as its own stem.",
  ],
  cc: [...STANDARD_CC.filter((c) => [7, 10, 74, 71, 73, 75, 72, 91, 94].includes(c.cc)), ...MOD_CC],
  programChange: { label: "SOUND", note: "Program n picks the n-th of the built-in synth's 12 sounds (808 BOOM … SOFT KEYS)." },
  extensions: { drumStep: 5, backup: 6 },
};
