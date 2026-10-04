// Synthetic transport responses exercise the real generation gate, not art quality.
import { chromium } from 'playwright';
import fs from 'node:fs';
import {resolve} from 'node:path';
const out=resolve('verify-shots/maker-click-first');fs.mkdirSync(out,{recursive:true});
const b=await chromium.launch({args:['--no-sandbox']});const p=await b.newPage();
const cases=[];
try{
await p.goto('http://127.0.0.1:9812/start-screen.html');
await p.evaluate(async()=>{window.__art=await import('/src/editor/interviewSceneGeneration.ts');});
const png=await p.evaluate(()=>{const c=document.createElement('canvas');c.width=640;c.height=360;c.getContext('2d').fillRect(0,0,640,360);return c.toDataURL();});
let generated=0, reviewed=0, mode='retry-pass';
await p.route('**/v1/images/generations',r=>{generated++;return r.fulfill({status:200,contentType:'application/json',body:JSON.stringify({image:{dataUrl:png,mimeType:'image/png'}})});});
await p.route('**/v1/chat/completions',r=>{
 reviewed++;const fail=mode==='budget-exhausted'||(mode==='retry-pass'&&reviewed===1);
 const checks={pixelGrid:!fail,limitedPalette:true,composition:true,matchesChoices:true,identity:true,noText:true};
 return r.fulfill({status:200,contentType:'application/json',body:JSON.stringify({choices:[{finish_reason:'stop',message:{role:'assistant',content:JSON.stringify({checks,findings:fail?['pixelGrid: smooth art must be redrawn']:[]})}}],image_delivery:mode==='no-receipt'?[]:[{messageIndex:1,partIndex:1}]})});
});
for(mode of ['retry-pass','budget-exhausted','no-receipt']){
 generated=0;reviewed=0;
 const result=await p.evaluate(async()=>{try{await window.__art.generateInterviewScene('QA synthetic',new AbortController().signal,()=>{});return {accepted:true};}catch(e){return {accepted:false,error:e.message};}});
 cases.push({mode,generated,reviewed,...result});
 if(mode==='retry-pass'&&(!result.accepted||generated!==2))throw Error('Failed redraw-to-pass');
 if(mode==='budget-exhausted'&&(result.accepted||generated!==3))throw Error('Failed bounded rejection');
 if(mode==='no-receipt'&&(result.accepted||generated!==1))throw Error('Failed actual image receipt guard');
}
const malformed=await p.evaluate(()=>{try{window.__art.parseInterviewArtVerdict('{"checks":{"pixelGrid":true},"findings":[]}');return false;}catch{return true;}});
if(!malformed)throw Error('Malformed verdict accepted');
// A provider may finish an obsolete request after a new click or dialog close.
mode='race';const pending=[];
await p.unroute('**/v1/images/generations');
await p.route('**/v1/images/generations',r=>{pending.push(r);});
const nextPng=await p.evaluate(()=>{const c=document.createElement('canvas');c.width=640;c.height=360;const g=c.getContext('2d');g.fillStyle='blue';g.fillRect(0,0,640,360);return c.toDataURL();});
const begin=()=>p.evaluate(async()=>{document.querySelector('#start-app')?.remove();const {showProjectInterview}=await import('/src/editor/ui/projectInterviewDialog.ts');void showProjectInterview('story-cutscene');});
await begin();
const waitPending=async count=>{for(let i=0;i<80&&pending.length<count;i++)await p.waitForTimeout(50);if(pending.length<count)throw Error('Request not observed');};
const fulfill=async(route,data)=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({image:{dataUrl:data,mimeType:'image/png'}})}).catch(()=>{});
await waitPending(1);await p.getByTestId('project-interview-genre-monster').click();await waitPending(2);
await fulfill(pending[1],nextPng);
await p.waitForFunction(()=>document.querySelector('.cinematic-interview')?.dataset.artState==='accepted');
await fulfill(pending[0],png);await p.waitForTimeout(200);
const latestWins=await p.locator('.ci-backdrop img.is-visible').getAttribute('src')===nextPng;
if(!latestWins)throw Error('Stale image replaced latest choice');
await p.getByTestId('project-interview-genre-romance').click();await waitPending(3);
await p.getByTestId('project-interview-cancel').click();await fulfill(pending[2],png);await p.waitForTimeout(200);
const closeCancels=await p.getByTestId('project-interview').count()===0;
if(!closeCancels)throw Error('Closed dialog resurrected');
fs.writeFileSync(out+'/art-contract-proof.json',JSON.stringify({synthetic:true,cases,malformedRejected:malformed,latestWins,closeCancels,passed:true},null,2));
}finally{await b.close();}
console.log(JSON.stringify(cases));
