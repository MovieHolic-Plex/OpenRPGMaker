// Prepare a detached art revision; the official store helper owns CAS/save/reload.
import fs from 'node:fs/promises';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {isDeepStrictEqual as same} from 'node:util';
import {withTsModule} from '../ontology-ts-loader.mjs';
const [input,out]=process.argv.slice(2);
if(!out)throw Error('Usage: apply-emerald-art-v2.mjs <reloaded-canonical.json> <private-output>');
const raw=await fs.readFile(input,'utf8');
const before=await withTsModule(resolve('src/project/cinematicWire.ts'),'decode.mjs',m=>m.decodeCinematicWire(JSON.parse(raw)));
const project=structuredClone(before);
if(project.system.monsterCampaign?.id!=='starlight-islands')throw Error('Wrong campaign');
await withTsModule(resolve('src/project/emeraldMonsterCast.ts'),'cast.mjs',m=>m.configureEmeraldMonsterCast(project));
const professor=JSON.parse(await fs.readFile('public/assets/emerald-monster/professor-asset.json','utf8'));
project.assets.uploaded[professor.id]=professor;
await withTsModule(resolve('src/project/emeraldMonsterOpening.ts'),'title.mjs',m=>m.configureEmeraldMonsterTitle(project));
if(!same(project.session,before.session)||!same(project.system.opening,before.system.opening))throw Error('Session or opening story changed');
if(!same([project.startMapId,project.startPos],[before.startMapId,before.startPos]))throw Error('Start changed');
if(!same(Object.keys(project.maps),Object.keys(before.maps)))throw Error('Map identities changed');
for(const id of Object.keys(before.maps)){
  const a=structuredClone(before.maps[id]),b=structuredClone(project.maps[id]);
  for(const map of [a,b])for(const event of map.events)for(const page of event.pages){delete page.graphic.sprite;delete page.graphic.pattern;}
  if(!same(a,b))throw Error('Map/events/movement/collision changed: '+id);
}
for(const key of Object.keys(before.database)){
  const a=structuredClone(before.database[key]),b=structuredClone(project.database[key]);
  if(key==='actors')for(const list of [a,b])for(const actor of list){delete actor.characterResourceId;delete actor.characterIndex;}
  if(!same(a,b))throw Error('Database changed: '+key);
}
const wire=await withTsModule(resolve('src/project/cinematicWire.ts'),'encode.mjs',m=>m.encodeCinematicWire(project));
await fs.mkdir(out,{recursive:true});
await fs.writeFile(resolve(out,'prepared-canonical.json'),JSON.stringify(wire));
const cache=JSON.parse(await fs.readFile('/tmp/oprn-emerald-20261004/canonical-portable-cache/project.json','utf8'));
for(const [id,asset] of Object.entries(project.assets.uploaded))if(asset.dataUrl)cache.assets.uploaded[id]=asset;
await fs.writeFile(resolve(out,'portable-cache.json'),JSON.stringify(cache));
await fs.copyFile('/tmp/oprn-emerald-20261004/canonical-portable-cache/world-manifest.json',resolve(out,'world-manifest.json'));
const receipt={sourceSha256:createHash('sha256').update(raw).digest('hex'),maps:Object.keys(project.maps).length,species:project.database.monsterSpecies.length,openingPages:project.system.opening.scenes.length,sessionAndStoryPreserved:true,mapEventsMovementCollisionPreserved:true,monsterDataAndArtworkPreserved:true,canonicalSaved:false};
await fs.writeFile(resolve(out,'preparation-receipt.json'),JSON.stringify(receipt,null,2));
console.log(JSON.stringify(receipt));
