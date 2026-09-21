import {chromium} from 'playwright';
import fs from 'node:fs';
import {loadLegacyDbEnvironment} from '../../../scripts/lib/legacyDb-database-ops.mjs';
const root=new URL('./',import.meta.url).pathname;
const out=root+(process.env.JRPG_RUN??'rerun2')+'/';fs.mkdirSync(out,{recursive:true});
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
page.on('requestfailed',r=>console.log('REQUEST_FAILED',new URL(r.url()).pathname,r.failure()?.errorText));
await page.reload({waitUntil:'domcontentloaded',timeout:120000});
await page.waitForSelector('[data-testid="ai-input"]',{timeout:120000});
const skip=page.getByRole('button',{name:'건너뛰기',exact:true});if(await skip.count()) await skip.click();
const before=await page.evaluate(async()=>{const url=performance.getEntriesByType('resource').map(e=>e.name).find(x=>/\/src\/project\/store\.ts(?:\?|$)/.test(x));if(!url)throw Error('No loaded store module');const {store}=await import(url);window.__jrpgQaStore=store;return {project:store.getCurrent(),identity:store.getProjectIdentity(),remote:store.isRemotePersistenceEnabled()};});
fs.writeFileSync(out+'browser-before.json',JSON.stringify(before,null,2));
if(!before.remote || !JSON.stringify(before.identity).includes('oprn-399e312698') || !before.project.maps.map_forest_dungeon)throw Error('Expected saved remote project not loaded');
const prompt=fs.readFileSync(process.argv[2]??new URL('./review/original-prompt.txt',import.meta.url),'utf8');
await page.getByTestId('ai-input').fill(prompt);await page.getByTestId('ai-send').click();
console.log('SENT',new Date().toISOString());
for(let i=0;i<150;i++){
 await new Promise(r=>setTimeout(r,8000));
 const snapshot=await page.evaluate(()=>({status:window.__oprnAiBridge.status(),audit:window.__oprnAiBridge.audit(),harness:window.__oprnAiBridge.harness()}));
 fs.writeFileSync(out+'run-progress.json',JSON.stringify(snapshot,null,2));
 const tools=snapshot.audit.filter(a=>a.kind==='tool');
 console.log(JSON.stringify({time:new Date().toISOString(),busy:snapshot.status.turnBusy,status:snapshot.status.lastStatus,tools:tools.length,failed:tools.filter(t=>!t.ok).length,recent:tools.slice(-3).map(t=>({name:t.name,ok:t.ok,summary:t.summary.slice(0,240)}))}));
 if(i===0)await page.screenshot({path:out+'live-running.png'});
 if(!snapshot.status.turnBusy){
  fs.writeFileSync(out+'run-final.json',JSON.stringify(snapshot,null,2));
  await page.screenshot({path:out+'live-finished.png'});
  const final=await page.evaluate(async()=>{const store=window.__jrpgQaStore;const flush=await store.flush();return {project:store.getCurrent(),identity:store.getProjectIdentity(),remote:store.isRemotePersistenceEnabled(),flush};});
  fs.writeFileSync(out+'browser-after.json',JSON.stringify(final,null,2));
  console.log('DONE',new Date().toISOString(),JSON.stringify({remote:final.remote,identity:final.identity,flush:final.flush}));break;
 }
}
await browser.close();
