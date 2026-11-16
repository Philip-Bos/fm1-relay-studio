// The built-in synth's sound: a small Web Audio synth that plays what the studio sends a virtual FM-1, so the whole
// studio can be heard without hardware. Channels 1–3 play the synth tracks (their sound follows the track's preset on
// the virtual device), channel 10 plays a synthesised drum kit. Notes play at their MIDI timestamps, so timing is as
// tight as the clock. Each device has its own reverb and tempo-synced delay, and its own output stream, so it can be
// recorded as a stem like a real FM-1's USB audio.

let ctx = null, master = null, noise = null, irBuf = null, mainOut = null;

/** The master output after the limiter (what the built-in synths sound like together), e.g. to record it. */
export const synthOutput = () => mainOut;

/** The shared AudioContext and master bus (made on first use, which must follow a click). */
export function audioCtx() {
  if (ctx) return ctx;
  const AC = globalThis.AudioContext || globalThis.webkitAudioContext;
  if (!AC) return null;
  ctx = new AC({ latencyHint: "interactive" });
  const glue = ctx.createDynamicsCompressor();
  glue.threshold.value = -16; glue.knee.value = 10; glue.ratio.value = 2.5; glue.attack.value = 0.01; glue.release.value = 0.18;
  const lim = ctx.createDynamicsCompressor();
  lim.threshold.value = -2; lim.knee.value = 0; lim.ratio.value = 20; lim.attack.value = 0.002; lim.release.value = 0.08;
  master = ctx.createGain(); master.gain.value = 0.42;
  master.connect(glue).connect(lim).connect(ctx.destination);
  mainOut = lim;
  // white noise for drums
  noise = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
  const nd = noise.getChannelData(0);
  for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
  // a stereo hall: decaying noise, darker as it fades
  const len = Math.floor(ctx.sampleRate * 2.8);
  irBuf = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let c = 0; c < 2; c++) {
    const d = irBuf.getChannelData(c);
    let lp = 0;
    for (let i = 0; i < len; i++) {
      const t = i / ctx.sampleRate, k = Math.min(0.92, 0.25 + t * 0.35);
      lp = lp * k + (Math.random() * 2 - 1) * (1 - k);
      d[i] = (t < 0.012 ? 0 : lp * 2.2) * Math.pow(1 - i / len, 2.2) * Math.exp(-t * 1.4);
    }
  }
  return ctx;
}

// ---------- the instruments, by the virtual device's preset names ----------
const AN = (o) => ({ kind: "an", ...o });
const FM = (o) => ({ kind: "fm", ...o });
const INST = {
  "808 BOOM": { kind: "boom", a: 0.002, d: 1.2, s: 0.6, r: 0.12, gain: 0.9, rev: 0 },
  "SUB BASS": AN({ osc: [["sawtooth", 0, 0, 0.5], ["sine", 0, -12, 0.7]], cut: 420, env: 1500, fdec: 0.18, q: 3, a: 0.003, d: 0.3, s: 0.65, r: 0.07, gain: 0.55, rev: 0 }),
  "CZ BASS": AN({ osc: [["square", 0, 0, 0.35], ["sawtooth", 7, 0, 0.3], ["sine", 0, -12, 0.5]], cut: 600, env: 2200, fdec: 0.12, q: 6, a: 0.002, d: 0.22, s: 0.5, r: 0.06, gain: 0.5, rev: 0.02 }),
  "FM BASS": FM({ ratio: 1, index: 2.6, idec: 0.25, a: 0.002, d: 0.5, s: 0.55, r: 0.08, gain: 0.6, rev: 0 }),
  "DX RHODES": FM({ ratio: 1, index: 1.6, idec: 0.9, tine: 14, tindex: 0.5, tdec: 0.06, a: 0.002, d: 2.4, s: 0, r: 0.35, gain: 0.42, rev: 0.22, trem: 4.5 }),
  "SOFT KEYS": AN({ osc: [["triangle", 0, 0, 0.6], ["sine", 3, 12, 0.18]], cut: 2600, env: 900, fdec: 0.4, q: 0.7, a: 0.004, d: 1.6, s: 0.25, r: 0.4, gain: 0.45, rev: 0.25 }),
  "MARIMBA": FM({ ratio: 4, index: 1.2, idec: 0.05, a: 0.001, d: 0.45, s: 0, r: 0.2, gain: 0.55, rev: 0.18 }),
  "RESO PLUCK": AN({ osc: [["sawtooth", -7, 0, 0.32], ["triangle", 7, 0, 0.45]], cut: 480, env: 2700, fdec: 0.13, q: 3, a: 0.002, d: 0.42, s: 0, r: 0.25, gain: 0.42, rev: 0.2, dly: 0.16 }),
  "WARM PAD": AN({ osc: [["sawtooth", -11, 0, 0.3], ["sawtooth", 0, 0, 0.3], ["sawtooth", 11, 0, 0.3], ["triangle", 0, -12, 0.25]], cut: 1100, env: 500, fdec: 1.2, q: 0.8, a: 0.55, d: 1.0, s: 0.85, r: 1.4, gain: 0.26, rev: 0.4, lfo: 0.18 }),
  "GLASS PAD": FM({ ratio: 2, index: 0.9, idec: 3, tine: 3.01, tindex: 0.4, tdec: 2, a: 0.45, d: 1.5, s: 0.7, r: 1.6, gain: 0.3, rev: 0.45, trem: 0 }),
  "CZ STRING": AN({ osc: [["sawtooth", -6, 0, 0.32], ["sawtooth", 6, 0, 0.32], ["sawtooth", 0, 12, 0.12]], cut: 1800, env: 700, fdec: 0.8, q: 0.6, a: 0.35, d: 0.8, s: 0.8, r: 0.9, gain: 0.28, rev: 0.35, lfo: 0.3 }),
  "SYN BRASS": AN({ osc: [["sawtooth", -5, 0, 0.4], ["sawtooth", 5, 0, 0.4], ["square", 0, -12, 0.15]], cut: 700, env: 3200, fdec: 0.35, q: 2, a: 0.02, d: 0.5, s: 0.7, r: 0.25, gain: 0.32, rev: 0.2, dly: 0.18, vib: 0.25 }),
};
const FALLBACK = "SOFT KEYS";

