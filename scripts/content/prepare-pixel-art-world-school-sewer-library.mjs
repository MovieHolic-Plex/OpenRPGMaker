// Read-only preparation: actual browser importer, source SHA, arrays, engine collision.
// No DB imports or calls. All user pixels stay under this worktree's output/.
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {chromium} from 'playwright';
import {withTsModule} from '../ontology-ts-loader.mjs';
const repo=fileURLToPath(new URL('../../',import.meta.url));
const [devUrl,sourceDirectory,portablePath,receiptPath,outArg]=process.argv.slice(2);
if(!outArg)throw Error('Usage: <devURL> <user PNG dir> <host portable.json> <source-proof.json> <private output>');
const out=path.resolve(outArg);if(!out.startsWith(path.join(repo,'output')+'/'))throw Error('Private worktree output required');
await fs.mkdir(out,{recursive:true});
const hash=b=>createHash('sha256').update(typeof b==='string'||Buffer.isBuffer(b)?b:JSON.stringify(b)).digest('hex');
const portableBytes=await fs.readFile(portablePath),receipt=JSON.parse(await fs.readFile(receiptPath));
if(hash(portableBytes)!==receipt.portableSha256)throw Error('Host receipt differs');
const project=JSON.parse(portableBytes),packs=JSON.parse(await fs.readFile(path.join(repo,'src/assets/pixelArtWorldSchoolSewerCatalog.json')));
const library={version:1,projectDefaults:true,roots:[],places:{},regions:{},maps:{},tilesets:{},assets:{},previews:{},sourceProjectId:receipt.projectId};
const observations=[];
const browser=await chromium.launch();
try{
 const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(String(e)));
 await page.route('**/__school_sewer_prepare',r=>r.fulfill({contentType:'text/html',body:'<!doctype html><title>Local source preparation</title>'}));await page.goto(new URL('/__school_sewer_prepare',devUrl).href);
 for(const pack of packs){
  const sourcePath=path.join(sourceDirectory,pack.filename),sourceBytes=await fs.readFile(sourcePath);if(hash(sourceBytes)!==pack.sha256)throw Error('Source SHA differs '+pack.id);
  const prepared=await page.evaluate(async({pack,base64})=>{
   const {EXTERNAL_TILESET_PACKS}=await import('/src/project/externalTilesetCatalog.ts');
   const {prepareExternalTileset}=await import('/src/editor/externalTilesetImport.ts');
   const registered=EXTERNAL_TILESET_PACKS.find(p=>p.id===pack.id);if(JSON.stringify(registered)!==JSON.stringify(pack))throw Error('Served metadata differs');
   return prepareExternalTileset(new File([Uint8Array.from(atob(base64),c=>c.charCodeAt(0))],pack.filename,{type:'image/png'}),registered);
  },{pack,base64:sourceBytes.toString('base64')});
  await fs.writeFile(path.join(out,pack.id+'-prepared.json'),JSON.stringify(prepared));
  const tile=prepared.tileset,originalId=tile.id,id='shared_'+pack.id.replaceAll('-','_'),assetId=id+'_image';
  function remap(value){if(typeof value==='string')return value.replaceAll(originalId,id);if(Array.isArray(value))return value.map(remap);if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).map(([k,v])=>[k,remap(v)]));return value;}
  const t=remap(tile);t.id=id;t.image={type:'uploaded',id:assetId};
  if(t.count!==pack.width*pack.height/1024||t.tilesPerRow!==8||t.tileSize!==32)throw Error('Source numbering changed');
  if(hash(Buffer.from(prepared.dataUrl.split(',')[1],'base64'))!==pack.sha256)throw Error('Native source bytes changed');
  for(const a of[...pack.scenes,...pack.assemblies]){
   const kit=t.structureKits.find(k=>k.id===a.id);if(!kit||JSON.stringify(kit.rows.flatMap(r=>r.tiles))!==JSON.stringify(a.lowerTiles)||JSON.stringify(kit.rows.flatMap(r=>r.upperTiles))!==JSON.stringify(a.upperTiles))throw Error('Kit arrays differ '+a.id);
   const category=kit.referenceDocuments[0],doc=category.documents[0];
   const data=JSON.parse(doc.markdown.match(/```json\s*([\s\S]*?)```/)[1]);
   if(JSON.stringify(data.expected.lowerTiles)!==JSON.stringify(a.lowerTiles)||JSON.stringify(data.expected.upperTiles)!==JSON.stringify(a.upperTiles))throw Error('AI full arrays differ');
   for(const img of category.images)await fs.writeFile(path.join(out,a.id+'-'+img.id+'.png'),Buffer.from(img.dataUrl.split(',')[1],'base64'));
   await fs.writeFile(path.join(out,a.id+'.md'),doc.markdown);
   // Exact difference list excludes unmentioned wrong-example mutations.
   const actual=[];for(const layer of['lowerTiles','upperTiles'])a[layer].forEach((tile,i)=>{if(tile!==data.incorrect[layer][i])actual.push(`${layer}:${i}`);});
   if(actual.sort().join('|')!==data.errors.map(e=>`${e.layer}:${e.y*a.width+e.x}`).sort().join('|'))throw Error('Error coordinate mismatch');
  }
  // All object IDs are globally stable for shared object discovery.
  for(const kit of t.structureKits)kit.id='shared_'+kit.id.replaceAll('-','_');
  library.tilesets[id]=t;library.assets[assetId]={id:assetId,name:pack.filename,kind:'chipset',dataUrl:prepared.dataUrl,meta:{width:pack.width,height:pack.height,tileSize:32,frameWidth:32,frameHeight:32,frames:t.count}};
  for(const s of pack.scenes){
   const placeId='shared_paw_'+s.id.replaceAll('-','_')+'_place',kitId='shared_'+s.id.replaceAll('-','_'),kit=t.structureKits.find(k=>k.id===kitId);
   const place={id:placeId,name:s.name,revision:1,tags:['Pixel Art World','정적 조립',pack.id==='paw-sewer'?'하수도':'목조학교'],provenance:{origin:'ai',sourceId:pack.id},kind:'facility',layout:'manual',children:[],ports:[{id:placeId+'_entry',name:'접근',...s.approachCells[0]}],connections:[],exterior:{tilesetId:id,kitId},referenceDocuments:kit.referenceDocuments};
   library.places[placeId]=place;library.roots.push(placeId);library.previews[placeId]=kit.referenceDocuments[0].images.find(i=>i.id==='assembled').dataUrl;
  }
  observations.push({packId:pack.id,sourcePath,sourceSha256:pack.sha256,sourceBytesPreserved:true,sourceGeometry:[pack.width,pack.height],sourceTileCount:t.count,objects:t.structureKits.length,sceneCount:pack.scenes.length,metadataSha256:hash(pack)});
 }
 if(errors.length)throw Error(errors.join('\n'));
}finally{await browser.close();}
await withTsModule('src/project/collision.ts','paw-school-sewer-collision.mjs',async({canMove,isPassable})=>{
 for(const pack of packs){const id='shared_'+pack.id.replaceAll('-','_'),t=library.tilesets[id];for(const s of pack.scenes){
  const map={id:s.id,name:s.name,tilesetId:id,tileSize:32,width:s.width,height:s.height,lowerTiles:s.lowerTiles,upperTiles:s.upperTiles,events:[]};
  const p={tilesets:{[id]:t}},start=s.approachCells[0],paths=new Map([[`${start.x},${start.y}`,[start]]]),queue=[start];
  if(!isPassable(p,map,start.x,start.y))throw Error('Blocked start');
  for(let q=0;q<queue.length;q++){const a=queue[q];for(const[dx,dy]of[[1,0],[-1,0],[0,1],[0,-1]]){const b={x:a.x+dx,y:a.y+dy},k=`${b.x},${b.y}`;if(!paths.has(k)&&canMove(p,map,a.x,a.y,b.x,b.y)){paths.set(k,[...paths.get(`${a.x},${a.y}`),b]);queue.push(b);}}}
  const required=[...s.approachCells];if(s.id==='sewer-maintenance')required.push({x:2,y:2},{x:5,y:2},{x:5,y:5});if(s.id==='sewer-partition')required.push({x:2,y:2});
  for(const a of required)if(!paths.has(`${a.x},${a.y}`))throw Error(`Engine unreachable ${s.id} ${JSON.stringify(a)} paths=${JSON.stringify([...paths.keys()])}`);
  const unconnected=[];for(let y=0;y<s.height;y++)for(let x=0;x<s.width;x++)if(isPassable(p,map,x,y)&&!paths.has(`${x},${y}`))unconnected.push({x,y});if(unconnected.length)throw Error(`Isolated floor ${s.id}: ${JSON.stringify(unconnected)}`);
  const blocked=s.id==='sewer-maintenance'?[{x:3,y:4},{x:4,y:4},{x:6,y:4},{x:0,y:7},{x:0,y:8}]:s.id==='wood-school-courtyard'?[{x:5,y:5},{x:6,y:5},{x:1,y:2},{x:0,y:8}]:[{x:1,y:2},{x:3,y:2},{x:2,y:1}];
  for(const a of blocked)if(isPassable(p,map,a.x,a.y))throw Error('Expected blocked structure '+s.id);
  observations.push({scene:s.id,authority:'src/project/collision.ts canMove/isPassable',reachable:paths.size,unconnected,paths:required.map(a=>({target:a,path:paths.get(`${a.x},${a.y}`)})),blocked});
 }}
});
await withTsModule('src/project/io/shapeResourceFields.ts','paw-school-sewer-schema.mjs',async mod=>{for(const [id,t] of Object.entries(library.tilesets))mod.validateTileset(id,t);});
for(const [id,t]of Object.entries(library.tilesets))if(project.tilesets[id]||project.assets.uploaded[t.image.id])throw Error('New identity already installed; refresh dependencies');
const artifactSha256={};for(const pack of packs){for(const name of[pack.id+'-prepared.json',...[...pack.scenes,...pack.assemblies].flatMap(a=>[a.id+'.md',a.id+'-assembled.png',a.id+'-comparison.png'])])artifactSha256[name]=hash(await fs.readFile(path.join(out,name)));}
const proof={schema:{authority:"src/project/io/shapeResourceFields.ts validateTileset",tilesets:2,errors:[]},artifactSha256,sourceReceipt:receipt,portableSha256:hash(portableBytes),metadataSha256:hash(packs),librarySha256:hash(library),observations,scope:'Prepared only. No DB, shared publication, canonical save, runtime events or water animation claim.',unsupported:['SC-Water01/02 installation/frame commands','water-level changes/swimming','multi-elevation stair engine','door opening/map transfer events','unlisted source parts']};
await fs.writeFile(path.join(out,'library.json'),JSON.stringify(library));await fs.writeFile(path.join(out,'proof.json'),JSON.stringify(proof,null,2));console.log({out,bytes:Buffer.byteLength(JSON.stringify(library)),tilesets:Object.keys(library.tilesets).length,places:library.roots.length,objects:Object.values(library.tilesets).reduce((n,t)=>n+t.structureKits.length,0),observations:observations.length});
