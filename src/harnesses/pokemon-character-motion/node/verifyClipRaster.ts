/** Clip raster controls: geometric fixtures only, no shipped art or automatic semantic approval. */
import { strict as assert } from 'node:assert';
import { mkdtempSync,writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createImage,cloneImage,pixelAt,setPixel,type RgbaImage,type Rgba } from '../../monster-collect-species/pixel/image';
import { importGeneratedClip,checkClip,VERSION,type ClipMetadata } from './motion';
const results:{name:string;pass:true;detail?:unknown}[]=[];
const record=(name:string,detail?:unknown)=>results.push({name,pass:true,...(detail===undefined?{}:{detail})});
const rect=(im:RgbaImage,x:number,y:number,w:number,h:number,p:Rgba)=>{for(let yy=y;yy<y+h;yy++)for(let xx=x;xx<x+w;xx++)setPixel(im,xx,yy,p);};
function poses(){return Array.from({length:6},(_,i)=>{const f=createImage(64,64);rect(f,20,4,24,12,[30,40,50,255]);rect(f,24,16,16,34,[100,80,180,255]);rect(f,26,50,4,10,[20,30,40,255]);rect(f,34,50,4,10,[20,30,40,255]);rect(f,23+i,8,2,2,[180,30,80,255]);rect(f,14+i*2,24,10,3,[100,80,180,255]);return f;});}
function atlas(frames:RgbaImage[],factor=4){const out=createImage(64*frames.length*factor,64*factor);frames.forEach((f,i)=>{for(let y=0;y<64;y++)for(let x=0;x<64;x++)for(let yy=0;yy<factor;yy++)for(let xx=0;xx<factor;xx++)setPixel(out,i*64*factor+x*factor+xx,y*factor+yy,pixelAt(f,x,y));});return out;}
const opts={columns:6,rows:1,frameWidth:64,frameHeight:64,sampling:'raster' as const};
const meta=(height=64):ClipMetadata=>({id:'fixture',frameWidth:64,frameHeight:height,fps:6,frameOrder:[0,1,2,3,4,5],sourceRects:Array.from({length:6},(_,i)=>({x:i*64,y:0,width:64,height})),kind:'drawn'});
function raster(raw:RgbaImage,extra:Record<string,unknown>={}){const r=importGeneratedClip(raw,{...opts,...extra}) as ReturnType<typeof import('./motion').importGeneratedClipRaster>;assert.equal(r.sampling,'common-source-raster');return r;}
function main(){
 const base=mkdtempSync(join(tmpdir(),'pokemon-clip-raster-verifier-')),raw=atlas(poses()),direct=raster(raw),checked=checkClip(direct.image,meta());assert.equal(checked.pass,true,checked.errors.join('; '));assert.equal(direct.phase,.5);assert.equal(direct.alphaThreshold,128);assert.equal(direct.block,null);assert.deepEqual(direct.inferredBlocks,[]);assert.equal(direct.frameCount,6);assert.equal(direct.commonScaleFit.frames.length,6);record('six genuine changed poses pass raster structure without adaptive pixel grid');
 const feet=direct.sourceFrameMetrics.map(m=>m.outputInk!.y+m.outputInk!.height),sourceFeet=direct.sourceFrameMetrics.map(m=>m.sourceFeetBottom);assert.equal(new Set(feet).size,1);assert.equal(new Set(sourceFeet).size,1);assert.equal(new Set(direct.sourceFrameMetrics.map(m=>m.sourceRowOriginY)).size,1);for(const m of direct.commonScaleFit.frames){assert(m.leftExtent*direct.scale<=30+1e-8);assert(m.rightExtent*direct.scale<=30+1e-8);}record('identical raw feet remain identical native feet with one source scale and row origin',{scale:direct.scale,feet,sourceFeet});
 const visible=cloneImage(raw);for(let i=3;i<visible.data.length;i+=4)if(visible.data[i])visible.data[i]=128;assert.deepEqual(raster(visible).image.data,direct.image.data);record('clip alpha128 foreground retained');
 const faint=cloneImage(raw);for(let i=3;i<faint.data.length;i+=4)if(faint.data[i])faint.data[i]=127;assert.throws(()=>raster(faint),/empty/);record('clip alpha127 foreground rejected as empty');
 const hidden=cloneImage(raw);for(let i=0;i<hidden.data.length;i+=4)if(!hidden.data[i+3]){hidden.data[i]=200;hidden.data[i+1]=33;hidden.data[i+2]=88;}assert.deepEqual(raster(hidden).image.data,direct.image.data);record('clip hidden RGB cannot warp alpha geometry');
 const authored=raster(raw,{sourceRects:direct.rects});assert.deepEqual(authored.image.data,direct.image.data);record('explicit reviewed source crops match adaptive transparent-gutter crops');
 assert.throws(()=>raster(raw,{sourceRects:direct.rects.map((r,i)=>i? r:{...r,x:-1})}),/crop.*bounds/);record('negative crop origin rejected');
 assert.throws(()=>raster(raw,{alphaThreshold:32}),/contract128/);assert.throws(()=>raster(raw,{maxColors:25}),/ceiling/);assert.throws(()=>importGeneratedClip(raw,{...opts,sampling:'unknown' as never}),/sampling/);record('alpha threshold palette ceiling and unknown sampling rejected');
 const bad=poses();for(let y=58;y<60;y++)for(let x=0;x<64;x++)setPixel(bad[5]!,x,y,[0,0,0,0]);const drift=raster(atlas(bad)),changedFeet=drift.sourceFrameMetrics.map(m=>m.outputInk!.y+m.outputInk!.height);assert(Math.max(...changedFeet)-Math.min(...changedFeet)>=2);assert(new Set(drift.sourceFrameMetrics.map(m=>m.sourceFeetBottom)).size>1);record('actual source body shortening remains visible and requires semantic rejection, never normalized away',{changedFeet,semanticReviewRequired:true});
 const same=poses()[0]!,translated=Array.from({length:6},(_,i)=>{const f=createImage(64,64);for(let y=0;y<64;y++)for(let x=0;x<60;x++)setPixel(f,x+i%3,y,pixelAt(same,x,y));return f;}),still=raster(atlas(translated));assert.equal(checkClip(still.image,meta()).pass,false);record('source translation only cannot advertise drawn raster animation');
 const custom=raster(raw,{frameHeight:96});assert.equal(custom.image.height,96);assert.equal(checkClip(custom.image,meta(96)).pass,true);record('explicit custom64x96 remains separate from Emerald64x64 profile');
 const report={version:VERSION,base,results,count:results.length};writeFileSync(join(base,'verification.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
}
try{main();}catch(error){console.error(error);process.exitCode=1;}
