// Actual packaged editor assistant, live application and its own SQLite project.
import {firefox} from 'playwright';
import {gunzipSync} from 'node:zlib';
import {execFileSync} from 'node:child_process';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import {createHash} from 'node:crypto';
const folder=resolve('.vite-cache/terrain-ai-edit/editor-project'),out=resolve('verify-shots/terrain-ai-edit/editor');mkdirSync(out,{recursive:true});
const snapshot=()=>{const db=new DatabaseSync(resolve(folder,'project.sqlite'),{readOnly:true});try{
 const p=db.prepare('SELECT project_id,revision FROM project WHERE id=1').get();
 const maps=db.prepare('SELECT map_id,map_json FROM maps').all();
 return{...p,sha:Object.fromEntries(maps.map(m=>[m.map_id,createHash('sha256').update(m.map_json).digest('hex')])),map:JSON.parse(maps.find(m=>m.map_id==='houses_native').map_json)};
}finally{db.close();}};
const browser=await firefox.launch({firefoxUserPrefs:{'network.notify.changed':false,'network.notify.IPv6':false,'network.captive-portal-service.enabled':false,'network.connectivity-service.enabled':false}});
const context=await browser.newContext({viewport:{width:1440,height:960},recordVideo:{dir:resolve('.vite-cache/terrain-ai-edit/raw-video'),size:{width:1440,height:960}}}),videoStart=Date.now(),page=await context.newPage();let captureStart;
const caption=async text=>{console.log(text);await page.evaluate(text=>{let c=document.getElementById('terrain-film-caption');if(!c){c=document.createElement('div');c.id='terrain-film-caption';Object.assign(c.style,{position:'fixed',left:'16px',bottom:'16px',zIndex:'2147483647',background:'#1c242e',color:'#fff',padding:'9px 12px',borderRadius:'8px',font:'600 17px system-ui',pointerEvents:'none'});document.body.append(c);}c.textContent=text;},text);await page.waitForTimeout(700);};
const proof={realPackagedEditor:true,realModel:true,uiIntentRequestExercised:true,canonicalStore:folder,requests:[],errors:[]};let videoEnd;
page.on('pageerror',e=>proof.errors.push(e.message));
page.on('request',r=>{if(r.method()==='POST'&&/\/v1\/(chat\/completions|agent\/run)/.test(r.url())){
 const request={endpoint:new URL(r.url()).pathname,provider:r.headers()['x-oprn-provider']};
 try{const bytes=r.postDataBuffer(),b=JSON.parse(bytes?.[0]===31?gunzipSync(bytes):bytes);request.model=b.model;}catch{}proof.requests.push(request);}});
