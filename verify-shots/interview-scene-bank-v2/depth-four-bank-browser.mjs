import { chromium } from 'playwright';
import fs from 'node:fs';
const out='verify-shots/interview-scene-bank-v2';
const manifest=JSON.parse(fs.readFileSync('src/editor/interviewSceneBank.json','utf8'));
const browser=await chromium.launch({headless:true});
const page=await browser.newPage({viewport:{width:1440,height:900}});
const report={scope:'Actual production interview dialog mounted in an isolated start-screen container, through fourth fixed answer; not full app boot or generated-game completion',published:Object.keys(manifest.scenes).length,generatedRequests:0,steps:[],errors:[]};
page.on('pageerror',e=>report.errors.push(e.message));
await page.route('**/auth/status**',r=>r.fulfill({contentType:'application/json',body:'{"connected":false}'}));
await page.route('**/v1/images/generations',r=>{report.generatedRequests++;return r.fulfill({status:503,contentType:'application/json',body:'{"error":"Reviewed fixed choice must use native bank"}'});});
try {
 await page.goto('http://127.0.0.1:9812/start-screen.html');
 await page.evaluate(async()=>{
  document.querySelector('#start-app')?.remove();
  const host=document.createElement('div');host.id='depth-four-native-proof';host.className='start-app';document.body.append(host);
  window.__nativeDecoded=new Set();
  const source=await (await fetch('/src/editor/ui/projectInterviewDialog.ts')).text();
  const actual=source.match(/from \"([^\"]*interviewSceneBank\.ts[^\"]*)\"/)[1];
  const {InterviewSceneCache}=await import(actual);const original=InterviewSceneCache.prototype.load;
  InterviewSceneCache.prototype.load=function(key){const value=original.call(this,key);value?.then(()=>window.__nativeDecoded.add(key),()=>{});return value;};
  const {showProjectInterview}=await import('/src/editor/ui/projectInterviewDialog.ts');
  window.__nativeInterview=showProjectInterview('story-cutscene',{container:host,clickThrough:true});
 });
 await page.getByTestId('project-interview').waitFor();
 let key='romance';
 const click=async(testId)=>{
  const expected=key;const scene=manifest.scenes[expected];if(!scene)throw Error('Required new native asset missing: '+expected);
  await page.waitForFunction(k=>window.__nativeDecoded.has(k),expected);
  const result=await page.getByTestId(testId).evaluate(button=>{const t=performance.now();button.click();const p=document.querySelector('.cinematic-interview');return{key:p.dataset.sceneKey,ms:performance.now()-t,src:p.querySelector('.ci-backdrop img.is-visible')?.getAttribute('src')};});
  if(result.key!==expected||!result.src?.endsWith(scene.url))throw Error('Wrong cumulative native image: '+JSON.stringify(result));report.steps.push(result);
 };
 await click('project-interview-genre-romance');
 for(const id of ['campus','talk','warm','single']){key+='--'+id;await click('project-interview-option-0');}
 await page.waitForFunction(()=>{const i=document.querySelector('.ci-backdrop img.is-visible');return i?.complete&&i.naturalWidth>0;});
 await page.screenshot({path:out+'/depth-four-native-bank.png'});
 report.passed=report.generatedRequests===0&&report.errors.length===0&&report.steps.length===5;
 if(!report.passed)throw Error('Unexpected generation request or browser error');
 await page.getByTestId('project-interview-cancel').click();
} finally {fs.writeFileSync(out+'/depth-four-click-proof.json',JSON.stringify(report,null,2)+'\n');await browser.close();}
console.log(JSON.stringify(report));
