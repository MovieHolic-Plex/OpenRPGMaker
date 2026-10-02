import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import pngjs from 'pngjs';
const { PNG } = pngjs;
const requests=JSON.parse(await readFile('assets/item-catalog/art-requests.json','utf8'));
const manifest=JSON.parse(await readFile('assets/item-catalog/generation-manifest.json','utf8'));
const review=JSON.parse(await readFile('assets/item-catalog/visual-review.json','utf8'));
const issues=[],pending=[],unreviewed=[];
const requestIds=new Set(),requestPaths=new Set();
for(const request of requests){
 if(requestIds.has(request.id))issues.push(`${request.id}: duplicate request ID`);
 if(requestPaths.has(request.path))issues.push(`${request.id}: duplicate output path`);
 requestIds.add(request.id);requestPaths.add(request.path);
}
for(const id of Object.keys(manifest.entries))if(!requestIds.has(id))issues.push(`${id}: unexpected manifest entry`);
for(const request of requests){
 const entry=manifest.entries[request.id];if(!entry){pending.push(request.id);continue;}
 if(entry.path!==request.path)issues.push(`${request.id}: output path differs from request`);
 try{
  const bytes=await readFile(request.path);const sha=createHash('sha256').update(bytes).digest('hex');
  if(sha!==entry.sha256)issues.push(`${request.id}: hash changed`);
  const png=PNG.sync.read(bytes),colors=new Set();let x0=32,y0=32,x1=-1,y1=-1,visible=0;
  if(png.width!==32||png.height!==32)issues.push(`${request.id}: size ${png.width}x${png.height}`);
  for(let y=0;y<png.height;y++)for(let x=0;x<png.width;x++){
   const p=(y*png.width+x)*4,a=png.data[p+3];
   if(a!==0&&a!==255)issues.push(`${request.id}: non-binary alpha`);
   if(a){colors.add(png.data.slice(p,p+3).toString('hex'));visible++;x0=Math.min(x0,x);y0=Math.min(y0,y);x1=Math.max(x1,x);y1=Math.max(y1,y);}
  }
  if(colors.size>32||colors.size<3)issues.push(`${request.id}: ${colors.size} colours`);
  if(visible<20||Math.max(x1-x0+1,y1-y0+1)>26)issues.push(`${request.id}: silhouette extent`);
  if(visible&&(Math.abs(x0+x1-31)>1||Math.abs(y0+y1-31)>1))issues.push(`${request.id}: silhouette not centred`);
  const reviewed=review.entries[request.id];
  if(reviewed?.sha256!==sha||reviewed.subject!=='accepted'||reviewed.style!=='accepted')unreviewed.push(request.id);
 }catch(e){issues.push(`${request.id}: ${e.message}`);}
}
const report={total:requests.length,completed:requests.length-pending.length,pending:pending.length,reviewed:requests.length-pending.length-unreviewed.length,unreviewed,issues,complete:pending.length===0&&unreviewed.length===0&&issues.length===0};
await mkdir('output/item-catalog',{recursive:true});await writeFile('output/item-catalog/art-inspection.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
