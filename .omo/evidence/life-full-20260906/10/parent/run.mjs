import {spawnSync,execFileSync} from 'node:child_process';
import {writeFile,rm,lstat} from 'node:fs/promises';
import {dirname,join} from 'node:path';
import {fileURLToPath} from 'node:url';
const out=dirname(fileURLToPath(import.meta.url));
const [head,tree]=execFileSync('git',['rev-parse','HEAD','HEAD^{tree}'],{encoding:'utf8'}).trim().split('\n');
if(head!=='bbaf9464cad3768da057ef9909338b5cfb25aa8c')throw new Error('Unexpected task10 HEAD');
if(await lstat('dist').catch(e=>{if(e.code==='ENOENT')return null;throw e;}))throw new Error('Preexisting dist');
if(execFileSync('git',['ls-files','--','dist'],{encoding:'utf8'}).trim())throw new Error('Tracked dist');
const files=['test/lifeFieldInteraction.test.ts','test/p2LifeRuntime.test.ts','test/p2HostileAudit.test.ts','test/seasonalForage.test.ts','test/lifeSkillDisabledHarvest.test.ts','test/toolActionAuthoringParity.test.ts','test/p0ToolCapability.test.ts','test/farmingRuntime.test.ts','test/cropRegrowthContract.test.ts','test/playSceneFarmFeedback.test.ts','test/playScenePlaceableOverlay.test.ts','test/p2SpatialPlayIntegration.test.ts','test/lifeQaObservability.test.ts','test/actionDebounceFootprint.test.ts','test/npcActionFacing.test.ts','test/sceneTestRunner.test.ts','test/makerClockIntegration.test.ts'];
try {
 for(const [stage,seconds,command] of [['related',300,['npm','test','--',...files]],['native',300,['node',join(out,'player.mjs')]],['pixels',120,['node',join(out,'pixels.mjs')]],['typecheck',300,['npm','run','typecheck:app']],['build',600,['npm','run','build']]]) {
  const args=['--timeout','900','/tmp/rpg-zzu-life-full-qa-01a0727b.lock','timeout','--signal=TERM','--kill-after=15s',String(seconds)+'s',...command];
  const started=new Date().toISOString();console.log('PARENT10_START '+stage);
  const r=spawnSync('flock',args,{encoding:'utf8',maxBuffer:64*1024*1024,env:{...process.env,VITE_CACHE_DIR:join(out,'build-cache')}});
  await writeFile(join(out,stage+'.json'),JSON.stringify({head,tree,command:['flock',...args],started,finished:new Date().toISOString(),exit:r.status,signal:r.signal,stdout:r.stdout??'',stderr:r.stderr??''},null,2)+'\n',{flag:'wx'});
  console.log('PARENT10_END '+stage+' exit='+r.status);
  if(r.status!==0){process.exitCode=r.status??1;if(stage!=='related'||r.status!==1)break;}
 }
}finally{await rm('dist',{recursive:true,force:true});await rm(join(out,'build-cache'),{recursive:true,force:true});console.log('PARENT10_CLEANUP own build output removed');}
