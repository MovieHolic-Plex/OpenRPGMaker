// Read-only editor preview QA. Uses an unsaved blank fixture, never a host project.
import { chromium } from 'playwright';
import fs from 'node:fs';
import assert from 'node:assert/strict';
const base = process.argv[2] ?? 'http://127.0.0.1:9847';
const out = 'output/evidence/place-previews';
fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ args: ['--no-sandbox'] });
try {
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(() => {
    localStorage.setItem('oprn:editor-ui-mode', 'expert');
    localStorage.setItem('oprn:ai-panel-collapsed', '1');
    for (const key of ['oprn:editor-welcome-dismissed', 'oprn:standard-welcome-seen', 'oprn:coachmarks-basic-v1']) localStorage.setItem(key, '1');
  });
  await page.goto(`${base}/?blankProject=1&aiBridge=0`);
  await page.getByTestId('toolbar-database').click({ timeout: 120000 });
  // Select the real tab through its navigation handler (the compatibility button is hidden).
  await page.getByTestId('db-tab-spatial-places').evaluate(button => button.click());
  const ids = await page.locator('[data-thumb-card]').evaluateAll(nodes => nodes.map(node => node.dataset.thumbCard));
  for (const id of ids) {
    const target = page.locator(`[data-thumb-card=${JSON.stringify(id)}]`);
    await target.scrollIntoViewIfNeeded();
    await target.locator('img').waitFor();
    await page.waitForFunction(id => {
      const img = document.querySelector(`[data-thumb-card="${id}"] img`);
      return img?.complete && img.naturalWidth > 0 && img.getBoundingClientRect().height > 0;
    }, id);
  }
  await page.screenshot({ path: `${out}/all-places-scrolled.png` });
  const proof = await page.evaluate(async () => {
    const { store } = await import('/src/project/store.ts');
    const { deferredSpatialCardThumb, flushSpatialCardThumbs, resetSpatialCardThumbs } = await import('/src/editor/panels/spatialCardThumbs.ts');
    const { renderPlaceCardThumb, placeCatalogRasters } = await import('/src/editor/panels/spatialPlacePreview.ts');
    const { renderTileCellsToCanvas } = await import('/src/editor/harnessSuggestion/kitRender.ts');
    const { houseKitTileset } = await import('/src/editor/panels/villageHousePreview.ts');
    const card = { id: 'qa-house', localId: 'qa-house', name: '외형 미리보기', kind: 'places', source: 'own', usage: 0, compatibility: 'house-shape' };
    store.update(project => { project.villageTemplates = [{ id: card.id, name: card.name, w: 7, h: 7, wings: [{ x: 0, y: 0, w: 7, h: 7 }] }]; });
    const project = store.getCurrent();
    resetSpatialCardThumbs();
    let builds = 0;
    const build = () => { builds += 1; return renderPlaceCardThumb(card); };
    const first = deferredSpatialCardThumb(card, build);
    document.body.append(first);
    flushSpatialCardThumbs();
    const second = deferredSpatialCardThumb(card, build);
    document.body.append(second);
    flushSpatialCardThumbs();
    const stage = placeCatalogRasters(project, card, 1);
    const waitFor = async predicate => { const deadline = Date.now() + 15000; while (!predicate()) { if (Date.now() > deadline) throw new Error('Preview did not finish'); await new Promise(resolve => setTimeout(resolve, 25)); } };
    await waitFor(() => [first, second].every(slot => slot.querySelector('canvas[data-preview-state="ready"]')) && stage.stamps[0]?.canvas.dataset.previewState === 'ready');
    const retained = first.firstElementChild !== null && second.firstElementChild !== null && first.firstElementChild !== second.firstElementChild;
    const art = second.firstElementChild;
    const replacement = deferredSpatialCardThumb(card, build);
    second.replaceWith(replacement);
    flushSpatialCardThumbs();
    const reusedAfterReplacement = replacement.firstElementChild === art && builds === 2;
    // Two consumers subscribe while the catalog's dynamic import is still pending.
    const notified = [];
    for (const id of ['place_river_forest_village', 'place_tibo_complete_inn']) {
      placeCatalogRasters(project, { ...card, reviewedPlaceId: id }, 1, () => notified.push(id));
    }
    await waitFor(() => notified.length === 2);
    // A transient atlas failure must not poison later previews at the same URL.
    const NativeImage = window.Image;
    const images = [];
    window.Image = class extends NativeImage { constructor() { super(); images.push(this); } set src(value) { this.dataset.requestedSrc = value; } };
    let retry;
    try {
      // A fresh URL avoids the successful house preview's existing image cache.
      const tileset = { ...houseKitTileset(project), image: { type: 'bundled', id: 'tex_easyrpg_chipset_combined_dungeon' } };
      const input = { tileset, widthTiles: 1, heightTiles: 1, cells: [], backgroundTile: null };
      const broken = renderTileCellsToCanvas(input);
      images.at(-1).dispatchEvent(new Event('error'));
      const next = renderTileCellsToCanvas(input);
      retry = images.length === 2 && broken.dataset.previewState === 'error' && next.dataset.previewState === 'pending';
    } finally { window.Image = NativeImage; }
    const databases = await indexedDB.databases();
    let aiConversationCount = null;
    if (databases.some(db => db.name === 'oprn-ai-records')) {
      aiConversationCount = await new Promise((resolve, reject) => {
        const request = indexedDB.open('oprn-ai-records');
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
          const db = request.result;
          const name = [...db.objectStoreNames].find(name => /conversation/i.test(name));
          if (!name) { db.close(); resolve(0); return; }
          const transaction = db.transaction(name, 'readonly');
          const count = transaction.objectStore(name).count();
          count.onsuccess = () => { resolve(count.result); db.close(); };
          count.onerror = () => reject(count.error);
        };
      });
    }
    first.remove(); replacement.remove();
    return { retained, reusedAfterReplacement, aiConversationCount, houseStageStamps: stage.stamps.length, notified, retry, aiRecordsDatabasePresent: databases.some(db => db.name === 'oprn-ai-records') };
  });
  assert.equal(proof.retained, true);
  assert.equal(proof.houseStageStamps, 1);
  assert.equal(proof.reusedAfterReplacement, true);
  assert.equal(proof.retry, true);
  assert.equal(proof.notified.length, 2);
  assert.deepEqual(errors, []);
  const result = { sharedPlaceImages: ids.length, ...proof, errors };
  fs.writeFileSync(`${out}/proof.json`, JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result));
} finally { await browser.close(); }
