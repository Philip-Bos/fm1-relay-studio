import { test } from "node:test";
import assert from "node:assert/strict";
import { S } from "../src/state.js";
import { ensurePattern } from "../src/sequencer/pattern.js";
import { launchScene, sceneAtPulse, BAR } from "../src/sequencer/scenes.js";

test("a scene launched while playing takes over on the next downbeat, on every running device", () => {
  const [a, b] = S.slots;
  for (const s of [a, b]) Object.assign(s, { armed: true, midiId: "x" + s.i, running: true, ovr: "sloop3" });
  const ta = ensurePattern(a).tracks, tb = ensurePattern(b).tracks;
  S.scenes[2] = { name: "DROP", slots: { 0: ta.map((_, j) => j !== 4), 1: tb.map(() => false) } };
  ta.forEach((t) => (t.mute = false)); tb.forEach((t) => (t.mute = true));
  launchScene(2);
  assert.equal(S.sceneQ.k, 2);
  sceneAtPulse(a, BAR + 5); // mid-bar: nothing yet
  assert.equal(ta[0].mute, false);
  sceneAtPulse(a, BAR * 2);
  assert.deepEqual(ta.map((t) => t.mute), [true, true, true, true, false]);
  assert.equal(S.sceneQ.k, 2, "waits for the other device's downbeat");
  sceneAtPulse(b, BAR * 2);
  assert.ok(tb.every((t) => !t.mute));
  assert.equal(S.sceneQ, null);
  assert.equal(S.scene, 2);
  for (const s of [a, b]) Object.assign(s, { armed: false, midiId: "", running: false, ovr: "auto", pat: null });
});
