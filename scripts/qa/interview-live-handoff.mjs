// Real packaged editor -> new folder -> SQLite -> live companion. Own QA host only.
import { firefox } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { gunzipSync } from 'node:zlib';
import { DatabaseSync } from 'node:sqlite';
const base = process.env.INTERVIEW_QA_HOST ?? 'http://127.0.0.1:9896';
const root = resolve(process.env.INTERVIEW_QA_PROJECT_ROOT ?? 'output/qa/interview-e2e/project');
const out = resolve('verify-shots/interview-live-handoff'); mkdirSync(out,{recursive:true});
const report = {base, root, requests:[],responses:[],errors:[], started:new Date().toISOString()};
const save=()=>writeFileSync(out+'/report.json',JSON.stringify(report,null,2)+'\n');
const b=await firefox.launch({firefoxUserPrefs:{'network.notify.changed':false,'network.notify.IPv6':false,'network.captive-portal-service.enabled':false,'network.connectivity-service.enabled':false}});const p=await b.newPage({viewport:{width:1440,height:900},reducedMotion:'reduce'});
p.on('pageerror',e=>{report.errors.push(e.message);save();});
p.on('request',r=>{if(!r.url().includes('/v1/agent/run')||r.method()!=='POST')return;try{const buffer=r.postDataBuffer();const body=JSON.parse(buffer?.[0]===31?gunzipSync(buffer):buffer);const task=String(body.task??'');report.requests.push({mode:body.mode,model:body.model,runId:body.runId,taskCharacters:task.length,internalTasks:task.includes('"id":"P03"'),protagonist:task.includes('지우'),pixelGate:task.includes('16'),scope:task.includes('첫 만남'),time:new Date().toISOString()});save();console.log('AI request',JSON.stringify(report.requests.at(-1)));}catch(e){report.errors.push(e.message);}});
p.on('response',r=>{if(r.url().includes('/v1/agent/run')){report.responses.push({status:r.status(),runId:r.headers()['x-oprn-run-id']??null});save();}});
const sqlite=()=>{const folder=new URL(report.newFolderUrl).searchParams.get('hostProject');if(!folder)throw Error('No active QA folder');const dir=resolve(root,'.oprn-projects',folder);const db=new DatabaseSync(dir+'/project.sqlite',{readOnly:true});const row=db.prepare('SELECT project_id,title,revision,current_json FROM project WHERE id=1').get();const project=JSON.parse(row.current_json);const maps=db.prepare('SELECT map_id,map_json FROM maps').all();const records=db.prepare('SELECT entries_json FROM ai_conversations').all();const commits=db.prepare("SELECT author_kind,tool_names_json,summary FROM commits WHERE tool_names_json != '[]' ORDER BY created_at").all();db.close();return {agentCommits:commits.map(c=>({author:c.author_kind,tools:JSON.parse(c.tool_names_json),summary:c.summary})),mapNames:maps.map(m=>JSON.parse(m.map_json).name),dir,projectId:row.project_id,title:row.title,revision:row.revision,genre:project.system.genre,brief:project.gameDesignBrief,maps:maps.length,events:maps.reduce((n,m)=>n+(JSON.parse(m.map_json).events?.length??0),0),conversations:records.map(r=>JSON.parse(r.entries_json).map(e=>({kind:e.kind,characters:JSON.stringify(e).length}))) };};
try{
 await p.goto(base+'/index.html?forceWelcome=1');await p.getByTestId('editor-welcome').waitFor({timeout:120000});await p.getByTestId('editor-welcome-skip').click();
 await p.locator('.studio-project-button').click();await p.getByTestId('menu-project-new').click();await p.getByTestId('new-project-name-input').fill('인터뷰 실동작 QA');await p.getByTestId('new-project-confirm').click();
 await p.getByTestId('project-interview').waitFor({timeout:30000});await p.getByTestId('project-interview-genre-romance').click();await p.getByTestId('project-interview-concept').fill('이웃과 첫 만남 한 장면. 맵 하나, 인물 둘, 짧은 대화와 두 가지 선택지만 제작한다.');await p.getByTestId('project-interview-begin').click();
 for(let i=0;i<5;i++){await p.getByTestId('project-interview-option-'+(i===0?2:0)).click();await p.getByTestId('project-interview-next').click();}
 await p.getByTestId('project-interview-protagonist').fill('지우. 외형은 정하지 않았으며 참고 이미지에서 추론하지 않는다.');await p.getByTestId('project-interview-summary').fill('지우가 이웃과 처음 만나는 관계·연애 게임. 첫 만남 한 장면만 만든다. 맵 하나, 인물 둘, 짧은 대화와 두 선택지. 외형은 미정이다.');
 await p.screenshot({path:out+'/confirmed-direction.png'});await p.getByTestId('project-interview-confirm').click();
 await p.waitForURL(url=>url.searchParams.has('hostProject'),{timeout:90000});report.newFolderUrl=p.url();console.log('new folder',report.newFolderUrl);await p.locator('.topbar').waitFor({timeout:120000});
 const until=Date.now()+12*60*1000;let ticks=0;
 while(Date.now()<until){await p.waitForTimeout(5000);const text=await p.getByTestId('ai-chat-log').innerText().catch(()=>'');report.chatTail=text.slice(-4000);report.elapsedSeconds=Math.round((Date.now()-Date.parse(report.started))/1000);try{report.sqlite=sqlite();}catch(e){report.sqliteReadError=e.message;}save();if(++ticks%6===0)console.log(JSON.stringify({seconds:report.elapsedSeconds,runs:report.requests.length,tail:report.chatTail.slice(-700)}));
 const running=await p.evaluate(()=>window.__oprnAiBridge?.status().turnBusy??true);if(report.requests.length&&!running&&text.length>80){report.finished=true;break;}if(process.env.INTERVIEW_QA_FULL!=='1'&&report.sqlite?.agentCommits?.length){report.firstApplicationVerified=true;break;}
 }
 await p.screenshot({path:out+'/assistant.png'});report.uiTaskLeak=(await p.getByTestId('ai-chat-log').innerText()).includes('"id":"P03"');report.audit=await p.evaluate(()=>window.__oprnAiBridge?.audit()??[]);report.piTeam=await p.evaluate(()=>JSON.parse(localStorage.getItem('oprn:ai-config')??'{}').piTeam??null);
 if(!report.finished) {report.stoppedForQa=true;await p.evaluate(()=>window.__oprnAiBridge?.abort());await p.waitForFunction(()=>window.__oprnAiBridge?.status().turnBusy===false,null,{timeout:30000}).catch(()=>{});await p.waitForTimeout(3000);}
 report.beforeReload=sqlite();await p.reload();await p.waitForFunction(()=>window.__oprnAiBridge?.status().ready,null,{timeout:180000});report.afterReload=sqlite();report.sameProjectAfterReload=report.beforeReload.projectId===report.afterReload.projectId;report.sameBriefAfterReload=JSON.stringify(report.beforeReload.brief)===JSON.stringify(report.afterReload.brief);report.passed=report.requests.some(r=>r.mode==='team'&&r.internalTasks&&r.protagonist&&r.scope)&&report.beforeReload.agentCommits.length>0&&!report.uiTaskLeak&&report.sameProjectAfterReload&&report.sameBriefAfterReload&&!report.chatTail.includes('stale-base')&&report.errors.length===0;await p.screenshot({path:out+'/reloaded.png'});
}catch(e){report.failure=e.message;await p.screenshot({path:out+'/failure.png'}).catch(()=>{});throw e;}finally{save();await b.close();}
console.log(JSON.stringify({finished:report.finished,sameProjectAfterReload:report.sameProjectAfterReload,sameBriefAfterReload:report.sameBriefAfterReload,errors:report.errors}));

process.exitCode=report.passed?0:1;
