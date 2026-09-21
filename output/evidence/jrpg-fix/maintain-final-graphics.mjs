import {chromium} from 'playwright';
import fs from 'node:fs';
import {loadLegacyDbEnvironment} from '../../../scripts/lib/legacyDb-database-ops.mjs';
const root=new URL('./',import.meta.url).pathname;
const out=root+(process.env.JRPG_RUN??'final-graphics')+'/';fs.mkdirSync(out,{recursive:true});
const browser=await chromium.connectOverCDP('http://127.0.0.1:19862');
const page=browser.contexts()[0].pages()[0];
// Owned server only; preserve production responses while avoiding host netlink cancellation.
await page.route('http://127.0.0.1:19861/**', async route => {
 if(route.request().method()!=='GET') return route.continue();
 try {
  const response=await fetch(route.request().url(),{headers:route.request().headers()});
  const headers=Object.fromEntries(response.headers);delete headers['content-encoding'];delete headers['content-length'];delete headers['transfer-encoding'];
  await route.fulfill({status:response.status,headers,body:Buffer.from(await response.arrayBuffer())});
 } catch { await route.abort(); }
});
const env=loadLegacyDbEnvironment();
await page.route(`${env.VITE_LEGACY_DB_URL}/**`,async route=>{
 const req=route.request();
 const headers={...req.headers()};delete headers.host;delete headers['content-length'];
 try {
  const response=await fetch(req.url(),{method:req.method(),headers,...(req.postDataBuffer()?{body:req.postDataBuffer()}:{} )});
  const resultHeaders=Object.fromEntries(response.headers);delete resultHeaders['content-encoding'];delete resultHeaders['content-length'];delete resultHeaders['transfer-encoding'];
  await route.fulfill({status:response.status,headers:resultHeaders,body:Buffer.from(await response.arrayBuffer())});
 }catch(error){ console.log('DB_TRANSPORT_ERROR',error.message);await route.abort(); }
});


const data=await page.evaluate(async()=>{
 const urls=performance.getEntriesByType('resource').map(e=>e.name);
 const store=window.__jrpgQaStore;
 if(!store?.isRemotePersistenceEnabled()||store.getProjectIdentity().id!=='oprn-399e312698')throw Error('wrong remote project');
 const applyUrl=urls.find(x=>/\/src\/editor\/tools\/applyChangesetToStore\.ts(?:\?|$)/.test(x));
 const {applyToolToStore,previewTool}=await import(applyUrl??'/src/editor/tools/applyChangesetToStore.ts');
 const {runTool}=await import('/src/editor/tools/toolRunner.ts');
 const current=store.getCurrent(),audit=[];
 const read=(name,args)=>{const r=runTool({project:store.getCurrent()},name,args);audit.push({name,args,result:r});if(!r.ok)throw Error(r.summary);return r.data;};
 read('get_project_summary',{});read('get_map_region',{mapId:current.startMapId,x:0,y:0,w:30,h:25});read('find_events',{mapId:current.startMapId});read('get_map_region',{mapId:'map_forest_dungeon',x:0,y:0,w:24,h:20});read('find_events',{mapId:'map_forest_dungeon'});
 const enemies=read('get_database_records',{collection:'enemies',include:'full',limit:500}).records;
 const scholar=read('list_npc_graphics',{query:'학자'}).matches[0];if(!scholar)throw Error('No queried scholar graphic');
 const {charsetGraphic}=await import('/src/editor/tools/eventCompile.ts');
 const map=store.getCurrent().maps.map_forest_dungeon;
 const sign=map.events.find(e=>e.id==='ev_dungeon_sign_intro'),boss=map.events.find(e=>e.id==='ev_forest_boss');
 const wolf=enemies.find(e=>e.id==='enemy_forest_wolf');if(!sign||!boss||!wolf)throw Error('Existing event or enemy missing');
 const check=previewTool('get_database_records',{collection:'enemies',ids:[wolf.id],include:'full'});if(!check.ok||JSON.stringify(check.data.records[0])!==JSON.stringify(wolf))throw Error('store mismatch');
 const pages=structuredClone(sign.pages);for(const p of pages){p.graphic=charsetGraphic(scholar.textureKey,scholar.characterIndex);for(const c of p.commands)if(c.kind==='text')c.speaker='숲길 조사원';}
 const bossPages=structuredClone(boss.pages);bossPages[0].name='숲 늑대 우두머리';bossPages[0].graphic={sprite:{id:wolf.monsterResourceId,type:'bundled'},direction:'down'};bossPages[1].name='토벌 완료';bossPages[1].commands=[{kind:'text',body:'숲 늑대 무리를 토벌했다. 이제 마을의 길드 안내소에 보고할 수 있다.'}];
 for(const event of [{id:sign.id,name:'숲길 조사원',pages},{id:boss.id,name:'숲 늑대 우두머리',pages:bossPages}]){const args={mapId:map.id,event};const result=applyToolToStore('upsert_event',args);audit.push({name:'upsert_event',args,result});if(!result.ok)throw Error(result.summary);}
 read('run_lint',{});
 const flush=await store.flush();return{project:store.getCurrent(),flush,identity:store.getProjectIdentity(),audit};
});
fs.writeFileSync(out+'result.json',JSON.stringify(data,null,2));fs.writeFileSync(out+'project.json',JSON.stringify(data.project,null,2));console.log('DONE',{kind:data.flush.kind,sha256:data.flush.sha256},data.audit.map(a=>[a.name,a.result.ok,a.result.summary]));await browser.close();
