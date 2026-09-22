// Resumable tibo Imagen batch. Prompts + originals stay in staging; only the catalog enters Git.
// bun scripts/generate-opening-stills.mts --staging artifacts/stills-staging --jobs 3
import { mkdir, readFile, writeFile, rename } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { parseArgs } from 'node:util';
import Jimp from 'jimp';
import { createOhMyPiAdapters, stopOhMyPiWorker } from './lib/ohMyPiPiAi.mjs';
const {values} = parseArgs({options:{staging:{type:'string'},jobs:{type:'string',default:'3'},plan:{type:'string'}}});
const staging=resolve(values.staging ?? 'artifacts/stills-staging');
await mkdir(staging,{recursive:true});
const plan=JSON.parse(await readFile(resolve(values.plan ?? 'assets/opening-stills-plan-v1.json'),'utf8'));
const adapters=await createOhMyPiAdapters();
let cursor=0, failures=0;
const completed=new Map<string, unknown>();
try { const prev=JSON.parse(await readFile(join(staging,'manifest.json'),'utf8')); for(const s of prev.stills) completed.set(s.id,s); } catch {}
// Serialize checkpoints so a slower write cannot overwrite a newer manifest.
let checkpoint=Promise.resolve();
function save(){const content=JSON.stringify({license:'project-generated',provider:'google-antigravity',model:'gemini-3.1-flash-image',stills:[...completed.values()].sort((a:any,b:any)=>a.id.localeCompare(b.id))},null,2)+'\n';checkpoint=checkpoint.then(async()=>{await writeFile(join(staging,'manifest.json.tmp'),content);await rename(join(staging,'manifest.json.tmp'),join(staging,'manifest.json'));});return checkpoint;}
try {
  await Promise.all(Array.from({length:Math.max(1,Math.min(4,Number(values.jobs)||1))},async()=>{
    while(cursor<plan.stills.length){
      const spec=plan.stills[cursor++];
      if(completed.has(spec.id)){try{await Jimp.read(join(staging,spec.fileName));continue;}catch{completed.delete(spec.id);}}
      let error;
      for(let attempt=0;attempt<3;attempt++){
        try {
          console.log('GENERATING',spec.id,'attempt',attempt+1);
          const image=await adapters.generateImage('google-antigravity',{prompt:spec.prompt,model:'gemini-3.1-flash-image'});
          const raw=Buffer.from(image.base64,'base64');
          const decoded=await Jimp.read(raw);
          const info=decoded.bitmap;
          if(!info.width || info.width<1024 || !info.height || info.height<576) throw new Error('generated image is too small');
          // Preserve the provider output for audit; web delivery uses the same full frame in JPEG.
          await writeFile(join(staging,spec.id+'.original.png'),raw);
          await decoded.quality(90).writeAsync(join(staging,spec.fileName));
          completed.set(spec.id,{...spec,width:info.width,height:info.height});
          await save(); console.log('DONE',completed.size+'/'+plan.stills.length,spec.id,info.width+'x'+info.height);error=null;break;
        }catch(e){error=e;console.error('RETRY',spec.id,String((e as Error).message).slice(0,180));}
      }
      if(error)failures++;
    }
  }));
}finally{await checkpoint;stopOhMyPiWorker();}
if(failures)throw new Error(failures+' stills failed; rerun resumes completed items');
