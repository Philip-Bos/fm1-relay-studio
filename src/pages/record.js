// Recording page: every device with an audio input chosen is recorded as its own stem, plus a mix.
// Takes are kept in IndexedDB and never overwrite each other.

import { S, out, label } from "../state.js";
import { $, el, download as save } from "../ui/dom.js";
import { showPage } from "../main.js";

const download = (blob, name) => save(blob, name) || setRec("NOTHING TO DOWNLOAD");
export const setRec = (t) => ($("#record-status").textContent = t);
function mimeType() {
  if (typeof MediaRecorder === "undefined") return "";
  return ["audio/mp4", "audio/webm;codecs=opus", "audio/webm"].find((t) => { try { return MediaRecorder.isTypeSupported(t); } catch { return false; } }) || "";
}
const ext = (b) => { const t = b?.type?.toLowerCase() || ""; return t.includes("mp4") ? "m4a" : t.includes("ogg") ? "ogg" : "webm"; };
function stopRec(r) {
  return new Promise((res, rej) => {
    if (!r || r.state === "inactive") return res();
    r.addEventListener("stop", () => res(), { once: true });
    r.addEventListener("error", (e) => rej(e.error || new Error("Recorder failed")), { once: true });
    try { r.stop(); } catch (e) { r.state === "inactive" ? res() : rej(e); }
  });
}
function release(se) {
  se?.tracks.forEach((t) => { try { t.source?.disconnect(); } catch {} t.stream?.getTracks().forEach((m) => m.stop()); });
  try { se?.dest?.stream.getTracks().forEach((t) => t.stop()); } catch {}
}
function recUI(on) {
  $("#record").classList.toggle("recording", on); $("#record b").textContent = on ? "STOP" : "RECORD";
  $("#record-dot").classList.toggle("recording", on);
}
function tickTime() {
  if (!S.rec) return;
  const e = Math.max(0, Math.floor((Date.now() - S.rec.t0) / 1000));
  $("#record-time").textContent = `${String(Math.floor(e / 60)).padStart(2, "0")}:${String(e % 60).padStart(2, "0")}`;
}

export async function record() {
  if (S.rec) return stopRecording();
  if (!navigator.mediaDevices?.getUserMedia) return setRec("NEEDS HTTPS OR LOCALHOST");
  const mime = mimeType();
  if (!mime) return setRec("NO RECORDING FORMAT");
  const chosen = S.slots.filter((s) => s.audioId);
  if (!chosen.length) return setRec("NO AUDIO IN SET — CHOOSE ONE ON THE DEVICES TAB");
  $("#record").disabled = true;
  setRec("CONNECTING…");
  let se = null;
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) throw new Error("Web Audio unavailable");
    se = { tracks: [], mixer: null, mixChunks: [], ctx: new AC(), t0: Date.now(), mime };
    S.rec = se; await se.ctx.resume();
    se.dest = se.ctx.createMediaStreamDestination();
    for (const [k, slot] of chosen.entries()) {
      setRec(`INPUT ${k + 1}/${chosen.length}…`);
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { deviceId: { exact: slot.audioId }, channelCount: { ideal: 2 },
        echoCancellation: false, noiseSuppression: false, autoGainControl: false }, video: false });
      if (!stream.getAudioTracks().length) { stream.getTracks().forEach((t) => t.stop()); throw new Error(`Input ${slot.i + 1} has no audio`); }
      const source = se.ctx.createMediaStreamSource(stream);
      source.connect(se.dest); if (slot.mon) source.connect(se.ctx.destination);
      se.tracks.push({ slot, stream, source, rec: null, chunks: [] });
    }
    for (const t of se.tracks) {
      t.rec = new MediaRecorder(t.stream, { mimeType: mime });
      t.rec.addEventListener("dataavailable", (e) => e.data?.size > 0 && t.chunks.push(e.data));
      t.rec.addEventListener("error", () => setRec(`ERROR · INPUT ${t.slot.i + 1}`));
    }
    se.mixer = new MediaRecorder(se.dest.stream, { mimeType: mime });
    se.mixer.addEventListener("dataavailable", (e) => e.data?.size > 0 && se.mixChunks.push(e.data));
    se.mixer.addEventListener("error", () => setRec("MIX ERROR"));
    se.tracks.forEach((t) => t.rec.start(1000)); se.mixer.start(1000);
    se.t0 = Date.now(); $("#record-time").textContent = "00:00"; recUI(true);
    setRec(`REC ${se.tracks.length} STEM${se.tracks.length === 1 ? "" : "S"} + MIX`);
    clearInterval(S.rtimer); S.rtimer = setInterval(tickTime, 250);
  } catch (e) {
    console.error(e);
    if (se) { await Promise.allSettled([...se.tracks.map((t) => t.rec), se.mixer].filter(Boolean).map(stopRec)); release(se); try { await se.ctx.close(); } catch {} if (S.rec === se) S.rec = null; }
    recUI(false);
    setRec(e?.name === "NotAllowedError" ? "AUDIO PERMISSION DENIED" : e?.name === "NotFoundError" ? "AUDIO INPUT NOT FOUND"
      : e?.name === "NotReadableError" ? "AUDIO INPUT BUSY" : "FAILED: " + String(e?.message || e).slice(0, 60));
  } finally { $("#record").disabled = false; }
}

