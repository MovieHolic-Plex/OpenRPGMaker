// QA-only shipping runtime evidence. No canonical/DB/session-debug writes.
// Run: node scripts/qa/runtime/shop-decision-report.mjs --case economy|compare|navigation
import assert from "node:assert/strict";
import { access, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { join, resolve } from "node:path";
import { parseArgs } from "node:util";
import { chromium } from "@playwright/test";
import { build } from "vite";
import { startPlayerQaServer } from "../../lib/runtimeQaRun.mjs";
import { shopFixture } from './shop-decision-fixtures.mjs';

const { values } = parseArgs({ options: { case: { type: "string" } } });
assert.ok(['economy', 'compare', 'navigation'].includes(values.case), 'Supported cases: economy|compare|navigation');
const root = resolve(`reports/shop-decision-2026-09-07/${values.case}`);
await mkdir(root, { recursive: true });
const report = { case: values.case, startedAt: new Date().toISOString(), actions: [], screenshots: [], errors: [], networkFailures: [], cleanup: [] };
const resources = [];
function own(resource, close) {
  const receipt = { resource, registeredAt: new Date().toISOString(), closed: false };
  report.cleanup.push(receipt);
  resources.push({ receipt, close });
}
async function closeResources(matches = () => true) {
  for (const { receipt, close } of [...resources].reverse()) {
    if (receipt.closed || !matches(receipt.resource)) continue;
    await close(); receipt.closed = true; receipt.closedAt = new Date().toISOString();
  }
}
async function closeFixture(page) {
  const { id } = sessions.get(page);
  await closeResources(resource => resource.startsWith(`${id}:`));
}

// Arm the exact DOM/state signal before each key. Deadline bounds failure only.
async function observedAction(page, trigger, predicate, label) {
  const pending = await page.evaluateHandle((source) => {
    const check = Function(`return (${source})`)();
    let cancel;
    const promise = new Promise((done) => {
      const finish = (ok) => {
        clearTimeout(deadline); observer.disconnect();
        document.removeEventListener('focusin', changed, true);
        document.removeEventListener('scroll', changed, true);
        document.removeEventListener('keydown', keyReceipt, true);
        done(ok);
      };
      const changed = () => { if (check()) finish(true); };
      // Receipt microtask follows target/overlay handlers, including intentionally inert keys.
      const keyReceipt = () => queueMicrotask(changed);
      const observer = new MutationObserver(changed);
      const deadline = setTimeout(() => finish(false), 10000);
      cancel = () => finish(false);
      observer.observe(document.body, { subtree: true, childList: true, attributes: true, characterData: true });
      document.addEventListener('focusin', changed, true);
      document.addEventListener('scroll', changed, true);
      document.addEventListener('keydown', keyReceipt, true);
    });
    return { promise, cancel: () => cancel() };
  }, predicate.toString());
  const action = { label, completed: false };
  report.actions.push(action);
  try {
    await trigger();
    action.completed = await pending.evaluate((entry) => entry.promise);
    assert.equal(action.completed, true, `Missing state signal: ${label}`);
    action.state = await readEconomy(page);
  } finally {
    await pending.evaluate((entry) => entry.cancel());
    await pending.dispose();
  }
}
const selected = (id) => Function(`return document.querySelector('[data-testid="${id}"]')?.getAttribute('aria-current') === 'true'`);
async function keyUntil(page, key, predicate, label = key) {
  await observedAction(page, () => page.keyboard.press(key), predicate, `${key}: ${label}`);
}
const focused = (id) => Function(`return document.activeElement?.dataset.testid === ${JSON.stringify(id)}`);
async function focusKey(page, key, id) { await keyUntil(page, key, focused(id), `focus ${id}`); }
const present = (id) => Function(`return Boolean(document.querySelector('[data-testid="${id}"]'))`);
const goldIs = (gold) => Function(`return window.__oprnDebug.readState().gold === ${gold}`);

async function readEconomy(page) {
  return page.evaluate(() => {
    const state = window.__oprnDebug.readState();
    const mirror = JSON.parse(document.querySelector('[data-testid="runtime-state-json"]').textContent);
    const overlay = document.querySelector('[data-testid="shop-scene"]');
    const row = overlay?.querySelector('.runtime-shop-item-row.selected');
    const input = overlay?.querySelector('[data-testid="shop-quantity-input"]');
    const amount = (node) => node ? Number(node.textContent.replace(/[^0-9]/g, '')) : null;
    const warnings = [];
    if (row && input && Number(input.max) !== Math.max(1, Number(row.dataset.maxQty))) warnings.push('stale quantity max');
    if (input && (Number(input.value) < 1 || Number(input.value) > Number(input.max))) warnings.push('unclamped quantity');
    return {
      gold: state.gold, inventory: state.inventory, owned: state.inventory.equip_sword ?? 0,
      playerGold: amount(overlay?.querySelector('[data-testid="shop-player-gold"] .runtime-shop-gold-value')),
      merchantGold: amount(overlay?.querySelector('[data-testid="shop-merchant-gold"] .runtime-shop-gold-value')),
      selected: row?.dataset.testid ?? null, cap: row ? Number(row.dataset.maxQty) : null,
      unitPrice: row ? Number(row.dataset.unitPrice) : null,
      displayedPrice: amount(row?.querySelector('.runtime-shop-item-price')),
      displayedOwned: amount(row?.querySelector('.runtime-shop-item-owned')),
      quantity: input?.value ?? null, quantityMax: input?.max ?? null,
      total: amount(overlay?.querySelector('[data-testid="shop-quantity-total"]')),
      rows: overlay?.querySelectorAll('.runtime-shop-item-row').length ?? 0,
      actorEquipment: mirror.actorEquipment, tradeCounts: mirror.shopTradeCounts ?? {},
      focus: document.activeElement?.dataset.testid ?? null,
      balance: overlay?.querySelector('[data-testid="shop-balance-after"]')?.dataset.balance ?? null,
      shortage: overlay?.querySelector('[data-testid="shop-balance-after"]')?.dataset.shortage ?? null,
      x: state.x, y: state.y, warnings,
    };
  });
}

async function snapshot(page, id, expected) {
  await page.evaluate(async () => {
    await document.fonts.ready;
    await Promise.all((document.querySelector('[data-testid="shop-scene"]')?.getAnimations({ subtree: true }) ?? [])
      .filter((animation) => animation.effect?.getTiming().iterations !== Infinity)
      .map((animation) => animation.finished.catch((error) => { if (error.name !== 'AbortError') throw error; })));
  });
  const observed = await readEconomy(page);
  const entry = { id, screenshot: `${id}.png`, expected, observed };
  report.screenshots.push(entry);
  await page.screenshot({ path: join(root, entry.screenshot) });
  await writeFile(join(root, `${id}.json`), JSON.stringify(entry, null, 2));
  for (const [key, value] of Object.entries(expected)) assert.deepEqual(observed[key], value, `${id}: ${key}`);
  assert.deepEqual(observed.warnings, [], `${id}: capacity warnings`);
  assert.deepEqual(observed.actorEquipment, report.screenshots[0].observed.actorEquipment, `${id}: no auto-equip`);
  console.log(`${id}: player=${observed.gold}, merchant=${observed.merchantGold}, owned=${observed.owned}, cap=${observed.cap}, quantity=${observed.quantity}, total=${observed.total}`);
}

async function economy() {
  const { page, project, initial } = await boot('economy');
  assert.equal(project.database.items.some(e => e.id === 'equip_sword'), false);
  await snapshot(page, '00-entrance', { gold: 100, inventory: {}, owned: 0 });
  await keyUntil(page, 'Enter', selected('shop-buy-equip_sword'), 'open buy list');
  await snapshot(page, '01-stock', { gold: 100, playerGold: 100, merchantGold: 200, owned: 0, cap: 2, quantityMax: '2', quantity: '1', unitPrice: 40, displayedPrice: 40, total: 40, balance: '60', shortage: null });
  await keyUntil(page, 'ArrowRight', () => document.querySelector('[data-testid="shop-quantity-input"]').value === '2', 'buy quantity two');
  await snapshot(page, '02-buy-two', { gold: 100, merchantGold: 200, quantity: '2', total: 80, balance: '20' });
  await keyUntil(page, 'e', goldIs(20), 'buy two equipment');
  const bought = { gold: 20, playerGold: 20, merchantGold: 280, inventory: { equip_sword: 2 }, owned: 2, displayedOwned: 2, cap: 0, quantityMax: '1', quantity: '1', total: 40, shortage: '20', balance: null, tradeCounts: { equip_sword: { bought: 2, sold: 0 } } };
  await snapshot(page, '03-bought', bought);
  await keyUntil(page, 'e', () => document.querySelector('[data-testid="shop-buy-equip_sword"]').classList.contains('juice-menu-invalid'), 'reject zero-capacity purchase');
  await snapshot(page, '04-rejected', bought);
  await focusKey(page, 'Tab', 'shop-tab-buy');
  await focusKey(page, 'ArrowRight', 'shop-tab-sell');
  assert.equal(await page.getByTestId('shop-buy-equip_sword').count(), 1, 'mode arrow does not commit');
  await keyUntil(page, 'Enter', selected('shop-sell-equip_sword'), 'direct keyboard sell mode');
  await focusKey(page, 'Shift+Tab', 'shop-sell-equip_sword');
  await snapshot(page, '05-sell-stock', { gold: 20, merchantGold: 280, owned: 2, cap: 2, quantityMax: '2', quantity: '1', unitPrice: 20, displayedPrice: 20, total: 20, balance: '40', shortage: null });
  await keyUntil(page, 'ArrowRight', () => document.querySelector('[data-testid="shop-quantity-input"]').value === '2', 'sell quantity two');
  await snapshot(page, '06-sell-two', { gold: 20, merchantGold: 280, quantity: '2', total: 40, balance: '60' });
  await keyUntil(page, 'e', goldIs(60), 'sell final two equipment');
  await snapshot(page, '07-sold-last-copy', { gold: 60, playerGold: 60, merchantGold: 240, inventory: {}, owned: 0, rows: 0, selected: null, tradeCounts: { equip_sword: { bought: 2, sold: 2 } } });
  assert.equal(await page.getByTestId('shop-sell-equip_sword').count(), 0);
  await keyUntil(page, 'Escape', present('shop-mode-buy'), 'return to entrance');
  await keyUntil(page, 'Escape', () => !document.querySelector('[data-testid="shop-scene"]'), 'close shop');
  await snapshot(page, '08-field-return', { gold: 60, inventory: {}, x: 14, y: 18 });
  assert.deepEqual((await immutable(page)).actorEquipment, initial.actorEquipment, 'no auto-equip');
}

// All fixtures share one shipping bundle/server per invocation, but never a session/context.
let page;
let bundle;
let server;
let browser;
let sceneModule;
const sessions = new WeakMap();

async function ready(page, predicate) {
  await page.evaluate(source => new Promise((resolveReady, reject) => {
    const check = Function(`return (${source})`)();
    const finish = () => { clearTimeout(deadline); observer.disconnect(); };
    const changed = () => {
      const failure = document.querySelector('[data-testid="oprn-game-file-picker-status"], .player-export-error');
      if (failure) { finish(); reject(new Error(`Shipping fixture rejected: ${failure.textContent}`)); }
      else if (check()) { finish(); resolveReady(); }
    };
    const observer = new MutationObserver(changed);
    const deadline = setTimeout(() => { finish(); reject(new Error('Shipping boot signal missing')); }, 120000);
    observer.observe(document.documentElement, { childList: true, attributes: true, subtree: true });
    changed();
  }), predicate.toString());
}
async function boot(kind, viewport = { width: 1024, height: 768 }, overrides = {}) {
  const { project, command } = await shopFixture(kind, overrides);
  const id = `${kind}-${viewport.width}x${viewport.height}`;
  const fixturePath = `${id}-fixture.json`;
  await writeFile(join(root, fixturePath), JSON.stringify(project));
  report.fixtures ??= [];
  report.fixtures.push({ id, file: fixturePath, command, gold: project.session.gold,
    source: 'test/fixtures/projects/item-runtime-qa-v3.json', viewport,
    actors: project.database.actors.map(a => ({ id: a.id, classId: a.classId, level: a.initialLevel, equipment: a.initialEquipment })),
    authoredGrowth: project.growth ?? null });
  const context = await browser.newContext({ viewport });
  own(`${id}:context`, () => context.close());
  page = await context.newPage();
  const currentPage = page;
  own(`${id}:page`, async () => { await currentPage.close(); assert.equal(currentPage.isClosed(), true); });
  await page.route(`${server.url}/**`, async route => {
    const pathname = decodeURIComponent(new URL(route.request().url()).pathname);
    for (const directory of [bundle, resolve('public')]) {
      const path = join(directory, pathname);
      try { await access(path); }
      catch (error) { if (error.code === 'ENOENT') continue; throw error; }
      await route.fulfill({ path }); return;
    }
    await route.fulfill({ status: 404, body: `Missing player asset: ${pathname}` });
  });
  await page.route('**/__runtime-qa/project.json', route => route.fulfill({ contentType: 'application/json', body: JSON.stringify(project) }));
  await page.addInitScript(() => {
    localStorage.clear();
    window.__OPENRPG_BOOT__ = { projectUrl: '/__runtime-qa/project.json', saveNamespace: 'shop-decision-qa', qaInstrumentation: true };
  });
  page.on('pageerror', error => report.errors.push(String(error)));
  page.on('console', message => { if (message.type() === 'error') report.errors.push(message.text()); });
  page.on('requestfailed', request => report.networkFailures.push({ url: request.url(), error: request.failure()?.errorText }));
  page.on('response', response => { if (response.status() >= 400) report.networkFailures.push({ url: response.url(), status: response.status() }); });
  await page.goto(`${server.url}/player.html`, { waitUntil: 'domcontentloaded' });
  await ready(page, present('title-screen'));
  await observedAction(page, () => page.keyboard.press('Enter'),
    () => Boolean(window.__oprnDebug && document.querySelector('[data-testid="runtime-state-json"]')), 'Enter: shipping new-game boot');
  // Field setup seam only; all shop behavior below uses focused native keyboard input.
  await page.evaluate(() => { window.__oprnDebug.setSeed(1); window.__oprnInput.face('right'); });
  await observedAction(page, () => page.keyboard.press('e'), present('shop-scene'), 'e: actual field action opens authored shop');
  // Read-only CDP heap inspection obtains the real shipping scene, including fields omitted
  // from the DOM mirror. It neither replaces modules nor changes the session via debug hooks.
  const cdp = await context.newCDPSession(page);
  own(`${id}:cdp`, () => cdp.detach());
  const executionContexts = [];
  cdp.on('Runtime.executionContextCreated', event => executionContexts.push(event.context));
  await cdp.send('Runtime.enable');
  const mainContext = executionContexts.find(context => context.auxData?.isDefault);
  assert.ok(mainContext, 'actual page main execution world');
  report.actions.push({ label: `${id}: CDP main-world selection`, completed: true, executionContexts });
  const proto = await cdp.send('Runtime.evaluate', {
    expression: `(async () => {
      const module = await import(${JSON.stringify(`${server.url}/assets/${sceneModule}`)});
      const namespace = module.PlayScene ? module : Object.values(module).find(value => value?.PlayScene);
      if (!namespace) throw new Error('Shipping scene namespace missing: ' + Object.keys(module));
      return namespace.PlayScene.prototype;
    })()`, awaitPromise: true, contextId: mainContext.id,
  });
  assert.ok(proto.result.objectId, `Shipping PlayScene export unavailable: ${JSON.stringify(proto)}`);
  assert.equal(proto.exceptionDetails, undefined, `Shipping module inspection: ${JSON.stringify(proto)}`);
  const queried = await cdp.send('Runtime.queryObjects', { prototypeObjectId: proto.result.objectId });
  await cdp.send('Runtime.releaseObject', { objectId: proto.result.objectId });
  sessions.set(page, { id, cdp, objectId: queried.objects.objectId });
  own(`${id}:heap-read-handle`, () => cdp.send('Runtime.releaseObject', { objectId: queried.objects.objectId }));
  const initial = await immutable(page);
  assert.equal(initial.gold, project.session.gold);
  assert.deepEqual(initial.partyActorIds, kind === 'no-party' ? [] : project.session.partyActorIds);
  report.actions.push({ label: `${id}: read-only live session acquired (CDP queryObjects)`, completed: true, initial });
  return { page, context, project, id, initial };
}
async function immutable(page) {
  const { cdp, objectId } = sessions.get(page);
  const result = await cdp.send('Runtime.callFunctionOn', { objectId, returnByValue: true,
    functionDeclaration: `function() {
      const scenes = this.filter(scene => scene.session && scene.sys?.settings.key === 'PlayScene');
      if (scenes.length !== 1) throw new Error('Expected one actual PlayScene: ' + JSON.stringify(this.map(scene => ({ keys: Object.keys(scene), key: scene.sys?.settings.key, session: !!scene.session }))));
      const s = scenes[0].session;
      return Object.fromEntries(['gold','inventory','actorEquipment','partyActorIds','actorLevels','actorExperience',
        'classOverrides','growthProgress','promotionLineage','actorParamBonuses','shopTradeCounts',
        'currentMapId','x','y'].map(key => [key, s[key] === undefined ? null : structuredClone(s[key])]));
    }` });
  assert.equal(result.exceptionDetails, undefined, JSON.stringify(result.exceptionDetails));
  return result.result.value;
}
async function unchanged(page, before, label) {
  const after = await immutable(page);
  report.immutability ??= [];
  report.immutability.push({ label, before, after });
  assert.deepEqual(after, before, `${label}: live session must not mutate`);
}
async function settleImages(page) {
  await page.evaluate(async () => {
    await document.fonts.ready;
    await Promise.all([...document.images].map(image => image.decode()));
    await Promise.all((document.querySelector('[data-testid="shop-scene"]')?.getAnimations({ subtree: true }) ?? [])
      .filter(animation => animation.effect?.getTiming().iterations !== Infinity)
      .map(animation => animation.finished.catch(error => { if (error.name !== 'AbortError') throw error; })));
  });
}
async function detailState(page) {
  return page.evaluate(() => {
    const get = id => document.querySelector(`[data-testid="${id}"]`);
    const panel = get('shop-comparison');
    const stats = Object.fromEntries(['attack', 'defense', 'mind', 'agility'].map(key => {
      const node = get(`shop-stat-${key}`);
      return [key, node ? ['current', 'next', 'delta'].map(k => node.hasAttribute(`data-${k}`) ? Number(node.dataset[k]) : null) : null];
    }));
    const effects = Object.fromEntries(['gained', 'lost', 'changed'].map(kind => [kind,
      [...(get(`shop-effects-${kind}`)?.querySelectorAll('[data-effect-key]') ?? [])].map(node => ({ ...node.dataset, text: node.textContent }))]));
    return { kind: panel?.dataset.previewKind, actor: panel?.dataset.actorId ?? null, slot: panel?.dataset.slot ?? null,
      same: panel?.dataset.sameEquipment ?? null, reason: get('shop-preview-reason')?.dataset.reason ?? null,
      actors: [...(panel?.querySelectorAll('.runtime-shop-actor') ?? [])].map(n => n.dataset.testid),
      stats, effects, displaced: [...(get('shop-displaced')?.querySelectorAll('[data-equipment-id]') ?? [])].map(n => ({ id: n.dataset.equipmentId, count: Number(n.dataset.count) })),
      focus: document.activeElement?.dataset.testid, scrollTop: get('shop-detail-scroll')?.scrollTop ?? null };
  });
}
async function capture(page, id, expected = {}) {
  await settleImages(page);
  const observed = { ...await readEconomy(page), detail: await detailState(page) };
  const entry = { id, screenshot: `${id}.png`, expected, observed };
  report.screenshots.push(entry);
  await page.screenshot({ path: join(root, entry.screenshot) });
  await writeFile(join(root, `${id}.json`), JSON.stringify(entry, null, 2));
  for (const [key, value] of Object.entries(expected)) assert.deepEqual(observed.detail[key], value, `${id}: ${key}`);
  console.log(`${id}: ${observed.detail.kind ?? 'stock/field'} / ${observed.focus}`);
  return observed.detail;
}
async function tabTo(page, target, reverse = false) {
  // Each iteration is an actual intentional Tab action, never polling for state.
  const visited = new Set();
  while (true) {
    const id = await page.evaluate(() => document.activeElement?.dataset.testid);
    if (id === target) return;
    assert.ok(!visited.has(id), `Focus ring cannot reach ${target}; ${[...visited]}`);
    visited.add(id);
    await keyUntil(page, reverse ? 'Shift+Tab' : 'Tab', Function(`return document.activeElement?.dataset.testid !== ${JSON.stringify(id)}`), `ring to ${target}`);
  }
}
async function openDetail(page) {
  await tabTo(page, 'shop-detail-open');
  const opener = await page.getByTestId('shop-detail-open').elementHandle();
  await keyUntil(page, 'Enter', present('shop-comparison'), 'open complete comparison');
  return opener;
}
async function closeDetail(page, opener) {
  await focusKey(page, 'Escape', 'shop-detail-open');
  assert.equal(await opener.evaluate(node => node === document.activeElement), true, 'exact original opener, not a replacement');
  await opener.dispose();
}
async function chooseActor(page, id) {
  const current = (await detailState(page)).actor;
  if (current === id) return;
  await tabTo(page, `shop-actor-${current}`);
  let index = Number(current.slice(1));
  while (`a${index}` !== id) {
    index = index % 6 + 1;
    await focusKey(page, 'ArrowDown', `shop-actor-a${index}`);
  }
}
async function chooseRow(page, id) {
  const selectedId = await page.evaluate(() => document.querySelector('.runtime-shop-item-row.selected')?.dataset.testid);
  await tabTo(page, selectedId, true);
  const ids = await page.locator('.runtime-shop-item-row').evaluateAll(nodes => nodes.map(n => n.dataset.testid));
  assert.ok(ids.includes(`shop-buy-${id}`));
  let index = ids.indexOf(selectedId);
  while (ids[index] !== `shop-buy-${id}`) {
    index = (index + 1) % ids.length;
    await focusKey(page, 'ArrowDown', ids[index]);
  }
}
const DOWNGRADE = { attack: [30, 25, -5], defense: [18, 10, -8], mind: [8, 8, 0], agility: [8, 6, -2] };
const CURRENT = { attack: [30, null, null], defense: [18, null, null], mind: [8, null, null], agility: [8, null, null] };
async function compare() {
  const { page, initial } = await boot('compare');
  await focusKey(page, 'Enter', 'shop-buy-candidate');
  await capture(page, '00-comparison-stock');
  let opener = await openDetail(page);
  const base = await capture(page, '01-downgrade-a1', { kind: 'ready', actor: 'a1', stats: DOWNGRADE,
    actors: ['shop-actor-a1', 'shop-actor-a2', 'shop-actor-a3', 'shop-actor-a4', 'shop-actor-a5', 'shop-actor-a6'], displaced: [{ id: 'old', count: 1 }] });
  assert.ok(base.effects.gained.some(e => e.effectKey === 'attackAll'));
  assert.ok(base.effects.lost.some(e => e.effectKey === 'doubleAttack'));
  assert.ok(base.effects.lost.some(e => e.effectId === 'fire' && e.effectName === '불꽃'));
  assert.ok(base.effects.changed.some(e => e.effectKey === 'accuracy' && e.current === '90' && e.next === '80'));
  assert.ok(base.effects.changed.some(e => e.effectKey === 'criticalRate' && e.current === '10' && e.next === '5'));
  await tabTo(page, 'shop-detail-scroll');
  await keyUntil(page, 'End', () => { const n = document.querySelector('[data-testid="shop-detail-scroll"]'); return Math.abs(n.scrollTop + n.clientHeight - n.scrollHeight) < 2; });
  await capture(page, '02-downgrade-effects');
  for (const id of ['a2', 'a3', 'a4', 'a5', 'a6']) {
    await chooseActor(page, id);
    const reason = id === 'a3' ? 'cursedEquipment' : id === 'a5' ? 'fixedEquipment' : null;
    await capture(page, `03-actor-${id}`, { actor: id, reason, kind: reason ? 'blocked' : 'ready', stats: reason ? CURRENT : DOWNGRADE });
  }
  await focusKey(page, 'Tab', 'shop-slot-weapon');
  await focusKey(page, 'ArrowDown', 'shop-slot-shield');
  await capture(page, '04-sixth-offhand', { actor: 'a6', slot: 'shield', kind: 'ready', displaced: [],
    stats: { attack: [30, 35, 5], defense: [18, 18, 0], mind: [8, 8, 0], agility: [8, 8, 0] } });
  await closeDetail(page, opener);
  await chooseRow(page, 'old'); opener = await openDetail(page); await chooseActor(page, 'a1');
  await capture(page, '05-same-item', { kind: 'ready', same: 'true', displaced: [],
    stats: { attack: [30, 30, 0], defense: [18, 18, 0], mind: [8, 8, 0], agility: [8, 8, 0] } });
  await closeDetail(page, opener);
  await chooseRow(page, 'restricted'); opener = await openDetail(page);
  await capture(page, '06-restricted', { kind: 'blocked', reason: 'notEquippable', stats: CURRENT });
  await closeDetail(page, opener);
  await chooseRow(page, 'charm'); opener = await openDetail(page);
  await capture(page, '07-custom-charm', { kind: 'ready', slot: 'charm',
    stats: { attack: [30, 30, 0], defense: [18, 18, 0], mind: [8, 11, 3], agility: [8, 8, 0] } });
  await closeDetail(page, opener);
  await unchanged(page, initial, 'all six actors, blocked/same/offhand/custom comparison');
  await closeFixture(page);
  const two = await boot('twohand');
  await focusKey(two.page, 'Enter', 'shop-buy-twohand');
  opener = await openDetail(two.page);
  const result = await capture(two.page, '08-twohand-replacement', { kind: 'ready', actor: 'a1', slot: 'weapon',
    displaced: [{ id: 'oldhand', count: 1 }, { id: 'oldshield', count: 1 }],
    stats: { attack: [30, 35, 5], defense: [18, 10, -8], mind: [8, 8, 0], agility: [6, 6, 0] } });
  assert.ok(result.effects.lost.some(e => e.effectId === 'fire' && e.effectName === '불꽃'));
  assert.ok(result.effects.lost.some(e => e.effectKey === 'doubleAttack'));
  assert.ok(result.effects.gained.some(e => e.effectKey === 'attackAll'));
  await tabTo(two.page, 'shop-detail-scroll');
  await keyUntil(two.page, 'End', () => { const n = document.querySelector('[data-testid="shop-detail-scroll"]'); return Math.abs(n.scrollTop + n.clientHeight - n.scrollHeight) < 2; });
  await capture(two.page, '09-twohand-effects');
  await closeDetail(two.page, opener);
  await unchanged(two.page, two.initial, 'twohand logical candidate counted once; both originals remain equipped');
  await closeFixture(two.page);
}

async function repeated(page, key, predicate = () => true) {
  const codes = { Enter: 13, Escape: 27, ArrowDown: 40, ArrowRight: 39, x: 88, e: 69, z: 90, Space: 32 };
  const { cdp } = sessions.get(page);
  await observedAction(page, async () => {
    await cdp.send('Input.dispatchKeyEvent', { type: 'keyDown', key: key === 'Space' ? ' ' : key,
      code: key.length === 1 ? `Key${key.toUpperCase()}` : key, windowsVirtualKeyCode: codes[key], autoRepeat: true });
    await cdp.send('Input.dispatchKeyEvent', { type: 'keyUp', key: key === 'Space' ? ' ' : key,
      code: key.length === 1 ? `Key${key.toUpperCase()}` : key, windowsVirtualKeyCode: codes[key] });
  }, predicate, `CDP native autoRepeat key event: ${key} (not an OS-held timing test)`);
}
async function geometry(page, label, detail = false) {
  await settleImages(page);
  const result = await page.evaluate(({ detail }) => {
    const get = id => document.querySelector(`[data-testid="${id}"]`);
    const required = detail ? ['shop-comparison', 'shop-detail-scroll', 'shop-detail-close', 'shop-actor-a1', 'shop-actor-a6',
      'shop-slot-weapon', 'shop-stat-attack', 'shop-stat-defense', 'shop-stat-mind', 'shop-stat-agility', 'shop-replacement',
      'shop-displaced', 'shop-effects-gained', 'shop-effects-lost', 'shop-effects-changed']
      : ['shop-scene', 'shop-buy-candidate', 'shop-tab-buy', 'shop-tab-sell', 'shop-category-all', 'shop-detail-open',
        'shop-quantity-input', 'shop-confirm', 'shop-item-cancel', 'shop-balance-after'];
    const failures = [];
    const rect = node => { const r = node.getBoundingClientRect(); return { left: r.left, top: r.top, right: r.right, bottom: r.bottom, width: r.width, height: r.height }; };
    const exists = Object.fromEntries(required.map(id => [id, Boolean(get(id))]));
    for (const [id, yes] of Object.entries(exists)) if (!yes) failures.push(`missing required ${id}`);
    const box = detail ? get('shop-detail-scroll') : get('shop-scene');
    const bounds = box && rect(box);
    const boxes = Object.fromEntries(required.map(id => [id, get(id) ? rect(get(id)) : null]));
    const footer = document.querySelector(detail ? '.runtime-shop-comparison > .runtime-shop-keyhints' : '.runtime-shop-prompt-panel');
    if (!footer) failures.push('missing required footer');
    const visibleIds = detail ? ['shop-detail-scroll', 'shop-detail-close'] : ['shop-buy-candidate', 'shop-detail-open', 'shop-quantity-input', 'shop-confirm', 'shop-item-cancel', 'shop-balance-after'];
    for (const id of visibleIds) {
      const r = boxes[id];
      if (!r || r.width <= 0 || r.height <= 0 || r.left < -1 || r.right > innerWidth + 1 || r.top < -1 || r.bottom > innerHeight + 1) failures.push(`not visible within viewport: ${id}`);
    }
    if (footer) { const r = rect(footer); if (r.top < 0 || r.bottom > innerHeight + 1 || r.left < 0 || r.right > innerWidth + 1) failures.push('footer outside viewport'); }
    const focus = document.activeElement;
    const f = focus && rect(focus);
    if (!f || f.width <= 0 || f.height <= 0 || f.top < -1 || f.bottom > innerHeight + 1 || f.left < -1 || f.right > innerWidth + 1) failures.push('real focus outside viewport');
    if (document.documentElement.scrollWidth > innerWidth + 1) failures.push('document horizontal overflow');
    if (box && box.scrollWidth > box.clientWidth + 1) failures.push('scroll surface horizontal overflow');
    if (detail && box) {
      const sections = [...box.querySelectorAll('.runtime-shop-comparison-stats > *, .runtime-shop-displaced, .runtime-shop-effects')];
      for (let i = 0; i < sections.length; i++) {
        const r = rect(sections[i]);
        if (r.left < bounds.left - 1 || r.right > bounds.right + 1) failures.push(`comparison horizontal clipping ${i}`);
        if (i && rect(sections[i - 1]).bottom > r.top + 1) failures.push(`comparison overlap ${i}`);
      }
      for (const node of box.querySelectorAll('button, h2, h3, p, [data-effect-key], [data-equipment-id], .runtime-shop-stat')) {
        if (node.scrollWidth > node.clientWidth + 1) failures.push(`text horizontal clipping ${node.dataset.testid ?? node.tagName}`);
      }
    }
    return { viewport: { width: innerWidth, height: innerHeight }, exists, boxes, focus: focus?.dataset.testid, focusBox: f,
      footer: footer && rect(footer), scroll: box && { top: box.scrollTop, height: box.clientHeight, total: box.scrollHeight, width: box.clientWidth, totalWidth: box.scrollWidth }, failures };
  }, { detail });
  report.geometry ??= [];
  report.geometry.push({ label, ...result });
  await writeFile(join(root, `${label}-geometry.json`), JSON.stringify(result, null, 2));
  assert.deepEqual(result.failures, [], `${label}: geometry`);
  return result;
}
async function detailScrollProof(page, id) {
  await tabTo(page, 'shop-detail-scroll');
  await keyUntil(page, 'Home', () => document.querySelector('[data-testid="shop-detail-scroll"]').scrollTop === 0);
  await capture(page, `${id}-detail-home`);
  const home = await geometry(page, `${id}-detail-home`, true);
  const coverage = [{ from: 0, to: home.scroll.height }];
  let top = 0;
  const max = home.scroll.total - home.scroll.height;
  while (top < max - 1) {
    await keyUntil(page, 'PageDown', Function(`return document.querySelector('[data-testid="shop-detail-scroll"]').scrollTop > ${top}`));
    top = await page.getByTestId('shop-detail-scroll').evaluate(n => n.scrollTop);
    coverage.push({ from: top, to: top + home.scroll.height });
  }
  await keyUntil(page, 'End', () => { const n = document.querySelector('[data-testid="shop-detail-scroll"]'); return Math.abs(n.scrollTop + n.clientHeight - n.scrollHeight) < 2; });
  await capture(page, `${id}-detail-bottom`);
  await geometry(page, `${id}-detail-bottom`, true);
  assert.ok(coverage.at(-1).to >= home.scroll.total - 1, 'complete content covered to actual bottom');
  for (let i = 1; i < coverage.length; i++) assert.ok(coverage[i].from <= coverage[i - 1].to + 1, 'no unreachable gap');
  report.scrollCoverage ??= [];
  report.scrollCoverage.push({ id, coverage, total: home.scroll.total, complete: true });
  await keyUntil(page, 'Home', () => document.querySelector('[data-testid="shop-detail-scroll"]').scrollTop === 0);
  await keyUntil(page, 'ArrowDown', () => document.querySelector('[data-testid="shop-detail-scroll"]').scrollTop === 32);
  await repeated(page, 'ArrowDown', () => document.querySelector('[data-testid="shop-detail-scroll"]').scrollTop === 64);
  await focusKey(page, 'Tab', 'shop-detail-close');
  for (const key of ['Enter', 'Escape', 'e', 'z', 'Space', 'x']) await repeated(page, key, focused('shop-detail-close'));
  await focusKey(page, 'Tab', 'shop-actor-a6');
}
async function navigation() {
  for (const viewport of [{ width: 1024, height: 768 }, { width: 640, height: 480 }, { width: 320, height: 240 }]) {
    const { page, initial } = await boot('navigation', viewport);
    const id = `${viewport.width}x${viewport.height}`;
    await focusKey(page, 'Enter', 'shop-buy-candidate');
    await capture(page, `${id}-stock`);
    await geometry(page, `${id}-stock`);
    const ring = ['shop-tab-buy', 'shop-category-all', 'shop-detail-open', 'shop-quantity-input', 'shop-confirm', 'shop-item-cancel', 'shop-buy-candidate'];
    for (const target of ring) await focusKey(page, 'Tab', target);
    for (const target of [...ring].reverse().slice(1).concat('shop-buy-candidate')) await focusKey(page, 'Shift+Tab', target);
    await keyUntil(page, 'ArrowRight', () => document.querySelector('[data-testid="shop-quantity-input"]').value === '2');
    await repeated(page, 'ArrowRight', () => document.querySelector('[data-testid="shop-quantity-input"]').value === '3');
    for (const key of ['Enter', 'e', 'z', 'Space']) await repeated(page, key, goldIs(200));
    await repeated(page, 'Escape', present('shop-confirm'));
    await tabTo(page, 'shop-quantity-input');
    for (const key of ['Enter', 'e', 'z', 'Space']) await keyUntil(page, key, goldIs(200), 'quantity confirm must never trade');
    await tabTo(page, 'shop-buy-candidate');
    await focusKey(page, 'ArrowDown', 'shop-buy-old');
    await repeated(page, 'ArrowDown', focused('shop-buy-twohand'));
    await chooseRow(page, 'candidate');
    await focusKey(page, 'Tab', 'shop-tab-buy');
    await focusKey(page, 'ArrowRight', 'shop-tab-sell');
    assert.equal(await page.getByTestId('shop-buy-candidate').count(), 1, 'arrow alone cannot commit mode');
    await keyUntil(page, 'Enter', present('shop-sell-candidate'), 'direct sell mode commits only on confirm');
    await focusKey(page, 'ArrowLeft', 'shop-tab-buy');
    assert.equal(await page.getByTestId('shop-sell-candidate').count(), 1);
    await keyUntil(page, 'Enter', present('shop-buy-candidate'), 'direct buy mode');
    await focusKey(page, 'Tab', 'shop-category-all');
    await focusKey(page, 'ArrowRight', 'shop-category-equipment');
    await focusKey(page, 'ArrowRight', 'shop-category-consumable');
    assert.equal(await page.getByTestId('shop-buy-candidate').count(), 1, 'category arrow alone cannot filter');
    await keyUntil(page, 'Enter', () => !document.querySelector('[data-testid="shop-buy-candidate"]'), 'commit consumable category');
    await focusKey(page, 'ArrowRight', 'shop-category-all');
    await keyUntil(page, 'z', present('shop-buy-candidate'), 'restore all category');
    const opener = await openDetail(page);
    for (let i = 2; i <= 6; i++) await focusKey(page, 'ArrowDown', `shop-actor-a${i}`);
    await capture(page, `${id}-sixth-actor`, { actor: 'a6', stats: DOWNGRADE });
    await focusKey(page, 'Tab', 'shop-slot-weapon');
    await focusKey(page, 'ArrowDown', 'shop-slot-shield');
    await capture(page, `${id}-offhand`, { slot: 'shield', stats: { attack: [30, 35, 5], defense: [18, 18, 0], mind: [8, 8, 0], agility: [8, 8, 0] } });
    await focusKey(page, 'ArrowUp', 'shop-slot-weapon');
    await detailScrollProof(page, id);
    await closeDetail(page, opener);
    await unchanged(page, initial, `${id}: every native navigation/quantity/held key remains non-mutating`);
    // Actual detached DOM listener audit is labelled synthetic instrumentation, never a user action.
    const stale = await page.getByTestId('shop-buy-candidate').elementHandle();
    await keyUntil(page, 'Escape', present('shop-mode-buy'));
    await keyUntil(page, 'Escape', () => !document.querySelector('[data-testid="shop-scene"]'));
    const afterClose = await immutable(page);
    const staleReceipt = await stale.evaluate(node => {
      const event = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true });
      node.dispatchEvent(event); return { connected: node.isConnected, prevented: event.defaultPrevented };
    });
    assert.deepEqual(staleReceipt, { connected: false, prevented: false });
    await unchanged(page, afterClose, `${id}: detached listener audit after field return`);
    await stale.dispose();
    await capture(page, `${id}-field-return`);
    await closeFixture(page);
  }
  for (const kind of ['no-party', 'non-equipment', 'buyOnly', 'sellOnly', 'empty']) {
    const { page, initial } = await boot(kind, { width: 640, height: 480 });
    if (kind === 'empty') {
      assert.equal(await page.getByTestId('shop-notice-close').count(), 1);
      await capture(page, `${kind}-notice`);
      await keyUntil(page, 'Enter', () => !document.querySelector('[data-testid="shop-scene"]'));
    } else {
      await keyUntil(page, 'Enter', present(kind === 'sellOnly' ? 'shop-item-list-empty' : 'shop-detail-open'));
      if (kind === 'sellOnly') {
        assert.equal(await page.getByTestId('shop-confirm').isDisabled(), true);
        await focusKey(page, 'Tab', 'shop-item-cancel');
        await capture(page, `${kind}-empty-list`);
      } else if (kind === 'buyOnly') {
        await focusKey(page, 'Tab', 'shop-detail-open');
        await focusKey(page, 'Tab', 'shop-confirm');
        assert.equal(await page.getByTestId('shop-quantity-input').count(), 0);
        assert.equal(await page.getByTestId('shop-tab-sell').count(), 0);
        await capture(page, `${kind}-skipped-groups`);
      } else {
        const opener = await openDetail(page);
        await capture(page, `${kind}-unavailable`, { kind: 'unavailable', reason: kind === 'no-party' ? 'noActor' : 'notEquipment',
          stats: { attack: null, defense: null, mind: null, agility: null } });
        await focusKey(page, 'Tab', 'shop-detail-close');
        await focusKey(page, 'Tab', 'shop-detail-scroll');
        await closeDetail(page, opener);
      }
    }
    await unchanged(page, initial, `${kind}: narrow absent-group/unavailable fixture`);
    await closeFixture(page);
  }
}

