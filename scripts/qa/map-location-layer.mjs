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

// ── 카메라 제스처는 카메라의 것이다 (2026-09-11).
//
// 오버레이는 포인터의 표적이라, 이 검사가 없던 동안에는 「화면 밀기」·스페이스 팬·가운데 버튼
// 드래그가 팬을 시작조차 못 하고 오버레이의 «빈 곳 그리기» 로 흘러들어 구역을 만들거나 옮겼다.
// 세 제스처가 (1) 맵을 실제로 움직이고 (2) 구역 좌표를 건드리지 않고 (3) 상자가 제 타일에
// 남는지 확인한다. 상자의 화면 사각형은 캔버스 기준 world→client 훅으로 **독립 검산**한다 —
// 같은 산식끼리만 비교하면 렌더가 통째로 어긋나도 초록불이 켜진다.
const resolvedId = locationId.replace(/^ID\s+/, '').split(' ')[0];

const cameraState = () => page.evaluate(async id => {
  const [layer, registry] = await Promise.all([
    import('/src/editor/mapLocationLayerState.ts'),
    import('/src/editor/regionClientRect.ts'),
  ]);
  const location = layer.currentLocations().find(entry => entry.id === id);
  const boxRect = document.querySelector(`[data-testid="map-location-box-${id}"]`)?.getBoundingClientRect() ?? null;
  const world = location ? window.__oprnEditWorldToClient(location.x * 16, location.y * 16) : null;
  const expected = location ? registry.resolveRegionClientRect({ x: location.x, y: location.y, width: location.w, height: location.h }) : null;
  return {
    tool: document.body.dataset.editorTool ?? null,
    camera: window.__oprnEditCamera?.() ?? null,
    rect: location ? `${location.x},${location.y},${location.w},${location.h}` : null,
    count: layer.currentLocations().length,
    box: boxRect ? `${Math.round(boxRect.left)},${Math.round(boxRect.top)}` : null,
    world: world ? `${Math.round(world.x)},${Math.round(world.y)}` : null,
    expected: expected ? `${Math.round(expected.x)},${Math.round(expected.y)}` : null,
  };
}, resolvedId);

const tilePoint = (tx, ty) => page.evaluate(async ([x, y]) => {
  const module = await import('/src/editor/regionClientRect.ts');
  const rect = module.resolveRegionClientRect({ x, y, width: 1, height: 1 });
  return rect ? { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 } : null;
}, [tx, ty]);

const blurInspector = () => page.evaluate(() => (document.activeElement instanceof HTMLElement ? document.activeElement.blur() : undefined));
const cameraMoved = (before, after) =>
  before.camera.scrollX !== after.camera.scrollX || before.camera.scrollY !== after.camera.scrollY;
function assertBoxFollowsCamera(label, state) {
  assert.ok(state.box, `${label}: 상자가 그려져 있어야 한다`);
  assert.equal(state.box, state.expected, `${label}: 상자가 카메라 변환을 따라야 한다`);
  const [boxX, boxY] = state.box.split(',').map(Number);
  const [worldX, worldY] = (state.world ?? '').split(',').map(Number);
  assert.ok(Math.abs(boxX - worldX) <= 1 && Math.abs(boxY - worldY) <= 1,
    `${label}: 상자 ${state.box} 가 캔버스 훅 ${state.world} 와 1px 안에서 같아야 한다`);
}

// (A) 「화면 밀기」 도구로 맵을 민다 — 이 드래그의 주인은 카메라다.
await blurInspector();
await page.mouse.move(700, 500);
await page.keyboard.press('4'); // 숫자키 4 = 화면 밀기(툴바 순서와 같다)
const panBefore = await cameraState();
assert.equal(panBefore.tool, 'pan', '숫자키 4 가 화면 밀기 도구를 켜야 한다');
const panFrom = await tilePoint(6, 6);
await page.mouse.move(panFrom.x, panFrom.y);
await page.mouse.down();
await page.mouse.move(panFrom.x - 140, panFrom.y - 80, { steps: 10 });
await page.mouse.up();
const panAfter = await cameraState();
assert.ok(cameraMoved(panBefore, panAfter), '화면 밀기 드래그가 맵을 움직여야 한다');
assert.equal(panAfter.rect, panBefore.rect, '맵을 미는 드래그가 구역 좌표를 옮기면 안 된다');
assert.equal(panAfter.count, panBefore.count, '맵을 미는 드래그가 구역을 만들면 안 된다');
assertBoxFollowsCamera('화면 밀기', panAfter);
await shot('07-pan-tool-moves-map', `화면 밀기 드래그: 카메라 ${Math.round(panBefore.camera.scrollX)},${Math.round(panBefore.camera.scrollY)} → ${Math.round(panAfter.camera.scrollX)},${Math.round(panAfter.camera.scrollY)} · 구역 ${panAfter.rect} 유지 · 상자 ${panAfter.box}`);

