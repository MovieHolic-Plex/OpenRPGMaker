// QA-only shipping-player capture. No canonical project or DB writes.
// Run: node scripts/qa/runtime/ingame-shop-report.mjs
import assert from "node:assert/strict";
import { access, readFile, writeFile, mkdir } from "node:fs/promises";
import { resolve, join } from "node:path";
import { chromium } from "@playwright/test";
import { build } from "vite";
import { startPlayerQaServer, runRuntimeQa } from "../../lib/runtimeQaRun.mjs";

const ROOT = resolve(process.env.SHOP_QA_OUTPUT ?? "reports/ingame-shop-2026-09-06");
const fixturePath = join(ROOT, "qa-fixture.json");
const project = JSON.parse(await readFile("test/fixtures/projects/item-runtime-qa-v3.json", "utf8"));
project.meta.title = "상점 런타임 QA · 로컬 테스트 구성";
project.session.gold = 300;
project.session.inventory = { item_potion: 1, item_antidote: 2 };
const map = project.maps[project.startMapId];
const graphic = structuredClone(map.events[0].pages[0].graphic);
map.events = [{
  id: "qa_shop", x: 15, y: 18, trigger: { kind: "action" }, commands: [],
  pages: [{
    id: "qa_shop_page", name: "QA 거래", conditions: [], graphic,
    trigger: { kind: "action" }, priority: "same",
    movement: { type: "fixed", speed: 3, frequency: 3 },
    commands: [{ kind: "shop", itemIds: ["item_potion", "item_ether", "equip_sword", "item_elixir"],
      stock: [{ itemId: "item_potion", priceOverride: 50 }, { itemId: "item_ether", priceOverride: 120 },
        { itemId: "equip_sword", priceOverride: 100 }, { itemId: "item_elixir", priceOverride: 600 }],
      allowSell: true, shopType: "normal", quantityMode: "select", merchantGold: 200,
      messageType: "welcome", branchOnTransaction: false, transactionBranch: [],
      branchOnFailedTransaction: false, failedTransactionBranch: [] }],
  }],
}];
await mkdir(ROOT, { recursive: true });
await writeFile(fixturePath, JSON.stringify(project));

// Subscribe before input; timeout is a failure bound, never a delay or retry.
async function keyUntil(page, key, predicate, label) {
  await page.evaluate(({ source, label }) => {
    const check = Function(`return (${source})`)();
    window.__shopQaSignal = new Promise((resolveSignal) => {
      const observer = new MutationObserver(() => {
        if (!check()) return;
        clearTimeout(timer); observer.disconnect(); resolveSignal({ ok: true });
      });
      const timer = setTimeout(() => {
        observer.disconnect(); resolveSignal({ ok: false, label });
      }, 10000);
      observer.observe(document.body, { subtree: true, childList: true, attributes: true, characterData: true });
    });
  }, { source: predicate.toString(), label });
  await page.keyboard.press(key);
  const result = await page.evaluate(() => window.__shopQaSignal);
  assert.equal(result.ok, true, `No exact state signal: ${label}`);
}
const selected = (id) => Function(`return document.querySelector('[data-testid="${id}"]')?.getAttribute('aria-current') === 'true'`);
const goldIs = (gold) => Function(`return window.__oprnDebug.readState().gold === ${gold}`);
const present = (id) => Function(`return Boolean(document.querySelector('[data-testid="${id}"]'))`);

// One shipping boot, then responsive captures of the same transaction state.
// This avoids the observed ERR_NETWORK_CHANGED module-load storm on new contexts.
async function snapshot(page, _dir, id, expected, screenshots) {
  for (const [width, height] of [[1024, 768], [640, 480], [320, 240]]) {
    const dir = join(ROOT, 'rich', `${width}x${height}`);
    await mkdir(dir, { recursive: true });
    await page.setViewportSize({ width, height });
    await captureSnapshot(page, dir, id, expected, screenshots);
  }
  await page.setViewportSize({ width: 1024, height: 768 });
}

