// LOC-ADOPT browser evidence: survey builder layout regions, adopt one map, prove the
// second run is idempotent, and prove one undo removes the whole thing.
//
// Runs against the real editor shell on the worktree dev server. The GET relay mirrors
// scripts/qa/map-location-layer.mjs — this workstation cancels Chromium's own loopback
// requests on network changes, so bytes are relayed while the browser still executes the
// shipped app.
//
//   DEV_SERVER_PORT=9862 npm run dev:worktree      # separate terminal
//   ADOPTION_QA_URL=http://127.0.0.1:9862 node scripts/qa/map-location-adoption.mjs

import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';

const output = process.env.ADOPTION_QA_OUTPUT ?? 'verify-shots/loc-adopt';
const baseUrl = process.env.ADOPTION_QA_URL ?? 'http://127.0.0.1:9862';
await mkdir(output, { recursive: true });

const browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
const context = await browser.newContext({ viewport: { width: 1440, height: 960 } });
const page = await context.newPage();

await page.route('**/*', async route => {
  const request = route.request();
  if (request.method() !== 'GET' || new URL(request.url()).origin !== new URL(baseUrl).origin) return route.continue();
  const response = await fetch(request.url(), { signal: AbortSignal.timeout(90000) });
  await route.fulfill({ status: response.status, headers: Object.fromEntries(response.headers), body: Buffer.from(await response.arrayBuffer()) });
});
page.setDefaultTimeout(90000);

// Environmental noise that is not this feature's behavior: the GET relay cannot proxy the
// Vite HMR websocket, and `?blankProject=1` disables remote persistence on purpose.
const IGNORED_ERROR = /WebSocket|ERR_CONNECTION_REFUSED|\[autosave\]|vite\.dev\/config\/server-options/;
const errors = [];
page.on('pageerror', error => errors.push(`pageerror: ${error.message}`));
page.on('console', message => {
  if (message.type() !== 'error') return;
  const text = message.text();
  if (!IGNORED_ERROR.test(text)) errors.push(`console: ${text}`);
});

