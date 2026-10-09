import assert from 'node:assert/strict';
import fs from 'node:fs';
import { firefox, chromium } from 'playwright';
const base=process.argv[2]??'http://127.0.0.1:19841';
const out=process.argv[3]??'output/evidence/ship/default-catalog';fs.mkdirSync(out,{recursive:true});
const query=process.argv[4]??'blankProject=1';
const browser=await (process.env.QA_BROWSER==='chromium'?chromium:firefox).launch();const page=await browser.newPage({viewport:{width:1440,height:1000}});page.setDefaultTimeout(120000);const errors=[];page.on('pageerror',e=>errors.push(e.message));
try {
 await page.route('**/*',route=>{const r=route.request();return !['GET','HEAD','OPTIONS'].includes(r.method())&&/\/rest\/v1\/|\/rpc\//.test(r.url())?route.abort():route.continue();});
 await page.addInitScript(()=>{localStorage.setItem('oprn:editor-welcome-dismissed','1');localStorage.setItem('rpg-zzu:editor-ui-mode','expert');localStorage.setItem('oprn:standard-welcome-seen','1');localStorage.setItem('oprn:coachmarks-basic-v1','1');});
 await page.goto(base+'/?'+query+'&aiBridge=0',{waitUntil:'domcontentloaded',timeout:120000});
 await page.getByTestId('toolbar-database').click({timeout:120000});
 const group=page.getByTestId('db-tab-group-world');if(await group.getAttribute('aria-expanded')==='false')await group.click();
 await page.getByTestId('db-tab-spatial-places').click();
 await page.waitForFunction(()=>document.querySelector('[data-testid=composition-design]')||document.querySelector('[data-testid=spatial-source-defaults]'));
 if(await page.getByTestId('composition-design').count())await page.getByTestId('composition-design').selectOption('region-reference:bluewave-harbor');
 await page.getByTestId('spatial-source-defaults').click();
 const ids=['bluewave-ship','bluewave-cabin','giant-ship','giant-cabin','wide-ship','wide-cabin','bluewave-harbor'];
 for(const id of ids){const card=page.getByTestId('spatial-card-region-reference:'+id);await card.click();const img=page.getByTestId('region-reference-preview').locator('img');await img.evaluate(el=>el.decode());assert((await img.getAttribute('src')).includes(id));}
 await page.getByTestId('spatial-card-region-reference:bluewave-harbor').scrollIntoViewIfNeeded();await page.screenshot({path:out+'/default-harbor.png'});
 await page.getByTestId('spatial-card-region-reference:wide-ship').click();await page.getByTestId('region-reference-preview').locator('img').evaluate(el=>el.decode());await page.screenshot({path:out+'/default-wide-ship.png'});
 assert.deepEqual(errors,[]);fs.writeFileSync(out+'/proof.json',JSON.stringify({base,query,remoteWritesBlocked:true,defaultPlaces:ids,errors},null,2));console.log('PASS: 7 default places and previews on '+base);
}catch(e){await page.screenshot({path:out+'/failure.png'});console.log((await page.locator('body').innerText()).slice(-2300));throw e;}finally{await browser.close();}
