import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { createServer } from 'node:net';
import { readFile, writeFile, cp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { firefox } from '@playwright/test';
import { armEventCommandObservation } from '../../../../scripts/lib/runtimeQaEventCommands.mjs';
const [mode,grep]=process.argv.slice(2);assert.ok(['editor','player'].includes(mode));
const out='.omo/evidence/event-command-remediation/U05';
const root=(await readFile(`${out}/owned-root.txt`,'utf8')).trim();assert.ok(root.startsWith('/tmp/event-command-u05-'));
const tag=process.env.U05_RUN_NAME??`${mode}-final`;
const probe=createServer();const listening=once(probe,'listening');probe.listen(0,'127.0.0.1');await listening;const port=probe.address().port;await new Promise((resolve,reject)=>probe.close(error=>error?reject(error):resolve()));
const url=`http://127.0.0.1:${port}`;const cache=join(root,`${tag}-cache`);
const env={...process.env,E2E_FREEZE_DEV_SERVER:'1',VITE_CACHE_DIR:cache,VITE_SUPABASE_URL:'',VITE_SUPABASE_ANON_KEY:'',VITE_SUPABASE_USE_PROXY:'0',U05_EDITOR_URL:url,U05_OWNED_ROOT:root,U05_FIXTURE:join(root,'fixtures/project.json'),U05_FIXTURE_DIR:join(root,'fixtures'),PLAYWRIGHT_JSON_OUTPUT_FILE:join(process.cwd(),out,`${tag}-report.json`)};
await writeFile(`${out}/${tag}-launch.json`,JSON.stringify({port,url,cache,grep:grep??null,workers:1,retries:0,normalNodeVite:true,freshContexts:true,outerChildDeadline:false,freeze:true,supabaseDisabled:true},null,2));
// Finish dependency prebundling before the browser's H0 readiness subscription starts.
// This is one process-completion barrier, not a test retry or elapsed-time wait.
const optimized=spawn(process.execPath,['node_modules/vite/bin/vite.js','optimize','--configLoader','runner',...(mode==='player'?['--config','vite.player-qa.config.ts']:[])],{env,stdio:'inherit'});
const [optimizeCode]=await once(optimized,'exit');assert.equal(optimizeCode,0,'Vite dependency preflight');
const server=spawn(process.execPath,['node_modules/vite/bin/vite.js','--host','127.0.0.1','--port',String(port),'--strictPort','--configLoader','runner',...(mode==='player'?['--config','vite.player-qa.config.ts']:[])],{env,stdio:['ignore','pipe','pipe']});
let code;
try{
 await new Promise((resolve,reject)=>{let output='';const timer=setTimeout(()=>reject(Error('Vite startup timeout')),120000);server.once('error',error=>{clearTimeout(timer);reject(error);});server.once('exit',(code,signal)=>{clearTimeout(timer);reject(Error(`Vite exit ${code}/${signal}`));});server.stdout.on('data',data=>{process.stdout.write(data);output+=data;if(output.includes(`${url}/`)){clearTimeout(timer);resolve();}});server.stderr.on('data',data=>process.stderr.write(data));});
 if(mode==='editor'){
  // Await the first complete module-graph load before starting fresh test contexts.
  const browser=await firefox.launch({headless:true});const context=await browser.newContext();const errors=[],pending=new Set(),writes=[],network=[];
  try{
   await context.route(url=>/(?:supabase|dbserver|\/rest\/v1|\/projects?(?:\/|$))/i.test(url.href),async route=>{
    if(!['GET','HEAD','OPTIONS'].includes(route.request().method())){writes.push(route.request().url());await route.abort('blockedbyclient');}else await route.continue();
   });
   const page=await context.newPage();page.on('pageerror',error=>errors.push(error.message));
   page.on('console',message=>{if(message.type()==='error')network.push({console:message.text()});});
   page.on('request',request=>pending.add(request.url()));page.on('requestfinished',request=>pending.delete(request.url()));page.on('requestfailed',request=>{pending.delete(request.url());network.push({url:request.url(),failure:request.failure()});});
   await page.addInitScript(seed=>{localStorage.clear();localStorage.setItem('oprn:editor-ui-mode','expert');window.__RPG_ZZU_E2E_PROJECT__=seed;},JSON.parse(await readFile(env.U05_FIXTURE,'utf8')));
   const ready={kind:'eventCommand',trigger:{kind:'none'},timeoutMs:300000,observe:[{source:'dom',selector:'[data-testid="edit-canvas"] canvas',read:'present',equals:true},{source:'dom',selector:'[data-testid="project-export-json"]',read:'present',equals:true}]};
   await page.addInitScript(`(${armEventCommandObservation.toString()})(${JSON.stringify(ready)});window.__eventCommandQa.start();`);
   await page.goto(url,{waitUntil:'load',timeout:300000});
   const trace=await page.evaluate(async()=>{window.__eventCommandQa.check();const result=await window.__eventCommandQa.result;window.__eventCommandQa.abort();delete window.__eventCommandQa;return result;});
   const documentState=await page.evaluate(()=>({url:location.href,readyState:document.readyState,scripts:[...document.scripts].map(script=>script.src),body:document.body.innerText.slice(0,2000)}));
   await writeFile(`${out}/${tag}-module-preflight.json`,JSON.stringify({trace,errors,pending:[...pending],writes,network,documentState},null,2));
   assert.equal(trace.status,'success');assert.deepEqual(errors,[]);assert.deepEqual(writes,[]);
  }finally{await context.close();await browser.close();}
 }
 const args=mode==='editor'?['node_modules/@playwright/test/cli.js','test','--config',`${out}/playwright.config.mts`,'--reporter=list,json',...(grep?['--grep',grep]:[])]:['scripts/qa/runtime/event-command-remediation-u05.scenario.mjs',url,root];
 const child=spawn(process.execPath,args,{env,stdio:'inherit'});
 const result=await once(child,'exit');code=result[0];
 if(mode==='editor')await cp(join(root,'playwright-output'),`${out}/${tag}-playwright-output`,{recursive:true});
 await writeFile(`${out}/${tag}-exit.json`,JSON.stringify({code,signal:result[1],artifactsRetainedBeforeCleanup:true},null,2));
}finally{
 if(server.exitCode===null&&server.signalCode===null){const done=once(server,'exit');server.kill('SIGTERM');await done;}
 await rm(cache,{recursive:true,force:true});
 await writeFile(`${out}/${tag}-cleanup.json`,JSON.stringify({port,serverExited:true,cacheRemoved:true},null,2));
}
process.exitCode=code??1;
