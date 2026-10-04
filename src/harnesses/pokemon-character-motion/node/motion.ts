import { createHash } from "node:crypto";
import { createImage, cropImage, cropToInk, opaqueBounds, pixelAt, setPixel, rgbKey, keyRgb, type RgbaImage, type Box } from "../../monster-collect-species/pixel/image";
import { extractGrid, edgeProfiles } from "../../monster-collect-species/pixel/grid";
import { labDistance, oklabCached } from "../../monster-collect-species/pixel/oklab";

export const WIDTH=16, HEIGHT=32, ROWS=["up","right","down","left"], ORDER=[0,1,2,1];
export const LIMITS={paletteUnionMax:15,inkHeightMin:18,inkHeightMax:22,topMin:10,topMax:13,feetBottomMin:30,feetBottomMax:32,fitInkHeight:21,headJitterMax:1,bodySizeRatioMax:1.25,areaRatioMax:1.3,seamChangeMax:0.36,stepChangeMin:4,margin:0};
export const VERSION="pokemon-motion-2";
export const EDITOR_WIDTH=24,EDITOR_PADDING_X=4;
export const sha=(value:Uint8Array|string)=>createHash("sha256").update(value).digest("hex");
export function framesFromNative(image:RgbaImage,slot?:number):RgbaImage[]{
  if(image.width===48&&image.height===128){if(slot!==undefined&&slot!==0)throw Error("single native role only has slot0");return Array.from({length:12},(_,i)=>cropImage(image,{x:(i%3)*WIDTH,y:Math.floor(i/3)*HEIGHT,width:WIDTH,height:HEIGHT}));}
  if(image.width===72&&image.height===128){if(slot!==undefined&&slot!==0)throw Error("single editor role only has slot0");}
  else if(image.width===288&&image.height===256){if(!Number.isInteger(slot)||slot!<0||slot!>7)throw Error("editor288x256 pack requires --slot0..7");}
  else throw Error(`charset dimensions ${image.width}x${image.height}; expected native48x128 or editor72x128/288x256`);
  const sx=image.width===72?0:((slot!%4)*72),sy=image.width===72?0:Math.floor(slot!/4)*128;
  return Array.from({length:12},(_,i)=>{const cell=cropImage(image,{x:sx+(i%3)*EDITOR_WIDTH,y:sy+Math.floor(i/3)*HEIGHT,width:EDITOR_WIDTH,height:HEIGHT});for(let y=0;y<HEIGHT;y++)for(let x=0;x<EDITOR_WIDTH;x++)if((x<EDITOR_PADDING_X||x>=EDITOR_PADDING_X+WIDTH)&&pixelAt(cell,x,y)[3])throw Error(`editor frame${i} ink outside central16px; source contract wrong, do not crop it`);return cropImage(cell,{x:EDITOR_PADDING_X,y:0,width:WIDTH,height:HEIGHT});});
}
export function pack(frames:RgbaImage[]):RgbaImage{
  if(frames.length!==12)throw Error("12 frames required");const out=createImage(WIDTH*3,HEIGHT*4);
  frames.forEach((f,i)=>{if(f.width!==WIDTH||f.height!==HEIGHT)throw Error("frame dimensions");for(let y=0;y<HEIGHT;y++)for(let x=0;x<WIDTH;x++)setPixel(out,i%3*WIDTH+x,Math.floor(i/3)*HEIGHT+y,pixelAt(f,x,y));});return out;
}
/** Engine adapter only: exact native pixels at x+4, never a resize/stretch. */
export function toEditorCharset(native:RgbaImage):RgbaImage{const frames=framesFromNative(native),out=createImage(EDITOR_WIDTH*3,HEIGHT*4);frames.forEach((f,i)=>{for(let y=0;y<HEIGHT;y++)for(let x=0;x<WIDTH;x++)setPixel(out,(i%3)*EDITOR_WIDTH+EDITOR_PADDING_X+x,Math.floor(i/3)*HEIGHT+y,pixelAt(f,x,y));});return out;}
function normalizeIdleBaseline(frames:RgbaImage[]){return frames.map((f,i)=>{const row=Math.floor(i/3),idle=opaqueBounds(frames[row*3+1]!);if(!idle)throw Error("idle frame missing");const offset=31-idle.y-idle.height;if(Math.abs(offset)>1)throw Error(`idle baseline alignment exceeds1px (${offset})`);const out=createImage(WIDTH,HEIGHT);for(let y=0;y<f.height;y++)for(let x=0;x<WIDTH;x++){const p=pixelAt(f,x,y);if(!p[3])continue;if(y+offset<0||y+offset>=HEIGHT)throw Error("idle baseline alignment clips source");setPixel(out,x,y+offset,p);}return out;});}
const median=(values:number[])=>{const ordered=[...values].sort((a,b)=>a-b),middle=Math.floor(ordered.length/2);return ordered.length%2?ordered[middle]!:(ordered[middle-1]!+ordered[middle]!)/2;};
/** Dominant contiguous ink run excludes detached hair tips; medians resist one-row tufts. */
function skullRows(width:number,start:number,end:number,isInk:(x:number,y:number)=>boolean){
  const rows:{center:number;width:number}[]=[];
  for(let y=start;y<end;y++){let bestStart=-1,bestLength=0,run=-1;for(let x=0;x<=width;x++){if(x<width&&isInk(x,y)){if(run<0)run=x;}else if(run>=0){if(x-run>bestLength){bestStart=run;bestLength=x-run;}run=-1;}}if(bestLength)rows.push({center:bestStart+(bestLength-1)/2,width:bestLength});}
  return rows;
}
function head(image:RgbaImage){
  const b=opaqueBounds(image);if(!b)return null;
  const rows=skullRows(image.width,b.y,Math.min(b.y+9,b.y+b.height),(x,y)=>pixelAt(image,x,y)[3]>0);
  const centers=rows.slice(0,6).map(r=>r.center);
  return {x:Math.round(median(centers)),y:b.y,width:median(rows.map(r=>r.width)),skullCenter:median(centers)};
}
// Generic portraits keep their independent broad silhouette alignment contract.
function clipHead(image:RgbaImage){const b=opaqueBounds(image);if(!b)return null;let sum=0,count=0;for(let y=b.y;y<Math.min(b.y+9,b.y+b.height);y++)for(let x=0;x<image.width;x++)if(pixelAt(image,x,y)[3]){sum+=x;count++;}return {x:Math.round(sum/count),y:b.y};}
function pixels(image:RgbaImage){let n=0;for(let i=3;i<image.data.length;i+=4)if(image.data[i])n++;return n;}
function diff(a:RgbaImage,b:RgbaImage,fromY=0,toY=a.height){let n=0;for(let y=fromY;y<Math.min(toY,a.height);y++)for(let x=0;x<a.width;x++){const pa=pixelAt(a,x,y),pb=pixelAt(b,x,y);if((pa[3]>0)!==(pb[3]>0)){n++;continue;}if(pa[3]&&labDistance(oklabCached(pa[0],pa[1],pa[2]),oklabCached(pb[0],pb[1],pb[2]))>=0.12)n++;}return n;}
function torso(image:RgbaImage){
  const b=opaqueBounds(image)!,h=head(image)!,start=b.y+9,end=Math.min(b.y+b.height, b.y+Math.round(b.height*.65));const widths:number[]=[];let core=0;
  for(let y=start;y<end;y++){let l=h.x,r=h.x;if(pixelAt(image,h.x,y)[3]){while(l>0&&pixelAt(image,l-1,y)[3])l--;while(r+1<image.width&&pixelAt(image,r+1,y)[3])r++;widths.push(r-l+1);}for(let x=Math.max(0,h.x-3);x<=Math.min(image.width-1,h.x+3);x++)if(pixelAt(image,x,y)[3])core++;}
  widths.sort((a,b)=>a-b);let headArea=0;for(let y=b.y;y<Math.min(b.y+9,image.height);y++)for(let x=0;x<image.width;x++)if(pixelAt(image,x,y)[3])headArea++;
  return {width:widths[Math.floor(widths.length*.3)]??0,core,headArea};
}
function stableChange(a:RgbaImage,b:RgbaImage,endY:number){
  const ha=head(a)!,hb=head(b)!,requestedShiftX=hb.x-ha.x,requestedShiftY=hb.y-ha.y;
  const registrationRejected=Math.abs(requestedShiftX)>1||Math.abs(requestedShiftY)>1;
  const compare=(shiftX:number,shiftY:number)=>{let changed=0,alphaChanged=0,union=0;for(let y=0;y<endY;y++)for(let x=0;x<a.width;x++){
    if(y>=ha.y+9&&Math.abs(x-ha.x)>3)continue;
    const pa=pixelAt(a,x,y),bx=x+shiftX,by=y+shiftY,pb=bx>=0&&bx<b.width&&by>=0&&by<b.height?pixelAt(b,bx,by):[0,0,0,0] as const;
    if(pa[3]||pb[3])union++;
    if((pa[3]>0)!==(pb[3]>0)){changed++;alphaChanged++;}else if(pa[3]&&labDistance(oklabCached(pa[0],pa[1],pa[2]),oklabCached(pb[0],pb[1],pb[2]))>=0.12)changed++;
  }return {significant:changed/Math.max(1,union),alpha:alphaChanged/Math.max(1,union),compareShiftX:shiftX,compareShiftY:shiftY};};
  // A rounded landmark is only a bounded request. Register actual stable pixels, never the artwork.
  const options=registrationRejected?[compare(0,0)]:[-1,0,1].flatMap(y=>[-1,0,1].map(x=>compare(x,y)));
  options.sort((u,v)=>u.significant-v.significant||u.alpha-v.alpha||(Math.abs(u.compareShiftX)+Math.abs(u.compareShiftY))-(Math.abs(v.compareShiftX)+Math.abs(v.compareShiftY))||Math.abs(u.compareShiftX-requestedShiftX)+Math.abs(u.compareShiftY-requestedShiftY)-Math.abs(v.compareShiftX-requestedShiftX)-Math.abs(v.compareShiftY-requestedShiftY));
  return {...options[0]!,requestedShiftX,requestedShiftY,registrationRejected};
}
/** Compare equal torso rows in idle coordinates, after bounded comparison-only registration. */
function canonicalTorso(trio:RgbaImage[],boxes:Box[]){
  const reference=trio[1]!,root=head(reference)!,startY=root.y+9,endY=root.y+Math.round(Math.min(...boxes.map(b=>b.height))*.65);
  const registration=trio.map(frame=>stableChange(reference,frame,endY));
  const core=trio.map((frame,i)=>{const r=registration[i]!;let area=0;for(let y=startY;y<endY;y++)for(let x=Math.max(0,root.x-3);x<=Math.min(WIDTH-1,root.x+3);x++){const sx=x+r.compareShiftX,sy=y+r.compareShiftY;if(sx>=0&&sx<WIDTH&&sy>=0&&sy<HEIGHT&&pixelAt(frame,sx,sy)[3])area++;}return area;});
  return {core,band:{referenceFrame:1,startY,endY,rows:endY-startY,centerX:root.x,halfWidth:3},registration:registration.map(r=>({x:r.compareShiftX,y:r.compareShiftY,requestedX:r.requestedShiftX,requestedY:r.requestedShiftY,rejected:r.registrationRejected}))};
}
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
    if(boxes.some(b=>b.width>WIDTH||b.x<0||b.x+b.width>WIDTH||b.y<limits.topMin||b.y>limits.topMax||b.height<limits.inkHeightMin||b.height>limits.inkHeightMax||b.y+b.height<limits.feetBottomMin||b.y+b.height>limits.feetBottomMax))errors.push(`${dir}: Emerald native ink bounds/height/top/feet contract`);
    const canonical=canonicalTorso(trio,boxes),torsos=trio.map((frame,i)=>({...torso(frame),core:canonical.core[i]!})),widthRatio=ratio(torsos.map(t=>t.width)),heightRatio=ratio(boxes.map(b=>b.height)),areaRatio=ratio(torsos.map(t=>t.core)),headWidthRatio=ratio(landmarks.map(h=>h.width)),headAreaRatio=ratio(torsos.map(t=>t.headArea));
    if(heightRatio>limits.bodySizeRatioMax||areaRatio>limits.areaRatioMax||headWidthRatio>limits.bodySizeRatioMax||headAreaRatio>limits.areaRatioMax)errors.push(`${dir}: gross head/torso size drift`);
    const lowerY=Math.min(...boxes.map(b=>b.y))+Math.round(Math.min(...boxes.map(b=>b.height))*0.60);
    const stepChange=diff(trio[0]!,trio[2]!,lowerY);
    if(stepChange<limits.stepChangeMin)errors.push(`${dir}: duplicate/frozen lower body (${stepChange})`);
    const upperEnd=Math.min(...boxes.map(b=>b.y+Math.round(b.height*.65)));
    const stable=ORDER.map((idx,i)=>stableChange(trio[idx]!,trio[ORDER[(i+1)%ORDER.length]!]!,upperEnd));
    const changes=stable.map(v=>v.significant),alphaChanges=stable.map(v=>v.alpha),wholeExactChanges=ORDER.map((idx,i)=>exactDifference(trio[idx]!,trio[ORDER[(i+1)%ORDER.length]!]!));
    if(Math.max(...wholeExactChanges)>limits.seamChangeMax)warnings.push(`${dir}: whole-frame exact color/pose change ${Math.max(...wholeExactChanges).toFixed(3)}; semantic playback required`);
    if(Math.max(...changes)>limits.seamChangeMax)errors.push(`${dir}: discontinuous cycle/seam ${Math.max(...changes).toFixed(3)}`);
    metrics[dir]={jitterX,jitterY,widthRatio,heightRatio,areaRatio,headWidthRatio,headAreaRatio,stepChange,changes,alphaChanges,comparisonRegistration:stable.map(v=>({x:v.compareShiftX,y:v.compareShiftY,requestedX:v.requestedShiftX,requestedY:v.requestedShiftY,rejected:v.registrationRejected})),wholeExactChanges,upperEnd,bounds:boxes,head:landmarks,torso:torsos,torsoBand:canonical.band,torsoRegistration:canonical.registration};
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
  const scale=Math.min(1,WIDTH/Math.max(...grids.map(g=>g.width)),LIMITS.fitInkHeight/Math.max(...grids.map(g=>g.height)));
  // Nearest sample chooses existing source colors; no outline reconnection/shape painting or per-pose fit.
  const scaled=grids.map(g=>{const out=createImage(Math.max(1,Math.round(g.width*scale)),Math.max(1,Math.round(g.height*scale)));for(let y=0;y<out.height;y++)for(let x=0;x<out.width;x++)setPixel(out,x,y,pixelAt(g,Math.min(g.width-1,Math.floor(x/scale)),Math.min(g.height-1,Math.floor(y/scale))));return out;});
  const frames=scaled.map(g=>{
    const h=head(g)!;const left=Math.round((WIDTH-1)/2-h.x),top=11;
    const out=createImage(WIDTH,HEIGHT);for(let y=0;y<g.height;y++)for(let x=0;x<g.width;x++){const p=pixelAt(g,x,y);if(!p[3])continue;const xx=left+x,yy=top+y;if(xx<0||xx>=WIDTH||yy<0||yy>=HEIGHT)throw Error("aligned body clips: regenerate source, do not crop it");setPixel(out,xx,yy,p);}
    return out;
  });
  const image=pack(normalizeIdleBaseline(frames));const palette=quantizePalette(image,15);
  return {image,rects,block,inferredBlocks:inferred,scale,palette};
}
/** All twelve frames share one frequency/Lab representative palette. No pixels are added or deleted. */
export function quantizePalette(image:RgbaImage,max:number){
  const counts=new Map<number,number>();for(let i=0;i<image.data.length;i+=4)if(image.data[i+3]){const k=rgbKey(image.data[i]!,image.data[i+1]!,image.data[i+2]!);counts.set(k,(counts.get(k)??0)+1);}
  const order=[...counts.keys()].sort((a,b)=>counts.get(b)!-counts.get(a)!||a-b),labs=new Map(order.map(k=>[k,oklabCached(...keyRgb(k))]));let reps:number[]=[],mapping=new Map<number,number>();
  for(let threshold=0.005;threshold<=2;threshold+=0.005){reps=[];mapping=new Map();for(const k of order){let best=-1,dist=Infinity;for(const r of reps){const d=labDistance(labs.get(k)!,labs.get(r)!);if(d<dist){best=r;dist=d;}}if(best>=0&&dist<threshold)mapping.set(k,best);else{reps.push(k);mapping.set(k,k);}}if(reps.length<=max)break;}
  for(let i=0;i<image.data.length;i+=4)if(image.data[i+3]){const p=keyRgb(mapping.get(rgbKey(image.data[i]!,image.data[i+1]!,image.data[i+2]!))!);image.data[i]=p[0];image.data[i+1]=p[1];image.data[i+2]=p[2];image.data[i+3]=255;}
  return reps.map(keyRgb);
}
export type ClipMetadata={id:string;frameWidth:number;frameHeight:number;fps:number;frameOrder:number[];sourceRects:Box[];durationsMs?:number[];kind:"drawn"|"translation";paletteUnionMax?:number};
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
  const colors=new Set<number>();frames.forEach((f,i)=>{const b=opaqueBounds(f)!;if(b.x<1||b.y<1||b.x+b.width>f.width-1||b.y+b.height>f.height-1)errors.push(`clip ${i} clipped/missing transparent margin`);for(let n=0;n<f.data.length;n+=4)if(f.data[n+3])colors.add(rgbKey(f.data[n]!,f.data[n+1]!,f.data[n+2]!));});const paletteMax=meta.paletteUnionMax??15;if(!Number.isInteger(paletteMax)||paletteMax<1||paletteMax>24)errors.push("clip palette ceiling invalid");if(colors.size>paletteMax)errors.push(`clip palette union ${colors.size}>${paletteMax}`);
  const normalized=frames.map(f=>{const c=cropToInk(f);for(let i=0;i<c.data.length;i+=4)if(!c.data[i+3])c.data.fill(0,i,i+4);return sha(`${c.width},${c.height}:`+sha(c.data));});
  if(meta.kind==="drawn"&&new Set(normalized).size<2)errors.push("advertised drawn clip is duplicate/translation-only");
  if(frames.length===meta.sourceRects.length){let max=0;for(let i=1;i<frames.length;i++)max=Math.max(max,diff(frames[0]!,frames[i]!));if(max<4)errors.push("clip has fewer than 4 meaningful changed pixels");}
  return {pass:errors.length===0,errors,frames,normalized,paletteUnion:colors.size};
}

