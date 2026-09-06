import {spawnSync,execFileSync} from 'node:child_process';
import {writeFile,rm} from 'node:fs/promises';
import {dirname,join} from 'node:path';
import {fileURLToPath} from 'node:url';
const out=dirname(fileURLToPath(import.meta.url));
const [head,tree]=execFileSync('git',['rev-parse','HEAD','HEAD^{tree}'],{encoding:'utf8'}).trim().split('\n');
if(head!=='9cb85be84746d84789497a1d4297d0c8416d86c8')throw new Error('Unexpected HEAD');
for(const [stage,seconds,command] of [['typecheck',300,['npm','run','typecheck:app']],['build',600,['npm','run','build']]]) {
 const args=['--timeout','900','/tmp/rpg-zzu-life-full-qa-01a0727b.lock','timeout','--signal=TERM','--kill-after=15s',String(seconds)+'s',...command];
 console.log('PARENT7_START '+stage);
 const started=new Date().toISOString();
 const r=spawnSync('flock',args,{encoding:'utf8',maxBuffer:64*1024*1024,env:{...process.env,VITE_CACHE_DIR:join(out,'build-cache')}});
 await writeFile(join(out,stage+'.json'),JSON.stringify({head,tree,command:['flock',...args],started,finished:new Date().toISOString(),exit:r.status,signal:r.signal,stdout:r.stdout??'',stderr:r.stderr??''},null,2)+'\n',{flag:'wx'});
 console.log('PARENT7_END '+stage+' exit='+r.status);
 if(r.status!==0){process.exitCode=r.status??1;break;}
}
await rm(join(out,'build-cache'),{recursive:true,force:true});
