// 출하 플레이어(player.html)로 게임을 실제로 켜서 맵마다 필드 화면을 찍는다 — HUD · 목표 줄 · 주인공이 플레이어가 보는 그대로 나온다(맵 렌더에는 없다).
//   node hudShots.mjs --project-dir <프로젝트 폴더> --out <폴더> --spots <spots.json> --player-root <dist/export-player 가 있는 체크아웃>
// 길: 타이틀 → 새 게임 → 오프닝 글을 넘김 → 첫 필드(시작 맵) → 나머지 맵은 같은 세션에서 계측 훅(__oprnDebug.teleport)으로 옮겨 찍는다.
// 그래서 목표 줄은 «게임이 처음 세운 목표»다 — 시작 맵이 아닌 화면에서는 목표 글이 그 자리에 맞는지 판정하지 않는다(검수자에게도 그렇게 알린다).
// 계측 표식(.runtime-debug-*)은 실제 화면에 없는 것이라 가리고 찍는다.
import { spawn } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { firefox } from 'playwright';

const argv = process.argv.slice(2);
const option = name => { const i = argv.indexOf(`--${name}`); return i >= 0 ? argv[i + 1] : undefined; };
const projectDir = resolve(option('project-dir') ?? ''), out = resolve(option('out') ?? ''), playerRoot = resolve(option('player-root') ?? '.');
const spots = JSON.parse(readFileSync(resolve(option('spots') ?? ''), 'utf8'));
mkdirSync(out, { recursive: true });

const server = spawn('node', [resolve(playerRoot, 'src/harnesses/assistant-capability/node/wholeGamePlayer.mjs'), '--project-dir', projectDir, '--out', resolve(out, 'player'), '--serve'], { cwd: playerRoot, stdio: ['ignore', 'pipe', 'pipe'] });
let stderr = '';
server.stderr.on('data', chunk => { stderr += chunk; });
const ready = await new Promise((done, fail) => {
  let buffer = '';
  const timer = setTimeout(() => fail(new Error(`플레이어 서버가 2분 안에 뜨지 않았다: ${stderr.slice(-400)}`)), 120_000);
  server.stdout.on('data', chunk => { buffer += chunk; const line = buffer.split('\n').find(text => text.startsWith('{"playUrl"')); if (line) { clearTimeout(timer); done(JSON.parse(line)); } });
  server.once('exit', code => { clearTimeout(timer); fail(new Error(`플레이어 서버가 끝났다(code ${code}): ${stderr.slice(-400)}`)); });
});
const rows = [];
const browser = await firefox.launch({ firefoxUserPrefs: { 'network.notify.changed': false, 'network.captive-portal-service.enabled': false, 'network.connectivity-service.enabled': false } });
try {
  const page = await (await browser.newContext({ viewport: { width: 960, height: 720 } })).newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(boot => { localStorage.clear(); window.__OPENRPG_BOOT__ = { ...boot, qaInstrumentation: true }; }, ready.boot);
  await page.goto(ready.playUrl, { waitUntil: 'domcontentloaded', timeout: 120_000 });
  await page.waitForSelector('[data-testid="title-screen"]', { timeout: 60_000 }).catch(() => {});
  await page.waitForTimeout(4000);
  await page.screenshot({ path: resolve(out, 'title.png') });
  const visible = selector => page.evaluate(sel => { const node = document.querySelector(sel); if (!node) return false; const box = node.getBoundingClientRect(), style = getComputedStyle(node); return box.width > 0 && box.height > 0 && style.visibility !== 'hidden' && style.display !== 'none' && Number(style.opacity) > 0.05; }, selector).catch(() => false);
  const state = () => page.evaluate(() => { const s = window.__oprnDebug?.readState?.(); return s ? { map: s.currentMapId, x: s.x, y: s.y } : null; }).catch(() => null);
  // 새 게임 → 오프닝: 타이틀이 걷히고 대사창이 세 번 잇달아 안 보일 때까지 확인 키를 누른다(최대 80번).
  let quiet = 0, presses = 0;
  for (; presses < 80 && quiet < 3; presses += 1) {
    // 오프닝 그림 연속(.cinematic-sequence)은 플레이어처럼 Esc 로 넘긴다(빨리 감기 — 장면이 주는 것은 그대로 받는다).
    const cinematic = await visible('.cinematic-sequence') || await visible('.cinematic-skip-hint');
    const busy = cinematic || await visible('[data-testid="title-screen"]') || await visible('[data-testid="dialogue-box"]') || !(await state());
    if (busy) { quiet = 0; await page.keyboard.press(cinematic ? 'Escape' : 'Enter'); } else quiet += 1;
    await page.waitForTimeout(1300);
  }
  await page.addStyleTag({ content: '.runtime-debug-marker,.runtime-debug-panel,[data-testid="runtime-debug-panel"]{display:none !important}' }).catch(() => {});
  const chipText = () => page.evaluate(() => document.querySelector('[data-testid="zone-feedback-objective"]')?.textContent ?? null).catch(() => null);
  const shoot = async spot => {
    await page.waitForTimeout(spot.start ? 5000 : 3500); // 목표 카드(가운데 잠깐)·맵 이름이 걷히길 기다린다
    const file = resolve(out, `${spot.id}.png`);
    await page.screenshot({ path: file });
    const now = await state();
    rows.push({ ...spot, file, chip: await chipText(), state: now, onMap: now?.map === spot.mapId, dialogueOpen: await visible('[data-testid="dialogue-box"]'), openingPresses: presses });
    console.log(JSON.stringify({ id: spot.id, state: now, onMap: now?.map === spot.mapId }));
  };
  const first = spots.find(spot => spot.start);
  if (first) await shoot(first);
  for (const spot of spots.filter(item => !item.start)) {
    const ok = await page.evaluate(([mapId, x, y]) => { const debug = window.__oprnDebug; if (!debug?.teleport) return false; debug.teleport(mapId, x, y); return true; }, [spot.mapId, spot.x, spot.y]).catch(() => false);
    if (!ok) { rows.push({ ...spot, file: null, error: '계측 훅 teleport 가 없다' }); continue; }
    await shoot(spot);
  }
  writeFileSync(resolve(out, 'shots.json'), JSON.stringify({ rows, errors: errors.slice(0, 10) }, null, 1));
} finally {
  await browser.close().catch(() => {});
  server.kill('SIGTERM');
}
