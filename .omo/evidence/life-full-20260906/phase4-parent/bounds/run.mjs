import {spawnSync,execFileSync} from 'node:child_process';
import {writeFile,lstat,rm} from 'node:fs/promises';
import {dirname,join} from 'node:path';
import {fileURLToPath} from 'node:url';
const out=dirname(fileURLToPath(import.meta.url));
const head=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
if(head!=='e486e536954d69c59c7bcc82602646cc6712c445')throw Error('Unexpected bounds HEAD');
const previousDist=await lstat('dist').catch(e=>{if(e.code==='ENOENT')return null;throw e;});
if(previousDist)throw Error('Preexisting dist must not be removed');
await (await import('node:fs/promises')).mkdir(join(out,'native'),{recursive:true});
const selected=JSON.parse(process.argv[2]);
const test=(files)=>['node','scripts/run-vitest.mjs','run','--configLoader','runner','--config',join(out,'vitest.config.mjs'),...files];
const jobs=[['diagnostics',300,['node',join(out,'diagnostics.mjs')]],['required',300,test(['test/lifeAuthoringBounds.test.ts'])],['related',300,test(selected)],['editor',600,['node',join(out,'editor.mjs')]],['player',300,['node',join(out,'player.mjs')]],['typecheck',300,['npm','run','typecheck:app']],['build',600,['npm','run','build']]];
let failed=false;
try{for(const [name,budget,command]of jobs){
 console.log('PARENT_BOUNDS_START '+name);const started=new Date().toISOString();
 const args=['--timeout','900','/tmp/rpg-zzu-life-full-qa-01a0727b.lock','timeout','--signal=TERM','--kill-after=15s',budget+'s',...command];
 const r=spawnSync('flock',args,{encoding:'utf8',maxBuffer:64*1024*1024,env:{...process.env,E2E_FREEZE_DEV_SERVER:'1',VITE_CACHE_DIR:join(out,'build-cache')}});
 await writeFile(join(out,name+'.json'),JSON.stringify({head,command:['flock',...args],started,finished:new Date().toISOString(),exit:r.status,signal:r.signal,stdout:r.stdout??'',stderr:r.stderr??''},null,2)+'\n',{flag:'wx'});
 console.log('PARENT_BOUNDS_END '+name+' exit='+r.status);if(r.status!==0){failed=true;if(name!=='build')break;}
}}finally{
 await rm('dist',{recursive:true,force:true});await rm(join(out,'build-cache'),{recursive:true,force:true});await rm(join(out,'test-cache'),{recursive:true,force:true});
 await writeFile(join(out,'cleanup.json'),JSON.stringify({head,ownedDistAbsentAtEntry:true,ownedDistRemoved:true,ownedCachesRemoved:true,sourceDiff:execFileSync('git',['diff','--name-only','--','src','test'],{encoding:'utf8'}),finished:new Date().toISOString()},null,2)+'\n',{flag:'wx'});
 console.log('PARENT_BOUNDS_CLEANUP complete');
}
process.exitCode=failed?1:0;
