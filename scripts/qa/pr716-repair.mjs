// Local-only acceptance: run against an owned fresh dev server/cache, never production.
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';

const base = process.env.PR716_QA_URL;
assert(base && /^http:\/\/127\.0\.0\.1:\d+$/.test(base), 'PR716_QA_URL must be an owned loopback origin');
const output = process.env.PR716_QA_OUTPUT ?? 'output/evidence/pr716-repair/browser';
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
const context = await browser.newContext({ viewport: { width: 1280, height: 800 }, serviceWorkers: 'block' });
const page = await context.newPage();
page.setDefaultTimeout(30000);
const evidence = { base, blocked: [], pageErrors: [], toolbar: [], picker: {}, history: {} };
page.on('pageerror', error => evidence.pageErrors.push(error.message));
await page.route('**/*', async route => {
  const request = route.request(), url = new URL(request.url());
  // No remote reads, writes, local API writes, or Supabase proxy access.
  if (request.method() !== 'GET' || url.origin !== base || /^\/(api|supabase|__oprn)(\/|$)/.test(url.pathname)) {
    evidence.blocked.push({ method: request.method(), path: url.origin === base ? url.pathname : '(external)' });
    return route.abort();
  }
  // Relay loopback GET bytes: Chromium loopback networking is unreliable on the QA host.
  const response = await fetch(url, { signal: AbortSignal.timeout(90000) });
  await route.fulfill({ status: response.status, headers: Object.fromEntries(response.headers), body: Buffer.from(await response.arrayBuffer()) });
});
await page.routeWebSocket('**/*', socket => socket.close());
await page.addInitScript(() => {
  localStorage.setItem('oprn:editor-ui-mode', 'standard');
  localStorage.setItem('oprn:ai-panel-collapsed', '1');
  window.pr716Ready = new Promise((resolve, reject) => {
    const deadline = setTimeout(() => reject(new Error('EditScene readiness missing')), 120000);
    let hook;
    Object.defineProperty(window, '__oprnEditWorldToClient', {
      configurable: true, get: () => hook,
      set: value => { hook = value; clearTimeout(deadline); resolve(); },
    });
  });
  // Subscribe before Confirm. Completion is the real menu continuation removing
  // its dropdown, not an arbitrary sleep or microtask count.
  window.pr716ObserveMenuClose = () => {
    window.pr716MenuClosed = new Promise((resolve, reject) => {
      const observer = new MutationObserver(() => {
        if (document.querySelector('[data-testid="oprn-undo-history-dropdown"]')) return;
        clearTimeout(deadline);
        observer.disconnect();
        resolve();
      });
      const deadline = setTimeout(() => { observer.disconnect(); reject(new Error('history menu did not close')); }, 10000);
      observer.observe(document.body, { childList: true, subtree: true });
    });
  };
});

