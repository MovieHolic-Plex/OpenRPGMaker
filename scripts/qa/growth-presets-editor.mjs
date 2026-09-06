// Real editor actions against a remote-disabled fixture, followed by read-only remote proof.
import assert from 'node:assert/strict';
import { firefox, chromium } from 'playwright';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { armDomState, finishDomState, inspectGrowthImages, inspectGrowthLayout, blockRemoteWrites, growthViewports } from './growth-tree-evidence.mjs';
const out = 'output/evidence/growth-presets/p2/editor';
const base = process.env.GROWTH_QA_BASE ?? 'http://127.0.0.1:9851';
const receipt = JSON.parse(await readFile('output/evidence/growth-presets/p2/reload-receipt.json', 'utf8'));
const saved = JSON.parse(await readFile('output/evidence/growth-presets/p2/reloaded-project.json', 'utf8'));
await mkdir(out, { recursive: true });
const browser = await (process.env.GROWTH_QA_BROWSER === 'chromium' ? chromium : firefox).launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1024, height: 768 } });
page.setDefaultTimeout(90000);
const errors = [], actions = [], images = [], layouts = [], screenshots = [];
const writes = await blockRemoteWrites(page);
page.on('pageerror', error => errors.push(error.message));
const state = async () => {
  // Transfer project JSON as one string, avoiding Playwright's per-cell object protocol overhead.
  const result = await page.evaluate(async () => {
    const { store } = await import('/src/project/store.ts');
    const history = await import('/src/editor/mapEditHistory.ts');
    const { collectProjectReferenceIssues } = await import('/src/project/io/references.ts');
    return { project: JSON.stringify(store.getCurrent()), history: history.getMapEditHistoryMarker(),
      remote: store.isRemotePersistenceEnabled(), issues: collectProjectReferenceIssues(store.getCurrent()) };
  });
  return { ...result, project: JSON.parse(result.project) };
};
// Exact store event is armed before each committing UI action; no sleeps/polling.
async function mutate(label, trigger) {
  await page.evaluate(async () => {
    const { store } = await import('/src/project/store.ts');
    window.__presetMutation = new Promise((resolve, reject) => {
      const stop = store.subscribe((_project, change) => { if (!change) return; clearTimeout(timer); stop(); resolve(change); });
      const timer = setTimeout(() => { stop(); reject(new Error('Editor mutation event deadline')); }, 15000);
    });
    window.__presetMutation.catch(error => { window.__presetMutationError = error.message; });
  });
  await trigger();
  const change = await page.evaluate(() => window.__presetMutation);
  actions.push({ label, change });
}
async function tab(mode) {
  const id = mode === 'promotion' ? 'db-tab-promotion-tree' : 'db-tab-skill-trees';
  if (!await page.getByTestId(id).isVisible()) await page.getByTestId('db-tab-group-party').click();
  await page.getByTestId(id).click();
}
async function shot(name) { const path = `${out}/${name}.png`; await page.screenshot({ path }); screenshots.push(path); }
async function selectedVisible() {
  const box = await page.locator('.growth-node.is-selected').boundingBox();
  const viewport = await page.getByTestId('growth-viewport').boundingBox();
  assert(box && viewport && box.x >= viewport.x - 1 && box.y >= viewport.y - 1 && box.x + box.width <= viewport.x + viewport.width + 1 && box.y + box.height <= viewport.y + viewport.height + 1, JSON.stringify({ box, viewport }));
  return { box, viewport };
}
function preserved(before, after) {
  assert.deepEqual(after.database.classes.slice(0, before.database.classes.length), before.database.classes);
  assert.deepEqual(after.database.skills.slice(0, before.database.skills.length), before.database.skills);
  if (before.growth) {
    assert.deepEqual(after.growth.skillTrees.slice(0, before.growth.skillTrees.length), before.growth.skillTrees);
    for (const [id, position] of Object.entries(before.growth.classPositions)) assert.deepEqual(after.growth.classPositions[id], position);
    for (const field of ['initialPoints', 'pointsPerLevel', 'bonusVariableId']) assert.deepEqual(after.growth[field], before.growth[field]);
  }
  const restored = structuredClone(after);
  restored.database.classes = before.database.classes; restored.database.skills = before.database.skills;
  if (before.growth) restored.growth = before.growth; else delete restored.growth;
  assert.deepEqual(restored, before, 'Unrelated authored content changed');
}
try {
  await page.addInitScript(() => localStorage.setItem('rpg-zzu:editor-ui-mode', 'expert'));
  await page.goto(`${base}/?freshProject=1`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.getByTestId('toolbar-database').click();
  assert.equal((await state()).remote, false);
  await tab('skill');
  await mutate('manual-create-tree', () => page.getByTestId('growth-add-tree').click());
  await page.getByTestId('growth-tree-name').fill('Manual preservation fixture');
  await mutate('manual-rename-tree', () => page.getByTestId('growth-tree-name').press('Tab'));
  const manualNodes = [];
  for (const kind of ['parameter', 'skill']) {
    await mutate(`manual-add-${kind}`, () => page.getByTestId(`growth-add-${kind}`).click());
    manualNodes.push(await page.locator('.growth-node.is-selected').getAttribute('data-node-id'));
  }
  await page.getByTestId(`growth-node-${manualNodes[0]}`).click();
  await page.getByTestId('growth-connect').click();
  await mutate('manual-connect', () => page.getByTestId(`growth-node-${manualNodes[1]}`).click());
  const manual = await state();
  assert.deepEqual(manual.issues, []);
  assert.deepEqual(manual.project.growth.skillTrees[0].nodes[1].prerequisites, [manualNodes[0]]);
  await shot('manual-authored');
  for (const mode of ['promotion', 'skill']) {
    await tab(mode);
    const before = await state();
    await page.getByTestId('growth-presets-open').press('Enter');
    assert.equal(await page.locator('.growth-preset-card').count(), 3);
    assert.equal(await page.locator('.growth-preset-card').first().evaluate(node => document.activeElement === node), true);
    for (const [width, height] of growthViewports) {
      await page.setViewportSize({ width, height });
      for (const role of ['vanguard', 'arcane', 'ranger']) {
        const card = page.getByTestId(`growth-preset-${mode}-${role}`);
        await card.focus(); await page.keyboard.press('Enter');
        assert.equal(await card.getAttribute('aria-pressed'), 'true');
        assert.equal(await page.locator('.growth-node').count(), mode === 'promotion' ? 5 : 7);
        const graph = await page.locator('.growth-canvas svg').evaluate(node => ({ paths: node.querySelectorAll('path[class]').length }));
        assert.equal(graph.paths, mode === 'promotion' ? 4 : 7);
        const after = await state(); assert.deepEqual(after.project, before.project); assert.equal(after.history, before.history);
        actions.push({ label: 'preview-inert', mode, role, width, graph });
      }
      images.push({ mode, width, ...await inspectGrowthImages(page, '.growth-preset-cover img', 3) });
      layouts.push({ mode, width, boxes: await inspectGrowthLayout(page, ['.growth-preset-browser', '.growth-preset-collection', '.growth-preset-footer']) });
      await shot(`${mode}-picker-${width}`);
      await page.locator('.growth-preset-content').evaluate(node => { node.scrollTop = node.scrollHeight; });
      layouts.push({ mode, width, bottom: await inspectGrowthLayout(page, ['.growth-preset-footer', '[data-testid="growth-preset-apply"]', '[data-testid="growth-presets-cancel"]']) });
      await page.getByTestId('growth-preset-apply').focus(); assert.equal(await page.getByTestId('growth-preset-apply').evaluate(node => node === document.activeElement), true);
      await page.keyboard.press('Shift+Tab');
      assert.equal(await page.getByTestId('growth-presets-cancel').evaluate(node => node === document.activeElement), true);
      await page.keyboard.press('Tab');
      assert.equal(await page.getByTestId('growth-preset-apply').evaluate(node => node === document.activeElement), true);
      await shot(`${mode}-bottom-${width}`);
      await page.locator('.growth-preset-content').evaluate(node => { node.scrollTop = node.querySelector('.growth-preset-details').offsetTop - node.offsetTop; });
      images.push({ mode, width, ...await inspectGrowthImages(page, '.growth-node img', mode === 'promotion' ? 5 : 7) });
      await shot(`${mode}-graph-${width}`);
      await page.locator('.growth-preset-content').evaluate(node => { node.scrollTop = 0; });
    }
    await page.getByTestId('growth-zoom-out').focus(); await page.keyboard.press('Enter');
    assert.equal(await page.getByTestId('growth-zoom-out').evaluate(node => node === document.activeElement), true);
    await page.keyboard.press('Escape');
    assert.equal(await page.getByTestId('growth-presets-open').evaluate(node => node === document.activeElement), true);
    await page.getByTestId('growth-presets-open').press('Enter');
    await page.getByTestId('growth-presets-cancel').click();
    assert.deepEqual((await state()).project, before.project); assert.equal((await state()).history, before.history);
    // All six presets plus each repeated application, validated against current authored data.
    await page.setViewportSize({ width: 1024, height: 768 });
    for (const role of ['vanguard', 'arcane', 'ranger']) for (const repetition of [1, 2]) {
      const prior = await state();
      await page.getByTestId('growth-presets-open').click();
      await page.getByTestId(`growth-preset-${mode}-${role}`).click();
      await armDomState(page, () => !document.querySelector('.growth-preset-browser') && !!document.querySelector('.growth-node.is-selected'));
      await mutate(`apply-${mode}-${role}-${repetition}`, () => page.getByTestId('growth-preset-apply').click());
      await finishDomState(page);
      const applied = await state();
      assert.equal(applied.history, prior.history + 1); assert.deepEqual(applied.issues, []);
      preserved(prior.project, applied.project);
      const allIds = [...applied.project.database.classes, ...applied.project.database.skills, ...applied.project.growth.skillTrees, ...applied.project.growth.skillTrees.flatMap(tree => tree.nodes)].map(record => record.id);
      assert.equal(new Set(allIds).size, allIds.length);
      actions.push({ label: 'selected-visible', mode, role, repetition, ...await selectedVisible() });
      await shot(`${mode}-${role}-applied-${repetition}`);
      if (repetition === 2) {
        await page.locator('.growth-node.is-selected').focus();
        await mutate(`undo-${mode}-${role}`, () => page.keyboard.press('Control+z'));
        assert.deepEqual((await state()).project, prior.project, 'One undo restores exact before state');
      }
    }
  }
  // A new browser context has no fixture/local project: the real editor must load the dedicated remote row.
  const remote = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  remote.setDefaultTimeout(90000); remote.on('pageerror', error => errors.push(error.message));
  const remoteWrites = await blockRemoteWrites(remote);
  const blockedLockRequests = [];
  remote.on('request', request => {
    if (request.method() === 'POST' && new URL(request.url()).pathname === '/rest/v1/map_edit_locks') {
      const body = request.postDataJSON();
      blockedLockRequests.push({ projectId: body.project_id, mapId: body.map_id });
    }
  });
  await remote.addInitScript(() => localStorage.setItem('rpg-zzu:editor-ui-mode', 'expert'));
  await remote.goto(`${base}/?project=${receipt.projectId}`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await remote.getByTestId('toolbar-database').click();
  const loaded = await remote.evaluate(async () => {
    const { store } = await import('/src/project/store.ts');
    const { serialize } = await import('/src/project/io.ts');
    return { project: JSON.parse(serialize(store.getCurrent())), remote: store.isRemotePersistenceEnabled() };
  });
  assert.equal(loaded.remote, true); assert.equal(new URL(remote.url()).searchParams.get('project'), receipt.projectId);
  for (const key of ['growth', 'maps']) assert.deepEqual(loaded.project[key], saved[key]);
  for (const key of ['classes', 'skills', 'actors']) assert.deepEqual(loaded.project.database[key], saved.database[key]);
  for (const mode of ['promotion', 'skill']) {
    const id = mode === 'promotion' ? 'db-tab-promotion-tree' : 'db-tab-skill-trees';
    if (!await remote.getByTestId(id).isVisible()) await remote.getByTestId('db-tab-group-party').click();
    await remote.getByTestId(id).click();
    images.push({ remote: true, mode, ...await inspectGrowthImages(remote, '.growth-node img', mode === 'promotion' ? saved.database.classes.length : 7) });
    await remote.screenshot({ path: `${out}/remote-${mode}-loaded.png` });
    await remote.getByTestId('growth-presets-open').click();
    images.push({ remote: true, mode, ...await inspectGrowthImages(remote, '.growth-preset-cover img', 3) });
    await remote.screenshot({ path: `${out}/remote-${mode}-picker.png` });
    await remote.getByTestId('growth-presets-cancel').click();
  }
  // renderEditor checks out its current map on boot. Keep that metadata POST blocked and
  // visible in evidence; it is not a serialized project save and must target this project only.
  const contentWrites = remoteWrites.filter(request => request.method !== 'POST' || new URL(request.url).pathname !== '/rest/v1/map_edit_locks');
  assert.deepEqual(contentWrites, []);
  assert.equal(blockedLockRequests.length, remoteWrites.length);
  for (const lock of blockedLockRequests) {
    assert.equal(lock.projectId, receipt.projectId); assert.ok(saved.maps[lock.mapId]);
  }
  actions.push({ label: 'blocked-boot-lock-metadata', blockedLockRequests, remoteWrites, contentWrites });
  assert.deepEqual(writes, []); assert.deepEqual(errors, []);
  actions.push({ label: 'remote-editor-loaded', projectId: receipt.projectId, matchingGrowthClassesSkillsActorsMaps: true, remotePersistenceEnabled: true, remoteWrites });
  console.log('PASS: editor presets, preservation, keyboard undo, manual authoring, and remote editor reload');
} catch (error) {
  await shot('failure');
  actions.push({ failure: String(error) });
  throw error;
} finally {
  await writeFile(`${out}/report.json`, JSON.stringify({ actions, images, layouts, screenshots, errors, writes }, null, 2));
  await browser.close();
  await writeFile(`${out}/cleanup.json`, JSON.stringify({ browserClosed: !browser.isConnected() }));
}
