// Browser evidence for the published default region; never writes the active project.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
const out = 'output/evidence/shared-river-forest-village';
const expected = JSON.parse(fs.readFileSync('public/assets/region-references/river-forest-village.oprn.json'));
const id = 'river-forest-village-78x44';
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1600, height: 1050 }, acceptDownloads: true });
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.route('**/rest/v1/**', route => route.fulfill({ json: [] }));
  await page.addInitScript(() => {
    localStorage.setItem('oprn:editor-ui-mode', 'expert');
    localStorage.setItem('oprn:ai-panel-collapsed', '1');
    for (const k of ['oprn:editor-welcome-dismissed', 'oprn:standard-welcome-seen', 'oprn:coachmarks-basic-v1']) localStorage.setItem(k, '1');
  });
  await page.goto(`${process.env.BASE ?? 'http://127.0.0.1:9816'}/?devProject=1&marketTown=1`, { waitUntil: 'domcontentloaded', timeout: 120000 });
  const guest = page.getByTestId('login-guest');
  await page.getByTestId('ai-input').or(guest).first().waitFor({ timeout: 120000 });
  if (await guest.isVisible()) await guest.click();
  await page.getByTestId('ai-input').waitFor({ timeout: 120000 });
  const proof = await page.evaluate(async ({ project, id }) => {
    const { REGION_REFERENCES } = await import('/src/project/regionReferences.ts');
    const { preloadAllRegionReferences, readRegionReference } = await import('/src/project/regionReferenceSnapshots.ts'); await preloadAllRegionReferences();
    const { awaitGraftedTilesetImageUrl } = await import('/src/assets/tileGraftImageCache.ts');
    const { tilesetBaseImageUrl } = await import('/src/editor/tilesetImage.ts');
    const { store } = await import('/src/project/store.ts');
    const before = JSON.stringify(store.getCurrent());
    let row = 0; const lower = [], upper = [];
    while (row !== null) {
      const result = readRegionReference(id, row, 16);
      lower.push(...result.map.lowerTiles); upper.push(...result.map.upperTiles); row = result.map.nextRow;
    }
    const ts = project.tilesets.forest_harmony;
    const url = await awaitGraftedTilesetImageUrl(ts, tilesetBaseImageUrl(ts));
    const atlas = new Image(); atlas.src = url; await atlas.decode();
    const canvas = document.createElement('canvas'); canvas.width = atlas.width; canvas.height = atlas.height;
    canvas.getContext('2d').drawImage(atlas, 0, 0);
    return { lower, upper, atlas: canvas.toDataURL('image/png'), activeProjectUnchanged: before === JSON.stringify(store.getCurrent()),
      sharedRegion: REGION_REFERENCES.some(r => r.id === id) };
  }, { project: expected, id });
  assert.deepEqual(proof.lower, expected.maps.restored_river.lowerTiles);
  assert.deepEqual(proof.upper, expected.maps.restored_river.upperTiles);
  assert(proof.sharedRegion && proof.activeProjectUnchanged);
  fs.writeFileSync('public/assets/region-references/river-forest-village-atlas.png', Buffer.from(proof.atlas.split(',')[1], 'base64'));
  await page.getByTestId('toolbar-database').click();
  await page.getByTestId('database-modal').waitFor();
  const world = page.getByTestId('db-tab-group-world');
  if (await world.getAttribute('aria-expanded') === 'false') await world.click();
  await page.getByTestId('db-tab-spatial-regions').click();
  await page.getByTestId('spatial-source-defaults').click();
  await page.getByTestId(`spatial-card-region-reference:${id}`).click();
  const dimensions = await page.getByTestId('region-reference-preview').locator('img').evaluate(async img => {
    await img.decode(); return { width: img.naturalWidth, height: img.naturalHeight };
  });
  assert.deepEqual(dimensions, { width: 1248, height: 704 });
  const link = page.getByTestId('region-reference-download');
  if (!await link.isVisible()) await page.getByTestId('spatial-inspector-toggle').click();
  assert.match(await link.innerText(), /지역 맵 파일/);
  const downloading = page.waitForEvent('download'); await link.click(); const download = await downloading;
  assert.equal(download.suggestedFilename(), '강변 숲마을.oprn.json');
  assert.deepEqual(JSON.parse(fs.readFileSync(await download.path())), expected);
  await page.screenshot({ path: `${out}/shared-region.png` });
  assert.deepEqual(errors, []);
  const result = { referenceId: id, sharedRegion: true, aiRowsExact: true, preview: dimensions,
    downloadExact: true, downloadFilename: download.suggestedFilename(), connectedMaps: Object.keys(expected.maps).length,
    activeProjectUnchanged: proof.activeProjectUnchanged, errors };
  fs.writeFileSync(`${out}/browser-proof.json`, JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result));
} finally { await browser.close(); }
