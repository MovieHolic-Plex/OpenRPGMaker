import { chromium, firefox, expect } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';

// Run from the checkout root; use an isolated blankProject, never a user project.
const base = process.env.BASE_URL ?? 'http://127.0.0.1:19844';
const out = process.env.EVIDENCE_DIR ?? 'output/evidence/map-owned-overlays/phase1/browser';
await mkdir(out, { recursive: true });
const observations = {};
const browserName = process.env.BROWSER ?? 'chromium';
if (!['chromium', 'firefox'].includes(browserName)) throw new Error(`Unsupported BROWSER: ${browserName}`);
const browser = browserName === 'firefox'
  ? await firefox.launch({ headless: false })
  : await chromium.launch({ headless: false, args: ['--no-sandbox'] });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await context.newPage();
await context.addInitScript(() => localStorage.setItem('oprn:coachmarks-basic-v1', '1'));
const errors = [];
const blockedWrites = [];
page.on('pageerror', error => errors.push(error.message));
page.on('console', message => { if (message.type() === 'error') console.log('CONSOLE_ERROR', message.text().slice(0, 500)); });
page.on('response', response => { if (response.status() >= 400) console.log('HTTP_ERROR', response.status(), new URL(response.url()).pathname); });
await context.route('**/*', async route => {
  const request = route.request();
  const url = new URL(request.url());
  if (!['GET', 'HEAD', 'OPTIONS'].includes(request.method())) {
    blockedWrites.push({ method: request.method(), path: url.pathname });
    await route.abort('blockedbyclient');
    return;
  }
  await route.continue();
});
try {
  await page.goto(`${base}/?blankProject=1`, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await expect(page.locator('.phaser-container canvas')).toBeVisible({ timeout: 60000 });
  await page.evaluate(async () => {
    const [storeModule, editorModule, mode, blueprint, ghost] = await Promise.all([
      import('/src/project/store.ts'), import('/src/editor/editorState.ts'),
      import('/src/app/mode.ts'), import('/src/editor/agentBlueprint.ts'),
      import('/src/editor/agentGhostPreview.ts'),
    ]);
    if (storeModule.store !== window.__oprnEditorStore) throw new Error('Different store module instance');
    if (storeModule.store.remotePersistenceEnabled) throw new Error('Remote persistence enabled');
    window.qa = { store: storeModule.store, editor: editorModule.editorState, mode, blueprint, ghost };
    qa.scene = mode.getGame().scene.getScene('EditScene');
    if (!qa.scene.agentBlueprintRenderer) await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('EditScene create timeout')), 30000);
      qa.scene.events.once('create', () => { clearTimeout(timeout); resolve(); });
    });
    const p = structuredClone(qa.store.getCurrent());
    const original = p.maps[p.startMapId];
    p.maps = {
      qa_map_a: { ...structuredClone(original), id: 'qa_map_a', name: 'QA Map A - AI target' },
      qa_map_b: { ...structuredClone(original), id: 'qa_map_b', name: 'QA Map B - untouched' },
    };
    p.startMapId = 'qa_map_a';
    p.mapTree = { mapId: 'qa_map_a', children: [{ mapId: 'qa_map_b', children: [] }] };
    qa.store.replaceProject(p);
    qa.editor.set({ currentMapId: 'qa_map_a', selectedEventId: null });
    qa.baseMapJson = Object.fromEntries(Object.entries(p.maps).map(([id, map]) => [id, JSON.stringify(map)]));
    if (!qa.scene.agentBlueprintRenderer) throw new Error('Actual EditScene renderer not found');
    qa.nextRender = () => new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('postrender timeout')), 10000);
      mode.getGame().events.once('postrender', () => { clearTimeout(timeout); resolve(); });
    });
    await qa.nextRender();
  });
  await expect(page.getByTestId('map-tree-node-qa_map_a')).toBeVisible();
  if (await page.getByTestId('standard-welcome-start').isVisible()) await page.getByTestId('standard-welcome-start').click();
  if (await page.getByTestId('ai-collapse').isVisible()) await page.getByTestId('ai-collapse').click();
  await page.screenshot({ path: `${out}/00-A-before.png` });

  // Simulate the exact successful set_build_spec and tool_started boundary.
  // No LLM network call is needed to hold a tool deterministically in flight.
  await page.evaluate(async () => {
    const rendered = qa.nextRender();
    qa.blueprint.setAgentBlueprintFromSpec({
      mapId: 'qa_map_a', title: 'A only',
      assets: [{ id: 'a_terrain', kind: 'terrain', x: 3, y: 3, w: 9, h: 7 }],
      buildOrder: ['a_terrain'],
    });
    qa.ghost.setAgentGhostRunningTool('fill_region', { mapId: 'qa_map_a' });
    await rendered;
  });
  await expect(page.getByTestId('ai-ghost-phase-chip')).toBeVisible();
  await page.screenshot({ path: `${out}/01-A-running.png` });
  observations.a = await snapshot();
  expect(observations.a.runningToolMapId).toBe('qa_map_a');
  expect(observations.a.filteredGhostCount).toBe(0);
  expect(observations.a.filteredBlueprintCount).toBe(1);

  await selectMap('qa_map_b');
  expect(await page.getByTestId('ai-ghost-phase-chip').count()).toBe(0);
  await page.screenshot({ path: `${out}/02-B-running-GREEN.png` });
  observations.b = await snapshot();
  expect(observations.b).toMatchObject({ currentMapId: 'qa_map_b', runningToolMapId: 'qa_map_a',
    filteredBlueprintCount: 0, actualBlueprintLayerChildren: 0, filteredGhostCount: 0, actualGhostLayerChildren: 0, phaseChip: null });

  // A remains the owner even when another start event is delivered while viewing B.
  await page.evaluate(async () => {
    const rendered = qa.nextRender();
    qa.ghost.setAgentGhostRunningTool('author_village', { target: { kind: 'existing', mapId: 'qa_map_a' } });
    await rendered;
  });
  expect(await page.getByTestId('ai-ghost-phase-chip').count()).toBe(0);
  await selectMap('qa_map_a');
  await expect(page.getByTestId('ai-ghost-phase-chip')).toBeVisible();
  await page.screenshot({ path: `${out}/03-A-returned.png` });
  observations.returned = await snapshot();

  // Explicit clear removes the owner's chip without touching map data or blueprint.
  await page.evaluate(async () => {
    const rendered = qa.nextRender();
    qa.ghost.clearAgentGhostRunningTool();
    await rendered;
  });
  await expect(page.getByTestId('ai-ghost-phase-chip')).toHaveCount(0);
  observations.cleared = await snapshot();
  expect(observations.cleared.runningToolMapId).toBeNull();
  await page.evaluate(async () => {
    const rendered = qa.nextRender();
    qa.ghost.setAgentGhostRunningTool('get_project_summary');
    await rendered;
  });
  expect(await page.getByTestId('ai-ghost-phase-chip').count()).toBe(0);
  observations.unknown = await snapshot();
  for (const state of Object.values(observations)) {
    expect(state.remotePersistenceEnabled).toBe(false);
    expect(state.mapDataUnchanged).toEqual({ qa_map_a: true, qa_map_b: true });
  }
  expect(errors).toEqual([]);
  await writeFile(`${out}/observations.json`, JSON.stringify({ observations, errors, blockedWrites }, null, 2));
  console.log('PASS A chip before cells; B chip/layers absent; late event stays on A; A return visible; clear/unknown hidden; map bytes unchanged');
  console.log('PAGE_ERRORS', JSON.stringify(errors));
  console.log('BLOCKED_WRITES', JSON.stringify(blockedWrites));
} catch (error) {
  console.log('FAILURE_STATE', JSON.stringify({ errors, body: (await page.locator('body').innerText()).slice(0, 1800) }));
  await page.screenshot({ path: `${out}/boot-failure.png` });
  throw error;
} finally {
  await context.close();
  await browser.close();
  console.log('CLEANUP browser/context closed; disposable profile discarded');
}

