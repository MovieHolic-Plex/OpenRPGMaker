// Packs actual imagegen pixels; generates no character/monster artwork.
// The production monster ledger is never selected here.
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {createRequire} from 'node:module';
import {build} from 'esbuild';
const [harnessRoot, manifestFile, output] = process.argv.slice(2);
if (!output) throw Error('Usage: node emerald-art-v2-pack.mjs <harness-repository> <generated-manifest> <output>');
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'emerald-art-pack-'));
const base=path.join(harnessRoot,'src/harnesses/monster-collect-species');
fs.writeFileSync(path.join(tmp,'entry.ts'),[
  'export * from '+JSON.stringify(base+'/node/png.ts')+';',
  'export * from '+JSON.stringify(base+'/pixel/pipeline.ts')+';',
  'export * from '+JSON.stringify(base+'/pixel/image.ts')+';',
  'export * from '+JSON.stringify(base+'/pixel/downscale.ts')+';'
].join('\n'));
await build({entryPoints:[path.join(tmp,'entry.ts')],outfile:path.join(tmp,'pack.cjs'),bundle:true,platform:'node',format:'cjs',logLevel:'silent'});
const p=createRequire(import.meta.url)(path.join(tmp,'pack.cjs'));
const entries=JSON.parse(fs.readFileSync(manifestFile,'utf8'));
fs.mkdirSync(output,{recursive:true});
function crop(image,x,y,w,h) {
  const out=p.createImage(w,h);
  for(let j=0;j<h;j++)out.data.set(image.data.subarray(((y+j)*image.width+x)*4,((y+j)*image.width+x+w)*4),j*w*4);
  return out;
}
function blit(dst,src,x,y) {
  for(let j=0;j<src.height;j++)for(let i=0;i<src.width;i++)p.setPixel(dst,x+i,y+j,p.pixelAt(src,i,j));
}
const order=['hero','rival','professor','nurse','merchant','mother','resident','gym_leader','company_agent','captain','worker','explorer','student','ranger','moon_leader','hiker'];
const sheets=[p.createImage(288,256),p.createImage(288,256)];
const provenance=[];
for(const e of entries.filter(x=>x.kind==='npc')) {
  const image=p.readPng(e.path);
  const frames=[];
  for(let row=0;row<4;row++)for(let col=0;col<3;col++) {
    const x=Math.floor(col*image.width/3),y=Math.floor(row*image.height/4);
    const w=Math.floor((col+1)*image.width/3)-x,h=Math.floor((row+1)*image.height/4)-y;
    const raw=crop(image,x,y,w,h);
    const {grid,block,colors}=p.pixelize(raw,24,{block:8});
    if(!p.opaqueBounds(grid))throw Error(e.id+' empty frame '+row+','+col);
    frames.push({grid,block,colors});
  }
  const factor=Math.max(1,...frames.map(f=>Math.max(f.grid.width/20,f.grid.height/28)));
  const index=order.indexOf(e.id); if(index<0)throw Error('Unknown role '+e.id);
  const sheet=sheets[Math.floor(index/8)], local=index%8;
  for(let i=0;i<12;i++) {
    const f=frames[i], small=factor===1?f.grid:p.cropToInk(p.downscaleTo(f.grid,Math.max(1,Math.floor(f.grid.width/factor))));
    if(small.width>24||small.height>32)throw Error(e.id+' frame overflow');
    const cell=p.createImage(24,32);
    blit(cell,small,Math.floor((24-small.width)/2),31-small.height);
    blit(sheet,cell,(local%4*3+i%3)*24,(Math.floor(local/4)*4+Math.floor(i/3))*32);
  }
  provenance.push({id:e.id,source:e.path,prompt:e.prompt,frames:frames.map(f=>({block:f.block,colors:f.colors,width:f.grid.width,height:f.grid.height})),factor});
}
for(let i=0;i<2;i++)p.writePng(path.join(output,'cast-'+(i+1)+'.png'),sheets[i]);
for(const e of entries.filter(x=>x.kind==='sign')) {
  const {grid}=p.pixelize(p.readPng(e.path),12);
  const factor=Math.max(1,grid.width/20,grid.height/28);
  const small=factor===1?grid:p.cropToInk(p.downscaleTo(grid,Math.max(1,Math.floor(grid.width/factor))));
  const sheet=p.createImage(288,256),cell=p.createImage(24,32);
  blit(cell,small,Math.floor((24-small.width)/2),31-small.height);
  for(let row=0;row<4;row++)for(let col=0;col<3;col++)blit(sheet,cell,col*24,row*32);
  p.writePng(path.join(output,'sign.png'),sheet);
}
for(const e of entries.filter(x=>x.kind==='trainer')) {
  const image=p.readPng(e.path);
  const columns=e.columns??4, rows=e.rows??2;
  for(let index=0;index<e.roles.length;index++) {
    const row=Math.floor(index/columns),col=index%columns;
    const x=Math.floor(col*image.width/columns),y=Math.floor(row*image.height/rows);
    const raw=crop(image,x,y,Math.floor((col+1)*image.width/columns)-x,Math.floor((row+1)*image.height/rows)-y);
    const {grid}=p.pixelize(raw,24);
    const factor=Math.max(1,grid.width/60,grid.height/90);
    const small=factor===1?grid:p.cropToInk(p.downscaleTo(grid,Math.max(1,Math.floor(grid.width/factor))));
    const sprite=p.createImage(64,96);
    blit(sprite,small,Math.floor((64-small.width)/2),95-small.height);
    p.writePng(path.join(output,'trainer-'+e.roles[index]+'.png'),sprite);
  }
}
p.writePng(path.join(output,'cast-preview.png'),p.scaleNearest(sheets[0],4));
fs.writeFileSync(path.join(output,'provenance.json'),JSON.stringify(provenance,null,2));
// Monster sheet rows may have unequal whitespace: cut at the nearest transparent
// separator instead of slicing through the smaller first evolution.
for(const e of entries.filter(x=>x.kind==='monster')) {
  const image=p.readPng(e.path), rows=e.species?.length??3, cuts=[0];
  const profile=Array.from({length:image.height},(_,y)=>{let n=0;for(let x=0;x<image.width;x++)if(p.pixelAt(image,x,y)[3]>32)n++;return n;});
  for(let row=1;row<rows;row++) {
    const target=Math.round(image.height*row/rows), radius=Math.floor(image.height/rows*.42);
    let best=target,score=Infinity;
    for(let y=Math.max(cuts.at(-1)+10,target-radius);y<Math.min(image.height-10,target+radius);y++) {
      const value=profile[y]*1000+Math.abs(y-target);if(value<score){score=value;best=y;}
    }cuts.push(best);
  }cuts.push(image.height);
  for(let row=0;row<rows;row++)for(let col=0;col<2;col++) {
    const id=e.species?.[row]??['spriglet','frondhare','grovewarden'][row], side=col?'back':'front';
    const x=Math.floor(image.width*col/2),w=Math.floor(image.width*(col+1)/2)-x;
    const raw=crop(image,x,cuts[row],w,cuts[row+1]-cuts[row]);
    p.writePng(path.join(output,id+'-'+side+'-raw.png'),raw);
    const {grid,block,colors}=p.pixelize(raw,20);
    p.writePng(path.join(output,id+'-'+side+'-grid.png'),grid);
    const fitted=p.toSprite(grid,side,e.stages?.[row]??row+1);
    p.writePng(path.join(output,id+'-'+side+'.png'),fitted.sprite);
    provenance.push({id,side,source:e.path,cuts,block,colors,ink:fitted.ink,factor:fitted.factor,selection:'pending-human'});
  }
}
fs.writeFileSync(path.join(output,'provenance.json'),JSON.stringify(provenance,null,2));
fs.rmSync(tmp,{recursive:true,force:true});
console.log(JSON.stringify({npcRoles:provenance.filter(x=>!x.side).length,monsterCandidates:provenance.filter(x=>x.side).length,output}));