try {
  await page.goto(`${base}/?freshProject=1`, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.evaluate(() => window.pr716Ready);
  await page.evaluate(async () => {
    const { store } = await import('/src/project/store.ts');
    const { editorState } = await import('/src/editor/editorState.ts');
    const history = await import('/src/editor/mapEditHistory.ts');
    const { createBlankProject } = await import('/src/project/defaults.ts');
    assertLocal();
    function assertLocal() {
      if (store.isRemotePersistenceEnabled()) throw new Error('QA requires disabled remote persistence');
    }
    const project = createBlankProject();
    project.maps[project.startMapId].events = [
      ['ev_qa_sora_first', 3, 4], ['ev_qa_sora_second', 8, 2],
    ].map(([id, x, y]) => ({
      id, x, y, trigger: { kind: 'action' }, commands: [],
      pages: [{
        id: `${id}_page`, name: '소라', conditions: [], graphic: {}, trigger: { kind: 'action' },
        priority: 'same', movement: { type: 'fixed', speed: 3, frequency: 3 }, commands: [],
      }],
    }));
    store.replaceProject(project, { label: 'PR716 local-only QA fixture' });
    editorState.set({ currentMapId: project.startMapId, layer: 'lower', tool: 'paint' });
    window.pr716 = { store, history, assertLocal };
  });
  await page.evaluate(() => document.fonts.ready);
  for (const [width, height] of [[1024, 768], [1280, 800], [1440, 900]]) {
    await page.setViewportSize({ width, height });
    const measurement = await page.locator('.oprn-tile-toolbar-scroll').evaluate(node => ({
      client: node.clientWidth, scroll: node.scrollWidth,
      groupMargin: getComputedStyle(node.querySelector('[data-testid="oprn-tool-history-group"]')).marginRight,
    }));
    evidence.toolbar.push({ width, height, ...measurement });
    assert.equal(measurement.scroll, measurement.client, `toolbar overflow at ${width}`);
  }
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.screenshot({ path: `${output}/toolbar.png` });

  // Mount the production command-dialog entry point; only the command/targets are fixtures.
  await page.evaluate(async () => {
    const { openEventCommandEditDialog } = await import('/src/editor/panels/eventEditor/commandEditDialog.ts');
    openEventCommandEditDialog({
      initial: { kind: 'moveEvent', eventId: 'this', route: { moves: [], repeat: false } },
      onApply: command => { window.pr716.applied = command; },
    });
  });
  const input = page.getByTestId('move-route-event-id-input');
  await page.getByTestId('move-route-event-picker-open').click();
  await input.fill('소라');
  assert.equal(await page.locator('[data-testid^="move-route-event-option-"]').count(), 2);
  await page.screenshot({ path: `${output}/picker-search.png` });
  await page.getByTestId('move-route-event-option-ev_qa_sora_first').click();
  evidence.picker.selected = await input.inputValue();
  evidence.picker.state = await page.getByTestId('move-route-event-name').getAttribute('data-state');
  assert.equal(evidence.picker.selected, 'ev_qa_sora_first');
  assert.equal(evidence.picker.state, 'resolved');
  assert.equal(await input.evaluate(node => document.activeElement === node), true);
  await page.screenshot({ path: `${output}/picker-click.png` });
  await input.press('ArrowDown');
  assert.equal(await page.getByTestId('move-route-event-picker').isVisible(), true);
  await input.press('Escape');
  evidence.picker.parentAfterEscape = await page.getByTestId('event-command-edit-dialog').count();
  assert.equal(evidence.picker.parentAfterEscape, 1);
  assert.equal(await page.getByTestId('move-route-event-picker').isVisible(), false);
  assert.equal(await input.evaluate(node => document.activeElement === node), true);
  await page.screenshot({ path: `${output}/picker-escape.png` });
  await page.getByTestId('event-command-edit-ok').click();
  assert.equal(await page.evaluate(() => window.pr716.applied.eventId), 'ev_qa_sora_first');

  await page.evaluate(async () => {
    const { store, history } = window.pr716;
    const changed = new Promise((resolve, reject) => {
      const deadline = setTimeout(() => reject(new Error('history change missing')), 10000);
      window.addEventListener(history.MAP_EDIT_HISTORY_EVENT, () => { clearTimeout(deadline); resolve(); }, { once: true });
    });
    history.resetMapEditHistory();
    const mapId = store.getCurrent().startMapId;
    for (const tile of [11, 22, 33]) {
      history.recordProjectSnapshot(`QA edit ${tile}`, mapId, { kind: 'map', mapId });
      store.updateMap(mapId, map => { map.lowerTiles[0] = tile; }, { label: `QA edit ${tile}` });
    }
    await changed;
  });
  await page.getByTestId('oprn-tool-undo-history').click();
  await page.getByTestId('history-undo-step-3').click();
  assert.equal(await page.getByTestId('app-confirm-modal').count(), 1);
  await page.evaluate(() => {
    const { store, history } = window.pr716, mapId = store.getCurrent().startMapId;
    // A concurrent editor/assistant mutation while the human decision is pending.
    history.recordProjectSnapshot('QA concurrent edit', mapId, { kind: 'map', mapId });
    store.updateMap(mapId, map => { map.lowerTiles[0] = 44; }, { label: 'QA concurrent edit' });
    window.pr716.beforeConfirm = {
      project: store.getCurrent(), undo: history.getMapEditHistoryEntries(), redo: history.getMapEditRedoEntries(),
    };
  });
  await page.screenshot({ path: `${output}/history-pending-stale.png` });
  await page.evaluate(() => window.pr716ObserveMenuClose());
  await page.getByTestId('app-modal-confirm').click();
  await page.evaluate(() => window.pr716MenuClosed);
  evidence.history = await page.evaluate(() => {
    const { store, history, beforeConfirm } = window.pr716;
    window.pr716.assertLocal();
    return {
      tile: store.getCurrent().maps[store.getCurrent().startMapId].lowerTiles[0],
      sameProject: store.getCurrent() === beforeConfirm.project,
      sameUndo: JSON.stringify(history.getMapEditHistoryEntries()) === JSON.stringify(beforeConfirm.undo),
      sameRedo: JSON.stringify(history.getMapEditRedoEntries()) === JSON.stringify(beforeConfirm.redo),
      remotePersistence: store.isRemotePersistenceEnabled(),
    };
  });
  assert.deepEqual(evidence.history, { tile: 44, sameProject: true, sameUndo: true, sameRedo: true, remotePersistence: false });
  await page.screenshot({ path: `${output}/history-stale-rejected.png` });
  await page.getByTestId('oprn-tool-undo-history').click();
  await page.keyboard.press('Escape');
  await page.getByTestId('oprn-tool-undo-history').click();
  assert.equal(await page.getByTestId('oprn-undo-history-dropdown').isVisible(), true);
  assert.deepEqual(evidence.pageErrors, []);
  console.log(JSON.stringify(evidence, null, 2));
} finally {
  await writeFile(`${output}/evidence.json`, JSON.stringify(evidence, null, 2));
  await page.screenshot({ path: `${output}/final-state.png` });
  await browser.close();
}
