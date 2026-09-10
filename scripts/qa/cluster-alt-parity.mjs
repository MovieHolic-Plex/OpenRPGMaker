// bAlt/aAlt parity browser proof — the expander now accepts the alternatives the validator accepts.
//
// What this proves with a real Chromium against the shipped editor shell:
//   1. Stacking dry-tree canopy 261 upward leaves the terrain under the stack intact
//      (before the fix, every interior cell got a hidden 291 trunk stamped on the lower layer).
//   2. Erasing a canopy in the middle of that stack does not expose a buried trunk.
//   3. A long table can be extended past its closed 3-cell form (325 326 326 327) by hand,
//      which the rule data and validateClusterRules always called legal.
//   4. Groups without alternatives still force their canonical companion (conifer 290 -> 260).
//   5. Every one of those paints is a single undo/redo unit.
//
// Uses `?blankProject=1`, not `?freshProject=1`: the latter loads the shipped sample fixture
// (dew-village-demo.json), whose preserved `harness-combined-town-dry-tree` group still carries the
// pre-`bAlt` rule `{a:261,b:291}` — `preserveHarnessGroup` never upgrades an existing rule set.
// That staleness is real and recorded in the notes, but it is tileset **data**, not this contract.
// Mutations stay inside the local dev session (remote persistence disabled).

import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';

const output = process.env.PARITY_QA_OUTPUT ?? 'verify-shots/balt-parity';
const baseUrl = process.env.PARITY_QA_URL ?? 'http://127.0.0.1:9864';
await mkdir(output, { recursive: true });

const browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await context.newPage();
// Chromium cancels loopback imports when this host's network changes; relay GET bytes only.
await page.route('**/*', async route => {
  const request = route.request();
  if (request.method() !== 'GET' || new URL(request.url()).origin !== new URL(baseUrl).origin) return route.continue();
  const response = await fetch(request.url(), { signal: AbortSignal.timeout(90000) });
  await route.fulfill({ status: response.status, headers: Object.fromEntries(response.headers), body: Buffer.from(await response.arrayBuffer()) });
});
page.setDefaultTimeout(90000);
const pageErrors = [];
page.on('pageerror', error => pageErrors.push(error.message));

await page.addInitScript(() => {
  localStorage.setItem('oprn:editor-ui-mode', 'standard');
  localStorage.setItem('oprn:ai-panel-collapsed', '1');
  localStorage.setItem('oprn:standard-welcome-seen', '1');
  window.parityQaReady = new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('EditScene readiness missing')), 120000);
    let hook;
    Object.defineProperty(window, '__oprnEditWorldToClient', {
      configurable: true, get: () => hook,
      set: value => { hook = value; clearTimeout(timeout); resolve(); },
    });
  });
});

const results = [];
const shot = name => page.screenshot({ path: `${output}/${name}.png` });
const mapTiles = () => page.evaluate(() => {
  const { store, state } = window.parityQa;
  const map = store.getCurrent().maps[state.get().currentMapId];
  return { lower: [...map.lowerTiles], upper: [...map.upperTiles], width: map.width, height: map.height };
});
const at = (tiles, layer, x, y) => tiles[layer][y * tiles.width + x];
const point = (x, y) => page.evaluate(({ x, y }) => window.__oprnEditWorldToClient(x * 16 + 8, y * 16 + 8), { x, y });
const clickTile = async (x, y) => {
  const p = await point(x, y);
  assert.ok(p.x > 330 && p.x < 1430 && p.y > 125 && p.y < 890, `offscreen tile ${x},${y}: ${JSON.stringify(p)}`);
  await page.mouse.click(p.x, p.y);
};
/** Wait for the store to actually settle instead of sleeping. */
const awaitStoreChange = async action => {
  await page.evaluate(() => {
    window.parityQaChanged = new Promise(resolve => {
      const off = window.parityQa.store.subscribe(() => { off(); resolve(true); });
      setTimeout(() => { off(); resolve(false); }, 4000);
    });
  });
  await action();
  return page.evaluate(() => window.parityQaChanged);
};
const selectTile = tile => page.evaluate(t => window.parityQa.state.set({
  activePaletteStamp: null, layer: 'lower', paintShape: 'pen', selectedTile: t, tool: 'paint',
}), tile);
const clusterAssist = on => page.evaluate(v => window.parityQa.state.set({ clusterAssistMode: v }), on);
const eraser = () => page.evaluate(() => window.parityQa.state.set({ tool: 'erase', layer: 'upper' }));
const lintViolations = () => page.evaluate(async () => {
  const { validateClusterRules } = await import('/src/project/lint/clusterRuleValidators.ts');
  const { store, state } = window.parityQa;
  return validateClusterRules(store.getCurrent(), state.get().currentMapId)
    .filter(violation => violation.severity === 'error')
    .map(violation => ({ code: violation.code, message: violation.rule.message, coords: violation.coords.map(c => `${c.x},${c.y}`) }));
});