async function stopRecording() {
  const se = S.rec;
  if (!se || se.stopping) return;
  se.stopping = true; $("#record").disabled = true; setRec("SAVING…"); clearInterval(S.rtimer);
  const res = await Promise.allSettled([...se.tracks.map((t) => t.rec), se.mixer].filter(Boolean).map(stopRec));
  const stems = se.tracks.filter((t) => t.chunks.length).map((t) => ({ name: `stem-${pad2(t.slot.i + 1)}`, slot: t.slot.i + 1,
    device: out(t.slot) ? label(out(t.slot)) : "", blob: new Blob(t.chunks, { type: t.rec?.mimeType || se.mime }) })).filter((x) => x.blob.size);
  let mix = se.mixChunks.length ? new Blob(se.mixChunks, { type: se.mixer?.mimeType || se.mime }) : null; if (mix && !mix.size) mix = null;
  const ms = Date.now() - se.t0;
  release(se); try { await se.ctx.close(); } catch {}
  if (S.rec === se) S.rec = null;
  recUI(false); $("#record").disabled = false;
  if (!stems.length && !mix) return setRec("NO AUDIO DATA — CHECK INPUTS AND PERMISSIONS");
  const take = { id: se.t0, created: se.t0, name: niceDate(se.t0), ms, stems, mix, errors: res.some((r) => r.status === "rejected") };
  try { await dbPut(take); navigator.storage?.persist?.(); setRec(`SAVED · ${stems.length} STEM${stems.length === 1 ? "" : "S"}${mix ? " + MIX" : ""} — SEE RECORDINGS`); }
  catch (e) { console.error(e); take.unsaved = true; setRec("NOT SAVED IN BROWSER — DOWNLOAD IT NOW"); }
  S.takes.unshift(take); renderTakes();
  const b = $("#rec-open"); b.classList.add("flash"); setTimeout(() => b.classList.remove("flash"), 5000);
}

// ---------- recording library: every take is kept in IndexedDB and never overwritten ----------
let _db = null;
const dbOpen = () => _db ? Promise.resolve(_db) : new Promise((res, rej) => {
  if (!window.indexedDB) return rej(new Error("IndexedDB unavailable"));
  const r = indexedDB.open("fm1-relay", 1);
  r.onupgradeneeded = () => r.result.createObjectStore("takes", { keyPath: "id" });
  r.onsuccess = () => res((_db = r.result)); r.onerror = () => rej(r.error);
});
const dbTx = async (mode, fn) => { const db = await dbOpen(); return new Promise((res, rej) => {
  const tx = db.transaction("takes", mode), rq = fn(tx.objectStore("takes"));
  tx.oncomplete = () => res(rq?.result); tx.onerror = tx.onabort = () => rej(tx.error); }); };
const dbPut = (t) => dbTx("readwrite", (s) => s.put(t)), dbAll = () => dbTx("readonly", (s) => s.getAll()), dbDel = (id) => dbTx("readwrite", (s) => s.delete(id));
const pad2 = (n) => String(n).padStart(2, "0");
const stamp = (t) => { const d = new Date(t); return `${d.getFullYear()}${pad2(d.getMonth() + 1)}${pad2(d.getDate())}-${pad2(d.getHours())}${pad2(d.getMinutes())}${pad2(d.getSeconds())}`; };
const niceDate = (t) => new Date(t).toLocaleString([], { dateStyle: "medium", timeStyle: "short" });
const fmtSize = (b) => (b > 1048576 ? (b / 1048576).toFixed(1) + " MB" : Math.max(1, Math.round(b / 1024)) + " KB");
const fmtDur = (ms) => { const s = Math.round(ms / 1000); return `${Math.floor(s / 60)}:${pad2(s % 60)}`; };

