// Live editor + live provider. No model response interception. Dedicated remote row only.
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import { createHash } from 'node:crypto';
const out = '/home/main/village-contract-live'; fs.mkdirSync(out, { recursive: true });
const env = Object.fromEntries(fs.readFileSync('.env.local','utf8').split('\n').filter(l=>l.includes('=')&&!l.startsWith('#')).map(l=>{ const i=l.indexOf('=');return [l.slice(0,i),l.slice(i+1).trim().replace(/^['"]|['"]$/g,'')]; }));
const projectId = 'village-contract-live-20260921-414a';
async function remote(method, body) {
 const url = `${env.VITE_SUPABASE_URL}/rest/v1/projects?${method==='GET'?`project_id=eq.${projectId}&select=current_json,current_sha256`:'on_conflict=project_id'}`;
 const r=await fetch(url,{method,headers:{apikey:env.VITE_SUPABASE_ANON_KEY,Authorization:`Bearer ${env.VITE_SUPABASE_ANON_KEY}`,'Content-Type':'application/json','Accept-Profile':'rpg_zzu','Content-Profile':'rpg_zzu',Prefer:'resolution=merge-duplicates,return=representation'},...(body?{body:JSON.stringify(body)}:{})});
 if(!r.ok)throw new Error(`DB ${r.status}: ${(await r.text()).slice(0,250)}`);return r.json();
}
async function save(p) {const sha=createHash('sha256').update(JSON.stringify(p)).digest('hex');await remote('POST',{project_id:projectId,title:p.title??'조수 마을 계약 실험',schema_version:p.schemaVersion??p.version??1,current_json:p,current_sha256:sha,map_count:Object.keys(p.maps).length,tileset_count:Object.keys(p.tilesets).length,terrain_template_count:0});const [row]=await remote('GET'); if(row.current_sha256!==sha || JSON.stringify(row.current_json.maps)!==JSON.stringify(p.maps)) { // JSONB reorders keys; hash + stable value comparison below
 const normalize=v=>v&&typeof v==='object'?Array.isArray(v)?v.map(normalize):Object.fromEntries(Object.entries(v).sort(([a],[b])=>a.localeCompare(b)).map(([k,x])=>[k,normalize(x)])):v;
 if(row.current_sha256!==sha||JSON.stringify(normalize(row.current_json))!==JSON.stringify(normalize(p)))throw new Error('DB reload mismatch');
 } return {project:row.current_json,sha};}
const browser=await chromium.launch({headless:true,executablePath:'/home/main/.cache/ms-playwright/chromium-1234/chrome-linux64/chrome',args:['--no-sandbox']});
const page=await browser.newPage({viewport:{width:1600,height:1100}});
page.setDefaultTimeout(120000);const errors=[],requests=[],runs=[];
page.on('pageerror',e=>{errors.push(e.message);console.log('PAGEERROR',e.message.slice(0,200));});
page.on('request',r=>{if(r.url().includes('/v1/agent/run')){const b=r.postDataJSON();requests.push({contract:b.villageContract,task:b.task,readOnly:b.readOnly,provider:b.provider,model:b.model});console.log('RUN',JSON.stringify({contract:b.villageContract,readOnly:b.readOnly,provider:b.provider,model:b.model}));}});
page.on('response',async r=>{if(r.url().includes('/v1/agent/run')){try{const body=await r.text();fs.writeFileSync(`${out}/run-${runs.length}.ndjson`,body);runs.push(body);console.log('RUN FINISHED',body.length);}catch(e){console.log('response read',e.message);}}});
page.on('dialog',d=>d.accept());

await page.addInitScript(()=>{localStorage.setItem('oprn:editor-ui-mode','standard');localStorage.setItem('oprn:standard-welcome-seen','1');localStorage.setItem('oprn:coachmarks-basic-v1','1');localStorage.setItem('oprn:editor-welcome-dismissed','1');localStorage.setItem('oprn:ai-config',JSON.stringify({piTeam:false,piApply:'default',piApplyPolicyVersion:1,providerId:'google-antigravity',model:'gemini-3.7-flash',liteModel:'gemini-3.7-flash',autonomyLevel:'balanced'}));});
try {
 await page.goto('http://127.0.0.1:9839/?blankProject=1&aiBridge=1',{waitUntil:'domcontentloaded'});
 const guest=page.getByTestId('login-guest');await page.getByTestId('ai-input').or(guest).first().waitFor();if(await guest.isVisible())await guest.click();
 await page.getByTestId('ai-input').waitFor();
 const baseline=await page.evaluate(async()=>{const {store}=await import('/src/project/store.ts');return store.getCurrent();});
 await save(baseline);fs.writeFileSync(`${out}/baseline.json`,JSON.stringify(baseline));console.log('BASELINE SAVED',projectId);
 await page.screenshot({path:`${out}/before.png`,animations:'disabled',timeout:10000});
 const prompt='집 4채와 주민 3명이 사는 작은 마을을 지어라. 집으로 이어지는 길과 나무, 작은 광장이 있고, 주민마다 이 마을에 어울리는 서로 다른 대사를 넣어줘.';
 await page.getByTestId('ai-input').fill(prompt);await page.getByTestId('ai-send').click();console.log('SENT',prompt);
 const started=Date.now();
 while(Date.now()-started<600000){await page.waitForTimeout(3000);const status=await page.evaluate(()=>window.__oprnAiBridge?.status());fs.writeFileSync(`${out}/status.json`,JSON.stringify(status??null));if(Date.now()-started>15000 && !status?.turnBusy)break;}
 await page.screenshot({path:`${out}/editor-after.png`});
 const final=await page.evaluate(async()=>{const {store}=await import('/src/project/store.ts');return store.getCurrent();});
 fs.writeFileSync(`${out}/project.json`,JSON.stringify(final));const saved=await save(final);fs.writeFileSync(`${out}/reloaded.json`,JSON.stringify(saved.project));
 fs.writeFileSync(`${out}/report.json`,JSON.stringify({projectId,prompt,requests,errors,sha:saved.sha,remoteReloadVerified:true,maps:Object.values(final.maps).map(m=>({id:m.id,name:m.name,width:m.width,height:m.height,events:m.events.length}))},null,2));
 console.log('SAVED AND RELOADED',projectId,JSON.stringify(Object.values(final.maps).map(m=>({id:m.id,name:m.name,events:m.events.length}))));
} catch(error) { await page.screenshot({path:`${out}/failure.png`,timeout:10000}).catch(()=>{}); throw error; } finally {await browser.close();}
