import { readFile, writeFile, mkdir, copyFile, rename } from 'node:fs/promises';
import { dirname, resolve, relative, basename } from 'node:path';
import { createHash } from 'node:crypto';
import pngjs from 'pngjs';

const { PNG } = pngjs;
const arg = flag => { const i=process.argv.indexOf(flag);return i<0?undefined:process.argv[i+1]; };
const id=arg('--id'),source=arg('--source'),destination=arg('--destination');
if(!id || !source || !destination) throw new Error('Required: --id RESOURCE_ID --source PNG --destination public/assets/...png');
const root=resolve('.'), target=resolve(destination);
if(!relative(root,target).startsWith('public/assets/')) throw new Error('Destination must be in public/assets');
const bytes=await readFile(source), image=PNG.sync.read(bytes);
let x0=image.width,y0=image.height,x1=-1,y1=-1;
for(let y=0;y<image.height;y++) for(let x=0;x<image.width;x++) if(image.data[(y*image.width+x)*4+3]>=128) {
  x0=Math.min(x0,x);y0=Math.min(y0,y);x1=Math.max(x1,x);y1=Math.max(y1,y);
}
if(x1<x0 || y1<y0) throw new Error('Source has no visible object');
const bw=x1-x0+1,bh=y1-y0+1,scale=26/Math.max(bw,bh);
const tw=Math.max(1,Math.round(bw*scale)),th=Math.max(1,Math.round(bh*scale));
const ox=Math.floor((32-tw)/2),oy=Math.floor((32-th)/2),output=new PNG({width:32,height:32});
for(let y=0;y<th;y++) for(let x=0;x<tw;x++) {
  const sx=x0+Math.min(bw-1,Math.floor((x+.5)*bw/tw));
  const sy=y0+Math.min(bh-1,Math.floor((y+.5)*bh/th));
  const src=(sy*image.width+sx)*4,dst=((oy+y)*32+ox+x)*4;
  if(image.data[src+3]<128) continue;
  output.data[dst]=image.data[src];output.data[dst+1]=image.data[src+1];output.data[dst+2]=image.data[src+2];output.data[dst+3]=255;
}
// A small nondithered palette keeps the approved chunky sprite readable at 32px.
const histogram=new Map();
for(let p=0;p<output.data.length;p+=4) if(output.data[p+3]) {
  const key=(output.data[p]<<16)|(output.data[p+1]<<8)|output.data[p+2];
  const color=histogram.get(key);
  if(color) color.count++;else histogram.set(key,{rgb:[output.data[p],output.data[p+1],output.data[p+2]],count:1});
}
if(histogram.size>32) {
  const boxes=[[...histogram.values()]];
  const spread = box => [0,1,2].map(c=>Math.max(...box.map(p=>p.rgb[c]))-Math.min(...box.map(p=>p.rgb[c])));
  while(boxes.length<32) {
    let index=-1,best=-1;
    for(let i=0;i<boxes.length;i++) if(boxes[i].length>1) {
      const score=Math.max(...spread(boxes[i]))*Math.sqrt(boxes[i].reduce((s,p)=>s+p.count,0));
      if(score>best){best=score;index=i;}
    }
    if(index<0) break;
    const box=boxes.splice(index,1)[0],ranges=spread(box),channel=ranges.indexOf(Math.max(...ranges));
    box.sort((a,b)=>a.rgb[channel]-b.rgb[channel]);
    const half=box.reduce((s,p)=>s+p.count,0)/2;let sum=0,split=1;
    for(let i=0;i<box.length-1;i++){sum+=box[i].count;if(sum>=half){split=i+1;break;}}
    boxes.push(box.slice(0,split),box.slice(split));
  }
  const palette=boxes.map(box=>{const n=box.reduce((s,p)=>s+p.count,0);return [0,1,2].map(c=>Math.round(box.reduce((s,p)=>s+p.rgb[c]*p.count,0)/n));});
  for(let p=0;p<output.data.length;p+=4) if(output.data[p+3]) {
    let choice=palette[0],best=Infinity;
    for(const color of palette){const distance=[0,1,2].reduce((s,c)=>s+(output.data[p+c]-color[c])**2,0);if(distance<best){best=distance;choice=color;}}
    for(let c=0;c<3;c++) output.data[p+c]=choice[c];
  }
}
const opaqueColors=new Set();let visiblePixels=0;
for(let p=0;p<output.data.length;p+=4) if(output.data[p+3]) {visiblePixels++;opaqueColors.add(`${output.data[p]},${output.data[p+1]},${output.data[p+2]}`);}
if(visiblePixels<20 || opaqueColors.size<3) throw new Error('Sprite is blank or has collapsed during normalization');
const normalized=PNG.sync.write(output,{colorType:6});
await mkdir(dirname(target),{recursive:true});await writeFile(target,normalized);
const archive=resolve('output/item-catalog/sources',`${id}.png`);
await mkdir(dirname(archive),{recursive:true});await copyFile(source,archive);
const manifestPath=resolve('assets/item-catalog/generation-manifest.json');
let manifest;
try{manifest=JSON.parse(await readFile(manifestPath,'utf8'));}catch(error){if(error.code!=='ENOENT')throw error;manifest={version:1,tool:'built-in imagegen',imageSize:32,paletteLimit:32,entries:{}};}
const hash=b=>createHash('sha256').update(b).digest('hex');
manifest.entries[id]={path:relative(root,target),width:32,height:32,colors:opaqueColors.size,visiblePixels,alpha:'binary',sha256:hash(normalized),sourceSha256:hash(bytes),sourceFile:basename(source)};
await mkdir(dirname(manifestPath),{recursive:true});
// A reviewer may read the manifest while the next sprite is being saved.
// Replace a complete document so a reader never sees a truncated JSON file.
const nextManifestPath=manifestPath+'.next';
await writeFile(nextManifestPath,JSON.stringify(manifest,null,2)+'\n');
await rename(nextManifestPath,manifestPath);
console.log(JSON.stringify({id,path:relative(root,target),colors:opaqueColors.size,visiblePixels,completed:Object.keys(manifest.entries).length}));
