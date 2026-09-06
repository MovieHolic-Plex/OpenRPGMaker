// QA-only economy proof through the built shipping player. No canonical/DB writes.
// Run: node scripts/qa/runtime/shop-decision-report.mjs --case economy
import assert from "node:assert/strict";
import { access, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { parseArgs } from "node:util";
import { chromium } from "@playwright/test";
import { build } from "vite";
import { runRuntimeQa, startPlayerQaServer } from "../../lib/runtimeQaRun.mjs";

const { values } = parseArgs({ options: { case: { type: "string" } } });
assert.equal(values.case, "economy", "Supported case: --case economy");
const root = resolve(process.env.SHOP_DECISION_QA_OUTPUT ?? "reports/shop-decision-2026-09-07/economy");
await mkdir(root, { recursive: true });
const report = { case: values.case, startedAt: new Date().toISOString(), actions: [], screenshots: [], errors: [], networkFailures: [], cleanup: [] };
const resources = [];
function own(resource, close) {
  const receipt = { resource, registeredAt: new Date().toISOString(), closed: false };
  report.cleanup.push(receipt);
  resources.push({ receipt, close });
}

// Arm the exact DOM/state signal before each key. Deadline bounds failure only.
async function keyUntil(page, key, predicate, label) {
  const pending = await page.evaluateHandle((source) => {
    const check = Function(`return (${source})`)();
    let cancel;
    const promise = new Promise((done) => {
      const finish = (ok) => { clearTimeout(deadline); observer.disconnect(); done(ok); };
      const observer = new MutationObserver(() => { if (check()) finish(true); });
      const deadline = setTimeout(() => finish(false), 10000);
      cancel = () => finish(false);
      observer.observe(document.body, { subtree: true, childList: true, attributes: true, characterData: true });
    });
    return { promise, cancel: () => cancel() };
  }, predicate.toString());
  const action = { key, label, completed: false };
  report.actions.push(action);
  try {
    await page.keyboard.press(key);
    action.completed = await pending.evaluate((entry) => entry.promise);
    assert.equal(action.completed, true, `Missing state signal: ${label}`);
    action.state = await readEconomy(page);
  } finally {
    await pending.evaluate((entry) => entry.cancel());
    await pending.dispose();
  }
}
const selected = (id) => Function(`return document.querySelector('[data-testid="${id}"]')?.getAttribute('aria-current') === 'true'`);
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

let page;
try {
  const project = JSON.parse(await readFile("test/fixtures/projects/item-runtime-qa-v3.json", "utf8"));
  project.meta.title = "Shop economy QA";
  project.session.gold = 100;
  project.session.inventory = {};
  const equipment = project.database.equipment.find((entry) => entry.id === "equip_sword");
  assert.ok(equipment);
  equipment.price = 40;
  assert.equal(project.database.items.some((entry) => entry.id === equipment.id), false);
  const map = project.maps[project.startMapId];
  const graphic = structuredClone(map.events[0].pages[0].graphic);
  const command = { kind: "shop", itemIds: [equipment.id], allowSell: true, shopType: "normal",
    quantityMode: "select", merchantGold: 200, messageType: "welcome", branchOnTransaction: false,
    transactionBranch: [], branchOnFailedTransaction: false, failedTransactionBranch: [] };
  map.events = [{ id: "qa_shop_economy", x: 15, y: 18, trigger: { kind: "action" }, commands: [], pages: [{
    id: "qa_shop_economy_page", name: "QA", conditions: [], graphic, trigger: { kind: "action" }, priority: "same",
    movement: { type: "fixed", speed: 3, frequency: 3 }, commands: [command],
  }] }];
  const fixturePath = join(root, "qa-fixture.json");
  await writeFile(fixturePath, JSON.stringify(project));
  report.fixture = { equipmentId: equipment.id, basePrice: equipment.price, command, playerGold: 100 };

  await mkdir(resolve('.vite-cache'), { recursive: true });
  const bundle = await mkdtemp(resolve('.vite-cache/shop-decision-player-'));
  own(bundle, async () => {
    await rm(bundle, { recursive: true });
    await assert.rejects(access(bundle), { code: 'ENOENT' });
  });
  await build({ configFile: resolve('vite.player.config.ts'), build: { outDir: bundle }, logLevel: 'warn' });
  report.build = { config: 'vite.player.config.ts', entry: 'player.html', completed: true };
  const server = await startPlayerQaServer();
  own(server.url, () => server.close());
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--use-gl=swiftshader', '--disable-gpu'] });
  own('chromium', async () => { await browser.close(); assert.equal(browser.isConnected(), false); });
  const context = await browser.newContext({ viewport: { width: 1024, height: 768 } });
  own('browser-context', () => context.close());
  page = await context.newPage();
  own('player-page', async () => { await page.close(); assert.equal(page.isClosed(), true); });
  await page.route(`${server.url}/**`, async (route) => {
    const pathname = decodeURIComponent(new URL(route.request().url()).pathname);
    for (const directory of [bundle, resolve('public')]) {
      const path = join(directory, pathname);
      try { await access(path); }
      catch (error) { if (error.code === 'ENOENT') continue; throw error; }
      await route.fulfill({ path });
      return;
    }
    await route.fulfill({ status: 404, body: `Missing player asset: ${pathname}` });
  });
  page.on('pageerror', (error) => report.errors.push(String(error)));
  page.on('console', (message) => { if (message.type() === 'error') report.errors.push(message.text()); });
  page.on('requestfailed', (request) => report.networkFailures.push({ url: request.url(), error: request.failure()?.errorText }));
  page.on('response', (response) => { if (response.status() >= 400) report.networkFailures.push({ url: response.url(), status: response.status() }); });
  const boot = await runRuntimeQa(page, {
    id: 'shop-decision-economy', viewport: { width: 1024, height: 768 }, projectFixture: fixturePath,
    beats: [
      { id: 'field-start', ops: [{ kind: 'key', key: 'Enter' }, { kind: 'waitForRuntime' }, { kind: 'seed', seed: 1 }],
        expect: { gold: 100, mapId: project.startMapId, x: 14, y: 18 } },
      { id: 'entrance', ops: [{ kind: 'face', dir: 'right' }, { kind: 'action' }],
        expect: { testidPresent: ['shop-scene', 'shop-mode-buy', 'shop-mode-sell'] }, shot: true },
    ],
  }, { serverUrl: server.url, outDir: join(root, 'boot') });
  assert.deepEqual(boot.errors, []);
  assert.deepEqual(boot.beats.flatMap((beat) => beat.failures), []);
  report.actions.push({ label: 'shipping boot and entrance', ops: ['Enter', 'waitForRuntime', 'seed:1', 'face:right', 'action'], completed: true });
  await snapshot(page, '00-entrance', { gold: 100, inventory: {}, owned: 0 });
  await keyUntil(page, 'Enter', selected('shop-buy-equip_sword'), 'open buy list');
  await snapshot(page, '01-stock', { gold: 100, playerGold: 100, merchantGold: 200, owned: 0, cap: 2, quantityMax: '2', quantity: '1', unitPrice: 40, displayedPrice: 40, total: 40 });
  await keyUntil(page, 'ArrowRight', () => document.querySelector('[data-testid="shop-quantity-input"]').value === '2', 'buy quantity two');
  await snapshot(page, '02-buy-two', { gold: 100, merchantGold: 200, quantity: '2', total: 80 });
  await keyUntil(page, 'e', goldIs(20), 'buy two equipment');
  const bought = { gold: 20, playerGold: 20, merchantGold: 280, inventory: { equip_sword: 2 }, owned: 2, displayedOwned: 2, cap: 0, quantityMax: '1', quantity: '1', total: 40, tradeCounts: { equip_sword: { bought: 2, sold: 0 } } };
  await snapshot(page, '03-bought', bought);
  await keyUntil(page, 'e', () => document.querySelector('[data-testid="shop-buy-equip_sword"]').classList.contains('juice-menu-invalid'), 'reject zero-capacity purchase');
  await snapshot(page, '04-rejected', bought);
  // Existing keyboard path until the separate input increment lands: entrance -> sell.
  await keyUntil(page, 'Escape', present('shop-mode-sell'), 'return to entrance');
  await keyUntil(page, 'ArrowDown', selected('shop-mode-sell'), 'select sell');
  await keyUntil(page, 'Enter', selected('shop-sell-equip_sword'), 'open sell list');
  await snapshot(page, '05-sell-stock', { gold: 20, merchantGold: 280, owned: 2, cap: 2, quantityMax: '2', quantity: '1', unitPrice: 20, displayedPrice: 20, total: 20 });
  await keyUntil(page, 'ArrowRight', () => document.querySelector('[data-testid="shop-quantity-input"]').value === '2', 'sell quantity two');
  await snapshot(page, '06-sell-two', { gold: 20, merchantGold: 280, quantity: '2', total: 40 });
  await keyUntil(page, 'e', goldIs(60), 'sell final two equipment');
  await snapshot(page, '07-sold-last-copy', { gold: 60, playerGold: 60, merchantGold: 240, inventory: {}, owned: 0, rows: 0, selected: null, tradeCounts: { equip_sword: { bought: 2, sold: 2 } } });
  assert.equal(await page.getByTestId('shop-sell-equip_sword').count(), 0);
  await keyUntil(page, 'Escape', present('shop-mode-buy'), 'return to entrance');
  await keyUntil(page, 'Escape', () => !document.querySelector('[data-testid="shop-scene"]'), 'close shop');
  await snapshot(page, '08-field-return', { gold: 60, inventory: {}, x: 14, y: 18 });
  assert.deepEqual(report.errors, []);
  assert.deepEqual(report.networkFailures, []);
  report.passed = true;
} catch (error) {
  report.passed = false;
  report.failure = String(error?.stack ?? error);
  console.error(report.failure);
  if (page && !page.isClosed()) {
    await page.screenshot({ path: join(root, 'failure.png') });
    await writeFile(join(root, 'failure.html'), await page.content());
  }
} finally {
  for (const { receipt, close } of resources.reverse()) {
    try { await close(); receipt.closed = true; receipt.closedAt = new Date().toISOString(); }
    catch (error) { receipt.error = String(error); report.passed = false; console.error('Cleanup failed:', receipt); }
  }
  await writeFile(join(root, 'runtime-results.json'), JSON.stringify(report, null, 2));
  await writeFile(join(root, 'action-ledger.json'), JSON.stringify(report.actions, null, 2));
  await writeFile(join(root, 'cleanup.json'), JSON.stringify(report.cleanup, null, 2));
}
process.exitCode = report.passed ? 0 : 1;
