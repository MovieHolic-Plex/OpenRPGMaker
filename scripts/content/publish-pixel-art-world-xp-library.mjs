// Publish a reviewed user-local import through the shared SQLite API, with CAS/history/reload.
import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {withTsModule} from '../ontology-ts-loader.mjs';
const [preparedDir,out,action]=process.argv.slice(2);
if(!out||action!=='--publish-local')throw Error('Usage: <prepared directory> <private output> --publish-local');
const hash=x=>createHash('sha256').update(x).digest('hex');
const bytes=await fs.readFile(path.join(preparedDir,'library.json'));
const receipt=JSON.parse(await fs.readFile(path.join(preparedDir,'preparation-proof.json'),'utf8'));
if(hash(bytes)!==receipt.librarySha256)throw Error('Prepared library receipt mismatch');
if(hash(await fs.readFile('src/assets/pixelArtWorldAutotiles.json'))!==receipt.catalogSha256||hash(await fs.readFile('tiledata/pixel-art-world/xp-library-layout.json'))!==receipt.layoutSha256)throw Error('Prepared library metadata is stale');
await fs.mkdir(out,{recursive:true});await fs.writeFile(path.join(out,'library.json'),bytes);
const compression=await promisify(execFile)('python3',['scripts/content/compress-pixel-art-world-reference-images.py',path.join(out,'library.json')]);
const lib=JSON.parse(await fs.readFile(path.join(out,'library.json'),'utf8'));
await withTsModule('scripts/lib/sharedContentSqlite.ts','paw-xp-publish.mjs',async api=>{
  const id='pixel-art-world-xp-local',before=api.readSharedContent();
  const expected=before.libraries[id]?hash(JSON.stringify(before.libraries[id])):null;
  const saved=api.publishSharedContent(id,lib,expected),after=api.readSharedContent();
  for(const [other,value]of Object.entries(before.libraries))if(other!==id&&JSON.stringify(after.libraries[other])!==JSON.stringify(value))throw Error('Unrelated shared library changed: '+other);
  const result={libraryId:id,file:saved.file,revision:saved.revision,reloadedEqual:JSON.stringify(saved.reloaded)===JSON.stringify(lib),tilesets:Object.keys(lib.tilesets).length,objects:Object.values(lib.tilesets).reduce((n,t)=>n+t.structureKits.length,0),sources:receipt.sources,source:receipt.source,referenceCompression:JSON.parse(compression.stdout),places:Object.keys(lib.places).length,regions:Object.keys(lib.regions).length};
  await fs.writeFile(path.join(out,'proof.json'),JSON.stringify(result,null,2));console.log(result);
});
