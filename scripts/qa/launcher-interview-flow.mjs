// Real launcher + production interview; synthetic auth/provider failures, no content writes.
import { chromium } from 'playwright';
import fs from 'node:fs';
import { resolve } from 'node:path';
import assert from 'node:assert/strict';

const base=process.env.MAKER_UI_URL??'http://127.0.0.1:9812';
const out=resolve('verify-shots/launcher-interview-flow');fs.mkdirSync(out,{recursive:true});
const browser=await chromium.launch({args:['--no-sandbox']});
const report={productionComponents:true,syntheticAuthAndArtFailure:true,canonicalWrites:0,errors:[],checks:[]};
const page=await browser.newPage({viewport:{width:1440,height:900}});
page.on('pageerror',e=>report.errors.push(e.message));
const imports=[];page.on('request',r=>{if(r.url().includes('/src/')) imports.push(new URL(r.url()).pathname);});
let images=0;
await page.route('**/auth/status**',r=>r.fulfill({contentType:'application/json',body:JSON.stringify({connected:true,providerId:'anthropic',planType:'QA'})}));
await page.route('**/v1/images/generations',r=>{images++;return r.fulfill({status:503,contentType:'application/json',body:JSON.stringify({error:'Synthetic unavailable image provider'})});});
try {
 await page.goto(base+'/start-screen.html');
 await page.evaluate(async()=>{
  document.querySelector('#start-app')?.remove();
  const host=document.createElement('div');host.id='launcher-qa';document.body.append(host);
  window.__created=[];
  window.__oprnQaBridge={
    recentProjects:async()=>[],
    suggestProjectDir:async()=>({root:'/qa',projectDir:'/qa/new-game'}),
    createProject:async p=>{window.__created.push(p);return null;},
  };
  const {mountStartScreen}=await import('/src/start/startScreen.ts');
  mountStartScreen(host,window.__oprnQaBridge);
 });
 await page.getByTestId('start-genre-option-story-cutscene').click();
 await page.getByTestId('start-create').click();
 await page.getByTestId('project-interview').waitFor({timeout:60000});
 assert.equal(await page.evaluate(()=>window.__created.length),0);
 assert.match(page.url(),/start-screen\.html/);
 assert.equal(await page.locator('.cinematic-interview').getAttribute('data-art-state'),'opening');
 assert.equal(images,0);
 assert.equal(imports.some(p=>/\/project\/store\.ts|\/app\/mode\.ts|\/editor\/panels\/editor\.ts/.test(p)),false);
 report.checks.push('Interview mounted on launcher without folder creation, editor shell or initial art request');
 await page.screenshot({path:out+'/opening.png'});
 await page.getByTestId('project-interview-genre-romance').click();
 const still=await page.locator('.ci-backdrop video').evaluate(v=>v.hidden&&v.paused);
 assert.ok(still);
 await page.waitForFunction(()=>document.querySelector('.cinematic-interview')?.dataset.artState==='error');
 assert.ok(await page.locator('.ci-backdrop img.is-visible').getAttribute('src'));
 await page.screenshot({path:out+'/choice-pixel-still.png'});
 await page.getByTestId('project-interview-cancel').click();
 assert.equal(await page.evaluate(()=>window.__created.length),0);
 report.checks.push('Choice pauses/hides film; failed generation stays on pixel still; cancellation creates no folder');
 await page.getByTestId('start-create').click();
 await page.getByTestId('project-interview').waitFor();
 await page.getByTestId('project-interview-genre-mystery').click();
 await page.getByTestId('project-interview-concept').fill('항구에서 사라진 편지를 찾는 이야기');
 await page.getByTestId('project-interview-begin').click();
 for(let i=0;i<5;i++) {
   await page.getByTestId('project-interview-option-'+(i%3)).click();
   assert.equal(await page.evaluate(()=>window.__created.length),0);
   await page.getByTestId('project-interview-next').click();
 }
 await page.getByTestId('project-interview-protagonist').fill('편지를 배달하는 주인공');
 await page.getByTestId('project-interview-notes').fill('비가 오는 항구');
 await page.getByTestId('project-interview-confirm').click();
 await page.getByTestId('start-error').filter({hasText:'새 게임 폴더를 만들지 못했습니다.'}).waitFor();
 assert.equal(await page.evaluate(()=>window.__created.length),1);
 assert.match(page.url(),/start-screen\.html/);
 report.checks.push('Only explicit final confirmation creates folder; failed creation remains on launcher');
 await page.getByTestId('start-create').click();
 await page.waitForFunction(()=>window.__created.length===2);
 assert.equal(await page.getByTestId('project-interview').count(),0);
 report.checks.push('Retry retains confirmed plan and does not repeat interview');
 report.noEditorImports=imports.filter(p=>/\/project\/store\.ts|\/app\/mode\.ts|\/editor\/panels\/editor\.ts/.test(p));
 assert.deepEqual(report.errors,[]);
 report.passed=true;
} finally {
 fs.writeFileSync(out+'/component-proof.json',JSON.stringify(report,null,2));
 await browser.close();
}
console.log(JSON.stringify(report));
