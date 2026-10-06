// Focused exported-player probe. Requires npm run dev:worktree, no suites or DB writes.
// OPRN_QA_URL=http://127.0.0.1:9844 OPRN_SHOP_PLAYER_DIR=/tmp/... node scripts/qa/runtime/emerald-shop-native.probe.mjs
import assert from 'node:assert/strict';
import { writeFile, mkdir, access } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { chromium } from '@playwright/test';
import { runRuntimeQa } from '../../lib/runtimeQaRun.mjs';
import { shopFixture } from './shop-decision-fixtures.mjs';
const url = process.env.OPRN_QA_URL;
if (!url) throw Error('Set OPRN_QA_URL to the assigned dev:worktree server.');
const playerDir = resolve(process.env.OPRN_SHOP_PLAYER_DIR ?? 'dist/export-player');
const out = resolve(process.env.OPRN_SHOP_QA_OUT ?? 'verify-shots/runtime-qa/emerald-shop');
await mkdir(out, { recursive: true });
const { project } = await shopFixture('economy');
project.meta.oprnMonsterStyle = { version: 1, reference: 'emerald' };
project.meta.oprnShopPreset = 'collector';
project.system.playResolution = { width: 480, height: 320 };
project.system.cameraZoom = 2;
const item = project.database.equipment.find(item => item.id === 'equip_sword');
item.name = '여행 검'; item.description = '동료와 함께 먼 길을 걸을 때 사용하는 가벼운 검입니다. 상점 수량과 확인 단계의 실제 거래를 확인합니다.';
const fixture = join(out, 'fixture.json'); await writeFile(fixture, JSON.stringify(project));
const browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--use-gl=swiftshader'] });
const errors = [], record = { detachedFixture: true, shippingPlayer: true, canonicalSaved: false, frames: [], checks: [] };
try {
 const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
 page.on('pageerror', error => errors.push(error.message));
 await page.route(url + '/**', async route => {
   const path = decodeURIComponent(new URL(route.request().url()).pathname);
   if (path === '/__runtime-qa/project.json') return route.fallback();
   for (const root of [playerDir, resolve('public')]) {
     const target = join(root, path); try { await access(target); } catch { continue; }
     await route.fulfill({ path: target }); return;
   }
   await route.fulfill({ status: 404, body: 'Missing asset: ' + path });
 });
 const boot = await runRuntimeQa(page, { id: 'emerald-shop', viewport: { width: 1280, height: 800 }, projectFixture: fixture,
   beats: [{ id: 'field', ops: [{ kind: 'key', key: 'Enter' }, { kind: 'waitForRuntime' }] },
     { id: 'entrance', ops: [{ kind: 'face', dir: 'right' }, { kind: 'action' }, { kind: 'waitForVisible', testid: 'shop-mode-buy' }] }],
 }, { serverUrl: url, outDir: join(out, 'boot') });
 assert.deepEqual(boot.beats.flatMap(beat => beat.failures), []);
 const state = () => page.evaluate(() => { const state = window.__oprnDebug.readState(); return { gold: state.gold, owned: state.inventory.equip_sword ?? 0 }; });
 const phase = async name => { await page.locator(`[data-testid="shop-scene"][data-shop-phase="${name}"]`).waitFor(); };
 const key = async key => { await page.keyboard.press(key); };
 const shot = async name => { await page.screenshot({ path: join(out, name + '.png') }); record.frames.push(name + '.png'); };
 await phase('menu'); await shot('01-greeting-desktop');
 await key('ArrowDown'); await key('Enter'); await phase('items');
 assert.equal(await page.locator('[data-testid^="shop-sell-"]').count(), 0);
 await page.getByTestId('shop-selling-bag').waitFor(); await key('Escape'); await phase('menu');
 await key('ArrowUp'); record.checks.push('Empty owned bag remains navigable');
 await key('Enter'); await phase('items');
 await page.locator('[data-testid="shop-map-view"][data-map-source="game-canvas-snapshot"]').waitFor();
 await shot('02-buy-desktop');
 const descriptionBefore = await page.locator('.emerald-shop-description-copy').evaluate(node => node.scrollTop);
 await key('PageDown');
 assert(await page.locator('.emerald-shop-description-copy').evaluate(node => node.scrollTop) > descriptionBefore);
 await key('Home'); record.checks.push('Long description scrolls while owned count stays visible');
 assert.equal(await page.locator('.runtime-shop-tab,[data-testid="shop-quantity-input"],[data-testid="shop-confirm"]').count(), 0);
 const before = await state(); assert.deepEqual(before, { gold: 100, owned: 0 });
 await page.keyboard.down('Enter'); await page.keyboard.down('Enter'); await page.keyboard.down('Enter');
 await phase('quantity'); assert.deepEqual(await state(), before); await page.keyboard.up('Enter');
 await key('ArrowRight'); assert.match(await page.getByTestId('shop-quantity-value').innerText(), /02/);
 await shot('03-quantity-desktop'); await key('Enter'); await phase('confirm');
 assert.deepEqual(await state(), before); await shot('04-confirm-desktop');
 await key('ArrowDown'); await key('Enter'); await phase('items'); assert.deepEqual(await state(), before);
 record.checks.push('No preserves money and inventory');
 await key('Enter'); await key('ArrowUp'); await key('Enter'); await phase('confirm');
 await key('Escape'); await phase('quantity'); assert.deepEqual(await state(), before);
 await key('Enter'); await key('Enter'); await phase('receipt');
 assert.deepEqual(await state(), { gold: 20, owned: 2 }); await shot('05-purchase-receipt');
 await page.keyboard.down('Enter'); await phase('items'); await page.keyboard.down('Enter'); await phase('items'); await page.keyboard.up('Enter');
 assert.deepEqual(await state(), { gold: 20, owned: 2 });
 record.checks.push('Held Enter advances only one phase; purchase atomic');
 await key('Enter'); await phase('receipt'); assert.match(await page.getByTestId('shop-status').innerText(), /부족/);
 assert.deepEqual(await state(), { gold: 20, owned: 2 }); await key('Enter');
 await key('Escape'); await phase('menu'); await key('ArrowDown'); await key('Enter'); await phase('items');
 await page.getByTestId('shop-selling-bag').waitFor(); await shot('06-sell-desktop');
 await key('Enter'); await key('ArrowUp'); await key('Enter'); await phase('confirm'); await key('ArrowDown'); await key('Enter');
 assert.deepEqual(await state(), { gold: 20, owned: 2 }); await phase('items');
 await key('Enter'); await key('ArrowUp'); await key('Enter'); await key('Enter'); await phase('receipt');
 assert.deepEqual(await state(), { gold: 60, owned: 0 }); await key('Enter'); await phase('items');
 assert.equal(await page.getByTestId('shop-sell-equip_sword').count(), 0);
 record.checks.push('Selling real bag, No, exact payout and last-stack depletion');
 await key('Escape'); await phase('menu'); await key('ArrowUp'); await key('Enter'); await phase('items');
 await page.setViewportSize({ width: 390, height: 600 }); await shot('07-buy-compact');
 const bounds = await page.getByTestId('shop-scene').evaluate(root => {
   const r = root.getBoundingClientRect(), shell = root.querySelector('.emerald-shop-shell').getBoundingClientRect();
   return { x:r.x, y:r.y, width:r.width, height:r.height, shellWidth:shell.width, shellHeight:shell.height,
     descriptionFont:parseFloat(getComputedStyle(root.querySelector('.emerald-shop-description')).fontSize) * r.width / 480 };
 });
 assert(bounds.x >= 0 && bounds.x + bounds.width <= 391 && bounds.width / bounds.height > 1.49 && bounds.width / bounds.height < 1.51);
 assert(bounds.descriptionFont >= 11); record.bounds = bounds;
 await key('Escape'); await key('Escape'); await page.getByTestId('shop-scene').waitFor({ state: 'detached' });
 record.checks.push('Compact fits 3:2 bounds with readable text; nested cancel closes');
 const legacy = structuredClone(project); delete legacy.meta.oprnMonsterStyle;
 const legacyFixture = join(out, 'legacy-fixture.json'); await writeFile(legacyFixture, JSON.stringify(legacy));
 const legacyBoot = await runRuntimeQa(page, { id: 'collector-unchanged', viewport: { width: 640, height: 480 }, projectFixture: legacyFixture,
   beats: [{ id: 'field', ops: [{ kind: 'key', key: 'Enter' }, { kind: 'waitForRuntime' }] },
     { id: 'entrance', ops: [{ kind: 'face', dir: 'right' }, { kind: 'action' }, { kind: 'waitForVisible', testid: 'shop-mode-buy' }] }],
 }, { serverUrl: url, outDir: join(out, 'legacy-boot') });
 assert.deepEqual(legacyBoot.beats.flatMap(beat => beat.failures), []);
 assert.equal(await page.getByTestId('shop-scene').getAttribute('data-monster-style'), null);
 await key('Enter'); await page.getByTestId('shop-buy-equip_sword').waitFor();
 await page.getByTestId('shop-quantity-input').waitFor(); await key('Enter');
 assert.deepEqual(await state(), { gold: 60, owned: 1 });
 record.checks.push('Collector without Emerald profile keeps original direct trade and numeric input');
 assert.deepEqual(errors, []); record.errors = errors;
 await writeFile(join(out,'native.json'), JSON.stringify(record, null, 2));
 await writeFile(join(out,'SUMMARY.md'), '# Emerald shop native probe\n\nDetached existing engine fixture, built player.html with export store shim. No canonical writes, suites or typecheck. Native shop keys verified; fixture boot uses existing QA face/action hooks. Actual authored game and old-save Continue remain supervisor-owned.\n\n' + record.checks.map(check => '- ' + check).join('\n') + '\n\n## 즉시 확인\n\n' + record.frames.map(frame => '- ' + frame).join('\n') + '\n');
 console.log(JSON.stringify(record));
} finally { await browser.close(); }
