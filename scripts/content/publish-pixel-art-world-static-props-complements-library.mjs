// Downloaded pixels remain private. SQLite is loaded ONLY by explicit --publish-local.
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {isDeepStrictEqual} from 'node:util';
import {chromium} from 'playwright';
import {withTsModule} from '../ontology-ts-loader.mjs';
const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const CATALOG=path.join(ROOT,'src/assets/pixelArtWorldStaticPropsComplementsCatalog.json');
const METADATA=path.join(ROOT,'tiledata/pixel-art-world/static-props-complements.json');
const CONTRACT_FILES=['scripts/content/publish-pixel-art-world-static-props-complements-library.mjs','scripts/content/prepare-pixel-art-world-static-props-complements.mjs','src/project/pixelArtWorldStaticPropsComplements.ts','src/editor/pixelArtWorldStaticPropsComplementsImport.ts'].map(p=>path.join(ROOT,p));
export const LIBRARY_ID='pixel-art-world-static-props-complements-local';
const hash=x=>createHash('sha256').update(typeof x==='string'||Buffer.isBuffer(x)?x:JSON.stringify(x)).digest('hex');
const assert=(x,m)=>{if(!x)throw Error(m);};
const equal=(a,b,m)=>assert(isDeepStrictEqual(a,b),m);
const read=async p=>JSON.parse(await fs.readFile(p,'utf8'));
const seal=async p=>({path:path.resolve(p),sha256:hash(await fs.readFile(p))});
const check=async s=>{assert(s&&path.isAbsolute(s.path)&&/^[a-f0-9]{64}$/.test(s.sha256),'Absolute sealed file required');assert(hash(await fs.readFile(s.path))===s.sha256,'Changed sealed file: '+s.path);return read(s.path);};
const write=async(p,v)=>fs.writeFile(p,JSON.stringify(v,null,2));
const stable=s=>'shared_paw_static_props_complement_'+s.replace('paw-static-props-','').replaceAll('-','_');
function privateOutput(out){out=path.resolve(out);assert(out.includes('/output/')&&!out.includes('/public/'),'Output must be a private output/ directory');return out;}
function rewrite(value,ids){
 const keys=Object.keys(ids).sort((a,b)=>b.length-a.length),rx=new RegExp(keys.map(k=>k.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')).join('|'),'g');
 const visit=v=>typeof v==='string'?(v.startsWith('data:')?v:v.replace(rx,m=>ids[m])):Array.isArray(v)?v.map(visit):v&&typeof v==='object'?Object.fromEntries(Object.entries(v).map(([k,x])=>[k,visit(x)])):v;
 return visit(value);
}
function docs(categories){
 assert(Array.isArray(categories)&&categories.length,'Owned reference documents required');
 for(const c of categories){const ids=new Set(c.images.map(i=>i.id));assert(c.documents.length&&ids.size===c.images.length,'Empty docs / duplicate image');
  for(const d of c.documents)for(const m of d.markdown.matchAll(/\(image:([^\s)]+)\)/g))assert(ids.has(m[1]),'Broken image link '+m[1]);
 }
}
function jsonBlock(doc){const m=doc?.markdown.match(/```json\s*([\s\S]*?)```/);assert(m,'Missing whole-array document');return JSON.parse(m[1]);}
async function sourcesFor(pack,root){
 const result={};for(const s of pack.sources){const rel=new URL(s.downloadUrl).pathname.split('/dotartworld/')[1];assert(rel&&!rel.includes('..'),'Bad source URL');
  const candidates=[path.join(root,'by-source',rel),path.join(root,s.filename)];let filename;
  for(const candidate of candidates)try{await fs.access(candidate);filename=candidate;break;}catch{}
  assert(filename,'Missing original '+s.filename);const bytes=await fs.readFile(filename);assert(hash(bytes)===s.sha256,'Original SHA differs '+s.filename);
  result[s.id]={path:filename,sha256:s.sha256,dataUrl:'data:image/png;base64,'+bytes.toString('base64')};
 }return result;
}
// Recompose through the same browser canvas normalization, independently of prepared hashes.
async function pixels(page,pack,sources,prepared){
 return page.evaluate(async({pack,sources,prepared})=>{
  const canvas=(w,h)=>{const c=document.createElement('canvas');c.width=w;c.height=h;return c;};
  const load=async url=>{const im=new Image();im.src=url;await im.decode();return im;};
  const originals={};for(const s of pack.sources){const im=await load(sources[s.id].dataUrl);if(im.width!==s.width||im.height!==s.height)throw Error('Original geometry '+s.id);const c=canvas(im.width,im.height);c.getContext('2d').drawImage(im,0,0);originals[s.id]=c;}
  const compose=(parts,w,h)=>{const c=canvas(w,h),ctx=c.getContext('2d');for(const p of parts){const r=p.sourceRect,t=p.target,src=originals[p.sourceId];if(!src||r.x<0||r.y<0||r.x+r.width>src.width||r.y+r.height>src.height||t.x<0||t.y<0||t.x+r.width>w||t.y+r.height>h)throw Error('Part bounds');if(p.mode==='replace')ctx.clearRect(t.x,t.y,r.width,r.height);ctx.drawImage(src,r.x,r.y,r.width,r.height,t.x,t.y,r.width,r.height);}return c;};
  const same=async(c,url,label)=>{const im=await load(url);if(im.width!==c.width||im.height!==c.height)throw Error(label+' dimensions');const actual=canvas(c.width,c.height);actual.getContext('2d').drawImage(im,0,0);const a=c.getContext('2d').getImageData(0,0,c.width,c.height).data,b=actual.getContext('2d').getImageData(0,0,c.width,c.height).data;for(let i=0;i<a.length;i++)if(a[i]!==b[i])throw Error(label+' pixel '+i);};
  const atlas=canvas(pack.atlas.width,pack.atlas.height),ctx=atlas.getContext('2d');for(const p of pack.palette)ctx.drawImage(compose([p.part],32,32),p.tile%8*32,Math.floor(p.tile/8)*32);
  for(const r of pack.recipes)ctx.drawImage(compose(r.parts,r.width,r.height),r.outputRect.x*32,r.outputRect.y*32);
  await same(atlas,prepared.dataUrl,'atlas');
  const render=m=>{const c=canvas(m.width*32,m.height*32),x=c.getContext('2d');for(const layer of[m.lowerTiles,m.upperTiles])layer.forEach((t,i)=>{if(t>=0)x.drawImage(atlas,t%8*32,Math.floor(t/8)*32,32,32,i%m.width*32,Math.floor(i/m.width)*32,32,32);});return c;};
  const pair=(a,b)=>{const c=canvas(a.width+b.width+8,Math.max(a.height,b.height)),x=c.getContext('2d');x.drawImage(a,0,0);x.drawImage(b,a.width+8,0);return c;};
  for(const r of pack.recipes){const cat=prepared.tileset.structureKits.find(k=>k.id===r.id).referenceDocuments[0],doc=cat.documents.find(d=>d.id===r.id),j=JSON.parse(doc.markdown.match(/```json\s*([\s\S]*?)```/)[1]);
   await same(pair(compose(r.parts,r.width,r.height),compose(r.counterexampleParts,r.width,r.height)),cat.images.find(i=>i.id===r.id+'-parts').dataUrl,'parts normal/error');
   const errorIndex=(r.errorCell[1]+1)*j.expected.width+r.errorCell[0]+1;const removed=j.expected.upperTiles.map((v,i)=>({v,i})).find(({v,i})=>i===errorIndex&&v>=0&&ctx.getImageData(v%8*32,Math.floor(v/8)*32,32,32).data.some((v,i)=>i%4===3&&v>0));if(!removed)throw Error('Missing reviewed error cell');const bad=structuredClone(j.expected);bad.upperTiles[removed.i]=-1;if(JSON.stringify(bad)!==JSON.stringify(j.incorrect)||JSON.stringify(j.errors)!==JSON.stringify([{code:'OBJECT_CELL_MISSING',x:removed.i%bad.width,y:Math.floor(removed.i/bad.width)}]))throw Error('Invalid object counterexample arrays');
   await same(pair(render(j.expected),render(j.incorrect)),cat.images.find(i=>i.id===r.id+'-arrays').dataUrl,'whole-array normal/error');
  }
  const s=pack.scene,scene=canvas(s.width*32,s.height*32),sc=scene.getContext('2d');for(const layer of[s.lowerTiles,s.upperTiles])layer.forEach((t,i)=>{if(t>=0)sc.drawImage(atlas,t%8*32,Math.floor(t/8)*32,32,32,i%s.width*32,Math.floor(i/s.width)*32,32,32);});
  const refs=prepared.tileset.referenceDocuments.find(c=>c.id==='scene-'+s.id);await same(scene,refs.images.find(i=>i.id==='assembled-scene').dataUrl,'scene');
  const bad=structuredClone(s),solid=pack.recipes.flatMap(r=>r.upperRows.flat()).find(t=>t>=0&&!prepared.tileset.passability[t].down&&ctx.getImageData(t%8*32,Math.floor(t/8)*32,32,32).data.some((v,i)=>i%4===3&&v>0));bad.upperTiles[s.entry.y*s.width+s.entry.x]=solid;
  const layout=JSON.parse(refs.documents.find(d=>d.id==='layout').markdown.match(/```json\s*([\s\S]*?)```/)[1]);if(JSON.stringify(layout.incorrect)!==JSON.stringify(bad)||JSON.stringify(layout.errors)!==JSON.stringify([{code:'ENTRY_BLOCKED',...s.entry}]))throw Error('Invalid scene counterexample');await same(pair(scene,render(bad)),refs.images.find(i=>i.id==='scene-errors').dataUrl,'scene normal/error');
  for(const category of [...prepared.tileset.referenceDocuments,...prepared.tileset.structureKits.flatMap(k=>k.referenceDocuments)])for(const source of pack.sources){const im=category.images.find(i=>i.id==='source-'+source.id);if(!im)throw Error('Missing owned original image');await same(originals[source.id],im.dataUrl,'source reference');}
  return {atlasPixelsEqual:true,scenePixelsEqual:true,sourceReferencePixelsEqual:true,normalErrorPixelsEqual:true,width:scene.width,height:scene.height};
 },{pack,sources,prepared});
}
function verifySupports(pack){
 const s=pack.scene,wall=new Set(pack.palette.filter(p=>!p.passable).map(p=>p.tile));
 const blocked=new Set([...wall,...pack.recipes.flatMap(r=>r.blockingCells.map(([x,y])=>r.upperRows[y][x]))]);
 const can=(x,y)=>x>=0&&y>=0&&x<s.width&&y<s.height&&!blocked.has(s.lowerTiles[y*s.width+x])&&!blocked.has(s.upperTiles[y*s.width+x]);
 for(const p of s.placements){const r=pack.recipes.find(r=>r.id===p.recipeId);assert(r,'Unknown placed object');for(const[x,y]of r.supportCells)assert(wall.has(s.lowerTiles[(p.y+y)*s.width+p.x+x])===(r.placementKind==='wall-mounted'),'Wrong support '+r.id);for(const[x,y]of r.wallSupportCells??[])assert(wall.has(s.lowerTiles[(p.y+y)*s.width+p.x+x]),'Upper cabinet missing wall');}
 const q=[[s.entry.x,s.entry.y]],seen=new Set([q[0].join(',')]);assert(can(...q[0]),'Entry blocked');for(let n=0;n<q.length;n++){const[x,y]=q[n];for(const[a,b]of[[x-1,y],[x+1,y],[x,y-1],[x,y+1]])if(can(a,b)&&!seen.has([a,b].join(','))){seen.add([a,b].join(','));q.push([a,b]);}}
 for(const a of s.approachCells)assert(seen.has([a.x,a.y].join(',')),'Unreachable reviewed approach');
}
async function artifactFiles(lib,out){
 const dir=path.join(out,'artifacts');await fs.mkdir(dir,{recursive:true});const result=[];
 for(const[id,asset]of Object.entries(lib.assets)){const file=path.join(dir,id+'.png');await fs.writeFile(file,Buffer.from(asset.dataUrl.split(',')[1],'base64'));result.push({kind:'atlas',id,...await seal(file)});}
 for(const[id,url]of Object.entries(lib.previews)){const file=path.join(dir,id+'.png');await fs.writeFile(file,Buffer.from(url.split(',')[1],'base64'));result.push({kind:'assembly-preview',id,...await seal(file)});}
 return result;
}
async function verifyArtifacts(lib,proof,out){
 assert(proof.outputArtifacts?.length===10,'Ten output PNG artifacts required');const keys=new Set();
 for(const a of proof.outputArtifacts){assert(a.kind==='atlas'||a.kind==='assembly-preview','Artifact kind');const expectedPath=path.join(path.resolve(out),'artifacts',a.id+'.png');equal(a.path,expectedPath,'Artifact path');assert(!keys.has(a.id),'Duplicate output artifact');keys.add(a.id);const bytes=await fs.readFile(a.path);assert(hash(bytes)===a.sha256,'Output PNG drift '+a.id);const url=a.kind==='atlas'?lib.assets[a.id]?.dataUrl:lib.previews[a.id];assert(url&&bytes.equals(Buffer.from(url.split(',')[1],'base64')),'Output PNG differs from sealed library');}
}
async function verifyInputs(bundlePath,sourceRoot,receiptPath,snapshotPath){
 const bundle=await read(bundlePath),catalog=await read(CATALOG);
 const metadata=await read(METADATA),withoutGenerated=structuredClone(catalog);for(const p of withoutGenerated.packs){delete p.atlas;delete p.scene;for(const r of p.recipes){delete r.outputRect;delete r.upperRows;}}equal(withoutGenerated,metadata,'Catalog geometry differs from authored metadata');
 assert(bundle.version===1&&bundle.preparedFiles?.length===5,'Five sealed prepared files required');
 equal(catalog.packs.map(p=>p.sources[0].filename).sort(),['Eu-Easel01.png','Eu-Pillar01.png','Eu-Statue01.png','Jukebox01.png','Statue02.png'].sort(),'Reviewed source inventory changed');
 assert(catalog.packs.every(p=>p.sources.length===2)&&new Set(catalog.packs.map(p=>p.sources[0].sha256)).size===5&&new Set(catalog.packs.map(p=>p.sources[1].sha256)).size===1&&new Set(catalog.packs.flatMap(p=>p.sources.map(s=>s.sha256))).size===6,'Five originals + one shared support SHA required');
 assert(bundle.catalogSha256===hash(await fs.readFile(CATALOG))&&bundle.metadataSha256===hash(await fs.readFile(METADATA)),'Catalog / metadata changed');
 assert(bundle.canonicalReceiptSha256===hash(await fs.readFile(receiptPath))&&bundle.sharedSnapshotSha256===hash(await fs.readFile(snapshotPath)),'Receipt / snapshot seal mismatch');
 const receipt=await read(receiptPath),portablePath=receipt.portablePath||path.join(path.dirname(receiptPath),'current-portable.json');
 assert(receipt.projectId&&receipt.projectDir&&Number.isInteger(receipt.revision)&&/^[a-f0-9]{64}$/.test(receipt.sha256),'Canonical read identity required');
 assert(receipt.portableSha256===hash(await fs.readFile(portablePath)),'Canonical portable bytes mismatch');
 const portable=await read(portablePath);assert(portable.tilesets&&portable.maps&&portable.assets,'Canonical portable project required');
 const snapshot=await read(snapshotPath);assert(snapshot.libraries&&snapshot.revision,'Shared snapshot required');
 const browser=await chromium.launch({headless:true});const records=[];
 try{const page=await browser.newPage();await page.route('**/*',r=>r.abort());await withTsModule('src/project/pixelArtWorldStaticPropsComplements.ts','static-props-complement-model.mjs',async api=>{
  equal(catalog.packs.map(p=>p.id).sort(),bundle.preparedFiles.map(p=>p.id).sort(),'Prepared inventory mismatch');
  for(const pack of catalog.packs){const f=bundle.preparedFiles.find(f=>f.id===pack.id),value=await check(f);assert(value.packId===pack.id&&value.originalCatalogMutation===false&&value.prepared?.length===1,'Prepared envelope mismatch');
   equal(value.scenes,[pack.scene],'Scene arrays/geometry changed');verifySupports(pack);equal(value.coverage,pack.coverage,'Coverage changed');assert(pack.scene.events.length===0,'Only static event-free candidates');
   const p=value.prepared[0],t=p.tileset;equal([p.imageWidth,p.imageHeight],[pack.atlas.width,pack.atlas.height],'Atlas dimensions');
   const expected=api.createStaticPropsComplementTileset(pack,p.assetId,t.id),bare=structuredClone(t);delete bare.referenceDocuments;bare.structureKits.forEach(k=>delete k.referenceDocuments);equal(bare,expected,'Tileset / kits / collision / groups differ from catalog');
   docs(t.referenceDocuments);for(const k of t.structureKits)for(const category of k.referenceDocuments){const owner=t.referenceDocuments.find(c=>c.id===category.id);assert(owner,'Missing tileset reference owner');for(const d of category.documents)equal(d,owner.documents.find(x=>x.id===d.id),'Owned document differs from tileset');for(const im of category.images)equal(im,owner.images.find(x=>x.id===im.id),'Owned image differs from tileset');}for(const r of pack.recipes){const k=t.structureKits.find(k=>k.id===r.id);docs(k.referenceDocuments);const d=k.referenceDocuments.flatMap(c=>c.documents).find(d=>d.id===r.id),j=jsonBlock(d);equal(j.recipe,r,'Owned recipe coordinates');equal(j.expected,api.staticPropsComplementExample(r),'Owned whole arrays');}
   const sceneKit=t.structureKits.find(k=>k.id===pack.scene.id);docs(sceneKit.referenceDocuments);equal(jsonBlock(sceneKit.referenceDocuments[0].documents.find(d=>d.id==='layout')).expected,pack.scene,'Owned scene layout');
   const sources=await sourcesFor(pack,sourceRoot);equal(value.sourceHashes,Object.fromEntries(pack.sources.map(s=>[s.filename,s.sha256])),'Prepared source hashes');
   const pixelProof=await pixels(page,pack,sources,p);records.push({pack,p,sources,pixelProof});
  }
 });}finally{await browser.close();}
 return {bundle,catalog,receipt,snapshot,portablePath,records};
}
async function validateLibrary(lib){
 assert(Object.keys(lib.tilesets).length===5&&Object.keys(lib.assets).length===5&&lib.roots.length===5&&Object.keys(lib.places).length===5&&Object.keys(lib.previews).length===5,'Library inventory');
 assert(!Object.keys(lib.regions).length&&!Object.keys(lib.maps).length,'Static candidates must not invent regions/maps');
 await withTsModule('src/project/io/shapeResourceFields.ts','static-props-complement-schema.mjs',api=>{for(const[id,t]of Object.entries(lib.tilesets)){api.validateTileset(id,t);docs(t.referenceDocuments);assert(lib.assets[t.image.id]?.id===t.image.id,'Missing asset');for(const k of t.structureKits)docs(k.referenceDocuments);}});
 const empty=hash('{}');await withTsModule('src/project/spatial/guards.ts','static-props-complement-place-schema.mjs',api=>api.validateSpatialAuthoring({version:1,library:{objects:{},spaces:{},places:lib.places,regions:{},worlds:{}},occurrences:{},rootOccurrenceIds:[],connections:[],legacyImport:{version:1,sourceHash:empty,mapping:[],backup:{encoding:'raw-json',json:'{}',sha256:empty}}}));
 for(const id of lib.roots){const p=lib.places[id];assert(p&&lib.previews[id]&&lib.tilesets[p.exterior.tilesetId].structureKits.some(k=>k.id===p.exterior.kitId),'Missing place raster');docs(p.referenceDocuments);}
}
function buildLibrary(inputs){
 const lib={version:1,projectDefaults:true,roots:[],places:{},regions:{},maps:{},tilesets:{},assets:{},previews:{},sourceProjectId:inputs.receipt.projectId},identities=[],objects=[],rasters=[];
 for(const{pack,p}of inputs.records){const tileId=stable(pack.id),assetId=tileId+'_image',placeId=tileId+'_place',ids={[p.tileset.id]:tileId,[p.assetId]:assetId,[pack.scene.id]:placeId+'_raster'};
  for(const r of pack.recipes)ids[r.id]=tileId+'_'+r.id.replaceAll('-','_');
  const tile=rewrite(p.tileset,ids);const noTransient=v=>{if(typeof v==='string'&&!v.startsWith('data:'))assert(!v.includes(p.tileset.id)&&!v.includes(p.assetId),'Unreplaced UUID');else if(Array.isArray(v))v.forEach(noTransient);else if(v&&typeof v==='object')Object.values(v).forEach(noTransient);};noTransient(tile);for(const k of tile.structureKits){k.ai.origin='ai';if(k.id===ids[pack.scene.id]){k.ai.layerHome='perCell';rasters.push(k.id);}else objects.push(k.id);}
  const identity={id:'shared-identity',name:'로컬 공용 · 방향·지지 조립 표본',description:'지역 미연결 / 완성시설 아님 / 실행 이벤트 없음',documents:[{id:'identity',name:'로컬 공용 범위.md',markdown:`공용 tilesetId: ${tileId}. 원본에서 재합성한 독립 보충 atlas이며 기존106원본/539객체 라이브러리는 수정하지 않는다.\n\n이 place는 지역 미연결 방향·지지 조립 표본이다. 완성된 시설/도로/실제 플레이 공간으로 세지 않는다. 맵/region/이벤트/음악/파괴/착석/상호작용을 생성하지 않는다. 칠판은 벽, 이젤/기둥/석상/주크박스/흉상은 실제 밑동의 바닥을 요구한다.48px 간격의 석상은 팻말 돌출까지 보존한 sourceParts와32px패딩을 사용한다. 분리 흉상은 검토된 받침 고정 조합만 사용하며 공식 상태 전후 대응은 추정하지 않는다. 소재와 파생 그림은 사용자 로컬에서만 사용하며 재배포하지 않는다.\n\n객체와 장소 raster kit는 별도다. 전체 sourceParts/anchors/layers/support/blocking 배열은 각 kit가 소유한 문서를 먼저 읽는다.\n\n${JSON.stringify(Object.fromEntries(Object.entries(ids).filter(([key])=>key!==p.tileset.id&&key!==p.assetId)),null,2)}`}],images:[]};
  tile.referenceDocuments.push(identity);tile.structureKits.forEach(k=>k.referenceDocuments.push(structuredClone(identity)));
  const sceneRefs=tile.structureKits.find(k=>k.id===ids[pack.scene.id]).referenceDocuments;
  lib.tilesets[tileId]=tile;lib.assets[assetId]={id:assetId,name:p.filename,kind:'chipset',dataUrl:p.dataUrl,meta:{tileSize:32,frameWidth:32,frameHeight:32,width:p.imageWidth,height:p.imageHeight,frames:tile.count}};
  lib.places[placeId]={id:placeId,name:pack.scene.name+' · 지역 미연결 정적 후보',revision:1,tags:['Pixel Art World','방향·지지 조립 표본','완성시설 아님','지역 미연결'],provenance:{origin:'ai',sourceId:ids[pack.scene.id]},kind:'facility',layout:'manual',children:[],ports:[{id:placeId+'_entry',name:'정적 접근 틈',...pack.scene.entry}],connections:[],exterior:{tilesetId:tileId,kitId:ids[pack.scene.id]},referenceDocuments:structuredClone(sceneRefs)};
  lib.previews[placeId]=sceneRefs.flatMap(c=>c.images).find(i=>i.id==='assembled-scene').dataUrl;lib.roots.push(placeId);identities.push({packId:pack.id,ids});
 }
 assert(objects.length===23&&rasters.length===5,'Twenty-three objects and five sample rasters required');return {lib,identities,objects,rasters};
}
export async function prepareLibrary(bundlePath,sourceRoot,receiptPath,snapshotPath,out){
 out=privateOutput(out);const inputSeals=await Promise.all([bundlePath,receiptPath,snapshotPath,CATALOG,METADATA].map(seal));const inputs=await verifyInputs(bundlePath,sourceRoot,receiptPath,snapshotPath),built=buildLibrary(inputs);await validateLibrary(built.lib);await fs.mkdir(out,{recursive:true});
 for(const s of inputSeals)assert(hash(await fs.readFile(s.path))===s.sha256,'Input changed during prepare '+s.path);
 await write(path.join(out,'library.json'),built.lib);
 const outputArtifacts=await artifactFiles(built.lib,out),implementationFiles=await Promise.all(CONTRACT_FILES.map(seal));
 const proof={version:1,libraryId:LIBRARY_ID,inputs:{bundle:await seal(bundlePath),receipt:await seal(receiptPath),portable:await seal(inputs.portablePath),snapshot:await seal(snapshotPath),catalog:await seal(CATALOG),metadata:await seal(METADATA)},sourceRoot:path.resolve(sourceRoot),expectedLibraryRevision:inputs.snapshot.libraries[LIBRARY_ID]?hash(inputs.snapshot.libraries[LIBRARY_ID]):null,libraryObjectSha256:hash(built.lib),outputArtifacts,implementationFiles,counts:{tilesets:5,assets:5,objects:23,originalSources:5,supportSources:1,placeRasterKits:5,assemblySamples:5,completedFacilities:0,places:5,previews:5,regions:0,maps:0},objects:built.objects,placeRasterKits:built.rasters,identities:built.identities,source:inputs.receipt,scope:'지역 미연결 방향·지지 조립 표본 5개, 완성시설0. 기존106원본/539객체 및 loose supplements 라이브러리 변경 없음.',verification:inputs.records.map(r=>({id:r.pack.id,...r.pixelProof,sources:Object.values(r.sources).map(({path,sha256})=>({path,sha256}))}))};
 await write(path.join(out,'preparation-proof.json'),proof);await write(path.join(out,'preparation-seal.json'),{version:1,library:await seal(path.join(out,'library.json')),proof:await seal(path.join(out,'preparation-proof.json'))});return proof;
}
export async function readPreparedLibrary(out){
 out=privateOutput(out);const seals=await read(path.join(out,'preparation-seal.json'));equal(seals.library.path,path.join(out,'library.json'),'Library path');equal(seals.proof.path,path.join(out,'preparation-proof.json'),'Proof path');const lib=await check(seals.library),proof=await check(seals.proof);assert(proof.libraryId===LIBRARY_ID&&hash(lib)===proof.libraryObjectSha256,'Prepared library seal');
 for(const s of Object.values(proof.inputs))await check(s);
 equal(proof.implementationFiles.map(s=>s.path),CONTRACT_FILES,'Implementation contract paths');for(const s of proof.implementationFiles)assert(hash(await fs.readFile(s.path))===s.sha256,'Implementation changed after prepare '+s.path);
 await verifyArtifacts(lib,proof,out);
 assert(proof.inputs.catalog.sha256===hash(await fs.readFile(CATALOG))&&proof.inputs.metadata.sha256===hash(await fs.readFile(METADATA)),'Current catalog changed');
 const inputs=await verifyInputs(proof.inputs.bundle.path,proof.sourceRoot,proof.inputs.receipt.path,proof.inputs.snapshot.path),built=buildLibrary(inputs);equal(lib,built.lib,'Prepared library differs from fresh deterministic reconstruction');equal(proof.expectedLibraryRevision,inputs.snapshot.libraries[LIBRARY_ID]?hash(inputs.snapshot.libraries[LIBRARY_ID]):null,'CAS proof differs from sealed snapshot');equal(proof.objects,built.objects,'Object inventory proof');equal(proof.placeRasterKits,built.rasters,'Place raster inventory proof');await validateLibrary(lib);return {lib,proof};
}
export async function publishLibrary(preparedDir,receiptOut){
 receiptOut=privateOutput(receiptOut);const{lib,proof}=await readPreparedLibrary(preparedDir);await fs.mkdir(receiptOut,{recursive:true});
 // No SQLite module is evaluated on --prepare or readPreparedLibrary.
 return withTsModule('scripts/lib/sharedContentSqlite.ts','static-props-complement-publish.mjs',async api=>{
  const before=api.readSharedContent(),old=before.libraries[LIBRARY_ID];assert((old?hash(old):null)===proof.expectedLibraryRevision,'Static props complement library changed: prepare from a fresh snapshot');
  for(const[id,other]of Object.entries(before.libraries))if(id!==LIBRARY_ID)for(const section of['tilesets','assets','places','previews'])for(const key of Object.keys(lib[section]))assert(!Object.hasOwn(other[section]||{},key),'Stable identity owned by '+id+': '+key);
  const kitIds=new Set(Object.values(lib.tilesets).flatMap(t=>t.structureKits.map(k=>k.id)));for(const[id,other]of Object.entries(before.libraries))if(id!==LIBRARY_ID)for(const t of Object.values(other.tilesets??{}))for(const k of t.structureKits??[])assert(!kitIds.has(k.id),'Kit identity owned by '+id+': '+k.id);
  const saved=api.publishSharedContent(LIBRARY_ID,lib,proof.expectedLibraryRevision),after=api.readSharedContent();for(const[id,other]of Object.entries(before.libraries))if(id!==LIBRARY_ID)equal(after.libraries[id],other,'Unrelated library changed '+id);equal(saved.reloaded,lib,'SQLite reload mismatch');equal(after.libraries[LIBRARY_ID],lib,'Snapshot reload mismatch');
  const receipt={libraryId:LIBRARY_ID,file:saved.file,revision:saved.revision,reloadedEqual:true,unrelatedLibrariesPreserved:true,counts:proof.counts,source:proof.source,preparationProofSha256:hash(await fs.readFile(path.join(preparedDir,'preparation-proof.json'))),scope:proof.scope};await write(path.join(receiptOut,'proof.json'),receipt);return receipt;
 });
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const[action,...args]=process.argv.slice(2);let result;
 if(action==='--prepare'&&args.length===5)result=await prepareLibrary(...args);
 else if(action==='--publish-local'&&args.length===2)result=await publishLibrary(...args);
 else throw Error('Usage: --prepare <sealed-bundle.json> <download-root> <canonical-read-receipt.json> <shared-snapshot.json> <private-output> OR --publish-local <prepared-directory> <private-receipt-output>');
 console.log(JSON.stringify({libraryId:LIBRARY_ID,counts:result.counts,revision:result.revision??null,prepared:action==='--prepare'}));
}
