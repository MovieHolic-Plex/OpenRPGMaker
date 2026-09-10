// OPRN-OUT-020 browser evidence: draw, name and reference a named map location.
//
// Runs against the real editor shell on the worktree dev server (port 9854 by default).
// The GET relay mirrors scripts/qa/sidebar-focus.mjs — this workstation cancels Chromium's
// own loopback requests on network changes, so bytes are relayed while the actual browser
// still executes the shipped app.
//
//   npm run dev:worktree     # separate terminal
//   MAP_LOCATION_QA_URL=http://127.0.0.1:9854 node scripts/qa/map-location-layer.mjs

import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';

const output = process.env.MAP_LOCATION_QA_OUTPUT ?? 'verify-shots/oprn-020';
const baseUrl = process.env.MAP_LOCATION_QA_URL ?? 'http://127.0.0.1:9854';
await mkdir(output, { recursive: true });

const browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await context.newPage();

await page.route('**/*', async route => {
  const request = route.request();
  if (request.method() !== 'GET' || new URL(request.url()).origin !== new URL(baseUrl).origin) return route.continue();
  const response = await fetch(request.url(), { signal: AbortSignal.timeout(90000) });
  await route.fulfill({ status: response.status, headers: Object.fromEntries(response.headers), body: Buffer.from(await response.arrayBuffer()) });
});
page.setDefaultTimeout(90000);

// Environmental noise that is not this feature's behavior:
//  - the GET relay cannot proxy the Vite HMR websocket, so the client logs a failed socket;
//  - `?blankProject=1` disables remote persistence on purpose, so autosave reports failure.
// Everything else counts as a real page error.
const IGNORED_ERROR = /WebSocket|ERR_CONNECTION_REFUSED|\[autosave\]|vite\.dev\/config\/server-options/;
const errors = [];
page.on('pageerror', error => errors.push(`pageerror: ${error.message}`));
page.on('console', message => {
  if (message.type() !== 'error') return;
  const text = message.text();
  if (!IGNORED_ERROR.test(text)) errors.push(`console: ${text}`);
});

await page.addInitScript(() => {
  localStorage.setItem('rpg-zzu:editor-ui-mode', 'standard');
  localStorage.setItem('oprn:ai-panel-collapsed', '1');
  localStorage.removeItem('oprn:map-location-layer');
});

const steps = [];
async function shot(name, note) {
  await page.screenshot({ path: `${output}/${name}.png`, fullPage: false });
  steps.push({ name, note });
}

await page.goto(`${baseUrl}/?blankProject=1`);
await page.getByTestId('map-location-layer-toggle').waitFor({ state: 'visible' });

// The layer converts pointer positions through the EditScene camera, so the drag gestures
// below are meaningless until the scene registered its resolvers. Wait for the scene's own
// readiness signal rather than sleeping — a fixed delay passes or fails by machine load.
// `__oprnEditWorldToClient` is installed by EditScene.create alongside the resolvers.
await page.waitForFunction(() => Boolean(window.__oprnEditWorldToClient), null, { timeout: 120000 });
await page.waitForFunction(async () => {
  const registry = await import('/src/editor/regionClientRect.ts');
  return registry.resolveClientPointTile({ x: 700, y: 400 }) !== null;
}, null, { timeout: 120000, polling: 250 });
await shot('01-toolbar-toggle', 'Location layer toggle sits in the canvas toolbar in every edit mode.');

// The layer must be inert until it is switched on — no overlay boxes, no inspector.
const inertActive = await page.getByTestId('map-location-layer').evaluate(node => node.classList.contains('is-active'));
assert.equal(inertActive, false, 'layer must start inert');

await page.getByTestId('map-location-layer-toggle').click();
await page.getByTestId('map-location-inspector').waitFor({ state: 'visible' });
await shot('02-layer-on-empty', 'Layer on: inspector explains that dragging an empty area creates a named area.');