const mtof = (n) => 440 * Math.pow(2, (n - 69) / 12);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

/**
 * A synth bound to one virtual device. `dev` gives it the device's state (track presets and parameters), which the
 * studio's Sound page edits over SysEx; MIDI CCs from the Controls page change the same values.
 */
export function createDemoSound(dev, { presetName }) {
  const c = audioCtx();
  if (!c) return null;
  const out = c.createGain(); out.gain.value = 1;
  const stream = c.createMediaStreamDestination ? c.createMediaStreamDestination() : null;
  out.connect(master); if (stream) out.connect(stream);
  // reverb and delay, per device so its stem is complete
  const rev = c.createConvolver(); rev.buffer = irBuf;
  const revIn = c.createGain(); revIn.gain.value = 1;
  const revOut = c.createGain(); revOut.gain.value = 0.9;
  revIn.connect(rev).connect(revOut).connect(out);
  const dlyIn = c.createGain(), dL = c.createDelay(2), dR = c.createDelay(2), fb = c.createGain(), dlp = c.createBiquadFilter(), mL = c.createStereoPanner(), mR = c.createStereoPanner();
  dlp.type = "lowpass"; dlp.frequency.value = 3200; fb.gain.value = 0.38; mL.pan.value = -0.6; mR.pan.value = 0.6;
  dL.delayTime.value = dR.delayTime.value = 0.375;
  dlyIn.connect(dL); dL.connect(mL).connect(out); dL.connect(dlp).connect(dR); dR.connect(mR).connect(out); dR.connect(fb).connect(dL);
  const dlyOut = c.createGain(); dlyOut.gain.value = 0.5; mL.disconnect(); mR.disconnect(); mL.connect(dlyOut); mR.connect(dlyOut); dlyOut.connect(out); dlyOut.connect(revIn);

  // channel strips: voices → DJ filter (CC74) → pan → level → dry / sends
  const strips = new Map();
  const cc = Array.from({ length: 16 }, () => ({ 74: 64, 1: 0, 11: 127 }));
  function strip(ch) {
    if (strips.has(ch)) return strips.get(ch);
    const inp = c.createGain(), lp = c.createBiquadFilter(), hp = c.createBiquadFilter(), pan = c.createStereoPanner(), lvl = c.createGain(), sr = c.createGain(), sd = c.createGain();
    lp.type = "lowpass"; hp.type = "highpass"; lp.frequency.value = 20000; hp.frequency.value = 10; lp.Q.value = hp.Q.value = 0.9;
    inp.connect(lp).connect(hp).connect(pan).connect(lvl);
    lvl.connect(out); lvl.connect(sr).connect(revIn); lvl.connect(sd).connect(dlyIn);
    sr.gain.value = 0; sd.gain.value = 0;
    const st = { inp, lp, hp, pan, lvl, sr, sd, voices: [] };
    strips.set(ch, st); applyStrip(ch);
    return st;
  }
  const tix = (ch) => (ch === 9 ? 3 : ch < 3 ? ch : -1); // channel → track of the virtual device
  const par = (ch) => { const i = tix(ch); return i < 0 ? null : dev.state.tracks[i]?.p; };
  const inst = (ch) => {
    if (ch === 9) return null;
    const i = tix(ch), t = dev.state.tracks[i];
    return INST[t ? presetName(t) : FALLBACK] || INST[FALLBACK];
  };
  function applyStrip(ch, at = c.currentTime) {
    const st = strips.get(ch); if (!st) return;
    const p = par(ch), x = cc[ch], ins = inst(ch);
    const level = p ? p[0] : 100, pan = p ? p[5] : 0, revP = p ? p[8] : 20, dlyP = p ? p[9] : 0;
    st.lvl.gain.setTargetAtTime(Math.pow(level / 100, 1.6) * (x[11] / 127), at, 0.02);
    st.pan.pan.setTargetAtTime(clamp(pan / 64, -1, 1), at, 0.02);
    const base = ch === 9 ? 0.07 : ins?.rev ?? 0.2;
    st.sr.gain.setTargetAtTime(clamp(base * (revP / 20), 0, 1.2), at, 0.03);
    st.sd.gain.setTargetAtTime(clamp((ch === 9 ? 0 : ins?.dly || 0) + (dlyP / 127) * 0.7, 0, 1), at, 0.03);
    const f = x[74]; // 64 = open; lower = low-pass, higher = high-pass
    st.lp.frequency.setTargetAtTime(f < 64 ? 120 * Math.pow(20000 / 120, f / 63) : 20000, at, 0.03);
    st.hp.frequency.setTargetAtTime(f > 64 ? 20 * Math.pow(6000 / 20, (f - 64) / 63) : 10, at, 0.03);
  }

  // tempo, from the clock's own timestamps (the delay follows it: a dotted eighth)
  let lastClock = 0, iv = 0;
  function clock(ts) {
    if (lastClock && ts > lastClock && ts - lastClock < 200) {
      iv = iv ? iv * 0.9 + (ts - lastClock) * 0.1 : ts - lastClock;
      const t = clamp((iv * 24 * 0.75) / 1000, 0.05, 1.9);
      dL.delayTime.setTargetAtTime(t, c.currentTime, 0.2); dR.delayTime.setTargetAtTime(t, c.currentTime, 0.2);
    }
    lastClock = ts;
  }

  const when = (ts) => (ts == null ? c.currentTime : Math.max(c.currentTime, c.currentTime + (ts - performance.now()) / 1000));

  // ---------- synth voices ----------
  function env(g, t, a, d, s, peak) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(peak, t + Math.max(0.001, a));
    g.gain.setTargetAtTime(Math.max(0.0001, peak * s), t + a, Math.max(0.01, d / 3.5));
  }
  function release(v, t) {
    if (v.off) return; v.off = true;
    const r = v.r;
    v.amp.gain.cancelScheduledValues(t);
    v.amp.gain.setTargetAtTime(0.0001, t, Math.max(0.005, r / 4));
    v.stop(t + r * 1.6 + 0.05);
  }
  function noteOn(ch, note, vel, t) {
    const st = strip(ch);
    if (ch === 9) return drum(st, note, vel / 127, t);
    const ins = inst(ch), p = par(ch) || [100, 0, 64, 90, 40];
    const fin = (v, d) => (Number.isFinite(v) ? v : d);
    const atk = fin(ins.a + Math.pow(p[1] / 127, 2) * 2.5, 0.005), dec = fin(ins.d * Math.pow(2, (p[2] - 64) / 40), 0.5), sus = clamp(fin(ins.s * (p[3] / 90), 0.5), 0, 1), rel = clamp(fin(ins.r * Math.pow(2, (p[4] - 40) / 30), 0.2), 0.005, 6);
    const cutMul = Math.pow(2, ((p[10] ?? 90) - 90) / 22), q = (ins.q || 1) * (0.4 + (p[11] ?? 20) / 33);
    const f = mtof(note), vg = Math.pow(vel / 127, 1.3) * ins.gain;
    const amp = c.createGain(); amp.connect(st.inp);
    const nodes = [];
    if (ins.kind === "boom") { // 808: a sine that drops into the note, with a long tail
      const o = c.createOscillator(), sh = c.createWaveShaper();
      sh.curve = curve(1.6);
      o.frequency.setValueAtTime(f * 2.2, t); o.frequency.exponentialRampToValueAtTime(f, t + 0.06);
      o.connect(sh).connect(amp); nodes.push(o);
      env(amp, t, 0.002, 1.2 * Math.pow(2, (p[2] - 64) / 40), 0.6, vg);
    } else if (ins.kind === "an") {
      const flt = c.createBiquadFilter(); flt.type = "lowpass"; flt.Q.value = q; flt.connect(amp);
      const fc = ins.cut * cutMul, fe = ins.env * cutMul * (0.6 + 0.4 * vel / 127);
      flt.frequency.setValueAtTime(clamp(fc + fe, 40, 18000), t);
      flt.frequency.setTargetAtTime(clamp(fc, 40, 18000), t + 0.003, ins.fdec / 3);
      if (ins.lfo) { const l = c.createOscillator(), lg = c.createGain(); l.frequency.value = ins.lfo; lg.gain.value = fc * 0.25; l.connect(lg).connect(flt.frequency); nodes.push(l); }
      let vib = null;
      if (ins.vib || cc[ch][1]) { vib = c.createOscillator(); vib.frequency.value = 5.2; const vg2 = c.createGain(); vg2.gain.setValueAtTime(0, t); vg2.gain.linearRampToValueAtTime(f * 0.006 * ((ins.vib || 0) + cc[ch][1] / 64), t + 0.4); vib.connect(vg2); nodes.push(vib); vib.g = vg2; }
      for (const [type, cents, semi, g] of ins.osc) {
        const o = c.createOscillator(), og = c.createGain();
        o.type = type; o.frequency.value = f * Math.pow(2, semi / 12); o.detune.value = cents + (Math.random() * 4 - 2);
        og.gain.value = g; o.connect(og).connect(flt); nodes.push(o);
        if (vib) vib.g.connect(o.frequency);
      }
      env(amp, t, atk, dec, sus, vg);
    } else { // fm
      const car = c.createOscillator(), mod = c.createOscillator(), mg = c.createGain();
      car.frequency.value = f; mod.frequency.value = f * ins.ratio;
      const idx = ins.index * f * (0.5 + 0.7 * vel / 127) * cutMul;
      mg.gain.setValueAtTime(idx, t); mg.gain.setTargetAtTime(idx * 0.12, t, ins.idec / 3);
      mod.connect(mg).connect(car.frequency); car.connect(amp); nodes.push(car, mod);
      if (ins.tine) {
        const tm = c.createOscillator(), tg = c.createGain(); tm.frequency.value = f * ins.tine;
        tg.gain.setValueAtTime(ins.tindex * f * 4, t); tg.gain.setTargetAtTime(0, t, ins.tdec / 3);
        tm.connect(tg).connect(car.frequency); nodes.push(tm);
      }
      if (ins.trem) { const l = c.createOscillator(), lg = c.createGain(), tr = c.createGain(); l.frequency.value = ins.trem; lg.gain.value = 0.12; tr.gain.value = 0.88; amp.disconnect(); amp.connect(tr).connect(st.inp); l.connect(lg).connect(tr.gain); nodes.push(l); }
      env(amp, t, atk, dec, sus, vg);
    }
    nodes.forEach((o) => o.start(t));
    const v = { note, t, r: rel, amp, off: false, stop: (when2) => nodes.forEach((o) => { try { o.stop(when2); } catch {} }) };
    // voices that fade out on their own are cleaned up after their decay
    if (sus === 0 || ins.kind === "boom") v.stop(t + dec * 4 + rel + 0.5);
    st.voices.push(v);
    // a safety net: no voice outlives a minute, even if its note-off never comes
    setTimeout(() => { if (!v.off) { release(v, c.currentTime); st.voices = st.voices.filter((x) => x !== v); } }, 60000);
    if (st.voices.length > 24) release(st.voices.shift(), t);
    return v;
  }
  function noteOff(ch, note, t) {
    const st = strips.get(ch); if (!st || ch === 9) return;
    const v = st.voices.find((x) => x.note === note && !x.off);
    if (!v) return;
    release(v, Math.max(t, v.t + 0.005));
    st.voices = st.voices.filter((x) => x !== v);
  }
  function allOff(t = c.currentTime) {
    for (const st of strips.values()) { st.voices.forEach((v) => release(v, t)); st.voices = []; }
  }

  // ---------- drums ----------
  let openHat = null;
  function burst(dest, t, { type = "bandpass", f = 1000, q = 1, dec = 0.1, g = 0.5, hp = 0 }) {
    const s = c.createBufferSource(), fl = c.createBiquadFilter(), a = c.createGain();
    s.buffer = noise; s.loop = true; fl.type = type; fl.frequency.value = f; fl.Q.value = q;
    let tail = fl;
    if (hp) { const h = c.createBiquadFilter(); h.type = "highpass"; h.frequency.value = hp; fl.connect(h); tail = h; }
    s.connect(fl); tail.connect(a).connect(dest);
    a.gain.setValueAtTime(g, t); a.gain.setTargetAtTime(0.0001, t + 0.001, dec / 3.2);
    s.start(t, Math.random() * 1.5); s.stop(t + dec * 2.2 + 0.05);
    return { a, s };
  }
  function tone(dest, t, { type = "sine", f0, f1, pdec = 0.05, dec = 0.3, g = 0.8, sh = 0 }) {
    const o = c.createOscillator(), a = c.createGain(); o.type = type;
    o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f1, t + pdec);
    if (sh) { const w = c.createWaveShaper(); w.curve = curve(sh); o.connect(w).connect(a); } else o.connect(a);
    a.connect(dest); a.gain.setValueAtTime(0.0001, t); a.gain.linearRampToValueAtTime(g, t + 0.0015); a.gain.setTargetAtTime(0.0001, t + 0.002, dec / 3.5);
    o.start(t); o.stop(t + dec * 2 + 0.05);
  }
  function metal(dest, t, { dec, g, f = 9000 }) {
    const a = c.createGain(), bp = c.createBiquadFilter(), hp = c.createBiquadFilter();
    bp.type = "bandpass"; bp.frequency.value = f; bp.Q.value = 0.8; hp.type = "highpass"; hp.frequency.value = 6500;
    bp.connect(hp).connect(a).connect(dest);
    const os = [205.3, 304.4, 369.6, 522.7, 540, 800].map((fr) => { const o = c.createOscillator(); o.type = "square"; o.frequency.value = fr * 1.03; o.connect(bp); o.start(t); o.stop(t + dec * 2.5 + 0.05); return o; });
    a.gain.setValueAtTime(0.0001, t); a.gain.linearRampToValueAtTime(g, t + 0.001); a.gain.setTargetAtTime(0.0001, t + 0.002, dec / 3.2);
    return { a, os };
  }
  function drum(st, n, v, t) {
    const d = st.inp, g = Math.pow(v, 1.2);
    switch (n) {
      case 36: case 35:
        tone(d, t, { f0: n === 36 ? 155 : 120, f1: n === 36 ? 47 : 42, pdec: 0.09, dec: n === 36 ? 0.42 : 0.6, g: 1.0 * g, sh: 1.4 });
        burst(d, t, { type: "highpass", f: 2500, q: 0.5, dec: 0.008, g: 0.25 * g });
        break;
      case 38: case 40:
        tone(d, t, { type: "triangle", f0: n === 38 ? 220 : 180, f1: n === 38 ? 175 : 150, pdec: 0.04, dec: 0.12, g: 0.55 * g });
        burst(d, t, { type: "bandpass", f: 3200, q: 0.6, dec: n === 38 ? 0.2 : 0.14, g: 0.6 * g, hp: 900 });
        break;
      case 39:
        [0, 0.011, 0.022].forEach((o, k) => burst(d, t + o, { type: "bandpass", f: 1300, q: 1.8, dec: k === 2 ? 0.18 : 0.012, g: 0.75 * g }));
        break;
      case 42: case 44:
        if (openHat) { openHat.a.gain.cancelScheduledValues(t); openHat.a.gain.setTargetAtTime(0.0001, t, 0.01); openHat = null; }
        metal(d, t, { dec: n === 42 ? 0.045 : 0.03, g: 0.32 * g });
        burst(d, t, { type: "highpass", f: 8000, q: 0.7, dec: 0.035, g: 0.12 * g });
        break;
      case 46: openHat = metal(d, t, { dec: 0.32, g: 0.28 * g }); break;
      case 37: tone(d, t, { type: "triangle", f0: 1750, f1: 1600, pdec: 0.01, dec: 0.03, g: 0.4 * g }); burst(d, t, { f: 3000, q: 2, dec: 0.012, g: 0.3 * g }); break;
      case 43: case 48: tone(d, t, { f0: n === 43 ? 150 : 230, f1: n === 43 ? 95 : 150, pdec: 0.12, dec: 0.32, g: 0.7 * g }); break;
      case 49: metal(d, t, { dec: 1.3, g: 0.25 * g, f: 7000 }); burst(d, t, { type: "highpass", f: 5000, dec: 1.0, g: 0.12 * g }); break;
      case 51: metal(d, t, { dec: 0.7, g: 0.16 * g, f: 5500 }); break;
      case 70: burst(d, t, { type: "bandpass", f: 6500, q: 1.2, dec: 0.06, g: 0.3 * g }); break;
      case 63: tone(d, t, { f0: 420, f1: 330, pdec: 0.02, dec: 0.17, g: 0.5 * g }); break;
      case 56: { const a = c.createGain(), bp = c.createBiquadFilter(); bp.type = "bandpass"; bp.frequency.value = 900; bp.Q.value = 2; bp.connect(a).connect(d);
        [540, 800].forEach((fr) => { const o = c.createOscillator(); o.type = "square"; o.frequency.value = fr; o.connect(bp); o.start(t); o.stop(t + 0.5); });
        a.gain.setValueAtTime(0.0001, t); a.gain.linearRampToValueAtTime(0.35 * g, t + 0.001); a.gain.setTargetAtTime(0.0001, t + 0.002, 0.08); break; }
      default: tone(d, t, { f0: mtof(n) * 2, f1: mtof(n), pdec: 0.02, dec: 0.15, g: 0.3 * g });
    }
  }

  /** Handle MIDI bytes (one or more messages) sent to the device at `ts` (performance.now() ms). */
  function midi(data, ts) {
    if (c.state === "suspended") c.resume();
    const t = when(ts);
    for (let i = 0; i < data.length;) {
      const b = data[i];
      if (b === 0xf8) { clock(ts ?? performance.now()); i++; continue; }
      if (b === 0xfc) { allOff(t); lastClock = 0; i++; continue; }
      if (b >= 0xf0) { i++; continue; }
      const hi = b & 0xf0, ch = b & 15, n = hi === 0xc0 || hi === 0xd0 ? 2 : 3, a1 = data[i + 1], a2 = data[i + 2];
      if (hi === 0x90 && a2) noteOn(ch, a1, a2, t);
      else if (hi === 0x80 || hi === 0x90) noteOff(ch, a1, t);
      else if (hi === 0xb0) ccIn(ch, a1, a2, t);
      else if (hi === 0xc0) pcIn(ch, a1);
      i += n;
    }
  }
  function ccIn(ch, n, v, t) {
    if (n === 123 || n === 120) return allOff(t);
    const p = par(ch);
    const map = { 7: 0, 73: 1, 75: 2, 72: 4, 71: 11, 91: 8, 94: 9 };
    if (p && map[n] != null) p[map[n]] = n === 91 ? Math.round(v / 127 * 80) : n === 71 ? v : v;
    if (p && n === 10) p[5] = v - 64;
    cc[ch][n] = v;
    if (strips.has(ch)) applyStrip(ch, t); else strip(ch);
  }
  function pcIn(ch, n) { dev.programChange?.(tix(ch), n); if (strips.has(ch)) applyStrip(ch); }

  return { midi, stream: stream?.stream || null, out, refresh: () => strips.forEach((_, ch) => applyStrip(ch)), allOff };
}

function curve(k) {
  const n = 1024, a = new Float32Array(n);
  for (let i = 0; i < n; i++) { const x = (i / (n - 1)) * 2 - 1; a[i] = Math.tanh(x * k) / Math.tanh(k); }
  return a;
}
