import { test } from "node:test";
import assert from "node:assert/strict";
import { FlClient, CMD, parseInfo, parseDesc, parseDump, parseNames, parseTrack, parseStep, encodeStep, parseDrumStep, encodeDrumStep,
  parseUpList, parseBackupList, parseBackupChunk, args, frame, FMT } from "../src/protocol/fl.js";
import { writeCString, readV14 } from "../src/lib/encoding.js";
import { createVirtualDevice } from "../src/dev/virtual-device.js";
import { detectProfile, getProfile, tracksFor, protoLevel } from "../src/firmware/index.js";

const connect = () => { const dev = createVirtualDevice({ latency: 1 }); return { dev, fl: new FlClient({ output: dev.output, input: dev.input, timeout: 200 }) }; };

test("INFO from the virtual SLOOP is parsed and detected", async () => {
  const { fl } = connect();
  const info = await fl.info();
  assert.match(info.version, /SLOOP/);
  assert.deepEqual(info.engines, ["ANALOG", "DIGITAL", "PHASE"]);
  assert.equal(info.ntrk, 4);
  assert.equal(info.nstep, 64);
  assert.equal(detectProfile({ info }), "sloop");
  assert.equal(protoLevel("sloop", info), 12);
  fl.close();
});

test("INFO from a Skiff-style device reads its wide-id tag", () => {
  const d = frame(CMD.INFO, [...writeCString("FELUCCA SKIFF 2.0.3"), 1, 127, 40, 128, 127, ...writeCString("ANALOG"), 6, 16, 0x55, 1, 3, 0x49, 1, 143 & 127, 143 >> 7, 135 & 127, 135 >> 7]);
  const info = parseInfo(d);
  assert.equal(info.ntrk, 6);
  assert.equal(info.pc, 143);
  assert.equal(info.pe0, 135);
  assert.equal(detectProfile({ info }), "skiff");
  assert.equal(tracksFor(getProfile("skiff"), info).length, 6);
});

test("older firmware without NTRK is a one-instrument device", () => {
  const info = parseInfo(frame(CMD.INFO, [...writeCString("FELUCCA 0.5 BETA"), 1, 53, 20, 16, 45, ...writeCString("ANALOG")]));
  assert.equal(info.ntrk, 1);
  assert.equal(info.pe0, 45);
  assert.equal(detectProfile({ info }), "felucca");
});

test("detection falls back to the port name, then to plain FL", () => {
  assert.equal(detectProfile({ portName: "X0X FM-1" }), "x0x");
  assert.equal(detectProfile({ portName: "Felucca", info: { version: "MYFORK 1.0", tail: [] } }), "fl");
  assert.equal(detectProfile({ portName: "IAC Bus 1" }), null);
});

test("DESC, DUMP and NAMES", async () => {
  const { fl } = connect();
  const info = await fl.info();
  const lvl = parseDesc(await fl.request(CMD.DESC, [0, 0]));
  assert.equal(lvl.label, "LEVEL");
  assert.equal(lvl.max, 127);
  const wave = parseDesc(await fl.request(CMD.DESC, [0, 14]));
  assert.equal(wave.fmt, FMT.ENUM);
  assert.deepEqual(wave.names, ["SAW", "SQR", "TRI", "SIN"]);
  const dump = parseDump(await fl.request(CMD.DUMP), info);
  assert.equal(dump.P.length, info.pc);
  assert.equal(dump.G[0], 120);
  const names = parseNames(await fl.request(CMD.NAMES, [1]));
  assert.equal(names.names[0], "DX RHODES");
  fl.close();
});

test("SET clamps and TRACK_MIX / TRACK_PARAM reach other tracks", async () => {
  const { fl, dev } = connect();
  const set = await fl.request(CMD.SET, args.set(0, 0, 500));
  assert.equal(readV14(set, 7), 127);
  await fl.request(CMD.TRACK_MIX, args.trackMix(2, 33, true));
  const tr = parseTrack(await fl.request(CMD.TRACK));
  assert.equal(tr.tracks[2].level, 33);
  assert.equal(tr.tracks[2].mute, true);
  await fl.request(CMD.TRACK_PARAM, args.trackParam(1, 5, -20));
  assert.equal(dev.state.tracks[1].p[5], -20);
  fl.close();
});

test("steps round-trip, including SLOOP levels and ratchets", async () => {
  const { fl } = connect();
  const step = { notes: [60, 64, 67], time: 0, flags: 1, vel: 110, lvl: 0b110001, rat: 0b10 };
  const r = await fl.request(CMD.TRACK_STEP, [1, 5, ...encodeStep(step, true)]);
  const back = parseStep(r, 7);
  assert.deepEqual(back.notes, [60, 64, 67]);
  assert.equal(back.lvl, step.lvl);
  assert.equal(back.rat, step.rat);
  fl.close();
});

test("DRUM_STEP encodes 16 lanes with levels and ratchets", async () => {
  const lanes = [{ lane: 0, lvl: 3, rat: 0 }, { lane: 15, lvl: 1, rat: 3 }];
  const enc = encodeDrumStep(7, lanes);
  assert.ok(enc.every((b) => b < 128));
  const { fl } = connect();
  const back = parseDrumStep(await fl.request(33, enc));
  assert.equal(back.index, 7);
  assert.deepEqual(back.lanes, lanes);
  fl.close();
});

test("user presets, projects and backups", async () => {
  const { fl } = connect();
  const list = parseUpList(await fl.request(CMD.UP_LIST, [0, 16]));
  assert.equal(list.total, 32);
  assert.equal(list.slots[0].name, "MY BASS");
  assert.equal(list.slots[5].used, false);
  await fl.request(CMD.UP_STORE, [5, ...writeCString("NEW ONE")]);
  assert.equal(parseUpList(await fl.request(CMD.UP_LIST, [0, 16])).slots[5].name, "NEW ONE");
  const pr = await fl.request(CMD.PROJECT, [2, 1]);
  assert.equal(pr[7], 0);
  const bl = parseBackupList(await fl.request(34));
  assert.equal(bl.objects.length, 2);
  const chunk = parseBackupChunk(await fl.request(35, args.backupGet(0, 256, 256)));
  assert.equal(chunk.data.length, 44);
  assert.equal(chunk.data[0], (256 * 37) & 255);
  fl.close();
});

test("unknown commands time out with null; pushes reach listeners", async () => {
  const { fl, dev } = connect();
  assert.equal(await fl.request(99, [], 50), null);
  const seen = [];
  fl.onPush((cmd, d) => seen.push([cmd, d[6]]));
  assert.equal(await fl.watch(true), 3);
  dev.turnKnob(0, 2, 10);
  await new Promise((r) => setTimeout(r, 10));
  assert.deepEqual(seen, [[CMD.CHANGED, 2]]);
  await fl.watch(false);
  fl.close();
});