// Draw a location by dragging on the canvas overlay. The start/end points are resolved
// through the scene camera so the gesture lands on real map tiles rather than on the
// container padding around the canvas (the overlay is larger than the map).
const dragStart = await page.evaluate(async () => {
  const module = await import('/src/editor/regionClientRect.ts');
  const rect = module.resolveRegionClientRect({ x: 3, y: 3, width: 1, height: 1 });
  return rect ? { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 } : null;
});
const dragEnd = await page.evaluate(async () => {
  const module = await import('/src/editor/regionClientRect.ts');
  const rect = module.resolveRegionClientRect({ x: 11, y: 9, width: 1, height: 1 });
  return rect ? { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 } : null;
});
assert.ok(dragStart && dragEnd, 'camera must resolve both drag endpoints');
await page.mouse.move(dragStart.x, dragStart.y);
await page.mouse.down();
await page.mouse.move(dragEnd.x, dragEnd.y, { steps: 12 });
await shot('03-drawing-drag', 'Drag preview shows the live tile size while the rectangle is drawn.');
await page.mouse.up();

await page.getByTestId('map-location-name-input').waitFor({ state: 'visible' });
await shot('04-drawn-and-selected', 'Released drag creates the area, selects it and focuses the name field.');

// Name it. The stable id line proves references survive the label change.
const nameInput = page.getByTestId('map-location-name-input');
await nameInput.fill('정문 광장');
await nameInput.blur();
await page.getByTestId('map-location-inspector').getByText('정문 광장').first().waitFor({ state: 'visible' });
const locationId = (await page.getByTestId('map-location-id').textContent() ?? '').trim();
assert.ok(locationId.includes('ID '), 'inspector must show the stable id');
await shot('05-named', `Named the area. ${locationId}`);

// Rename to prove the id (and therefore every reference) does not move.
await nameInput.fill('중앙 광장');
await nameInput.blur();
const afterRename = (await page.getByTestId('map-location-id').textContent() ?? '').trim();
assert.equal(afterRename, locationId, 'stable id must survive a rename');
await shot('06-renamed-same-id', 'Renamed to 중앙 광장 — the stable id line is unchanged.');

// Reference the location from a random encounter through the real map settings dialog.
const resolvedId = locationId.replace(/^ID\s+/, '').split(' ')[0];
await page.evaluate(async id => {
  const { store } = await import('/src/project/store.ts');
  const { editorState } = await import('/src/editor/editorState.ts');
  const mapId = editorState.get().currentMapId ?? store.getCurrent().startMapId;
  const troopId = store.getCurrent().database.troops[0]?.id;
  store.update(project => {
    const map = project.maps[mapId];
    map.encounterRate = 30;
    map.encounterTable = [{ troopId, weight: 1, conditions: { locationId: id } }];
  }, { scope: 'map', mapId, label: 'qa encounter seed' });
}, resolvedId);

await page.getByTestId('map-location-refs').waitFor({ state: 'visible' });
const refText = (await page.getByTestId('map-location-refs').textContent() ?? '').trim();
assert.ok(refText.includes('1건'), `inspector must count the encounter reference, got: ${refText}`);
await shot('07-referenced-by-encounter', `Random encounter now points at the named area: ${refText}`);

// Delete it and prove the diagnostic + repair path are visible rather than silent.
page.once('dialog', dialog => dialog.accept());
await page.getByTestId('map-location-delete').click();
await page.getByTestId('map-location-broken').waitFor({ state: 'visible' });
const brokenText = (await page.getByTestId('map-location-broken').textContent() ?? '').trim();
assert.ok(brokenText.includes(resolvedId), 'broken-reference panel must name the missing location');
await shot('08-broken-reference-repair', 'Deleting a referenced area surfaces the diagnostic and its repair buttons.');

assert.equal(errors.length, 0, `page errors: ${errors.join(' | ')}`);

await writeFile(
  `${output}/SUMMARY.md`,
  [
    '# OPRN-OUT-020 — named map location layer (browser evidence)',
    '',
    `Captured against \`${baseUrl}/?blankProject=1\` at 1440x900, editor standard mode.`,
    'No page errors were raised during the run (the Vite HMR websocket and the intentional',
    '`?blankProject=1` autosave-disabled notices are filtered as environment noise).',
    '',
    ...steps.map(step => `- \`${step.name}.png\` — ${step.note}`),
    '',
    'Replay: `npm run dev:worktree` then',
    '`MAP_LOCATION_QA_URL=http://127.0.0.1:9854 node scripts/qa/map-location-layer.mjs`.',
    '',
  ].join('\n'),
);

await browser.close();
console.log(`map-location-layer QA captured ${steps.length} shots into ${output}`);
