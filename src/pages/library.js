// Library page: the device's projects and user presets (FL protocol), a full SLOOP backup to a file,
// and this app's own session / MIDI-file export for every firmware.

import { S, out, prof, cur, hasFl, tcol } from "../state.js";
import { $, el, btn, download } from "../ui/dom.js";
import { ensurePattern } from "../sequencer/pattern.js";
import { readLibrary, project, userLoad, userStore, userErase, backup, rpc, flExtensions, CMD } from "../device/fl-device.js";
import { exportSession, importSession, exportMidi, save } from "../session.js";

const lstat = (t) => ($("#library-status").textContent = t);

async function load(s) {
  lstat("READING…");
  const l = await readLibrary(s);
  lstat(l ? "" : "NO REPLY");
  renderLibrary();
}
async function act(s, what, fn) {
  lstat(what + "…");
  const r = await fn();
  lstat(r ? `${what}: done.` : `${what}: no reply.`);
  s.snd = null; s.qs = null; s.mix = null;
  await load(s);
}

function projects(s) {
  const sec = el("section", "ctl-sec");
  sec.append(el("h3", "", "PROJECTS ON THE DEVICE"));
  sec.append(el("p", "sh-hint", "A project holds all tracks: sounds, patterns and the mix. Saving writes the FM-1's flash (about 2 s); stop playback first."));
  const row = el("div", "lib-grid");
  s.lib.projects.forEach((used, slot) => {
    const c = el("div", "lib-card" + (used ? " used" : ""));
    c.append(el("b", "", `SLOT ${slot + 1}`), el("span", "dim", used === null ? "unknown" : used ? "saved" : "empty"));
    c.append(btn("LOAD", false, () => used && confirm(`Load project ${slot + 1}? Unsaved changes on the device are lost.`) && act(s, `Loading project ${slot + 1}`, () => project(s, 0, slot))));
    c.append(btn("SAVE HERE", false, () => (!used || confirm(`Overwrite project ${slot + 1} on the device?`)) && act(s, `Saving project ${slot + 1}`, () => project(s, 1, slot))));
    row.append(c);
  });
  sec.append(row);
  return sec;
}

function presets(s) {
  const sec = el("section", "ctl-sec"), tracks = ensurePattern(s).tracks;
  sec.append(el("h3", "", "USER PRESETS"));
  sec.append(el("p", "sh-hint", "Your own sounds, stored on the FM-1. LOAD applies one to the selected track; STORE saves that track's current sound."));
  const tabs = el("div", "tabs");
  tracks.forEach((t, i) => {
    const b = el("button", "tab", t.name);
    b.type = "button"; b.role = "tab"; b.setAttribute("aria-selected", String(i === s.tr)); b.style.setProperty("--tc", tcol(i));
    b.onclick = () => { s.tr = i; renderLibrary(); };
    tabs.append(b);
  });
  sec.append(tabs);
  const pick = async () => { if (s.info.ntrk > 1) await rpc(s, CMD.TRACK, [s.tr]); };
  const list = el("div", "lib-grid");
  s.lib.user.forEach((u) => {
    const c = el("div", "lib-card" + (u.used ? " used" : ""));
    c.append(el("b", "", `U${String(u.slot + 1).padStart(2, "0")}`), el("span", u.used ? "" : "dim", u.used ? `${u.name} · ${s.info.engines[u.engine] || ""}` : "empty"));
    if (u.used) {
      c.append(btn("LOAD", false, () => act(s, `Loading ${u.name}`, async () => { await pick(); return userLoad(s, u.slot); })));
      c.append(btn("ERASE", false, () => confirm(`Erase ${u.name} from the device?`) && act(s, `Erasing ${u.name}`, () => userErase(s, u.slot)), "mini danger"));
    } else {
      c.append(btn("STORE", false, () => {
        const name = prompt(`Name for U${u.slot + 1} (up to 12 characters, empty = automatic):`, "");
        if (name === null) return;
        act(s, `Storing U${u.slot + 1}`, async () => { await pick(); return userStore(s, u.slot, name); });
      }));
    }
    list.append(c);
  });
  sec.append(list);
  return sec;
}

function backupSection(s) {
  const sec = el("section", "ctl-sec");
  sec.append(el("h3", "", "FULL BACKUP"));
  sec.append(el("p", "sh-hint", "Downloads everything the device keeps — working project, the four projects, settings, user presets, your samples — as one file. Read-only: nothing on the FM-1 changes."));
  sec.append(btn("⬇ DOWNLOAD BACKUP", false, async () => {
    lstat("BACKING UP…");
    const b = await backup(s, lstat);
    if (!b) return lstat("BACKUP FAILED — stop playback and try again.");
    download(new Blob([JSON.stringify(b)], { type: "application/json" }), `fm1-backup-${new Date().toISOString().slice(0, 10)}.json`);
    lstat(`BACKUP SAVED · ${b.objects.length} objects`);
  }));
  return sec;
}

function sessionSection(s) {
  const sec = el("section", "ctl-sec");
  sec.append(el("h3", "", "THIS APP'S SESSION"));
  sec.append(el("p", "sh-hint", "Device assignments, firmware choices, tempo and every pattern are saved in this browser automatically. Export them to move to another computer or share a set."));
  const file = Object.assign(el("input"), { type: "file", accept: "application/json,.json", hidden: true });
  file.onchange = async () => {
    const f = file.files[0];
    if (f && (await importSession(f))) { save(); lstat("SESSION IMPORTED"); location.reload(); }
    else lstat("NOT A SESSION FILE");
  };
  const row = el("div", "sh-row");
  row.append(btn("⬇ EXPORT SESSION", false, exportSession), btn("⬆ IMPORT SESSION", false, () => file.click()),
    btn("⬇ EXPORT PATTERN AS .MID", false, () => exportMidi(s) || lstat("Nothing to export: every track is empty.")), file);
  sec.append(row);
  return sec;
}

export function renderLibrary() {
  const s = cur(), box = $("#library-body"), p = prof(s);
  box.replaceChildren();
  $("#library-target").textContent = `${p.name} · DEVICE ${s.i + 1}`;
  if (out(s) && hasFl(s)) {
    if (!s.lib) {
      box.append(el("p", "sh-hint", "Reading the device's library…"));
      if (!s.libLoading) { s.libLoading = true; load(s).finally(() => (s.libLoading = false)); }
    } else {
      box.append(projects(s), presets(s));
      if (flExtensions(s).backup) box.append(backupSection(s));
      box.append(btn("↻ READ AGAIN", false, () => load(s)));
    }
  } else if (out(s)) {
    box.append(el("p", "sh-hint", `${p.name} doesn't answer the editor protocol, so its projects and presets stay on the device.`));
  }
  box.append(sessionSection(s));
}