try {
  console.log(`WORKING ${values.case}: build shipping player and run native-input evidence`);
  report.provenance = { nativeSurface: 'built player.html with export store shim; never editor',
    sessionInspection: 'read-only CDP queryObjects on actual shipping PlayScene; no session writes',
    expectedValues: 'fixed independent numeric oracles; authorable nonnegative equipment bonuses',
    parentVerified: ['typecheck:app EXIT0', 'focused economy 66 tests', 'preview 49 tests', 'input 97 tests', 'npm run build EXIT0 (app/export/standalone)'],
    parentIncomplete: ['npm run gates timed out at 1800s; parent terminated its owned process tree'],
    parentPending: ['separate CSS/surface gates'] };
  await mkdir(resolve('.vite-cache'), { recursive: true });
  bundle = await mkdtemp(resolve('.vite-cache/shop-decision-player-'));
  own(bundle, async () => { await rm(bundle, { recursive: true }); await assert.rejects(access(bundle), { code: 'ENOENT' }); });
  await build({ configFile: resolve('vite.player.config.ts'), build: { outDir: bundle }, logLevel: 'warn' });
  const assets = await readdir(join(bundle, 'assets'));
  sceneModule = assets.find(name => /^PlayScene-.*\.js$/.test(name));
  assert.ok(sceneModule, 'shipping PlayScene chunk');
  report.build = { config: 'vite.player.config.ts', entry: 'player.html', completed: true, sceneModule,
    sha256: createHash('sha256').update(await readFile(join(bundle, 'assets', sceneModule))).digest('hex') };
  server = await startPlayerQaServer(); own(server.url, () => server.close());
  browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--use-gl=swiftshader', '--disable-gpu'] });
  own('chromium', async () => { await browser.close(); assert.equal(browser.isConnected(), false); });
  if (values.case === 'economy') await economy();
  else if (values.case === 'compare') await compare();
  else await navigation();
  assert.deepEqual(report.errors, []);
  assert.deepEqual(report.networkFailures, []);
  report.passed = true;
} catch (error) {
  report.passed = false;
  report.failure = String(error?.stack ?? error);
  console.error(`RED ${values.case}: ${report.failure}`);
  const failureId = `initial-failure-${new Date().toISOString().replace(/[:.]/g, '-')}`;
  report.failureArtifact = failureId;
  await writeFile(join(root, `${failureId}.json`), JSON.stringify(report, null, 2));
  if (page && !page.isClosed()) {
    await page.screenshot({ path: join(root, `${failureId}.png`) });
    await writeFile(join(root, `${failureId}.html`), await page.content());
  }
} finally {
  for (const { receipt, close } of resources.reverse()) {
    if (receipt.closed) continue;
    try { await close(); receipt.closed = true; receipt.closedAt = new Date().toISOString(); }
    catch (error) { receipt.error = String(error); report.passed = false; console.error('Cleanup failed:', receipt); }
  }
  await writeFile(join(root, 'runtime-results.json'), JSON.stringify(report, null, 2));
  await writeFile(join(root, 'action-ledger.json'), JSON.stringify(report.actions, null, 2));
  await writeFile(join(root, 'cleanup.json'), JSON.stringify(report.cleanup, null, 2));
}
process.exitCode = report.passed ? 0 : 1;
