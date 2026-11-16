// Scenes: snapshots of which tracks play, across every device. Launched while playing, a scene takes over on the next
// downbeat, so whole sections come in and out together, in time. Stopped, it takes over at once.

import { S, PPQN, tcol } from "../state.js";
import { $, el } from "../ui/dom.js";
import { ensurePattern } from "./pattern.js";

export const NSCENE = 8, BAR = PPQN * 4;

// S.scenes[k]: null (empty) or { name, slots: { [slotIndex]: [mute, mute, …] } }
S.scenes = S.scenes || Array(NSCENE).fill(null);
S.scene = S.scene ?? -1; // the scene that plays
S.sceneQ = null; // { k, done: Set(slot index) } waiting for the next downbeat
S.sceneStore = false;

const live = () => S.slots.filter((s) => s.armed && s.midiId);

/** Keep which tracks play now, on every armed device, in scene k. */
export function storeScene(k) {
  const slots = {};
  for (const s of live()) slots[s.i] = ensurePattern(s).tracks.map((t) => !!t.mute);
  S.scenes[k] = { name: S.scenes[k]?.name || `SCENE ${k + 1}`, slots };
  S.scene = k;
  renderScenes();
}

function applyTo(s, sc) {
  const m = sc.slots[s.i];
  if (!m) return;
  ensurePattern(s).tracks.forEach((t, j) => { if (j < m.length) t.mute = m[j]; });
}

/** Play scene k: at the next downbeat while running, at once while stopped. */
export function launchScene(k) {
  const sc = S.scenes[k];
  if (!sc) return;
  const run = S.slots.filter((s) => s.running);
  if (!run.length) {
    S.slots.forEach((s) => applyTo(s, sc));
    S.scene = k; S.sceneQ = null;
    S.sceneDirty = true;
  } else S.sceneQ = { k, done: new Set() };
  renderScenes();
}

/** Called by the clock before it plays pulse `pulse` of device s. */
export function sceneAtPulse(s, pulse) {
  const q = S.sceneQ;
  if (!q || pulse % BAR || q.done.has(s.i)) return;
  applyTo(s, S.scenes[q.k]);
  q.done.add(s.i);
  if (S.slots.every((x) => !x.running || q.done.has(x.i))) { S.scene = q.k; S.sceneQ = null; S.sceneDirty = true; }
}

// ---------- the scene bar ----------
export function renderScenes() {
  const box = typeof document !== "undefined" && $("#scenes");
  if (!box) return;
  box.replaceChildren();
  box.append(el("span", "grp-t2", "SCENES"));
  const devs = live();
  S.scenes.forEach((sc, k) => {
    const b = el("button", "scene");
    b.type = "button";
    b.classList.toggle("empty", !sc);
    b.classList.toggle("on", S.scene === k && !!sc);
    b.classList.toggle("queued", S.sceneQ?.k === k);
    b.dataset.k = k;
    b.append(el("b", "", String(k + 1)));
    const dots = el("span", "sdots");
    if (sc) devs.forEach((s) => {
      const m = sc.slots[s.i];
      if (!m) return;
      const g = el("span", "sdev");
      m.forEach((mute, j) => { const d = el("i", mute ? "" : "lit"); d.style.setProperty("--tc", tcol(j)); g.append(d); });
      dots.append(g);
    });
    b.append(dots);
    b.title = sc ? `${sc.name} · click: play it from the next bar · Shift+click or STORE: keep the tracks playing now` : "Empty · Shift+click or STORE, then this: keep the tracks playing now";
    b.onclick = (e) => {
      if (S.sceneStore || e.shiftKey || !sc) { storeScene(k); S.sceneStore = false; renderScenes(); return; }
      launchScene(k);
    };
    box.append(b);
  });
  const st = el("button", "mini" + (S.sceneStore ? " active" : ""), S.sceneStore ? "PICK A SCENE…" : "STORE");
  st.type = "button"; st.id = "scene-store";
  st.title = "Keep which tracks play now in a scene";
  st.onclick = () => { S.sceneStore = !S.sceneStore; renderScenes(); };
  box.append(st);
}
