import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { firefox } from 'playwright';

const baseUrl = process.env.SIDEBAR_QA_URL ?? 'http://127.0.0.1:9842';
const output = process.env.SIDEBAR_QA_OUTPUT ?? 'output/evidence/sidebar-focus/r1/browser';
await mkdir(output, { recursive: true });
const browser = await firefox.launch({ headless: true });
const results = [];

async function boot() {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  page.setDefaultTimeout(90000);
  await page.addInitScript(() => {
    localStorage.setItem('oprn:ai-panel-collapsed', '1');
    window.r1Ready = new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('EditScene readiness missing')), 120000);
      let hook;
      Object.defineProperty(window, '__oprnEditWorldToClient', { configurable: true, get: () => hook,
        set: value => { hook = value; clearTimeout(timer); resolve(); } });
    });
  });
  async function ready() {
    await page.evaluate(() => window.r1Ready);
    await page.evaluate(() => document.fonts.ready);
    await page.evaluate(async () => {
      const { store } = await import('/src/project/store.ts');
      const { editorState } = await import('/src/editor/editorState.ts');
      if (store.remotePersistenceEnabled !== false) throw new Error('R1 QA must remain local-only');
      window.r1 = { store, state: editorState };
    });
  }
  await page.goto(`${baseUrl}/?freshProject=1`, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await ready();
  const click = id => page.getByTestId(id).click({ noWaitAfter: true });
  async function command(query, id) {
    await page.keyboard.press('Control+k');
    await page.getByTestId('command-palette-search').fill(query);
    await click(`command-palette-item-command-${id}`);
  }
  const mapId = () => page.evaluate(() => window.r1.state.get().currentMapId);
  async function openContextMenu(id) {
    const row = page.getByTestId(`map-tree-node-${id}`);
    await row.scrollIntoViewIfNeeded();
    const box = await row.boundingBox();
    assert(box);
    await page.evaluate(id => {
      window.r1ContextMenu = new Promise((resolve, reject) => {
        const observer = new MutationObserver(() => {
          if (!document.querySelector(`[data-testid="map-context-menu-${id}"]`)) return;
          observer.disconnect(); clearTimeout(timer); resolve();
        });
        const timer = setTimeout(() => { observer.disconnect(); reject(new Error('Context menu did not mount')); }, 30000);
        observer.observe(document.body, { childList: true });
      });
    }, id);
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2, { button: 'right' });
    await page.evaluate(() => window.r1ContextMenu);
  }
  const reload = async () => { await page.reload({ waitUntil: 'domcontentloaded', timeout: 120000 }); await ready(); };
  return { page, context, click, command, mapId, reload, openContextMenu };
}

async function scenario(name, run) {
  const harness = await boot();
  try {
    const observed = await run(harness);
    await harness.page.screenshot({ path: `${output}/${name}.png` });
    results.push({ name, status: 'PASS', observed });
  } catch (error) {
    await harness.page.screenshot({ path: `${output}/${name}.png` });
    const state = await harness.page.evaluate(() => ({ mode: document.body.dataset.editorUiMode, focus: document.activeElement?.outerHTML.slice(0, 700),
      surfaces: [...document.querySelectorAll('[data-sidebar-surface]')].map(node => node.dataset.sidebarSurface), text: document.body.innerText.slice(0, 2800) }));
    results.push({ name, status: 'FAIL', error: String(error), state });
  } finally {
    await harness.context.close();
    await writeFile(`${output}/results.json`, JSON.stringify(results, null, 2));
    console.log(JSON.stringify(results.at(-1)));
  }
}

