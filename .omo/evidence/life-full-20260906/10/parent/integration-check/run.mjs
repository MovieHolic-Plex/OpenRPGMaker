import {spawnSync,execFileSync} from 'node:child_process';
import {writeFile,rm,lstat} from 'node:fs/promises';
import {dirname,join} from 'node:path';
import {fileURLToPath} from 'node:url';
const out=dirname(fileURLToPath(import.meta.url));
const [head,tree]=execFileSync('git',['rev-parse','HEAD','HEAD^{tree}'],{encoding:'utf8'}).trim().split('\n');
if(head!=='bbaf9464cad3768da057ef9909338b5cfb25aa8c')throw new Error('Unexpected source HEAD');
if(await lstat('output/edit-activity').catch(e=>{if(e.code==='ENOENT')return null;throw e;}))throw new Error('Preexisting editor logs');
const tests=['test/lifeSkillDisabledHarvest.test.ts','test/cropRegrowthContract.test.ts','test/toolActionAuthoringParity.test.ts','test/makerClockIntegration.test.ts','test/lifeFieldInteraction.test.ts','test/databaseLifeCraftingView.test.ts','test/playSceneFarmFeedback.test.ts','test/playScenePlaceableOverlay.test.ts','test/npcActionFacing.test.ts','test/seasonalForage.test.ts'];
try{
 for(const [stage,cmd] of [['focused',['npm','test','--',...tests]],['diagnostics',['node',join(out,'diagnostics.mjs')]],['priority',['node',join(out,'priority.mjs')]],['editor',['node',join(out,'editor.mjs')]]]){
  const args=['--timeout','900','/tmp/rpg-zzu-life-full-qa-01a0727b.lock','timeout','--signal=TERM','--kill-after=15s','300s',...cmd];
  const started=new Date().toISOString();console.log('P3_PARENT_EXTRA_START '+stage);
  const r=spawnSync('flock',args,{encoding:'utf8',maxBuffer:64*1024*1024,env:{...process.env,E2E_FREEZE_DEV_SERVER:'1'}});
  await writeFile(join(out,stage+'.json'),JSON.stringify({head,tree,command:['flock',...args],started,finished:new Date().toISOString(),exit:r.status,signal:r.signal,stdout:r.stdout??'',stderr:r.stderr??''},null,2)+'\n',{flag:'wx'});
  console.log('P3_PARENT_EXTRA_END '+stage+' exit='+r.status);if(r.status!==0){process.exitCode=r.status??1;break;}
 }
}finally{await rm('output/edit-activity',{recursive:true,force:true});console.log('P3_PARENT_EXTRA_CLEANUP own editor logs removed');}
