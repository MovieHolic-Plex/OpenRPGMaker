import {chromium} from 'playwright';
import fs from 'node:fs';
import {loadLegacyDbEnvironment} from '../../../scripts/lib/legacyDb-database-ops.mjs';
const root=new URL('./',import.meta.url).pathname;
const out=root+(process.env.JRPG_RUN??'db-visual')+'/';fs.mkdirSync(out,{recursive:true});
const browser=await chromium.connectOverCDP('http://127.0.0.1:19862');
const page=browser.contexts()[0].pages()[0];
// Owned server only; preserve production responses while avoiding host netlink cancellation.
await page.route('http://127.0.0.1:19861/**', async route => {
 if(route.request().method()!=='GET') return route.continue();
 try {
  const response=await fetch(route.request().url(),{headers:route.request().headers()});
  const headers=Object.fromEntries(response.headers);delete headers['content-encoding'];delete headers['content-length'];delete headers['transfer-encoding'];
  await route.fulfill({status:response.status,headers,body:Buffer.from(await response.arrayBuffer())});
 } catch { await route.abort(); }
});
const env=loadLegacyDbEnvironment();
await page.route(`${env.VITE_LEGACY_DB_URL}/**`,async route=>{
 const req=route.request();
 const headers={...req.headers()};delete headers.host;delete headers['content-length'];
 try {
  const response=await fetch(req.url(),{method:req.method(),headers,...(req.postDataBuffer()?{body:req.postDataBuffer()}:{} )});
  const resultHeaders=Object.fromEntries(response.headers);delete resultHeaders['content-encoding'];delete resultHeaders['content-length'];delete resultHeaders['transfer-encoding'];
  await route.fulfill({status:response.status,headers:resultHeaders,body:Buffer.from(await response.arrayBuffer())});
 }catch(error){ console.log('DB_TRANSPORT_ERROR',error.message);await route.abort(); }
});



if(process.env.DB_QA_RELOAD){
 await page.reload({waitUntil:'domcontentloaded',timeout:120000});await page.getByTestId('ai-input').waitFor({timeout:120000});
 await page.evaluate(async()=>{const url=performance.getEntriesByType('resource').map(e=>e.name).find(x=>/\/src\/project\/store\.ts(?:\?|$)/.test(x));window.__jrpgQaStore=(await import(url)).store;});
}
if(!await page.getByTestId('database-modal').isVisible()){if(!await page.getByTestId('menu-tools-database').isVisible())await page.getByTestId('menu-tools').click();await page.getByTestId('menu-tools-database').click();}await page.getByTestId('database-modal').waitFor();
const records=process.env.DB_QA_SINGLE ? [["troops",process.env.DB_QA_SINGLE]] : await page.evaluate(()=>{const d=window.__jrpgQaStore.getCurrent().database;return [...d.items.filter(r=>r.id.startsWith('item_adventurer_')||r.id.startsWith('item_forest_')).map(r=>['items',r.id]),...d.enemies.filter(r=>r.id.startsWith('enemy_forest_')).map(r=>['enemies',r.id]),...d.troops.filter(r=>r.id.startsWith('troop_forest_')).map(r=>['troops',r.id]),...window.__jrpgQaStore.getCurrent().system.startActorIds?.map(id=>['actors',id])??[['actors','actor_cleric']]];});
const data=[];
for(const [tab,id]of records){const button=page.getByTestId('db-tab-'+tab);if(!await button.isVisible()){for(const g of await page.locator('[data-testid^="db-tab-group-"]').all()){await g.click();if(await button.isVisible())break;}}await button.click();await page.getByPlaceholder('이름 또는 ID 검색',{exact:true}).fill(id);const row=page.getByTestId('db-record-row-'+id);await row.click();await page.waitForTimeout(1500);await page.waitForFunction(()=>[...document.querySelectorAll('[data-testid=database-modal] img')].every(i=>i.complete),undefined,{timeout:15000}).catch(()=>{});await page.screenshot({path:out+id+'.png'});data.push({tab,id,body:await page.getByTestId('database-modal').innerText(),images:await page.getByTestId('database-modal').locator('img').evaluateAll(images=>images.map(i=>({src:i.getAttribute('src'),complete:i.complete,width:i.naturalWidth})))});}
fs.writeFileSync(out+'surfaces.json',JSON.stringify(data,null,2));console.log(data.map(d=>({tab:d.tab,id:d.id})));await page.getByTestId('database-modal-close').click();await browser.close();
