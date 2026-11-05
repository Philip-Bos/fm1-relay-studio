// Controls page: plain-MIDI control of any firmware, driven by its profile — the documented CC map per
// track, Program Change, performance controls, SLOOP's remote buttons and punch-in effects, and panic.

import { S, out, prof, cur, tcol } from "../state.js";
import { $, el, wrap, grp, btn, sel, rngL, range, num, link } from "../ui/dom.js";
import { ensurePattern } from "../sequencer/pattern.js";
import { sendPC } from "./sequencer.js";

const GROUPS = { mix: "MIX", tone: "TONE", envelope: "ENVELOPE", sends: "SENDS", performance: "PERFORMANCE" };
const chOpts = range(1, 16, (c) => "CH " + c);

function trackTabs(s, onPick) {
  const tabs = el("div", "tabs");
  ensurePattern(s).tracks.forEach((t, i) => {
    const b = el("button", "tab", `${t.name} · ${t.ch}`);
    b.type = "button"; b.role = "tab";
    b.setAttribute("aria-selected", String(i === s.tr));
    b.style.setProperty("--tc", tcol(i));
    b.onclick = () => onPick(i);
    tabs.append(b);
  });
  return tabs;
}

/** A button that holds while pressed: on(true) at press, on(false) at release. */
function hold(text, on, cls = "pad-btn") {
  const b = el("button", cls, text);
  b.type = "button";
  const up = () => { if (!b.classList.contains("down")) return; b.classList.remove("down"); on(false); };
  b.onpointerdown = (e) => { e.preventDefault(); b.setPointerCapture(e.pointerId); b.classList.add("down"); on(true); };
  b.onpointerup = b.onpointercancel = up;
  return b;
}

