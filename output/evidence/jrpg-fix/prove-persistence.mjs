import {chromium} from 'playwright';
import fs from 'node:fs';
import {loadSupabaseEnvironment} from '../../../scripts/lib/supabase-database-ops.mjs';
const root=new URL('./',import.meta.url).pathname;
const out=root+(process.env.JRPG_RUN??'final')+'/';fs.mkdirSync(out,{recursive:true});
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


const before=await page.evaluate(async()=>{const store=window.__jrpgQaStore;if(!store||store.getProjectIdentity().id!=='oprn-399e312698'||!store.isRemotePersistenceEnabled())throw Error('Wrong project or persistence disabled');return{identity:store.getProjectIdentity(),flush:await store.flush(),project:store.getCurrent()};});
const response=await fetch(env.VITE_SUPABASE_URL+'/rest/v1/projects?project_id=eq.oprn-399e312698&select=project_id,current_json,updated_at',{headers:{apikey:env.VITE_SUPABASE_ANON_KEY,Authorization:'Bearer '+env.VITE_SUPABASE_ANON_KEY,'Accept-Profile':'rpg_zzu'}});
if(!response.ok)throw Error('remote reload '+response.status);const rows=await response.json();if(rows.length!==1)throw Error('Missing remote row');
const proof=await page.evaluate(async({before,remote})=>{
 const {deserialize,serialize}=await import('/src/project/io.ts');
 const stable=v=>Array.isArray(v)?v.map(stable):v&&typeof v==='object'?Object.fromEntries(Object.entries(v).sort(([a],[b])=>a.localeCompare(b)).map(([k,x])=>[k,stable(x)])):v;
 const canonical=p=>JSON.stringify(stable(deserialize(serialize(p))));
 const sha=async s=>[...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s)))].map(b=>b.toString(16).padStart(2,'0')).join('');
 const saved=canonical(before);const loaded=canonical(remote);
 const store=window.__jrpgQaStore;const reload=await store.reloadFromRemote();const reloaded=canonical(store.getCurrent());
 const {runTool}=await import('/src/editor/tools/toolRunner.ts');const lint=runTool({project:store.getCurrent()},'run_lint',{});
 return{reload,identity:store.getProjectIdentity(),hashes:{browserBefore:await sha(saved),remote:await sha(loaded),browserReload:await sha(reloaded)},match:saved===loaded&&loaded===reloaded,lint,project:store.getCurrent()};
},{before:before.project,remote:rows[0].current_json});
fs.writeFileSync(out+'remote-after.json',JSON.stringify(rows,null,2));fs.writeFileSync(out+'project.json',JSON.stringify(proof.project,null,2));delete proof.project;
fs.writeFileSync(out+'persistence.json',JSON.stringify({httpStatus:response.status,updatedAt:rows[0].updated_at,flush:{kind:before.flush.kind,sha256:before.flush.sha256},...proof},null,2));console.log(JSON.stringify({httpStatus:response.status,flush:{kind:before.flush.kind,sha256:before.flush.sha256},...proof,lint:proof.lint.data.counts}));
if(!proof.match||before.flush.kind!=='saved')throw Error('Persistence proof failed');await browser.close();
