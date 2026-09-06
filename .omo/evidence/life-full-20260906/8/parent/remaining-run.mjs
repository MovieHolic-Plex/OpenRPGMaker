import {spawnSync,execFileSync} from 'node:child_process';
import {writeFile,rm,lstat} from 'node:fs/promises';
import {dirname,join} from 'node:path';
import {fileURLToPath} from 'node:url';
const out=dirname(fileURLToPath(import.meta.url));
const [head,tree]=execFileSync('git',['rev-parse','HEAD','HEAD^{tree}'],{encoding:'utf8'}).trim().split('\n');
if(head!=='e0a5e8a67c48c739fc2b9e16eb48abc2ee85f854')throw new Error('Unexpected task8 head');
for(const path of ['dist','output/edit-activity']) {
 const exists=await lstat(path).catch(error=>{if(error.code==='ENOENT')return null;throw error;});
 if(exists)throw new Error('Preexisting generated output: '+path);
 if(execFileSync('git',['ls-files','--',path],{encoding:'utf8'}).trim())throw new Error('Tracked output: '+path);
}
const tests=['test/toolActionAuthoringParity.test.ts','test/databaseLifeCraftingView.test.ts','test/farmingRuntime.test.ts','test/stardewAuthoringTools.test.ts','test/p0ToolCapability.test.ts','test/cropRegrowthContract.test.ts','test/lifeSkillDisabledHarvest.test.ts','test/serializeCompact.test.ts','test/p0ProjectSchema.test.ts','test/toolsLifeEconomy.test.ts','test/p0SessionPersistence.test.ts','test/p2SessionPersistence.test.ts','test/p2LifeRuntime.test.ts','test/lifeAuthoringReferences.test.ts','test/makerClockIntegration.test.ts'];
const stages=[['editor-corrected',300,['node',join(out,'editor-corrected/editor.mjs')]],['typecheck',300,['npm','run','typecheck:app']],['build',600,['npm','run','build']]];
try {
 for(const [stage,seconds,command] of stages) {
  const args=['--timeout','900','/tmp/rpg-zzu-life-full-qa-01a0727b.lock','timeout','--signal=TERM','--kill-after=15s',String(seconds)+'s',...command];
  const started=new Date().toISOString(); console.log('PARENT8_START '+stage);
  const r=spawnSync('flock',args,{encoding:'utf8',maxBuffer:64*1024*1024,env:{...process.env,VITE_CACHE_DIR:join(out,'build-cache')}});
  await writeFile(join(out,stage+'.json'),JSON.stringify({head,tree,command:['flock',...args],started,finished:new Date().toISOString(),exit:r.status,signal:r.signal,stdout:r.stdout??'',stderr:r.stderr??''},null,2)+'\n',{flag:'wx'});
  console.log('PARENT8_END '+stage+' exit='+r.status);
  if(r.status!==0){process.exitCode=r.status??1;break;}
 }
} finally {
 for(const path of ['dist','output/edit-activity',join(out,'build-cache'),join(out,'public-cache'),join(out,'editor-cache')])await rm(path,{recursive:true,force:true});
 console.log('PARENT8_CLEANUP own generated outputs removed');
}
