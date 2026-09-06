import {spawnSync,execFileSync} from 'node:child_process';
import {writeFile,rm} from 'node:fs/promises';
import {dirname,join} from 'node:path';
import {fileURLToPath} from 'node:url';
const out=dirname(fileURLToPath(import.meta.url));
const [head,tree]=execFileSync('git',['rev-parse','HEAD','HEAD^{tree}'],{encoding:'utf8'}).trim().split('\n');
if(head!=='bbaf9464cad3768da057ef9909338b5cfb25aa8c')throw new Error('Unexpected source');
try{
 for(const [stage,cmd] of [['regrowth',['node','--experimental-webstorage','--localstorage-file='+join(out,'native-storage'),join(out,'regrowth.mjs')]],['clock',['node',join(out,'clock.mjs')]]]){
  const args=['--timeout','900','/tmp/rpg-zzu-life-full-qa-01a0727b.lock','timeout','--signal=TERM','--kill-after=15s','300s',...cmd];
  const started=new Date().toISOString();console.log('P3_PARENT_PUBLIC_START '+stage);
  const r=spawnSync('flock',args,{encoding:'utf8',maxBuffer:64*1024*1024});
  await writeFile(join(out,stage+'.json'),JSON.stringify({head,tree,command:['flock',...args],started,finished:new Date().toISOString(),exit:r.status,signal:r.signal,stdout:r.stdout??'',stderr:r.stderr??''},null,2)+'\n',{flag:'wx'});
  console.log('P3_PARENT_PUBLIC_END '+stage+' exit='+r.status);if(r.status!==0){process.exitCode=r.status??1;break;}
 }
}finally{await rm(join(out,'native-storage'),{force:true});await rm(join(out,'probe-cache'),{recursive:true,force:true});await rm(join(out,'ssr-cache'),{recursive:true,force:true});console.log('P3_PARENT_PUBLIC_CLEANUP closed');}
