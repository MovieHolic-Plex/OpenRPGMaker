// Real SQLite project and real editor chat. No response stubs or in-memory map replacement.
import { firefox } from 'playwright';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { gunzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import { PNG } from 'pngjs';
const folder = resolve(process.env.TERRAIN_AI_PROJECT ?? '.vite-cache/terrain-ai/fixed-project');
const out = resolve(process.env.TERRAIN_AI_OUTPUT ?? 'verify-shots/terrain-assistant-live/editor');
mkdirSync(out, { recursive: true });
// The live first-game harness also uses Firefox for full editor assistant runs.
const browser = await firefox.launch({firefoxUserPrefs:{'network.notify.changed':false,'network.notify.IPv6':false,'network.captive-portal-service.enabled':false,'network.connectivity-service.enabled':false}});
const page = await browser.newPage({ viewport: { width: 1440, height: 960 } }), errors = [], proof = { realEditor: true, realModel: true, folder, requests: [] };
page.setDefaultTimeout(30000);
const sqlite = () => { const db = new DatabaseSync(resolve(folder, 'project.sqlite'), {readOnly:true}); try {
  const p=db.prepare('SELECT project_id,revision FROM project WHERE id=1').get();
  const map=JSON.parse(db.prepare('SELECT map_json FROM maps WHERE map_id=?').get('terrain_ai').map_json);
  return {...p,map,conversations:db.prepare('SELECT COUNT(*) AS n FROM ai_conversations').get().n};
}finally{db.close();}};
const save = () => writeFileSync(resolve(out,'observations.json'),JSON.stringify(proof,null,2));
page.on('pageerror',e=>{errors.push(e.message);console.log('pageerror',e.message);});
page.on('crash',()=>{proof.failure='Editor browser renderer crashed';save();console.log(proof.failure);});
page.on('console',m=>{if(m.type()==='error')console.log('browser-error',m.text().slice(0,300));});
page.on('request',r=>{if(r.method()!=='POST'||!r.url().includes('/v1/'))return;
  console.log('request',r.method(),r.url());
  if(!/\/(chat\/completions|agent\/run)/.test(r.url()))return;
  try { const bytes=r.postDataBuffer(),body=JSON.parse(bytes?.[0]===31?gunzipSync(bytes):bytes),images=[];
    for(const message of body.messages??[])for(const part of Array.isArray(message.content)?message.content:[]){const url=part.image_url?.url;
      if(typeof url!=='string'||!url.startsWith('data:image/png;base64,'))continue;
      const png=Buffer.from(url.slice(url.indexOf(',')+1),'base64'),decoded=PNG.sync.read(png),sha256=createHash('sha256').update(png).digest('hex');
      const file=`model-image-${sha256.slice(0,12)}.png`;writeFileSync(resolve(out,file),png);images.push({file,sha256,width:decoded.width,height:decoded.height});
    }
    proof.requests.push({endpoint:new URL(r.url()).pathname,model:body.model,provider:r.headers()['x-oprn-provider'],stream:body.stream===true,images});
  }catch(e){proof.requestObservationError=e.message;}
});
await page.addInitScript(() => {
  // Isolated QA browser; production provider defaults and authentication are unchanged.
  try { localStorage.setItem('oprn:ai-config', JSON.stringify({configVersion:2, piTeam:false})); } catch {}
  window.__terrainQaEvents=[];
  const original=window.fetch;
  window.fetch=async function(...args){const response=await original.apply(this,args);
    if(String(args[0]).includes('/v1/agent/run')&&response.body){const reader=response.clone().body.getReader(),decoder=new TextDecoder();let buffer='';
      void(async()=>{try{for(;;){const {done,value}=await reader.read();if(done)break;buffer+=decoder.decode(value,{stream:true});const lines=buffer.split('\n');buffer=lines.pop();for(const line of lines){try{const e=JSON.parse(line.replace(/^data: /,'')),v=e.type==='agent_event'?e.event:e;
        if(['assistant','tool_start','tool_end','error','execution_status'].includes(v.type))window.__terrainQaEvents.push(v);
      }catch{}}}}catch{}})();
    }return response;};
});
try {
  proof.before=sqlite();
  await page.goto(process.env.TERRAIN_AI_URL??'http://127.0.0.1:9844/',{waitUntil:'domcontentloaded',timeout:120000});
  if(await page.locator('#access-code').count()){
    await page.locator('#access-code').fill(readFileSync(resolve(folder,'.oprn-host-access'),'utf8').trim());
    await Promise.all([page.waitForNavigation({waitUntil:'domcontentloaded',timeout:120000}),page.locator('form[action="/__oprn/login"] button').click()]);
  }
  await page.getByTestId('boot-loader').waitFor({state:'hidden',timeout:240000});
  await page.waitForFunction(()=>window.__oprnAiBridge?.status().ready,null,{timeout:120000});
  const modal=page.getByTestId('editor-welcome-skip');if(await modal.isVisible().catch(()=>false))await modal.click();
  proof.status=await page.evaluate(()=>window.__oprnAiBridge.status());
  proof.indexedDbBefore=await page.evaluate(async()=>{const db=await new Promise((resolve,reject)=>{const r=indexedDB.open('oprn-ai-records');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});try{if(!db.objectStoreNames.contains('conversations'))return [];return await new Promise((resolve,reject)=>{const r=db.transaction('conversations','readonly').objectStore('conversations').getAll();r.onsuccess=()=>resolve(r.result.map(c=>({id:c.id,users:c.entries?.filter(e=>e.kind==='user')})));r.onerror=()=>reject(r.error);});}finally{db.close();}});
  console.log('SQLite editor loaded',proof.before.project_id,JSON.stringify(proof.status));
  await page.getByTestId('layer-upper').click();
  await page.getByTestId('editor-zoom-stepper').click();await page.getByTestId('editor-zoom-0.5').click();await page.waitForTimeout(1000);
  await page.screenshot({path:resolve(out,'01-ai-created-cliffs.png')});
  console.log('Terrain overview captured');
  const task='현재 terrain_ai 맵을 읽기만 해서 검수해. 버들항 집 세 채가 실제 고지 위에 있고 집터와 문 앞 높이가 모두 평평한지, (4,42)에서 세 집 문 앞 칸 자체까지 실제 이동 가능한지 검사해. 경사로와 계단 수, 시야 차단 설정도 확인하고, show_map_region으로 절벽과 경사로가 포함된 실제 높이 그림을 보고 결과를 알려줘. 맵이나 다른 설정은 수정하지 마.';
  proof.task=task;
  await page.evaluate(text=>{setTimeout(()=>{window.__terrainQaPromise=window.__oprnAiBridge.send(text).then(r=>{window.__terrainQaResult=r;return r;});},0);},task);
  console.log('Actual editor assistant requested');
  const deadline=Date.now()+360000;
  for(;;){await page.waitForTimeout(4000);console.log('Polling actual editor');const s=await page.evaluate(()=>window.__oprnAiBridge.status());
    proof.events=await page.evaluate(()=>window.__terrainQaEvents);proof.audit=await page.evaluate(()=>window.__oprnAiBridge.audit());proof.status=s;save();
    console.log('inspection',JSON.stringify(s),'events',proof.events.length);
    if(!s.turnBusy&&(proof.events.length||proof.audit.some(e=>e.kind==='assistant')))break;
    if(Date.now()>deadline){await page.evaluate(()=>window.__oprnAiBridge.abort());throw new Error('Editor assistant inspection exceeded six minutes');}
  }
  proof.audit=await page.evaluate(()=>window.__oprnAiBridge.audit());
  proof.chat=await page.getByTestId('ai-chat-log').innerText();
  await page.screenshot({path:resolve(out,'02-real-assistant-inspection.png')});
  // Runtime movement has a separate real Chromium screencast at 2× speed.
  await page.reload({waitUntil:'domcontentloaded'});await page.getByTestId('boot-loader').waitFor({state:'hidden',timeout:240000});
  proof.after=sqlite();proof.reloadMapEqual=JSON.stringify(proof.before.map)===JSON.stringify(proof.after.map);
  proof.errors=errors;
  proof.passed=proof.reloadMapEqual&&errors.length===0&&proof.requests.length>0&&['inspect_terrain','check_terrain_access','show_map_region'].every(name=>proof.audit.some(e=>e.kind==='tool'&&e.ok&&e.name===name));
  delete proof.before.map;delete proof.after.map;
  if(!proof.passed)throw new Error('Actual editor inspection or SQLite reload failed');
}catch(e){proof.failure=e.message;await page.screenshot({path:resolve(out,'failure.png')}).catch(()=>{});throw e;}finally{save();await browser.close();}
console.log(JSON.stringify({passed:proof.passed,errors,events:proof.events.length,projectId:proof.after.project_id}));
