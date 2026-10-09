// Persistent finite production job. Respects provider reset times; never approves/publishes images.
import {readFile,mkdir,writeFile,statfs} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {parseArgs} from 'node:util';
import {spawn} from 'node:child_process';
import {createHash} from 'node:crypto';
import {setTimeout as delay} from 'node:timers/promises';
import {acquireQueueLock,readQueueJson,writeQueueJson} from './lib/openingStillQueue.mjs';
import {validateStillRows} from './lib/openingStillPack.mjs';

const {values}=parseArgs({options:{plan:{type:'string'},staging:{type:'string'},bun:{type:'string',default:'bun'},
  'batch-size':{type:'string',default:'32'},jobs:{type:'string',default:'2'},'not-before':{type:'string'},status:{type:'boolean'}}});
if(!values.staging)throw new Error('--staging is required');
const staging=resolve(values.staging),stateFile=join(staging,'queue-status.json');
if(values.status){console.log(JSON.stringify(await readQueueJson(stateFile),null,2));process.exit(0);}
if(!values.plan)throw new Error('--plan is required');
const planFile=resolve(values.plan),plan=JSON.parse(await readFile(planFile,'utf8'));
validateStillRows(plan.stills);
const batchSize=Number(values['batch-size']),jobs=Number(values.jobs);
if(!Number.isSafeInteger(batchSize)||batchSize<1||batchSize>128)throw new Error('--batch-size must be 1..128');
if(!Number.isInteger(jobs)||jobs<1||jobs>4)throw new Error('--jobs must be 1..4');
const explicitStart=values['not-before']?Date.parse(values['not-before']):0;
if(!Number.isFinite(explicitStart))throw new Error('Invalid --not-before');
const planSha256=createHash('sha256').update(JSON.stringify(plan.stills)).digest('hex');
const release=await acquireQueueLock(staging,'.queue.lock');
const cancel=new AbortController();let child,retryAt=null,completed=0,pendingReview=0;
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>{cancel.abort();child?.kill('SIGTERM');});
async function save(phase,extra={}){
  await writeQueueJson(stateFile,{schemaVersion:1,pid:process.pid,phase,planFile,planSha256,staging,
    planned:plan.stills.length,completed,pendingReview,remaining:plan.stills.length-completed,
    retryAt,updatedAt:new Date().toISOString(),...extra});
}
async function progress(){
  const manifest=await readQueueJson(join(staging,'manifest.json'));
  if(manifest)validateStillRows(manifest.stills);
  const wanted=new Set(plan.stills.map(row=>row.id));
  const rows=(manifest?.stills??[]).filter(row=>wanted.has(row.id));
  completed=rows.length;pendingReview=rows.filter(row=>row.reviewStatus!=='approved').length;
  return rows;
}
const html=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
async function reviewPages(rows){
  if(!rows.length)return;
  const dir=join(staging,'review');await mkdir(dir,{recursive:true});
  const header='<!doctype html><meta charset="utf-8"><title>오프닝 이미지 검수</title><style>body{font:16px system-ui;max-width:1300px;margin:32px auto;background:#171b24;color:#eee}main{display:grid;grid-template-columns:repeat(2,1fr);gap:24px}img{width:100%}article{padding:16px;background:#242b39}a{color:#a8d5ff}code{overflow-wrap:anywhere}</style>';
  const links=[];
  for(let offset=0;offset<rows.length;offset+=32){
    const name='page-'+String(offset/32+1).padStart(3,'0')+'.html';links.push('<li><a href="'+name+'">'+(offset+1)+'–'+Math.min(offset+32,rows.length)+'</a></li>');
    const cards=rows.slice(offset,offset+32).map(row=>'<article><h2>'+html(row.name)+'</h2><a href="../'+encodeURIComponent(row.fileName)+'"><img loading="lazy" src="../'+encodeURIComponent(row.fileName)+'"></a><p>'+ (row.reviewStatus==='approved'?'검수 완료 설명':'미검수 · 생성 요청 설명')+'</p><p>'+html(row.description)+'</p><p>'+html((row.useCases??[]).join(' · '))+'</p><p>'+html((row.cautions??[]).join(' · '))+'</p><code>'+html(row.id)+'</code></article>').join('');
    await writeFile(join(dir,name),header+'<a href="index.html">목록</a><main>'+cards+'</main>');
  }
  await writeFile(join(dir,'index.html'),header+'<h1>오프닝 이미지 검수</h1><p>'+rows.length+'장 · 미검수 '+pendingReview+'장. 실제 그림과 설명을 대조한 뒤 승인합니다.</p><ul>'+links.join('')+'</ul>');
}
try{
  const previous=await readQueueJson(stateFile);
  if(previous&&previous.planSha256!==planSha256)throw new Error('대기열 계획이 변경되었습니다. 기존 계획으로 재개하거나 별도 staging을 사용하세요.');
  const next=Math.max(explicitStart,Date.parse(previous?.retryAt??'')||0);
  retryAt=next>Date.now()?new Date(next).toISOString():null;
  await progress();
  while(!cancel.signal.aborted){
    if(retryAt&&Date.parse(retryAt)>Date.now()){
      await save('quota_wait');
      try{await delay(Math.min(Date.parse(retryAt)-Date.now(),30_000),undefined,{signal:cancel.signal});}catch(error){if(!cancel.signal.aborted)throw error;}
      continue;
    }
    retryAt=null;
    const disk=await statfs(staging);
    if(disk.bavail*disk.bsize<2*1024**3)throw new Error('생성 중단: 최소 2 GiB의 여유 공간이 필요합니다.');
    await save('generating');
    const before=await readQueueJson(join(staging,'run-status.json'));
    const code=await new Promise((ok,fail)=>{
      child=spawn(values.bun,[resolve(import.meta.dirname,'generate-opening-stills.mts'),'--plan',planFile,
        '--staging',staging,'--limit',String(batchSize),'--jobs',String(jobs)],{stdio:'inherit'});
      child.once('error',fail);child.once('close',ok);
    });
    child=undefined;
    const result=await readQueueJson(join(staging,'run-status.json'));
    await reviewPages(await progress());
    if(cancel.signal.aborted)break;
    if(!result||result.runId===before?.runId||result.planFile!==planFile)throw new Error('생성기가 새 상태를 기록하지 않았습니다. 종료 코드: '+code);
    if(code===75&&result.phase==='quota_wait'){
      if(!(Date.parse(result.retryAt)>Date.now()))throw new Error('잘못된 할당량 재개 시각');
      retryAt=result.retryAt;continue;
    }
    if(code!==0||!['complete','batch_complete'].includes(result.phase))throw new Error('생성 중단: '+result.phase+' (exit '+code+')');
    if(result.phase==='complete'){await save('awaiting_review');break;}
    if(result.generated===0)throw new Error('진행 없는 배치를 반복하지 않습니다.');
  }
  if(cancel.signal.aborted)await save('cancelled');
}catch(error){await save('failed',{reason:String(error.message).slice(0,300)});throw error;}
finally{await release();}
