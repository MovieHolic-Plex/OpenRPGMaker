import { execFileSync, spawnSync } from 'node:child_process';
import { writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const out=dirname(fileURLToPath(import.meta.url));
const [head,tree]=execFileSync('git',['rev-parse','HEAD','HEAD^{tree}'],{encoding:'utf8'}).trim().split('\n');
if(head!=='d84001e88b5e0b7f8ff3074de0ec5f6cdbcbf41e')throw new Error('Unexpected candidate');
for(const [axis,seconds] of [['css',120],['surface',300]]) {
  const args=['--timeout','900','/tmp/rpg-zzu-life-full-qa-01a0727b.lock','timeout','--signal=TERM','--kill-after=15s',String(seconds)+'s','npm','run','gates','--','--only',axis,'--json'];
  const started=new Date().toISOString();
  console.log('REMAINING_AXIS_START '+axis);
  const result=spawnSync('flock',args,{encoding:'utf8',maxBuffer:64*1024*1024,env:{...process.env,VITE_CACHE_DIR:join(out,'remaining-axis-cache')}});
  const receipt={head,tree,command:['flock',...args],started,finished:new Date().toISOString(),exit:result.status,signal:result.signal,error:result.error?.message,stdout:result.stdout??'',stderr:result.stderr??''};
  await writeFile(join(out,'remaining-'+axis+'.json'),JSON.stringify(receipt,null,2)+'\n',{flag:'wx'});
  console.log('REMAINING_AXIS_END '+axis+' exit='+receipt.exit);
  if(result.status!==0)process.exitCode=result.status??1;
}
