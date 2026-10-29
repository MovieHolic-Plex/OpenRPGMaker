#!/usr/bin/env node
// Static server for a frozen dist (SPA fallback to index.html) or for a framework fixture.
//   node scripts/qa/hig-ux/serve-baseline.mjs --dir /home/main/hig-ux-1027/baseline-dist --port 9881
//   node scripts/qa/hig-ux/serve-baseline.mjs --fixture planted-defects --port 9890
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { HERE, parseArgs } from './lib.mjs';

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css',
  '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.wasm': 'application/wasm',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.webp': 'image/webp',
  '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.woff': 'font/woff', '.woff2': 'font/woff2', '.ttf': 'font/ttf',
  '.otf': 'font/otf', '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg', '.wav': 'audio/wav', '.mid': 'audio/midi',
  '.mp4': 'video/mp4', '.webm': 'video/webm', '.txt': 'text/plain; charset=utf-8', '.md': 'text/markdown; charset=utf-8',
};

export function fixtureDir(name) {
  const dir = path.join(HERE, 'fixtures', name);
  if (!fs.existsSync(path.join(dir, 'index.html'))) throw new Error(`unknown fixture ${name} (${dir})`);
  return dir;
}

/** Start a static server; resolves {server, url}. port 0 picks a free port. */
export function serveDir(dir, { port = 0, host = '127.0.0.1' } = {}) {
  const root = path.resolve(dir);
  const index = path.join(root, 'index.html');
  const server = http.createServer((req, res) => {
    let rel;
    try {
      rel = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    } catch {
      res.writeHead(400).end();
      return;
    }
    let file = path.join(root, rel);
    if (!file.startsWith(root)) {
      res.writeHead(403).end();
      return;
    }
    if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
    if (!fs.existsSync(file)) {
      if (path.extname(rel)) {
        res.writeHead(404).end();
        return;
      }
      file = index;
    }
    res.writeHead(200, { 'content-type': MIME[path.extname(file).toLowerCase()] ?? 'application/octet-stream', 'cache-control': 'no-store' });
    fs.createReadStream(file).pipe(res);
  });
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, host, () => resolve({ server, url: `http://${host}:${server.address().port}/` }));
  });
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = parseArgs(process.argv.slice(2), { dir: 'str', fixture: 'str', port: 'str', host: 'str' });
  if (!args.dir === !args.fixture) {
    console.error('usage: serve-baseline.mjs (--dir <dist> | --fixture <name>) [--port N] [--host H]');
    process.exit(2);
  }
  const dir = args.fixture ? fixtureDir(args.fixture) : args.dir;
  if (!fs.existsSync(path.join(dir, 'index.html'))) {
    console.error(`no index.html in ${dir}`);
    process.exit(2);
  }
  const { url } = await serveDir(dir, { port: Number(args.port ?? 0), host: args.host ?? '127.0.0.1' });
  console.log(`serving ${dir} at ${url}`);
}
