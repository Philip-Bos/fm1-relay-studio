import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, statSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join } from "node:path";
import { PROFILES, tracksFor } from "../src/firmware/index.js";

test("every firmware profile is well formed", () => {
  const ids = new Set();
  for (const p of PROFILES) {
    assert.ok(p.id && !ids.has(p.id), `unique id: ${p.id}`);
    ids.add(p.id);
    assert.ok(p.name, `${p.id}: name`);
    assert.ok(Array.isArray(p.setup) && p.setup.length, `${p.id}: setup hints`);
    assert.ok([null, "fl"].includes(p.protocol), `${p.id}: protocol`);
    const tracks = tracksFor(p, { ntrk: 4 });
    assert.ok(tracks.length > 0, `${p.id}: tracks`);
    for (const t of tracks) {
      assert.ok(t.ch >= 1 && t.ch <= 16, `${p.id}/${t.name}: channel`);
      if (t.lanes) for (const [name, note] of t.lanes) assert.ok(name && note >= 0 && note <= 127, `${p.id}/${t.name}: lane ${name}`);
    }
    const ccs = p.cc.map((c) => c.cc);
    assert.equal(new Set(ccs).size, ccs.length, `${p.id}: duplicate CC`);
    for (const c of p.cc) assert.ok(c.cc >= 0 && c.cc <= 127 && c.label && c.def >= 0 && c.def <= 127, `${p.id}: CC ${c.cc}`);
    for (const url of Object.values(p.links || {})) assert.match(url, /^https:\/\//, `${p.id}: link`);
  }
});

test("SLOOP remote and FX maps match the firmware", () => {
  const sloop = PROFILES.find((p) => p.id === "sloop");
  assert.equal(sloop.remote.buttons.length, 14);
  assert.equal(sloop.fx.pads.length, 27);
  assert.equal(sloop.fx.pads[0].note, 53);
  assert.equal(sloop.fx.pads.at(-1).note, 79);
  assert.equal(sloop.fx.pads.filter((p) => p.white).length, 16);
});

test("every source module parses", () => {
  const files = [];
  const walk = (d) => readdirSync(d).forEach((f) => { const p = join(d, f); statSync(p).isDirectory() ? walk(p) : p.endsWith(".js") && files.push(p); });
  walk(new URL("../src", import.meta.url).pathname);
  for (const f of files) execFileSync(process.execPath, ["--check", f]);
  assert.ok(files.length > 15);
});
