// Real packaged editor -> new folder -> SQLite -> live companion. Own QA host only.
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { gunzipSync } from 'node:zlib';
import { DatabaseSync } from 'node:sqlite';
const base = process.env.INTERVIEW_QA_HOST ?? 'http://127.0.0.1:9898';
const root = resolve(process.env.INTERVIEW_QA_PROJECT_ROOT ?? 'output/qa/romance-scene/project');
const out = resolve(process.env.ROMANCE_QA_OUT ?? 'verify-shots/romance-scene-live'); mkdirSync(out,{recursive:true});
const report = {base, root, requests:[],responses:[],errors:[], started:new Date().toISOString()};
const save=()=>writeFileSync(out+'/report.json',JSON.stringify(report,null,2)+'\n');
const saveWireEvidence = wire => {
 writeFileSync(out+'/provider-events.json',JSON.stringify(wire,null,2));
 const seen=new Set();
 const prompts=wire.filter(e=>{const inner=e.type==='agent_event'?e.event:e;const role=e.agentId??'single';if(inner.type!=='prompt_inspection'||seen.has(role))return false;seen.add(role);return true;});
 writeFileSync(out+'/provider-prompts.json',JSON.stringify(prompts,null,2));
};
const b=await chromium.launch({args:['--disable-dev-shm-usage','--use-gl=swiftshader','--disable-gpu','--no-sandbox','--js-flags=--max-old-space-size=16384']});const p=await b.newPage({viewport:{width:1440,height:900},reducedMotion:'reduce'});
p.setDefaultTimeout(120000);
p.on('pageerror',e=>{report.errors.push(e.message);save();});
p.on('request',r=>{if(!r.url().includes('/v1/agent/run')||r.method()!=='POST')return;try{const buffer=r.postDataBuffer();const body=JSON.parse(buffer?.[0]===31?gunzipSync(buffer):buffer);const task=String(body.task??'');writeFileSync(out+'/sent-task.txt',task);writeFileSync(out+'/sent-brief.json',JSON.stringify(body.project?.gameDesignBrief??null,null,2));report.requests.push({mode:body.mode,model:body.model,runId:body.runId,taskCharacters:task.length,internalTasks:task.includes('"id":"P03"'),protagonist:task.includes('지우'),pixelGate:task.includes('16'),scope:task.includes('첫 만남'),time:new Date().toISOString()});save();console.log('AI request',JSON.stringify(report.requests.at(-1)));}catch(e){report.errors.push(e.message);}});
p.on('response',r=>{if(r.url().includes('/v1/agent/run')){report.responses.push({status:r.status(),runId:r.headers()['x-oprn-run-id']??null});save();}});
await p.addInitScript(() => {
 window.__qaWireEvents=[];
 const original=window.fetch;
 window.fetch=async function(...args){
  const response=await original.apply(this,args);
  if(String(args[0]).includes('/v1/agent/run') && response.body){
   const reader=response.clone().body.getReader();const decoder=new TextDecoder();let buffer='';
   void (async()=>{try{for(;;){const {done,value}=await reader.read();if(done)break;buffer+=decoder.decode(value,{stream:true});const lines=buffer.split('\n');buffer=lines.pop();for(const line of lines){try{const e=JSON.parse(line.replace(/^data: /,''));const inner=e.type==='agent_event'?e.event:e;if(['prompt_inspection','assistant','tool_start','tool_end','agent_spawn','agent_done','execution_status','review','error'].includes(inner.type))window.__qaWireEvents.push(e);}catch{}}}}catch{}})();
  }
  return response;
 };
});
const sqlite=()=>{const folder=new URL(report.newFolderUrl).searchParams.get('hostProject');if(!folder)throw Error('No active QA folder');const dir=resolve(root,'.oprn-projects',folder);const db=new DatabaseSync(dir+'/project.sqlite',{readOnly:true});const row=db.prepare('SELECT project_id,title,revision,current_json FROM project WHERE id=1').get();const project=JSON.parse(row.current_json);const maps=db.prepare('SELECT map_id,map_json FROM maps').all();const records=db.prepare('SELECT entries_json FROM ai_conversations').all();const commits=db.prepare("SELECT author_kind,tool_names_json,summary FROM commits WHERE tool_names_json != '[]' ORDER BY created_at").all();db.close();return {agentCommits:commits.map(c=>({author:c.author_kind,tools:JSON.parse(c.tool_names_json),summary:c.summary})),mapNames:maps.map(m=>JSON.parse(m.map_json).name),mapContent:maps.map(m=>{const v=JSON.parse(m.map_json);return {id:v.id,name:v.name,events:v.events};}),hero:project.database?.actors?.find(a=>a.id==='actor_hero')?.name,dir,projectId:row.project_id,title:row.title,revision:row.revision,genre:project.system.genre,brief:project.gameDesignBrief,maps:maps.length,events:maps.reduce((n,m)=>n+(JSON.parse(m.map_json).events?.length??0),0),conversations:records.map(r=>JSON.parse(r.entries_json).map(e=>({kind:e.kind,characters:JSON.stringify(e).length}))) };};
const diagnosticTimer=setInterval(()=>{void p.screenshot({path:out+'/current.png'}).catch(()=>{});void p.locator('body').innerText({timeout:1000}).then(t=>writeFileSync(out+'/current-ui.txt',t)).catch(()=>{});},15000);
try{
 await p.goto(base+'/index.html?forceWelcome=1',{waitUntil:'domcontentloaded',timeout:120000});console.log('page loaded');await p.getByTestId('editor-welcome').waitFor({timeout:120000});await p.getByTestId('editor-welcome-skip').click({noWaitAfter:true});
 await p.locator('.studio-project-button').click({noWaitAfter:true});await p.getByTestId('menu-project-new').click({noWaitAfter:true});await p.getByTestId('new-project-name-input').fill('첫 만남 실행 하네스 QA');await p.getByTestId('new-project-confirm').click({noWaitAfter:true});
 await p.getByTestId('project-interview').waitFor({timeout:30000});await p.getByTestId('project-interview-genre-romance').click({noWaitAfter:true});await p.getByTestId('project-interview-concept').fill('이웃과 첫 만남 한 장면. 맵 하나, 인물 둘, 짧은 대화와 두 가지 선택지만 제작한다.');await p.getByTestId('project-interview-begin').click({noWaitAfter:true});
 for(let i=0;i<5;i++){await p.getByTestId('project-interview-option-'+(i===0?2:0)).click({noWaitAfter:true});await p.getByTestId('project-interview-next').click({noWaitAfter:true});await p.waitForTimeout(250);}
 await p.getByTestId('project-interview-protagonist').fill('지우. 외형은 정하지 않았으며 참고 이미지에서 추론하지 않는다.');await p.getByTestId('project-interview-notes').fill('검증용 고유 설정: 이웃 이름은 나래, 만나는 장소는 별빛 우체국 앞. 두 선택지는 반갑게 인사한다 / 편지를 물어본다.');await p.getByTestId('project-interview-summary').fill('지우가 이웃과 처음 만나는 관계·연애 게임. 첫 만남 한 장면만 만든다. 맵 하나, 인물 둘, 짧은 대화와 두 선택지. 외형은 미정이다. 이웃 나래와 별빛 우체국 앞에서 만나고, 선택지는 반갑게 인사한다 / 편지를 물어본다.');
 await p.screenshot({path:out+'/confirmed-direction.png'});await p.setViewportSize({width:360,height:800});await p.screenshot({path:out+'/confirmed-mobile.png'});await p.setViewportSize({width:1440,height:900});await p.getByTestId('project-interview-confirm').click({noWaitAfter:true});
 await p.waitForURL(url=>url.searchParams.has('hostProject'),{timeout:180000,waitUntil:'domcontentloaded'});report.newFolderUrl=p.url();console.log('new folder',report.newFolderUrl);await p.locator('.topbar').waitFor({timeout:120000});
 const until=Date.now()+14*60*1000;let ticks=0;
 while(Date.now()<until){await p.waitForTimeout(5000);const text=await p.getByTestId('ai-chat-log').innerText().catch(()=>'');report.chatTail=text.slice(-6000);const wire=await p.evaluate(()=>window.__qaWireEvents??[]);saveWireEvidence(wire);report.wireCount=wire.length;if(wire.length&&!report.wireScreenshot){await p.screenshot({path:out+'/live-sending.png'});report.wireScreenshot=true;}report.elapsedSeconds=Math.round((Date.now()-Date.parse(report.started))/1000);try{report.sqlite=sqlite();}catch(e){report.sqliteReadError=e.message;}save();if(++ticks%6===0)console.log(JSON.stringify({seconds:report.elapsedSeconds,runs:report.requests.length,tail:report.chatTail.slice(-700)}));
 const running=await p.evaluate(()=>window.__oprnAiBridge?.status().turnBusy??true);if(report.requests.length&&!running&&text.length>80){report.finished=true;break;}
 }
 await p.screenshot({path:out+'/assistant.png'});report.uiTaskLeak=(await p.getByTestId('ai-chat-log').innerText()).includes('"id":"P03"');report.audit=await p.evaluate(()=>window.__oprnAiBridge?.audit()??[]);report.piTeam=await p.evaluate(()=>JSON.parse(localStorage.getItem('oprn:ai-config')??'{}').piTeam??null);
 if(!report.finished) {report.stoppedForQa=true;await p.evaluate(()=>window.__oprnAiBridge?.abort());await p.waitForFunction(()=>window.__oprnAiBridge?.status().turnBusy===false,null,{timeout:30000}).catch(()=>{});await p.waitForTimeout(3000);}
 report.indexedDb=await p.evaluate(async()=>{const db=await new Promise((resolve,reject)=>{const r=indexedDB.open('oprn-ai-records');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});try{return await new Promise((resolve,reject)=>{const r=db.transaction('conversations','readonly').objectStore('conversations').getAll();r.onsuccess=()=>resolve(r.result.map(x=>({id:x.id,entries:x.entries?.filter(e=>e.kind==='user')})));r.onerror=()=>reject(r.error);});}finally{db.close();}}).catch(e=>({error:e.message}));report.beforeReload=sqlite();await p.reload();await p.waitForFunction(()=>window.__oprnAiBridge?.status().ready,null,{timeout:180000});await p.locator('#oprn-boot-loader').waitFor({state:'detached',timeout:180000});report.afterReload=sqlite();report.sameProjectAfterReload=report.beforeReload.projectId===report.afterReload.projectId;report.sameBriefAfterReload=JSON.stringify(report.beforeReload.brief)===JSON.stringify(report.afterReload.brief);report.authored=report.beforeReload.mapContent.some(m=>m.events.some(e=>e.id==='ev_romance_partner'&&e.pages?.[0]?.id==='ev_romance_partner_first'));report.passed=report.authored&&report.finished&&report.requests.some(r=>r.mode==='team'&&r.internalTasks&&r.protagonist&&r.scope)&&report.beforeReload.agentCommits.length>0&&!report.uiTaskLeak&&report.sameProjectAfterReload&&report.sameBriefAfterReload&&!report.chatTail.includes('stale-base')&&report.errors.length===0;await p.screenshot({path:out+'/reloaded.png'});
}catch(e){report.failure=e.message;await p.screenshot({path:out+'/failure.png'}).catch(()=>{});throw e;}finally{clearInterval(diagnosticTimer);save();await b.close();}
console.log(JSON.stringify({finished:report.finished,sameProjectAfterReload:report.sameProjectAfterReload,sameBriefAfterReload:report.sameBriefAfterReload,errors:report.errors}));

process.exitCode=report.passed?0:1;
