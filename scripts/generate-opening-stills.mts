// One bounded tibo batch. The queue handles quota waits; new output always needs review.
import {mkdir,readFile,writeFile,rename,lstat} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve,join} from 'node:path';
import {parseArgs} from 'node:util';
import Jimp from 'jimp';
import {createOhMyPiAdapters,stopOhMyPiWorker} from './lib/ohMyPiPiAi.mjs';
import {acquireQueueLock,readQueueJson,writeQueueJson,quotaRetryAt} from './lib/openingStillQueue.mjs';
import {validateStillRows,sha256} from './lib/openingStillPack.mjs';

const {values}=parseArgs({options:{staging:{type:'string'},jobs:{type:'string',default:'3'},plan:{type:'string'},limit:{type:'string',default:'32'}}});
const limit=Number(values.limit),jobs=Number(values.jobs);
if(!Number.isSafeInteger(limit)||limit<1)throw new Error('--limit must be a positive integer');
if(!Number.isInteger(jobs)||jobs<1||jobs>4)throw new Error('--jobs must be between 1 and 4');
const staging=resolve(values.staging??'artifacts/stills-staging');
const planFile=resolve(values.plan??'assets/opening-stills-plan-v1.json');
const plan=JSON.parse(await readFile(planFile,'utf8'));
validateStillRows(plan.stills);
if(plan.stills.some((row:any)=>typeof row.prompt!=='string'||!row.prompt.trim()||!row.fileName.endsWith('.jpg'))){
  throw new Error('Generation plans require a nonempty prompt and a .jpg delivery filename');
}
await mkdir(staging,{recursive:true});
const release=await acquireQueueLock(staging,'.generate.lock');
const completed=new Map<string,any>();
let cursor=0,failures=0,requested=0,generated=0,cancelled=false,retryAt:string|null=null;
let storageFailure:unknown=null;
let checkpoint=Promise.resolve();
const runId=crypto.randomUUID();
const stateFile=join(staging,'run-status.json');
function status(phase:string,extra:Record<string,unknown>={}){
  const count=plan.stills.filter((s:any)=>completed.has(s.id)).length;
  return writeQueueJson(stateFile,{runId,pid:process.pid,phase,updatedAt:new Date().toISOString(),
    planFile,planned:plan.stills.length,completed:count,remaining:plan.stills.length-count,generated,failures,retryAt,...extra});
}
function save(){
  const content={license:'project-generated',provider:'google-antigravity',model:'gemini-3.1-flash-image',
    stills:[...completed.values()].sort((a,b)=>a.id.localeCompare(b.id))};
  checkpoint=checkpoint.then(()=>writeQueueJson(join(staging,'manifest.json'),content));
  return checkpoint;
}
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>{cancelled=true;stopOhMyPiWorker();});
try{
  const previous=await readQueueJson(join(staging,'manifest.json'));
  // Do not silently reset a corrupt manifest and generate paid duplicates.
  if(previous)validateStillRows(previous.stills);
  for(const still of previous?.stills??[])completed.set(still.id,still);
  await status('running');
  const adapters=await createOhMyPiAdapters();
  await Promise.all(Array.from({length:jobs},async()=>{
    while(cursor<plan.stills.length&&!retryAt&&!cancelled&&!storageFailure){
      const spec=plan.stills[cursor++];
      if(completed.has(spec.id)){
        try{
          const file=join(staging,spec.fileName),row=completed.get(spec.id),info=await lstat(file);
          if(!info.isFile())throw new Error('not a regular file');
          if(row.sha256){if(row.bytes!==info.size||row.sha256!==await sha256(file))throw new Error('corrupt image');}
          else await Jimp.read(file);
          continue;
        }
        catch{completed.delete(spec.id);}
      }
      if(requested>=limit||retryAt||cancelled||storageFailure)break;
      requested++;
      let success=false;
      for(let attempt=0;attempt<3&&!retryAt&&!cancelled&&!storageFailure;attempt++){
        try{
          console.log('GENERATING',spec.id,'attempt',attempt+1);
          const image=await adapters.generateImage('google-antigravity',{prompt:spec.prompt,model:'gemini-3.1-flash-image'});
          if(cancelled)break;
          const raw=Buffer.from(image.base64,'base64');
          const decoded=await Jimp.read(raw);
          const {width,height}=decoded.bitmap;
          if(width<1024||height<576)throw new Error('generated image is too small');
          const jpeg=await decoded.quality(90).getBufferAsync(Jimp.MIME_JPEG);
          try{
            await writeFile(join(staging,spec.id+'.original.png'),raw);
            const temporary=join(staging,spec.fileName+'.tmp');
            await writeFile(temporary,jpeg);
            await rename(temporary,join(staging,spec.fileName));
            completed.set(spec.id,{...spec,reviewStatus:'pending',width,height,bytes:jpeg.length,
              sha256:createHash('sha256').update(jpeg).digest('hex')});
            await save();generated++;success=true;
          }catch(error){storageFailure=error;throw error;}
          console.log('DONE',spec.id,width+'x'+height);break;
        }catch(error){
          if(cancelled)break;
          const message=String((error as Error).message);
          const reset=quotaRetryAt(message);
          if(reset&&(!retryAt||reset>retryAt))retryAt=reset;
          console.error('GENERATION_FAILED',spec.id,message.slice(0,220));
        }
      }
      if(!success&&!cancelled)failures++;
    }
  }));
  await checkpoint;
  if(storageFailure)throw storageFailure;
  const remaining=plan.stills.some((s:any)=>!completed.has(s.id));
  const phase=cancelled?'cancelled':retryAt?'quota_wait':failures?'failed':remaining?'batch_complete':'complete';
  await status(phase);
  process.exitCode=cancelled?130:retryAt?75:failures?1:0;
  console.log('BATCH_STATUS',phase,'generated',generated,'retryAt',retryAt??'-');
}catch(error){
  await checkpoint.catch(()=>{});
  await status('failed',{reason:String((error as Error).message).slice(0,300)});
  throw error;
}finally{stopOhMyPiWorker();await release();}
