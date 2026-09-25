// Explicit local publication of reviewed user-downloaded sources; no remote writes.
import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {withTsModule} from '../ontology-ts-loader.mjs';
const [preparedDir, portableFile, receiptFile, out, action] = process.argv.slice(2);
if (!out || !['--prepare','--publish-local'].includes(action)) throw Error('Usage: <prepared directory> <canonical portable.json> <receipt.json> <private output> --prepare|--publish-local');
const read = async p => JSON.parse(await fs.readFile(p,'utf8'));
const hash = v => createHash('sha256').update(typeof v==='string'||Buffer.isBuffer(v)?v:JSON.stringify(v)).digest('hex');
const key = id => 'shared_'+id.replaceAll('-','_');
const libraryId = 'pixel-art-world-school-sewer-local';
const packs = await read('src/assets/pixelArtWorldSchoolSewerCatalog.json');
const proof = await read(path.join(preparedDir,'proof.json'));
const lib = await read(path.join(preparedDir,'library.json'));
const receipt = await read(receiptFile);
if (hash(await fs.readFile(portableFile))!==receipt.portableSha256 || hash(receipt)!==hash(proof.sourceReceipt) || proof.portableSha256!==receipt.portableSha256) throw Error('Canonical preparation receipt differs');
if (hash(packs)!==proof.metadataSha256 || hash(lib)!==proof.librarySha256 || lib.sourceProjectId!==receipt.projectId) throw Error('Prepared source changed');
for (const [filename,sha] of Object.entries(proof.artifactSha256)) {
  if (path.basename(filename)!==filename || hash(await fs.readFile(path.join(preparedDir,filename)))!==sha) throw Error('Prepared artifact changed '+filename);
}
if (Object.keys(lib.tilesets).length!==2 || Object.keys(lib.assets).length!==2 || Object.keys(lib.places).length!==3 || Object.keys(lib.maps).length || Object.keys(lib.regions).length) throw Error('Unexpected publication scope');
for (const pack of packs) {
  const id=key(pack.id), tile=lib.tilesets[id], asset=lib.assets[tile?.image.id];
  const source=proof.observations.find(o=>o.packId===pack.id);
  if (!source || hash(await fs.readFile(source.sourcePath))!==pack.sha256 || hash(Buffer.from(asset?.dataUrl?.split(',')[1]??'','base64'))!==pack.sha256) throw Error('Original PNG differs '+pack.id);
  for (const scene of [...pack.scenes,...pack.assemblies]) {
    const kit=tile.structureKits.find(k=>k.id===key(scene.id));
    if (!kit || kit.width!==scene.width || kit.height!==scene.height || hash(kit.rows.flatMap(r=>r.tiles))!==hash(scene.lowerTiles) || hash(kit.rows.flatMap(r=>r.upperTiles))!==hash(scene.upperTiles)) throw Error('Whole assembly changed '+scene.id);
    const document=kit.referenceDocuments[0].documents[0], data=JSON.parse(document.markdown.match(/```json\s*([\s\S]*?)```/)[1]);
    if (!document.markdown.includes(id) || hash(data.expected.lowerTiles)!==hash(scene.lowerTiles) || hash(data.expected.upperTiles)!==hash(scene.upperTiles)) throw Error('AI arrays differ '+scene.id);
  }
}
await withTsModule('src/project/io/shapeResourceFields.ts','school-sewer-publish-shape.mjs',api=>{
  for(const [id,tile] of Object.entries(lib.tilesets)) api.validateTileset(id,tile);
});
await fs.mkdir(out,{recursive:true});
await fs.writeFile(path.join(out,'library.json'),JSON.stringify(lib));
const compression=await promisify(execFile)('python3',['scripts/content/compress-pixel-art-world-reference-images.py',path.join(out,'library.json')]);
const compressed=await read(path.join(out,'library.json'));
const result={libraryId,source:receipt,tilesets:2,assets:2,objects:7,placeRasters:3,places:3,scope:'Static complete assemblies; no city connections, water animations or authored event claims.',compression:JSON.parse(compression.stdout)};
if(action==='--publish-local') await withTsModule('scripts/lib/sharedContentSqlite.ts','school-sewer-publish.mjs',async api=>{
  const before=api.readSharedContent(),old=before.libraries[libraryId];
  if(old&&hash(old)!==hash(compressed))throw Error('Existing school/sewer library differs; prepare an explicit revision');
  for(const[id,other]of Object.entries(before.libraries))if(id!==libraryId){
    for(const tile of Object.keys(compressed.tilesets))if(other.tilesets[tile])throw Error('Another library owns '+tile);
    for(const asset of Object.keys(compressed.assets))if(other.assets[asset])throw Error('Another library owns '+asset);
    for(const place of Object.keys(compressed.places))if(other.places[place])throw Error('Another library owns '+place);
  }
  const saved=api.publishSharedContent(libraryId,compressed,old?hash(old):null),after=api.readSharedContent();
  for(const[id,other]of Object.entries(before.libraries))if(id!==libraryId&&hash(after.libraries[id])!==hash(other))throw Error('Unrelated library changed '+id);
  Object.assign(result,{file:saved.file,revision:saved.revision,reloadedEqual:hash(saved.reloaded)===hash(compressed)});
});
await fs.writeFile(path.join(out,'proof.json'),JSON.stringify(result,null,2));
console.log(result);
