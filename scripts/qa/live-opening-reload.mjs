// Recover observation after screenshot timeout; never submit or synthesize AI work.
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
const out=resolve(process.env.LIVE_GAME_OUT??'verify-shots/opening-cinematic-v4');
const repair=JSON.parse(readFileSync(out+'/completion.json'));
const report={mode:'explicit final opening shot repair; observation recovered by canonical reload',projectUrl:repair.projectUrl,workerCompleted:repair.workerCompleted,successfulImageGenerations:repair.successfulImageGenerations,imageGenerationFailures:repair.imageGenerationFailures,originalObserverFailure:repair.failure,additionalModelRequests:0,errors:[]};
const hash=value=>createHash('sha256').update(value).digest('hex');
function snapshot(){const dir=repair.before.dir,db=new DatabaseSync(dir+'/project.sqlite',{readOnly:true});try{const row=db.prepare('select project_id,revision,current_json from project where id=1').get(),document=JSON.parse(row.current_json),maps=db.prepare('select map_id,map_json from maps order by map_id').all();return{dir,projectId:row.project_id,revision:row.revision,documentHash:hash(row.current_json),mapsHash:hash(JSON.stringify(maps)),opening:document.system.opening,title:document.system.titleScreen,art:document.system.opening.scenes.map(s=>{const asset=document.assets.uploaded[s.resourceId];assert(asset.ref,'Canonical media must be separated before reload observation');const bytes=readFileSync(resolve(dir,'assets',asset.ref.sha256+'.'+asset.ref.extension));assert.equal(hash(bytes),asset.ref.sha256);assert.equal(bytes.length,asset.ref.bytes);return{id:asset.id,ref:asset.ref,bytesVerified:true}})}}finally{db.close()}}
const browser=await chromium.launch({args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});const page=await browser.newPage({viewport:{width:1440,height:900},reducedMotion:'reduce'});
page.on('pageerror',e=>report.errors.push(e.message));page.on('request',r=>{if(r.url().includes('/v1/agent/run')&&r.method()==='POST')report.additionalModelRequests++});
try{
 assert(report.workerCompleted&&report.successfulImageGenerations>0&&!report.imageGenerationFailures.length,'Real generation receipt must pass');report.beforeReload=snapshot();
 assert.equal(report.beforeReload.mapsHash,repair.before.mapsHash);assert.deepEqual(report.beforeReload.title,repair.before.title);
 assert.notEqual(report.beforeReload.opening.scenes[2].resourceId,repair.before.opening.scenes[2].resourceId,'The actual handoff image must replace the old still');
 await page.goto(report.projectUrl,{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.__oprnAiBridge?.status().ready,null,{timeout:180000});
 await page.reload();await page.waitForFunction(()=>window.__oprnAiBridge?.status().ready,null,{timeout:180000});report.afterReload=snapshot();
 assert.deepEqual(report.afterReload,report.beforeReload);assert.equal(report.additionalModelRequests,0);assert.deepEqual(report.errors,[]);
 await page.screenshot({path:out+'/canonical-reloaded.png',timeout:15000});report.passed=true;
}catch(e){report.failure=e.message;report.passed=false}finally{await browser.close();writeFileSync(out+'/reloaded.json',JSON.stringify(report,null,2)+'\n')}
console.log(JSON.stringify({passed:report.passed,failure:report.failure,projectId:report.afterReload?.projectId,revision:report.afterReload?.revision}));process.exitCode=report.passed?0:1;
