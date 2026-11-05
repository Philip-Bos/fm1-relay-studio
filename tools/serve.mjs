// Zero-dependency static server for local development: `npm start` (PORT=4173 by default).
// Web MIDI and audio input need a secure context, and http://localhost counts as one.

import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, join, normalize, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const port = Number(process.env.PORT) || 4173;
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".mjs": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml", ".json": "application/json", ".png": "image/png", ".md": "text/markdown" };

createServer(async (req, res) => {
  try {
    let path = normalize(decodeURIComponent(new URL(req.url, "http://x").pathname));
    if (path.endsWith("/")) path += "index.html";
    const file = join(root, path);
    if (!file.startsWith(root)) throw new Error("outside root");
    if (!(await stat(file)).isFile()) throw new Error("not a file");
    res.writeHead(200, { "content-type": (TYPES[extname(file)] || "application/octet-stream") + "; charset=utf-8", "cache-control": "no-store" });
    res.end(await readFile(file));
  } catch {
    res.writeHead(404, { "content-type": "text/plain" });
    res.end("not found");
  }
}).listen(port, "127.0.0.1", () => console.log(`FM-1 Relay Studio on http://localhost:${port}`));