async function selectMap(mapId) {
  // Subscribe before the real map-tree click; no sleeps or polling for renderer state.
  await page.evaluate(id => {
    qa.mapChanged = new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error(`map selection timeout: ${id}`)), 10000);
      const unsubscribe = qa.editor.subscribe(state => {
        if (state.currentMapId !== id) return;
        clearTimeout(timeout);
        unsubscribe();
        resolve(qa.nextRender());
      });
    });
  }, mapId);
  await page.getByTestId(`map-tree-node-${mapId}`).click();
  await page.evaluate(() => qa.mapChanged);
}

async function snapshot() {
  return page.evaluate(() => {
    const bp = qa.blueprint.getAgentBlueprintState();
    const ghosts = qa.ghost.getAgentGhostPreviewState();
    const id = qa.editor.get().currentMapId;
    const chip = document.querySelector('[data-testid="ai-ghost-phase-chip"]');
    return {
      currentMapId: id, blueprintMapId: bp.mapId, blueprintEntries: bp.entries,
      filteredBlueprintCount: qa.blueprint.agentBlueprintForMap(bp, id).length,
      actualBlueprintLayerChildren: qa.scene.agentBlueprintLayer.list.length,
      filteredGhostCount: qa.ghost.agentGhostPreviewsForMap(ghosts, id).length,
      actualGhostLayerChildren: qa.scene.agentGhostPreviewLayer.list.length,
      runningToolName: ghosts.runningToolName,
      runningToolMapId: ghosts.runningToolMapId,
      phaseChip: chip ? {
        text: chip.textContent, visible: !!chip.getClientRects().length,
        rect: chip.getBoundingClientRect().toJSON(),
        style: { opacity: getComputedStyle(chip).opacity, display: getComputedStyle(chip).display, zIndex: getComputedStyle(chip).zIndex },
        ancestors: [chip.parentElement, chip.parentElement.parentElement].map(el => ({ className: el.className, rect: el.getBoundingClientRect().toJSON(), overflow: getComputedStyle(el).overflow })),
        overlap: document.elementsFromPoint(chip.getBoundingClientRect().x + 20, chip.getBoundingClientRect().y + 10).slice(0, 5).map(el => ({ className: el.className, testid: el.dataset.testid })),
      } : null,
      remotePersistenceEnabled: qa.store.remotePersistenceEnabled,
      mapDataUnchanged: Object.fromEntries(Object.entries(qa.baseMapJson).map(([mapId, json]) => [mapId, json === JSON.stringify(qa.store.getCurrent().maps[mapId])])),
    };
  });
}
