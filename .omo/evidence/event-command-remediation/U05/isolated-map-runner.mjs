import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { createServer } from 'node:net';
import { readFile, writeFile, cp, rm } from 'node:fs/promises';
import { join } from 'node:path';
const out='.omo/evidence/event-command-remediation/U05';
const root=(await readFile(`${out}/owned-root.txt`,'utf8')).trim();assert.ok(root.startsWith('/tmp/event-command-u05-'));
const probe=createServer();const listening=once(probe,'listening');probe.listen(0,'127.0.0.1');await listening;const port=probe.address().port;await new Promise((resolve,reject)=>probe.close(error=>error?reject(error):resolve()));
const url=`http://127.0.0.1:${port}`;const cache=join(root,'editor-cache');
const env={...process.env,E2E_FREEZE_DEV_SERVER:'1',VITE_CACHE_DIR:cache,VITE_SUPABASE_URL:'',VITE_SUPABASE_ANON_KEY:'',VITE_SUPABASE_USE_PROXY:'0',U05_EDITOR_URL:url,U05_OWNED_ROOT:root,U05_FIXTURE:join(root,'fixtures/project.json'),U05_FIXTURE_DIR:join(root,'fixtures'),PLAYWRIGHT_JSON_OUTPUT_FILE:join(process.cwd(),out,'editor-map-case-report.json')};
const server=spawn(process.execPath,['node_modules/vite/bin/vite.js','--host','127.0.0.1','--port',String(port),'--strictPort','--configLoader','runner'],{env,stdio:['ignore','pipe','pipe']});
let code;
try{
 await new Promise((resolve,reject)=>{let output='';const timer=setTimeout(()=>reject(Error('Vite startup timeout')),120000);server.once('error',error=>{clearTimeout(timer);reject(error);});server.once('exit',(code,signal)=>{clearTimeout(timer);reject(Error(`Vite exit ${code}/${signal}`));});server.stdout.on('data',data=>{process.stdout.write(data);output+=data;if(output.includes(`${url}/`)){clearTimeout(timer);resolve();}});server.stderr.on('data',data=>process.stderr.write(data));});
 await writeFile(`${out}/editor-map-case-launch.json`,JSON.stringify({port,url,cache,grep:'U05 map:',workers:1,retries:0,freshFirefox:true,outerChildDeadline:false},null,2));
 const child=spawn(process.execPath,['node_modules/@playwright/test/cli.js','test','--config',`${out}/playwright.config.mts`,'--grep','U05 map:','--reporter=list,json'],{env,stdio:'inherit'});
 const result=await once(child,'exit');code=result[0];
 await cp(join(root,'playwright-output'),`${out}/isolated-map-playwright-output`,{recursive:true});
 await writeFile(`${out}/editor-map-case-exit.json`,JSON.stringify({code,signal:result[1],failureArtifactsRetainedBeforeCleanup:true},null,2));
}finally{
 if(server.exitCode===null&&server.signalCode===null){const done=once(server,'exit');server.kill('SIGTERM');await done;}
 await rm(cache,{recursive:true,force:true});
 await writeFile(`${out}/editor-map-case-cleanup.json`,JSON.stringify({port,serverExited:true,cacheRemoved:true},null,2));
}
process.exitCode=code??1;
