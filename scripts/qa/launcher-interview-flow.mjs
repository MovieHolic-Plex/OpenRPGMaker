// Real launcher + production interview; synthetic auth/provider failures, no content writes.
import { chromium } from 'playwright';
import fs from 'node:fs';
import { resolve } from 'node:path';
import assert from 'node:assert/strict';

const base=process.env.MAKER_UI_URL??'http://127.0.0.1:9812';
const out=resolve(process.env.LAUNCHER_INTERVIEW_CAPTURE_DIR??'verify-shots/launcher-interview-flow');fs.mkdirSync(out,{recursive:true});
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
  const host=document.createElement('div');host.id='launcher-qa';host.className='start-app';document.body.append(host);
  window.__created=[];
  window.__oprnQaBridge={
    recentProjects:async()=>[],
    suggestProjectDir:async()=>({root:'/qa',projectDir:'/qa/new-game'}),
    createProject:async p=>{window.__created.push(p);return null;},
  };
  const {mountStartScreen}=await import('/src/start/startScreen.ts');
  mountStartScreen(host,window.__oprnQaBridge);
 });
 await page.getByTestId('project-interview').waitFor({timeout:60000});
 assert.equal(await page.evaluate(()=>window.__created.length),0);
 assert.match(page.url(),/start-screen\.html/);
 assert.equal(await page.locator('.cinematic-interview').getAttribute('data-art-state'),'opening');
 assert.equal(images,0);
 assert.equal(imports.some(p=>/\/project\/store\.ts|\/app\/mode\.ts|\/editor\/panels\/editor\.ts/.test(p)),false);
 report.checks.push('First question mounts directly on launcher with no preliminary submission, folder creation, editor imports or initial art request');
 await page.screenshot({path:out+'/opening.png'});
 await page.setViewportSize({width:1024,height:768});
 for(const genre of ['romance','monster','adventure','mystery']) {
  const choice=page.getByTestId('project-interview-genre-'+genre);
  const rect=await choice.boundingBox();
  assert.ok(rect&&rect.x>=0&&rect.y>=0&&rect.x+rect.width<=1024&&rect.y+rect.height<=768);
 }
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 await page.screenshot({path:out+'/opening-1024.png'});
 await page.emulateMedia({reducedMotion:'reduce'});
 assert.equal(await page.locator('.ci-backdrop').evaluate(n=>getComputedStyle(n,'::after').animationName),'none');
 await page.getByTestId('project-interview-genre-romance').focus();
 await page.keyboard.press('Tab');
 assert.equal(await page.evaluate(()=>document.activeElement?.getAttribute('data-testid')),'project-interview-genre-monster');
 await page.emulateMedia({reducedMotion:'no-preference'});
 await page.setViewportSize({width:1440,height:900});
 report.checks.push('All four genre buttons fit 1024×768 without horizontal overflow; keyboard navigation and reduced motion work');
 await page.getByTestId('project-interview-genre-romance').click();
 const still=await page.locator('.ci-backdrop video').evaluate(v=>v.hidden&&v.paused);
 assert.ok(still);
 await page.waitForFunction(()=>document.querySelector('.cinematic-interview')?.dataset.artState==='error');
 assert.ok(await page.locator('.ci-backdrop img.is-visible').getAttribute('src'));
 await page.screenshot({path:out+'/choice-pixel-still.png'});
 await page.getByTestId('project-interview-cancel').click();
 assert.equal(await page.evaluate(()=>window.__created.length),0);
 report.checks.push('Choice pauses/hides film; failed generation stays on pixel still; cancellation creates no folder');
 await page.getByTestId('start-new-game').click();
 await page.getByTestId('project-interview').waitFor();
 await page.locator('.ci-extras > summary').click();
 await page.getByTestId('project-interview-concept').fill('항구에서 사라진 편지를 찾는 이야기');
 await page.getByTestId('project-interview-genre-mystery').click();
 for(let i=0;i<5;i++) {
   await page.getByTestId('project-interview-option-'+(i%3)).click();
   assert.equal(await page.evaluate(()=>window.__created.length),0);
 }
 await page.locator('.ci-extras > summary').click();
 await page.getByTestId('project-interview-protagonist').fill('편지를 배달하는 주인공');
 await page.getByTestId('project-interview-notes').fill('비가 오는 항구');
 await page.getByTestId('project-interview-confirm').click();
 await page.locator('.cinematic-interview [role=alert]').filter({hasText:'새 게임 폴더를 만들지 못했습니다.'}).waitFor();
 assert.equal(await page.evaluate(()=>window.__created.length),1);
 assert.match(page.url(),/start-screen\.html/);
 report.checks.push('Only explicit final confirmation creates folder; failed creation remains on launcher');
 await page.getByTestId('project-interview-confirm').click();
 await page.waitForFunction(()=>window.__created.length===2);
 assert.equal(await page.getByTestId('project-interview').count(),1);
 assert.equal(await page.getByTestId('project-interview-option-0').count(),0);
 await page.screenshot({path:out+'/direct-confirm-retry.png'});
 report.checks.push('Retry remains in the same confirmation screen without repeating questions');
 await page.evaluate(()=>{window.__setItem=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){if(k==='oprn:start-handoff-storage-check')throw Error('QA storage unavailable');return window.__setItem.call(this,k,v);};});
 await page.getByTestId('project-interview-confirm').click();
 await page.locator('.cinematic-interview [role=alert]').filter({hasText:'QA storage unavailable'}).waitFor();
 assert.equal(await page.evaluate(()=>window.__created.length),2);
 await page.evaluate(()=>{Storage.prototype.setItem=window.__setItem;});
 report.checks.push('Storage preflight failure retains the plan and creates no folder');
 await page.unroute('**/auth/status**');
 await page.route('**/auth/status**',r=>r.fulfill({contentType:'application/json',body:JSON.stringify({connected:false,providerId:'anthropic'})}));
 await page.getByTestId('project-interview-confirm').click();
 await page.getByTestId('ai-connect-gate').waitFor();
 await page.getByTestId('ai-connect-gate-later').click();
 assert.equal(await page.evaluate(()=>window.__created.length),2);
 assert.equal(await page.getByTestId('project-interview').count(),1);
 report.checks.push('Declining account connection keeps confirmation visible without folder creation');
 await page.unroute('**/auth/status**');
 await page.route('**/auth/status**',r=>r.fulfill({contentType:'application/json',body:JSON.stringify({connected:true,providerId:'anthropic',planType:'QA'})}));
 await page.route('**/index.html',r=>r.fulfill({contentType:'text/html',body:'<!doctype html><title>Synthetic editor destination</title><p>Handoff received</p>'}));
 await page.evaluate(()=>{window.__oprnQaBridge.createProject=async p=>({projectDir:p.projectDir});});
 await page.getByTestId('project-interview-confirm').click();
 await page.waitForURL('**/index.html');
 const handoff=await page.evaluate(()=>JSON.parse(sessionStorage.getItem('oprn:start-screen-intent')));
 assert.equal(handoff.gameDesignBrief.interview.concept,'항구에서 사라진 편지를 찾는 이야기');
 assert.equal(handoff.gameDesignBrief.interview.protagonist,'편지를 배달하는 주인공');
 assert.equal(handoff.gameDesignBrief.interview.notes,'비가 오는 항구');
 assert.equal(handoff.gameDesignBrief.interview.genre,'mystery');
 assert.equal(Object.keys(handoff.gameDesignBrief.answers).length,5);
 assert.ok(Object.values(handoff.gameDesignBrief.answers).every(a=>a.text.includes(' — ')));
 fs.writeFileSync(out+'/component-handoff.json',JSON.stringify(handoff,null,2));
 report.checks.push('Successful synthetic creation writes the complete confirmed five-answer brief, concept, protagonist and notes before navigating to the synthetic editor destination');
 report.noEditorImports=imports.filter(p=>/\/project\/store\.ts|\/app\/mode\.ts|\/editor\/panels\/editor\.ts/.test(p));
 assert.deepEqual(report.errors,[]);
 report.passed=true;
} finally {
 fs.writeFileSync(out+'/component-proof.json',JSON.stringify(report,null,2));
 await browser.close();
}
console.log(JSON.stringify(report));
