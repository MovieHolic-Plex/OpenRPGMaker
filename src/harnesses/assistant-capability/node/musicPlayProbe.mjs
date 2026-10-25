// Check that store music the assistant wired actually plays in the shipped player (store-music test, openwiki/asset-store.md).
//   node src/harnesses/assistant-capability/node/musicPlayProbe.mjs --play-url <player.html url> --boot <player-url.json> --out <dir>
//     [--title] [--map <mapId>:<x>:<y>] [--event <mapId>:<x>:<y>:<face>]
// Start the player first: wholeGamePlayer.mjs --project-dir <dir> --out <dir> --serve (it serves uploaded audio from the canonical assets/
// folder after a SHA check). This probe records every <audio> the page starts and, a few seconds later, which ones are really
// advancing (not paused, currentTime > 0, no media error). The engine's own request log (__oprnAudioObserved) only proves a request.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { firefox } from 'playwright';

const argv = process.argv.slice(2);
const option = name => { const i = argv.indexOf(`--${name}`); return i >= 0 ? argv[i + 1] : undefined; };
const all = name => argv.flatMap((value, i) => argv[i - 1] === `--${name}` ? [value] : []);
const out = resolve(option('out') ?? 'music-probe');
mkdirSync(out, { recursive: true });
const { playUrl, boot } = JSON.parse(readFileSync(resolve(option('boot')), 'utf8'));
const sleep = ms => new Promise(done => setTimeout(done, ms));

const browser = await firefox.launch({ firefoxUserPrefs: { 'media.autoplay.default': 0, 'media.autoplay.blocking_policy': 0,
  'network.notify.changed': false, 'network.captive-portal-service.enabled': false, 'network.connectivity-service.enabled': false } });
const page = await (await browser.newContext({ viewport: { width: 960, height: 720 } })).newPage();
const errors = [];
page.on('pageerror', e => errors.push(e.message.slice(0, 300)));
await page.addInitScript(b => {
  localStorage.clear();
  window.__OPENRPG_BOOT__ = { ...b, qaInstrumentation: true };
  const seen = window.__probeAudio = [];
  const play = HTMLMediaElement.prototype.play;
  HTMLMediaElement.prototype.play = function (...args) { if (!seen.includes(this)) seen.push(this); return play.apply(this, args); };
}, boot);

async function playing(label) {
  await sleep(4000);
  const rows = await page.evaluate(() => (window.__probeAudio ?? []).map(a => ({
    src: decodeURIComponent(String(a.currentSrc || a.src).replace(/^.*?\/\/[^/]+/u, '')).slice(0, 160), paused: a.paused, t: Number(a.currentTime.toFixed(2)),
    loop: a.loop, error: a.error ? a.error.code : null, volume: a.volume })));
  await sleep(1500);
  const later = await page.evaluate(() => (window.__probeAudio ?? []).map(a => Number(a.currentTime.toFixed(2))));
  const tracks = rows.map((row, i) => ({ ...row, advancing: !row.paused && later[i] > row.t && !row.error }));
  const observed = await page.evaluate(() => [...(window.__oprnAudioObserved ?? [])]);
  const state = await page.evaluate(() => { const s = window.__oprnDebug?.readState?.(); return s ? { mapId: s.currentMapId, x: s.x, y: s.y, battle: s.battleResult ?? null } : null; });
  await page.screenshot({ path: resolve(out, `${label}.png`) });
  return { label, state, observed, tracks };
}

const steps = [];
await page.goto(playUrl, { waitUntil: 'domcontentloaded', timeout: 120000 });
await sleep(7000);
await page.mouse.click(480, 360); // user gesture: the engine unlocks audio on the first input
if (argv.includes('--title')) steps.push(await playing('title'));
await page.keyboard.press('Enter'); await sleep(5000);
for (let i = 0; i < 6 && !(await page.evaluate(() => Boolean(window.__oprnDebug?.readState))); i++) { await page.keyboard.press('Enter'); await sleep(1500); }
steps.push(await playing('start-map'));
for (const spec of all('map')) {
  const [mapId, x, y] = spec.split(':');
  await page.evaluate(([m, px, py]) => window.__oprnDebug.teleport(m, Number(px), Number(py)), [mapId, x, y]);
  steps.push(await playing(`map-${mapId}`));
}
for (const spec of all('event')) {
  const [mapId, x, y, face] = spec.split(':');
  await page.evaluate(([m, px, py]) => window.__oprnDebug.teleport(m, Number(px), Number(py)), [mapId, x, y]);
  await sleep(1500);
  await page.evaluate(f => { window.__oprnInput?.face(f); window.__oprnInput?.action(); }, face);
  for (let i = 0; i < 4; i++) { await sleep(1200); await page.keyboard.press('Enter'); }
  steps.push(await playing(`event-${mapId}-${x}-${y}`));
}
writeFileSync(resolve(out, 'music-probe.json'), JSON.stringify({ playUrl, steps, errors }, null, 2));
console.log(JSON.stringify(steps.map(s => ({ label: s.label, map: s.state?.mapId, observed: s.observed.slice(-3), advancing: s.tracks.filter(t => t.advancing).map(t => t.src) })), null, 1));
await browser.close();
