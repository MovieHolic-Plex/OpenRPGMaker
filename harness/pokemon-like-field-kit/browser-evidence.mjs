// Focused native browser evidence, not a test suite or a human approval.
import {pathToFileURL,fileURLToPath} from 'node:url';
import {resolve,dirname} from 'node:path';
import {mkdir,writeFile} from 'node:fs/promises';
if(!process.env.FIELD_KIT_PLAYWRIGHT)throw Error('Set FIELD_KIT_PLAYWRIGHT to Playwright entrypoint');
const {chromium}=await import(pathToFileURL(resolve(process.env.FIELD_KIT_PLAYWRIGHT)).href);
const root=dirname(fileURLToPath(import.meta.url)),out=resolve(process.env.FIELD_KIT_EVIDENCE??resolve(root,'evidence'));
await mkdir(out,{recursive:true});
const browser=await chromium.launch({args:['--no-sandbox']}),page=await browser.newPage({viewport:{width:1280,height:960}});
const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.status()>=400)errors.push(`${r.status()} ${r.url()}`);});
const report={scope:'Independent review kit; UI demo state only; no canonical game mutation; no production votes',errors};
const snapshot=()=>page.evaluate(()=>window.fieldKit.snapshot());
try{
 await page.goto(process.env.FIELD_KIT_URL??'http://127.0.0.1:18327');await page.waitForFunction(()=>window.fieldKit);
 await page.evaluate(()=>document.fonts.ready);await page.waitForTimeout(100);
 report.images=await page.locator('img').evaluateAll(nodes=>nodes.map(n=>({src:n.getAttribute('src'),loaded:n.complete&&n.naturalWidth>0})));if(report.images.some(x=>!x.loaded))throw Error('Image failed');
 if(await page.locator('.allow:disabled').count()!==3)throw Error('Allow is not gated');
 await page.click('#play');await page.waitForFunction(()=>window.fieldKit.snapshot().playing);
 report.musicStart=await snapshot();
 for(const screen of ['menu','party','bag','shop']){
  await page.click(`[data-screen="${screen}"]`);await page.waitForTimeout(150);await page.locator('.preview-card').screenshot({path:resolve(out,screen+'.png')});
 }
 await page.click('[data-action="buy-orb"]');await page.keyboard.press('Enter');report.afterPurchase=await snapshot();
 if(report.afterPurchase.gold!==1520||report.afterPurchase.orbs!==11)throw Error('Preview purchase failed');
 await page.click('[data-screen="bag"]');await page.keyboard.press('Enter');await page.keyboard.press('Enter');report.afterMedicine=await snapshot();
 if(report.afterMedicine.hp!==38||report.afterMedicine.potions!==4)throw Error('Preview medicine failed');
 await page.click('[data-screen="menu"]');await page.keyboard.press('ArrowDown');await page.keyboard.press('Enter');
 if((await snapshot()).screen!=='party')throw Error('Keyboard menu failed');
 await page.keyboard.press('Escape');if((await snapshot()).screen!=='menu')throw Error('Back failed');
 report.afterMenus=await snapshot();if(report.afterMenus.playCount!==report.musicStart.playCount||report.afterMenus.position<=report.musicStart.position)throw Error('Menu restarted music');
 for(const cue of ['cursor','confirm','cancel'])await page.click(`[data-cue="${cue}"]`);
 await page.click('#play');report.paused=await snapshot();await page.waitForTimeout(150);await page.click('#play');await page.waitForFunction(()=>window.fieldKit.snapshot().playing);report.resumed=await snapshot();
 if(report.resumed.position<report.paused.position)throw Error('Pause/resume position lost');
 await page.screenshot({path:resolve(out,'desktop.png'),fullPage:true});
 await page.setViewportSize({width:390,height:844});await page.waitForTimeout(150);await page.screenshot({path:resolve(out,'mobile.png'),fullPage:true});
 report.mobile=await page.evaluate(()=>({width:innerWidth,scrollWidth:document.documentElement.scrollWidth}));if(report.mobile.scrollWidth>report.mobile.width)throw Error('Horizontal overflow');
 await page.click('[data-track="route"]');await page.waitForFunction(()=>window.fieldKit.snapshot().selectedTrack==='route'&&window.fieldKit.snapshot().playing);report.route=await snapshot();
 await page.click('[data-track="previous-town"]');await page.waitForFunction(()=>window.fieldKit.snapshot().selectedTrack==='previous-town'&&window.fieldKit.snapshot().playing);report.previous=await snapshot();
 const decisions=await page.evaluate(()=>fetch('/api/reviews').then(r=>r.json()));report.reviewDecisions=decisions.decisions;
 if(Object.keys(decisions.decisions).length)throw Error('Production unexpectedly contains votes; inspect rather than erase');
 if(errors.length)throw Error('Browser errors');
 await writeFile(resolve(out,'browser.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
}catch(e){await page.screenshot({path:resolve(out,'failure.png'),fullPage:true});await writeFile(resolve(out,'failure.json'),JSON.stringify({message:e.message,errors},null,2));throw e;}
finally{await browser.close();}
