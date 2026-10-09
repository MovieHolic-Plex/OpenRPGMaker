import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
await mkdir('output/evidence/spatial-mixed', { recursive: true });
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
page.on('pageerror', e => console.log('PAGEERROR',e.message));
try {
await page.addInitScript(() => { localStorage.setItem('oprn:editor-welcome-dismissed','1'); localStorage.setItem('oprn:editor-ui-mode','expert'); });
await page.goto(`${process.argv[2] ?? 'http://127.0.0.1:9999'}/?blankProject=1&aiBridge=0`, { timeout: 120000, waitUntil: 'domcontentloaded' });
await page.getByTestId('toolbar-database').waitFor({ timeout: 120000 });
await page.getByTestId('toolbar-database').click();
const group = page.getByTestId('db-tab-group-world');
if (await group.getAttribute('aria-expanded') === 'false') await group.click();
await page.evaluate(async () => {
 const {store}=await import('/src/project/store.ts');
 const {mixedFixture}=await import('/test/support/spatialMixedFixture.ts');
 const {clearAuthoringSession}=await import('/src/editor/panels/spatialAuthoringAccess.ts');
 const {setSpatialTab,selectSpatialDesign}=await import('/src/editor/panels/spatialAuthoringSession.ts');
 const {librarySpaceCardId}=await import('/src/editor/panels/spatialSpaceDraft.ts');
 clearAuthoringSession(); store.replace(mixedFixture(),{preserveEventDrafts:false});
 setSpatialTab('spaces'); selectSpatialDesign(librarySpaceCardId('room-design'));
});
await page.getByTestId('db-tab-spatial-spaces').click();
await page.getByTestId('composition-board').waitFor();
await page.screenshot({path:'output/evidence/spatial-mixed/space.png'});
await page.getByTestId('composition-tile-browser').click();
await page.getByTestId('tile-browser-search').fill('240');
await page.getByTestId('tile-browser-tile-240').click();
await page.getByTestId('tile-browser-use').click();
const board=page.getByTestId('composition-board');
await board.click({position:{x:4*24+5,y:5*24+5}});
await page.getByTestId('spatial-preview').click(); await page.getByTestId('spatial-apply').click();
assert.ok(await page.evaluate(async()=>{const {store}=await import('/src/project/store.ts'); return store.getCurrent().spatialAuthoring.library.spaces['room-design'].composition.tiles.some(c=>c.x===4&&c.y===5);}));
await page.getByTestId('composition-tool-select').click();
await page.locator('.spatial-mixed-member').first().click();
await page.getByTestId('composition-open').click();
await page.getByTestId('spatial-shell-objects').waitFor();
await page.getByTestId('spatial-back').click();
await page.getByTestId('composition-board').waitFor();
for(const tab of ['places','regions','worlds']){
 await page.evaluate(async tab => {
  const {setSpatialTab,selectSpatialDesign,spatialSession}=await import('/src/editor/panels/spatialAuthoringSession.ts');
  const {listSpatialGalleryCards}=await import('/src/editor/panels/spatialCatalog.ts');
  setSpatialTab(tab); const id={places:'inn',regions:'town',worlds:'world'}[tab];
  const card=listSpatialGalleryCards({...spatialSession(),source:'all'}).find(card=>card.canonicalSource?.id===id);
  if(!card)throw new Error('missing canonical '+id); selectSpatialDesign(card.id);
 },tab);
 await page.getByTestId(`db-tab-spatial-${tab}`).click();
 const pick=page.locator('.spatial-mixed-workspace > header > select');
 if(!await page.getByTestId('composition-board').count()) {
  const name={places:'여관',regions:'마을',worlds:'세계'}[tab];
  await page.locator('[data-card-id]').filter({hasText:name}).first().click();
 }
 await page.getByTestId('composition-material-object').click();
 await page.screenshot({path:`output/evidence/spatial-mixed/${tab}.png`});
}
await page.setViewportSize({width:1024,height:768});
await page.getByTestId('composition-fit').click();
await page.screenshot({path:'output/evidence/spatial-mixed/worlds-1024.png'});
const compiled = await page.evaluate(async () => {
 const {mixedFixture} = await import('/test/support/spatialMixedFixture.ts');
 const {instantiateSpatialDesign} = await import('/src/project/spatial/instances.ts');
 const {compileSpatialOccurrence} = await import('/src/editor/spatial/compileSpatialOccurrence.ts');
 const project = mixedFixture();
 project.spatialAuthoring = instantiateSpatialDesign(project.spatialAuthoring, project, {source:{kind:'world',id:'world'},rootId:'mixed-world',x:0,y:0,level:0,seed:7,generatorVersion:'mixed-v1'});
 const next = compileSpatialOccurrence(project,{occurrenceId:'mixed-world'});
 next.startMapId = 'spatial:mixed-world'; next.startPos = {x:0,y:0};
 return JSON.stringify(next);
});
await writeFile('output/evidence/spatial-mixed/compiled.json',compiled);
console.log('PASS: mixed composition UI in all four containers and tile save');
} catch(e) { await page.screenshot({path:'output/evidence/spatial-mixed/failure.png'}).catch(()=>{}); throw e; }
finally { await browser.close(); }
