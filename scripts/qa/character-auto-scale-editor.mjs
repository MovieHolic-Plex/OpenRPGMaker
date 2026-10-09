// Actual event editor controls over a synthetic contract fixture; no remote content writes.
import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';
const url = process.env.TILE_EDITOR_URL;
assert(url, 'Set TILE_EDITOR_URL');
const out = 'verify-shots/character-auto-scale';
await mkdir(out, { recursive: true });
const project = JSON.parse(await readFile('verify-shots/tile-size-support/fixture.json', 'utf8'));
project.startMapId = 'geometry48';
const map = project.maps.geometry48;
const page = structuredClone(map.events[0].pages[0]);
page.graphic = { sprite: { type: 'bundled', id: 'tex_easyrpg_charset_monster1' }, pattern: 1 };
page.commands = []; page.id = 'scale'; page.name = '자동 배율';
map.events = [{ id: 'auto-scale', name: '자동 배율 확인', x: 4, y: 4, trigger: { kind: 'action' }, commands: [], pages: [page] }];
const report = { errors: [] };
const browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--use-gl=swiftshader', '--disable-gpu'] });
const tab = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
tab.on('pageerror', error => report.errors.push(error.message));
try {
  await tab.route('**/*', route => {
    const requestUrl = new URL(route.request().url());
    return ['data:', 'blob:'].includes(requestUrl.protocol) || requestUrl.origin === new URL(url).origin ? route.continue() : route.abort();
  });
  await tab.goto(`${url}/?devProject=1&freshProject=1`, { waitUntil: 'domcontentloaded' });
  await tab.waitForFunction(async () => (await import('/src/app/mode.ts')).getGame()?.scene.getScenes(true).some(scene => scene.sys.settings.key === 'EditScene'), null, { timeout: 120000 });
  await tab.evaluate(async project => {
    const { store } = await import('/src/project/store.ts');
    const { editorState } = await import('/src/editor/editorState.ts');
    store.replaceProject(project);
    editorState.set({ currentMapId: 'geometry48', zoom: 1, tool: 'event', layer: 'event', showGrid: true });
  }, project);
  async function open() {
    await tab.evaluate(async () => (await import('/src/editor/panels/eventEditor/modal.ts')).openEventEditorModal('geometry48', 'auto-scale'));
    await tab.getByTestId('evt-rail-group-memory').locator(':scope > button').click();
    await tab.getByTestId('event-page-body-scale').waitFor();
    await tab.getByTestId('event-page-body-scale').scrollIntoViewIfNeeded();
  }
  const scale = tab.getByTestId('event-page-body-scale');
  const manual = tab.getByTestId('event-page-body-scale-manual');
  await open();
  assert.equal(await scale.inputValue(), '2');
  assert.equal(await scale.isDisabled(), true);
  assert.equal(await manual.isChecked(), false);
  await tab.screenshot({ path: `${out}/editor-auto-48.png` });
  await manual.check();
  await scale.fill('1');
  await scale.press('Tab');
  await tab.getByTestId('event-editor-save').click();
  await manual.waitFor({ state: 'detached' });
  report.manual = await tab.evaluate(async () => {
    const { store } = await import('/src/project/store.ts');
    const { serialize, deserialize } = await import('/src/project/io/serialize.ts');
    const reloaded = deserialize(serialize(store.getCurrent()));
    store.replaceProject(reloaded);
    return reloaded.maps.geometry48.events[0].pages[0].graphic;
  });
  assert.equal(report.manual.scale, 1);
  assert.equal(report.manual.scaleMode, 'manual');
  await open();
  assert.equal(await manual.isChecked(), true);
  assert.equal(await scale.inputValue(), '1');
  assert.equal(await scale.isDisabled(), false);
  await manual.uncheck();
  assert.equal(await scale.inputValue(), '2');
  assert.equal(await scale.isDisabled(), true);
  await tab.getByTestId('event-editor-save').click();
  await manual.waitFor({ state: 'detached' });
  report.auto = await tab.evaluate(async () => {
    const { store } = await import('/src/project/store.ts');
    const { serialize, deserialize } = await import('/src/project/io/serialize.ts');
    const reloaded = deserialize(serialize(store.getCurrent()));
    store.replaceProject(reloaded);
    return reloaded.maps.geometry48.events[0].pages[0].graphic;
  });
  assert.equal(report.auto.scale, 1);
  assert.equal(report.auto.scaleMode, 'auto');
  await open();
  assert.equal(await manual.isChecked(), false);
  assert.equal(await scale.inputValue(), '2');
  assert.deepEqual(report.errors, []);
  report.status = 'passed';
  console.log('Editor: automatic 2x, manual 1x save/reload, automatic restoration/reload passed');
} catch (error) {
  report.status = 'failed'; report.failure = error.stack;
  await tab.screenshot({ path: `${out}/editor-failure.png` }).catch(() => {});
  throw error;
} finally {
  await writeFile(`${out}/editor-checks.json`, JSON.stringify(report, null, 2));
  await browser.close();
}
