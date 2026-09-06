import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';

/** Real DOM interactions against the local-only project; no remote content writes. */
export async function sidebarFocusInteractions({ page, output, mode }) {
  const results = [];
  const click = id => page.getByTestId(id).click({ noWaitAfter: true });
  const state = () => page.evaluate(() => window.sidebarQa.state.get());
  const shot = name => page.screenshot({ path: `${output}/${name}.png` });
  const sheetHeight = () => page.locator('.left-panel .chipset-sheet').evaluate(node => node.getBoundingClientRect().height);
  async function changed(action) {
    await page.evaluate(() => {
      window.sidebarChanged = new Promise((resolve, reject) => {
        const timeout = setTimeout(() => { off(); reject(new Error('editor state signal missing')); }, 10000);
        const off = window.sidebarQa.state.subscribe(() => { off(); clearTimeout(timeout); resolve(); });
      });
    });
    await action();
    await page.evaluate(() => window.sidebarChanged);
  }
  await page.setViewportSize({ width: 1440, height: 900 });
  await mode('standard');
  await click('tool-erase');
  await click('sidebar-tools-menu');
  const paintTarget = await page.getByTestId('tool-paint').boundingBox();
  await page.mouse.click(paintTarget.x + paintTarget.width / 2, paintTarget.y + paintTarget.height / 2);
  assert.equal((await state()).tool, 'paint');
  await click('sidebar-tools-menu');
  const layerTarget = await page.getByTestId('layer-upper').boundingBox();
  await page.mouse.click(layerTarget.x + layerTarget.width / 2, layerTarget.y + layerTarget.height / 2);
  assert.equal((await state()).layer, 'upper');
  results.push({ outsidePointerToolAndLayer: true });
  await click('sidebar-map-switcher');
  assert.equal(await page.getByTestId('sidebar-map-surface').count(), 1);
  const maps = await page.evaluate(() => Object.values(window.sidebarQa.store.getCurrent().maps).map(map => ({ id: map.id, name: map.name })));
  const target = maps.find(map => map.id !== undefined && map.id !== (maps[0]?.id));
  assert(target, 'fixture must contain multiple maps');
  await page.getByTestId('map-tree-filter').fill(target.name);
  await changed(() => click(`map-tree-node-${target.id}`));
  assert.equal((await state()).currentMapId, target.id);
  await shot('map-switch-filter');
  await click('map-inspector-action-properties');
  const modal = page.getByTestId(`map-properties-modal-${target.id}`);
  const modalBox = await modal.locator('.event-subdialog-window').boundingBox();
  await page.mouse.click(modalBox.x + 50, modalBox.y + 30);
  assert.equal(await modal.count(), 1, 'pointer inside child dialog must not dismiss it');
  assert.equal(await page.getByTestId('sidebar-map-surface').count(), 1);
  await page.keyboard.press('Escape');
  assert.equal(await modal.count(), 0);
  assert.equal(await page.getByTestId('sidebar-map-surface').count(), 1);
  await page.getByTestId('map-tree-filter').focus();
  await page.keyboard.press('Escape');
  assert.equal(await page.getByTestId('sidebar-map-surface').count(), 0);
  assert.equal(await page.evaluate(() => document.activeElement?.dataset.testid), 'sidebar-map-switcher');
  results.push({ mapSearchSwitchEscape: true, mapId: target.id });

  await click('layer-lower');
  await click('tool-paint');
  await changed(() => page.getByTestId('brush-size-select').selectOption('4'));
  assert.equal((await state()).brushSize, 4);
  await click('sidebar-tools-menu');
  await changed(() => page.getByTestId('paint-shape-select').selectOption('round'));
  assert.equal((await state()).paintShape, 'round');
  assert.equal(await page.getByTestId('brush-size-select').count(), 0);
  await page.keyboard.press('Escape');
  await click('tool-paint');
  assert.equal(await page.getByTestId('brush-size-select').inputValue(), '4');
  await click('tool-fill');
  assert.equal(await page.getByTestId('brush-size-select').count(), 0);
  await click('layer-event');
  for (const id of ['tool-event', 'tool-paint', 'tile-brush-controls', 'tile-search-input', 'auto-connect-mode-toggle']) assert.equal(await page.getByTestId(id).count(), 0, `irrelevant Event control ${id}`);
  await shot('event-surface');
  await click('layer-lower');
  await click('tool-paint');
  results.push({ brushSize: 4, shape: 'round', eventContext: true });

  const selected = (await state()).selectedTile;
  const count = await page.locator('.left-panel .chipset-tile').count();
  await page.getByTestId('tile-category-select').selectOption('house');
  assert.notEqual(await page.locator('.left-panel .chipset-tile').count(), count);
  assert.equal((await state()).selectedTile, selected);
  await page.getByTestId('tile-search-input').fill('no-match-sidebar-qa');
  await click('palette-filter-clear');
  assert.equal(await page.evaluate(() => document.activeElement?.dataset.testid), 'tile-search-input');
  const auto = (await state()).autoConnectMode;
  await changed(() => click('auto-connect-mode-toggle'));
  assert.equal((await state()).autoConnectMode, !auto);
  results.push({ categoryFilters: true, searchClearFocus: true, connectionState: !auto });

  const beforeAssist = await sheetHeight();
  await click('palette-brush-assist-toggle');
  assert.equal(await sheetHeight(), beforeAssist);
  await shot('brush-assist');
  await page.keyboard.press('Escape');
  assert.equal(await page.evaluate(() => document.activeElement?.dataset.testid), 'palette-brush-assist-toggle');
  await page.evaluate(() => {
    const { store, state } = window.sidebarQa;
    const map = store.getCurrent().maps[state.get().currentMapId];
    store.update(project => { project.tilesets[map.tilesetId].structureKits = [{
      id: 'sidebar-qa-kit', kind: 'section', name: 'QA structure', width: 2, height: 1,
      rows: [{ tiles: [7, 7] }], learnedFrom: 'db-authored',
    }]; }, { scope: 'project', origin: 'system', label: 'Temporary sidebar QA structure' });
    state.set({ selectedTile: 7 });
  });
  const beforeKit = await sheetHeight();
  await click('sidebar-structure-kits');
  assert.equal(await sheetHeight(), beforeKit);
  await changed(() => click('structure-kit-sidebar-qa-kit'));
  assert.equal((await state()).activePaletteStamp.cells.length, 2);
  await shot('structure-kit');
  await page.keyboard.press('Escape');
  await click('tool-paint');
  results.push({ assistPreservesSheet: beforeAssist, kitPreservesSheet: beforeKit, stampCells: 2 });

  await mode('expert');
  await click('oprn-tool-overflow');
  await click('sidebar-pin-history');
  await page.keyboard.press('Escape');
  await click('toolbar-toggle-history');
  assert.equal(await page.getByTestId('tile-history-dropdown').count(), 1);
  await page.keyboard.press('Escape');
  assert.equal(await page.evaluate(() => document.activeElement?.dataset.testid), 'toolbar-toggle-history');
  await mode('standard');
  assert.equal(await page.getByTestId('toolbar-toggle-history').count(), 0);
  await mode('expert');
  assert.equal(await page.getByTestId('toolbar-toggle-history').count(), 1);
  await click('oprn-tool-overflow');
  await click('sidebar-pin-inspector');
  await click('sidebar-pin-ruleAudit');
  await page.keyboard.press('Escape');
  await page.setViewportSize({ width: 1024, height: 768 });
  const pinGeometry = await page.evaluate(() => {
    const rail = document.querySelector('.left-panel').getBoundingClientRect();
    return [...document.querySelectorAll('.sidebar-inspection-controls > .oprn-toolbar-menu > button')].map(button => {
      const box = button.getBoundingClientRect();
      return { id: button.dataset.testid, inside: box.left >= rail.left && box.right <= rail.right && box.bottom <= rail.bottom, box: box.toJSON() };
    });
  });
  await writeFile(`${output}/all-pins.json`, JSON.stringify(pinGeometry, null, 2));
  assert(pinGeometry.every(pin => pin.inside), 'all three pins must fit the sidebar');
  await shot('expert-all-pins-1024');
  await page.setViewportSize({ width: 1440, height: 900 });
  await shot('expert-history-pinned');
  await page.reload({ waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.evaluate(() => window.sidebarReady);
  await page.evaluate(async () => {
    const { store } = await import('/src/project/store.ts');
    const { editorState } = await import('/src/editor/editorState.ts');
    if (store.remotePersistenceEnabled !== false) throw new Error('Reload must remain local-only');
    window.sidebarQa = { store, state: editorState };
  });
  await mode('expert');
  assert.equal(await page.getByTestId('toolbar-toggle-history').count(), 1);
  const tree = await page.getByTestId('left-map-root').boundingBox();
  await click('map-tree-section-toggle');
  assert((await page.getByTestId('left-map-root').boundingBox()).height < tree.height);
  await click('map-tree-section-toggle');
  await page.getByTestId('map-tree-height-resizer').focus();
  const previousTree = await page.getByTestId('left-map-root').boundingBox();
  await page.keyboard.press('ArrowUp');
  assert.notEqual((await page.getByTestId('left-map-root').boundingBox()).height, previousTree.height);
  results.push({ inspectionPinsAcrossModesAndReload: true, expertTreeCollapseResize: true });

  await mode('standard');
  await page.evaluate(() => {
    const { store, state } = window.sidebarQa;
    store.update(project => {
      const map = project.maps[state.get().currentMapId];
      map.lowerTiles.fill(240); map.upperTiles.fill(-1); map.events = [];
      map.lowerTileStacks = {}; map.upperTileStacks = {};
    }, { scope: 'project', origin: 'system', label: 'Temporary sidebar paint QA fixture' });
  });
  await click('tool-paint');
  await page.getByTestId('brush-size-select').selectOption('1');
  await page.getByTestId('chipset-tile-7').click({ noWaitAfter: true });
  const before = await page.evaluate(() => [...window.sidebarQa.store.getCurrent().maps[window.sidebarQa.state.get().currentMapId].lowerTiles]);
  await page.evaluate(() => {
    window.sidebarPainted = new Promise((resolve, reject) => {
      const timeout = setTimeout(() => { off(); reject(new Error('paint mutation missing')); }, 10000);
      const off = window.sidebarQa.store.subscribe(() => { off(); clearTimeout(timeout); resolve(); });
    });
  });
  const canvas = await page.locator('.canvas-area').boundingBox();
  await click('sidebar-tools-menu');
  await page.mouse.click(canvas.x + canvas.width / 2, canvas.y + canvas.height / 2);
  await page.evaluate(() => window.sidebarPainted);
  const after = await page.evaluate(() => [...window.sidebarQa.store.getCurrent().maps[window.sidebarQa.state.get().currentMapId].lowerTiles]);
  assert.notDeepEqual(after, before);
  await click('oprn-tool-undo');
  assert.deepEqual(await page.evaluate(() => [...window.sidebarQa.store.getCurrent().maps[window.sidebarQa.state.get().currentMapId].lowerTiles]), before);
  results.push({ actualCanvasPaintUndo: true });
  await mode('beginner');
  assert.equal(await page.getByTestId('basic-tile-grid').count(), 1);
  await click('basic-tile-7');
  assert.equal((await state()).selectedTile, 7);
  await click('layer-event');
  assert.equal(await page.getByTestId('basic-tile-grid').count(), 0);
  await click('layer-lower');
  assert.equal(await page.getByTestId('basic-tile-grid').count(), 1);
  results.push({ beginnerSelectionAndLayers: true });
  await writeFile(`${output}/interactions.json`, JSON.stringify(results, null, 2));
  return results;
}