/** Generated opening atlas -> actual drawn native strip. Source alpha only; no painted masks or poses. */
export function importGeneratedClip(source:RgbaImage,options:{columns:number;rows:number;frameWidth:number;frameHeight:number;block?:number;sourceRects?:Box[];alphaThreshold?:number;maxColors?:number}){
  const {columns,rows,frameWidth,frameHeight}=options;
  if(![columns,rows,frameWidth,frameHeight].every(v=>Number.isInteger(v)&&v>0)||columns*rows<2||columns*rows>64||frameWidth<4||frameHeight<4)throw Error("generated clip layout invalid");
  const alphaThreshold=options.alphaThreshold??128;
  if(alphaThreshold!==128)throw Error("generated clip alpha threshold must retain harness contract128");
  // source RGB under alpha is never used to infer a matte. Keep only the established visible-alpha threshold.
  const visible=createImage(source.width,source.height);for(let i=0;i<source.data.length;i+=4)if(source.data[i+3]!>=alphaThreshold){visible.data.set(source.data.subarray(i,i+3),i);visible.data[i+3]=255;}
  let rects:Box[];
  if(options.sourceRects){rects=options.sourceRects;if(rects.length!==columns*rows||rects.some(r=>![r.x,r.y,r.width,r.height].every(Number.isInteger)||r.x<0||r.y<0||r.width<1||r.height<1||r.x+r.width>source.width||r.y+r.height>source.height))throw Error("generated source crop count/bounds");}
  else{const py=new Array(source.height).fill(0);for(let y=0;y<source.height;y++)for(let x=0;x<source.width;x++)if(visible.data[(y*source.width+x)*4+3])py[y]++;
    const ys=ranges(py,rows);rects=[];ys.forEach(y=>{const px=new Array(source.width).fill(0);for(let yy=y.start;yy<y.end;yy++)for(let x=0;x<source.width;x++)if(visible.data[(yy*source.width+x)*4+3])px[x]++;ranges(px,columns).forEach(x=>rects.push({x:x.start,y:y.start,width:x.end-x.start,height:y.end-y.start}));});}
  const crops=rects.map(r=>cropImage(visible,r));const inferred=options.block===undefined?crops.map(c=>extractGrid(c,{minBlock:2}).block):[];
  const block=options.block??Math.round([...inferred].sort((a,b)=>a-b)[Math.floor(inferred.length/2)]!);
  const grids=crops.map(c=>extractGrid(c,{block}).cells),scale=Math.min(1,(frameWidth-4)/Math.max(...grids.map(g=>g.width)),(frameHeight-4)/Math.max(...grids.map(g=>g.height)));
  const frames=grids.map(g=>{const scaled=createImage(Math.max(1,Math.round(g.width*scale)),Math.max(1,Math.round(g.height*scale)));for(let y=0;y<scaled.height;y++)for(let x=0;x<scaled.width;x++)setPixel(scaled,x,y,pixelAt(g,Math.min(g.width-1,Math.floor(x/scale)),Math.min(g.height-1,Math.floor(y/scale))));
    const landmark=clipHead(scaled)!;const left=Math.round((frameWidth-1)/2-landmark.x),top=2,out=createImage(frameWidth,frameHeight);
    for(let y=0;y<scaled.height;y++)for(let x=0;x<scaled.width;x++){const p=pixelAt(scaled,x,y);if(!p[3])continue;const xx=left+x,yy=top+y;if(xx<1||xx>=frameWidth-1||yy<1||yy>=frameHeight-1)throw Error("generated clip alignment clips: regenerate source or author source crops");setPixel(out,xx,yy,p);}return out;});
  const image=createImage(frameWidth*frames.length,frameHeight);frames.forEach((f,i)=>{for(let y=0;y<f.height;y++)for(let x=0;x<f.width;x++)setPixel(image,i*frameWidth+x,y,pixelAt(f,x,y));});
  const maxColors=options.maxColors??15;if(!Number.isInteger(maxColors)||maxColors<1||maxColors>24)throw Error("clip palette ceiling1..24");const palette=quantizePalette(image,maxColors);
  return {image,rects,block,inferredBlocks:inferred,scale,palette,alphaThreshold,frameCount:frames.length};
}

