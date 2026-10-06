// Editor QA: real controls, canonical save/reload and reversible audition. Runtime QA is separate.
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync,writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
const out=resolve('verify-shots/opening-typography');
const completion=JSON.parse(readFileSync(out+'/completion.json','utf8'));
assert(completion.passed);
const dir=completion.afterReload.dir;
const snapshot=()=>{const db=new DatabaseSync(dir+'/project.sqlite',{readOnly:true});try{const row=db.prepare('select revision,current_json from project where id=1').get();return{revision:row.revision,opening:JSON.parse(row.current_json).system.opening};}finally{db.close();}};
const before=snapshot();
const report={mode:'actual editor controls; save/reload then restore original timing',projectId:completion.afterReload.projectId,dir,before,errors:[]};
const browser=await chromium.launch({args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const page=await browser.newPage({viewport:{width:1440,height:1000},reducedMotion:'no-preference'});
page.on('pageerror',e=>report.errors.push(e.message));
const open=async()=>{await page.waitForFunction(()=>window.__oprnAiBridge?.status().ready,null,{timeout:180000,polling:100});await page.getByTestId('toolbar-database').click();await page.getByTestId('db-group-strip-system').click();await page.getByTestId('db-tab-opening').click();await page.getByTestId('db-cinematic-presentation-preset').waitFor();};
const saved=async value=>{const deadline=Date.now()+15000;while(Date.now()<deadline){if(snapshot().opening.scenes[0].presentation.text.revealMs===value)return;await page.waitForTimeout(200);}throw Error('Canonical timing did not save');};
try{
 await page.goto(completion.projectUrl,{waitUntil:'domcontentloaded'});await open();
 assert.equal(await page.getByTestId('db-cinematic-presentation-preset').inputValue(),'prologue');
 assert.equal(await page.getByTestId('db-cinematic-text-animation').inputValue(),'typewriter');
 await page.getByTestId('db-cinematic-text-revealMs').fill('1400');await page.getByTestId('db-cinematic-text-revealMs').dispatchEvent('change');await saved(1400);
 await page.reload();await open();assert.equal(await page.getByTestId('db-cinematic-text-revealMs').inputValue(),'1400');report.changedReload=snapshot();
 await page.getByTestId('db-cinematic-text-revealMs').fill('1500');await page.getByTestId('db-cinematic-text-revealMs').dispatchEvent('change');await saved(1500);
 await page.getByTestId('db-cinematic-text-animation').scrollIntoViewIfNeeded();await page.screenshot({path:out+'/editor-controls.png'});
 await page.getByTestId('db-cinematic-preview-start').click();await page.getByTestId('cinematic-sequence').waitFor();
 await page.waitForFunction(()=>document.querySelector('.cinematic-narration')?.dataset.textState==='revealing',null,{timeout:5000,polling:25});
 report.preview=await page.locator('.cinematic-narration').evaluate(n=>({letters:n.querySelectorAll('[data-letter]').length,visible:[...n.querySelectorAll('[data-letter]')].filter(l=>l.style.opacity==='1').length,animation:n.dataset.animation}));
 await page.screenshot({path:out+'/editor-preview.png',animations:'allow'});await page.keyboard.press('Escape');await page.getByTestId('cinematic-sequence').waitFor({state:'hidden'});
 report.after=snapshot();assert.deepEqual(report.after.opening,before.opening);assert.deepEqual(report.errors,[]);report.passed=true;
}catch(e){report.failure=e.message;await page.screenshot({path:out+'/editor-failure.png'}).catch(()=>{});}
finally{await browser.close();writeFileSync(out+'/editor.json',JSON.stringify(report,null,2)+'\n');}
console.log(JSON.stringify(report));process.exitCode=report.passed?0:1;
