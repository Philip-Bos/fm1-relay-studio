import { test } from "node:test";
import assert from "node:assert/strict";
import { stepsToNotes, notesToSteps, drumStepsToNotes, notesToDrumSteps, ticksPerStep, velToLevel } from "../src/sequencer/steps.js";
import { GM_LANES } from "../src/firmware/common.js";
import { writeSmf } from "../src/lib/smf.js";

test("ticks per step from DIV names", () => {
  assert.equal(ticksPerStep("1/16"), 24);
  assert.equal(ticksPerStep("1/8"), 48);
  assert.equal(ticksPerStep("1/16T"), 16);
  assert.equal(ticksPerStep("?"), 24);
});

test("synth notes ↔ steps keep chords, ties and accents", () => {
  const notes = [
    { t: 0, d: 72, p: 60, v: 100 }, { t: 0, d: 72, p: 64, v: 100 },
    { t: 96, d: 24, p: 67, v: 127 },
  ];
  const steps = notesToSteps(notes, 16);
  assert.deepEqual(steps[0].notes, [60, 64]);
  assert.equal(steps[1].time, 1);
  assert.equal(steps[2].time, 1);
  assert.equal(steps[3].time, 2);
  assert.equal(steps[4].flags & 1, 1);
  const back = stepsToNotes(steps);
  assert.deepEqual(back.map((n) => [n.t, n.d, n.p]), [[0, 72, 60], [0, 72, 64], [96, 24, 67]]);
});

test("more than four notes in a step are dropped, not wrapped", () => {
  const steps = notesToSteps([60, 62, 64, 65, 67].map((p) => ({ t: 0, d: 24, p, v: 100 })), 4);
  assert.equal(steps[0].notes.length, 4);
});

test("drum steps ↔ notes keep levels and turn repeats into ratchets", () => {
  const steps = [{ lanes: [{ lane: 0, lvl: 3, rat: 0 }] }, { lanes: [] }, { lanes: [{ lane: 4, lvl: 1, rat: 1 }] }];
  const notes = drumStepsToNotes(steps, GM_LANES);
  assert.equal(notes.length, 3);
  assert.equal(notes[0].v, 127);
  const back = notesToDrumSteps(notes, GM_LANES, 3);
  assert.deepEqual(back[0].lanes, [{ lane: 0, lvl: 3, rat: 0 }]);
  assert.deepEqual(back[2].lanes, [{ lane: 4, lvl: 1, rat: 1 }]);
  assert.equal(velToLevel(100), 0);
});

test("SMF export has a header, a conductor and one chunk per track", () => {
  const bytes = writeSmf({ bpm: 90, tracks: [{ name: "BASS", ch: 1, len: 4, notes: [{ t: 0, d: 48, p: 36, v: 100 }] }], beats: 8 });
  const s = String.fromCharCode(...bytes.slice(0, 4));
  assert.equal(s, "MThd");
  assert.equal(bytes[11], 2); // two chunks: conductor + BASS
  const noteOns = [...bytes].filter((b, i) => b === 0x90 && bytes[i + 1] === 36).length;
  assert.equal(noteOns, 2); // the 4-beat loop repeated to fill 8 beats
});
