// Shipped player.html + exportProjectStoreShim, using the actual LegacyDb-reloaded project.
import assert from 'node:assert/strict';
import { firefox, chromium } from 'playwright';
import { readFile, writeFile } from 'node:fs/promises';
import { startPlayerQaServer, runRuntimeQa } from '../lib/runtimeQaRun.mjs';
import { armDomState, finishDomState, inspectGrowthImages, inspectGrowthLayout, blockRemoteWrites, growthViewports } from './growth-tree-evidence.mjs';
const root = 'output/evidence/growth-presets/p2';
const out = `${root}/runtime`;
const fixture = `${root}/reloaded-project.json`;
const project = JSON.parse(await readFile(fixture, 'utf8'));
const receipt = JSON.parse(await readFile(`${root}/reload-receipt.json`, 'utf8'));
assert.equal(receipt.equality, true); assert.equal(receipt.authoredDigest, receipt.reloadedDigest);
const server = await startPlayerQaServer();
let browser;
const actions = [], images = [], layouts = [], errors = [];
try {
  browser = await (process.env.GROWTH_QA_BROWSER === 'chromium' ? chromium : firefox).launch({ headless: true });
  const page = await browser.newPage(); page.setDefaultTimeout(90000);
  const writes = await blockRemoteWrites(page);
  page.on('pageerror', error => errors.push(error.message));
  const report = await runRuntimeQa(page, { id: 'growth-presets', projectFixture: fixture, viewport: { width: 1280, height: 800 },
    beats: [{ id: 'title', note: 'Actual reloaded showcase in shipped player', expect: { testidPresent: ['title-screen'] }, shot: true }],
  }, { serverUrl: server.url, outDir: out });
  assert.deepEqual(report.beats.flatMap(beat => beat.failures), []);
  assert.equal(new URL(page.url()).pathname, '/player.html'); assert.equal(await page.getByTestId('toolbar-database').count(), 0);
  // Subscribe to exact boot DOM transition before starting; deadline is failure-only.
  await page.evaluate(() => {
    window.__presetBoot = new Promise((resolve, reject) => {
      const observer = new MutationObserver(() => {
        if (window.__oprnDebug?.readState().currentMapId && !document.querySelector('[data-testid="title-screen"], [data-testid="play-loading-overlay"]')) {
          observer.disconnect(); clearTimeout(timer); resolve();
        }
      });
      const timer = setTimeout(() => { observer.disconnect(); reject(new Error('Player boot deadline')); }, 120000);
      observer.observe(document.documentElement, { childList: true, attributes: true, subtree: true });
    });
    window.__presetBoot.catch(error => { window.__presetBootError = error.message; });
  });
  await page.keyboard.press('Enter'); await page.evaluate(() => window.__presetBoot);
  assert.deepEqual(await page.evaluate(() => window.__oprnDebug.readState().partyActorIds), receipt.actors.map(actor => actor.id));
  await page.screenshot({ path: `${out}/field.png` });
  await armDomState(page, () => !!document.querySelector('[data-testid="main-menu"]'));
  await page.keyboard.press('Escape'); await finishDomState(page);
  await page.keyboard.press('ArrowDown');
  await armDomState(page, () => !!document.querySelector('[data-testid^="status-menu-skill-actor-"]'));
  await page.keyboard.press('Enter'); await finishDomState(page);
  async function activate(testid) {
    const target = page.getByTestId(testid);
    assert.equal(await target.count(), 1, `Missing runtime action ${testid}`);
    assert.equal(await target.isDisabled(), false, `Disabled runtime action ${testid}`);
    const seen = new Set();
    for (;;) {
      const selected = await page.locator('.status-menu-detail-action.selected').first().getAttribute('data-testid');
      if (selected === testid) {
        const before = await page.getByTestId('main-menu').innerHTML();
        await armDomState(page, before => document.querySelector('[data-testid="main-menu"]').innerHTML !== before, before);
        await page.keyboard.press('Enter'); await finishDomState(page);
        actions.push({ key: 'Enter', action: testid, title: await page.getByTestId('status-menu-detail-title').innerText() });
        return;
      }
      assert(!seen.has(selected), `Keyboard cycle cannot reach ${testid}`); seen.add(selected);
      await armDomState(page, previous => document.querySelector('.status-menu-detail-action.selected')?.getAttribute('data-testid') !== previous, selected);
      await page.keyboard.press('ArrowDown'); await finishDomState(page);
    }
  }
  const points = async () => Number(/(\d+) P/.exec(await page.getByTestId('status-menu-detail-title').innerText())?.[1]);
  async function capture(name, expectedImages) {
    for (const [width, height] of growthViewports) {
      await page.setViewportSize({ width, height });
      images.push({ name, width, ...await inspectGrowthImages(page, '[data-testid^="growth-menu-art-"]', expectedImages) });
      layouts.push({ name, width, boxes: await inspectGrowthLayout(page, ['[data-testid="main-menu"]', '[data-testid="status-menu-detail-title"]', '.life-ledger-tab']) });
      await page.screenshot({ path: `${out}/${name}-${width}.png` });
    }
  }
  for (const actor of receipt.actors) {
    const promotion = receipt.applications.find(entry => entry.addedClassIds.includes(actor.classId));
    const role = promotion.presetId.slice('promotion-'.length);
    const application = receipt.applications.find(entry => entry.presetId === `skill-${role}`);
    const tree = project.growth.skillTrees.find(tree => tree.id === application.addedTreeIds[0]);
    const [rootNode, technique, endurance, recovery, discipline, mastery, capstone] = tree.nodes;
    const nodeId = node => `growth-menu-node-${node.id}`;
    await activate(`status-menu-skill-actor-${actor.id}`);
    if (!await page.getByTestId(nodeId(rootNode)).count()) await activate('growth-menu-tab-tree');
    assert.equal(await points(), 22);
    assert.equal(await page.getByTestId(nodeId(technique)).isDisabled(), true);
    assert.equal(await page.getByTestId(nodeId(capstone)).isDisabled(), true);
    let spent = 0;
    for (const node of [rootNode, technique, discipline, mastery]) {
      await activate(nodeId(node)); spent += node.cost;
      assert.equal(await points(), 22 - spent);
      assert.match(await page.getByTestId(nodeId(node)).innerText(), new RegExp(`1/${node.maxRank}`));
    }
    assert.equal(await page.getByTestId(nodeId(capstone)).isDisabled(), true, 'Capstone requires both branches, not just mastery');
    actions.push({ actor: actor.id, check: 'both-prerequisites-required', capstone: capstone.id });
    for (const node of [endurance, recovery, capstone, rootNode, rootNode]) {
      await activate(nodeId(node)); spent += node.cost; assert.equal(await points(), 22 - spent);
    }
    assert.equal(await page.getByTestId(nodeId(rootNode)).isDisabled(), true);
    assert.match(await page.getByTestId(nodeId(rootNode)).innerText(), /3\/3/);
    await capture(`${role}-invested`, 22);
    await activate('growth-menu-tab-promotion');
    const rootClass = project.database.classes.find(record => record.id === actor.classId);
    assert.equal(await page.locator('[data-testid^="growth-menu-promote-"]').count(), 2);
    await capture(`${role}-promotion`, 2);
    const nextId = rootClass.promotions[0].toClassId;
    await activate(`growth-menu-promote-${nextId}`);
    const nextClass = project.database.classes.find(record => record.id === nextId);
    const finalId = nextClass.promotions[0].toClassId;
    assert.equal(await page.getByTestId(`growth-menu-promote-${finalId}`).isDisabled(), false);
    await activate(`growth-menu-promote-${finalId}`);
    assert.equal(await page.locator('[data-testid^="growth-menu-promote-"]').count(), 0);
    actions.push({ actor: actor.id, promotion: [actor.classId, nextId, finalId], twoTiers: true });
    await activate('growth-menu-tab-tree');
    assert.equal(await points(), 22 - spent, 'Promotion preserves investments in common trees');
    await activate(`growth-menu-reset-${tree.id}`);
    assert.equal(await points(), 22);
    for (const node of tree.nodes) assert.match(await page.getByTestId(nodeId(node)).innerText(), new RegExp(`0/${node.maxRank}`));
    assert.equal(await page.getByTestId(nodeId(technique)).isDisabled(), true);
    await page.screenshot({ path: `${out}/${role}-promoted-refunded.png` });
    actions.push({ actor: actor.id, spent, refunded: spent, available: await points(), ranksReset: true });
    await armDomState(page, () => !!document.querySelector('[data-testid^="status-menu-skill-actor-"]'));
    await page.keyboard.press('Escape'); await finishDomState(page);
  }
  // Observe actual exported store, never substitute or mutate the runtime project.
  const exported = await page.evaluate(async () => {
    const { store } = await import('/src/player/exportProjectStoreShim.ts');
    const { serialize } = await import('/src/project/io.ts');
    return JSON.parse(serialize(store.getCurrent()));
  });
  assert.deepEqual(exported.growth, project.growth);
  assert.deepEqual(exported.database.classes, project.database.classes);
  assert.deepEqual(exported.database.skills, project.database.skills);
  assert.deepEqual(writes, []); assert.deepEqual(errors, []);
  console.log('PASS: all three preset trees invested/prerequisites/max ranks/refunded; all three promotion trees advanced through both tiers in shipped player');
} catch (error) {
  actions.push({ failure: String(error) });
  if (browser?.isConnected()) {
    const page = browser.contexts()[0]?.pages()[0];
    if (page) await page.screenshot({ path: `${out}/failure.png` });
  }
  throw error;
} finally {
  await browser?.close(); await server.close();
  await writeFile(`${out}/report.json`, JSON.stringify({ projectId: receipt.projectId, sourceDigest: receipt.reloadedDigest, actions, images, layouts, errors }, null, 2));
  await writeFile(`${out}/cleanup.json`, JSON.stringify({ browserClosed: !browser?.isConnected(), playerServerClosed: true, port: server.port }));
}
