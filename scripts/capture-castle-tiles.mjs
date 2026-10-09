// Manual editor capture. Uses an isolated temporary project; no remote content is authored.
// Usage: node scripts/capture-castle-tiles.mjs http://127.0.0.1:9987 .omo/evidence/castle-tiles
import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
const base = process.argv[2] ?? 'http://127.0.0.1:9987';
const out = process.argv[3] ?? '.omo/evidence/castle-tiles';
await mkdir(out, { recursive: true });
const browser = await chromium.launch({headless:true});
const page = await browser.newPage({ viewport:{width:1440,height:1000} });
const errors=[]; page.on('pageerror',e=>{errors.push(e.message);console.log('PAGEERROR',e.message)});

await page.addInitScript(()=>{
 localStorage.setItem('oprn:editor-ui-mode','expert');
 localStorage.setItem('oprn:editor-welcome-dismissed','1');
 localStorage.setItem('oprn:standard-welcome-seen','1');
 localStorage.setItem('oprn:database.selectedTilesetId','opengameart_castle');
});
try {
 await page.goto(`${base}/?blankProject=1&aiBridge=0`,{waitUntil:'domcontentloaded',timeout:60000});
 try { await page.getByTestId('toolbar-database').waitFor({timeout:30000}); }
 catch { await page.reload({waitUntil:'domcontentloaded'}); await page.getByTestId('toolbar-database').waitFor({timeout:60000}); }
 for(const id of ['standard-welcome-start','coach-mark-skip','ai-collapse']){const b=page.getByTestId(id);if(await b.isVisible())await b.click();}
 console.log('BOOT', errors);
 const data = await page.evaluate(async()=>{
  const {store}=await import('/src/project/store.ts');
  const p=store.getCurrent();const t=p.tilesets.opengameart_castle;
  const {ensureBundledTilesets,ensureBundledResourceProfiles}=await import('/src/project/defaults/defaultAssets.ts');
  const old=structuredClone(p);delete old.tilesets.opengameart_castle;old.resourceProfiles=old.resourceProfiles.filter(r=>r.assetId!=='tex_opengameart_castle');
  const before=JSON.stringify(old.maps);ensureBundledTilesets(old);ensureBundledResourceProfiles(old);
  const restored=old.tilesets.opengameart_castle;const restoredDefinition=JSON.stringify(restored);ensureBundledTilesets(old);
  restored.passability[770]={up:false,down:false,left:false,right:false};restored.priority[770]='upper';ensureBundledTilesets(old);
  const {collectWebExportAssets}=await import('/src/project/webExportAssets.ts');
  return {geometry:[t.tileSize,t.tilesPerRow,t.count],mapUnchanged:before===JSON.stringify(old.maps),restored:!!restored,stableDefinition:restoredDefinition===JSON.stringify(p.tilesets.opengameart_castle),preservesEdits:!restored.passability[770].up&&restored.priority[770]==='upper',profile:old.resourceProfiles.find(r=>r.assetId==='tex_opengameart_castle'),exportPaths:collectWebExportAssets(p).filter(a=>a.zipPath.includes('castle')).map(a=>a.zipPath),mapIds:Object.keys(p.maps)};
 });console.log('CATALOG',JSON.stringify(data));
 await page.getByTestId('toolbar-database').click();
 const world=page.getByTestId('db-tab-group-world');await world.scrollIntoViewIfNeeded();if(await world.getAttribute('aria-expanded')!=='true')await world.click();
 await page.getByTestId('db-tab-spatial-tiles').click();
 await page.getByTestId('tileset-db-preview').waitFor({timeout:30000});
 await page.getByRole('button',{name:/^성채 · OpenGameArt/}).click();
 await page.getByTestId('tileset-preview-scale-1').click();
 await page.waitForTimeout(1000);
 await page.screenshot({path:`${out}/catalog.png`});

 
 await page.keyboard.press('Escape');
 await page.evaluate(async()=>{
  const {store}=await import('/src/project/store.ts');
  const {openMapPropertiesDialog}=await import('/src/editor/panels/mapPropertiesDialog.ts');
  const m=Object.values(store.getCurrent().maps)[0];openMapPropertiesDialog(m.id,m.name,{focus:'tileset'});
 });
 console.log('CHOICE',await page.getByTestId('map-props-tileset-select').locator('option[value="opengameart_castle"]').textContent());
 await page.getByTestId('map-props-tileset-select').selectOption('opengameart_castle',{force:true});
 await page.keyboard.press('Escape');
 await page.locator('.custom-palette.source-layout').waitFor({timeout:20000});
 await page.waitForTimeout(1200);
 const palette=page.locator('.custom-palette.source-layout');
 const from=palette.locator('[data-tile-index="2"]'), to=palette.locator('[data-tile-index="35"]');
 const a=await from.boundingBox(), b=await to.boundingBox();
 await page.mouse.move(a.x+a.width/2,a.y+a.height/2);await page.mouse.down();await page.mouse.move(b.x+b.width/2,b.y+b.height/2,{steps:4});await page.mouse.up();
 const geometry=await page.evaluate(async()=>{
  const {editorState}=await import('/src/editor/editorState.ts');
  const {getGame}=await import('/src/app/mode.ts');
  const game=getGame();
  const t=game.textures.get('tex_opengameart_castle');
  const {store}=await import('/src/project/store.ts');
  const {ensureTilesetTexture}=await import('/src/editor/tilesetImage.ts');
  const clone=structuredClone(store.getCurrent().tilesets.opengameart_castle);
  clone.transparentColor='#ff00ff';
  clone.tileGrafts=[{targetTile:1023,sourceChipset:'tex_opengameart_castle',sourceTile:770}];
  const bakedKey=ensureTilesetTexture(game.scene.getScenes(true)[0],clone);
  const baked=game.textures.get(bakedKey);const bf=baked.get('tile_1023');
  const canvas=baked.getSourceImage();const pixel=Array.from(canvas.getContext('2d').getImageData(496,496,1,1).data);
  const sourceCanvas=document.createElement('canvas');sourceCanvas.width=512;sourceCanvas.height=512;
  sourceCanvas.getContext('2d').drawImage(t.getSourceImage(),0,0);
  const sourcePixel=Array.from(sourceCanvas.getContext('2d').getImageData(32,384,1,1).data);
  const bakedFrame={key:bakedKey,x:bf.cutX,y:bf.cutY,w:bf.width,h:bf.height,graftPixelMatches:JSON.stringify(pixel)===JSON.stringify(sourcePixel)};
  return {bakedFrame,stamp:editorState.get().activePaletteStamp,frames:[31,32,770,1023].map(i=>{const f=t.get('tile_'+i);return {i,x:f.cutX,y:f.cutY,w:f.width,h:f.height}}),displayColumns:document.querySelector('.source-layout')?.dataset.displayColumns,columns:getComputedStyle(document.querySelector('.source-layout .chipset-grid')).gridTemplateColumns};
 });console.log('GEOMETRY',JSON.stringify(geometry));
 await page.screenshot({path:`${out}/palette.png`});
 await writeFile(`${out}/inspection.json`,JSON.stringify({data,geometry,errors},null,2));
 
} catch(e){process.exitCode=1;console.error(e);console.log(errors);await page.screenshot({path:`${out}/error.png`});} finally {await browser.close();}
