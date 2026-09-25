// User-local loose-prop publication preparation. This module never opens a database.
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import pngjs from 'pngjs';
import {withTsModule} from '../ontology-ts-loader.mjs';
const repo=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
export const LOOSE_LIBRARY_ID='pixel-art-world-loose-local';
export const hash=value=>createHash('sha256').update(typeof value==='string'||Buffer.isBuffer(value)?value:JSON.stringify(value)).digest('hex');
const read=async file=>JSON.parse(await fs.readFile(file,'utf8'));
const assert=(condition,message)=>{if(!condition)throw Error(message)};
const equal=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const stable=id=>'shared_'+id.replaceAll('-','_');
const png=url=>{assert(typeof url==='string'&&url.startsWith('data:image/png;base64,'),'Expected prepared PNG');return pngjs.PNG.sync.read(Buffer.from(url.split(',')[1],'base64'))};
const jsonBlock=md=>{const match=md.match(/```json\s*([\s\S]*?)```/);assert(match,'Missing complete JSON reference');return JSON.parse(match[1])};
export async function verifyReviewBundle(file) {
 const bytes=await fs.readFile(file),bundle=JSON.parse(bytes);
 assert(bundle.version===1&&Array.isArray(bundle.artifacts)&&bundle.preparedFiles?.length===106,'Invalid final review bundle');
 const artifacts=new Map();
 for(const item of bundle.artifacts){assert(!artifacts.has(item.path)&&/^[a-f0-9]{64}$/.test(item.sha256),'Duplicate/invalid review artifact');assert(hash(await fs.readFile(item.path))===item.sha256,'Reviewed artifact changed: '+item.path);artifacts.set(item.path,item.sha256)}
 assert(artifacts.has(bundle.reviewReport)&&artifacts.has(bundle.plan),'Review report/plan not sealed');
 const report=await read(bundle.reviewReport),plan=await read(bundle.plan);
 assert(report.remainingConfirmedFindings===0&&report.findings.every(f=>f.status==='fixed-and-reobserved'),'Independent findings remain open');
 assert(equal(report.reviewedCounts,{originalPNGs:106,sourceContactSheets:27,fixedObjects:539,normalContactSheets:15,boundaryWarnings:86,sourceOnlyRegions:11,sourcesWithUnassignedPixels:19}),'Unexpected review scope');
 for(const[file,sha]of Object.entries(report.finalEvidenceSha256)){assert(artifacts.get(file)===sha||hash(await fs.readFile(file))===sha,'Final independent evidence changed: '+file)}
 assert(equal(plan.preparedFiles,bundle.preparedFiles),'Plan differs from sealed review');
 assert(new Set(bundle.preparedFiles.map(e=>e.id)).size===106,'Duplicate pack ID');
 for(const entry of bundle.preparedFiles)assert(artifacts.has(entry.path),'Unsealed prepared file: '+entry.id);
 assert(hash(await fs.readFile(path.join(repo,'src/assets/pixelArtWorldLooseCatalog.json')))===bundle.catalogSha256,'Current generated catalog differs from review');
 assert(hash(await fs.readFile(path.join(repo,'tiledata/pixel-art-world/loose.json')))===bundle.metadataSha256,'Current authored metadata differs from review');
 return {bundle,sha256:hash(bytes)};
}
function verifyReferenceLinks(owner) {
 for(const category of owner.referenceDocuments??[]){
  const imageIds=new Set(category.images.map(i=>i.id));
  for(const doc of category.documents)for(const match of doc.markdown.matchAll(/\(image:([^)]+)\)/g))assert(imageIds.has(match[1]),'Missing owned reference image '+match[1]);
 }
}
export async function validateLooseLibrary(lib) {
 assert(lib.version===1&&lib.projectDefaults===true&&lib.roots.length===0&&Object.keys(lib.places).length===0&&Object.keys(lib.maps).length===0&&Object.keys(lib.regions??{}).length===0,'Loose library must remain object/reference-only');
 assert(Object.keys(lib.tilesets).length===209&&Object.keys(lib.assets).length===209,'Expected106source +103derived tilesets/assets');
 let raw=0,derived=0,kits=0;const usedAssets=new Set(),kitIds=new Set();
 await withTsModule('src/project/io/shapeResourceFields.ts','loose-library-shape.mjs',api=>{
  for(const[id,tile]of Object.entries(lib.tilesets)){
   assert(id===tile.id&&id.startsWith('shared_paw_loose_')&&tile.image.type==='uploaded','Invalid stable tileset identity');api.validateTileset(id,tile);verifyReferenceLinks(tile);
   const a=lib.assets[tile.image.id];assert(a&&a.id===tile.image.id&&a.kind==='chipset'&&a.dataUrl?.startsWith('data:image/png;base64,'),'Missing local PNG asset');usedAssets.add(a.id);
   const image=png(a.dataUrl),size=tile.tileSize;
   assert(a.meta.tileSize===size&&a.meta.frameWidth===size&&a.meta.frameHeight===size&&a.meta.width===image.width&&a.meta.height===image.height&&a.meta.frames===tile.count&&image.width===tile.tilesPerRow*size&&tile.count===image.width*image.height/(size*size),'Asset/tileset geometry differs '+id);
   if(id.endsWith('_source')){raw++;assert(size===16&&!(tile.structureKits?.length)&&!(tile.tileGroups?.length),'Source16px must not become object kits');}
   else{derived++;assert(id.endsWith('_objects')&&size===32&&tile.tilesPerRow===8,'Derived32px contract differs');}
   for(const kit of tile.structureKits??[]){
    assert(!kitIds.has(kit.id)&&kit.id.startsWith('shared_paw_loose_'),'Duplicate/nonstable kit');kitIds.add(kit.id);kits++;
    assert(kit.tileSize===32&&kit.rows.length===kit.height,'Kit geometry');
    for(const row of kit.rows){assert(row.tiles.length===kit.width&&row.upperTiles.length===kit.width&&row.tiles.every(t=>t===-1),'Object must preserve existing support');for(const t of row.upperTiles)assert(Number.isInteger(t)&&t>=0&&t<tile.count,'Kit tile out of range');}
    assert(kit.referenceDocuments?.length&&kit.referenceDocuments.every(c=>c.documents.length>=2&&c.images.length>=2),'Missing owned object guidance');verifyReferenceLinks(kit);
   }
  }
 });
 assert(raw===106&&derived===103&&kits===539&&usedAssets.size===209,'Object/reference totals differ');
 return {sourceTilesets:raw,derivedTilesets:derived,fixedObjects:kits,sourceOnlyRegions:11,sourcesWithUnassignedPixels:19,places:0,regions:0};
}
async function originalPath(root,pack){
 const url=new URL(pack.downloadUrl);assert(url.origin==='https://yms.main.jp'&&url.pathname.startsWith('/dotartworld/'),'Unexpected source origin');
 const relative=decodeURIComponent(url.pathname.slice('/dotartworld/'.length)),candidate=path.resolve(root,'by-source',relative);
 assert(candidate.startsWith(path.resolve(root)+path.sep),'Unsafe original path');
 try{await fs.access(candidate);return candidate}catch{return path.join(root,pack.filename)}
}
function verifyNormalizedPixels(original,raw,label){
 assert(original.width===raw.width&&original.height===raw.height,'Source dimensions differ '+label);
 let changed=0;
 for(let i=0;i<original.data.length;i+=4){const a=original.data[i+3];assert(a===raw.data[i+3],'Source alpha differs '+label);let differs=false;
  for(let c=0;c<3;c++){assert(Math.round(original.data[i+c]*a/255)===Math.round(raw.data[i+c]*a/255),'Premultiplied source differs '+label);if(a&&original.data[i+c]!==raw.data[i+c])differs=true;}
  if(differs)changed++;
 }
 return changed;
}
export async function prepareLooseLibrary(reviewFile,sourceDir,receiptFile,sharedFile,outArg){
 const out=path.resolve(outArg);assert(out.startsWith(path.join(repo,'output')+path.sep),'Preparation output must remain in private worktree output/');
 const reviewed=await verifyReviewBundle(reviewFile),catalog=await read(path.join(repo,'src/assets/pixelArtWorldLooseCatalog.json')),receipt=await read(receiptFile),shared=await read(sharedFile);
 assert(receipt.projectId&&receipt.projectDir&&Number.isInteger(receipt.revision)&&/^[a-f0-9]{64}$/.test(receipt.sha256),'Canonical read receipt missing');
 assert(shared.revision&&shared.libraries&&catalog.packs.length===106,'Missing shared snapshot/catalog');
 const sourceRoot=path.resolve(sourceDir),supportBytes=await fs.readFile(path.join(sourceRoot,catalog.support.filename));assert(hash(supportBytes)===catalog.support.sha256,'Support original SHA differs');
 const support=pngjs.PNG.sync.read(supportBytes);assert(support.width===catalog.support.width&&support.height===catalog.support.height,'Support dimensions differ');
 const lib={version:1,projectDefaults:true,roots:[],places:{},regions:{},maps:{},tilesets:{},assets:{},previews:{},sourceProjectId:receipt.projectId};
 const observations=[],allOldIds=[],idMapping={};let normalizedSourceAtlasCopiedPixels=0;
 for(const pack of catalog.packs){
  const entry=reviewed.bundle.preparedFiles.find(e=>e.id===pack.id);assert(entry,'Missing prepared source '+pack.id);const prepared=await read(entry.path),sourcePath=await originalPath(sourceRoot,pack),originalBytes=await fs.readFile(sourcePath);
  assert(hash(originalBytes)===pack.sha256&&prepared.packId===pack.id&&prepared.sourceSha256===pack.sha256&&prepared.supportSha256===catalog.support.sha256,'Source/prepared SHA identity differs '+pack.id);
  const original=pngjs.PNG.sync.read(originalBytes),fixed=pack.recipes.filter(r=>r.supportStatus==='fixed-object');
  assert(original.width===pack.width&&original.height===pack.height&&prepared.prepared.length===(fixed.length?2:1),'Source/prepared geometry differs '+pack.id);
  assert(equal(prepared.coverage,pack.coverage)&&equal(prepared.holds,pack.holds)&&equal(prepared.sourceOnlyRecipeIds,pack.recipes.filter(r=>r.supportStatus==='source-only').map(r=>r.id)),'Prepared coverage/holds differs '+pack.id);
  const raw=prepared.prepared[0],rawImage=png(raw.dataUrl),normalization=verifyNormalizedPixels(original,rawImage,pack.id);
  const inventory=raw.tileset.referenceDocuments?.[0]?.documents.find(d=>d.id==='source-inventory');assert(inventory&&equal(jsonBlock(inventory.markdown),pack),'Prepared source inventory differs from current metadata '+pack.id);
  const replacements=new Map();
  for(const[index,item]of prepared.prepared.entries()){const id=stable(pack.id)+(index===0?'_source':'_objects');replacements.set(item.tileset.id,id);replacements.set(item.assetId,id+'_image');allOldIds.push(item.tileset.id,item.assetId);idMapping[item.tileset.id]=id;idMapping[item.assetId]=id+'_image';}
  for(const recipe of pack.recipes)replacements.set(recipe.id,stable(recipe.id));
  const rewrite=value=>{
   if(typeof value==='string'){if(value.startsWith('data:image/'))return value;for(const[old,id]of replacements)value=value.replaceAll(old,id);return value;}
   if(Array.isArray(value))return value.map(rewrite);
   if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).map(([k,v])=>[replacements.get(k)??k,rewrite(v)]));return value;
  };
  for(const[index,item]of prepared.prepared.entries()){
   const image=png(item.dataUrl),tile=item.tileset,size=index===0?16:32;
   assert(image.width===item.imageWidth&&image.height===item.imageHeight&&tile.tileSize===size&&tile.count===image.width*image.height/(size*size)&&image.width===tile.tilesPerRow*size,'Prepared sheet shape differs '+pack.id);
   if(index===0)assert(!(tile.structureKits?.length)&&!(tile.tileGroups?.length),'Reference source unexpectedly has kits');
   else{
    assert(image.width===pack.atlas.width&&image.height===pack.atlas.height&&tile.structureKits.length===fixed.length&&tile.tileGroups.length===fixed.length,'Derived count differs');
    for(const recipe of fixed){
     const kit=tile.structureKits.find(k=>k.id===recipe.id),q=recipe.outputRect;assert(kit&&kit.width===q.width&&kit.height===q.height,'Object shape differs '+recipe.id);
     const expected=Array.from({length:q.height},(_,y)=>Array.from({length:q.width},(_,x)=>(q.y+y)*8+q.x+x));assert(equal(kit.rows.map(r=>r.upperTiles),expected)&&kit.rows.every(r=>r.tiles.every(t=>t===-1)),'Object array differs '+recipe.id);
     const doc=kit.referenceDocuments?.flatMap(c=>c.documents).find(d=>d.id===recipe.id),top=tile.referenceDocuments?.flatMap(c=>c.documents).find(d=>d.id===recipe.id);assert(doc&&top&&equal(jsonBlock(doc.markdown).recipe,recipe)&&doc.markdown===top.markdown,'Owned recipe metadata differs '+recipe.id);
     const group=tile.tileGroups.find(g=>g.id===recipe.id);assert(group&&equal(group.tileIds,expected.flat()),'Object group differs '+recipe.id);
     if(recipe.placementKind!=='surface'){
      const source=recipe.pixelRect,offset=recipe.pixelOffset;
      for(let y=0;y<source.height;y++)for(let x=0;x<source.width;x++){
       const a=((source.y+y)*rawImage.width+source.x+x)*4,b=((q.y*32+offset.y+y)*image.width+q.x*32+offset.x+x)*4;
       assert(rawImage.data[a+3]===image.data[b+3],'Atlas copied alpha differs '+recipe.id);
       if(rawImage.data[a+3])for(let c=0;c<3;c++)assert(rawImage.data[a+c]===image.data[b+c],'Atlas normalized source pixel differs '+recipe.id);
       normalizedSourceAtlasCopiedPixels++;
      }
     }
    }
   }
   const next=rewrite(tile),assetId=next.image.id;
   for(const kit of next.structureKits??[])if(kit.ai)kit.ai.origin='ai';
   assert(!lib.tilesets[next.id]&&!lib.assets[assetId],'Duplicate stable identity');
   lib.tilesets[next.id]=next;
   // Original source bytes stay byte-exact. Prepared canvas PNG is accepted only after exact alpha/premultiplied comparison.
   lib.assets[assetId]={id:assetId,name:item.filename,kind:'chipset',dataUrl:index===0?'data:image/png;base64,'+originalBytes.toString('base64'):item.dataUrl,meta:{tileSize:size,frameWidth:size,frameHeight:size,width:image.width,height:image.height,frames:next.count}};
  }
  observations.push({id:pack.id,filename:pack.filename,sourcePath,sourceSha256:pack.sha256,preparedSha256:hash(await fs.readFile(entry.path)),originalDimensions:[original.width,original.height],referenceOnlyTileSize:16,derivedTileSize:fixed.length?32:null,fixedObjects:fixed.length,sourceOnlyRecipeIds:prepared.sourceOnlyRecipeIds,unassignedOpaquePixels:pack.coverage.unassignedOpaquePixels,canvasNormalization:{alphaExact:true,premultipliedExact:true,straightRgbChangedPixels:normalization,originalAssetBytesPreserved:true}});
 }
 for(const other of Object.values(shared.libraries))if(other!==shared.libraries[LOOSE_LIBRARY_ID])for(const id of Object.keys(lib.tilesets))assert(!other.tilesets?.[id]&&!other.assets?.[id+'_image'],'Reserved identity conflicts with another library '+id);
 const serialized=JSON.stringify(lib);for(const old of allOldIds)assert(!serialized.includes(old),'Unresolved generated UUID '+old);
 const counts=await validateLooseLibrary(lib);
 assert(observations.reduce((n,o)=>n+o.sourceOnlyRecipeIds.length,0)===11&&observations.filter(o=>o.unassignedOpaquePixels>0).length===19,'Held scope changed');
 await fs.mkdir(out,{recursive:true});await fs.writeFile(path.join(out,'library.json'),serialized);
 const assetsBefore=hash(lib.assets);
 const compressed=await promisify(execFile)('python3',[path.join(repo,'scripts/content/compress-pixel-art-world-reference-images.py'),path.join(out,'library.json')],{maxBuffer:1024*1024});
 const result=await read(path.join(out,'library.json'));assert(hash(result.assets)===assetsBefore,'Reference compression changed game assets');await validateLooseLibrary(result);
 const outputBytes=await fs.readFile(path.join(out,'library.json'));
 const referenceTotals={imageInstances:0,imageDataUrlBytes:0,documents:0,markdownUtf8Bytes:0};
 for(const t of Object.values(result.tilesets))for(const owner of[t,...t.structureKits??[]])for(const category of owner.referenceDocuments??[]){
  referenceTotals.imageInstances+=category.images.length;referenceTotals.documents+=category.documents.length;
  for(const i of category.images)referenceTotals.imageDataUrlBytes+=Buffer.byteLength(i.dataUrl);
  for(const d of category.documents)referenceTotals.markdownUtf8Bytes+=Buffer.byteLength(d.markdown);
 }

 const proof={version:1,libraryId:LOOSE_LIBRARY_ID,source:receipt,inputReceipts:{canonical:{path:path.resolve(receiptFile),sha256:hash(await fs.readFile(receiptFile))},sharedSnapshot:{path:path.resolve(sharedFile),sha256:hash(await fs.readFile(sharedFile))}},reviewBundle:{path:path.resolve(reviewFile),sha256:reviewed.sha256},catalogSha256:reviewed.bundle.catalogSha256,metadataSha256:reviewed.bundle.metadataSha256,expectedLibraryRevision:shared.libraries[LOOSE_LIBRARY_ID]?hash(shared.libraries[LOOSE_LIBRARY_ID]):null,sharedSnapshotRevision:shared.revision,librarySha256:hash(outputBytes),libraryObjectSha256:hash(result),counts,pixelValidation:{rawSourceAsset:'original PNG bytes preserved exactly',preparedSource:'alpha and premultiplied channels exact; straight RGB may normalize at fractional alpha',nonSurfaceNormalizedSourceAtlasPixels:normalizedSourceAtlasCopiedPixels,nonSurfaceVisibleRgbaExact:true,surfaceComposites:'review-sealed atlas bytes and exact metadata/arrays retained'},libraryBytes:outputBytes.length,referenceTotals,supportSource:{path:path.join(sourceRoot,catalog.support.filename),sha256:catalog.support.sha256},referenceCompression:JSON.parse(compressed.stdout),sources:observations,idMapping,scope:'User-local static objects and source references only. 11 source-only regions and residual pixels in19sources remain unsupported for complete assembly; no invented places, events or animations.'};
 const proofBytes=JSON.stringify(proof,null,2);await fs.writeFile(path.join(out,'preparation-proof.json'),proofBytes);await fs.writeFile(path.join(out,'preparation-seal.json'),JSON.stringify({version:1,libraryId:LOOSE_LIBRARY_ID,preparationProofSha256:hash(proofBytes),librarySha256:hash(outputBytes),reviewBundleSha256:reviewed.sha256},null,2));console.log(JSON.stringify({out,libraryId:LOOSE_LIBRARY_ID,counts,bytes:outputBytes.length,referenceCompression:proof.referenceCompression}));return proof;
}
export async function readPreparedLooseLibrary(dir){
 const bytes=await fs.readFile(path.join(dir,'library.json')),proofBytes=await fs.readFile(path.join(dir,'preparation-proof.json')),proof=JSON.parse(proofBytes),seal=await read(path.join(dir,'preparation-seal.json'));
 assert(seal.version===1&&seal.libraryId===LOOSE_LIBRARY_ID&&seal.preparationProofSha256===hash(proofBytes)&&seal.librarySha256===hash(bytes)&&seal.reviewBundleSha256===proof.reviewBundle.sha256,'Preparation receipt/seal changed');
 for(const input of Object.values(proof.inputReceipts))assert(hash(await fs.readFile(input.path))===input.sha256,'Preparation input receipt changed: '+input.path);
 const sourceReceipt=await read(proof.inputReceipts.canonical.path),shared=await read(proof.inputReceipts.sharedSnapshot.path);
 assert(equal(sourceReceipt,proof.source)&&shared.revision===proof.sharedSnapshotRevision&&(shared.libraries[LOOSE_LIBRARY_ID]?hash(shared.libraries[LOOSE_LIBRARY_ID]):null)===proof.expectedLibraryRevision,'Prepared CAS/source receipt differs from sealed snapshot');
 assert(proof.version===1&&proof.libraryId===LOOSE_LIBRARY_ID&&hash(bytes)===proof.librarySha256,'Prepared library changed');
 const reviewed=await verifyReviewBundle(proof.reviewBundle.path);assert(reviewed.sha256===proof.reviewBundle.sha256&&reviewed.bundle.catalogSha256===proof.catalogSha256&&reviewed.bundle.metadataSha256===proof.metadataSha256,'Review bundle changed since preparation');
 assert(hash(await fs.readFile(proof.supportSource.path))===proof.supportSource.sha256,'Support original changed since preparation');
 for(const source of proof.sources)assert(hash(await fs.readFile(source.sourcePath))===source.sourceSha256,'Original changed since preparation '+source.id);
 const lib=JSON.parse(bytes);assert(hash(lib)===proof.libraryObjectSha256,'Prepared library object differs');await validateLooseLibrary(lib);return {lib,proof,bytes};
}
if(path.resolve(process.argv[1]??'')===fileURLToPath(import.meta.url)){
 const[action,review,source,receipt,shared,out,...extra]=process.argv.slice(2);
 if(action!=='--prepare'||!out||extra.length)throw Error('Usage: --prepare <review-bundle.json> <originals-dir> <source-proof.json> <shared-before.json> <private-output>');
 await prepareLooseLibrary(review,source,receipt,shared,out);
}
