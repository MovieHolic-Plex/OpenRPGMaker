import fs from 'node:fs';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
const base=process.argv[2]??'http://mdc-server:9888';
const out='output/evidence/emerald-default-place';fs.mkdirSync(out,{recursive:true});
const browser=await chromium.launch({args:['--no-sandbox']});
try{
 const proof=[];
 for(const [name,query] of [['new-project','blankProject=1'],['saved-project','project=rpg-zzu-house-template-gallery']]){
  const context=await browser.newContext({viewport:{width:1600,height:1000}}),page=await context.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/*',route=>{const r=route.request();return !['GET','HEAD','OPTIONS'].includes(r.method())&&/\/rest\/v1\/|\/rpc\//.test(r.url())?route.abort():route.continue();});
  await page.addInitScript(()=>{localStorage.setItem('rpg-zzu:editor-ui-mode','expert');localStorage.setItem('oprn:ai-panel-collapsed','1');for(const k of ['oprn:editor-welcome-dismissed','oprn:standard-welcome-seen','oprn:coachmarks-basic-v1'])localStorage.setItem(k,'1');});
  try{
   await page.goto(`${base}/?${query}&aiBridge=0`,{waitUntil:'domcontentloaded',timeout:120000});
   await page.getByTestId('toolbar-database').click({timeout:120000});
   const group=page.getByTestId('db-tab-group-world');if(await group.getAttribute('aria-expanded')==='false')await group.click();
   await page.getByTestId('db-tab-spatial-places').click();
   const id='region-reference:emerald-basin-80x64';
   await page.waitForFunction(id=>document.querySelector('[data-testid="composition-design"]')||[...document.querySelectorAll('[data-card-id]')].some(el=>el.dataset.cardId===id),id,{timeout:60000});
   if(await page.getByTestId('composition-design').count())await page.getByTestId('composition-design').selectOption(id);
   else await page.getByTestId(`spatial-card-${id}`).click();
   await page.getByTestId('spatial-source-defaults').click();
   const card=page.getByTestId(`spatial-card-${id}`);await card.waitFor();
   assert.equal(await card.getAttribute('data-source'),'default');
   const img=page.getByTestId('region-reference-preview').locator('img');await img.waitFor();await img.evaluate(img=>img.decode());
   assert.equal(await img.getAttribute('src'),'/assets/region-references/emerald-basin.png');
   assert.equal(await img.evaluate(img=>img.naturalWidth),1280);
   await page.screenshot({path:`${out}/${name}.png`});
   proof.push({name,url:page.url(),defaultPlace:true,previewLoaded:true,errors});console.log(JSON.stringify(proof.at(-1)));
   assert.deepEqual(errors,[]);
  }catch(e){await page.screenshot({path:`${out}/${name}-failure.png`});console.log((await page.locator('body').innerText()).slice(-3000));throw e;}
  finally{await context.close();}
 }
 fs.writeFileSync(`${out}/browser-proof.json`,JSON.stringify(proof,null,2));
}finally{await browser.close();}
