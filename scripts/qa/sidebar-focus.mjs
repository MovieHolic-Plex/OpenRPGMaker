import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';
import { sidebarFocusInteractions } from './sidebar-focus-interactions.mjs';

const phase = process.argv[2] ?? 'after';
const output = process.env.SIDEBAR_QA_OUTPUT ?? `output/evidence/sidebar-focus/${phase}`;
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await context.newPage();
const baseUrl = process.env.SIDEBAR_QA_URL ?? 'http://127.0.0.1:9898';
// Chromium's loopback requests are cancelled by this host's network changes.
// Relay GET bytes only; the actual browser still executes the shipped app.
await page.route('**/*', async route => {
  const request = route.request();
  if (request.method() !== 'GET' || new URL(request.url()).origin !== new URL(baseUrl).origin) return route.continue();
  const response = await fetch(request.url(), { signal: AbortSignal.timeout(90000) });
  await route.fulfill({ status: response.status, headers: Object.fromEntries(response.headers), body: Buffer.from(await response.arrayBuffer()) });
});
page.setDefaultTimeout(90000);
const errors = [];
page.on('pageerror', error => errors.push(error.message));
page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
page.on('requestfailed', request => errors.push(`${request.url()}: ${request.failure()?.errorText}`));
await page.addInitScript(() => {
  localStorage.setItem('oprn:editor-ui-mode', 'standard');
  localStorage.setItem('oprn:ai-panel-collapsed', '1');
  window.sidebarReady = new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('EditScene readiness missing')), 120000);
    let hook;
    Object.defineProperty(window, '__oprnEditWorldToClient', {
      configurable: true, get: () => hook,
      set: value => { hook = value; clearTimeout(timeout); resolve(); },
    });
  });
});
async function mode(value) {
  await page.evaluate(value => {
    window.sidebarModeChanged = new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Mode event missing')), 10000);
      window.addEventListener('oprn:editor-ui-mode', event => {
        clearTimeout(timeout);
        if (event.detail.mode === value) resolve();
        else reject(new Error('Wrong mode event'));
      }, { once: true });
    });
  }, value);
  await page.getByTestId('workspace-panels-button').click({ noWaitAfter: true });
  await page.getByTestId(`workspace-ui-mode-${value}`).click({ noWaitAfter: true });
  await page.evaluate(() => window.sidebarModeChanged);
  assert.equal(await page.locator('body').getAttribute('data-editor-ui-mode'), value);
}
const measurements = [];
try {
  await page.goto(`${baseUrl}/?freshProject=1`, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.evaluate(() => window.sidebarReady);
  await page.evaluate(async () => {
    const { store } = await import('/src/project/store.ts');
    const { editorState } = await import('/src/editor/editorState.ts');
    if (store.remotePersistenceEnabled !== false) throw new Error('QA requires disabled remote persistence');
    window.sidebarQa = { store, state: editorState };
  });
  if (process.env.SIDEBAR_QA_POINTER_ONLY) {
    await page.getByTestId('tool-erase').click({ noWaitAfter: true });
    await page.getByTestId('sidebar-tools-menu').click({ noWaitAfter: true });
    const paint = await page.getByTestId('tool-paint').boundingBox();
    await page.mouse.click(paint.x + paint.width / 2, paint.y + paint.height / 2);
    const actual = await page.evaluate(() => window.sidebarQa.state.get().tool);
    await writeFile(`${output}/outside-pointer.json`, JSON.stringify({ expected: 'paint', actual }));
    assert.equal(actual, 'paint', 'outside pointer click must not merely dismiss Tools');
  }
  for (const value of ['standard', 'expert', 'beginner']) {
    await mode(value);
    for (const [width, height] of [[1440, 900], [1280, 800], [1024, 768]]) {
      await page.setViewportSize({ width, height });
      await page.evaluate(() => document.fonts.ready);
      await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
      const measured = await page.evaluate(() => {
        const rect = selector => document.querySelector(selector)?.getBoundingClientRect().toJSON();
        const sidebar = rect('.left-panel');
        const sheet = rect('.left-panel .chipset-sheet');
        const toolbar = document.querySelector('[data-testid="oprn-tile-toolbar"]');
        const mainToolbar = document.querySelector('.studio-bar');
        const clippedControls = [...document.querySelectorAll('.left-panel button, .left-panel input, .left-panel select')].flatMap(node => {
          if (node.closest('.chipset-sheet, .map-tree-list, .sidebar-surface') || node.disabled) return [];
          const box = node.getBoundingClientRect();
          if (!box.width || !box.height) return [];
          let clip = { left: 0, top: 0, right: innerWidth, bottom: innerHeight };
          for (let parent = node.parentElement; parent; parent = parent.parentElement) {
            const style = getComputedStyle(parent), bounds = parent.getBoundingClientRect();
            if (/(auto|scroll|hidden|clip)/.test(style.overflowX)) { clip.left = Math.max(clip.left, bounds.left); clip.right = Math.min(clip.right, bounds.right); }
            if (/(auto|scroll|hidden|clip)/.test(style.overflowY)) { clip.top = Math.max(clip.top, bounds.top); clip.bottom = Math.min(clip.bottom, bounds.bottom); }
          }
          const hit = document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2);
          const contained = box.left >= clip.left - 1 && box.right <= clip.right + 1 && box.top >= clip.top - 1 && box.bottom <= clip.bottom + 1;
          return contained && (hit === node || node.contains(hit)) ? [] : [{ id: node.dataset.testid, box: box.toJSON(), clip, hit: hit?.getAttribute('data-testid') ?? hit?.className }];
        });
        return {
          sidebar, sheet, sheetRatio: sheet?.height / sidebar.height,
          canvas: rect('.canvas-area'), layers: rect('[data-testid="left-layer-switcher"], [data-testid="basic-layer-list"]'),
          toolbarScroll: toolbar ? toolbar.scrollWidth > toolbar.clientWidth : false,
          mainToolbarScroll: mainToolbar ? mainToolbar.scrollWidth > mainToolbar.clientWidth : false,
          clippedControls,
          pageOverflow: document.documentElement.scrollWidth > innerWidth,
        };
      });
      measurements.push({ mode: value, width, height, ...measured });
      console.log(`geometry ${value} ${width}x${height}: sheet=${measured.sheet.height}, canvas=${measured.canvas.width}, clipped=${measured.clippedControls.length}`);
      await page.screenshot({ path: `${output}/${value}-${width}x${height}.png` });
      if (phase === 'after') {
        assert(measured.canvas.width >= 520, `${value} ${width}: canvas floor`);
        assert(!measured.pageOverflow && !measured.toolbarScroll, `${value} ${width}: horizontal overflow`);
        assert(!measured.mainToolbarScroll, `${value} ${width}: main toolbar scroll`);
        assert.deepEqual(measured.clippedControls, [], `${value} ${width}: controls clipped or covered`);
        if (value === 'standard' && width === 1440) assert(measured.sheetRatio >= .6, 'standard sheet must own 60% of sidebar');
      }
    }
  }
  if (phase === 'after') await sidebarFocusInteractions({ page, output, mode });
} finally {
  await writeFile(`${output}/layout-ancestry.json`, JSON.stringify(await page.evaluate(() => {
    const result = [];
    for (let node = document.querySelector('[data-testid="map-tree-section-toggle"]'); node; node = node.parentElement) {
      const style = getComputedStyle(node);
      result.push({ tag: node.tagName, className: node.className, box: node.getBoundingClientRect().toJSON(), overflow: style.overflow,
        minHeight: style.minHeight, maxHeight: style.maxHeight, height: style.height, alignItems: style.alignItems });
    }
    return result;
  }), null, 2));
  await page.screenshot({ path: `${output}/final-state.png` });
  await writeFile(`${output}/final-state.json`, JSON.stringify(await page.evaluate(() => ({ url: location.href, text: document.body.innerText.slice(0, 2500), resources: performance.getEntriesByType('resource').length })), null, 2));
  await writeFile(`${output}/measurements.json`, JSON.stringify({ measurements, errors }, null, 2));
  console.log(JSON.stringify({ phase, measurements, errors }, null, 2));
  await browser.close();
}
