// Tiny DOM helpers: the app builds its controls with these instead of a framework.

export const $ = (s) => document.querySelector(s);
export { clamp } from "../lib/encoding.js";

export function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
}
export const wrap = (text, x) => { const l = el("label"); l.append(text, x); return l; };
export const grp = (title, ...kids) => { const b = el("div", "grp"); b.append(el("span", "grp-t", title), ...kids); return b; };
export const range = (a, b, f = (i) => i) => Array.from({ length: b - a + 1 }, (_, i) => [f(a + i), a + i]);

export function btn(text, active, fn, cls = "mini") {
  const b = el("button", cls + (active ? " active" : ""), text);
  b.type = "button";
  b.onclick = fn;
  return b;
}
export function sel(opts, val, fn) {
  const x = el("select");
  opts.forEach(([l, v]) => x.add(new Option(l, v)));
  x.value = val;
  x.onchange = () => fn(x.value);
  return x;
}
export function num(min, max, val, fn) {
  const x = Object.assign(el("input"), { type: "number", min, max, value: val });
  x.onchange = () => fn(Math.max(min, Math.min(max, +x.value || 0)));
  return x;
}
/** A labelled slider that shows its value; fn gets numbers while dragging. */
export function rngL(name, min, max, val, fn, fmt = (v) => v) {
  const l = el("label", "rng"), x = el("input"), sp = el("span", "", `${name} ${fmt(val)}`);
  x.type = "range"; x.min = min; x.max = max; x.value = val;
  x.oninput = () => { fn(+x.value); sp.textContent = `${name} ${fmt(+x.value)}`; };
  l.append(sp, x);
  l.set = (v) => { x.value = v; sp.textContent = `${name} ${fmt(v)}`; };
  return l;
}
export function link(text, href) {
  const a = el("a", "ext", text);
  a.href = href; a.target = "_blank"; a.rel = "noopener noreferrer";
  return a;
}

/** Size a canvas for the device pixel ratio and return its 2D context in CSS pixels. */
export function fit(c, w, h) {
  const d = window.devicePixelRatio || 1;
  w = Math.max(1, w | 0); h = Math.max(1, h | 0);
  if (c._w !== w || c._h !== h) { c.width = w * d; c.height = h * d; c.style.width = w + "px"; c.style.height = h + "px"; c._w = w; c._h = h; }
  const x = c.getContext("2d");
  x.setTransform(d, 0, 0, d, 0, 0);
  return x;
}

export function download(blob, name) {
  if (!blob?.size) return false;
  const url = URL.createObjectURL(blob), a = Object.assign(document.createElement("a"), { href: url, download: name });
  a.style.display = "none"; document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
  return true;
}

/** Ignore global shortcuts while the user types. */
export const typing = (e) => /INPUT|SELECT|TEXTAREA/.test(e.target.tagName) && !["range", "checkbox"].includes(e.target.type);
/** Any form field has focus (stricter than `typing`: sliders keep their arrow keys). */
export const inField = (e) => /INPUT|SELECT|TEXTAREA/.test(e.target.tagName);