export function renderRecTargets() {
  const box = $("#rec-targets"); if (!box) return; box.replaceChildren();
  const list = S.slots.filter((s) => s.audioId);
  if (!list.length) return box.append(el("p", "sh-hint", "No audio inputs chosen yet. Pick an AUDIO IN on a device card (Devices tab). Each chosen input is recorded as its own stem, plus a mix."));
  box.append(el("span", "grp-t2", "WILL RECORD"));
  list.forEach((s) => { const d = S.ins.find((x) => x.deviceId === s.audioId); box.append(el("span", "chip-t", `DEVICE ${s.i + 1} ← ${d ? label(d) : "audio input"}`)); });
}
export function renderTakes() {
  S.urls.forEach((u) => URL.revokeObjectURL(u)); S.urls = [];
  $("#rec-open").textContent = `RECORDINGS (${S.takes.length})`;
  const box = $("#takes"); if (!box) return; box.replaceChildren();
  if (!S.takes.length) return box.append(el("p", "sh-hint", "No recordings yet. Press RECORD at the top of any page. Each take is saved here automatically and never overwrites an earlier one."));
  const url = (b) => { const u = URL.createObjectURL(b); S.urls.push(u); return u; };
  const dl = (txt, fn) => { const b = el("button", "dl", "⬇ " + txt); b.onclick = fn; return b; };
  S.takes.forEach((t) => {
    const base = `fm1-${stamp(t.created)}`, card = el("article", "take"), head = el("div", "take-head"), nm = el("input", "take-name");
    nm.value = t.name; nm.setAttribute("aria-label", "Take name");
    nm.onchange = () => { t.name = nm.value.trim() || niceDate(t.created); if (!t.unsaved) dbPut(t).catch(() => {}); };
    head.append(nm, el("span", "take-meta", `${niceDate(t.created)} · ${fmtDur(t.ms)} · ${t.stems.length} stem${t.stems.length === 1 ? "" : "s"}`));
    card.append(head);
    if (t.unsaved) card.append(el("p", "warn", "Not saved in this browser (storage unavailable). Download the files now or they will be lost when you close the page."));
    if (t.errors) card.append(el("p", "warn", "A recorder reported an error during this take, so a file may be incomplete."));
    if (t.mix) { const r = el("div", "file"); r.append(el("b", "", "MIX"), Object.assign(el("audio"), { controls: true, preload: "none", src: url(t.mix) }),
      el("span", "size", fmtSize(t.mix.size)), dl("DOWNLOAD MIX", () => download(t.mix, `${base}-mix.${ext(t.mix)}`))); card.append(r); }
    t.stems.forEach((st) => { const r = el("div", "file"); r.append(el("b", "", `STEM · DEVICE ${st.slot}`), el("span", "dev", st.device),
      el("span", "size", fmtSize(st.blob.size)), dl("DOWNLOAD STEM", () => download(st.blob, `${base}-${st.name}.${ext(st.blob)}`))); card.append(r); });
    const foot = el("div", "file foot");
    if (t.stems.length > 1) foot.append(dl("DOWNLOAD ALL STEMS", () => t.stems.forEach((st, i) => setTimeout(() => download(st.blob, `${base}-${st.name}.${ext(st.blob)}`), i * 500))));
    const del = el("button", "dl danger", "DELETE TAKE");
    del.onclick = async () => { if (!confirm(`Delete “${t.name}” permanently? This cannot be undone.`)) return;
      try { await dbDel(t.id); } catch {} S.takes = S.takes.filter((x) => x !== t); renderTakes(); };
    foot.append(del); card.append(foot); box.append(card);
  });
}
export async function loadTakes() {
  try { S.takes = (await dbAll()).sort((x, y) => y.created - x.created); }
  catch (e) { console.warn(e); $("#takes").before(el("p", "warn", "Local storage is unavailable in this browser window, so recordings can't be kept between sessions. Download each take straight after recording.")); }
  renderTakes();
}


export function bindRecord() {
  $("#record").onclick = record;
  $("#rec-open").onclick = () => showPage("capture");
  loadTakes();
  renderRecTargets();
}
