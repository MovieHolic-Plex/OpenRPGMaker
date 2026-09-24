// Reserved user-local food assets and owned AI documents; no source pixels are shipped.
import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import pngjs from 'pngjs';
import {withTsModule} from '../ontology-ts-loader.mjs';
const [planFile,sourceDir,receiptFile,out]=process.argv.slice(2);
if(!out)throw Error('Usage: <private install-plan.json> <originals directory> <canonical source-proof.json> <private output>');
const read=async f=>JSON.parse(await fs.readFile(f,'utf8')),hash=b=>createHash('sha256').update(b).digest('hex');
const plan=await read(planFile),catalog=await read('src/assets/pixelArtWorldFoodCatalog.json'),source=await read(receiptFile);
if(!source.projectId||!source.projectDir||!source.sha256||plan.preparedFiles.length!==catalog.packs.length)throw Error('Source receipt or source list missing');
const supportBytes=await fs.readFile(path.join(sourceDir,catalog.support.filename));
if(hash(supportBytes)!==catalog.support.sha256)throw Error('Support source changed');
const lib={version:1,projectDefaults:true,roots:[],places:{},regions:{},maps:{},tilesets:{},assets:{},previews:{},sourceProjectId:source.projectId};
const observations=[];
for(const pack of catalog.packs){
 const entry=plan.preparedFiles.find(e=>e.packId===pack.id);if(!entry)throw Error('Prepared source missing '+pack.id);
 const prepared=await read(entry.path),bytes=await fs.readFile(path.join(sourceDir,'by-source/sozai/food',pack.filename));
 if(hash(bytes)!==pack.sha256||prepared.sourceSha256!==pack.sha256||prepared.supportSha256!==catalog.support.sha256||prepared.prepared.length!==2)throw Error('Prepared source identity differs '+pack.id);
 const original=pngjs.PNG.sync.read(bytes),raw=pngjs.PNG.sync.read(Buffer.from(prepared.prepared[0].dataUrl.split(',')[1],'base64'));
 if(raw.width!==pack.width||raw.height!==pack.height||original.width!==raw.width||original.height!==raw.height)throw Error('Raw source dimensions differ');
 for(let i=0;i<original.data.length;i++)if((i%4===3||original.data[i-i%4+3]>0)&&original.data[i]!==raw.data[i])throw Error('Visible source pixel differs '+pack.id+' '+i);
 const replacements=new Map();
 for(const [i,item]of prepared.prepared.entries()){
  const id='shared_'+pack.id.replaceAll('-','_')+(i===0?'_source':'_table');
  replacements.set(item.tileset.id,id);replacements.set(item.assetId,id+'_image');
 }
 const rewrite=value=>{
  if(typeof value==='string'){for(const[old,id]of replacements)value=value.replaceAll(old,id);return value;}
  if(Array.isArray(value))return value.map(rewrite);
  if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).map(([k,v])=>[k,rewrite(v)]));
  return value;
 };
 for(const [index,item]of prepared.prepared.entries()){
  const tile=rewrite(item.tileset),id=tile.id,assetId=tile.image.id;
  const image=pngjs.PNG.sync.read(Buffer.from(item.dataUrl.split(',')[1],'base64'));
  if(image.width!==item.imageWidth||image.height!==item.imageHeight||tile.count!==image.width*image.height/1024||image.width!==tile.tilesPerRow*32)throw Error('Prepared atlas shape differs '+id);
  const recipes=index===0?pack.recipes:pack.recipes.filter(r=>r.composition==='table');
  if(tile.structureKits?.length!==recipes.length)throw Error('Object references not attached '+id);
  for(const[ri,recipe]of recipes.entries()){
   const kit=tile.structureKits[ri],expectedId=recipe.id+(index===0?'':'-table');
   if(kit.id!==expectedId||!kit.referenceDocuments?.length)throw Error('Object identity differs '+expectedId);
   const expected=index===0?recipe.tiles:Array.from({length:3},(_,y)=>Array.from({length:3},(_,x)=>(1+Math.floor(ri/4)*3+y)*12+(ri%4)*3+x));
   if(JSON.stringify(kit.rows.map(r=>r.upperTiles))!==JSON.stringify(expected)||kit.rows.some(r=>r.tiles.some(t=>t!==-1)))throw Error('Object stamp differs '+kit.id);
   kit.id='shared_'+kit.id.replaceAll('-','_');kit.ai.origin='ai';
  }
  for(const old of replacements.keys())if(JSON.stringify(tile).includes(old))throw Error('Unresolved source UUID '+id);
  lib.tilesets[id]=tile;
  lib.assets[assetId]={id:assetId,name:item.filename,kind:'chipset',dataUrl:item.dataUrl,meta:{tileSize:32,frameWidth:32,frameHeight:32,width:image.width,height:image.height,frames:tile.count}};
 }
 observations.push({id:pack.id,sha256:pack.sha256,raw:pack.recipes.length,composed:pack.coverage.tableComposites,unreviewedAnchors:pack.coverage.excludedCompositionIds});
}
await withTsModule('src/project/io/shapeResourceFields.ts','paw-food-validate.mjs',api=>{for(const[id,tile]of Object.entries(lib.tilesets))api.validateTileset(id,tile);});
await fs.mkdir(out,{recursive:true});const payload=JSON.stringify(lib);
await fs.writeFile(out+'/library.json',payload);
const proof={source,catalogSha256:hash(await fs.readFile('src/assets/pixelArtWorldFoodCatalog.json')),librarySha256:hash(payload),sources:observations,tilesets:Object.keys(lib.tilesets).length,rawObjects:observations.reduce((n,o)=>n+o.raw,0),composedObjects:observations.reduce((n,o)=>n+o.composed,0),places:0,regions:0,scope:'User-local object assemblies; no invented rooms, eating events, or region coverage.'};
await fs.writeFile(out+'/preparation-proof.json',JSON.stringify(proof,null,2));console.log(proof);
