// Minimal Standard MIDI File (format 1) writer for exporting patterns to a DAW.

const vlq = (n) => {
  const out = [n & 0x7f];
  while ((n >>= 7)) out.unshift((n & 0x7f) | 0x80);
  return out;
};
const u32 = (n) => [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255];
const u16 = (n) => [(n >> 8) & 255, n & 255];
const ascii = (s) => [...s].map((c) => c.charCodeAt(0) & 0x7f);
const chunk = (id, body) => [...ascii(id), ...u32(body.length), ...body];

function trackChunk(events) {
  events.sort((a, b) => a.t - b.t || a.order - b.order);
  const body = [];
  let last = 0;
  for (const e of events) { body.push(...vlq(e.t - last), ...e.bytes); last = e.t; }
  body.push(0, 0xff, 0x2f, 0);
  return chunk("MTrk", body);
}

/**
 * tracks: [{ name, ch (1..16), notes: [{t, d, p, v}], len (beats) }]; ppq matches the notes' ticks.
 * Each track's notes are repeated to fill `beats` so polymetric loops line up.
 */
export function writeSmf({ bpm = 120, ppq = 96, tracks = [], beats = 0 }) {
  const tempo = Math.round(60000000 / bpm);
  const conductor = trackChunk([
    { t: 0, order: 0, bytes: [0xff, 0x51, 3, (tempo >> 16) & 255, (tempo >> 8) & 255, tempo & 255] },
    { t: 0, order: 0, bytes: [0xff, 0x58, 4, 4, 2, 24, 8] },
  ]);
  const chunks = tracks.map((tr) => {
    const ch = (tr.ch - 1) & 15, loop = tr.len * ppq, total = Math.max(loop, beats * ppq), ev = [];
    const name = ascii(tr.name || "");
    ev.push({ t: 0, order: 0, bytes: [0xff, 0x03, ...vlq(name.length), ...name] });
    for (let off = 0; off < total; off += loop) {
      for (const n of tr.notes) {
        if (n.t >= loop || off + n.t >= total) continue;
        const t = off + n.t;
        ev.push({ t, order: 2, bytes: [0x90 | ch, n.p & 127, Math.max(1, n.v & 127)] });
        ev.push({ t: t + Math.max(1, n.d), order: 1, bytes: [0x80 | ch, n.p & 127, 0] });
      }
      if (!loop) break;
    }
    return trackChunk(ev);
  });
  return new Uint8Array([...chunk("MThd", [...u16(1), ...u16(chunks.length + 1), ...u16(ppq)]), ...conductor, ...chunks.flat()]);
}
