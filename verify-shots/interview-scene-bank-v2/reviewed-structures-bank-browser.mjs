import { chromium } from 'playwright';
import fs from 'node:fs';
const out='verify-shots/interview-scene-bank-v2';
const manifest=JSON.parse(fs.readFileSync('src/editor/interviewSceneBank.json','utf8'));
const catalog=JSON.parse(fs.readFileSync('src/editor/projectInterviewScenes.json','utf8'));
const allPublished=process.argv.includes('--all-published');
const targets=Object.keys(manifest.scenes).filter(key=>allPublished?key!=='opening':key.split('--').length===5);
if(!targets.length)throw Error('No reviewed fixed-answer background to inspect');
const browser=await chromium.launch({headless:true});
const page=await browser.newPage({viewport:{width:1440,height:900}});
const report={scope:allPublished?'Every currently published fixed-choice prefix through actual production dialog, plus opening image; isolated container, not full app boot or generated-game completion':'Every currently published fourth fixed-answer background clicked through actual production dialog in isolated container; not full app boot or generated-game completion',published:Object.keys(manifest.scenes).length,targets,generatedRequests:0,paths:[],errors:[]};
page.on('pageerror',e=>report.errors.push(e.message));
await page.route('**/auth/status**',r=>r.fulfill({contentType:'application/json',body:'{"connected":false}'}));
await page.route('**/v1/images/generations',r=>{report.generatedRequests++;return r.fulfill({status:503,contentType:'application/json',body:'{"error":"Reviewed fixed choice must use native bank"}'});});
try {
 await page.goto('http://127.0.0.1:9812/start-screen.html');
 await page.evaluate(async()=>{
  document.querySelector('#start-app')?.remove();
  const host=document.createElement('div');host.id='reviewed-structures-proof';host.className='start-app';document.body.append(host);
  window.__nativeDecoded=new Set();window.__nativeCacheOwner=null;
  const source=await (await fetch('/src/editor/ui/projectInterviewDialog.ts')).text();
  const actual=source.match(/from \"([^\"]*interviewSceneBank\.ts[^\"]*)\"/)[1];
  const {InterviewSceneCache}=await import(actual);const original=InterviewSceneCache.prototype.load;
  InterviewSceneCache.prototype.load=function(key){
   if(window.__nativeCacheOwner===null)window.__nativeCacheOwner=this;
   const cache=this;const value=original.call(cache,key);
   value?.then(()=>{if(window.__nativeCacheOwner===cache&&cache.ready(key))window.__nativeDecoded.add(key);},()=>{});
   return value;
  };
  const {showProjectInterview}=await import('/src/editor/ui/projectInterviewDialog.ts');
  window.__showProductionInterview=()=>showProjectInterview('story-cutscene',{container:host,clickThrough:true});
 });
 for(const target of targets){
  await page.evaluate(()=>{window.__nativeDecoded.clear();window.__nativeCacheOwner=null;window.__showProductionInterview();});
  await page.getByTestId('project-interview').waitFor();
  if(allPublished&&!report.opening){
   await page.waitForFunction(()=>{const i=document.querySelector('.ci-backdrop img.is-visible');return i?.complete&&i.naturalWidth>0;});
   report.opening=await page.locator('.ci-backdrop img.is-visible').evaluate(img=>({src:img.getAttribute('src'),width:img.naturalWidth,height:img.naturalHeight}));
   if(!report.opening.src?.endsWith(manifest.scenes.opening.url))throw Error('Wrong published opening background');
  }
  const [genre,...choices]=target.split('--');const questions=catalog.genres.find(g=>g.id===genre).questions;
  const steps=[];let key=genre;
  const click=async(testId)=>{
   const expected=key;const scene=manifest.scenes[expected];if(!scene)throw Error('Required native prefix missing: '+expected);
   await page.waitForFunction(k=>window.__nativeDecoded.has(k),expected);
   const result=await page.getByTestId(testId).evaluate(button=>{const t=performance.now();button.click();const p=document.querySelector('.cinematic-interview');return{key:p.dataset.sceneKey,ms:performance.now()-t,src:p.querySelector('.ci-backdrop img.is-visible')?.getAttribute('src')};});
   if(result.key!==expected||!result.src?.endsWith(scene.url))throw Error('Wrong cumulative native image for '+expected+': '+JSON.stringify(result));
   await page.waitForFunction(()=>{const i=document.querySelector('.ci-backdrop img.is-visible');return i?.complete&&i.naturalWidth>0;});
   steps.push(result);
  };
  await click('project-interview-genre-'+genre);
  for(const [index,id] of choices.entries()){
   const optionIndex=questions[index].options.findIndex(o=>o.id===id);if(optionIndex<0)throw Error('Unknown actual question option '+id);
   key+='--'+id;await click('project-interview-option-'+optionIndex);
  }
  report.paths.push({target,steps});
  if(allPublished&&target==='romance--palace--choice--secret--perspectives')await page.screenshot({path:out+'/all-published-palace-perspectives.png'});
  if(allPublished&&target==='romance--town--choice--warm--routes')await page.screenshot({path:out+'/all-published-town-choice-routes.png'});
  if(allPublished&&target==='monster--wild--collect--bright--route')await page.screenshot({path:out+'/all-published-monster-collection-route.png'});
  if(!allPublished&&(target==='romance--campus--talk--secret--routes'||target==='romance--campus--memory--bittersweet--routes'))await page.screenshot({path:out+'/structure-'+target+'.png'});
  await page.getByTestId('project-interview-cancel').click();
 }
 report.passed=report.generatedRequests===0&&report.errors.length===0&&report.paths.length===targets.length&&(!allPublished||(report.opening&&targets.length+1===report.published));
 if(!report.passed)throw Error('Unexpected generation request, incomplete path or browser error');
}finally{fs.writeFileSync(out+(allPublished?'/all-published-click-proof.json':'/reviewed-structures-click-proof.json'),JSON.stringify(report,null,2)+'\n');await browser.close();}
console.log(JSON.stringify({published:report.published,targets:targets.length,clicks:report.paths.reduce((sum,p)=>sum+p.steps.length,0),generatedRequests:report.generatedRequests,errors:report.errors,passed:report.passed}));