await page.addInitScript(() => {
  localStorage.setItem('oprn:editor-ui-mode', 'standard');
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
// The location layer resolves geometry through the EditScene camera; wait for the scene's
// own readiness signal rather than sleeping (a fixed delay passes or fails by machine load).
await page.waitForFunction(() => Boolean(window.__oprnEditWorldToClient), null, { timeout: 120000 });

// Seed two builder maps. A blank project has no layoutPlan, and the whole point of this
// feature is old builder output, so we write the exact shape village/builder.ts writes.
// This is a QA fixture in a throwaway blankProject session, not authored content.
const seeded = await page.evaluate(async () => {
  const { store } = await import('/src/project/store.ts');
  const { editorState } = await import('/src/editor/editorState.ts');
  const base = store.getCurrent();
  const startId = editorState.get().currentMapId ?? base.startMapId;
  const template = base.maps[startId];
  const size = template.width * template.height;
  const secondId = 'qa_hamlet';
  store.update(project => {
    project.maps[startId].name = '큰 강 마을';
    project.maps[startId].layoutPlan = {
      version: 1,
      kind: 'large-river-market-village',
      regions: [
        { id: 'plaza_1', role: 'plaza', label: '중앙 광장', x: 6, y: 6, w: 6, h: 5, tags: ['commons'] },
        { id: 'market_1', role: 'market', label: '북쪽 상점가', x: 14, y: 3, w: 7, h: 4, tags: ['shop'] },
        { id: 'house_1', role: 'house', label: '파랑 지붕 석벽 집 (ㄱ자)', x: 2, y: 2, w: 4, h: 4 },
        { id: 'house_2', role: 'house', label: '밝은 회벽 집 (사각)', x: 2, y: 12, w: 4, h: 4 },
        { id: 'river_1', role: 'river', label: '서쪽 강', x: 0, y: 20, w: 24, h: 3, tags: ['water'] },
      ],
    };
    project.maps[secondId] = {
      ...structuredClone(template),
      id: secondId,
      name: '작은 마을',
      events: [],
      lowerTiles: new Array(size).fill(template.lowerTiles[0] ?? 0),
      upperTiles: new Array(size).fill(0),
      layoutPlan: {
        version: 1,
        kind: 'village-harness-natural-v2',
        regions: [{ id: 'village_commons', role: 'plaza', label: '중앙 녹지 광장', x: 4, y: 4, w: 6, h: 6 }],
      },
    };
  }, { scope: 'project', label: 'qa builder plan seed' });
  return { startId, secondId, locations: store.getCurrent().maps[startId].locations ?? null };
});
assert.equal(seeded.locations, null, 'seeding a builder plan must not create locations');

// ── 1. Survey first, read-only.
await page.getByTestId('map-location-layer-toggle').click();
await page.getByTestId('map-location-inspector').waitFor({ state: 'visible' });
const inlineSurvey = (await page.getByTestId('map-location-adopt-survey').textContent() ?? '').trim();
assert.ok(inlineSurvey.includes('2개'), `inspector must count this map's default candidates, got: ${inlineSurvey}`);
await shot('01-layer-inline-survey', `Location layer inspector counts before anything is written: ${inlineSurvey}`);

await page.getByTestId('map-location-adopt-regions').click();
await page.getByTestId('location-adoption-panel').waitFor({ state: 'visible' });
const summary = (await page.getByTestId('location-adoption-summary').textContent() ?? '').trim();
assert.ok(summary.includes('고른 맵이 없어'), `opening must select nothing, got: ${summary}`);
const afterOpen = await page.evaluate(async () => {
  const { store } = await import('/src/project/store.ts');
  return Object.values(store.getCurrent().maps).some(map => Array.isArray(map.locations) && map.locations.length > 0);
});
assert.equal(afterOpen, false, 'opening the survey must not adopt anything');
await shot('02-survey-readonly', `Survey window: per-map candidates, role filter, nothing selected. "${summary}"`);

// Role filter defaults: construction roles are off and say why. Then prove the filter is
// live by turning 집 롯 on and watching the candidate count jump, and turn it back off.
const houseChecked = await page.getByTestId('location-adoption-role-house').isChecked();
assert.equal(houseChecked, false, 'house must be off by default');
const roleText = (await page.getByTestId('location-adoption-roles').textContent() ?? '');
assert.ok(roleText.includes('houseProtection'), 'the role filter must state why house is off');

await page.getByTestId('location-adoption-role-house').check();
const widened = (await page.getByTestId('location-adoption-summary').textContent() ?? '').trim();
assert.ok(widened.includes('승격 후보 5개'), `turning house on must re-count, got: ${widened}`);
await shot('03-role-filter-widened', `Turning 집 롯 on re-counts live — 3 → 5 candidates. "${widened}"`);
await page.getByTestId('location-adoption-role-house').uncheck();
assert.ok(
  (await page.getByTestId('location-adoption-summary').textContent() ?? '').includes('승격 후보 3개'),
  'unchecking must restore the default count',
);

// ── 2. Per-map adoption. Select exactly one of the two maps.
await page.getByTestId(`location-adoption-check-${seeded.startId}`).check();
await page.getByTestId('location-adoption-run').click();
await page.getByTestId('location-adoption-receipt').waitFor({ state: 'visible' });
const receipt = (await page.getByTestId('location-adoption-receipt').textContent() ?? '').trim();
assert.ok(receipt.includes('구역 2개 생성'), `receipt must report what was created, got: ${receipt}`);
const afterRun = await page.evaluate(async ([first, second]) => {
  const { store } = await import('/src/project/store.ts');
  const project = store.getCurrent();
  return {
    adopted: (project.maps[first].locations ?? []).map(entry => ({ id: entry.id, name: entry.name, origin: entry.origin })),
    untouched: project.maps[second].locations ?? null,
    planUnchanged: project.maps[first].layoutPlan.regions.length,
  };
}, [seeded.startId, seeded.secondId]);
assert.equal(afterRun.adopted.length, 2, 'exactly the two commons regions must be adopted');
assert.equal(afterRun.untouched, null, 'the unselected map must be untouched');
assert.equal(afterRun.planUnchanged, 5, 'layoutPlan must still hold all five builder regions');
assert.ok(afterRun.adopted.every(entry => entry.origin?.kind === 'layoutRegion'), 'adopted locations carry a stable origin');
await shot('04-adopted-one-map', `Adopted 2 areas into ${seeded.startId} only; the other builder map is untouched. ${receipt}`);

// ── 3. Second run is idempotent.
await page.getByTestId('location-adoption-run').click();
await page.getByTestId('location-adoption-receipt').waitFor({ state: 'visible' });
const secondReceipt = (await page.getByTestId('location-adoption-receipt').textContent() ?? '').trim();
assert.ok(secondReceipt.includes('이미 전부 승격돼 있습니다'), `second run must report idempotency, got: ${secondReceipt}`);
const afterSecond = await page.evaluate(async id => {
  const { store } = await import('/src/project/store.ts');
  return (store.getCurrent().maps[id].locations ?? []).length;
}, seeded.startId);
assert.equal(afterSecond, 2, 'the second run must not add duplicates');
await shot('05-idempotent-second-run', `Second run created nothing: "${secondReceipt}" — still 2 areas.`);

// ── 4. One undo removes the entire adoption.
const undone = await page.evaluate(async id => {
  const { undoMapEdit } = await import('/src/editor/mapEditHistory.ts');
  const { store } = await import('/src/project/store.ts');
  const ok = undoMapEdit();
  const map = store.getCurrent().maps[id];
  return { ok, locations: map.locations ?? null, regions: map.layoutPlan.regions.length };
}, seeded.startId);
assert.equal(undone.ok, true, 'undo must apply');
assert.equal(undone.locations, null, 'one undo must remove the whole adoption');
assert.equal(undone.regions, 5, 'undo must leave layoutPlan intact');
await shot('06-single-undo', 'One undo removed the entire multi-area adoption; layoutPlan still has its five regions.');

assert.equal(errors.length, 0, `page errors: ${errors.join(' | ')}`);

await writeFile(
  `${output}/SUMMARY.md`,
  [
    '# LOC-ADOPT — layout-region adoption workbench (browser evidence)',
    '',
    `Captured against \`${baseUrl}/?blankProject=1\` at 1440x960, editor standard mode.`,
    'Two builder maps were seeded through the real store with the exact `layoutPlan` shape',
    '`village/builder.ts` and `largeRiverMarketVillageBuild.ts` write. No page errors were',
    'raised (the Vite HMR websocket and the intentional `?blankProject=1` autosave-disabled',
    'notices are filtered as environment noise).',
    '',
    ...steps.map(step => `- \`${step.name}.png\` — ${step.note}`),
    '',
    'Machine assertions that ran alongside the shots:',
    '- seeding a `layoutPlan` creates **no** `locations` field;',
    '- opening the survey adopts nothing (`locations` still absent on every map);',
    '- `house` is off by default and the panel states `houseProtection` as the reason;',
    '- adopting with one map checked leaves the other builder map at `locations == null`;',
    '- `layoutPlan.regions` still holds all five regions after the run and after undo;',
    '- the second run reports "이미 전부 승격돼 있습니다" and the count stays at 2;',
    '- a single `undoMapEdit()` removes the whole adoption.',
    '',
    'Replay: `DEV_SERVER_PORT=9862 npm run dev:worktree` then',
    '`ADOPTION_QA_URL=http://127.0.0.1:9862 node scripts/qa/map-location-adoption.mjs`.',
    '',
  ].join('\n'),
);

await browser.close();
console.log(`map-location-adoption QA captured ${steps.length} shots into ${output}`);
