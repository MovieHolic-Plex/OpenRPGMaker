import assert from 'node:assert/strict';
import { chromium } from '@playwright/test';
import { writeFile } from 'node:fs/promises';
const browser = await chromium.launch({ args: ['--no-sandbox', '--disable-gpu'] });
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  await page.goto('http://127.0.0.1:19852/?blankProject=1', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__oprnEditorStore?.getCurrent()?.startMapId, null, { timeout: 120000 });
  const result = await page.evaluate(async () => {
    const { store } = await import('/src/project/store.ts');
    const { openMapPropertiesDialog } = await import('/src/editor/panels/mapPropertiesDialog.ts');
    if (store.isRemotePersistenceEnabled()) throw new Error('QA must remain local');
    const map = store.getCurrent().maps[store.getCurrent().startMapId];
    openMapPropertiesDialog(map.id, map.name);
    return map.id;
  });
  await page.getByTestId('map-props-tab-clouds').last().click();
  await page.getByTestId('map-cloud-shadows-enable').last().check();
  const number = page.getByTestId('map-cloud-shadows-amount-number').last();
  const checks = [];
  for (const amount of [0, 1, 6]) {
    await number.fill(String(amount));
    await number.press('Tab');
    const actual = await page.evaluate(async (id) => {
      const { store } = await import('/src/project/store.ts');
      const { serialize, deserialize } = await import('/src/project/io/serialize.ts');
      const saved = serialize(store.getCurrent());
      return { live: store.getCurrent().maps[id].cloudShadows, reloaded: deserialize(saved).maps[id].cloudShadows };
    }, result);
    assert.equal(actual.live.amount, amount);
    assert.equal(actual.reloaded.amount, amount);
    checks.push(actual);
  }
  const legacy = await page.evaluate(async (id) => {
    const { store } = await import('/src/project/store.ts');
    const { serialize, deserialize } = await import('/src/project/io/serialize.ts');
    const { normalizeCloudShadowParams } = await import('/src/player/cloudShadows.ts');
    const project = deserialize(serialize(store.getCurrent()));
    delete project.maps[id].cloudShadows.amount;
    return normalizeCloudShadowParams(deserialize(serialize(project)).maps[id].cloudShadows).amount;
  }, result);
  assert.equal(legacy, 3);
  await page.getByTestId('map-props-section-clouds').last().screenshot({ path: '.omo/evidence/weather-quality/cloud-amount-editor.png' });
  await writeFile('.omo/evidence/weather-quality/cloud-amount-editor.json', JSON.stringify({ checks, legacyDefault: legacy }, null, 2));
  console.log('Editor amount controls 0/1/6 and serialize/deserialize passed; legacy default 3');
} finally { await browser.close(); }
