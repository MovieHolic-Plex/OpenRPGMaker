import assert from 'node:assert/strict';
import { chromium } from '@playwright/test';
import { writeFile } from 'node:fs/promises';
const browser = await chromium.launch({ args: ['--no-sandbox', '--disable-gpu'] });
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('http://127.0.0.1:19852/?blankProject=1', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__oprnEditorStore?.getCurrent()?.startMapId, null, { timeout: 120000 });
  const id = await page.evaluate(async () => {
    const { store } = await import('/src/project/store.ts');
    const { openMapPropertiesDialog } = await import('/src/editor/panels/mapPropertiesDialog.ts');
    if (store.isRemotePersistenceEnabled()) throw new Error('QA must remain local');
    const map = store.getCurrent().maps[store.getCurrent().startMapId];
    openMapPropertiesDialog(map.id, map.name);
    return map.id;
  });
  await page.getByTestId('map-props-tab-atmosphere').last().click();
  for (const kind of ['leaves', 'magic', 'underwater']) await page.getByTestId(`atmosphere-${kind}`).last().check();
  const slider = page.getByTestId('atmosphere-underwater-speed').last();
  await slider.fill('150');
  await slider.dispatchEvent('change');
  const checks = await page.evaluate(async id => {
    const { store } = await import('/src/project/store.ts');
    const { serialize, deserialize } = await import('/src/project/io/serialize.ts');
    const { normalizeAtmosphereEffects, ATMOSPHERE_PRESETS } = await import('/src/project/atmosphere.ts');
    const reloaded = deserialize(serialize(store.getCurrent()));
    const selected = reloaded.maps[id].atmosphereEffects;
    reloaded.maps[id].atmosphereEffects = normalizeAtmosphereEffects(ATMOSPHERE_PRESETS.map(p => ({ kind: p.id })));
    const all = deserialize(serialize(reloaded)).maps[id].atmosphereEffects;
    const malformed = normalizeAtmosphereEffects([{ kind: 'bad' }, { kind: 'underwater', amount: -2, speed: Infinity }, { kind: 'underwater' }]);
    delete reloaded.maps[id].atmosphereEffects;
    const legacy = normalizeAtmosphereEffects(deserialize(serialize(reloaded)).maps[id].atmosphereEffects);
    return { selected, all, malformed, legacy };
  }, id);
  assert.equal(checks.selected.length, 3);
  assert.equal(checks.selected.find(e => e.kind === 'underwater').speed, 1.5);
  assert.equal(checks.all.length, 19);
  assert.equal(checks.malformed.length, 1);
  assert.equal(checks.malformed[0].amount, 0);
  assert.deepEqual(checks.legacy, []);
  await page.getByTestId('atmosphere-underwater').last().scrollIntoViewIfNeeded();
  await page.screenshot({ path: '.omo/evidence/atmosphere/editor.png' });
  await page.getByTestId('atmosphere-underwater').last().uncheck();
  const removed = await page.evaluate(async id => {
    const { store } = await import('/src/project/store.ts');
    return store.getCurrent().maps[id].atmosphereEffects.map(e => e.kind);
  }, id);
  assert.deepEqual(removed, ['leaves', 'magic']);
  const presets = await page.evaluate(async () => (await import('/src/project/atmosphere.ts')).ATMOSPHERE_SCENES.map(p => p.id));
  assert.equal(presets.length, 30);
  const sceneChecks = [];
  for (const preset of presets) {
    await page.getByTestId('atmosphere-scene-preset').last().selectOption(preset);
    await page.getByTestId('atmosphere-scene-apply').last().click();
    const actual = await page.evaluate(async ({ id, preset }) => {
      const { store } = await import('/src/project/store.ts');
      const { serialize, deserialize } = await import('/src/project/io/serialize.ts');
      const { ATMOSPHERE_SCENES, normalizeAtmosphereEffects } = await import('/src/project/atmosphere.ts');
      return { expected: normalizeAtmosphereEffects(ATMOSPHERE_SCENES.find(p => p.id === preset).effects),
        reloaded: deserialize(serialize(store.getCurrent())).maps[id].atmosphereEffects };
    }, { id, preset });
    assert.deepEqual(actual.reloaded, actual.expected);
    sceneChecks.push({ preset, effects: actual.reloaded });
  }
  await page.getByTestId('atmosphere-scene-preset').last().selectOption('boiler-room');
  await page.getByTestId('atmosphere-scene-apply').last().click();
  await page.getByTestId('atmosphere-steam-sound').last().selectOption('none');
  await page.getByTestId('atmosphere-leaks-volume').last().fill('15');
  await page.getByTestId('atmosphere-leaks-volume').last().dispatchEvent('change');
  const custom = await page.evaluate(async id => {
    const { store } = await import('/src/project/store.ts');
    const { serialize, deserialize } = await import('/src/project/io/serialize.ts');
    return deserialize(serialize(store.getCurrent())).maps[id].atmosphereEffects;
  }, id);
  assert.equal(custom.find(e => e.kind === 'steam').sound, 'none');
  assert.equal(custom.find(e => e.kind === 'leaks').volume, 0.15);
  await page.getByTestId('atmosphere-scene-preset').last().selectOption('enchanted-forest');
  await page.getByTestId('atmosphere-scene-apply').last().click();
  await page.getByTestId('atmosphere-scene-preset').last().scrollIntoViewIfNeeded();
  await page.screenshot({ path: '.omo/evidence/atmosphere/presets-editor.png' });
  await writeFile('.omo/evidence/atmosphere/presets-editor.json', JSON.stringify({ sceneChecks, custom }, null, 2));
  assert.deepEqual(errors, []);
  await writeFile('.omo/evidence/atmosphere/editor.json', JSON.stringify({ checks, removed, errors }, null, 2));
  console.log('Editor controls, 19 effect kinds and 30 audiovisual preset save/reload passed');
} finally { await browser.close(); }
