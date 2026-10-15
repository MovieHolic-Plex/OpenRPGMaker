/** Real renderer + CSS capture of the bundled trainer sprites (public/assets/battle-trainers) beside monsters.
 *  Static server over public/, no app/canonical/server. Usage: node scripts/qa/runtime/emerald-trainer-bundled.mjs <outDir> [opp=fisher hero=hero_m]
 */
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import { chromium } from 'playwright';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const out = path.resolve(process.argv[2] ?? 'qa-runs/trainer-bundled'); fs.mkdirSync(out, { recursive: true });
const pairs = (process.argv[3] ?? 'fisher:hero_m,gym_water:hero_f,punk:hero_m,elder:hero_f').split(',').map(s => s.split(':'));
const entry = path.join(out, 'entry.ts');
fs.writeFileSync(entry, `import {mountEmeraldTrainerIntro} from ${JSON.stringify(path.join(root, 'src/player/emeraldTrainerIntro.ts'))}; Object.assign(window,{trainerProbe:{mountEmeraldTrainerIntro}});`);
await build({ entryPoints: [entry], outfile: path.join(out, 'probe.js'), bundle: true, platform: 'browser', format: 'iife', tsconfig: path.join(root, 'tsconfig.app.json'), logLevel: 'silent',
  plugins: [{ name: 'fixture-resource-boundary', setup(b) {
    b.onResolve({ filter: /generatedAssetResourceResolver$/ }, () => ({ path: 'fixture-resolver', namespace: 'probe' }));
    b.onLoad({ filter: /.*/, namespace: 'probe' }, () => ({ contents: 'export function resolveAssetResourceUrl(){return null}', loader: 'js' }));
  } }] });
const server = http.createServer((req, res) => {
  if (req.url.startsWith('/_qa.html')) { res.writeHead(200, { 'content-type': 'text/html' }); res.end('<!doctype html><main id="host" style="display:flex;gap:16px;flex-wrap:wrap;background:#222;padding:8px"></main>'); return; }
  const p = path.join(root, 'public', decodeURIComponent(req.url.split('?')[0]));
  if (!p.startsWith(path.join(root, 'public')) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'content-type': p.endsWith('.json') ? 'application/json' : 'image/png' }); res.end(fs.readFileSync(p));
}).listen(0);
const port = server.address().port;
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1000, height: 760 }, reducedMotion: 'reduce' }); const errors = [];
page.on('pageerror', e => errors.push(String(e)));
try {
  await page.goto(`http://127.0.0.1:${port}/_qa.html`);
  const css = fs.readFileSync(path.join(out, 'probe.css'), 'utf8');
  await page.addStyleTag({ content: '.battle-scene{position:relative;width:480px;height:320px;background:#e0e8b0 url(/assets/emerald-monster/battle/grass.png) 0 0/480px 240px no-repeat;image-rendering:pixelated}.mon{position:absolute;image-rendering:pixelated;width:128px;height:128px}' + css });
  await page.addScriptTag({ path: path.join(out, 'probe.js') });
  const res = await page.evaluate(async ({ pairs, base }) => {
    const { mountEmeraldTrainerIntro } = window.trainerProbe; const wait = ms => new Promise(r => setTimeout(r, ms)); const rows = [];
    for (const [opp, hero] of pairs) {
      const project = { database: { troops: [{ id: 't', trainerBattle: true, trainerSprite: { front: opp, back: hero } }] }, maps: {}, assets: { uploaded: {} } };
      const root = document.createElement('div'); root.className = 'battle-scene'; root.dataset.monsterStyle = 'emerald';
      const rewrite = u => u.startsWith('/') ? base + u : u;
      document.querySelector('#host').append(root);
      const c = mountEmeraldTrainerIntro(root, project, { currentMapId: 'x', switches: {}, variables: {}, selfSwitches: {} }, { troopId: 't', eventState: { switches: {}, variables: {}, selfSwitches: {} } });
      c.sync({ step: 'intro', trainerIntroduction: true });
      for (let i = 0; i < 80 && !root.dataset.emeraldTrainerIntro; i++) await wait(25);
      // 같은 줄 비교용 몬스터: 캠페인(64 -> 2배)·하네스(112 -> 128)
      const m1 = Object.assign(document.createElement('img'), { className: 'mon', src: '/assets/monster-expedition/creatures/brambleboar-front.png' }); m1.style.cssText = 'left:0;top:246px;width:64px;height:64px';
      const m2 = Object.assign(document.createElement('img'), { className: 'mon', src: '/assets/harnesses/monster-collect-species/sparkit/front.png' }); m2.style.cssText = 'left:90px;top:246px;width:72px;height:72px';
      root.append(m1, m2);
      const imgs = [...root.querySelectorAll('.emerald-trainer-intro img')];
      rows.push({ opp, hero, shown: !!root.dataset.emeraldTrainerIntro, imgs: imgs.map(i => ({ cls: i.className, nat: [i.naturalWidth, i.naturalHeight], css: [i.width, i.height], scale: i.dataset.portraitScale, profile: i.dataset.portraitProfile })) });
    }
    return rows;
  }, { pairs, base: `http://127.0.0.1:${port}` });
  if (errors.length) throw Error(errors.join(';'));
  await page.screenshot({ path: path.join(out, 'bundled-trainers.png') });
  fs.writeFileSync(path.join(out, 'record.json'), JSON.stringify(res, null, 2));
  console.log(JSON.stringify(res));
} finally { await browser.close(); server.close(); }
