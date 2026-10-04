// Actual native layer controls: canonical save, ordinary reload, then exact restoration.
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
const out = resolve('verify-shots/opening-production');
const completion = JSON.parse(readFileSync(out + '/completion.json', 'utf8'));
assert(completion.passed);
const dir = completion.afterReload.dir;
const snapshot = () => {
  const db = new DatabaseSync(dir + '/project.sqlite', { readOnly: true });
  try {
    const row = db.prepare('select revision,current_json from project where id=1').get();
    const doc = JSON.parse(row.current_json);
    return { revision: row.revision, opening: doc.system.opening, title: doc.system.titleScreen,
      mapsHash: createHash('sha256').update(JSON.stringify(db.prepare('select map_id,map_json from maps order by map_id').all())).digest('hex') };
  } finally { db.close(); }
};
const before = snapshot(), scene = before.opening.scenes.find(s => s.direction?.layers?.length);
assert(scene);
const width = scene.direction.layers[0].width, changedWidth = Number((width + 0.01).toFixed(2));
const report = { mode: 'actual Canvas editor controls; canonical save/reload and exact restoration', projectId: completion.afterReload.projectId, dir, before, errors: [] };
const browser = await chromium.launch({ args: ['--disable-webgl'] });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
page.on('pageerror', e => report.errors.push(e.message));
const open = async () => {
  await page.waitForFunction(() => window.__oprnAiBridge?.status().ready, null, { timeout: 300000 });
  await page.getByTestId('toolbar-database').click();
  await page.getByTestId('db-group-strip-system').click(); await page.getByTestId('db-tab-opening').click();
  await page.getByTestId('db-cinematic-scene-' + scene.id).click();
  await page.locator('details').filter({ has: page.getByTestId('db-cinematic-layer-0-width') }).locator('summary').click();
};
const saved = async value => {
  const end = Date.now() + 15000;
  while (Date.now() < end) {
    if (snapshot().opening.scenes.find(s => s.id === scene.id).direction.layers[0].width === value) return;
    await page.waitForTimeout(200);
  }
  throw Error('Layer width did not reach canonical storage');
};
try {
  await page.goto(completion.projectUrl, { waitUntil: 'domcontentloaded' }); await open();
  assert.equal(Number(await page.getByTestId('db-cinematic-layer-0-width').inputValue()), width);
  await page.getByTestId('db-cinematic-layer-0-width').fill(String(changedWidth));
  await page.getByTestId('db-cinematic-layer-0-width').dispatchEvent('change'); await saved(changedWidth);
  await page.reload(); await open();
  assert.equal(Number(await page.getByTestId('db-cinematic-layer-0-width').inputValue()), changedWidth);
  report.changedReload = snapshot();
  await page.getByTestId('db-cinematic-layer-0-width').fill(String(width));
  await page.getByTestId('db-cinematic-layer-0-width').dispatchEvent('change'); await saved(width);
  await page.reload(); await open();
  assert.equal(Number(await page.getByTestId('db-cinematic-layer-0-width').inputValue()), width);
  report.afterReload = snapshot();
  assert.deepEqual(report.afterReload.opening, before.opening);
  assert.deepEqual(report.afterReload.title, before.title);
  assert.equal(report.afterReload.mapsHash, before.mapsHash); assert.deepEqual(report.errors, []);
  await page.getByTestId('db-cinematic-layer-0-width').scrollIntoViewIfNeeded();
  await page.screenshot({ path: out + '/editor-layers.png' });
  report.passed = true;
  writeFileSync(out + '/reloaded.json', JSON.stringify({ passed: true, workerCompleted: completion.workerCompleted,
    mode: completion.mode, projectUrl: completion.projectUrl,
    afterReload: { ...completion.afterReload, ...report.afterReload } }, null, 2) + '\n');
} catch (e) { report.failure = e.message; await page.screenshot({ path: out + '/editor-failure.png', timeout: 5000 }).catch(() => {}); }
finally { await browser.close(); writeFileSync(out + '/editor.json', JSON.stringify(report, null, 2) + '\n'); }
console.log(JSON.stringify({ passed: report.passed, failure: report.failure, before: before.revision, revision: report.afterReload?.revision }));
process.exitCode = report.passed ? 0 : 1;