await page.addInitScript(()=>{
 // The isolated browser uses the product's authenticated default model, single assistant.
 localStorage.setItem('oprn:ai-config',JSON.stringify({configVersion:2,piTeam:false,piApply:'default',piApplyPolicyVersion:1}));
 window.__terrainQaEvents=[];const original=window.fetch;
 window.fetch=async function(...args){const response=await original.apply(this,args);
  if(String(args[0]).includes('/v1/agent/run')&&response.body){const reader=response.clone().body.getReader(),decoder=new TextDecoder();let buffer='';
   void(async()=>{try{for(;;){const {done,value}=await reader.read();if(done)break;buffer+=decoder.decode(value,{stream:true});const lines=buffer.split('\n');buffer=lines.pop();for(const line of lines){try{const e=JSON.parse(line.replace(/^data: /,'')),v=e.type==='agent_event'?e.event:e;
    if(['assistant','tool_start','tool_end','error','execution_status'].includes(v.type))window.__terrainQaEvents.push(v);
   }catch{}}}}catch{}})();
  }return response;};
});
const shot=n=>page.screenshot({path:resolve(out,`${n}.png`)});
const save=()=>writeFileSync(resolve(out,'observations.json'),JSON.stringify(proof,null,2));
try{
 const before=snapshot();console.log('SQLite fixture ready');proof.before={projectId:before.project_id,revision:before.revision,sha:before.sha};save();
 await page.goto('http://127.0.0.1:9854/',{waitUntil:'domcontentloaded',timeout:120000});
 if(await page.locator('#access-code').count()){
  await page.locator('#access-code').fill(readFileSync(resolve(folder,'.oprn-host-access'),'utf8').trim());
  await Promise.all([page.waitForNavigation({waitUntil:'domcontentloaded',timeout:120000}),page.locator('form[action="/__oprn/login"] button').click()]);
 }
 console.log('Editor loaded');await page.getByTestId('boot-loader').waitFor({state:'hidden',timeout:240000});
 await page.waitForFunction(()=>window.__oprnAiBridge?.status().ready,null,{timeout:120000});
 const welcome=page.getByTestId('editor-welcome-skip');if(await welcome.isVisible().catch(()=>false))await welcome.click();
 await page.getByTestId('sidebar-map-switcher').click();await page.getByTestId('map-tree-node-houses_native').click();
 const close=page.getByTestId('sidebar-maps-close');if(await close.isVisible().catch(()=>false))await close.click();
 await page.getByTestId('layer-upper').click();await page.getByTestId('editor-zoom-stepper').click();await page.getByTestId('editor-zoom-0.5').click();await page.waitForTimeout(800);
 proof.indexedDb=await page.evaluate(async()=>{const db=await new Promise((res,rej)=>{const r=indexedDB.open('oprn-ai-records');r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error);});try{
  if(!db.objectStoreNames.contains('conversations'))return{conversations:0,userEntries:0};
  return await new Promise((res,rej)=>{const r=db.transaction('conversations','readonly').objectStore('conversations').getAll();r.onsuccess=()=>res({conversations:r.result.length,userEntries:r.result.reduce((n,c)=>n+(c.entries??[]).filter(e=>e.kind==='user').length,0)});r.onerror=()=>rej(r.error);});
 }finally{db.close();}});
 console.log('Editor and IndexedDB ready');await shot('01-before');proof.task=readFileSync(resolve('.vite-cache/terrain-ai-edit/task.txt'),'utf8');
 captureStart=(Date.now()-videoStart)/1000;await caption('실제 에디터 조수 · 기존 능선 / 지붕 / 길 수정');
 console.log('Sending through native input');await page.getByTestId('ai-input').fill(proof.task);await page.getByTestId('ai-send').click();
 console.log('Native request sent');let seen=0;const deadline=Date.now()+360000;
 while(true){
  await page.waitForTimeout(2000);proof.events=await page.evaluate(()=>window.__terrainQaEvents);proof.audit=await page.evaluate(()=>window.__oprnAiBridge.audit());save();
  for(const event of proof.events.slice(seen))if(event.type==='tool_end'){console.log(`${event.ok?'OK':'FAIL'} ${event.name}: ${event.summary}`);if(['design_terrain','resize_terrain_house_roof','lay_terrain_road','check_terrain_access'].includes(event.name))await caption(`${event.name} · ${event.summary}`);}
  seen=proof.events.length;const status=await page.evaluate(()=>window.__oprnAiBridge.status());proof.status=status;if(!status.turnBusy&&proof.requests.some(r=>r.endpoint==='/v1/agent/run')&&proof.events.some(e=>e.type==='assistant'||e.type==='error'))break;if(Date.now()>deadline){await page.evaluate(()=>window.__oprnAiBridge.abort());throw Error('Actual editor assistant timed out');}
 }
 proof.result={ok:!proof.events.some(e=>e.type==='error')&&proof.events.some(e=>e.type==='assistant'),lastAssistantText:proof.events.filter(e=>e.type==='assistant').at(-1)?.text};proof.events=await page.evaluate(()=>window.__terrainQaEvents);proof.audit=await page.evaluate(()=>window.__oprnAiBridge.audit());
 if(!proof.result.ok)throw Error(proof.result.error??'Actual editor assistant failed');
 let applied;
 for(let i=0;i<100;i++){applied=snapshot();const ridge=applied.map.terrainDesign?.features?.find(f=>f.tool==='ridge'),road=applied.map.terrainDesign?.features?.find(f=>f.tool==='road'&&f.points[0].x===24&&f.points[0].y===54),house=applied.map.structurePlacements?.find(p=>p.kitId==='quick_house_beodeul-manor-a_9_2_roof15x3');if(ridge?.options.width===7&&road?.options.width===3&&house)break;await page.waitForTimeout(250);}
 if(!applied.map.structurePlacements.some(p=>p.kitId==='quick_house_beodeul-manor-a_9_2_roof15x3'))throw Error('Roof edit not saved');
 const trace=proof.events.filter(e=>e.type==='tool_end').map(e=>({name:e.name,args:proof.events.find(s=>s.type==='tool_start'&&s.id===e.id)?.args,ok:e.ok,summary:e.summary}));writeFileSync(resolve(out,'trace.json'),JSON.stringify(trace,null,2));
 await shot('02-assistant-applied');await caption('세 수정 적용 · 원본 집 세 채와 절벽 경사로 보존');proof.applied={revision:applied.revision,sha:applied.sha};
 if(applied.sha.houses_native===before.sha.houses_native)throw Error('No assistant edits saved');
 await page.reload({waitUntil:'domcontentloaded',timeout:120000});await page.getByTestId('boot-loader').waitFor({state:'hidden',timeout:240000});
 await page.waitForFunction(()=>window.__oprnAiBridge?.status().ready,null,{timeout:120000});
 await page.getByTestId('editor-zoom-stepper').click();await page.getByTestId('editor-zoom-0.5').click();await page.waitForTimeout(800);
 await caption('SQLite 저장 후 다시 열기 · 수정된 지형 유지');await shot('03-reloaded');
 const after=snapshot();proof.after={projectId:after.project_id,revision:after.revision,sha:after.sha};
 proof.reloadMapEqual=JSON.stringify(applied.map)===JSON.stringify(after.map);
 proof.unrelatedMapsUnchanged=Object.keys(before.sha).filter(id=>id!=='houses_native').every(id=>before.sha[id]===after.sha[id]);
 videoEnd=(Date.now()-videoStart)/1000;
 proof.passed=proof.reloadMapEqual&&proof.unrelatedMapsUnchanged&&proof.errors.length===0;
 if(!proof.passed)throw Error('Editor application/reload failed');
}catch(e){proof.failure=e.message;await shot('failure').catch(()=>{});throw e;}
finally{videoEnd??=(Date.now()-videoStart)/1000;save();await context.close();await browser.close();if(captureStart!==undefined){const raw=await page.video().path();execFileSync('ffmpeg',['-hide_banner','-loglevel','error','-y','-ss',String(captureStart),'-i',raw,'-t',String(videoEnd-captureStart),'-vf','setpts=0.5*PTS,fps=20','-c:v','libx264','-threads','2','-crf','20','-pix_fmt','yuv420p','-movflags','+faststart',resolve(out,'terrain-ai-edit-2x.mp4')],{stdio:'inherit'});proof.recording={realBrowserVideo:true,browser:'Firefox',speed:2,trimmedLogin:true,sourceSeconds:videoEnd-captureStart};save();}}
console.log(JSON.stringify({passed:proof.passed,result:proof.result,revision:proof.after?.revision,errors:proof.errors}));
