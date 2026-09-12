import assert from "node:assert/strict";
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';

// Local editor regression fixture; blankProject disables remote persistence.
const base = process.argv[2] ?? 'http://127.0.0.1:9999';
await mkdir('output/evidence/spatial-edit-repair', { recursive: true });
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
page.on('pageerror', e => console.log('PAGEERROR', e.message));
try {
await page.addInitScript(() => { localStorage.setItem('oprn:editor-welcome-dismissed','1'); localStorage.setItem('rpg-zzu:editor-ui-mode','expert'); });
await page.goto(`${base}/?blankProject=1&aiBridge=0`, { timeout: 120000, waitUntil: 'domcontentloaded' });
await page.getByTestId('toolbar-database').waitFor({ timeout: 120000 });
await page.getByTestId('toolbar-database').click();
const group = page.getByTestId('db-tab-group-world');
if (await group.getAttribute('aria-expanded') === 'false') await group.click();
await page.getByTestId('db-tab-spatial-objects').click();
await page.screenshot({ path: "output/evidence/spatial-edit-repair/before.png" });
await page.getByTestId('spatial-object-copy').click();
await page.getByTestId('structure-kit-editor').waitFor();
console.log('legacy object copy opens painter');
await page.screenshot({ path: 'output/evidence/spatial-edit-repair/object-painter.png' });
await page.keyboard.press('Escape');
await page.getByTestId('spatial-object-name').fill('수정한 오브젝트');
await page.getByTestId('spatial-object-name').press('Tab');
assert.equal( await page.evaluate(async () => { const {store}=await import('/src/project/store.ts'); return Object.values(store.getCurrent().tilesets).some(ts=>ts.structureKits?.some(k=>k.name==='수정한 오브젝트')); }), true);
await page.getByTestId('db-tab-spatial-spaces').click();
await page.getByTestId('spatial-space-copy').click();
const name=page.locator('[data-testid^="tileset-spaces-kind-label-"]');
await name.fill('수정한 공간'); await name.press('Tab');
assert.equal( await page.evaluate(async () => { const {store}=await import('/src/project/store.ts'); return Object.values(store.getCurrent().tilesets).some(ts=>ts.interiorRoomKinds?.some(k=>k.label==='수정한 공간')); }), true);
await page.screenshot({ path: 'output/evidence/spatial-edit-repair/space-edit.png' });
// Canonical fixture: explicit local conversion, never remote activation.
await page.evaluate(async () => {
  const { store } = await import('/src/project/store.ts');
  const { serialize } = await import('/src/project/io.ts');
  const { convertLegacySpatialSnapshot } = await import('/src/project/spatial/legacyImport.ts');
  const { clearAuthoringSession } = await import('/src/editor/panels/spatialAuthoringAccess.ts');
  const { setSpatialTab, selectSpatialDesign, patchSpatialSession } = await import('/src/editor/panels/spatialAuthoringSession.ts');
  const { libraryObjectCardId } = await import('/src/editor/panels/spatialObjectDraft.ts');
  clearAuthoringSession();
  store.replace(convertLegacySpatialSnapshot(serialize(store.getCurrent())).preview, { preserveEventDrafts: false });
  const { resolveSpatialGraphic } = await import('/src/project/spatial/assets.ts');
  const object = Object.values(store.getCurrent().spatialAuthoring.library.objects).find(o => resolveSpatialGraphic(store.getCurrent(), o.graphic)?.source === 'builtin');
  if (!object) throw new Error('Missing builtin-backed object fixture');
  setSpatialTab("objects");
  selectSpatialDesign(libraryObjectCardId(object.id)); patchSpatialSession({ source: 'own' });
});
await page.getByTestId('db-tab-spatial-objects').click();
await page.getByTestId('spatial-object-paint').click();
await page.getByTestId('structure-kit-editor').waitFor();
console.log('canonical builtin-backed object opens painter');
await page.keyboard.press('Escape');
await page.getByTestId('spatial-preview').click();
await page.getByTestId('spatial-apply').click();
assert.equal((await page.getByTestId('spatial-preview-error').textContent()).trim(), '');
await page.getByTestId('db-tab-spatial-spaces').click();
await page.getByTestId('spatial-add').click();
await page.getByTestId('spatial-space-name').fill('새 공간 수정');
await page.getByTestId('spatial-space-name').press('Tab');
await page.getByTestId('spatial-space-width').fill('12');
await page.getByTestId('spatial-space-width').press('Tab');
await page.getByTestId('spatial-preview').click();
await page.getByTestId('spatial-apply').click();
assert.equal( await page.evaluate(async () => { const {store}=await import('/src/project/store.ts'); return Object.values(store.getCurrent().spatialAuthoring.library.spaces).some(s=>s.name==='새 공간 수정' && s.width===12); }), true);
await page.screenshot({ path: 'output/evidence/spatial-edit-repair/canonical-space.png' });
await page.setViewportSize({ width: 1024, height: 768 });
await page.screenshot({ path: 'output/evidence/spatial-edit-repair/canonical-space-1024.png' });
console.log('PASS: legacy object/room edits and canonical object/space preview/apply');
} catch (error) {
  await page.screenshot({ path: "output/evidence/spatial-edit-repair/failure.png" }).catch(() => {});
  throw error;
} finally { await browser.close(); }
