// Engine-only menu contracts on a detached existing fixture, using the shipping
// player harness. No authored game or remote project is changed.
// node scripts/qa/runtime/menu-design.probe.mjs [skin ...]
import assert from 'node:assert/strict';
import { chromium, expect } from '@playwright/test';
import { mkdir, readFile, writeFile, copyFile, rm } from 'node:fs/promises';
import { startPlayerQaServer } from '../../lib/runtimeQaRun.mjs';

const allSkins = ['workbench', 'party-first', 'party-first-warm', 'hub', 'sheet', 'classic', 'journal', 'ribbon', 'retro-2000', 'retro-2003', 'classic-xp', 'classic-vx'];
const skins = process.argv.slice(2).length ? process.argv.slice(2) : allSkins;
for (const skin of skins) assert(allSkins.includes(skin), `Unknown skin ${skin}`);
const out = process.env.OPRN_MENU_QA_OUT ?? 'verify-shots/runtime-qa/menu-design';
await mkdir(out, { recursive: true });
const base = JSON.parse(await readFile('test/fixtures/projects/item-runtime-qa-v3.json', 'utf8'));
const server = await startPlayerQaServer();
const browser = await chromium.launch({ args: ['--no-sandbox', '--use-gl=swiftshader', '--disable-gpu'] });
const results = [];
const lines = ['# Menu design: shipping-player keyboard QA', '', 'Engine contract copy of item-runtime-qa-v3.json. No remote content writes.', ''];
async function shot(page, skin, name) {
  const path = `${out}/${skin}-${name}.png`;
  await page.screenshot({ path });
  lines.push(`- 즉시 확인: ${skin}-${name}.png`);
  return path;
}
async function backToRail(page) {
  for (let i = 0; i < 10; i++) {
    if (await page.getByTestId('main-menu').getAttribute('data-status-menu-screen') === 'main') return;
    await page.keyboard.press('x');
  }
  throw new Error('Cancel did not return to rail');
}
async function rail(page, skin, id) {
  await backToRail(page);
  for (let i = 0; i < 14; i++) {
    if (await page.locator(`[data-testid="status-menu-command-${id}"].selected`).count()) break;
    await page.keyboard.press(['hub', 'sheet', 'ribbon'].includes(skin) ? 'ArrowRight' : 'ArrowDown');
  }
  await expect(page.getByTestId(`status-menu-command-${id}`)).toHaveClass(/selected/);
  await page.keyboard.press('z');
}
async function choose(page, id) {
  for (let i = 0; i < 32; i++) {
    if (await page.locator(`[data-testid="${id}"].selected`).count()) break;
    await page.keyboard.press('ArrowDown');
  }
  await expect(page.getByTestId(id)).toHaveClass(/selected/);
  await page.keyboard.press('z');
}
async function visibleInside(page, selector, parentSelector) {
  const result = await page.evaluate(([selector, parentSelector]) => {
    const node = document.querySelector(selector), parent = document.querySelector(parentSelector);
    if (!node || !parent) return { missing: selector };
    const a = node.getBoundingClientRect(), b = parent.getBoundingClientRect();
    return { visible: a.width > 0 && a.height > 0 && getComputedStyle(node).visibility !== 'hidden',
      inside: a.x >= b.x - 1 && a.y >= b.y - 1 && a.right <= b.right + 1 && a.bottom <= b.bottom + 1,
      a: { x: a.x, y: a.y, w: a.width, h: a.height }, b: { x: b.x, y: b.y, w: b.width, h: b.height } };
  }, [selector, parentSelector]);
  assert(result.visible && result.inside, `${selector}: ${JSON.stringify(result)}`);
}
try {
  for (const skin of skins) {
    const page = await browser.newPage({ viewport: { width: 960, height: 720 }, reducedMotion: 'reduce' });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    const project = structuredClone(base);
    project.system.menuUiStyle = skin;
    // Enable the existing optional growth surface to exercise tabbed menu layouts.
    project.growth = { initialPoints: 0, pointsPerLevel: 0, classPositions: {}, skillTrees: [] };
    const potion = project.database.items.find(item => item.id === 'item_potion');
    Object.assign(potion, { consumptionLimit: 1, consumable: true });
    project.session.inventory.item_potion = 1;
    const beforeCount = Object.values(project.session.inventory).filter(n => n > 0).length;
    const namespace = `runtime-qa:menu-design:${skin}`;
    const checks = [];
    try {
      await page.addInitScript(namespace => {
        window.__OPENRPG_BOOT__ = { projectUrl: '/__menu-design/project.json', saveNamespace: namespace, qaInstrumentation: true };
      }, namespace);
      await page.route('**/__menu-design/project.json', route => route.fulfill({ contentType: 'application/json', body: JSON.stringify(project) }));
      await page.goto(`${server.url}/player.html?e2eVitals=1`, { waitUntil: 'domcontentloaded' });
      await expect(page.getByTestId('title-screen')).toBeVisible({ timeout: 120000 });
      await page.keyboard.press('Enter');
      await page.waitForFunction(() => window.__oprnDebug?.readState().currentMapId, undefined, { timeout: 120000 });
      await expect(page.getByTestId('play-loading-overlay')).toHaveCount(0, { timeout: 120000 });
      await page.evaluate(() => window.__oprnSetActorVitals('actor_hero', 100, 5));
      // Walk through the real field input path before opening the menu.
      const initialPosition = await page.evaluate(() => (() => { const { x, y } = window.__oprnDebug.readState(); return { x, y }; })());
      await page.keyboard.down('ArrowDown');
      await page.waitForFunction(before => { const now = window.__oprnDebug.readState(); return now.x !== before.x || now.y !== before.y; }, initialPosition, { timeout: 10000 });
      await page.keyboard.up('ArrowDown');
      const walkedPosition = await page.evaluate(() => { const { x, y } = window.__oprnDebug.readState(); return { x, y }; });
      await page.keyboard.press('x');
      await expect(page.getByTestId('main-menu')).toHaveAttribute('data-menu-skin', skin);
      await page.waitForTimeout(180);
      for (const button of await page.locator('.status-menu-command').all()) {
        const id = await button.getAttribute('data-testid');
        await visibleInside(page, `[data-testid="${id}"]`, '[data-testid="main-menu"]');
      }
      for (let member = 0; member < 4; member++) {
        if (await page.getByTestId(`status-menu-overview-row-${member}`).count()) {
          for (const vital of ['hp', 'mp']) await visibleInside(page,
            `[data-testid="status-menu-overview-row-${member}"] .status-menu-overview-vital:has([data-testid="status-menu-overview-${vital}-${member}"])`,
            `[data-testid="status-menu-overview-row-${member}"]`);
        }
      }
      if (skin === 'classic-xp') {
        await expect(page.locator('.status-menu-character')).toHaveCount(4);
        const art = await page.getByTestId('status-menu-overview-character-0').evaluate(node => getComputedStyle(node).backgroundImage);
        assert.notEqual(art, 'none', 'XP walking character has rendered artwork');
      }
      const landing = await shot(page, skin, '01-main');
      checks.push(`field movement (${initialPosition.x},${initialPosition.y}) → (${walkedPosition.x},${walkedPosition.y}); rail inside stage`);
      if (skin === 'hub') await expect(page.getByTestId('status-menu-command-summary-items')).toHaveText(`${beforeCount}종`);
      await page.keyboard.press('z');
      await expect(page.getByTestId('status-menu-item-item_potion')).toBeVisible();
      await expect(page.getByTestId('status-menu-item-facts')).toContainText('50');
      await visibleInside(page, '[data-testid="status-menu-item-facts"]', '[data-testid="status-menu-detail"]');
      await shot(page, skin, '02-item-effects');
      checks.push('real item effect facts visible inside panel');
      // One intentional use consumes the last copy and heals the live actor.
      await choose(page, 'status-menu-item-item_potion');
      await expect(page.getByTestId('status-menu-item-target-actor_hero')).toContainText('100/514');
      await page.keyboard.press('z');
      await expect(page.getByTestId('status-menu-item-item_potion')).toHaveCount(0);
      await backToRail(page);
      if (skin === 'hub') {
        await expect(page.getByTestId('status-menu-command-summary-items')).toHaveText(`${beforeCount - 1}종`);
        await expect(page.getByTestId('status-menu-command-summary-party-menu')).not.toContainText('위험');
      }
      checks.push(skin === 'hub' ? 'last item consumed; hub inventory/health summaries refreshed' : 'last item consumed');
      await rail(page, skin, 'items');
      await page.keyboard.press('ArrowLeft');
      await expect(page.getByTestId('main-menu')).toHaveAttribute('data-status-menu-screen', 'main');
      if (['hub', 'sheet', 'ribbon'].includes(skin)) {
        await expect(page.getByTestId('status-menu-controls')).toContainText('↑↓←→ 이동');
        await page.keyboard.press('ArrowRight');
        await expect(page.getByTestId('status-menu-command-skills')).toHaveClass(/selected/);
        await expect(page.getByTestId('main-menu')).toHaveAttribute('data-status-menu-screen', 'main');
      }
      checks.push('left-return instructions match keyboard navigation');
      // Party landing already owns a full overview: no legacy panel may overlap it.
      if (!['party-first', 'party-first-warm', 'sheet'].includes(skin)) {
        await rail(page, skin, 'party-menu');
        await expect(page.getByTestId('status-menu-party')).toBeVisible();
        await page.keyboard.press('x');
        if (skin !== 'workbench') await expect(page.getByTestId('status-menu-party')).toHaveCount(0);
        await shot(page, skin, '05-party-selected');
      }
      checks.push('party submenu opens; no duplicate panel on landing');
      await rail(page, skin, 'skills');
      await page.keyboard.press('z');
      await expect(page.getByTestId('growth-menu-tab-skills')).toBeVisible();
      await visibleInside(page, '.life-ledger-tabs', '[data-testid="status-menu-detail"]');
      await expect(page.getByTestId('status-menu-side-party')).toHaveCount(0);
      await choose(page, 'growth-menu-tab-tree');
      await expect(page.getByTestId('growth-menu-tab-tree')).toHaveAttribute('aria-selected', 'true');
      await shot(page, skin, '06-skill-tabs');
      checks.push('skill tabs reachable and kept outside side-party layout');
      // Equipment actor -> slot -> candidate, including stat comparison geometry.
      await rail(page, skin, 'equipment');
      await page.keyboard.press('z');
      await page.keyboard.press('z');
      await expect(page.getByTestId('status-menu-stat-delta')).toBeVisible();
      await visibleInside(page, '[data-testid="status-menu-stat-delta"]', '[data-testid="status-menu-detail"]');
      for (const button of await page.locator('.status-menu-command').all()) {
        const id = await button.getAttribute('data-testid');
        await visibleInside(page, `[data-testid="${id}"]`, '.status-menu-command-rail');
      }
      await shot(page, skin, '03-equipment');
      checks.push('equipment candidate and stat comparison reachable');
      await rail(page, skin, 'system-menu');
      await choose(page, 'status-menu-group-command-wait');
      await backToRail(page);
      if (skin === 'hub') await expect(page.getByTestId('status-menu-command-summary-system-menu')).toContainText('대기 OFF');
      checks.push(skin === 'hub' ? 'wait toggle; hub summary reflects OFF' : 'wait toggle');
      // Actual save -> load -> reopen menu with the selected skin preserved.
      await rail(page, skin, ['party-first', 'party-first-warm', 'sheet'].includes(skin) ? 'save' : 'system-menu');
      if (!['party-first', 'party-first-warm', 'sheet'].includes(skin)) await choose(page, 'status-menu-group-command-save');
      await choose(page, 'save-slot-1');
      const stored = await page.evaluate(namespace => JSON.parse(localStorage.getItem(`${namespace}:save-slot:v5:1`)), namespace);
      assert(stored, 'save slot persisted');
      assert.equal(stored.session.inventory.item_potion ?? 0, 0);
      assert.equal(stored.session.actorVitals.actor_hero.hp, 150);
      await rail(page, skin, 'system-menu');
      await choose(page, 'status-menu-group-command-load');
      await choose(page, 'load-slot-1');
      await expect(page.getByTestId('main-menu')).toHaveCount(0);
      await page.waitForFunction(() => window.__oprnDebug?.readState().currentMapId, undefined, { timeout: 120000 });
      await page.keyboard.press('x');
      await expect(page.getByTestId('main-menu')).toHaveAttribute('data-menu-skin', skin);
      await shot(page, skin, '04-loaded');
      checks.push('HP 100 → 150 and inventory persisted by real save/load');
      await rail(page, skin, 'items');
      await page.keyboard.press('ArrowLeft');
      for (const viewport of [{ width: 640, height: 480 }, { width: 1280, height: 800 }]) {
        await page.setViewportSize(viewport);
        await page.waitForTimeout(100);
        await visibleInside(page, '[data-testid="status-menu-command-rail"]', '[data-testid="main-menu"]');
        for (const node of await page.locator('.status-menu-overview-row, .status-menu-strip-card').all()) {
          const id = await node.getAttribute('data-testid');
          await visibleInside(page, `[data-testid="${id}"]`, '[data-testid="main-menu"]');
        }
        await shot(page, skin, `07-${viewport.width}x${viewport.height}`);
      }
      checks.push('640×480 and 1280×800 layout bounds');
      assert.deepEqual(errors, []);
      await rm(`${out}/${skin}-FAIL.png`, { force: true });
      if (['classic', 'journal', 'ribbon', 'retro-2000', 'retro-2003', 'classic-xp', 'classic-vx'].includes(skin)) await copyFile(landing, `public/assets/ui/menu-skins/${skin}.png`);
      results.push({ skin, ok: true, checks, initialPosition });
      lines.push(`\n## ${skin}: PASS`, ...checks.map(check => `- ${check}`), '');
      console.log(`${skin}: PASS (${checks.length} checks)`);
    } catch (error) {
      await shot(page, skin, 'FAIL');
      results.push({ skin, ok: false, checks, error: String(error), pageErrors: errors });
      lines.push(`\n## ${skin}: FAIL`, String(error), '');
      console.error(`${skin}: ${String(error)}`);
    } finally { await page.close(); }
  }
} finally {
  await browser.close();
  await server.close();
  await writeFile(`${out}/SUMMARY.md`, lines.join('\n') + '\n');
  await writeFile(`${out}/results.json`, JSON.stringify(results, null, 2));
}
process.exitCode = results.every(result => result.ok) ? 0 : 1;