// (B) 스페이스 팬 — 도구와 무관하게 카메라의 제스처다.
await page.keyboard.press('1');
await blurInspector();
const spaceBefore = await cameraState();
await page.mouse.move(700, 560);
await page.keyboard.down(' ');
await page.mouse.down();
await page.mouse.move(640, 500, { steps: 8 });
await page.mouse.up();
await page.keyboard.up(' ');
const spaceAfter = await cameraState();
assert.ok(cameraMoved(spaceBefore, spaceAfter), '스페이스 드래그가 맵을 움직여야 한다');
assert.equal(spaceAfter.rect, spaceBefore.rect, '스페이스 드래그가 구역을 옮기면 안 된다');
assert.equal(spaceAfter.count, spaceBefore.count, '스페이스 드래그가 구역을 만들면 안 된다');
assertBoxFollowsCamera('스페이스 팬', spaceAfter);
await shot('08-space-pan-keeps-location', `스페이스 팬: 구역 ${spaceAfter.rect} · 구역 수 ${spaceAfter.count} 유지 · 상자 ${spaceAfter.box}`);

// (C) 휠 팬과 Ctrl+휠 확대 — 오버레이가 삼키면 둘 다 죽는다(캔버스 리스너가 안 돈다).
const wheelBefore = await cameraState();
await page.mouse.move(700, 500);
await page.mouse.wheel(0, 240);
await page.waitForTimeout(150);
const wheelAfter = await cameraState();
assert.ok(cameraMoved(wheelBefore, wheelAfter), '휠이 맵을 밀어야 한다');
assertBoxFollowsCamera('휠 팬', wheelAfter);
await page.keyboard.down('Control');
await page.mouse.wheel(0, -240);
await page.keyboard.up('Control');
await page.waitForTimeout(200);
const zoomAfter = await cameraState();
assert.ok(zoomAfter.camera.zoom !== wheelAfter.camera.zoom, 'Ctrl+휠이 확대해야 한다');
assertBoxFollowsCamera('Ctrl+휠 확대', zoomAfter);
await shot('09-wheel-pan-follows', `휠 팬 scrollY ${Math.round(wheelBefore.camera.scrollY)} → ${Math.round(wheelAfter.camera.scrollY)}, Ctrl+휠 zoom ${wheelAfter.camera.zoom} → ${zoomAfter.camera.zoom} · 상자 ${zoomAfter.box}`);

// 레이어 자신의 제스처는 그대로여야 한다: 빈 곳 드래그 = 새 구역(카메라가 아니라 오버레이의 것).
const layerGestureBefore = await cameraState();
const emptyFrom = await page.evaluate(async () => {
  const [registry, layer] = await Promise.all([
    import('/src/editor/regionClientRect.ts'),
    import('/src/editor/mapLocationLayerState.ts'),
  ]);
  const canvas = document.querySelector('.phaser-container canvas').getBoundingClientRect();
  for (let dx = -240; dx <= 240; dx += 40) {
    for (let dy = -160; dy <= 160; dy += 40) {
      const probe = { x: canvas.left + canvas.width / 2 + dx, y: canvas.top + canvas.height / 2 + dy };
      const tile = registry.resolveClientPointTile(probe);
      if (!tile || layer.locationAt(tile)) continue;
      const rect = registry.resolveRegionClientRect({ x: tile.x, y: tile.y, width: 1, height: 1 });
      if (rect) return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
    }
  }
  return null;
});
assert.ok(emptyFrom, '빈 타일을 찾아야 한다');
await page.mouse.move(emptyFrom.x, emptyFrom.y);
await page.mouse.down();
await page.mouse.move(emptyFrom.x + 64, emptyFrom.y + 48, { steps: 8 });
await page.mouse.up();
const layerGestureAfter = await cameraState();
assert.equal(layerGestureAfter.count, layerGestureBefore.count + 1, '빈 곳 드래그는 여전히 새 구역을 만들어야 한다');
assert.ok(!cameraMoved(layerGestureBefore, layerGestureAfter), '구역 그리기는 카메라를 움직이면 안 된다');
await shot('10-layer-draw-still-works', `레이어 자신의 제스처 유지: 구역 ${layerGestureBefore.count} → ${layerGestureAfter.count}개`);

// 새로 그린 구역이 자동 선택되므로, 다음 단계가 보는 구역을 원래 것으로 되돌린다.
await page.evaluate(async id => {
  const layer = await import('/src/editor/mapLocationLayerState.ts');
  layer.selectLocation(id);
}, resolvedId);

// 다음 단계(DOM 창)는 카메라와 무관하지만, 도구를 원래대로 돌려놓는다.
await page.keyboard.press('1');

// Reference the location from a random encounter through the real map settings dialog.
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
await shot('11-referenced-by-encounter', `Random encounter now points at the named area: ${refText}`);

// Delete it and prove the diagnostic + repair path are visible rather than silent.
page.once('dialog', dialog => dialog.accept());
await page.getByTestId('map-location-delete').click();
await page.getByTestId('map-location-broken').waitFor({ state: 'visible' });
const brokenText = (await page.getByTestId('map-location-broken').textContent() ?? '').trim();
assert.ok(brokenText.includes(resolvedId), 'broken-reference panel must name the missing location');
await shot('12-broken-reference-repair', 'Deleting a referenced area surfaces the diagnostic and its repair buttons.');

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
