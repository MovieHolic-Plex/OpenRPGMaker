// Real production image generation + real vision delivery gate. No game-content writes.
import { chromium } from 'playwright';
import fs from 'node:fs';
import {resolve} from 'node:path';
const base=process.env.MAKER_UI_URL??'http://127.0.0.1:9812',out=resolve('verify-shots/maker-click-first/live-art');fs.mkdirSync(out,{recursive:true});
const browser=await chromium.launch({args:['--no-sandbox','--disable-dev-shm-usage']});
const report={realProvider:true,projectWrites:0,requests:[],responses:[],errors:[]};
const save=()=>fs.writeFileSync(out+'/proof.json',JSON.stringify(report,null,2));
try{
const p=await browser.newPage({viewport:{width:1440,height:900},reducedMotion:'reduce'});
p.on('request',r=>{if(!r.url().includes('/v1/')||r.method()!=='POST')return;const b=r.postDataJSON();report.requests.push({kind:r.url().includes('images/generations')?'image':'vision',model:b.model,characters:JSON.stringify(b).length});save();});
p.on('response',async r=>{if(!r.url().includes('/v1/')||r.request().method()!=='POST')return;const image=r.url().includes('images/generations');report.responses.push({kind:image?'image':'vision',status:r.status()});if(image){try{const b=await r.json();if(b.image?.dataUrl)fs.writeFileSync(out+'/candidate-'+report.responses.filter(x=>x.kind==='image').length+'.png',Buffer.from(b.image.dataUrl.split(',')[1],'base64'));}catch{}}else{try{const b=await r.json();report.verdicts??=[];report.verdicts.push({imageDelivery:b.image_delivery,finish:b.choices?.[0]?.finish_reason,text:b.choices?.[0]?.message?.content});}catch{}}save();});
p.on('pageerror',e=>{report.errors.push(e.message);save();});
await p.goto(base+'/start-screen.html');
await p.evaluate(async()=>{document.querySelector('#start-app')?.remove();const {showProjectInterview}=await import('/src/editor/ui/projectInterviewDialog.ts');void showProjectInterview('story-cutscene',{initialAnswer:'달빛 아래의 꽃 정원. 길을 따라 꽃과 나무 사이의 작은 연못을 만나는 고요한 첫 풍경. 인물은 아직 정하지 않았다.'});});
await p.getByTestId('project-interview-genre-romance').click();
await p.waitForFunction(()=>['accepted','error'].includes(document.querySelector('.cinematic-interview')?.dataset.artState),null,{timeout:720000});
report.artState=await p.locator('.cinematic-interview').getAttribute('data-art-state');
report.buttonsEnabled=await p.getByTestId('project-interview-begin').isEnabled();
if(report.artState==='accepted'){const data=await p.locator('.ci-backdrop img.is-visible').getAttribute('src');fs.writeFileSync(out+'/accepted.png',Buffer.from(data.split(',')[1],'base64'));}
await p.screenshot({path:out+'/actual-interview.png'});
report.passed=report.artState==='accepted'&&report.buttonsEnabled&&report.responses.some(r=>r.kind==='image'&&r.status===200)&&report.responses.some(r=>r.kind==='vision'&&r.status===200);
await p.getByTestId('project-interview-cancel').click();
}finally{save();await browser.close();}
console.log(JSON.stringify({passed:report.passed,artState:report.artState,requests:report.requests,responses:report.responses,errors:report.errors}));process.exitCode=report.passed?0:1;
