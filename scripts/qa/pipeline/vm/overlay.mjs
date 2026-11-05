#!/usr/bin/env node
// Mirror overlay for QA sessions. Serves game builds ONLY from the local mirror cache and never talks to a
// production host itself: a cache miss is forwarded to the caching mirror (127.0.0.1:7811), which owns the
// one-time fill. A planted variant is addressed as /<slug>/<version>~<plant>/... — project.json comes from
// plants/<slug>@<version>~<plant>.json, every other path falls through to the unplanted build.
//
// usage: node vm/overlay.mjs --cache /root/vqa-sinkiru/mirror --plants <dir> --port 7812 --log <requests.jsonl>
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { parseArgs } from "node:util";

const { values } = parseArgs({
  options: {
    cache: { type: "string", default: "/root/vqa-sinkiru/mirror" },
    plants: { type: "string", default: "" },
    port: { type: "string", default: "7812" },
    upstream: { type: "string", default: "http://127.0.0.1:7811" },
    log: { type: "string", default: "" },
  },
});

const MIME = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".mjs": "text/javascript", ".css": "text/css",
  ".json": "application/json", ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp",
  ".svg": "image/svg+xml", ".mp3": "audio/mpeg", ".ogg": "audio/ogg", ".wav": "audio/wav", ".woff2": "font/woff2",
  ".woff": "font/woff", ".ttf": "font/ttf", ".wasm": "application/wasm",
};
const stats = { served: 0, planted: 0, upstream: 0, notFound: 0, refused: 0, negativeHits: 0 };
// Paths the mirror answered 404 for are remembered, so a missing asset asked by 100 sessions reaches the
// caching mirror (and through it the origin) once, not 100 times.
const missing = new Set();
const logLine = (row) => { if (values.log) fs.appendFileSync(values.log, JSON.stringify({ t: Date.now(), ...row }) + "\n"); };

/** /fallen-star/1.37~p1/assets/x.js -> { slug, version, plant, rest } ; anything else -> null */
function route(urlPath) {
  const m = /^\/([a-z0-9-]+)\/(\d+\.\d+)(?:~([a-z0-9-]+))?(\/.*)?$/.exec(urlPath);
  if (!m) return null;
  return { slug: m[1], version: m[2], plant: m[3] ?? null, rest: m[4] ?? "/" };
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, "http://overlay");
  if (url.pathname === "/health") {
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify(stats));
    return;
  }
  const r = route(decodeURIComponent(url.pathname));
  if (!r || r.rest.includes("..")) {
    stats.refused += 1;
    logLine({ kind: "refused", path: url.pathname });
    res.writeHead(404);
    res.end("not a mirrored game path");
    return;
  }
  const rel = r.rest === "/" ? "/index.html" : r.rest;
  if (r.plant && rel === "/project.json") {
    const file = path.join(values.plants, `${r.slug}@${r.version}~${r.plant}.json`);
    if (fs.existsSync(file)) {
      stats.planted += 1;
      res.writeHead(200, { "content-type": "application/json", "access-control-allow-origin": "*" });
      fs.createReadStream(file).pipe(res);
      return;
    }
  }
  const file = path.join(values.cache, r.slug, r.version, rel);
  if (fs.existsSync(file) && fs.statSync(file).isFile()) {
    stats.served += 1;
    res.writeHead(200, { "content-type": MIME[path.extname(file)] ?? "application/octet-stream", "access-control-allow-origin": "*" });
    fs.createReadStream(file).pipe(res);
    return;
  }
  // Cache miss: the caching mirror fetches once from the origin and stores it. Sessions never leave the VM.
  const key = `${r.slug}/${r.version}${rel}`;
  if (missing.has(key)) {
    stats.negativeHits += 1;
    res.writeHead(404);
    res.end("not in mirror");
    return;
  }
  stats.upstream += 1;
  try {
    const up = await fetch(`${values.upstream}/${r.slug}/${r.version}${rel}`, { signal: AbortSignal.timeout(180000) });
    logLine({ kind: "upstream", path: `${r.slug}/${r.version}${rel}`, status: up.status });
    if (up.status !== 200) stats.notFound += 1;
    if (up.status === 404) missing.add(key);
    const buf = Buffer.from(await up.arrayBuffer());
    res.writeHead(up.status, { "content-type": up.headers.get("content-type") ?? "application/octet-stream", "access-control-allow-origin": "*" });
    res.end(buf);
  } catch (error) {
    stats.notFound += 1;
    logLine({ kind: "upstream-error", path: rel, error: String(error).slice(0, 120) });
    res.writeHead(502);
    res.end("upstream mirror error");
  }
});
server.listen(Number(values.port), "127.0.0.1", () => console.log(`overlay ready http://127.0.0.1:${values.port}`));
setInterval(() => logLine({ kind: "stats", ...stats }), 30000).unref();
