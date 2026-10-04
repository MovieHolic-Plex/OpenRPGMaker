// Record the actual built desktop app. No mocked images, model responses or UI.
import {_electron} from 'playwright';
import fs from 'node:fs';
import {resolve} from 'node:path';
import {tmpdir} from 'node:os';
import {gunzipSync} from 'node:zlib';

const out=resolve(process.env.MAKER_VIDEO_OUT??'output/qa/maker-flow-video');
fs.mkdirSync(out,{recursive:true});
const report={actualElectron:true,mockedResponses:0,typedAnswers:0,chapters:[],waits:[],requests:[],errors:[]};
const save=()=>fs.writeFileSync(out+'/proof.json',JSON.stringify(report,null,2));
let started;let page;let video;
const mark=label=>{const at=(Date.now()-started)/1000;report.chapters.push({label,at});save();console.log(JSON.stringify({label,at}));};
const app=await _electron.launch({args:[resolve('dist-electron/main.cjs'),'--no-sandbox','--disable-gpu','--disable-dev-shm-usage'],env:{...process.env,OPRN_RENDERER_DIR:resolve('dist'),OPRN_NEW_PROJECT_ROOT:resolve(out,'projects'),XDG_CONFIG_HOME:fs.mkdtempSync(tmpdir()+'/oprn-video-'),OPRN_OPEN_PROJECT_DIR:undefined},recordVideo:{dir:out,size:{width:1440,height:900}},timeout:120000});
try{
 page=await app.firstWindow();video=page.video();started=Date.now();page.setDefaultTimeout(120000);
 page.on('pageerror',e=>{report.errors.push(e.message);save();});
 page.on('request',request=>{
  if(!request.url().includes('/v1/agent/run')||request.method()!=='POST')return;
  try{const raw=request.postDataBuffer();const body=JSON.parse(raw?.[0]===31?gunzipSync(raw):raw);report.requests.push({model:body.model,mode:body.mode,taskCharacters:String(body.task??'').length,at:(Date.now()-started)/1000});save();}catch{}
 });
 await app.context().addInitScript(()=>{
  document.addEventListener('pointerdown',event=>{const n=document.createElement('div');Object.assign(n.style,{position:'fixed',left:(event.clientX-18)+'px',top:(event.clientY-18)+'px',width:'36px',height:'36px',border:'3px solid #ffce74',borderRadius:'50%',pointerEvents:'none',zIndex:'20000',boxShadow:'0 0 0 3px #101a2990'});document.body.append(n);setTimeout(()=>n.remove(),600);},true);
 });
 const click=async id=>{const target=page.getByTestId(id);await target.scrollIntoViewIfNeeded();const box=await target.boundingBox();await page.mouse.move(box.x+box.width/2,box.y+box.height/2,{steps:15});await page.waitForTimeout(250);await target.click();await page.waitForTimeout(1100);};
 const waitFor=async(label,operation)=>{const at=(Date.now()-started)/1000;await operation();report.waits.push({label,from:at,to:(Date.now()-started)/1000});save();};
 await page.getByTestId('start-screen').waitFor();report.startup=await app.evaluate(({BrowserWindow})=>({fullscreen:BrowserWindow.getAllWindows()[0].isFullScreen(),bounds:BrowserWindow.getAllWindows()[0].getBounds()}));mark('앱 실행 · 전체화면');await page.waitForTimeout(3000);
 // No concept, title or protagonist is typed; the actual native launcher submits.
 await click('start-genre-option-story-cutscene');mark('장르 선택 · 입력 없이 시작');await click('start-create');
 await waitFor('편집기와 인터뷰 준비',()=>page.getByTestId('project-interview').waitFor({timeout:180000}));
 report.emptyIdeaHandoff=true;mark('새 게임 인터뷰');await click('project-interview-genre-romance');
 const observeArt=async label=>{
  await waitFor(label,async()=>{
   const until=Date.now()+240000;let last;
   while(Date.now()<until){const state=await page.locator('.cinematic-interview').getAttribute('data-art-state');if(state!==last){console.log(JSON.stringify({art:state,elapsed:(Date.now()-started)/1000}));last=state;}if(['accepted','error'].includes(state)){report.artStates??=[];report.artStates.push({label,state});return;}await page.waitForTimeout(1000);}
   report.artStates??=[];report.artStates.push({label,state:'still-generating'});
  });
  await page.waitForTimeout(3500);
 };
 await observeArt('첫 그림 생성·검수 대기');mark(report.artStates.at(-1).state==='accepted'?'선택에 맞춘 도트 장면':'그림 생성 실패 · 질문은 진행 가능');await click('project-interview-begin');
 for(let step=0;step<5;step++){
  const question=await page.locator('#project-interview-title').innerText();mark(question);
  await page.waitForTimeout(1800);await click('project-interview-option-'+(step===0?2:0));
  if(step===0)await observeArt('답변 반영 그림 생성·검수 대기');
  await page.waitForTimeout(1800);await click('project-interview-next');
 }
 mark('기획 확인 · 내부 실행 지침은 조수에게 전달');await page.waitForTimeout(4000);await click('project-interview-confirm');
 await waitFor('기획 저장·AI 준비',async()=>{const until=Date.now()+180000;while(Date.now()<until&&!report.requests.length)await page.waitForTimeout(1000);if(!report.requests.length)throw Error('Actual AI request was not observed');});
 mark('AI 조수로 자동 전달 · 제작 시작');await page.waitForTimeout(20000);
 report.project=await page.evaluate(()=>window.oprn.project.status());
 report.recordingEnd=(Date.now()-started)/1000;report.demonstrationEndsAt='actual-generation-started';report.passed=!!report.startup.fullscreen&&report.emptyIdeaHandoff&&report.requests.length>0;save();
 await page.screenshot({path:out+'/handoff.png'});
 // This demo is deliberately not a completion claim; stop its owned AI turn.
 await page.evaluate(()=>window.__oprnAiBridge?.abort());await page.waitForTimeout(1500);
 const loaded=await page.evaluate(async()=>{const s=await window.oprn.project.status();const r=await window.oprn.project.load({projectDir:s.projectDir});return {projectId:s.projectId,projectDir:s.projectDir,revision:r?.revision,sha256:r?.sha256};});report.canonicalReload=loaded;
}catch(error){report.failure=String(error);report.recordingEnd=(Date.now()-started)/1000;await page?.screenshot({path:out+'/failure.png'}).catch(()=>{});throw error;}
finally{save();await app.close();if(video){const path=await video.path();report.rawVideo=path;save();console.log(JSON.stringify({rawVideo:path,passed:report.passed,artStates:report.artStates,requests:report.requests,failure:report.failure}));}}
