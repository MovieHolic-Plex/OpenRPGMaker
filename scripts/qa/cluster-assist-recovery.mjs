// OPRN-OUT-017 browser proof — hard-cluster rejection stays recoverable in the real editor.
//
// What this proves with a real Chromium against the shipped editor shell:
//   1. Neighbor connection and structural cluster assistance are two separate controls.
//   2. Assisted paint of a Combined Town trunk places the canopy atomically.
//   3. Painting 290/291/292 where the companion cannot go is rejected with the rule,
//      companion tile and coordinates, and the toast carries an exact-place action.
//   4. Pressing that action writes only the clicked cell/layer.
//   5. Turning cluster assistance off paints exactly, leaving the violation to lint.
//
// Mutations stay inside freshProject's local session (remote persistence disabled).

import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';

const output = process.env.CLUSTER_QA_OUTPUT ?? 'verify-shots/oprn-017';
const baseUrl = process.env.CLUSTER_QA_URL ?? 'http://127.0.0.1:9852';
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
  window.clusterQaReady = new Promise((resolve, reject) => {
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
  const { store, state } = window.clusterQa;
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
    window.clusterQaChanged = new Promise(resolve => {
      const off = window.clusterQa.store.subscribe(() => { off(); resolve(true); });
      setTimeout(() => { off(); resolve(false); }, 4000);
    });
  });
  await action();
  return page.evaluate(() => window.clusterQaChanged);
};
const selectTile = tile => page.evaluate(t => window.clusterQa.state.set({
  activePaletteStamp: null, layer: 'lower', paintShape: 'pen', selectedTile: t, tool: 'paint',
}), tile);
const clusterAssist = on => page.evaluate(v => window.clusterQa.state.set({ clusterAssistMode: v }), on);
const toastText = () => page.evaluate(() => document.querySelector('[data-testid="toast"]')?.textContent ?? '');
const lintViolations = () => page.evaluate(async () => {
  const { validateClusterRules } = await import('/src/project/lint/clusterRuleValidators.ts');
  const { store, state } = window.clusterQa;
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
      y: Math.floor((view.y + view.height * 0.45) / 16),
      topY: Math.max(1, Math.ceil(view.y / 16) + 1),
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
  await page.goto(`${baseUrl}/?freshProject=1`, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.getByTestId('edit-canvas').waitFor({ state: 'visible', timeout: 120000 });
  await page.evaluate(() => window.clusterQaReady);
  await page.evaluate(async () => {
    const { store } = await import('/src/project/store.ts');
    const { editorState } = await import('/src/editor/editorState.ts');
    const history = await import('/src/editor/mapEditHistory.ts');
    if (store.remotePersistenceEnabled !== false) throw new Error('QA requires disabled remote persistence');
    window.clusterQa = { store, state: editorState, history };
    store.update(project => {
      const map = project.maps[editorState.get().currentMapId];
      map.lowerTiles.fill(240);
      map.upperTiles.fill(-1);
      map.events = [];
      map.lowerTileStacks = {};
      map.upperTileStacks = {};
      project.startPos = { x: 0, y: map.height - 1 };
    }, { scope: 'project', label: 'OPRN-017 local QA fixture', origin: 'system' });
    history.resetMapEditHistory();
  });

  await record('A1-two-independent-controls', async () => {
    // Both toggles are visible side by side with their own copy.
    const neighbor = page.getByTestId('auto-connect-mode-toggle');
    const cluster = page.getByTestId('cluster-assist-mode-toggle');
    await neighbor.waitFor({ state: 'visible' });
    await cluster.waitFor({ state: 'visible' });
    const observed = {
      neighborLabel: (await neighbor.textContent())?.trim(),
      neighborPressed: await neighbor.getAttribute('aria-pressed'),
      neighborTitle: await neighbor.getAttribute('title'),
      clusterLabel: (await cluster.textContent())?.trim(),
      clusterPressed: await cluster.getAttribute('aria-pressed'),
      clusterTitle: await cluster.getAttribute('title'),
    };
    assert.notEqual(observed.neighborLabel, observed.clusterLabel);
    assert.equal(observed.clusterPressed, 'true', 'cluster assistance is the safe default');
    assert.ok(observed.neighborTitle.includes('구조 보조'), 'neighbor copy points at the separate cluster contract');
    return observed;
  });

  const anchor = await visibleAnchor();

  await record('A2-assisted-places-companion-atomically', async () => {
    await selectTile(290);
    await clusterAssist(true);
    assert.ok(await awaitStoreChange(() => clickTile(anchor.x, anchor.y)), 'assisted paint must commit');
    const tiles = await mapTiles();
    assert.equal(at(tiles, 'lower', anchor.x, anchor.y), 290, 'trunk on lower');
    assert.equal(at(tiles, 'upper', anchor.x, anchor.y - 1), 260, 'canopy placed above');
    assert.deepEqual(await lintViolations(), [], 'complete tree has no hard violation');
    return { anchor, trunk: at(tiles, 'lower', anchor.x, anchor.y), canopy: at(tiles, 'upper', anchor.x, anchor.y - 1) };
  });

  for (const trunk of [290, 291, 292]) {
    await record(`B-${trunk}-rejection-offers-exact-place`, async () => {
      // Occupy the canopy cell with an unrelated upper object: the assisted plan
      // must refuse rather than overwrite it.
      const target = { x: anchor.x + 4 + (trunk - 290) * 4, y: anchor.y + 3 };
      await page.evaluate(({ x, y }) => {
        const { store, state } = window.clusterQa;
        store.updateMap(state.get().currentMapId, map => {
          map.upperTiles[(y - 1) * map.width + x] = 237;
        }, { cells: [{ x, y: y - 1, layer: 'upper' }] });
      }, target);
      await selectTile(trunk);
      await clusterAssist(true);
      const before = await mapTiles();
      await clickTile(target.x, target.y);
      const message = await toastText();
      const action = page.getByTestId('cluster-exact-place');
      await action.waitFor({ state: 'visible' });
      // The rejection toast itself is the user-visible recovery path — capture it while open.
      await shot(`B-${trunk}-rejection-toast`);
      const rejected = await mapTiles();
      assert.equal(at(rejected, 'lower', target.x, target.y), at(before, 'lower', target.x, target.y), 'rejected paint leaves the cell alone');
      assert.ok(message.includes('237') || message.includes('상위'), `rejection names the blocking object: ${message}`);
      assert.ok(message.includes(`(${target.x},${target.y - 1})`), `rejection names the blocked companion coordinate: ${message}`);
      assert.ok(message.includes(String(trunk)) && message.includes('규칙:'), `rejection quotes the vertical rule: ${message}`);
      const actionLabel = (await action.textContent())?.trim();

      // Recovery: exactly the clicked cell and layer change.
      assert.ok(await awaitStoreChange(() => action.click()), 'exact placement must commit');
      const after = await mapTiles();
      assert.equal(at(after, 'lower', target.x, target.y), trunk, 'exact placement wrote the trunk');
      assert.equal(at(after, 'upper', target.x, target.y - 1), 237, 'the other upper object survived');
      const changed = after.lower.flatMap((value, index) => value !== before.lower[index] ? [index] : [])
        .concat(after.upper.flatMap((value, index) => value !== before.upper[index] ? [index + 100000] : []));
      assert.equal(changed.length, 1, `exact placement changed exactly one cell, got ${changed.length}`);

      // The resulting hard-cluster violation stays visible with rule + coordinates.
      const violations = await lintViolations();
      const mine = violations.find(violation => violation.coords.includes(`${target.x},${target.y}`));
      assert.ok(mine, `lint still reports the violation: ${JSON.stringify(violations)}`);

      // One undo removes it; redo restores it.
      assert.ok(await awaitStoreChange(() => page.evaluate(() => window.clusterQa.history.undoMapEdit())), 'undo commits');
      const undone = await mapTiles();
      assert.equal(at(undone, 'lower', target.x, target.y), at(before, 'lower', target.x, target.y), 'one undo reverts the exact placement');
      assert.ok(await awaitStoreChange(() => page.evaluate(() => window.clusterQa.history.redoMapEdit())), 'redo commits');
      assert.equal(at(await mapTiles(), 'lower', target.x, target.y), trunk, 'redo restores it');
      return { trunk, target, message, actionLabel, violation: mine };
    });
  }

  await record('C-exact-mode-paints-boundary-and-lint-shows-debt', async () => {
    await clusterAssist(false);
    const cluster = page.getByTestId('cluster-assist-mode-toggle');
    assert.equal(await cluster.getAttribute('aria-pressed'), 'false');
    // Paint on the top visible row: an assisted plan there would need a canopy further up.
    const exact = { x: anchor.x + 2, y: anchor.topY };
    await selectTile(291);
    const before = await mapTiles();
    assert.ok(await awaitStoreChange(() => clickTile(exact.x, exact.y)), 'exact mode paints without rejection');
    const after = await mapTiles();
    assert.equal(at(after, 'lower', exact.x, exact.y), 291);
    assert.equal(at(after, 'upper', exact.x, exact.y - 1), at(before, 'upper', exact.x, exact.y - 1), 'no forced canopy');
    const violations = await lintViolations();
    const mine = violations.find(violation => violation.coords.includes(`${exact.x},${exact.y}`));
    assert.ok(mine, `structural debt remains visible: ${JSON.stringify(violations)}`);
    return { exact, chipLabel: (await cluster.textContent())?.trim(), violation: mine };
  });
} finally {
  await writeFile(`${output}/RESULTS.json`, JSON.stringify({ baseUrl, pageErrors, results }, null, 2));
  const lines = [
    '# OPRN-OUT-017 browser evidence',
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
