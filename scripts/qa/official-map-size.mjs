// Actual editor dialog/action/store modules in an isolated browser fixture.
// No full editor boot, runtime QA, or project host writes.
import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { chromium } from '@playwright/test';

const root = resolve(import.meta.dirname, '../..');
const out = resolve(root, 'verify-shots/official-map-512-20261001');
const port = (await readFile(resolve(root, '.env.local'), 'utf8')).match(/^DEV_SERVER_PORT=(\d+)/m)?.[1];
assert.ok(port, 'Start a fresh npm run dev:worktree server first (no HMR edits during this probe)');
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--use-gl=swiftshader', '--disable-gpu'] });
const report = { fixtureOnly: true, harness: 'editor dialog modules (not full editor boot)', errors: [] };
try {
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
  page.on('pageerror', error => report.errors.push(String(error)));
  await page.routeWebSocket(/ws:\/\/127\.0\.0\.1:.*\/?\?token=/, socket => socket.send(JSON.stringify({ type: 'connected' })));
  await page.route('**/*', async route => {
    const url = route.request().url();
    if (!url.startsWith(`http://127.0.0.1:${port}/`)) return route.continue();
    if (new URL(url).pathname === '/__map512-dialog-qa.html') {
      return route.fulfill({ contentType: 'text/html', body: `<!doctype html>
        <html lang="ko"><head><meta charset="utf-8"><link rel="stylesheet" href="/src/styles/index.css?direct"></head>
        <body><main style="padding:32px"><h1>맵 크기 입력 검증</h1>
        <p>실제 편집기 맵 만들기 창 · 독립 테스트 fixture</p><pre id="result"></pre></main></body></html>` });
    }
    let response;
    for (let attempt = 0; attempt < 4; attempt++) {
      try { response = await fetch(url); break; }
      catch (error) { if (attempt === 3) throw error; }
    }
    await route.fulfill({ status: response.status, contentType: response.headers.get('content-type') ?? 'application/octet-stream', body: Buffer.from(await response.arrayBuffer()) });
  });
  await page.addInitScript(() => {
    localStorage.clear();
  });
  await page.goto(`http://127.0.0.1:${port}/__map512-dialog-qa.html?freshProject=1&aiBridge=0`, { waitUntil: 'networkidle', timeout: 120000 });
  await page.evaluate(async () => { const { openMapCreateDialog } = await import('/src/editor/panels/mapCreateDialog.ts'); openMapCreateDialog(); });
  await page.getByTestId('map-create-name').fill('512 크기 QA fixture');
  await page.getByTestId('map-create-width').fill('513');
  await page.getByTestId('map-create-height').fill('512');
  report.inputMax = await page.getByTestId('map-create-width').getAttribute('max');
  assert.equal(report.inputMax, '512');
  await page.getByTestId('map-create-confirm').click();
  assert.equal(await page.getByTestId('map-create-dialog').isVisible(), true);
  assert.ok((await page.locator('body').innerText()).includes('최대 512×512'));
  report.overLimitRejected = true;
  await page.getByTestId('map-create-width').fill('512');
  await page.getByTestId('map-create-dialog').screenshot({ path: resolve(out, '512-dialog.png') });
  await page.getByTestId('map-create-confirm').click();
  await page.getByTestId('map-create-dialog').waitFor({ state: 'hidden', timeout: 30000 });
  report.created = await page.evaluate(async () => {
    const { store } = await import('/src/project/store.ts');
    const { serialize, deserialize } = await import('/src/project/io.ts');
    const { canOpenEditorMap } = await import('/src/editor/mapSelection.ts');
    const project = store.getCurrent();
    const map = Object.values(project.maps).find(map => map.name === '512 크기 QA fixture');
    if (!map) throw new Error(`UI did not create the map: ${JSON.stringify(Object.values(project.maps).map(m => ({ name: m.name, width: m.width, height: m.height })))}`);
    const restored = deserialize(serialize(project)).maps[map.id];
    return { width: map.width, height: map.height, lowerCells: map.lowerTiles.length, editorOpenable: canOpenEditorMap(map.id),
      reloadedWidth: restored.width, reloadedHeight: restored.height, reloadedCells: restored.lowerTiles.length };
  });
  assert.deepEqual(report.created, { width: 512, height: 512, lowerCells: 262144, editorOpenable: true,
    reloadedWidth: 512, reloadedHeight: 512, reloadedCells: 262144 });
  await page.locator('#result').evaluate((element, result) => { element.textContent = JSON.stringify(result, null, 2); }, report.created);
  await page.screenshot({ path: resolve(out, '512-created.png') });
  assert.deepEqual(report.errors, []);
  console.log(JSON.stringify(report));
} finally {
  await writeFile(resolve(out, 'results.json'), JSON.stringify(report, null, 2));
  await browser.close();
}