/** Preserve frame coherence: align source silhouettes before shared nearest sampling. */
export function importRasterAtlas(source:RgbaImage){
  const bg=edgeProfiles(source).bg,py=new Array(source.height).fill(0);
  for(let y=0;y<source.height;y++)for(let x=0;x<source.width;x++)if(!bg[y*source.width+x])py[y]++;
  const rects:Box[]=[];
  ranges(py,4).forEach(y=>{
    const profile=new Array(source.width).fill(0);
    for(let yy=y.start;yy<y.end;yy++)for(let x=0;x<source.width;x++)if(!bg[yy*source.width+x])profile[x]++;
    ranges(profile,3).forEach(x=>rects.push({x:x.start,y:y.start,width:x.end-x.start,height:y.end-y.start}));
  });
  const inkBoxes=rects.map(r=>{const visible=createImage(r.width,r.height);for(let y=0;y<r.height;y++)for(let x=0;x<r.width;x++)if(!bg[(r.y+y)*source.width+r.x+x])setPixel(visible,x,y,[0,0,0,255]);const b=opaqueBounds(visible);if(!b)throw Error("empty source head silhouette");return b;});
  // All poses share both a scale and row origin. Include walking bob above the ink bbox.
  const widthScale=WIDTH/Math.max(...inkBoxes.map(r=>r.width)),heightScale=LIMITS.fitInkHeight/Math.max(...inkBoxes.map(r=>r.y+r.height));
  let scale=Math.min(1,widthScale,heightScale);
  const iterations:{scale:number;leftScale:number;rightScale:number}[]=[];
  let fit:{skullCenter:number;leftExtent:number;rightExtent:number;topRelativeHeight:number;ink:Box}[]=[];
  for(let iteration=0;iteration<16;iteration++){
    fit=rects.map((r,i)=>{const ink=inkBoxes[i]!,isInk=(x:number,y:number)=>!bg[(r.y+y)*source.width+r.x+x],rows=skullRows(r.width,ink.y,Math.min(r.height,ink.y+6/scale),isInk);if(!rows.length)throw Error("empty source head silhouette");const skullCenter=median(rows.map(row=>row.center));return {skullCenter,leftExtent:skullCenter-ink.x+.5,rightExtent:ink.x+ink.width-.5-skullCenter,topRelativeHeight:ink.y+ink.height,ink};});
    const leftScale=(WIDTH/2)/Math.max(...fit.map(f=>f.leftExtent)),rightScale=(WIDTH/2)/Math.max(...fit.map(f=>f.rightExtent));
    iterations.push({scale,leftScale,rightScale});
    const next=Math.min(scale,leftScale,rightScale);
    if(Math.abs(next-scale)<1e-10)break;
    scale=next;if(iteration===15)throw Error("common source skull/extent scale did not converge; regenerate source");
  }
  const commonScaleFit={anchorX:7.5,anchorY:11,halfWidth:WIDTH/2,fitInkHeight:LIMITS.fitInkHeight,widthScale,heightScale,scale,iterations,frames:fit};
  const frames=rects.map((r,i)=>{
    const isInk=(x:number,y:number)=>!bg[(r.y+y)*source.width+r.x+x];
    const cx=fit[i]!.skullCenter,out=createImage(WIDTH,HEIGHT+2);
    // Inspect samples outside the output as well: a bad anchor must fail rather than silently crop ink.
    for(let y=11;y<Math.ceil(r.height*scale)+12;y++)for(let x=-WIDTH;x<WIDTH*2;x++){
      const sx=Math.floor(cx+(x-7.5)/scale),sy=Math.floor((y-11+.5)/scale);
      if(sx<0||sx>=r.width||sy<0||sy>=r.height||!isInk(sx,sy))continue;
      if(x<0||x>=WIDTH||y<0||y>=HEIGHT+2)throw Error("aligned source raster clips: regenerate source; common fit="+JSON.stringify(commonScaleFit));
      const pixel=pixelAt(source,r.x+sx,r.y+sy);setPixel(out,x,y,[pixel[0],pixel[1],pixel[2],255]);
    }
    return out;
  });
  let aligned:RgbaImage[];try{aligned=normalizeIdleBaseline(frames);}catch(error){throw Error(String(error)+"; common fit="+JSON.stringify(commonScaleFit));}
  const image=pack(aligned),palette=quantizePalette(image,15);
  return {image,rects,scale,commonScaleFit,palette,sampling:"common-source-raster",alphaThreshold:128,phase:0.5,nativeFrameWidth:16,nativeFrameHeight:32,fitInkHeight:21,idleFeetBottomExclusive:31,headBandRows:6,headAlignment:"source dominant contiguous skull-row median before sampling"};
}
