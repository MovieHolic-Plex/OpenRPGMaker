import { createHash } from "node:crypto";
import { createImage, cropImage, cropToInk, opaqueBounds, pixelAt, setPixel, rgbKey, keyRgb, type RgbaImage, type Box } from "../../monster-collect-species/pixel/image";
import { extractGrid, edgeProfiles } from "../../monster-collect-species/pixel/grid";
import { labDistance, oklabCached } from "../../monster-collect-species/pixel/oklab";

export const WIDTH=24, HEIGHT=32, ROWS=["up","right","down","left"], ORDER=[0,1,2,1];
export const LIMITS={paletteUnionMax:24,headJitterMax:1,bodySizeRatioMax:1.25,areaRatioMax:1.3,seamChangeMax:0.36,stepChangeMin:4,margin:1};
export const VERSION="pokemon-motion-1";
export const sha=(value:Uint8Array|string)=>createHash("sha256").update(value).digest("hex");
export function framesFromNative(image:RgbaImage,slot?:number):RgbaImage[]{
  if(image.width===72&&image.height===128){if(slot!==undefined&&slot!==0)throw Error("single-role sheet only has slot 0");}
  else if(image.width===288&&image.height===256){if(!Number.isInteger(slot)||slot!<0||slot!>7)throw Error("288x256 pack requires --slot 0..7");}
  else throw Error(`charset dimensions ${image.width}x${image.height}; expected 72x128 or legacy 288x256`);
  const sx=image.width===72?0:((slot!%4)*72),sy=image.width===72?0:Math.floor(slot!/4)*128;
  return Array.from({length:12},(_,i)=>cropImage(image,{x:sx+(i%3)*WIDTH,y:sy+Math.floor(i/3)*HEIGHT,width:WIDTH,height:HEIGHT}));
}
export function pack(frames:RgbaImage[]):RgbaImage{
  if(frames.length!==12)throw Error("12 frames required");const out=createImage(72,128);
  frames.forEach((f,i)=>{if(f.width!==WIDTH||f.height!==HEIGHT)throw Error("frame dimensions");for(let y=0;y<HEIGHT;y++)for(let x=0;x<WIDTH;x++)setPixel(out,i%3*WIDTH+x,Math.floor(i/3)*HEIGHT+y,pixelAt(f,x,y));});return out;
}
function head(image:RgbaImage){
  const b=opaqueBounds(image);if(!b)return null;
  // Top nine native rows define a stable silhouette landmark. A semantic face detector is deliberately not claimed.
  const bottom=Math.min(b.y+8,b.y+b.height-1);let minX=image.width,maxX=-1,sumX=0,count=0;
  for(let y=b.y;y<=bottom;y++)for(let x=0;x<image.width;x++)if(pixelAt(image,x,y)[3]>0){minX=Math.min(x,minX);maxX=Math.max(x,maxX);sumX+=x;count++;}
  return {x:Math.round(sumX/count),y:b.y,width:maxX-minX+1};
}
function pixels(image:RgbaImage){let n=0;for(let i=3;i<image.data.length;i+=4)if(image.data[i])n++;return n;}
function diff(a:RgbaImage,b:RgbaImage,fromY=0,toY=a.height){let n=0;for(let y=fromY;y<Math.min(toY,a.height);y++)for(let x=0;x<a.width;x++){const pa=pixelAt(a,x,y),pb=pixelAt(b,x,y);if((pa[3]>0)!==(pb[3]>0)){n++;continue;}if(pa[3]&&labDistance(oklabCached(pa[0],pa[1],pa[2]),oklabCached(pb[0],pb[1],pb[2]))>=0.12)n++;}return n;}
function torso(image:RgbaImage){
  const b=opaqueBounds(image)!,h=head(image)!,start=b.y+9,end=Math.min(b.y+b.height, b.y+Math.round(b.height*.65));const widths:number[]=[];let core=0;
  for(let y=start;y<end;y++){let l=h.x,r=h.x;if(pixelAt(image,h.x,y)[3]){while(l>0&&pixelAt(image,l-1,y)[3])l--;while(r+1<image.width&&pixelAt(image,r+1,y)[3])r++;widths.push(r-l+1);}for(let x=Math.max(0,h.x-3);x<=Math.min(image.width-1,h.x+3);x++)if(pixelAt(image,x,y)[3])core++;}
  widths.sort((a,b)=>a-b);let headArea=0;for(let y=b.y;y<Math.min(b.y+9,image.height);y++)for(let x=0;x<image.width;x++)if(pixelAt(image,x,y)[3])headArea++;
  return {width:widths[Math.floor(widths.length*.3)]??0,core,headArea};
}
function stableChange(a:RgbaImage,b:RgbaImage,headBottom:number,endY:number,center:number){let changed=0,alphaChanged=0,union=0;for(let y=0;y<endY;y++)for(let x=0;x<a.width;x++){
  if(y>=headBottom&&Math.abs(x-center)>3)continue;const pa=pixelAt(a,x,y),pb=pixelAt(b,x,y);if(pa[3]||pb[3])union++;if((pa[3]>0)!==(pb[3]>0)){changed++;alphaChanged++;}else if(pa[3]&&labDistance(oklabCached(pa[0],pa[1],pa[2]),oklabCached(pb[0],pb[1],pb[2]))>=0.12)changed++;
}return {significant:changed/Math.max(1,union),alpha:alphaChanged/Math.max(1,union)};}
function exactDifference(a:RgbaImage,b:RgbaImage){let n=0;for(let i=0;i<a.data.length;i+=4)if((a.data[i+3]||b.data[i+3])&&a.data.subarray(i,i+4).some((v,j)=>v!==b.data[i+j]))n++;return n/Math.max(pixels(a),pixels(b));}
const spread=(v:number[])=>Math.max(...v)-Math.min(...v);
const ratio=(v:number[])=>Math.max(...v)/Math.max(1,Math.min(...v));
export function checkCharset(image:RgbaImage, limits=LIMITS){
  const errors:string[]=[],warnings:string[]=[],metrics:Record<string,unknown>={};let frames:RgbaImage[];
  try{frames=framesFromNative(image);}catch(e){return {pass:false,errors:[String(e)],warnings,metrics};}
  const colors=new Set<number>();let alpha=0;
  image.data.forEach((v,i)=>{if(i%4===3){if(v!==0&&v!==255)alpha++;if(v)colors.add(rgbKey(image.data[i-3]!,image.data[i-2]!,image.data[i-1]!));}});
  metrics.paletteUnion=colors.size;metrics.nonBinaryAlpha=alpha;
  if(alpha)errors.push(`alpha: ${alpha} non-binary pixels`);
  if(colors.size>limits.paletteUnionMax)errors.push(`palette union ${colors.size}>${limits.paletteUnionMax}`);
  ROWS.forEach((dir,row)=>{
    const trio=frames.slice(row*3,row*3+3),bounds=trio.map(opaqueBounds),heads=trio.map(head);
    if(bounds.some(b=>!b)||heads.some(h=>!h)){errors.push(`${dir}: empty/truncated frame`);return;}
    const boxes=bounds as Box[],landmarks=heads as NonNullable<ReturnType<typeof head>>[];
    const jitterX=spread(landmarks.map(h=>h.x)),jitterY=spread(landmarks.map(h=>h.y));
    if(jitterX>limits.headJitterMax||jitterY>limits.headJitterMax)errors.push(`${dir}: head jitter ${jitterX},${jitterY}`);
    if(boxes.some(b=>b.x<limits.margin||b.y<limits.margin||b.x+b.width>WIDTH-limits.margin||b.y+b.height>HEIGHT-limits.margin))errors.push(`${dir}: clipped/missing transparent margin`);
    const torsos=trio.map(torso),widthRatio=ratio(torsos.map(t=>t.width)),heightRatio=ratio(boxes.map(b=>b.height)),areaRatio=ratio(torsos.map(t=>t.core)),headWidthRatio=ratio(landmarks.map(h=>h.width)),headAreaRatio=ratio(torsos.map(t=>t.headArea));
    if(heightRatio>limits.bodySizeRatioMax||areaRatio>limits.areaRatioMax||headWidthRatio>limits.bodySizeRatioMax||headAreaRatio>limits.areaRatioMax)errors.push(`${dir}: gross head/torso size drift`);
    const lowerY=Math.min(...boxes.map(b=>b.y))+Math.round(Math.min(...boxes.map(b=>b.height))*0.60);
    const stepChange=diff(trio[0]!,trio[2]!,lowerY);
    if(stepChange<limits.stepChangeMin)errors.push(`${dir}: duplicate/frozen lower body (${stepChange})`);
    const upperEnd=Math.min(...boxes.map(b=>b.y+Math.round(b.height*.65)));
    const stable=ORDER.map((idx,i)=>stableChange(trio[idx]!,trio[ORDER[(i+1)%ORDER.length]!]!,Math.min(...boxes.map(b=>b.y))+9,upperEnd,Math.round(landmarks.reduce((n,h)=>n+h.x,0)/3)));
    const changes=stable.map(v=>v.significant),alphaChanges=stable.map(v=>v.alpha),wholeExactChanges=ORDER.map((idx,i)=>exactDifference(trio[idx]!,trio[ORDER[(i+1)%ORDER.length]!]!));
    if(Math.max(...wholeExactChanges)>limits.seamChangeMax)warnings.push(`${dir}: whole-frame exact color/pose change ${Math.max(...wholeExactChanges).toFixed(3)}; semantic playback required`);
    if(Math.max(...changes)>limits.seamChangeMax)errors.push(`${dir}: discontinuous cycle/seam ${Math.max(...changes).toFixed(3)}`);
    metrics[dir]={jitterX,jitterY,widthRatio,heightRatio,areaRatio,headWidthRatio,headAreaRatio,stepChange,changes,alphaChanges,wholeExactChanges,upperEnd,bounds:boxes,head:landmarks,torso:torsos};
  });
  return {pass:errors.length===0,errors,warnings,metrics};
}
function ranges(profile:number[], expected:number){
  const occupied=profile.map(v=>v>0);const spans:{start:number,end:number}[]=[];let start=-1;
  for(let i=0;i<=occupied.length;i++){if(occupied[i]&&start<0)start=i;if(!occupied[i]&&start>=0){spans.push({start,end:i});start=-1;}}
  // Ignore tiny noise islands between substantial body regions; the row/column partition remains traceable.
  const large=spans.filter(s=>s.end-s.start>=Math.max(2,profile.length/expected/12));
  if(large.length===expected)return large.map(s=>({start:s.start,end:s.end}));
  // Nominal grid search snaps separators to transparent gutter runs near the expected boundary.
  const cuts=[0];for(let k=1;k<expected;k++){
    const nominal=Math.round(profile.length*k/expected),lo=Math.round(nominal-profile.length/expected*.25),hi=Math.round(nominal+profile.length/expected*.25);
    let best=-1,bestDistance=Infinity;for(let i=Math.max(1,lo);i<Math.min(profile.length-1,hi);i++)if(profile[i]===0&&Math.abs(i-nominal)<bestDistance){best=i;bestDistance=Math.abs(i-nominal);}
    if(best<0)throw Error(`cannot find transparent gutter ${k}/${expected}`);cuts.push(best);
  }cuts.push(profile.length);return cuts.slice(0,-1).map((s,i)=>({start:s,end:cuts[i+1]!}));
}
/** One role atlas; common block and scale for all poses, only native translations align each direction's head root. */
export function importAtlas(source:RgbaImage, fixedBlock?:number){
  const bg=edgeProfiles(source).bg,px=new Array(source.width).fill(0),py=new Array(source.height).fill(0);
  for(let y=0;y<source.height;y++)for(let x=0;x<source.width;x++)if(!bg[y*source.width+x]){px[x]++;py[y]++;}
  const ys=ranges(py,4),rects:Box[]=[];
  ys.forEach(y=>{const local=new Array(source.width).fill(0);for(let yy=y.start;yy<y.end;yy++)for(let x=0;x<source.width;x++)if(!bg[yy*source.width+x])local[x]++;
    ranges(local,3).forEach(x=>rects.push({x:x.start,y:y.start,width:x.end-x.start,height:y.end-y.start}));});
  const cropped=rects.map(r=>cropImage(source,r));
  const inferred=fixedBlock===undefined?cropped.map(c=>extractGrid(c,{minBlock:2}).block):[];
  const block=fixedBlock??Math.round([...inferred].sort((a,b)=>a-b)[Math.floor(inferred.length/2)]!);
  const grids=cropped.map(c=>extractGrid(c,{block}).cells);
  const scale=Math.min(1,(WIDTH-4)/Math.max(...grids.map(g=>g.width)),(HEIGHT-4)/Math.max(...grids.map(g=>g.height)));
  // Nearest sample chooses existing source colors; no outline reconnection/shape painting or per-pose fit.
  const scaled=grids.map(g=>{const out=createImage(Math.max(1,Math.round(g.width*scale)),Math.max(1,Math.round(g.height*scale)));for(let y=0;y<out.height;y++)for(let x=0;x<out.width;x++)setPixel(out,x,y,pixelAt(g,Math.min(g.width-1,Math.floor(x/scale)),Math.min(g.height-1,Math.floor(y/scale))));return out;});
  const frames=scaled.map(g=>{
    const h=head(g)!;const left=Math.round((WIDTH-1)/2-h.x),top=2;
    const out=createImage(WIDTH,HEIGHT);for(let y=0;y<g.height;y++)for(let x=0;x<g.width;x++){const p=pixelAt(g,x,y);if(!p[3])continue;const xx=left+x,yy=top+y;if(xx<1||xx>=WIDTH-1||yy<1||yy>=HEIGHT-1)throw Error("aligned body clips: regenerate source, do not crop it");setPixel(out,xx,yy,p);}
    return out;
  });
  const image=pack(frames);const palette=quantizePalette(image,24);
  return {image,rects,block,inferredBlocks:inferred,scale,palette};
}
/** All twelve frames share one frequency/Lab representative palette. No pixels are added or deleted. */
function quantizePalette(image:RgbaImage,max:number){
  const counts=new Map<number,number>();for(let i=0;i<image.data.length;i+=4)if(image.data[i+3]){const k=rgbKey(image.data[i]!,image.data[i+1]!,image.data[i+2]!);counts.set(k,(counts.get(k)??0)+1);}
  const order=[...counts.keys()].sort((a,b)=>counts.get(b)!-counts.get(a)!||a-b),labs=new Map(order.map(k=>[k,oklabCached(...keyRgb(k))]));let reps:number[]=[],mapping=new Map<number,number>();
  for(let threshold=0.005;threshold<=2;threshold+=0.005){reps=[];mapping=new Map();for(const k of order){let best=-1,dist=Infinity;for(const r of reps){const d=labDistance(labs.get(k)!,labs.get(r)!);if(d<dist){best=r;dist=d;}}if(best>=0&&dist<threshold)mapping.set(k,best);else{reps.push(k);mapping.set(k,k);}}if(reps.length<=max)break;}
  for(let i=0;i<image.data.length;i+=4)if(image.data[i+3]){const p=keyRgb(mapping.get(rgbKey(image.data[i]!,image.data[i+1]!,image.data[i+2]!))!);image.data[i]=p[0];image.data[i+1]=p[1];image.data[i+2]=p[2];image.data[i+3]=255;}
  return reps.map(keyRgb);
}
export type ClipMetadata={id:string;frameWidth:number;frameHeight:number;fps:number;frameOrder:number[];sourceRects:Box[];durationsMs?:number[];kind:"drawn"|"translation"};
export function checkClip(source:RgbaImage,meta:ClipMetadata){
  const errors:string[]=[];const int=(n:number)=>Number.isInteger(n)&&n>0;
  if(!meta||!int(meta.frameWidth)||!int(meta.frameHeight)||!Number.isFinite(meta.fps)||meta.fps<=0||meta.fps>60||!Array.isArray(meta.sourceRects)||meta.sourceRects.length<2||meta.sourceRects.length>64||!Array.isArray(meta.frameOrder)||meta.frameOrder.length<2)throw Error("clip metadata invalid (size/fps/count/order)");
  if(meta.kind!=="drawn"&&meta.kind!=="translation")errors.push("clip kind must be explicit drawn or translation");
  if(meta.frameOrder.some(i=>!Number.isInteger(i)||i<0||i>=meta.sourceRects.length)||new Set(meta.frameOrder).size!==meta.sourceRects.length)errors.push("clip order missing/out-of-range frames");
  if(meta.durationsMs&&(meta.durationsMs.length!==meta.frameOrder.length||meta.durationsMs.some(v=>!Number.isFinite(v)||v<16||v>10000)))errors.push("clip durations invalid");
  const frames:RgbaImage[]=[];meta.sourceRects.forEach((r,i)=>{
    if(!r||![r.x,r.y,r.width,r.height].every(Number.isInteger)||r.x<0||r.y<0||r.width!==meta.frameWidth||r.height!==meta.frameHeight||r.x+r.width>source.width||r.y+r.height>source.height){errors.push(`clip crop ${i} bounds/size`);return;}
    const f=cropImage(source,r);if(f.data.some((v,j)=>j%4===3&&v!==0&&v!==255))errors.push(`clip ${i} nonbinary alpha`);if(!opaqueBounds(f)){errors.push(`clip ${i} empty`);return;}frames.push(f);
  });
  const normalized=frames.map(f=>{const c=cropToInk(f);for(let i=0;i<c.data.length;i+=4)if(!c.data[i+3])c.data.fill(0,i,i+4);return sha(`${c.width},${c.height}:`+sha(c.data));});
  if(meta.kind==="drawn"&&new Set(normalized).size<2)errors.push("advertised drawn clip is duplicate/translation-only");
  if(frames.length===meta.sourceRects.length){let max=0;for(let i=1;i<frames.length;i++)max=Math.max(max,diff(frames[0]!,frames[i]!));if(max<4)errors.push("clip has fewer than 4 meaningful changed pixels");}
  return {pass:errors.length===0,errors,frames,normalized};
}
