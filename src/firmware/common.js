// Building blocks shared by firmware profiles.

/**
 * Felucca's standard CC map (Felucca 1.1.5, discussion #103), kept by SLOOP, Skiff and other forks.
 * A CC sets the parameter of the track its channel plays, as a knob would (0..127 over the range).
 */
export const STANDARD_CC = [
  { cc: 7, label: "LEVEL", def: 100, group: "mix" },
  { cc: 10, label: "PAN", def: 64, bipolar: true, group: "mix" },
  { cc: 74, label: "FILTER", def: 64, bipolar: true, group: "tone", hint: "64 = off, below = low-pass, above = high-pass / engine cutoff" },
  { cc: 71, label: "RESONANCE", def: 0, group: "tone" },
  { cc: 73, label: "ATTACK", def: 0, group: "envelope" },
  { cc: 75, label: "DECAY", def: 64, group: "envelope" },
  { cc: 72, label: "RELEASE", def: 64, group: "envelope" },
  { cc: 5, label: "GLIDE", def: 0, group: "tone" },
  { cc: 91, label: "REVERB", def: 0, group: "sends" },
  { cc: 93, label: "CHORUS", def: 0, group: "sends" },
  { cc: 94, label: "DELAY", def: 0, group: "sends" },
];
export const MOD_CC = [
  { cc: 1, label: "MOD WHEEL", def: 0, group: "performance" },
  { cc: 11, label: "EXPRESSION", def: 127, group: "performance" },
];

/** SLOOP's 16 drum lanes, one per white key from F3, as GM notes (drums.c LANE_NOTE). */
export const GM_LANES = [
  ["KICK", 36], ["KICK 2", 35], ["SNARE", 38], ["CLAP", 39], ["HAT", 42], ["OPEN HAT", 46], ["PEDAL", 44], ["RIM", 37],
  ["SNARE 2", 40], ["LOW TOM", 43], ["HI TOM", 48], ["CRASH", 49], ["RIDE", 51], ["SHAKER", 70], ["CONGA", 63], ["COWBELL", 56],
];

export const synth = (name, ch) => ({ name, ch });
export const drums = (name, ch, lanes = GM_LANES) => ({ name, ch, lanes });
