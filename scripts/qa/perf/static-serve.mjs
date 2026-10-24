// 측정용 정적 서버. 실제 호스트처럼 한 폴더를 그대로 내보낸다(대체 루트 없음 — 빠진 파일은 404).
//   node scripts/qa/perf/static-serve.mjs <root>[,<root2>...] <port> [--gzip]
// 루트를 쉼표로 여럿 주면 앞에서부터 찾는다(편집기 호스트처럼 dist/export-player 위에 dist·public 을 겹칠 때).
// --gzip: Accept-Encoding 에 gzip 이 있으면 텍스트(html·js·css·json·svg)를 gzip 으로 보낸다(정적 호스트 대부분의 기본값).
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { resolve, extname, sep } from "node:path";
import { gzipSync } from "node:zlib";

const [rootArg, port] = process.argv.slice(2);
const roots = rootArg.split(",").map((r) => resolve(r));
const gzip = process.argv.includes("--gzip");
const mime = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".json": "application/json",
  ".png": "image/png", ".webp": "image/webp", ".jpg": "image/jpeg", ".gif": "image/gif", ".svg": "image/svg+xml",
  ".woff2": "font/woff2", ".ttf": "font/ttf", ".ogg": "audio/ogg", ".mp3": "audio/mpeg", ".wav": "audio/wav", ".m4a": "audio/mp4", ".webm": "video/webm", ".mp4": "video/mp4" };
const compressible = new Set([".html", ".js", ".css", ".json", ".svg"]);
const gzCache = new Map();
createServer(async (req, res) => {
  let name;
  try { name = decodeURIComponent(new URL(req.url, "http://x").pathname).replace(/^\/+/, ""); } catch { res.writeHead(400).end(); return; }
  if (name === "") name = "player.html";
  let path = null, st = null;
  for (const root of roots) {
    const candidate = resolve(root, name);
    if (!candidate.startsWith(root + sep)) continue;
    try { const info = await stat(candidate); if (info.isFile()) { path = candidate; st = info; break; } } catch { /* next root */ }
  }
  try {
    if (!path) throw new Error("not found");
    const ext = extname(path).toLowerCase();
    const type = mime[ext] ?? "application/octet-stream";
    if (gzip && compressible.has(ext) && /\bgzip\b/.test(req.headers["accept-encoding"] ?? "")) {
      let body = gzCache.get(path);
      if (!body) { body = gzipSync(await readFile(path), { level: 6 }); gzCache.set(path, body); }
      res.writeHead(200, { "content-type": type, "content-encoding": "gzip", "content-length": body.length, vary: "accept-encoding" });
      res.end(body);
      return;
    }
    res.writeHead(200, { "content-type": type, "content-length": st.size });
    res.end(await readFile(path));
  } catch { res.writeHead(404).end(); }
}).listen(Number(port), "127.0.0.1", () => console.log(`static ${roots.join(",")} on :${port}${gzip ? " (gzip)" : ""}`));
