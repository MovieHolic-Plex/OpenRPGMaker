import { chromium } from 'playwright';
import fs from 'node:fs';
const out='verify-shots/interview-scene-bank-v2';
const manifest=JSON.parse(fs.readFileSync('src/editor/interviewSceneBank.json','utf8'));
const catalog=JSON.parse(fs.readFileSync('src/editor/projectInterviewScenes.json','utf8'));
const targets=Object.keys(manifest.scenes).filter(key=>key.split('--').length===5);
if(!targets.length)throw Error('No reviewed fourth-answer background to inspect');
const browser=await chromium.launch({headless:true});
const page=await browser.newPage({viewport:{width:1440,height:900}});
const report={scope:'Every currently published fourth fixed-answer background clicked through actual production dialog in isolated container; not full app boot or generated-game completion',published:Object.keys(manifest.scenes).length,targets,generatedRequests:0,paths:[],errors:[]};
page.on('pageerror',e=>report.errors.push(e.message));
await page.route('**/auth/status**',r=>r.fulfill({contentType:'application/json',body:'{"connected":false}'}));
await page.route('**/v1/images/generations',r=>{report.generatedRequests++;return r.fulfill({status:503,contentType:'application/json',body:'{"error":"Reviewed fixed choice must use native bank"}'});});
try {
 await page.goto('http://127.0.0.1:9812/start-screen.html');
 await page.evaluate(async()=>{
  document.querySelector('#start-app')?.remove();
  const host=document.createElement('div');host.id='reviewed-structures-proof';host.className='start-app';document.body.append(host);
  window.__nativeDecoded=new Set();
  const source=await (await fetch('/src/editor/ui/projectInterviewDialog.ts')).text();
  const actual=source.match(/from \"([^\"]*interviewSceneBank\.ts[^\"]*)\"/)[1];
  const {InterviewSceneCache}=await import(actual);const original=InterviewSceneCache.prototype.load;
  InterviewSceneCache.prototype.load=function(key){const value=original.call(this,key);value?.then(()=>window.__nativeDecoded.add(key),()=>{});return value;};
  const {showProjectInterview}=await import('/src/editor/ui/projectInterviewDialog.ts');
  window.__showProductionInterview=()=>showProjectInterview('story-cutscene',{container:host,clickThrough:true});
 });
 for(const target of targets){
  await page.evaluate(()=>{window.__nativeDecoded.clear();window.__showProductionInterview();});
  await page.getByTestId('project-interview').waitFor();
  const [genre,...choices]=target.split('--');const questions=catalog.genres.find(g=>g.id===genre).questions;
  const steps=[];let key=genre;
  const click=async(testId)=>{
   const expected=key;const scene=manifest.scenes[expected];if(!scene)throw Error('Required native prefix missing: '+expected);
   await page.waitForFunction(k=>window.__nativeDecoded.has(k),expected);
   const result=await page.getByTestId(testId).evaluate(button=>{const t=performance.now();button.click();const p=document.querySelector('.cinematic-interview');return{key:p.dataset.sceneKey,ms:performance.now()-t,src:p.querySelector('.ci-backdrop img.is-visible')?.getAttribute('src')};});
   if(result.key!==expected||!result.src?.endsWith(scene.url))throw Error('Wrong cumulative native image: '+JSON.stringify(result));
   await page.waitForFunction(()=>{const i=document.querySelector('.ci-backdrop img.is-visible');return i?.complete&&i.naturalWidth>0;});
   steps.push(result);
  };
  await click('project-interview-genre-'+genre);
  for(const [index,id] of choices.entries()){
   const optionIndex=questions[index].options.findIndex(o=>o.id===id);if(optionIndex<0)throw Error('Unknown actual question option '+id);
   key+='--'+id;await click('project-interview-option-'+optionIndex);
  }
  report.paths.push({target,steps});
  if(target==='romance--campus--talk--secret--routes'||target==='romance--campus--memory--bittersweet--routes')await page.screenshot({path:out+'/structure-'+target+'.png'});
  await page.getByTestId('project-interview-cancel').click();
 }
 report.passed=report.generatedRequests===0&&report.errors.length===0&&report.paths.length===targets.length;
 if(!report.passed)throw Error('Unexpected generation request, incomplete path or browser error');
}finally{fs.writeFileSync(out+'/reviewed-structures-click-proof.json',JSON.stringify(report,null,2)+'\n');await browser.close();}
console.log(JSON.stringify({published:report.published,targets:targets.length,clicks:report.paths.reduce((sum,p)=>sum+p.steps.length,0),generatedRequests:report.generatedRequests,errors:report.errors,passed:report.passed}));
