import assert from 'node:assert/strict';
import { firefox } from 'playwright';
import { DatabaseSync } from 'node:sqlite';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const base = 'http://127.0.0.1:18436';
const dir = resolve('output/qa/event-diary/project');
const out = resolve('verify-shots/event-diary-graphic');
mkdirSync(out, { recursive: true });
function snapshot() {
  const db = new DatabaseSync(dir + '/project.sqlite', { readOnly: true });
  try {
    const row = db.prepare('select project_id,revision from project where id=1').get();
    const maps = db.prepare('select map_id,map_json from maps').all().map(r => ({ id: r.map_id, ...JSON.parse(r.map_json) }));
    const map = maps.find(m => m.events.some(e => e.pages?.some(p => p.name?.includes('일기')) || e.name?.includes('일기')));
    const event = map?.events.find(e => e.pages?.some(p => p.name?.includes('일기')) || e.name?.includes('일기'));
    assert(event, 'The real assistant must persist a diary');
    return { ...row, mapId: map.id, event };
  } finally { db.close(); }
}
const report = { dir, base, errors: [], additionalAiRuns: 0, before: snapshot() };
const browser = await firefox.launch({ firefoxUserPrefs: { 'network.notify.changed': false, 'network.captive-portal-service.enabled': false } });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
page.on('pageerror', e => report.errors.push(e.message));
page.on('request', r => { if (r.method() === 'POST' && r.url().includes('/v1/agent/run')) report.additionalAiRuns++; });
try {
  await page.goto(base + '/index.html?map=' + encodeURIComponent(report.before.mapId));
  await page.waitForFunction(() => window.__oprnEditMapViewport?.()?.mapId, null, { timeout: 180000 });
  await page.getByTestId('layer-event').click();
  await page.screenshot({ path: out + '/diary-map.png' });
  await page.getByTestId('event-list-row-' + report.before.event.id).dblclick();
  await page.getByTestId('event-editor-modal').waitFor();
  const preview = page.getByTestId('event-page-graphic-control').getByTestId('event-page-graphic-preview');
  await preview.waitFor({ state: 'visible' });
  report.preview = await preview.evaluate(node => ({ ...node.dataset, background: getComputedStyle(node).backgroundImage, width: node.clientWidth, height: node.clientHeight }));
  assert.equal(report.preview.spriteId, report.before.event.pages[0].graphic.sprite.id);
  assert(!report.preview.unsupported && !report.preview.empty);
  assert(report.preview.background !== 'none' && report.preview.width > 0 && report.preview.height > 0);
  await page.screenshot({ path: out + '/diary-event-editor.png' });
  await page.getByTestId('event-editor-save').click();
  await page.waitForTimeout(3000);
  await page.reload();
  await page.waitForFunction(() => window.__oprnEditMapViewport?.()?.mapId, null, { timeout: 180000 });
  await page.getByTestId('layer-event').click();
  await page.getByTestId('event-list-row-' + report.before.event.id).dblclick();
  await preview.waitFor({ state: 'visible' });
  report.after = snapshot();
  report.reloadedPreview = await preview.evaluate(node => ({ ...node.dataset, background: getComputedStyle(node).backgroundImage }));
  assert.equal(report.before.project_id, report.after.project_id);
  assert.deepEqual(report.before.event.pages.map(p => p.graphic), report.after.event.pages.map(p => p.graphic));
  assert.deepEqual(report.before.event.pages.map(p => p.commands), report.after.event.pages.map(p => p.commands));
  assert.equal(report.reloadedPreview.spriteId, report.preview.spriteId);
  assert(!report.reloadedPreview.unsupported && report.reloadedPreview.background !== 'none');
  assert.equal(report.additionalAiRuns, 0);
  assert.deepEqual(report.errors, []);
  await page.screenshot({ path: out + '/diary-reloaded.png' });
  report.passed = true;
  console.log('Canonical diary reload verified', report.after.project_id, report.preview.spriteId);
} catch (e) { report.failure = e.message; process.exitCode = 1; await page.screenshot({ path: out + '/reload-failure.png' }).catch(() => {}); }
finally { writeFileSync(out + '/reload.json', JSON.stringify(report, null, 2) + '\n'); await browser.close(); }
