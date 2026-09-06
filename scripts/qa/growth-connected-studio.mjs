// Owns port 9897; no shared dev server, remote writes, sleeps or polling loops.
import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import { firefox, chromium } from 'playwright';
import { armDomState, finishDomState, inspectGrowthImages, blockRemoteWrites, growthViewports } from './growth-tree-evidence.mjs';

const cwd = fileURLToPath(new URL('../../', import.meta.url));
const out = `${cwd}/.omo/evidence/growth-integrated/browser-presets`;
const base = 'http://127.0.0.1:9897';
await mkdir(out, { recursive: true });
const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--configLoader', 'runner', '--host', '127.0.0.1', '--port', '9897', '--strictPort'], { cwd, detached: true, stdio: ['ignore', 'pipe', 'pipe'] });
let serverLog = '', browser, page;
const errors = [], measurements = [], screenshots = [], images = [];
let remoteWrites = [];
const stopped = new Promise(resolve => server.once('exit', (code, signal) => resolve({ code, signal })));
const ready = new Promise((resolve, reject) => {
  const timeout = setTimeout(() => reject(new Error('Port 9897 server startup deadline')), 60000);
  server.once('error', error => { clearTimeout(timeout); reject(error); });
  server.once('exit', code => { clearTimeout(timeout); reject(new Error(`Private server exited ${code}: ${serverLog}`)); });
  const output = data => {
    serverLog += data.toString();
    if (/Local:.*9897/.test(serverLog)) { clearTimeout(timeout); resolve(); }
  };
  server.stdout.on('data', output); server.stderr.on('data', output);
});
const snapshot = async () => page.evaluate(async () => {
  const { store } = await import('/src/project/store.ts');
  const { getMapEditHistoryEntries } = await import('/src/editor/mapEditHistory.ts');
  return { json: JSON.stringify(store.getCurrent()), dirty: store.hasUnsavedChanges(), history: getMapEditHistoryEntries().length };
});
const clickState = async (id, predicate, argument) => {
  await armDomState(page, predicate, argument);
  await page.getByTestId(id).click(); await finishDomState(page);
};
const selectState = async (id, value, predicate, argument) => {
  await armDomState(page, predicate, argument);
  await page.getByTestId(id).selectOption(value); await finishDomState(page);
};
const capture = async label => {
  const geometry = await page.evaluate(() => {
    const rect = e => e.getBoundingClientRect().toJSON();
    const preview = document.querySelector('[data-testid="growth-preset-preview"]');
    const viewport = preview.querySelector('.growth-viewport');
    const vr = rect(viewport);
    const nodes = [...preview.querySelectorAll('.growth-node')].map(e => ({ id: e.dataset.nodeId, rect: rect(e), font: parseFloat(getComputedStyle(e.querySelector('strong')).fontSize) }));
    const intersection = (a, b) => Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left)) * Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
    const controls = [...preview.querySelectorAll('.growth-canvas-controls button, .growth-preset-toolbar button, .growth-preset-toolbar select')].map(e => ({ id: e.dataset.testid, rect: rect(e) }));
    const body = document.querySelector('.growth-body');
    const authored = body.querySelector('.growth-viewport');
    const authoredSelected = body.querySelector('.growth-node.is-selected');
    return {
      preview: rect(preview), viewport: vr, nodes, controls,
      fullyVisibleNodes: nodes.filter(n => intersection(n.rect, vr) >= n.rect.width * n.rect.height - 1).length,
      edges: preview.querySelectorAll('.growth-wires path').length,
      nodeOverlaps: nodes.flatMap((a, i) => nodes.slice(i + 1).filter(b => intersection(a.rect, b.rect) > 1).map(b => [a.id, b.id])),
      body: rect(body), authoredViewport: rect(authored), authoredSelected: authoredSelected && rect(authoredSelected),
      authoredSelectionVisible: authoredSelected ? intersection(rect(authoredSelected), rect(authored)) > 0 : true,
      outsideViewport: [preview, body, ...preview.querySelectorAll('.growth-canvas-controls')].map(rect).some(r => r.left < -1 || r.top < -1 || r.right > innerWidth + 1 || r.bottom > innerHeight + 1),
      previewAuthoredOverlap: intersection(rect(preview), rect(body)),
      horizontalOverflow: document.querySelector('.growth-studio').scrollWidth - document.querySelector('.growth-studio').clientWidth,
      duplicateTestids: [...document.querySelectorAll('.growth-studio [data-testid]')].map(e => e.dataset.testid).filter((id, i, all) => all.indexOf(id) !== i),
    };
  });
  measurements.push({ label, size: page.viewportSize(), ...geometry });
  assert.equal(geometry.outsideViewport, false, `${label}: outside viewport`);
  assert.equal(geometry.previewAuthoredOverlap, 0, `${label}: preview covers authored content`);
  assert.ok(geometry.horizontalOverflow <= 1, `${label}: outer horizontal overflow`);
  assert.ok(geometry.viewport.height >= 114, `${label}: preview graph too short ${geometry.viewport.height}`);
  assert.ok(geometry.authoredViewport.height >= 98, `${label}: authored graph too short ${geometry.authoredViewport.height}`);
  assert.ok(geometry.fullyVisibleNodes >= 2, `${label}: fewer than two readable preview nodes`);
  assert.ok(geometry.edges > 0, `${label}: no preview edges`);
  assert.deepEqual(geometry.nodeOverlaps, [], `${label}: overlapping nodes`);
  assert.deepEqual(geometry.duplicateTestids, [], `${label}: ambiguous testids`);
  for (const node of geometry.nodes) { assert.ok(node.rect.width >= 179); assert.ok(node.font >= 13); }
  for (const control of geometry.controls) assert.ok(control.rect.height >= 32, `${label}: small target ${control.id}`);
  images.push({ label, ...await inspectGrowthImages(page, '[data-testid="growth-preset-preview"] .growth-node img', geometry.nodes.length) });
  const path = `${out}/${label}-${page.viewportSize().width}.png`;
  await page.screenshot({ path }); screenshots.push(path);
};
try {
  await ready;
  browser = await (process.env.GROWTH_QA_BROWSER === 'chromium' ? chromium : firefox).launch({ headless: true });
  page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  page.setDefaultTimeout(20000);
  remoteWrites = await blockRemoteWrites(page);
  page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(() => localStorage.setItem('rpg-zzu:editor-ui-mode', 'expert'));
  await page.goto(`${base}/?freshProject=1`, { waitUntil: 'domcontentloaded', timeout: 120000 });
  // Cold Vite dependency optimization is boot work, not a UI interaction deadline.
  await armDomState(page, () => Boolean(document.querySelector('[data-testid="toolbar-database"]')), undefined, 120000);
  await finishDomState(page);
  await clickState('toolbar-database', () => Boolean(document.querySelector('[data-testid="database-modal"]')));
  const tab = async mode => {
    const id = mode === 'promotion' ? 'db-tab-promotion-tree' : 'db-tab-skill-trees';
    if (!await page.getByTestId(id).isVisible()) await page.getByTestId('db-tab-group-party').click();
    await clickState(id, mode => Boolean(document.querySelector(`[data-testid="growth-studio-${mode}"] [data-testid="growth-preset-preview"] .growth-node`)), mode);
  };
  await tab('promotion');
  const before = await snapshot();
  for (const mode of ['promotion', 'skill']) {
    await tab(mode);
    for (const [width, height] of growthViewports) { await page.setViewportSize({ width, height }); await capture(`default-${mode}`); }
    assert.deepEqual(await snapshot(), before, 'Opening/resizing studios must be inert');
  }
  await selectState('growth-preset-tree', 'tree-1', () => Boolean(document.querySelector('[data-testid="growth-preset-preview"] .growth-node.is-external')));
  assert.ok(await page.getByTestId('growth-preset-cross-tree').count());
  await capture('cross-tree-preview');
  await clickState('growth-preset-cross-tree', () => document.querySelector('[data-testid="growth-preset-tree"]')?.value === 'tree-0');
  await clickState('growth-presets-open', () => Boolean(document.querySelector('[data-testid="growth-preset-browser"]')));
  for (const role of ['vanguard', 'arcane', 'ranger']) {
    await clickState(`growth-preset-bundle-${role}`, role => document.querySelector(`[data-testid="growth-preset-bundle-${role}"]`)?.getAttribute('aria-pressed') === 'true', role);
    assert.ok(await page.locator('.growth-preset-browser .growth-node').count() >= 2);
  }
  await page.getByTestId('growth-preset-zoom-in').focus();
  await clickState('growth-preset-zoom-in', () => document.querySelector('.growth-preset-browser output')?.textContent === '110%');
  assert.equal(await page.evaluate(() => document.activeElement?.dataset.testid), 'growth-preset-zoom-in');
  await armDomState(page, () => Boolean(document.querySelector('[data-testid="growth-preset-preview"]')));
  await page.keyboard.press('Escape'); await finishDomState(page);
  assert.equal(await page.evaluate(() => document.activeElement?.dataset.testid), 'growth-presets-open');
  assert.deepEqual(await snapshot(), before, 'Inspect, zoom, Escape must be inert');
  await selectState('growth-preset-select', 'bundle-vanguard', () => document.querySelector('[data-testid="growth-preset-select"]')?.value === 'bundle-vanguard');
  await clickState('growth-preset-apply', () => Boolean(document.querySelector('[data-testid="growth-bundle-promotion"]')));
  const applied = await snapshot(), project = JSON.parse(applied.json);
  assert.equal(applied.history, before.history + 1, 'Apply must be one undo boundary');
  assert.deepEqual(project.database.actors, JSON.parse(before.json).database.actors, 'Never auto assign actors or curves');
  const imported = project.growth.skillTrees.filter(t => t.id.startsWith('bundle-vanguard-'));
  assert.equal(imported.length, 5);
  const rootClass = imported[0].classIds[0];
  await clickState('growth-bundle-promotion', () => Boolean(document.querySelector('[data-testid="growth-studio-promotion"]')));
  assert.equal(await page.locator('.growth-body .growth-node.is-selected').getAttribute('data-node-id'), rootClass);
  for (const [width, height] of growthViewports) { await page.setViewportSize({ width, height }); await capture('applied-promotion'); }
  await clickState('growth-bundle-skills', () => Boolean(document.querySelector('[data-testid="growth-studio-skill"]')));
  assert.equal(await page.getByTestId('growth-tree-name').inputValue(), imported[0].name);
  for (const [width, height] of growthViewports) { await page.setViewportSize({ width, height }); await capture('applied-skill'); }
  await clickState(`growth-list-${imported[1].id}`, id => Boolean(document.querySelector(`[data-testid="growth-list-${id}"].is-active`)), imported[1].id);
  assert.ok(await page.locator('.growth-body .growth-node.is-external').count());
  const authoredPortal = page.locator('.growth-body .growth-node.is-external').first();
  await armDomState(page, name => document.querySelector('[data-testid="growth-tree-name"]')?.value === name, imported[0].name);
  await authoredPortal.click(); await finishDomState(page);
  assert.deepEqual(await snapshot(), applied, 'Cross-tab and prerequisite navigation cannot reimport');
  await clickState('growth-bundle-assign-actor', () => Boolean(document.querySelector('[data-testid="db-picker-class"]')));
  assert.equal(await page.getByTestId('db-picker-class').inputValue(), project.database.actors[0].classId);
  assert.deepEqual(await snapshot(), applied, 'Actor route must not assign automatically');
  // Preserve the exact imported project for lead-owned DB/player QA; this script writes no remote data.
  await writeFile(`${out}/applied-bundle.json`, JSON.stringify(project));
  await tab('skill');
  await page.getByTestId('growth-viewport').focus();
  await armDomState(page, () => !document.querySelector('[data-testid="growth-bundle-promotion"]'));
  await page.keyboard.press('Control+z'); await finishDomState(page);
  const undone = await snapshot(); assert.equal(undone.json, before.json, 'One undo restores the whole bundle');
  assert.equal(undone.history, before.history);
  // Repeated application remains independent, and current tab selects the second imported tree.
  for (let copy = 0; copy < 2; copy++) {
    await clickState('growth-preset-apply', count => document.querySelectorAll('.growth-catalog-item').length === count, (copy + 1) * 5);
  }
  const repeated = JSON.parse((await snapshot()).json);
  assert.equal(repeated.growth.skillTrees.length, 10);
  assert.equal(new Set(repeated.growth.skillTrees.flatMap(t => [t.id, ...t.nodes.map(n => n.id)])).size, 30);
  assert.equal((await snapshot()).history, before.history + 2);
  assert.deepEqual(repeated.growth.skillTrees.slice(0, 5), imported);
  assert.equal(errors.length, 0, errors.join('\n'));
  assert.equal(remoteWrites.length, 0, JSON.stringify(remoteWrites));
  await writeFile(`${out}/report.json`, JSON.stringify({ base, errors, remoteWrites, measurements, images, screenshots, checks: ['default-nodes-both-tabs', 'native-node-size', 'no-overlap', 'loaded-art', 'detached-no-dirty-history', 'cross-tree-portal', 'focus-zoom-escape', 'single-apply-undo', 'same-import-cross-tab', 'explicit-actor-route', 'repeated-independent-imports'] }, null, 2));
  console.log(`Connected growth editor QA passed: ${out}/report.json`);
} catch (error) {
  if (page) await writeFile(`${out}/failure-body.txt`, await page.locator('body').innerText());
  if (page) await page.screenshot({ path: `${out}/failure.png`, timeout: 10000 }).catch(e => console.error('Failure screenshot:', e));
  await writeFile(`${out}/failure.json`, JSON.stringify({ error: String(error), errors, remoteWrites, measurements }, null, 2));
  throw error;
} finally {
  if (browser) await browser.close();
  if (server.exitCode === null) process.kill(-server.pid, 'SIGTERM');
  let timer;
  const exit = await Promise.race([stopped, new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('Private server cleanup deadline')), 15000); })]);
  clearTimeout(timer);
  await writeFile(`${out}/server.log`, serverLog);
  await writeFile(`${out}/cleanup.json`, JSON.stringify({ browserClosed: !browser?.isConnected(), privateServerExit: exit, remoteWrites }));
}
