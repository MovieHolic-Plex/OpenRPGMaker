import {spawnSync,execFileSync} from 'node:child_process';
import {writeFile,rm} from 'node:fs/promises';
import {dirname,join} from 'node:path';
import {fileURLToPath} from 'node:url';
const out=dirname(fileURLToPath(import.meta.url));
const [head,tree]=execFileSync('git',['rev-parse','HEAD','HEAD^{tree}'],{encoding:'utf8'}).trim().split('\n');
if(head!=='9cb85be84746d84789497a1d4297d0c8416d86c8')throw new Error('Unexpected task7 HEAD');
const tests=['test/cropRegrowthContract.test.ts','test/farmingRuntime.test.ts','test/playSceneFarmOverlay.test.ts','test/farmingSprites.test.ts','test/lifeSkillDisabledHarvest.test.ts','test/lifeSaveVersion.test.ts','test/lifeRecoveryPersistence.test.ts','test/p0SessionPersistence.test.ts','test/customSeasonSave.test.ts','test/makerClockIntegration.test.ts','test/p0LifeSkillProgress.test.ts','test/p1DayTransitionIntegration.test.ts'];
try {
  for(const [stage,command] of [['tests',['npm','test','--',...tests]],['public',['node','--experimental-webstorage','--localstorage-file='+join(out,'native-storage'),join(out,'public-probe.mjs')]]]) {
    const args=['--timeout','900','/tmp/rpg-zzu-life-full-qa-01a0727b.lock','timeout','--signal=TERM','--kill-after=15s','300s',...command];
    const started=new Date().toISOString();
    console.log('PARENT7_START '+stage);
    const result=spawnSync('flock',args,{encoding:'utf8',maxBuffer:64*1024*1024});
    const receipt={head,tree,command:['flock',...args],started,finished:new Date().toISOString(),exit:result.status,signal:result.signal,stdout:result.stdout??'',stderr:result.stderr??''};
    await writeFile(join(out,stage+'.json'),JSON.stringify(receipt,null,2)+'\n',{flag:'wx'});
    console.log('PARENT7_END '+stage+' exit='+receipt.exit);
    if(result.status!==0){process.exitCode=result.status??1;break;}
  }
} finally {
  await rm(join(out,'native-storage'),{force:true});
  await rm(join(out,'probe-cache'),{recursive:true,force:true});
  console.log('PARENT7_CLEANUP owned storage/cache removed');
}
