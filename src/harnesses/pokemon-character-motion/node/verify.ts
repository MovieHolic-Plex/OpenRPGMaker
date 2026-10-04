/** Focused executable negative controls. These small geometric silhouettes are test fixtures, never shipped character artwork. */
import { strict as assert } from "node:assert";
import { mkdtempSync, writeFileSync, readFileSync, copyFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createImage, cloneImage, pixelAt, setPixel, cropImage } from "../../monster-collect-species/pixel/image";
import { writePng } from "../../monster-collect-species/node/png";
import { checkCharset,checkClip,pack,framesFromNative,VERSION } from "./motion";
import { run } from "./cli";
const results:{name:string,pass:boolean,errors?:string[]}[]=[];
const rect=(im:ReturnType<typeof createImage>,x:number,y:number,w:number,h:number,color:readonly[number,number,number,number])=>{for(let yy=y;yy<y+h;yy++)for(let xx=x;xx<x+w;xx++)setPixel(im,xx,yy,color);};
const fixture=()=>Array.from({length:12},(_,i)=>{
  const f=createImage(24,32),dir=Math.floor(i/3),pose=i%3,dx=dir;
  rect(f,8+dx,3,7,8,[30,40,50,255]);rect(f,7+dx,11,9,11,[100,80,180,255]);
  rect(f,8+dx,22,3,6,[20,30,40,255]);rect(f,12+dx,22,3,6,[20,30,40,255]);
  if(pose===0)rect(f,7+dx,27,3,2,[20,30,40,255]);if(pose===2)rect(f,13+dx,27,3,2,[20,30,40,255]);return f;
});
function expect(name:string,im:ReturnType<typeof createImage>,pass:boolean){const r=checkCharset(im);assert.equal(r.pass,pass,`${name}: ${r.errors.join('; ')}`);results.push({name,pass:true,errors:r.errors});}
async function main(){
  const valid=pack(fixture());expect('valid 12-pose fixture',valid,true);
  const stride=fixture();[0,3,6,9].forEach(i=>rect(stride[i]!,3+Math.floor(i/3),14,5,3,[100,80,180,255]));[2,5,8,11].forEach(i=>rect(stride[i]!,15+Math.floor(i/3),14,5,3,[100,80,180,255]));expect('legitimate arms extend 4px while stable core',pack(stride),true);
  const dup=fixture();dup[2]=cloneImage(dup[0]!);expect('duplicate step freeze',pack(dup),false);
  const jump=fixture();const shifted=createImage(24,32);for(let y=0;y<32;y++)for(let x=0;x<20;x++)setPixel(shifted,x+4,y,pixelAt(jump[0]!,x,y));jump[0]=shifted;expect('large head jump',pack(jump),false);
  const shuffle=fixture();[shuffle[0],shuffle[9]]=[shuffle[9]!,shuffle[0]!];expect('shuffled inconsistent frame roots',pack(shuffle),false);
  const scaledHead=fixture();rect(scaledHead[1]!,5,3,14,8,[30,40,50,255]);expect('gross head scale change',pack(scaledHead),false);
  const alpha=cloneImage(valid);alpha.data[(5*72+10)*4+3]=127;expect('nonbinary alpha',alpha,false);
  const palette=cloneImage(valid);for(let i=0;i<30;i++)setPixel(palette,7+i%10,12+Math.floor(i/10),[i*7,180-i*3,75+i,255]);expect('palette union overflow',palette,false);
  const clipped=fixture();rect(clipped[0]!,0,3,2,8,[30,40,50,255]);expect('clipped silhouette',pack(clipped),false);
  expect('truncated sheet',cropImage(valid,{x:0,y:0,width:71,height:128}),false);
  const seam=fixture();for(let i=0;i<seam[1]!.data.length;i+=4)if(seam[1]!.data[i+3]){seam[1]!.data[i]=250;seam[1]!.data[i+1]=200;}expect('hard cycle seam color jump',pack(seam),false);
  const s=createImage(48,32);fixture().slice(0,2).forEach((f,i)=>{for(let y=0;y<32;y++)for(let x=0;x<24;x++)setPixel(s,i*24+x,y,pixelAt(f,x,y));});
  const meta={id:'pose',frameWidth:24,frameHeight:32,fps:6,frameOrder:[0,1],sourceRects:[{x:0,y:0,width:24,height:32},{x:24,y:0,width:24,height:32}],kind:'drawn' as const};
  assert.equal(checkClip(s,meta).pass,true);results.push({name:'authored distinct clip',pass:true});
  const trans=createImage(48,32);const f=fixture()[0]!;for(let y=0;y<32;y++)for(let x=0;x<24;x++){setPixel(trans,x,y,pixelAt(f,x,y));if(x+1<24)setPixel(trans,24+x+1,y,pixelAt(f,x,y));}
  assert.equal(checkClip(trans,meta).pass,false);results.push({name:'drawn claim on translated still rejected',pass:true});
  assert.equal(checkClip(s,{...meta,sourceRects:[meta.sourceRects[0]!,{x:30,y:0,width:24,height:32}]}).pass,false);results.push({name:'clip crop bounds rejected',pass:true});
  assert.equal(checkClip(s,{...meta,durationsMs:[140,-1]}).pass,false);results.push({name:'clip negative duration rejected',pass:true});
  const clipPalette=cloneImage(s);for(let i=0;i<30;i++)setPixel(clipPalette,7+i%10,12+Math.floor(i/10),[i*7,180-i*3,75+i,255]);assert.equal(checkClip(clipPalette,meta).pass,false);results.push({name:'clip union palette overflow rejected',pass:true});
  const clipAlpha=cloneImage(s);clipAlpha.data[(5*48+10)*4+3]=90;assert.equal(checkClip(clipAlpha,meta).pass,false);results.push({name:'clip nonbinary alpha rejected',pass:true});
  const clipClipped=cloneImage(s);setPixel(clipClipped,0,5,[30,40,50,255]);assert.equal(checkClip(clipClipped,meta).pass,false);results.push({name:'clip silhouette clipping rejected',pass:true});
  const base=mkdtempSync(join(tmpdir(),'pokemon-motion-verifier-')),source=join(base,'valid.png'),prompt=join(base,'prompt.txt');writePng(source,valid);writeFileSync(prompt,'Geometric negative-control fixture only; never use as artwork.');
  const beforeLog=console.log;let imported='';console.log=(...v:unknown[])=>{if(typeof v[0]==='string'&&v[0].includes('/candidates/'))imported=v[0];};
  const execute=(stage:string,args:string[]=[])=>run([stage,'--sandbox',base,...args]);
  assert.equal(await execute('import',['--role','hero','--source',source,'--prompt-file',prompt,'--native']),0);assert(imported);console.log=beforeLog;
  assert.equal(await execute('check',['--candidate',imported]),0);
  assert.equal(await execute('gate',['--candidate',imported]),1);results.push({name:'gate blocks missing semantic review',pass:true});
  assert.equal(await execute('build',['--candidate',imported]),1);results.push({name:'build blocks failed gate',pass:true});
  assert.equal(await execute('preview',['--candidate',imported]),0);
  const evidence=join(base,'fixture-review.txt');writeFileSync(evidence,'Verifier fixture inspection stub: only validates ledger mechanics, NOT actual sprite visual approval.');
  assert.equal(await execute('review',['--candidate',imported,'--who','executable-fixture','--why','ledger mechanics only','--verdict','pass','--evidence',evidence]),0);
  assert.equal(await execute('build',['--candidate',imported]),1);results.push({name:'review alone cannot bypass stale failed gate',pass:true});
  assert.equal(await execute('gate',['--candidate',imported]),0);assert.equal(await execute('build',['--candidate',imported]),0);
  const original=readFileSync(join(imported,'charset.png'));writeFileSync(join(imported,'charset.png'),Buffer.concat([original,Buffer.from('changed')]));
  assert.equal(await execute('build',['--candidate',imported]),1);results.push({name:'source/final mutation blocks build',pass:true});writeFileSync(join(imported,'charset.png'),original);
  const raw=readFileSync(join(imported,'source.png'));writeFileSync(join(imported,'source.png'),Buffer.concat([raw,Buffer.from('mutated')]));assert.equal(await execute('build',['--candidate',imported]),1);results.push({name:'raw source mutation blocks build',pass:true});writeFileSync(join(imported,'source.png'),raw);
  const ev=join(imported,'review-evidence-0.txt');writeFileSync(ev,'mutated');assert.equal(await execute('build',['--candidate',imported]),1);results.push({name:'evidence mutation blocks build',pass:true});
  const atlas=createImage(288,256);fixture().slice(0,6).forEach((fr,i)=>{const pose=cloneImage(fr);rect(pose,10,15+i,2,2,[180,30,80,255]);for(let y=0;y<32;y++)for(let x=0;x<24;x++)for(let yy=0;yy<4;yy++)for(let xx=0;xx<4;xx++)setPixel(atlas,(i%3)*96+x*4+xx,Math.floor(i/3)*128+y*4+yy,pixelAt(pose,x,y));});const generatedSource=join(base,'generated-clip-fixture.png');writePng(generatedSource,atlas);
  imported='';console.log=(...v:unknown[])=>{if(typeof v[0]==='string'&&v[0].includes('/candidates/'))imported=v[0];};assert.equal(await execute('clip-import',['--role','professor','--source',generatedSource,'--prompt-file',prompt,'--block','4']),0);console.log=beforeLog;assert(imported);
  assert.equal(await execute('check',['--candidate',imported]),0);assert.equal(await execute('preview',['--candidate',imported]),0);assert.equal(await execute('gate',['--candidate',imported]),1);assert.equal(await execute('review',['--candidate',imported,'--who','executable-fixture','--why','clip ledger mechanics only','--verdict','pass','--evidence',evidence]),0);assert.equal(await execute('gate',['--candidate',imported]),0);assert.equal(await execute('build',['--candidate',imported]),0);results.push({name:'generated six-frame clip full lifecycle',pass:true});
  const clipBytes=readFileSync(join(imported,'clip.png'));writeFileSync(join(imported,'clip.png'),Buffer.concat([clipBytes,Buffer.from('mutated')]));assert.equal(await execute('build',['--candidate',imported]),1);writeFileSync(join(imported,'clip.png'),clipBytes);results.push({name:'generated final clip mutation blocks build',pass:true});
  const clipMeta=readFileSync(join(imported,'clip-metadata.json'));writeFileSync(join(imported,'clip-metadata.json'),clipMeta.toString().replace('"fps": 6','"fps": 7'));assert.equal(await execute('build',['--candidate',imported]),1);writeFileSync(join(imported,'clip-metadata.json'),clipMeta);results.push({name:'generated clip metadata mutation blocks build',pass:true});
  const report={version:VERSION,results,count:results.length,base};writeFileSync(join(base,'verification.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
}
main().catch(e=>{console.error(e);process.exitCode=1;});
