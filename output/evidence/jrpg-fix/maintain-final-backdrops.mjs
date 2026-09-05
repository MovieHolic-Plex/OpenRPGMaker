import {chromium} from 'playwright';
import fs from 'node:fs';
import {loadSupabaseEnvironment} from '../../../scripts/lib/supabase-database-ops.mjs';
const root=new URL('./',import.meta.url).pathname;
const out=root+(process.env.JRPG_RUN??'final-backdrops')+'/';fs.mkdirSync(out,{recursive:true});
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
const env=loadSupabaseEnvironment();
await page.route(`${env.VITE_SUPABASE_URL}/**`,async route=>{
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
 const troops=read('get_database_records',{collection:'troops',include:'full',limit:500}).records;
 const match=read('list_resources',{kind:'backdrop',query:'숲'}).matches[0];if(!match?.id.startsWith('backdrop:'))throw Error('Queried forest backdrop missing');const backdropId=match.id.slice('backdrop:'.length);const source=troops.find(t=>t.id==='troop_forest_wolves');
 const targets=troops.filter(t=>t.id.startsWith('troop_forest_')&&t.previewBackgroundResourceId?.startsWith('generated-troop-preview'));
 const check=previewTool('get_database_records',{collection:'troops',ids:[source.id],include:'full'});if(!check.ok||JSON.stringify(check.data.records[0])!==JSON.stringify(source))throw Error('store mismatch');
 for(const target of targets){const args={troop:{id:target.id,previewBackgroundResourceId:backdropId}};const result=applyToolToStore('upsert_troop',args);audit.push({name:'upsert_troop',args,result});if(!result.ok)throw Error(result.summary);}
 read('run_lint',{});
 const flush=await store.flush();return{project:store.getCurrent(),flush,identity:store.getProjectIdentity(),audit};
});
fs.writeFileSync(out+'result.json',JSON.stringify(data,null,2));fs.writeFileSync(out+'project.json',JSON.stringify(data.project,null,2));console.log('DONE',{kind:data.flush.kind,sha256:data.flush.sha256},data.audit.map(a=>[a.name,a.result.ok,a.result.summary]));await browser.close();
