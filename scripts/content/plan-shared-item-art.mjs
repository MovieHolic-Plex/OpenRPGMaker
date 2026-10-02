import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
const requests=JSON.parse(await readFile('assets/item-catalog/art-requests.json','utf8'));
const manifest=JSON.parse(await readFile('assets/item-catalog/generation-manifest.json','utf8'));
const reference=resolve('assets/item-catalog/style-reference.png');
const prompt=subject=>`Use case: stylized-concept. Asset type: a NEW single inventory icon for the approved matching classic JRPG set.
Input image 1: STYLE REFERENCE ONLY, the approved red potion. Create the NEW subject below, matching its square pixel clusters, warm dark contour, discrete shading and upper-left lighting. Do not copy the potion unless the requested subject is a potion.
Subject: ${subject}
Style: authentic 32x32 logical-pixel sprite on ONE uniform square grid. Center the single object, about 26 pixels along its longest side, leaving clear empty margin. Render enlarged using nearest-neighbor equal square blocks. One logical pixel thick dark warm brown outline. Three or four discrete flat shade steps per material. Slight view of top and front, upper-left light. Simplify small details for readability at 32px. No gradients or antialiasing.
Backdrop: genuine transparent alpha channel, no floor, shadow or painted checkerboard.
Constraints: EXACTLY ONE isolated inventory object. No letters, numbers, labels, frames, UI, watermark, extra props, glow or particles. No painting, photorealism, smooth vector curves, 3D render, blur or pixel noise.`;
const pending=[];
for(const job of requests){let done=false;const entry=manifest.entries[job.id];if(entry)try{const bytes=await readFile(job.path);done=createHash('sha256').update(bytes).digest('hex')===entry.sha256;}catch{}if(!done)pending.push({...job,prompt:prompt(job.subject),reference});}
// Round robin by family lets early batches expose every new category before its variants.
const groups=new Map();
for(const job of pending){const group=job.id.startsWith('oprn-item-')?job.id.slice(10).split('-')[0]:'legacy';if(!groups.has(group))groups.set(group,[]);groups.get(group).push(job);}
const queue=[];while([...groups.values()].some(g=>g.length))for(const group of groups.values())if(group.length)queue.push(group.shift());
await mkdir('output/item-catalog',{recursive:true});
await writeFile('output/item-catalog/pending-art-jobs.json',JSON.stringify(queue,null,2)+'\n');
console.log(JSON.stringify({total:requests.length,completed:requests.length-pending.length,pending:pending.length,first:queue.slice(0,8).map(j=>({id:j.id,name:j.name}))}));
