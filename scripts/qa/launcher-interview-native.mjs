// Native build, real companion, real SQLite. No mocked services or replacement art.
import { _electron } from 'playwright';
import fs from 'node:fs';
import { resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { gunzipSync } from 'node:zlib';
import assert from 'node:assert/strict';

const out=resolve(process.env.LAUNCHER_NATIVE_OUT??'output/qa/launcher-interview-flow/native');fs.mkdirSync(out,{recursive:true});
const root=resolve(out,'projects');
const report={actualElectron:true,mockedResponses:0,chapters:[],errors:[],requests:[],http:[]};
const save=()=>fs.writeFileSync(out+'/proof.json',JSON.stringify(report,null,2));
const folders=()=>fs.existsSync(root)?fs.readdirSync(root).filter(p=>fs.existsSync(resolve(root,p,'project.sqlite'))):[];
const app=await _electron.launch({args:[resolve('dist-electron/main.cjs'),'--no-sandbox','--disable-gpu','--disable-dev-shm-usage'],env:{...process.env,OPRN_RENDERER_DIR:resolve('dist'),OPRN_NEW_PROJECT_ROOT:root,XDG_CONFIG_HOME:fs.mkdtempSync(tmpdir()+'/oprn-launcher-plan-'),OPRN_OPEN_PROJECT_DIR:undefined},recordVideo:{dir:out,size:{width:1440,height:900}},timeout:120000});
let page,video,started=Date.now(),actualTask='';
const mark=label=>{report.chapters.push({label,at:(Date.now()-started)/1000});save();console.log(label);};
try {
 page=await app.firstWindow();video=page.video();page.setDefaultTimeout(90000);
 page.on('pageerror',e=>{report.errors.push(e.message);save();});
 page.on('request',r=>{if(new URL(r.url()).pathname.startsWith('/v1/')){report.http.push({path:new URL(r.url()).pathname,event:'request',at:(Date.now()-started)/1000});save();}});
 page.on('response',r=>{if(new URL(r.url()).pathname.startsWith('/v1/')){report.http.push({path:new URL(r.url()).pathname,event:'response',status:r.status(),at:(Date.now()-started)/1000});save();}});
 page.on('request',r=>{
  if(!r.url().includes('/v1/agent/run')||r.method()!=='POST')return;
  try {const raw=r.postDataBuffer();const body=JSON.parse(raw?.[0]===31?gunzipSync(raw):raw);actualTask=String(body.task??'');report.requests.push({taskCharacters:actualTask.length,model:body.model,at:(Date.now()-started)/1000});save();}catch{}
 });
 await page.getByTestId('start-screen').waitFor();started=Date.now();
 report.fullscreen=await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].isFullScreen());
 mark('전체 화면 영상으로 시작');await page.waitForTimeout(2000);
 await page.getByTestId('start-genre-option-story-cutscene').click();
 await page.getByTestId('start-create').click();
 await page.waitForTimeout(1500);await page.screenshot({path:out+'/after-start.png'});
 await page.getByTestId('project-interview').waitFor({timeout:45000});
 report.interviewUrl=page.url();report.foldersDuringInterview=folders();
 assert.match(page.url(),/start-screen\.html/);assert.equal(folders().length,0);
 mark('시작 화면에서 인터뷰 · 프로젝트 아직 없음');
 await page.screenshot({path:out+'/opening.png'});
 await page.waitForTimeout(2000);
 await page.getByTestId('project-interview-genre-romance').click();
 report.firstChoice=await page.locator('.ci-backdrop video').evaluate(v=>({hidden:v.hidden,paused:v.paused}));
 assert.ok(report.firstChoice.hidden&&report.firstChoice.paused);
 mark('선택하면 영상 종료 · 도트 장면 준비');
 const artUntil=Date.now()+45000;
 while(Date.now()<artUntil&&!['accepted','error'].includes(await page.locator('.cinematic-interview').getAttribute('data-art-state')))await page.waitForTimeout(500);
 report.artState=await page.locator('.cinematic-interview').getAttribute('data-art-state');
 await page.screenshot({path:out+'/choice.png'});save();
 await page.getByTestId('project-interview-cancel').click();assert.equal(folders().length,0);
 report.cancelCreatedNothing=true;
 mark('취소해도 빈 프로젝트를 만들지 않음');
 await page.getByTestId('start-create').click();await page.getByTestId('project-interview').waitFor();
 await page.getByTestId('project-interview-begin').click();
 for(let i=0;i<5;i++){
  await page.getByTestId('project-interview-option-'+(i%3)).click();await page.waitForTimeout(500);
  assert.match(page.url(),/start-screen\.html/);assert.equal(folders().length,0);
  mark(`인터뷰 ${i+1}/5 · 같은 화면에서 선택`);
  await page.getByTestId('project-interview-next').click();
 }
 await page.screenshot({path:out+'/summary.png'});
 report.beforeConfirm={url:page.url(),folders:folders()};report.passedPlanning=true;
 mark('기획 확인 · 여기까지 프로젝트를 열지 않음');await page.waitForTimeout(2500);
 await page.getByTestId('project-interview-confirm').click();
 mark('마지막 만들기 후 폴더 생성·편집기 준비');
 const until=Date.now()+180000;
 while(Date.now()<until&&!report.requests.length)await page.waitForTimeout(1000);
 if(!report.requests.length)throw Error('Confirmed plan saved/AI handoff has not been observed');
 await page.evaluate(()=>window.__oprnAiBridge?.abort());await page.waitForTimeout(1500);
 const loaded=await page.evaluate(async()=>{const status=await window.oprn.project.status();const result=await window.oprn.project.load({projectDir:status.projectDir});const project=result?JSON.parse(result.serialized):null;return {status,revision:result?.revision,sha256:result?.sha256,brief:project?.gameDesignBrief};});
 fs.writeFileSync(out+'/canonical-load.json',JSON.stringify(loaded,null,2));
 report.canonicalReload={projectId:loaded.status.projectId,projectDir:loaded.status.projectDir,revision:loaded.revision,answers:Object.keys(loaded.brief?.answers??{}).length};
 report.transmittedAnswers=Object.values(loaded.brief?.answers??{}).map(a=>({label:a.label,presentInActualRequest:actualTask.includes(a.text)}));
 assert.equal(report.canonicalReload.answers,5);assert.ok(report.transmittedAnswers.every(a=>a.presentInActualRequest));
 report.passedHandoff=true;mark('실제 AI 요청 관찰 · 정본 재로드');
 await page.screenshot({path:out+'/handoff.png'});
}catch(e){report.failure=String(e);await page?.screenshot({path:out+'/failure.png'}).catch(()=>{});console.log(report.failure);}
finally{report.duration=(Date.now()-started)/1000;save();await app.close();if(video){report.rawVideo=await video.path();save();}console.log(JSON.stringify(report));if(report.failure)process.exitCode=1;}
