// Re-extract imagegen pixels with one grid scale per family and one fit per pair.
// No artwork is drawn here, and no human selection/production write is made.
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {createRequire} from 'node:module';
import {build} from 'esbuild';
const [harnessRoot,manifestFile,out]=process.argv.slice(2);
if(!out)throw Error('Usage: emerald-art-v3-pairs <harness-root> <generated-manifest> <output>');
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'emerald-pair-pack-'));
const base=path.join(harnessRoot,'src/harnesses/monster-collect-species');
fs.writeFileSync(path.join(tmp,'entry.ts'),['node/png.ts','pixel/pipeline.ts','pixel/image.ts','pixel/downscale.ts'].map(f=>'export * from '+JSON.stringify(base+'/'+f)+';').join('\n'));
await build({entryPoints:[path.join(tmp,'entry.ts')],outfile:path.join(tmp,'pack.cjs'),bundle:true,platform:'node',format:'cjs',logLevel:'silent'});
const p=createRequire(import.meta.url)(path.join(tmp,'pack.cjs'));
const records=JSON.parse(fs.readFileSync(manifestFile));fs.mkdirSync(out,{recursive:true});
function crop(image,x,y,w,h){const o=p.createImage(w,h);for(let j=0;j<h;j++)o.data.set(image.data.subarray(((y+j)*image.width+x)*4,((y+j)*image.width+x+w)*4),j*w*4);return o;}
const proof=[];
for(const record of records){
 const image=p.readPng(record.path),rows=record.species.length,cuts=[0];
 const profile=Array.from({length:image.height},(_,y)=>{let count=0;for(let x=0;x<image.width;x++)if(p.pixelAt(image,x,y)[3]>=128)count++;return count;});
 for(let row=1;row<rows;row++){const target=Math.round(image.height*row/rows),radius=Math.floor(image.height/rows*.42);let best=target,score=Infinity;for(let y=Math.max(cuts.at(-1)+10,target-radius);y<Math.min(image.height-10,target+radius);y++){const next=profile[y]*1000+Math.abs(y-target);if(next<score){best=y;score=next;}}cuts.push(best);}cuts.push(image.height);
 // Generated atlases are not guaranteed to respect the exact sheet midpoint.
 // Find each row's clear inter-sprite gutter; a fixed half-sheet crop can clip
 // the front tail and import that fragment as debris in the back candidate.
 const raw=[],columnCuts=[];
 for(let row=0;row<rows;row++){
  const midpoint=Math.floor(image.width/2),radius=Math.floor(image.width*.12);
  let boundary=midpoint,score=Infinity;
  for(let x=midpoint-radius;x<=midpoint+radius;x++){
   let ink=0;for(let y=cuts[row];y<cuts[row+1];y++)if(p.pixelAt(image,x,y)[3]>=128)ink++;
   const next=ink*image.width+Math.abs(x-midpoint);
   if(next<score){score=next;boundary=x;}
  }
  if(score>=image.width)throw Error(record.id+' row'+row+' has no clear inter-sprite gutter');
  columnCuts.push(boundary);
  for(let col=0;col<2;col++){const x=col?boundary:0,w=col?image.width-boundary:boundary;raw.push(crop(image,x,cuts[row],w,cuts[row+1]-cuts[row]));}
 }
 const auto=raw.map(im=>p.pixelize(im,16).block).sort((a,b)=>a-b);
 const block=record.pixelBlock??Math.round((auto[2]+auto[3])/2);
 for(let row=0;row<rows;row++){
  const pair=raw.slice(row*2,row*2+2).map(im=>p.pixelize(im,16,{block}));
  const stage=record.stages[row],limit={1:40,2:52,3:64}[stage];
  const factor=Math.max(1,...pair.map(r=>Math.max(r.grid.width,r.grid.height)/limit));
  const entry={id:record.species[row],family:record.id,source:record.path,prompt:record.prompt,revision:record.revision,rowBounds:[cuts[row],cuts[row+1]],columnBoundary:columnCuts[row],commonBlock:block,automaticBlocks:auto,nativeLimit:limit,sharedPairFactor:factor,sides:[]};
  for(let col=0;col<2;col++){
   const side=col?'back':'front',original=pair[col].grid;
   const grid=factor===1?original:p.cropToInk(p.downscaleTo(original,Math.max(1,Math.floor(original.width/factor))));
   if(Math.max(grid.width,grid.height)>limit)throw Error(entry.id+' '+side+' exceeds native limit');
   const result=p.toSprite(grid,side,stage);if(result.factor!==1)throw Error('Unexpected second scaling');
   p.writePng(path.join(out,entry.id+'-'+side+'-original-crop.png'),raw[row*2+col]);
   p.writePng(path.join(out,entry.id+'-'+side+'-grid.png'),grid);
   p.writePng(path.join(out,entry.id+'-'+side+'-raw.png'),p.scaleNearest(grid,8));
   p.writePng(path.join(out,entry.id+'-'+side+'.png'),result.sprite);
   entry.sides.push({side,original:{width:original.width,height:original.height},native:{width:grid.width,height:grid.height},paletteCeiling:16});
  }
  const [a,b]=entry.sides;entry.backFrontBodyRatio=Math.sqrt(b.native.width*b.native.height/(a.native.width*a.native.height));proof.push(entry);
 }
}
if(proof.length!==60)throw Error('Expected60species');
fs.writeFileSync(path.join(out,'pair-provenance.json'),JSON.stringify({selection:'pending-human',species:60,candidates:120,proof},null,2));
fs.rmSync(tmp,{recursive:true,force:true});console.log(JSON.stringify({species:60,candidates:120,paletteCeiling:16,nativeMaximum:64,selection:'pending-human',outliers:proof.filter(r=>r.backFrontBodyRatio<.75||r.backFrontBodyRatio>1.3).map(r=>({id:r.id,ratio:r.backFrontBodyRatio}))}));
