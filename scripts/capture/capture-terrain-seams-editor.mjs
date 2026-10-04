// Actual packaged editor + SQLite host: UI input, save/reload, no source-module imports.
import { chromium } from 'playwright';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { createHash } from 'node:crypto';
import { PNG } from 'pngjs';
import { startEditorScreencast } from './editor-screencast.mjs';

const folder = resolve(process.env.TERRAIN_QA_PROJECT ?? '.vite-cache/terrain-seams/project');
const out = resolve('verify-shots/terrain-seams/editor'); mkdirSync(out, { recursive: true });
const snapshot = () => {
  const db = new DatabaseSync(resolve(folder, 'project.sqlite'), { readOnly: true });
  try {
    const row = db.prepare('select project_id,revision from project where id=1').get();
    const maps = Object.fromEntries(db.prepare('select map_id,map_json from maps').all().map(r => [r.map_id, JSON.parse(r.map_json)]));
    return { ...row, maps, sha: Object.fromEntries(Object.entries(maps).map(([id, m]) => [id, createHash('sha256').update(JSON.stringify(m)).digest('hex')])) };
  } finally { db.close(); }
};
const waitSaved = async predicate => {
  for (let i = 0; i < 100; i++) { const s = snapshot(); if (predicate(s)) return s; await new Promise(r => setTimeout(r, 150)); }
  throw Error('Canonical SQLite save did not reach the expected state');
};
const assert = (ok, why) => { if (!ok) throw Error(why); };
const browser = await chromium.launch({ args: ['--no-proxy-server', '--disable-background-networking', '--js-flags=--max-old-space-size=8192'] });
const page = await browser.newPage({ viewport: { width: 1440, height: 960 } });
const errors = [], proof = { realEditor: true, before: snapshot(), modelRun: '../assistant/summary.json' };
page.on('pageerror', e => errors.push(e.message));
let film;
const point = (x, y, lift = 0) => page.evaluate(({ x, y, lift }) => window.__oprnEditWorldToClient((x + .5) * 16, (y + .5 - lift) * 16), { x, y, lift });
const shot = name => page.screenshot({ path: resolve(out, `${name}.png`) });
const pixelHash = bytes => createHash('sha256').update(PNG.sync.read(bytes).data).digest('hex');
const selectMap = async id => {
  await page.getByTestId('sidebar-map-switcher').click();
  await page.getByTestId(`map-tree-node-${id}`).click();
  const close = page.getByTestId('sidebar-maps-close'); if (await close.isVisible().catch(() => false)) await close.click();
  await page.waitForTimeout(500);
};
try {
  await page.goto(process.env.TERRAIN_QA_URL ?? 'http://127.0.0.1:9854/', { waitUntil: 'domcontentloaded', timeout: 120000 });
  if (await page.locator('#access-code').count()) {
    await page.locator('#access-code').fill(readFileSync(resolve(folder, '.oprn-host-access'), 'utf8').trim());
    await Promise.all([page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 120000 }), page.locator('form[action="/__oprn/login"] button').click()]);
  }
  await page.getByTestId('boot-loader').waitFor({ state: 'hidden', timeout: 240000 });
  await page.waitForFunction(() => window.__oprnAiBridge?.status().ready && window.__oprnEditWorldToClient, null, { timeout: 120000 });
  const welcome = page.getByTestId('editor-welcome-skip'); if (await welcome.isVisible().catch(() => false)) await welcome.click();
  await selectMap('houses_native');
  await page.getByTestId('layer-upper').click();
  await page.getByTestId('editor-zoom-stepper').click(); await page.getByTestId('editor-zoom-0.25').click(); await page.waitForTimeout(1300);
  await shot('01-original-houses');
  film = await startEditorScreencast(page, out, 'terrain-seams-editor-2x.mp4', { selector: 'body', cropTop: 0, speed: 2 });
  await film.caption('실제 AI 결과 · 원본 탑 저택 / 박공 통나무집 / 옆날개 판자집'); await page.waitForTimeout(1800);
  await page.getByTestId('layer-relief').first().click(); await page.getByTestId('terrain-tool-house').click();
  const family = page.getByTestId('quick-house-family'), catalog = page.getByTestId('quick-house-catalog');
  proof.families = {};
  for (const f of ['house', 'manor', 'timber']) {
    await family.selectOption(f); await page.waitForTimeout(500);
    proof.families[f] = await catalog.locator('option').count();
    if (f === 'manor') await catalog.selectOption('bd-manor-tower');
    await film.caption(`버들항 원본 ${f === 'house' ? '주택' : f === 'manor' ? '저택' : '목조집'} 선택`);
    if (f === 'manor') await shot('02-original-tower-selector');
  }
  await family.selectOption('house');
  const first = await page.getByTestId('quick-house-styles').locator('[data-house-kit]').first().getAttribute('data-house-kit');
  await page.getByRole('button', { name: '다음 외관', exact: true }).click();
  const second = await page.getByTestId('quick-house-styles').locator('[data-house-kit]').first().getAttribute('data-house-kit');
  assert(first !== second, 'Original catalog pagination did not change the visible kits'); proof.pagination = { first, second };
  await family.selectOption('assembly'); await page.getByTestId('quick-house-resize').selectOption('roof');
  proof.assemblyStyles = await page.getByTestId('quick-house-styles').locator('[data-house-style]').count();
  assert(proof.assemblyStyles === 6 && await page.getByTestId('quick-house-roof-width').isVisible(), 'Roof-only controls unavailable');
  await film.caption('크기 조절은 별도 선택 · 지붕만 넓히는 기능 유지'); await shot('03-roof-only-controls');

  await selectMap('ramps_four');
  await page.getByTestId('terrain-design-close').click(); await page.getByTestId('layer-lower').click(); await page.getByTestId('layer-relief').first().click();
  await page.getByTestId('terrain-tool-surface').click(); await page.getByTestId('terrain-width').selectOption('1'); await page.getByTestId('terrain-material').selectOption('stone');
  await page.waitForTimeout(1000); const p = await point(7, 7, 3);
  const clip = { x: Math.floor(p.x - 24), y: Math.floor(p.y - 24), width: 48, height: 48 };
  const baseline = await page.screenshot({ clip });
  proof.surfaceBefore = await page.evaluate(() => window.__oprnEditReliefStats());
  await page.mouse.click(p.x, p.y); await page.mouse.move(1400, 50); await page.waitForTimeout(1100);
  const painted = await waitSaved(s => s.sha.ramps_four !== proof.before.sha.ramps_four);
  const afterPaint = await page.screenshot({ clip }); writeFileSync(resolve(out, '04-painted-native-top.png'), afterPaint);
  proof.surfaceAfter = await page.evaluate(() => window.__oprnEditReliefStats());
  assert(pixelHash(baseline) !== pixelHash(afterPaint), 'Surface brush did not change the rendered cliff top');
  await page.evaluate(() => window.__oprnEditReliefRebuild()); await page.waitForTimeout(800);
  const rebuilt = await page.screenshot({ clip }); writeFileSync(resolve(out, '05-rebuilt-native-top.png'), rebuilt);
  proof.surfacePartialMatchesFull = pixelHash(afterPaint) === pixelHash(rebuilt);
  assert(proof.surfacePartialMatchesFull, 'Partial native ground refresh differs from a full rebuild');
  await film.caption('절벽 위 바닥 변경 · 즉시 갱신과 전체 재생성 화면 일치');
  await page.keyboard.press('Control+z'); await waitSaved(s => s.sha.ramps_four === proof.before.sha.ramps_four);

  await page.getByTestId('terrain-tool-road').click(); await page.getByTestId('terrain-design-width').selectOption('2');
  await page.getByTestId('terrain-design-close').click(); await page.waitForTimeout(500);
  const start = await point(12, 20), end = await point(12, 8, 3);
  await page.mouse.move(start.x, start.y); await page.mouse.down(); await page.mouse.move(end.x, end.y, { steps: 30 }); await page.mouse.up(); await page.mouse.move(1400, 50);
  const road = await waitSaved(s => s.sha.ramps_four !== proof.before.sha.ramps_four);
  const old = proof.before.maps.ramps_four, next = road.maps.ramps_four;
  const changed = next.relief.ramps.flatMap((v, i) => v && !old.relief.ramps[i] ? [{ x: i % next.width, y: Math.floor(i / next.width), code: v }] : []);
  proof.road = { width: 2, addedRampCells: changed, savedRevision: road.revision };
  assert(changed.length >= 8 && new Set(changed.map(c => c.x)).size === 2, 'Width-two road did not create a complete two-lane ramp');
  await film.caption('폭 2칸 도로 · 드래그로 두 줄 경사로 자동 연결'); await shot('06-width-two-road'); await page.waitForTimeout(1400);
  await page.keyboard.press('Control+z'); await waitSaved(s => s.sha.ramps_four === proof.before.sha.ramps_four);
  await selectMap('houses_native'); await page.getByTestId('layer-upper').click(); await page.waitForTimeout(800);
  proof.film = await film.stop(); film = null;
  await page.reload({ waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.getByTestId('boot-loader').waitFor({ state: 'hidden', timeout: 240000 });
  proof.after = snapshot(); proof.mapUnchanged = Object.keys(proof.before.sha).every(id => proof.before.sha[id] === proof.after.sha[id]);
  proof.errors = errors; proof.passed = proof.mapUnchanged && proof.surfacePartialMatchesFull && !errors.length;
  assert(proof.passed, 'Editor QA or restoration failed');
} catch (e) {
  proof.failure = e.message; await shot('failure').catch(() => {}); if (film) await film.stop().catch(() => {}); throw e;
} finally {
  delete proof.before.maps; if (proof.after) delete proof.after.maps;
  writeFileSync(resolve(out, 'observations.json'), JSON.stringify(proof, null, 2)); await browser.close();
}
console.log(JSON.stringify(proof));