async function captureSnapshot(page, dir, id, expected, screenshots) {
  await page.evaluate(async () => {
    await document.fonts.ready;
    const overlay = document.querySelector('[data-testid="shop-scene"]');
    await Promise.all((overlay?.getAnimations({ subtree: true }) ?? [])
      .filter((animation) => animation.effect?.getTiming().iterations !== Infinity)
      .map((animation) => animation.finished.catch((error) => {
        // Runtime feedback removes its animation class on completion. A canceled
        // Web Animation is also settled; unrelated errors must still fail QA.
        if (error.name !== 'AbortError') throw error;
      })));
  });
  const data = await page.evaluate(() => {
    const debug = window.__oprnDebug.readState();
    const mirror = JSON.parse(document.querySelector('[data-testid="runtime-state-json"]').textContent);
    const overlay = document.querySelector('[data-testid="shop-scene"]');
    const rectOf = (node) => {
      if (!node) return null;
      const r = node.getBoundingClientRect();
      return { x: r.x, y: r.y, width: r.width, height: r.height, right: r.right, bottom: r.bottom };
    };
    const geometry = {};
    for (const selector of ['.runtime-shop-shell', '.runtime-shop-topbar', '.runtime-shop-item-list',
      '.runtime-shop-item-row.selected', '.runtime-shop-side', '.runtime-shop-prompt-panel',
      '[data-testid="shop-quantity-input"]', '[data-testid="shop-quantity-total"]',
      '[data-testid="shop-confirm"]', '[data-testid="shop-item-cancel"]', '[data-testid="shop-player-gold"]']) {
      const node = overlay?.querySelector(selector);
      if (node) geometry[selector] = rectOf(node);
    }
    const row = overlay?.querySelector('.runtime-shop-item-row.selected');
    const mode = overlay?.querySelector('[data-shop-mode]')?.dataset.shopMode;
    const merchantGold = Number(overlay?.querySelector('[data-testid="shop-merchant-gold"] .runtime-shop-gold-value')?.textContent.replace(/[^0-9]/g, ''));
    const input = overlay?.querySelector('[data-testid="shop-quantity-input"]');
    const unit = Number(row?.dataset.unitPrice);
    const itemId = row?.dataset.testid.replace(/^shop-(buy|sell)-/, '');
    const capacity = row ? Math.max(1, Math.min(99, unit > 0 ? Math.floor((mode === 'buy' ? debug.gold : merchantGold) / unit) : 99,
      mode === 'sell' ? debug.inventory[itemId] ?? 0 : 99)) : null;
    const warnings = [];
    if (input && Number(input.max) !== capacity) warnings.push(`stale quantity max: DOM ${input.max}, current funds/inventory ${capacity}`);
    const layoutFailures = [];
    for (const [selector, r] of Object.entries(geometry)) {
      if (r.width <= 0 || r.height <= 0 || r.x < -1 || r.y < -1 || r.right > innerWidth + 1 || r.bottom > innerHeight + 1) {
        layoutFailures.push(`${selector}: outside viewport or zero size`);
      }
    }
    const list = geometry['.runtime-shop-item-list'];
    const selected = geometry['.runtime-shop-item-row.selected'];
    if (list && selected && (selected.y < list.y - 1 || selected.bottom > list.bottom + 1)) layoutFailures.push('selected row clipped by list viewport');
    const footer = geometry['.runtime-shop-prompt-panel'];
    if (footer && list && list.bottom > footer.y + 1) layoutFailures.push('list overlaps footer');
    if (document.documentElement.scrollWidth > innerWidth) layoutFailures.push('document horizontal overflow');
    const urls = [...new Set(Array.from(overlay?.querySelectorAll('[data-item-icon-resource], [data-face-resource-id]') ?? [])
      .map((node) => getComputedStyle(node).backgroundImage.match(/^url\(["']?(.*?)["']?\)$/)?.[1]).filter(Boolean))];
    return { url: location.href, gold: debug.gold, inventory: debug.inventory, actorEquipment: mirror.actorEquipment,
      tradeCounts: mirror.shopTradeCounts, x: debug.x, y: debug.y, merchantGold,
      mode, selected: row?.dataset.testid, quantity: input?.value, quantityMax: input?.max,
      total: overlay?.querySelector('[data-testid="shop-quantity-total"]')?.textContent,
      totalAmount: Number(overlay?.querySelector('[data-testid="shop-quantity-total"]')?.textContent.replace(/[^0-9]/g, '')),
      status: overlay?.querySelector('[data-testid="shop-status-text"]')?.textContent,
      equippedText: overlay?.querySelector('[data-testid="shop-owned-panel"]')?.textContent,
      statsText: overlay?.querySelector('[data-testid="shop-detail-stats"]')?.textContent,
      geometry, warnings, layoutFailures, artworkUrls: urls };
  });
  const failures = [];
  for (const [key, value] of Object.entries(expected)) {
    try { assert.deepEqual(data[key], value); } catch { failures.push(`${key}: expected ${JSON.stringify(value)}, got ${JSON.stringify(data[key])}`); }
  }
  const artwork = await page.evaluate(async (urls) => Promise.all(urls.map(async (url) => {
    const image = new Image(); image.src = url;
    try { await image.decode(); return { url, loaded: image.naturalWidth > 0, width: image.naturalWidth, height: image.naturalHeight }; }
    catch (error) { return { url, loaded: false, error: String(error) }; }
  })), data.artworkUrls);
  for (const image of artwork) if (!image.loaded) failures.push(`artwork failed: ${image.url}`);
  const shot = `${id}.png`;
  await page.screenshot({ path: join(dir, shot) });
  const entry = { id, shot, viewport: page.viewportSize(), ...data, artwork, failures };
  screenshots.push(entry);
  await writeFile(join(dir, 'evidence.json'), JSON.stringify(screenshots.filter((entry) => entry.viewport.width === page.viewportSize().width), null, 2));
  console.log(`${dir.split('/').at(-1)} ${id}: functional=${failures.length}, layout=${data.layoutFailures.length}, warnings=${data.warnings.length}`);
  assert.equal(failures.length, 0, failures.join('; '));
}

// Bundle the shipping player rather than asking Chromium to fetch the entire
// dev module graph. File-backed routes avoid shared-host network-change storms.
const playerDir = resolve('.vite-cache/ingame-shop-player');
await build({ configFile: resolve('vite.player.config.ts'),
  build: { outDir: playerDir }, logLevel: 'warn' });
const server = await startPlayerQaServer();
const browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--use-gl=swiftshader', '--disable-gpu'] });
const runs = [];
try {
  for (const [width, height] of [[1024, 768]]) {
    const id = `${width}x${height}`;
    const dir = join(ROOT, 'rich', id);
    await mkdir(dir, { recursive: true });
    const page = await browser.newPage();
    await page.route(`${server.url}/**`, async (route) => {
      const pathname = decodeURIComponent(new URL(route.request().url()).pathname);
      for (const root of [playerDir, resolve('public')]) {
        const path = join(root, pathname);
        try { await access(path); }
        catch (error) {
          if (error.code === 'ENOENT') continue;
          throw error;
        }
        await route.fulfill({ path });
        return;
      }
      await route.fulfill({ status: 404, body: `Missing player asset: ${pathname}` });
    });
    const errors = [], networkFailures = [], screenshots = [];
    page.on('pageerror', (error) => errors.push(String(error)));
    page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
    page.on('requestfailed', (request) => networkFailures.push({ url: request.url(), error: request.failure()?.errorText }));
    page.on('response', (response) => { if (response.status() >= 400) networkFailures.push({ url: response.url(), status: response.status() }); });
    const run = { viewport: { width, height }, errors, networkFailures, screenshots, failures: [] };
    runs.push(run);
    try {
      const boot = await runRuntimeQa(page, {
        id: `ingame-shop-${id}`, viewport: { width, height }, projectFixture: fixturePath,
        beats: [
          { id: 'field-start', ops: [{ kind: 'key', key: 'Enter' }, { kind: 'waitForRuntime' }, { kind: 'seed', seed: 1 }],
            expect: { gold: 300, mapId: project.startMapId, x: 14, y: 18 } },
          { id: 'entrance', ops: [{ kind: 'face', dir: 'right' }, { kind: 'action' },
            { kind: 'waitFor', testid: 'shop-mode-buy', state: 'present' }, { kind: 'waitForVisible', testid: 'shop-mode-buy' }],
            expect: { testidPresent: ['shop-scene', 'shop-mode-buy', 'shop-mode-sell'] }, shot: true },
        ],
      }, { serverUrl: server.url, outDir: join(dir, 'boot') });
      assert.equal(boot.errors.length + boot.beats.reduce((n, b) => n + b.failures.length, 0), 0, JSON.stringify(boot));
      await snapshot(page, dir, '00-entrance', { gold: 300, inventory: { item_potion: 1, item_antidote: 2 } }, screenshots);
      await keyUntil(page, 'Enter', selected('shop-buy-item_potion'), 'buy list');
      await snapshot(page, dir, '01-stock', { gold: 300, merchantGold: 200, quantity: '1', inventory: { item_potion: 1, item_antidote: 2 } }, screenshots);
      await keyUntil(page, 'ArrowRight', () => document.querySelector('[data-testid="shop-quantity-total"]').textContent.includes('100'), 'quantity two');
      await keyUntil(page, 'ArrowRight', () => document.querySelector('[data-testid="shop-quantity-total"]').textContent.includes('150'), 'quantity three');
      await snapshot(page, dir, '02-quantity', { quantity: '3', totalAmount: 150, gold: 300, inventory: { item_potion: 1, item_antidote: 2 } }, screenshots);
      await keyUntil(page, 'Enter', goldIs(150), 'buy three potions');
      await snapshot(page, dir, '03-purchased', { gold: 150, merchantGold: 350, inventory: { item_potion: 4, item_antidote: 2 } }, screenshots);
      await keyUntil(page, 'ArrowDown', selected('shop-buy-item_ether'), 'select ether');
      await keyUntil(page, 'ArrowDown', selected('shop-buy-equip_sword'), 'select equipment');
      await keyUntil(page, 'ArrowLeft', () => document.querySelector('[data-testid="shop-quantity-input"]').value === '1', 'explicit equipment quantity one');
      await snapshot(page, dir, '04-equipment', { gold: 150, quantity: '1', selected: 'shop-buy-equip_sword', inventory: { item_potion: 4, item_antidote: 2 } }, screenshots);
      assert.match(screenshots.at(-1).statsText, /8/);
      assert.equal(screenshots.at(-1).actorEquipment.actor_hero.weapon, 'equip_sword');
      assert.equal(screenshots.at(-1).actorEquipment.actor_guardian.weapon, 'equip_sword');
      await keyUntil(page, 'Enter', goldIs(50), 'buy equipment');
      await snapshot(page, dir, '05-equipment-bought', { gold: 50, merchantGold: 450, inventory: { item_potion: 4, item_antidote: 2, equip_sword: 1 } }, screenshots);
      await keyUntil(page, 'ArrowDown', selected('shop-buy-item_elixir'), 'select unaffordable');
      await keyUntil(page, 'Enter', () => document.querySelector('[data-testid="shop-buy-item_elixir"]').classList.contains('juice-menu-invalid'), 'reject unaffordable');
      await snapshot(page, dir, '06-insufficient-gold', { gold: 50, merchantGold: 450, inventory: { item_potion: 4, item_antidote: 2, equip_sword: 1 } }, screenshots);
      await keyUntil(page, 'Escape', present('shop-mode-sell'), 'return to entrance');
      await keyUntil(page, 'ArrowDown', selected('shop-mode-sell'), 'select sell');
      await keyUntil(page, 'Enter', selected('shop-sell-item_potion'), 'sell list');
      await keyUntil(page, 'ArrowRight', () => document.querySelector('[data-testid="shop-quantity-total"]').textContent.includes('50'), 'sell quantity two');
      await keyUntil(page, 'Enter', goldIs(100), 'sell two potions');
      await snapshot(page, dir, '07-sold', { gold: 100, merchantGold: 400, inventory: { item_potion: 2, item_antidote: 2, equip_sword: 1 } }, screenshots);
      await keyUntil(page, 'ArrowDown', selected('shop-sell-item_antidote'), 'select unstocked owned item');
      await keyUntil(page, 'Enter', goldIs(130), 'sell last antidotes');
      await snapshot(page, dir, '08-last-copy', { gold: 130, merchantGold: 370, selected: 'shop-sell-equip_sword', inventory: { item_potion: 2, equip_sword: 1 } }, screenshots);
      assert.equal(await page.getByTestId('shop-sell-item_antidote').count(), 0);
      await keyUntil(page, 'Enter', goldIs(180), 'sell purchased equipment');
      await snapshot(page, dir, '09-equipment-sold', { gold: 180, merchantGold: 320, selected: 'shop-sell-item_potion', inventory: { item_potion: 2 } }, screenshots);
      assert.equal(await page.getByTestId('shop-sell-equip_sword').count(), 0);
      await keyUntil(page, 'Escape', present('shop-mode-buy'), 'back to entrance');
      await keyUntil(page, 'Escape', () => !document.querySelector('[data-testid="shop-scene"]'), 'close shop');
      await snapshot(page, dir, '10-field-return', { gold: 180, x: 14, y: 18, inventory: { item_potion: 2 } }, screenshots);
      assert.equal(errors.length, 0, errors.join('\n'));
      assert.equal(networkFailures.length, 0, JSON.stringify(networkFailures));
    } catch (error) {
      run.failures.push(String(error));
      await page.screenshot({ path: join(dir, 'failure.png') });
      await writeFile(join(dir, 'failure.html'), await page.content());
      console.error(id, String(error));
    } finally {
      await writeFile(join(dir, 'run.json'), JSON.stringify(run, null, 2));
      await page.close();
    }
  }
} finally {
  await browser.close(); await server.close();
  await writeFile(join(ROOT, 'runtime-results.json'), JSON.stringify(runs, null, 2));
}
process.exitCode = runs.some((run) => run.failures.length || run.errors.length || run.networkFailures.length
  || run.screenshots.some((shot) => shot.failures.length || shot.layoutFailures.length)) ? 1 : 0;
