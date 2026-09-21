import {chromium} from 'playwright';
import fs from 'node:fs';
import {loadLegacyDbEnvironment} from '../../../scripts/lib/legacyDb-database-ops.mjs';
const root=new URL('./',import.meta.url).pathname;
const out=root+(process.env.JRPG_RUN??'final-content')+'/';fs.mkdirSync(out,{recursive:true});
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
 const records=read('get_database_records',{collection:'items',include:'full',limit:500}).records;
 const targets=records.filter(i=>['item_forest_herb','item_forest_dew'].includes(i.id));
 const sources=[records.find(i=>i.id==='item_herb_green'),records.find(i=>i.id==='item_gen2_life_dew')];
 const sameStore=previewTool('get_database_records',{collection:'items',ids:targets.map(t=>t.id),include:'full'});
 if(!sameStore.ok||JSON.stringify(sameStore.data.records)!==JSON.stringify(targets))throw Error('apply module has different store');
 for(const t of targets){const source=sources[t.id.endsWith('_herb')?0:1];if(!source?.imageResourceId||!source?.iconResourceId)throw Error('No queried image source');const args={item:{id:t.id,imageResourceId:source.imageResourceId,iconResourceId:source.iconResourceId},reason:'시각 QA에서 누락된 아이템 그림을 조회한 실존 리소스로 보완'};const r=applyToolToStore('upsert_item',args);audit.push({name:'upsert_item',args,result:r});if(!r.ok)throw Error(r.summary);}
 const map=store.getCurrent().maps.map_forest_dungeon;
 const chest=map.events.find(e=>e.id==='ev_dungeon_chest_east');if(!chest)throw Error('Queried chest missing');
 const {canMove}=await import('/src/project/collision.ts');
 if(!canMove(store.getCurrent(),map,20,7,20,6))throw Error('Proposed chest bank is blocked');
 const args={mapId:map.id,event:{id:chest.id,x:20,y:6}};const result=applyToolToStore('upsert_event',args);audit.push({name:'upsert_event',args,result});if(!result.ok)throw Error(result.summary);
 read('run_lint',{});
 const flush=await store.flush();return{project:store.getCurrent(),flush,identity:store.getProjectIdentity(),audit};
});
fs.writeFileSync(out+'result.json',JSON.stringify(data,null,2));fs.writeFileSync(out+'project.json',JSON.stringify(data.project,null,2));console.log('DONE',{kind:data.flush.kind,sha256:data.flush.sha256},data.audit.map(a=>[a.name,a.result.ok,a.result.summary]));await browser.close();