try {
  await scenario('context-menu-pointer', async ({ page, click, mapId, openContextMenu }) => {
    const id = await mapId();
    const observations = [];
    for (const [width, height] of [[1440, 900], [1280, 800], [1024, 768]]) {
      console.log(`context pointer ${width}x${height}`);
      await page.setViewportSize({ width, height });
      const geometry = await page.evaluate(() => {
        const sheet = document.querySelector('.left-panel .chipset-sheet').getBoundingClientRect();
        const sidebar = document.querySelector('.left-panel').getBoundingClientRect();
        const toolbar = document.querySelector('[data-testid="oprn-tile-toolbar"]');
        return { sheet: sheet.height, sidebar: sidebar.height, ratio: sheet.height / sidebar.height,
          canvas: document.querySelector('.canvas-area').getBoundingClientRect().width, toolbarScroll: toolbar.scrollWidth > toolbar.clientWidth };
      });
      assert(geometry.canvas >= 520 && !geometry.toolbarScroll);
      if (width === 1440) assert(geometry.ratio >= .6);
      await click('sidebar-map-switcher');
      await openContextMenu(id);
      const rename = page.getByTestId(`map-menu-rename-${id}`);
      const hit = await rename.evaluate(node => {
        const box = node.getBoundingClientRect();
        return { inside: node.contains(document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2)),
          menuZ: getComputedStyle(node.closest('.map-context-menu')).zIndex,
          surfaceZ: getComputedStyle(document.querySelector('[data-sidebar-surface="maps"]')).zIndex };
      });
      assert(hit.inside, 'Rename must be above the owning map surface');
      await page.screenshot({ path: `${output}/context-menu-${width}x${height}.png` });
      const box = await rename.boundingBox();
      console.log('rename pointer activation');
      await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
      assert.equal(await page.getByTestId('sidebar-map-surface').count(), 1);
      const input = page.getByTestId(`map-rename-${id}`);
      assert.equal(await input.count(), 1);
      const original = await input.inputValue();
      console.log('rename cancel input');
      await input.fill(`${original} QA`);
      await page.keyboard.press('Escape');
      console.log('rename cancel returned');
      assert.equal(await page.getByTestId('sidebar-map-surface').count(), 1);
      assert.equal(await page.evaluate(id => window.r1.store.getCurrent().maps[id].name, id), original);
      await openContextMenu(id);
      console.log('rename commit activation');
      await click(`map-menu-rename-${id}`);
      await page.getByTestId(`map-rename-${id}`).fill(`${original} QA`);
      await page.keyboard.press('Enter');
      console.log('rename commit returned');
      assert.equal(await page.evaluate(id => window.r1.store.getCurrent().maps[id].name, id), `${original} QA`);
      await page.keyboard.press('Escape');
      observations.push({ width, height, geometry, renameHit: hit, cancelAndCommit: true });
    }
    return observations;
  });
  await scenario('context-menu-keyboard', async ({ page, click, mapId }) => {
    const id = await mapId();
    const observed = [];
    for (const [width, height] of [[1440, 900], [1280, 800], [1024, 768]]) {
      await page.setViewportSize({ width, height });
      await click('sidebar-map-switcher');
      await page.getByTestId(`map-tree-node-${id}`).focus();
      await page.keyboard.press('Shift+F10');
      await page.keyboard.press('End'); await page.keyboard.press('Home');
      await page.keyboard.press('ArrowDown'); await page.keyboard.press('ArrowDown');
      assert.equal(await page.evaluate(() => document.activeElement?.dataset.testid), `map-menu-rename-${id}`);
      await page.keyboard.press('Enter');
      assert.equal(await page.getByTestId(`map-rename-${id}`).count(), 1);
      await page.keyboard.press('Escape');
      await page.keyboard.press('Shift+F10');
      await page.keyboard.press('Escape');
      assert.equal(await page.getByTestId(`map-context-menu-${id}`).count(), 0);
      assert.equal(await page.getByTestId('sidebar-map-surface').count(), 1, 'first Escape closes only child menu');
      assert.equal(await page.evaluate(() => document.activeElement?.dataset.testid), `map-tree-node-${id}`);
      await page.keyboard.press('Escape');
      assert.equal(await page.getByTestId('sidebar-map-surface').count(), 0);
      assert.equal(await page.evaluate(() => document.activeElement?.dataset.testid), 'sidebar-map-switcher');
      observed.push({ width, height, keyboardRename: true, layeredEscape: true });
    }
    return observed;
  });
  await scenario('surface-lifecycle', async ({ page, click }) => {
    for (const [trigger, id] of [['sidebar-tools-menu', 'tools'], ['palette-brush-assist-toggle', 'assist']]) {
      await click(trigger);
      assert.equal(await page.locator(`[data-sidebar-surface="${id}"]`).count(), 1);
      await page.keyboard.press('Escape');
      assert.equal(await page.locator('[data-sidebar-surface]').count(), 0);
      assert.equal(await page.evaluate(() => document.activeElement?.dataset.testid), trigger);
    }
    await click('sidebar-tools-menu');
    await page.evaluate(async () => {
      const { teardownEditor } = await import('/src/editor/panels/editor.ts');
      teardownEditor();
    });
    assert.equal(await page.locator('[data-sidebar-surface]').count(), 0, 'unmount must remove owned surfaces');
    await page.evaluate(async () => {
      const { renderEditor } = await import('/src/editor/panels/editor.ts');
      renderEditor(document.querySelector('.main'));
    });
    assert.equal(await page.locator('[data-sidebar-surface]').count(), 0, 'remount must not restore old open state');
    await click('sidebar-tools-menu'); await click('sidebar-tools-close');
    assert.equal(await page.getByTestId('sidebar-tools-menu').getAttribute('aria-expanded'), 'false');
    return { toolsAndAssist: true, teardownRemount: true };
  });
  await scenario('header-reveal', async ({ page, click, mapId, reload }) => {
    const id = await mapId();
    for (const persisted of [false, true]) {
      await click('map-tree-section-toggle');
      if (persisted) await reload();
      assert.equal(await page.getByTestId('map-tree-section-toggle').getAttribute('aria-expanded'), 'false');
      await click('sidebar-map-switcher');
      assert.equal(await page.getByTestId('map-tree-section-toggle').getAttribute('aria-expanded'), 'true');
      assert(await page.getByTestId(`map-tree-node-${id}`).isVisible());
      assert.equal(await page.evaluate(() => document.activeElement?.dataset.testid), `map-tree-node-${id}`);
    }
    const splitter = page.getByTestId('map-tree-height-resizer');
    const before = await page.getByTestId('left-map-root').boundingBox();
    await splitter.focus(); await page.keyboard.press('ArrowUp');
    assert.notEqual((await page.getByTestId('left-map-root').boundingBox()).height, before.height);
    const handle = await splitter.boundingBox();
    const beforePointer = await page.getByTestId('left-map-root').boundingBox();
    await page.mouse.move(handle.x + handle.width / 2, handle.y + handle.height / 2);
    await page.mouse.down();
    await page.mouse.move(handle.x + handle.width / 2, handle.y - 16);
    await page.mouse.up();
    assert.notEqual((await page.getByTestId('left-map-root').boundingBox()).height, beforePointer.height);
    return { collapsedAndReloaded: true, keyboardResize: true, pointerResize: true };
  });
  await scenario('inspection-host-activation', async ({ page, click, command, mapId, reload }) => {
    const id = await mapId();
    const observed = [];
    for (const pinned of [false, true]) for (const inspection of ['inspector', 'ruleAudit', 'history']) {
      console.log(`inspection ${inspection} pinned=${pinned}`);
      if (pinned) { await click('oprn-tool-overflow'); await click(`sidebar-pin-${inspection}`); await page.keyboard.press('Escape'); }
      await click('workspace-panels-button'); await click('workspace-panel-toggle-tiles');
      await page.keyboard.press('Escape');
      assert.equal(await page.getByTestId('left-palette-root').count(), 0);
      await reload();
      assert.equal(await page.getByTestId('left-palette-root').count(), 0);
      await command(inspection, `sidebar-inspection-${inspection}`);
      assert.equal(await page.getByTestId('left-palette-root').count(), 1, 'inspection command must activate missing host');
      const panel = pinned ? page.getByTestId({ inspector: 'tile-inspector-dropdown', ruleAudit: 'tile-rule-audit-dropdown', history: 'tile-history-dropdown' }[inspection]) : page.getByTestId('toolbar-overflow-dropdown');
      assert(await panel.isVisible());
      assert(await panel.evaluate(node => node.contains(document.activeElement)), 'focus must enter the requested inspection surface');
      assert.equal(await mapId(), id);
      await page.keyboard.press('Escape');
      const trigger = pinned ? { inspector: 'oprn-tool-inspector', ruleAudit: 'toolbar-toggle-ruleAudit', history: 'toolbar-toggle-history' }[inspection] : 'oprn-tool-overflow';
      assert.equal(await page.evaluate(() => document.activeElement?.dataset.testid), trigger);
      await command(inspection, `sidebar-inspection-${inspection}`);
      assert(await panel.isVisible());
      await page.keyboard.press('Escape');
      observed.push({ inspection, pinned, mapsOnlyReload: true, mountedHost: true });
    }
    return observed;
  });
} finally {
  await browser.close();
}
if (results.some(result => result.status === 'FAIL')) process.exitCode = 1;
