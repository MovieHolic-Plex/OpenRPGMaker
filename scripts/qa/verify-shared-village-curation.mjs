import fs from 'node:fs';import assert from 'node:assert/strict';import {chromium} from 'playwright';
const out='output/evidence/shared-village-curation',origin=process.env.BRIDGE_DEV_ORIGIN??'http://127.0.0.1:9841';
const entries=JSON.parse(fs.readFileSync(out+'/entries.json'));const browser=await chromium.launch({executablePath:'/opt/google/chrome/chrome',args:['--no-sandbox','--no-proxy-server']});
try{
for(const mode of (process.env.CATALOG_MODES??'fresh,existing').split(',')){
 const context=await browser.newContext({viewport:{width:1740,height:1400}});
 if(mode==='existing' && origin!=='http://127.0.0.1:9825'){
  const host='http://127.0.0.1:9825';const conf=JSON.parse((await(await fetch(host)).text()).match(/window\.__OPRN_BRIDGE__=(.*?)<\/script>/)[1]);const bridge=await(await fetch(host+'/__oprn/bridge.js')).text();
  await context.route('**/__oprn/**',async r=>{const u=new URL(r.request().url());await r.fulfill({response:await r.fetch({url:host+u.pathname+u.search})});});await context.addInitScript({content:`window.__OPRN_BRIDGE__=${JSON.stringify(conf)};\n${bridge}`});
 }
 await context.addInitScript(()=>{localStorage.setItem('oprn:editor-ui-mode','expert');for(const k of ['oprn:editor-welcome-dismissed','oprn:standard-welcome-seen','oprn:coachmarks-basic-v1'])localStorage.setItem(k,'1');});
 const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(origin+(mode==='fresh'?'/?blankProject=1&aiBridge=0':'/?map=map_village_ten_terrace_gardens'),{waitUntil:'domcontentloaded'});
 await page.getByTestId('toolbar-database').waitFor({timeout:120000});await page.getByTestId('toolbar-database').click();
 const world=page.getByTestId('db-tab-group-world');if(await world.getAttribute('aria-expanded')==='false')await world.click();
 await page.getByTestId('db-tab-spatial-places').click();
 await page.getByTestId('spatial-source-defaults').click();
 for(const entry of entries){
  await page.getByTestId('spatial-card-region-reference:'+entry.id).click();
  const dims=await page.getByTestId('region-reference-preview').locator('img').evaluate(async i=>{await i.decode();return[i.naturalWidth,i.naturalHeight];});assert.deepEqual(dims,[1280,1152]);
 }
 await page.screenshot({path:`${out}/${mode}-places.png`});
 await page.getByTestId('db-tab-spatial-objects').click();await page.getByTestId('spatial-source-defaults').click();
 await page.locator('[data-tileset-id="shared_forest_village_objects"]').click();
 assert.equal(await page.locator('.asset-browser-count').innerText(),'19개');
 await page.getByTestId('spatial-browser-search').fill('낮은 돌 우물');assert.equal(await page.locator('.asset-browser-count').innerText(),'1개');await page.locator('.asset-browser-card').click();await page.waitForTimeout(800);await page.screenshot({path:`${out}/${mode}-objects.png`});
 if(mode==='fresh'){
  await page.getByTestId('spatial-object-copy').click();
  const copied=await page.evaluate(async()=>{const {visibleAuthoringProject}=await import('/src/editor/panels/spatialAuthoringAccess.ts');return visibleAuthoringProject().tilesets.shared_forest_village_objects.structureKits.filter(k=>k.name.includes('낮은 돌 우물')).length;});assert.equal(copied,2);
 }
 assert.deepEqual(errors,[]);fs.writeFileSync(`${out}/${mode}-browser-proof.json`,JSON.stringify({mode,places:7,objects:19,previews:true,copyChecked:mode==='fresh',errors},null,2));console.log(mode,'7 places, 19 shared objects verified');await context.close();
}
}catch(e){for(const c of browser.contexts())for(const p of c.pages()){await p.screenshot({path:out+'/browser-failure.png'}).catch(()=>{});console.log((await p.locator('body').innerText()).slice(-1800));}throw e;}finally{await browser.close();}
