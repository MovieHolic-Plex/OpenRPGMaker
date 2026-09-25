// User-local sprite references. Reference owners are not gameplay tiles or objects.
import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import pngjs from 'pngjs';
import {withTsModule} from '../ontology-ts-loader.mjs';
const [planFile,originals,receiptFile,out]=process.argv.slice(2);
if(!out)throw Error('Usage: <private install-plan.json> <originals directory> <canonical receipt> <private output>');
const read=async p=>JSON.parse(await fs.readFile(p,'utf8')),hash=x=>createHash('sha256').update(x).digest('hex');
const catalog=await read('src/assets/pixelArtWorldEventProps.json'),plan=await read(planFile),source=await read(receiptFile);
if(!source.projectId||!source.projectDir||!source.sha256)throw Error('Canonical identity missing');
const allowed=catalog.packs.filter(p=>p.rights.runtimeImportAllowed&&p.rights.sharedProjectDefaultsAllowed);
const prepared=await read(plan.preparedFile),ids=new Set(prepared.map(p=>p.packId));
if(ids.size!==allowed.length||prepared.length!==allowed.length||allowed.some(p=>!ids.has(p.id)))throw Error('Prepared coverage differs');
const lib={version:1,projectDefaults:true,roots:[],places:{},regions:{},maps:{},tilesets:{},assets:{},previews:{},sourceProjectId:source.projectId};
const sources=[];
for(const p of allowed){
 const item=prepared.find(i=>i.packId===p.id),id='shared_'+p.id.replaceAll('-','_');
 const relative=new URL(p.downloadUrl).pathname.split('/dotartworld/')[1];
 if(!relative||relative.includes('..'))throw Error('Unexpected source URL');
 const bytes=await fs.readFile(path.join(originals,'by-source',relative));
 if(hash(bytes)!==p.sha256||item.sourceSha256!==p.sha256||item.asset.id!==id||item.asset.kind!=='sprite'||item.references.id!==p.id)throw Error('Source identity differs '+p.id);
 const sourcePng=pngjs.PNG.sync.read(bytes),atlas=pngjs.PNG.sync.read(Buffer.from(item.asset.dataUrl.split(',')[1],'base64'));
 const normalized=pngjs.PNG.sync.read(Buffer.from(item.references.images.find(i=>i.id==='source').dataUrl.split(',')[1],'base64'));
 if(normalized.width!==sourcePng.width||normalized.height!==sourcePng.height)throw Error('Normalized source shape differs');
 let quantizedChannels=0;
 for(let i=0;i<sourcePng.data.length;i+=4){
  const alpha=sourcePng.data[i+3];if(normalized.data[i+3]!==alpha)throw Error('Normalized source alpha differs '+p.id);
  // Canvas stores premultiplied channels. Its PNG readback can round low-alpha
  // RGB heavily, but must preserve each original premultiplied channel exactly.
  if(alpha)for(let k=0;k<3;k++){
   const a=sourcePng.data[i+k],b=normalized.data[i+k];
   if(Math.round(a*alpha/255)!==Math.round(b*alpha/255))throw Error('Normalized source color differs '+p.id);
   if(a!==b)quantizedChannels++;
  }
 }
 const expectedMeta={width:4*p.frameWidth,height:Math.ceil(p.frames.length/4)*p.frameHeight,frameWidth:p.frameWidth,frameHeight:p.frameHeight,frames:p.frames.length};
 if(sourcePng.width!==p.width||sourcePng.height!==p.height||atlas.width!==expectedMeta.width||atlas.height!==expectedMeta.height||Object.entries(expectedMeta).some(([k,v])=>item.asset.meta[k]!==v))throw Error('Sprite geometry differs '+p.id);
 for(const frame of p.frames){
  const[ox,oy]=frame.atlasOffset;
  const composite=p.frameComposites?.find(c=>c.index===frame.index);
  const parts=composite?.parts??[{sourceRect:frame.sourceRect,destination:[0,0]}];
  const expected=new Uint8Array(p.frameWidth*p.frameHeight*4);
  const covered=new Set();
  for(const part of parts){
   const[sx,sy,w,h]=part.sourceRect,[dx,dy]=part.destination;
   if(sx<0||sy<0||sx+w>sourcePng.width||sy+h>sourcePng.height||ox+dx<0||oy+dy<0||ox+dx+w>p.frameWidth||oy+dy+h>p.frameHeight)throw Error('Frame part bounds differ '+p.id);
   for(let y=0;y<h;y++)for(let x=0;x<w;x++){
    const pixel=(oy+dy+y)*p.frameWidth+ox+dx+x;
    if(covered.has(pixel))throw Error('Overlapping frame parts require explicit compositing '+p.id);
    covered.add(pixel);const src=((sy+y)*sourcePng.width+sx+x)*4;
    expected.set(normalized.data.subarray(src,src+4),pixel*4);
   }
  }
  for(let y=0;y<p.frameHeight;y++)for(let x=0;x<p.frameWidth;x++){
   const dst=((Math.floor(frame.index/4)*p.frameHeight+y)*atlas.width+(frame.index%4)*p.frameWidth+x)*4,src=(y*p.frameWidth+x)*4;
   if(atlas.data[dst+3]!==expected[src+3])throw Error('Frame alpha differs '+p.id+':'+frame.index);
   if(expected[src+3])for(let k=0;k<3;k++)if(atlas.data[dst+k]!==expected[src+k])throw Error('Visible frame pixel differs '+p.id+':'+frame.index);
  }
 }
 const supportVariants=p.frameComposites?p.variants.filter(v=>v.kind==='loop'):[];
 if(item.references.documents.length!==p.variants.length+1+supportVariants.length||item.references.images.length!==2+p.variants.length*2+supportVariants.length)throw Error('Incomplete reference documents '+p.id);
 if(supportVariants.length)await withTsModule('src/project/pixelArtWorldWaterSupport.ts','paw-water-publish-shape.mjs',api=>{
  for(const variant of supportVariants){
   const supportId=variant.id+'-sewer-support',doc=item.references.documents.find(d=>d.id===supportId),image=item.references.images.find(i=>i.id===supportId);
   if(!doc||!image)throw Error('Missing whole water support example');
   const block=doc.markdown.match(/```json\s*\n([\s\S]*?)\n```/);
   if(!block)throw Error('Water arrays missing');
   const value=JSON.parse(block[1]),expected=api.waterSupportExample(p,variant,id);
   if(JSON.stringify(value.expected)!==JSON.stringify(expected)||api.validateWaterSupportExample(expected,value.expected).length||!api.validateWaterSupportExample(expected,value.incorrect).some(e=>e.code==='SPLASH_SUPPORT_CHANGED'))throw Error('Water support arrays differ');
   const png=pngjs.PNG.sync.read(Buffer.from(image.dataUrl.split(',')[1],'base64'));
   if(png.width!==expected.width*64+8||png.height!==expected.height*32)throw Error('Water support comparison dimensions differ');
  }
 });
 lib.assets[id]=item.asset;sources.push({id:p.id,sha256:p.sha256,frames:p.frames.length,variants:p.variants.length,normalizedFramePixelsEqual:true,sourceAlphaAndPremultipliedChannelsEqual:true,quantizedChannels});
}
const owned=new Set();
for(const group of plan.groups){
 const id='shared_'+group.proposedOwnerId.replaceAll('-','_'),assetId=id+'_image';
 const blank=pngjs.PNG.sync.write(new pngjs.PNG({width:32,height:32}));
 const categories=group.packIds.map(packId=>{if(owned.has(packId)||!ids.has(packId))throw Error('Duplicate or unknown owner category');owned.add(packId);return prepared.find(p=>p.packId===packId).references;});
 lib.assets[assetId]={id:assetId,name:'Reference owner only',kind:'chipset',dataUrl:'data:image/png;base64,'+blank.toString('base64'),meta:{tileSize:32,frameWidth:32,frameHeight:32,width:32,height:32,frames:1}};
 lib.tilesets[id]={id,name:group.name,kind:'custom',image:{type:'uploaded',id:assetId},tileSize:32,tilesPerRow:1,count:1,passability:[{up:false,down:false,left:false,right:false}],priority:['upper'],terrain:[0],tileMeta:[{label:'자료 전용 · 빈 칸',description:'이벤트 원본·프레임·조립 참고문서 소유자. 실제 그림은 uploaded sprite이고 지도 타일이나 완성 오브젝트 스탬프가 아니다.',source:'user'}],tileGroups:[],structureKits:[],referenceDocuments:categories};
}
if(owned.size!==allowed.length)throw Error('Unowned event reference');
await withTsModule('src/project/io/shapeResourceFields.ts','paw-eventprops-validate.mjs',api=>{for(const[id,t]of Object.entries(lib.tilesets))api.validateTileset(id,t);});
await fs.mkdir(out,{recursive:true});const bytes=JSON.stringify(lib);await fs.writeFile(out+'/library.json',bytes);
const proof={source,catalogSha256:hash(await fs.readFile('src/assets/pixelArtWorldEventProps.json')),librarySha256:hash(bytes),sources,sprites:allowed.length,referenceOwners:plan.groups.length,variants:sources.reduce((n,p)=>n+p.variants,0),tileObjects:0,places:0,regions:0,scope:'Explicit sprite frame and event assembly references; no gameplay object footprint, scene, or interaction claim'};
await fs.writeFile(out+'/preparation-proof.json',JSON.stringify(proof,null,2));console.log({sprites:proof.sprites,referenceOwners:proof.referenceOwners,variants:proof.variants,source});
