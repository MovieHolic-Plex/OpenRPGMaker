import fs from 'node:fs';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { chromium } from '@playwright/test';

const out = 'output/evidence/custom-palette-density';
fs.mkdirSync(out, { recursive: true });
const built = !process.argv.includes('--dev'), host = process.env.PALETTE_QA_HOST || 'http://127.0.0.1:9825';
const projectDir = process.env.PALETTE_QA_PROJECT_DIR || '.oprn-projects/oprn-hill-forest-harmony-20260918-a4e1';
const localRevision = () => execFileSync('python3', ['-c', "import sqlite3,sys;from pathlib import Path;p=Path(sys.argv[1])/'project.sqlite';c=sqlite3.connect(p.resolve().as_uri()+'?mode=ro',uri=True);print(c.execute('select revision,current_sha256 from project').fetchone())", projectDir]).toString();
const revision = localRevision();
const browser = await chromium.launch({ args: ['--no-sandbox'] });
let page;
try {
  const context = await browser.newContext({ viewport: { width: 1280, height: 1050 }, deviceScaleFactor: 2 });
  if (!built) {
    const html = await (await fetch(host)).text(), config = JSON.parse(html.match(/window\.__OPRN_BRIDGE__=(.*?)<\/script>/)[1]);
    const bridge = await (await fetch(host + '/__oprn/bridge.js')).text();
    await context.route('**/__oprn/**', async route => {
      const u = new URL(route.request().url());
      await route.fulfill({ response: await route.fetch({ url: host + u.pathname + u.search }) });
    });
    await context.addInitScript({ content: `window.__OPRN_BRIDGE__=${JSON.stringify(config)};\n${bridge}` });
  }
  page = await context.newPage(); page.setDefaultTimeout(30000);
  const errors = []; page.on('pageerror', e => {errors.push(e.message);console.log('PAGE ERROR',e.message);});
  await page.goto((built ? host : 'http://127.0.0.1:9826') + '/?map=map_forest_complex', { waitUntil: 'domcontentloaded' });
  const grid = page.getByTestId('custom-palette-grid');
  await grid.waitFor({ state: 'attached', timeout: 60000 });
  if (!await grid.isVisible()) await page.getByText('타일', { exact: true }).filter({ visible: true }).first().click();
  await grid.waitFor({ timeout: 10000 });
  await page.waitForFunction(() => document.querySelector('[data-testid=custom-palette-grid]')?.children.length === 2610);
  const metrics = await grid.evaluate(g => {
    const sheet = g.closest('.custom-palette'), cell = g.querySelector('[data-tile-index="1170"]');
    const c = getComputedStyle(cell), s = getComputedStyle(g);
    sheet.scrollTop = cell.offsetTop; sheet.scrollLeft = 0;
    const r = cell.getBoundingClientRect();
    const right = g.querySelector('[data-tile-index="1171"]').getBoundingClientRect();
    const down = g.querySelector('[data-tile-index="1200"]').getBoundingClientRect();
    return { columns: Number(sheet.dataset.sourceColumns), count: g.children.length, gap: s.gap, padding: s.padding,
      border: c.borderWidth, radius: c.borderRadius, cellWidth: r.width, scrollWidth: sheet.scrollWidth,
      xGap: right.left - r.right, yGap: down.top - r.bottom };
  });
  assert.equal(metrics.columns, 30); assert.equal(metrics.count, 2610);
  for (const key of ['gap', 'padding', 'border', 'radius']) assert.equal(metrics[key], '0px', key);
  for (const key of ['xGap', 'yGap']) assert.equal(metrics[key], 0, key);
  assert.equal(metrics.cellWidth, 16); assert.equal(metrics.scrollWidth, 480);
  await page.mouse.move(900, 20); await page.waitForTimeout(300);
  await page.locator('.custom-palette').screenshot({ path: `${out}/${built ? 'built' : 'after'}.png` });
  const box = await page.locator('.custom-palette').boundingBox();
  await page.screenshot({ path: `${out}/${built ? 'built' : 'after'}-detail.png`, clip: { ...box, height: Math.min(200, box.height) } });

  const cell = id => grid.locator(`[data-tile-index="${id}"]`);
  await cell(1171).click();
  assert.equal(await cell(1171).getAttribute('aria-pressed'), 'true');
  const selected = await cell(1171).evaluate(el => ({ border: getComputedStyle(el).borderWidth, radius: getComputedStyle(el).borderRadius, shadow: getComputedStyle(el).boxShadow }));
  assert.equal(selected.border, '0px'); assert.equal(selected.radius, '0px'); assert.ok(selected.shadow.includes('inset'));
  await cell(1171).focus(); await page.keyboard.press('ArrowDown');
  assert.equal(await page.evaluate(() => document.activeElement?.getAttribute('data-tile-index')), '1201');
  await page.keyboard.press('Enter'); assert.equal(await cell(1201).getAttribute('aria-pressed'), 'true');
  const keyboardFocus = await cell(1201).evaluate(el => getComputedStyle(el).boxShadow);
  assert.ok(keyboardFocus.includes('inset'));

  const a = await cell(1170).boundingBox(), z = await cell(1202).boundingBox();
  await page.mouse.move(a.x + 8, a.y + 8); await page.mouse.down();
  await page.mouse.move(z.x + 8, z.y + 8, { steps: 6 });
  const marked = await grid.locator('.stamp-source').evaluateAll(cells => cells.map(c => Number(c.dataset.tileIndex)));
  assert.deepEqual(marked, [1170, 1171, 1172, 1200, 1201, 1202]);
  await page.mouse.up();
  let stamp = null;
  if (!built) stamp = await page.evaluate(async () => {
    const path = '/src/editor/editorState.ts';
    const { editorState } = await import(performance.getEntriesByType('resource').filter(e => new URL(e.name).pathname === path).at(-1)?.name ?? path);
    const s = editorState.get().activePaletteStamp;
    return s && { width: s.width, height: s.height, tiles: s.cells.map(c => c.tile) };
  });
  if (stamp) { assert.equal(stamp.width, 3); assert.equal(stamp.height, 2); assert.deepEqual(stamp.tiles, marked); }
  if (!built) assert.ok(stamp, 'Drag must create a palette stamp');
  await page.mouse.move(900, 20);
  await page.locator('.custom-palette').screenshot({ path: `${out}/${built ? 'built' : 'after'}-selection.png` });
  assert.equal(localRevision(), revision, 'Palette interactions must not modify the saved project');
  assert.deepEqual(errors, []);
  const proof = { built, metrics, selected, keyboardFocus: true, dragCells: marked, stamp, savedProjectUnchanged: true, errors };
  fs.writeFileSync(`${out}/${built ? 'built' : 'after'}-proof.json`, JSON.stringify(proof, null, 2));
  console.log(JSON.stringify(proof));
} catch (error) {
  await page?.screenshot({ path: `${out}/failure.png` }).catch(() => {});
  throw error;
} finally { await browser.close(); }