/** Camera position is not guaranteed; derive every test cell from the visible world view. */
const visibleAnchor = async () => {
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  return page.evaluate(() => {
    const view = window.__oprnEditVisibleArea().worldView;
    return {
      x: Math.floor((view.x + view.width * 0.3) / 16),
      y: Math.floor((view.y + view.height * 0.6) / 16),
    };
  });
};

const record = async (name, fn) => {
  try {
    const observed = await fn();
    await shot(name);
    results.push({ name, status: 'PASS', observed, screenshot: `${name}.png` });
  } catch (error) {
    await shot(name);
    results.push({ name, status: 'FAIL', error: error.message, screenshot: `${name}.png` });
  }
  console.log(`QA ${name}: ${results.at(-1).status}${results.at(-1).error ? ` — ${results.at(-1).error}` : ''}`);
};

try {
  await page.goto(`${baseUrl}/?blankProject=1`, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.getByTestId('edit-canvas').waitFor({ state: 'visible', timeout: 120000 });
  await page.evaluate(() => window.parityQaReady);
  await page.evaluate(async () => {
    const { store } = await import('/src/project/store.ts');
    const { editorState } = await import('/src/editor/editorState.ts');
    const history = await import('/src/editor/mapEditHistory.ts');
    // The world hook can install before store.load() settles the dev-session flag; wait on the
    // store's own change notifications rather than sleeping, then assert local-only persistence.
    if (store.remotePersistenceEnabled !== false) {
      await new Promise((resolve, reject) => {
        const timer = setTimeout(() => { off(); reject(new Error('store never entered a local dev session')); }, 30000);
        const off = store.subscribe(() => {
          if (store.remotePersistenceEnabled === false) { clearTimeout(timer); off(); resolve(); }
        });
      });
    }
    if (store.remotePersistenceEnabled !== false) throw new Error('QA requires disabled remote persistence');
    window.parityQa = { store, state: editorState, history };
    store.update(project => {
      const map = project.maps[editorState.get().currentMapId];
      map.lowerTiles.fill(240);
      map.upperTiles.fill(-1);
      map.events = [];
      map.lowerTileStacks = {};
      map.upperTileStacks = {};
      project.startPos = { x: 0, y: map.height - 1 };
    }, { scope: 'project', label: 'bAlt parity local QA fixture', origin: 'system' });
    history.resetMapEditHistory();
  });

  // The contract under test only exists where the rule data actually carries alternatives.
  const dryRule = await page.evaluate(() => {
    const { store, state } = window.parityQa;
    const map = store.getCurrent().maps[state.get().currentMapId];
    const group = (store.getCurrent().tilesets[map.tilesetId]?.tileGroups ?? [])
      .find(g => g.id === 'harness-combined-town-dry-tree');
    return { tilesetId: map.tilesetId, rule: (group?.rules ?? [])[0]?.params ?? null };
  });
  assert.deepEqual(dryRule.rule?.bAlt, [261], `dry-tree rule must carry bAlt here: ${JSON.stringify(dryRule)}`);

  const anchor = await visibleAnchor();

  await record('A-dry-tree-stack-keeps-terrain', async () => {
    await clusterAssist(true);
    await selectTile(261);
    const column = anchor.x;
    // First paint: canopy 261 + its trunk bottom 291 one cell below (unchanged contract).
    assert.ok(await awaitStoreChange(() => clickTile(column, anchor.y)), 'first canopy commits');
    const first = await mapTiles();
    assert.equal(at(first, 'upper', column, anchor.y), 261, 'canopy on upper');
    assert.equal(at(first, 'lower', column, anchor.y + 1), 291, 'trunk bottom below it');

    // Stack two more canopies upward: bAlt:[261] makes 261-under-261 legal, so no new trunk.
    for (const y of [anchor.y - 1, anchor.y - 2]) {
      assert.ok(await awaitStoreChange(() => clickTile(column, y)), `stacked canopy at ${y} commits`);
    }
    const tiles = await mapTiles();
    const canopies = [anchor.y - 2, anchor.y - 1, anchor.y].map(y => at(tiles, 'upper', column, y));
    const terrainUnder = [anchor.y - 1, anchor.y].map(y => at(tiles, 'lower', column, y));
    assert.deepEqual(canopies, [261, 261, 261], `three stacked canopies, got ${JSON.stringify(canopies)}`);
    assert.deepEqual(terrainUnder, [240, 240], `grass survives under the stack, got ${JSON.stringify(terrainUnder)}`);
    assert.equal(at(tiles, 'lower', column, anchor.y + 1), 291, 'the single trunk bottom is still the chain end');
    const violations = await lintViolations();
    assert.deepEqual(violations.filter(v => v.coords.some(c => c.startsWith(`${column},`))), [],
      `the stack is rule-clean: ${JSON.stringify(violations)}`);
    return { column, canopies, terrainUnder, trunkBottomY: anchor.y + 1 };
  });

  await record('B-erasing-mid-stack-exposes-no-buried-trunk', async () => {
    const column = anchor.x;
    await eraser();
    assert.ok(await awaitStoreChange(() => clickTile(column, anchor.y - 1)), 'erase commits');
    const tiles = await mapTiles();
    assert.notEqual(at(tiles, 'lower', column, anchor.y - 1), 291, 'no trunk was buried under the erased canopy');
    const observed = { erased: { x: column, y: anchor.y - 1 }, lowerNow: at(tiles, 'lower', column, anchor.y - 1) };
    // Restore the stack for the undo unit check below.
    assert.ok(await awaitStoreChange(() => page.evaluate(() => window.parityQa.history.undoMapEdit())), 'undo commits');
    assert.equal(at(await mapTiles(), 'upper', column, anchor.y - 1), 261, 'one undo restores the erased canopy');
    return observed;
  });

  await record('C-stacking-one-canopy-is-one-undo-unit', async () => {
    const column = anchor.x;
    await page.evaluate(() => window.parityQa.state.set({ tool: 'paint', layer: 'lower' }));
    await selectTile(261);
    await clusterAssist(true);
    const before = await mapTiles();
    assert.ok(await awaitStoreChange(() => clickTile(column, anchor.y - 3)), 'stack paint commits');
    const after = await mapTiles();
    assert.equal(at(after, 'upper', column, anchor.y - 3), 261);
    const changed = after.lower.flatMap((v, i) => v !== before.lower[i] ? [`L${i}`] : [])
      .concat(after.upper.flatMap((v, i) => v !== before.upper[i] ? [`U${i}`] : []));
    assert.equal(changed.length, 1, `stacking touched exactly one cell, got ${JSON.stringify(changed)}`);
    assert.ok(await awaitStoreChange(() => page.evaluate(() => window.parityQa.history.undoMapEdit())), 'undo commits');
    assert.equal(at(await mapTiles(), 'upper', column, anchor.y - 3), before.upper[(anchor.y - 3) * before.width + column], 'one undo reverts it');
    assert.ok(await awaitStoreChange(() => page.evaluate(() => window.parityQa.history.redoMapEdit())), 'redo commits');
    assert.equal(at(await mapTiles(), 'upper', column, anchor.y - 3), 261, 'one redo restores it');
    return { changedCells: changed };
  });

  await record('D-conifer-without-alternatives-still-forces-companion', async () => {
    const target = { x: anchor.x + 5, y: anchor.y };
    await selectTile(290);
    await clusterAssist(true);
    assert.ok(await awaitStoreChange(() => clickTile(target.x, target.y)), 'conifer paint commits');
    const tiles = await mapTiles();
    assert.equal(at(tiles, 'lower', target.x, target.y), 290, 'trunk on lower');
    assert.equal(at(tiles, 'upper', target.x, target.y - 1), 260, 'canopy still forced above');
    return { target, trunk: 290, canopy: at(tiles, 'upper', target.x, target.y - 1) };
  });

  await record('E-long-table-extends-past-three-cells', async () => {
    // Switch the current map to the interior tileset that carries the aAlt/bAlt table rules.
    const ready = await page.evaluate(async () => {
      const { INTERIOR_ROOM_TILESET_ID } = await import('/src/editor/interiorRoomPipeline.ts');
      const { store, state } = window.parityQa;
      const mapId = state.get().currentMapId;
      store.updateMap(mapId, map => { map.tilesetId = INTERIOR_ROOM_TILESET_ID; map.lowerTiles.fill(42); map.upperTiles.fill(-1); },
        { cells: [] });
      const map = store.getCurrent().maps[mapId];
      const group = (store.getCurrent().tilesets[map.tilesetId]?.tileGroups ?? [])
        .find(g => g.id === 'harness-interior-house-v1-tavern-table');
      return { tilesetId: map.tilesetId, tileIds: group?.tileIds ?? null, rules: (group?.rules ?? []).map(r => ({ id: r.id, params: r.params })) };
    });
    assert.ok(ready.rules.some(r => Array.isArray(r.params.bAlt)), `table rules carry bAlt: ${JSON.stringify(ready)}`);

    const row = { x: anchor.x, y: anchor.y };
    await clusterAssist(true);
    await selectTile(325);
    assert.ok(await awaitStoreChange(() => clickTile(row.x, row.y)), 'left cap commits');
    const closed = await mapTiles();
    const three = [0, 1, 2].map(dx => at(closed, 'upper', row.x + dx, row.y));
    assert.deepEqual(three, [325, 326, 327], `one click builds the closed table, got ${JSON.stringify(three)}`);

    // Extend it: drop a body tile on the right cap. bAlt allows 326 right of 326.
    await selectTile(326);
    assert.ok(await awaitStoreChange(() => clickTile(row.x + 2, row.y)), 'extension commits without rejection');
    const extended = await mapTiles();
    const four = [0, 1, 2, 3].map(dx => at(extended, 'upper', row.x + dx, row.y));
    assert.deepEqual(four, [325, 326, 326, 327], `the table grew to four cells, got ${JSON.stringify(four)}`);
    const violations = await lintViolations();
    assert.deepEqual(violations.filter(v => v.code.includes('tavern-table')), [],
      `the longer table is rule-clean: ${JSON.stringify(violations)}`);
    return { row, three, four, tableRules: ready.rules.map(r => r.id) };
  });
} finally {
  await writeFile(`${output}/RESULTS.json`, JSON.stringify({ baseUrl, pageErrors, results }, null, 2));
  const lines = [
    '# bAlt/aAlt parity browser evidence',
    '',
    `Base URL: ${baseUrl}`,
    '',
    ...results.map(result => `- **${result.name}** — ${result.status} (${result.screenshot})${result.error ? `\n  - error: ${result.error}` : ''}`),
    '',
    pageErrors.length ? `Page errors: ${pageErrors.join(' | ')}` : 'Page errors: none',
    '',
  ];
  await writeFile(`${output}/SUMMARY.md`, lines.join('\n'));
  await context.close();
  await browser.close();
}

const failed = results.filter(result => result.status === 'FAIL');
console.log(`\n${results.length - failed.length}/${results.length} PASS`);
if (failed.length > 0) process.exitCode = 1;