export function renderControls() {
  const s = cur(), box = $("#controls-body"), p = prof(s), o = out(s);
  box.replaceChildren();
  $("#controls-target").textContent = `${p.name} · DEVICE ${s.i + 1}`;
  if (!o) return box.append(el("p", "sh-hint", "Choose a MIDI output for this device first (Devices page)."));
  const t = ensurePattern(s).tracks[s.tr], ch = (t.ch - 1) & 15, tx = (a) => o.send(a);
  const cc = (n, v) => tx([0xb0 | ch, n, v]);
  t.cc = t.cc || {};
  box.style.setProperty("--tc", tcol(s.tr));
  box.append(trackTabs(s, (i) => { s.tr = i; renderControls(); }));

  // ---- the firmware's documented CC map ----
  if (p.cc.length) {
    const sec = el("section", "ctl-sec");
    sec.append(el("h3", "", `SOUND · CC on channel ${t.ch}`));
    if (p.ccUnverified) sec.append(el("p", "warn", `${p.name} is built on Felucca and probably keeps its standard CC map, but its docs don't confirm it. If a control does nothing, use CUSTOM CC with the device's MIDI LEARN.`));
    const byGroup = {};
    p.cc.forEach((c) => (byGroup[c.group] ||= []).push(c));
    const row = el("div", "ctl-groups");
    for (const [g, list] of Object.entries(byGroup)) {
      row.append(grp(GROUPS[g] || g.toUpperCase(), ...list.map((c) => {
        const r = rngL(c.label, 0, 127, t.cc[c.cc] ?? c.def, (v) => { t.cc[c.cc] = v; cc(c.cc, v); }, c.bipolar ? (v) => (v === 64 ? "C" : v - 64 > 0 ? "+" + (v - 64) : v - 64) : undefined);
        r.title = `CC ${c.cc}${c.hint ? " · " + c.hint : ""} · double-click to reset`;
        r.ondblclick = () => { t.cc[c.cc] = c.def; cc(c.cc, c.def); r.set(c.def); };
        return r;
      })));
    }
    sec.append(row, btn("RESET ALL TO DEFAULTS", false, () => { p.cc.forEach((c) => { t.cc[c.cc] = c.def; cc(c.cc, c.def); }); renderControls(); }));
    box.append(sec);
  } else {
    box.append(el("p", "sh-hint", `${p.name} doesn't document MIDI CCs. Use CUSTOM CC below with the device's MIDI LEARN, if it has one.`));
  }

  // ---- program change ----
  if (p.programChange) {
    const sec = el("section", "ctl-sec"), pc = p.programChange;
    const kits = t.drum && p.kits;
    sec.append(el("h3", "", kits ? `DRUM KIT · Program Change on channel ${t.ch}` : `${pc.label} · Program Change on channel ${t.ch}`));
    if (pc.note) sec.append(el("p", "sh-hint", pc.note));
    const r = el("div", "sh-row");
    if (kits) r.append(wrap("KIT", sel(p.kits.map((k, i) => [`${i + 1}. ${k}`, i]), t.pc || 0, (v) => { t.pc = +v; sendPC(s, t); })));
    else {
      r.append(wrap("PROGRAM", num(1, 128, (t.pc || 0) + 1, (v) => { t.pc = v - 1; sendPC(s, t); })));
      if (pc.bankSelect !== false) r.append(wrap("BANK (CC 0)", num(0, 127, t.bank || 0, (v) => (t.bank = v))));
    }
    r.append(btn("◀", false, () => { t.pc = Math.max(0, (t.pc || 0) - 1); sendPC(s, t); renderControls(); }),
      btn("SEND", false, () => sendPC(s, t)),
      btn("▶", false, () => { t.pc = Math.min(kits ? p.kits.length - 1 : 127, (t.pc || 0) + 1); sendPC(s, t); renderControls(); }));
    sec.append(r);
    box.append(sec);
  }

  // ---- performance ----
  const perf = el("section", "ctl-sec");
  perf.append(el("h3", "", "PERFORMANCE"));
  const pr = el("div", "sh-row");
  const bend = rngL("PITCH BEND", -8192, 8191, 0, (v) => { const u = v + 8192; tx([0xe0 | ch, u & 127, u >> 7]); }, (v) => (v ? (v > 0 ? "+" : "") + Math.round(v / 81.92) + "%" : "0"));
  const bi = bend.querySelector("input");
  bi.onpointerup = bi.onchange = () => { bend.set(0); tx([0xe0 | ch, 0, 64]); };
  bend.title = "Springs back to centre when you let go";
  pr.append(bend);
  const sus = btn(t.sus ? "SUSTAIN ON" : "SUSTAIN", !!t.sus, () => { t.sus = !t.sus; cc(64, t.sus ? 127 : 0); renderControls(); });
  sus.title = "CC 64";
  pr.append(sus);
  perf.append(pr);
  box.append(perf);

  // ---- custom CC: for MIDI LEARN or undocumented firmware ----
  const cust = el("section", "ctl-sec");
  cust.append(el("h3", "", "CUSTOM CC"));
  cust.append(el("p", "sh-hint", "Send any controller number. Handy for MIDI LEARN on the device: start learning there, then move this slider."));
  const cr = el("div", "sh-row");
  t.customCc = t.customCc ?? 20;
  cr.append(wrap("CC NUMBER", num(0, 127, t.customCc, (v) => (t.customCc = v))),
    rngL("VALUE", 0, 127, t.customVal ?? 0, (v) => { t.customVal = v; cc(t.customCc, v); }));
  cust.append(cr);
  box.append(cust);

  // ---- SLOOP: buttons over MIDI ----
  if (p.remote) {
    const sec = el("section", "ctl-sec"), rm = p.remote;
    s.remoteCh = s.remoteCh || 16;
    sec.append(el("h3", "", "REMOTE BUTTONS"));
    sec.append(el("p", "sh-hint", `Presses the FM-1's own buttons (CC ${rm.firstCc}–${rm.firstCc + rm.buttons.length - 1}). Set ${rm.setting} to the same channel on the device first. Hold a button here to hold it there.`));
    sec.append(wrap("CHANNEL", sel(chOpts, s.remoteCh, (v) => (s.remoteCh = +v))));
    const pads = el("div", "remote");
    rm.buttons.forEach((name, k) => pads.append(hold(name, (down) => o.send([0xb0 | ((s.remoteCh - 1) & 15), rm.firstCc + k, down ? 127 : 0]))));
    sec.append(pads);
    box.append(sec);
  }

  // ---- SLOOP: punch-in effects over MIDI ----
  if (p.fx) {
    const sec = el("section", "ctl-sec");
    s.fxCh = s.fxCh || 15;
    sec.append(el("h3", "", "PUNCH-IN FX"));
    sec.append(el("p", "sh-hint", `Hold a pad to run its effect on the whole mix. Set ${p.fx.setting} to the same channel on the device first.`));
    sec.append(wrap("CHANNEL", sel(chOpts, s.fxCh, (v) => (s.fxCh = +v))));
    const keys = el("div", "fxkeys");
    p.fx.pads.forEach((pad) => keys.append(hold(pad.label, (down) => o.send([(down ? 0x90 : 0x80) | ((s.fxCh - 1) & 15), pad.note, down ? 100 : 0]), pad.white ? "fx w" : "fx b")));
    sec.append(keys);
    box.append(sec);
  }

  // ---- panic ----
  const pan = el("section", "ctl-sec");
  pan.append(el("h3", "", "PANIC"));
  pan.append(btn("ALL NOTES OFF · EVERY TRACK", false, () => ensurePattern(s).tracks.forEach((x) => {
    const c = (x.ch - 1) & 15;
    o.send([0xb0 | c, 64, 0]); o.send([0xb0 | c, 123, 0]); o.send([0xb0 | c, 120, 0]);
  }), "mini danger"));
  box.append(pan);
  if (p.links?.manual) box.append(el("p", "sh-hint", "Full reference: "), link(`${p.name} manual ↗`, p.links.manual));
}
