import fs from 'node:fs';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
const base=process.argv[2]??'http://mdc-server:9888';
const out='output/evidence/reviewed-default-places/live';fs.mkdirSync(out,{recursive:true});
const browser=await chromium.launch({args:['--no-sandbox']});
try{
 const proof=[];
 for(const [name,query] of [['unrelated-project','project=rpg-zzu-region-reference-walled-settlement-v1'],['saved-project','project=rpg-zzu-house-template-gallery']]){
  const context=await browser.newContext({viewport:{width:1600,height:1000}}),page=await context.newPage(),errors=[];
  page.setDefaultTimeout(120000);
  page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/*',route=>{const r=route.request();return !['GET','HEAD','OPTIONS'].includes(r.method())&&/\/rest\/v1\/|\/rpc\//.test(r.url())?route.abort():route.continue();});
  await page.addInitScript(()=>{localStorage.setItem('oprn:editor-ui-mode','expert');localStorage.setItem('oprn:ai-panel-collapsed','1');for(const k of ['oprn:editor-welcome-dismissed','oprn:standard-welcome-seen','oprn:coachmarks-basic-v1'])localStorage.setItem(k,'1');});
  try{
   await page.goto(`${base}/?${query}&aiBridge=0`,{waitUntil:'domcontentloaded',timeout:120000});
   if(name==='unrelated-project')await page.getByTestId('map-tree-node-map_reference_gabled_houses_20260913').waitFor({state:'attached',timeout:120000});
   await page.getByTestId('toolbar-database').click({timeout:120000});
   const group=page.getByTestId('db-tab-group-world');if(await group.getAttribute('aria-expanded')==='false')await group.click();
   await page.getByTestId('db-tab-spatial-places').click();
   const id='reviewed-place:place_functional_two_story_inn';
   await page.waitForFunction(id=>document.querySelector('[data-testid="composition-design"]')||[...document.querySelectorAll('[data-card-id]')].some(el=>el.dataset.cardId===id),id,{timeout:60000});
   if(await page.getByTestId('composition-design').count())await page.getByTestId('composition-design').evaluate((select,id)=>{select.value=id;select.dispatchEvent(new Event('change',{bubbles:true}));},id);
   else await page.getByTestId(`spatial-card-${id}`).click();
   await page.getByTestId('spatial-source-defaults').click();
   const card=page.getByTestId(`spatial-card-${id}`);await card.waitFor();
   assert.equal(await card.getAttribute('data-source'),'default');
   const canvases=page.locator('.spatial-place-world canvas[data-loaded=true], .spatial-place-raster[data-loaded=true]');
   await page.waitForFunction(()=>document.querySelectorAll('canvas.spatial-place-raster[data-loaded=true]').length===2);
   assert.equal(await page.locator('[data-card-id^="reviewed-place:"]').count(),25);
   await card.scrollIntoViewIfNeeded();
   await page.screenshot({path:`${out}/${name}.png`});
   proof.push({name,url:page.url(),defaultPlace:true,previewLoaded:true,errors});console.log(JSON.stringify(proof.at(-1)));
   assert.deepEqual(errors,[]);
  }catch(e){await page.screenshot({path:`${out}/${name}-failure.png`});console.log((await page.locator('body').innerText()).slice(-3000));throw e;}
  finally{await context.close();}
 }
 fs.writeFileSync(`${out}/browser-proof.json`,JSON.stringify(proof,null,2));
}finally{await browser.close();}
