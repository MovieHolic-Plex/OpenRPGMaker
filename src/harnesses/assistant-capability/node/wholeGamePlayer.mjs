// Play a whole-game SQLite project in the compiled shipped player (dist/export-player/player.html + export shim).
//   node src/harnesses/assistant-capability/node/wholeGamePlayer.mjs --project-dir <dir> --out <evidence dir> [--serve] [--smoke]
// Reads the canonical project.sqlite read-only (writeRuntimeProject), projects it with the product
// prepareWebExport, and serves player.html. Uploaded assets are served from the canonical assets/
// folder after a SHA check; missing ones are 404 + receipt, never substituted.
//   --serve : keep the server up and print the URL (for a judge driving their own browser)
//   --smoke : open Firefox, title -> new game -> first field, save PNGs + page errors
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { createServer } from 'node:http';
import { firefox } from 'playwright';
import { writeRuntimeProject } from './editorDriver.mjs';
import { withTsModule } from '../../../../scripts/ontology-ts-loader.mjs';
import { startPackagedPlayerQaServer } from '../../../../scripts/lib/packagedPlayerQaServer.mjs';

const argv = process.argv.slice(2);
const option = name => { const i = argv.indexOf(`--${name}`); return i >= 0 ? argv[i + 1] : undefined; };
const projectDir = resolve(option('project-dir') ?? '');
const out = resolve(option('out') ?? '');
if (!option('project-dir') || !option('out')) throw Error('wholeGamePlayer --project-dir <dir> --out <dir> [--serve] [--smoke]');
mkdirSync(out, { recursive: true });
const live = resolve(out, 'live.json');
writeRuntimeProject(projectDir, live);
const project = JSON.parse(readFileSync(live, 'utf8'));
let prepared;
await withTsModule(resolve('src/project/webExport.ts'), 'whole-game-export.mjs', async module => { prepared = module.prepareWebExport(project); });
writeFileSync(resolve(out, 'player.json'), prepared.projectJson);
writeFileSync(resolve(out, 'export-summary.json'), JSON.stringify(prepared.summary, null, 2));
const uploaded = new Map(prepared.assets.filter(a => a.kind === 'uploaded').map(a => [`/${a.zipPath}`, a.asset]));
const receipts = [];
const inner = await startPackagedPlayerQaServer({ projectJson: prepared.projectJson });
// Front server: uploaded assets from canonical files, everything else proxied to the packaged player server.
const front = createServer((req, res) => { void (async () => {
  const path = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  const asset = uploaded.get(path);
  if (asset) {
    const ref = asset.ref;
    try {
      const body = ref ? readFileSync(resolve(projectDir, 'assets', `${ref.sha256}.${ref.extension}`)) : null;
      const sha = body ? createHash('sha256').update(body).digest('hex') : null;
      const valid = Boolean(body?.length) && sha === ref?.sha256;
      receipts.push({ assetId: asset.id, expected: ref?.sha256, actual: sha, valid });
      if (valid) { res.writeHead(200, { 'content-type': ref.mime ?? 'application/octet-stream' }).end(body); return; }
    } catch { receipts.push({ assetId: asset.id, missing: true }); }
    res.writeHead(404).end('canonical uploaded asset unavailable'); return;
  }
  const upstream = await fetch(inner.url + req.url);
  res.writeHead(upstream.status, { 'content-type': upstream.headers.get('content-type') ?? 'application/octet-stream' });
  res.end(Buffer.from(await upstream.arrayBuffer()));
})().catch(() => res.writeHead(500).end()); });
await new Promise(done => front.listen(0, '127.0.0.1', done));
const url = `http://127.0.0.1:${front.address().port}`;
const playUrl = `${url}/player.html`;
const boot = { projectUrl: `${url}/__runtime-qa/project.json`, saveNamespace: `whole-game:${project.meta?.title ?? 'game'}` };
writeFileSync(resolve(out, 'player-url.json'), JSON.stringify({ playUrl, boot, note: 'set window.__OPENRPG_BOOT__ = boot before load (addInitScript), as scripts/lib/runtimeQaRun.mjs does' }, null, 2));
console.log(JSON.stringify({ playUrl, boot, summary: prepared.summary }));

if (argv.includes('--smoke')) {
  const browser = await firefox.launch({ firefoxUserPrefs: { 'network.notify.changed': false, 'network.captive-portal-service.enabled': false, 'network.connectivity-service.enabled': false } });
  const page = await (await browser.newContext({ viewport: { width: 960, height: 720 } })).newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message)); page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  await page.addInitScript(b => { localStorage.clear(); window.__OPENRPG_BOOT__ = { ...b, qaInstrumentation: true }; }, boot);
  await page.goto(playUrl, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.waitForTimeout(8000); await page.screenshot({ path: resolve(out, 'smoke-1-title.png') });
  await page.keyboard.press('Enter'); await page.waitForTimeout(6000); await page.screenshot({ path: resolve(out, 'smoke-2-after-new-game.png') });
  for (let i = 0; i < 12; i++) { await page.keyboard.press('Enter'); await page.waitForTimeout(1500); }
  await page.screenshot({ path: resolve(out, 'smoke-3-after-opening.png') });
  writeFileSync(resolve(out, 'smoke-errors.json'), JSON.stringify(errors, null, 2));
  await browser.close();
}
if (!argv.includes('--serve')) {
  writeFileSync(resolve(out, 'asset-receipts.json'), JSON.stringify(receipts, null, 2));
  front.close(); await inner.close();
} else {
  process.on('SIGTERM', () => { writeFileSync(resolve(out, 'asset-receipts.json'), JSON.stringify(receipts, null, 2)); process.exit(0); });
}
