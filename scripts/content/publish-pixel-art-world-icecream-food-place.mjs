import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {chromium} from 'playwright';
import {withTsModule} from '../ontology-ts-loader.mjs';
const[host,preparedDir,out,action]=process.argv.slice(2);
if(!out||action!=='--publish-local')throw Error('Usage: <canonical host> <private proposal> <private output> --publish-local');
const hash=x=>createHash('sha256').update(typeof x==='string'||Buffer.isBuffer(x)?x:JSON.stringify(x)).digest('hex');
const proof=JSON.parse(await fs.readFile(preparedDir+'/preparation-proof.json','utf8'));
const lib=JSON.parse(await fs.readFile(preparedDir+'/library.json','utf8')),deps=proof.beforeDependencies;
if(hash(await fs.readFile('src/project/collision.ts'))!==deps.collisionSourceSha256)throw Error('Collision authority changed');
if(lib.sourceProjectId!==proof.sourceReceipt.projectId||Object.keys(lib.places).length!==1||Object.keys(lib.tilesets).length!==1||Object.keys(lib.assets).length!==1)throw Error('Unexpected proposal scope');
if(hash(Buffer.from(lib.assets[proof.newIds.asset].dataUrl.split(',')[1],'base64'))!==proof.resultAssetSha256)throw Error('Proposal atlas changed');
await withTsModule('src/project/io/shapeResourceFields.ts','paw-food-place-validate.mjs',api=>{for(const[id,t]of Object.entries(lib.tilesets))api.validateTileset(id,t);});
const browser=await chromium.launch();let source;
try{
 const p=await browser.newPage();await p.goto(new URL('/__oprn/team',host).href);await p.waitForFunction(()=>window.oprn?.project);
 source=await p.evaluate(async ids=>{
  const status=await window.oprn.project.status(),loaded=await window.oprn.project.load(),project=JSON.parse(loaded.serialized);
  const sums={};for(const id of ids){if(!project.tilesets[id])throw Error('Missing source tileset '+id);const bytes=new TextEncoder().encode(JSON.stringify(project.tilesets[id]));sums[id]=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),x=>x.toString(16).padStart(2,'0')).join('');}
  return {projectId:status.projectId,projectDir:status.projectDir,revision:loaded.revision,sha256:loaded.sha256,tilesetHashes:sums};
 },[deps.baseTileset.id,deps.foodTileset.id]);
}finally{await browser.close();}
if(source.projectId!==proof.sourceReceipt.projectId||source.projectDir!==proof.sourceReceipt.projectDir)throw Error('Canonical target changed');
for(const d of [deps.baseTileset,deps.foodTileset])if(source.tilesetHashes[d.id]!==d.sha256)throw Error('Canonical dependency changed '+d.id);
await fs.mkdir(out,{recursive:true});await fs.writeFile(out+'/library.json',JSON.stringify(lib));
const compression=await promisify(execFile)('python3',['scripts/content/compress-pixel-art-world-reference-images.py',out+'/library.json']);
const compressed=JSON.parse(await fs.readFile(out+'/library.json','utf8'));
await withTsModule('scripts/lib/sharedContentSqlite.ts','paw-food-place-publish.mjs',async api=>{
 const before=api.readSharedContent(),base=before.libraries[deps.basePlace.libraryId];
 if(hash(base?.places[deps.basePlace.id])!==deps.basePlace.sha256||hash(base?.tilesets[deps.sharedBaseTileset.id])!==deps.sharedBaseTileset.sha256)throw Error('Shared base changed');
 const id='pixel-art-world-food-place-local',previous=before.libraries[id];
 if(previous&&hash(previous)!==hash(compressed))throw Error('Existing food place differs; explicit revision required');
 const saved=api.publishSharedContent(id,compressed,previous?hash(previous):null),after=api.readSharedContent();
 for(const[other,value]of Object.entries(before.libraries))if(other!==id&&JSON.stringify(after.libraries[other])!==JSON.stringify(value))throw Error('Other library changed '+other);
 const result={libraryId:id,file:saved.file,revision:saved.revision,source,reloadedEqual:JSON.stringify(saved.reloaded)===JSON.stringify(compressed),places:1,tilesets:1,objects:3,scope:'Static 10x8 place and complete object assemblies; gameplay events authored separately',compression:JSON.parse(compression.stdout)};
 await fs.writeFile(out+'/proof.json',JSON.stringify(result,null,2));console.log(result);
});
