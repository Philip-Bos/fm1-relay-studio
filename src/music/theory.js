// Keys, scales and chords for the keyboard, the pencil and the piano roll.

import { S } from "../state.js";

export const NN = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
export const SCALES = {
  CHROMATIC: null, MAJOR: [0, 2, 4, 5, 7, 9, 11], MINOR: [0, 2, 3, 5, 7, 8, 10], DORIAN: [0, 2, 3, 5, 7, 9, 10],
  PHRYGIAN: [0, 1, 3, 5, 7, 8, 10], LYDIAN: [0, 2, 4, 6, 7, 9, 11], MIXOLYDIAN: [0, 2, 4, 5, 7, 9, 10], LOCRIAN: [0, 1, 3, 5, 6, 8, 10],
  "HARM MINOR": [0, 2, 3, 5, 7, 8, 11], "MEL MINOR": [0, 2, 3, 5, 7, 9, 11], "PENT MAJ": [0, 2, 4, 7, 9], "PENT MIN": [0, 3, 5, 7, 10],
  BLUES: [0, 3, 5, 6, 7, 10], "WHOLE TONE": [0, 2, 4, 6, 8, 10],
};
const DEG = { TRIAD: [0, 2, 4], "7TH": [0, 2, 4, 6], "9TH": [0, 2, 4, 6, 8], SUS2: [0, 1, 4], SUS4: [0, 3, 4], POWER: [0, 4, "O"] };
const CHROM = { TRIAD: [0, 4, 7], "7TH": [0, 4, 7, 10], "9TH": [0, 4, 7, 10, 14], SUS2: [0, 2, 7], SUS4: [0, 5, 7], POWER: [0, 7, 12] };
const FIXED = { MAJ: [0, 4, 7], MIN: [0, 3, 7], MIN7: [0, 3, 7, 10], MAJ7: [0, 4, 7, 11], DIM: [0, 3, 6] };
export const CH_LIST = ["OFF", "TRIAD", "7TH", "9TH", "SUS2", "SUS4", "POWER", "MAJ", "MIN", "MIN7", "MAJ7", "DIM"];

export const pcOf = (n) => (((n - S.key) % 12) + 12) % 12;
export const inScale = (n) => !SCALES[S.scale] || SCALES[S.scale].includes(pcOf(n));
export const noteName = (n) => NN[n % 12] + (Math.floor(n / 12) - 1);
export const isBlack = (n) => NN[n % 12].length > 1;

export function snapNote(n) {
  for (let d = 0; d < 7; d++) { if (inScale(n - d)) return n - d; if (inScale(n + d)) return n + d; }
  return n;
}

/** With a scale chosen, TRIAD/7TH/9TH/SUS/POWER stack scale degrees (diatonic); MAJ/MIN/… are fixed shapes. */
export function chordNotes(n) {
  const c = S.chord, sc = SCALES[S.scale];
  if (c === "OFF") return [n];
  if (FIXED[c]) return FIXED[c].map((i) => n + i).filter((x) => x <= 127);
  if (!sc) return CHROM[c].map((i) => n + i).filter((x) => x <= 127).slice(0, 4);
  const list = [];
  for (let m = 0; m < 128; m++) if (inScale(m)) list.push(m);
  let i = list.findIndex((x) => x >= n);
  if (i < 0) return [n];
  if (list[i] > n && i > 0) i--;
  return DEG[c].map((d) => list[i + (d === "O" ? sc.length : d)]).filter((x) => x !== undefined).slice(0, 4);
}
