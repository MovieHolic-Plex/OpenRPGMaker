import fs from 'node:fs';
import assert from 'node:assert/strict';
import {isDeepStrictEqual as same} from 'node:util';
import {execFileSync} from 'node:child_process';
import {chromium} from 'playwright';
const out='output/evidence/forest-places-publish',origin=process.env.FOREST_PLACE_ORIGIN??'http://127.0.0.1:9825';
const entries=JSON.parse(fs.readFileSync(`${out}/entries.json`));
const read=()=>JSON.parse(execFileSync('python3',['-c',"import sqlite3;from pathlib import Path;c=sqlite3.connect(Path('.oprn-projects/oprn-hill-forest-harmony-20260918-a4e1/project.sqlite').resolve().as_uri()+'?mode=ro',uri=True);print(c.execute('select current_json from project').fetchone()[0])"],{maxBuffer:100e6}));
const before=read(),browser=await chromium.launch({executablePath:'/opt/google/chrome/chrome',args:['--no-sandbox','--no-proxy-server']});
const results=[],errors=[];
try{
 const context=await browser.newContext({viewport:{width:1740,height:1500}});
 await context.addInitScript(()=>{localStorage.setItem('oprn:editor-ui-mode','expert');localStorage.setItem('oprn:ai-panel-collapsed','1');for(const k of ['oprn:editor-welcome-dismissed','oprn:standard-welcome-seen','oprn:coachmarks-basic-v1'])localStorage.setItem(k,'1');});
 const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
 await page.goto(`${origin}/?map=map_cliff_forest_bridge`,{waitUntil:'domcontentloaded'});await page.getByTestId('edit-canvas').waitFor({timeout:120000});
 await page.getByTestId('toolbar-database').click();await page.getByTestId('database-modal').waitFor();
 const world=page.getByTestId('db-tab-group-world');if(await world.getAttribute('aria-expanded')==='false')await world.click();
 await page.getByTestId('db-tab-spatial-places').click();await page.waitForFunction(()=>document.querySelector('[data-testid="composition-design"]')||document.querySelector('[data-testid="spatial-source-defaults"]'));
 if(await page.getByTestId('composition-design').count())await page.getByTestId('composition-design').selectOption(`region-reference:${entries[0].id}`);
 await page.getByTestId('spatial-source-defaults').click();
 for(const entry of entries){
  const card=page.getByTestId(`spatial-card-region-reference:${entry.id}`);await card.click();
  const size=await page.getByTestId('region-reference-preview').locator('img').evaluate(async img=>{await img.decode();return{width:img.naturalWidth,height:img.naturalHeight};});assert.deepEqual(size,{width:entry.width*16,height:entry.height*16});
  const download=page.getByTestId('region-reference-download');if(!await download.isVisible())await page.getByTestId('spatial-inspector-toggle').click();
  assert.match(await download.innerText(),/장소 맵 파일/);
  const received=page.waitForEvent('download');await download.click();const asset=await received;assert.equal(asset.suggestedFilename(),`${entry.name}.oprn.json`);
  const file=`${out}/download-${entry.slug}.json`;await asset.saveAs(file);const got=JSON.parse(fs.readFileSync(file)),expected=JSON.parse(fs.readFileSync(`public/assets/region-references/${entry.slug}.oprn.json`));assert.ok(same(got,expected),`Download differs ${entry.id}`);
  const rows=await page.evaluate(id=>{const out=[];let row=0;do{const r=window.__oprnEditorTool('read_region_reference',{id,row,rows:16});if(!r.ok)throw Error(JSON.stringify(r));out.push(r.data);row=r.data.map.nextRow;}while(row!==null);return out;},entry.id);
  assert.deepEqual(rows.flatMap(r=>r.map.lowerTiles),before.maps[entry.mapId].lowerTiles);assert.deepEqual(rows.flatMap(r=>r.map.upperTiles),before.maps[entry.mapId].upperTiles);
  if(['cliff-forest-bridge','high-cliff-village','great-falls','rebuilt-forest-cave'].includes(entry.slug))await page.screenshot({path:`${out}/place-${entry.slug}.png`});
  results.push({id:entry.id,defaultPlace:true,preview:true,downloadExact:true,aiRowsExact:true,linkedMapCount:Object.keys(got.maps).length});console.log('Verified',entry.id);
 }
 // Source selection changes only the editor UI, not authored maps or assets.
 const after=read();assert.ok(same(after.maps,before.maps));assert.ok(same(after.tilesets,before.tilesets));assert.deepEqual(errors,[]);
 fs.writeFileSync(`${out}/catalog-proof.json`,JSON.stringify({origin,placeCount:results.length,sourceContentUnchanged:true,results,errors},null,2));
 console.log(JSON.stringify({placeCount:results.length,downloadsExact:true,aiRowsExact:true,sourceContentUnchanged:true,errors}));
}catch(e){const page=browser.contexts()[0]?.pages()[0];if(page){await page.screenshot({path:`${out}/catalog-failure.png`}).catch(()=>{});console.log((await page.locator('body').innerText().catch(()=>'' )).slice(-2200));}throw e;}finally{await browser.close();}
