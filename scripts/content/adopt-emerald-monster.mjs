// Prepare a detached revision. Official host save/CAS is a separate explicit step.
import fs from 'node:fs/promises';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import { withTsModule } from '../ontology-ts-loader.mjs';
const [input, output] = process.argv.slice(2);
if (!input || !output) throw Error('Usage: adopt-emerald-monster.mjs <canonical.json> <private-output-dir>');
const raw=await fs.readFile(input,'utf8'), parsed=JSON.parse(raw);
const before=await withTsModule(resolve('src/project/cinematicWire.ts'),'decode-campaign.mjs',m=>m.decodeCinematicWire(parsed));
const candidate=structuredClone(before);
if(candidate.system.monsterCampaign?.id!=='starlight-islands')throw Error('This content adoption is for the existing Starlight campaign only.');
await withTsModule(resolve('src/project/monsterPresentation.ts'),'presentation.mjs',m=>m.configureMonsterPresentation(candidate));
await withTsModule(resolve('src/project/emeraldMonsterStyle.ts'),'style.mjs',m=>m.configureEmeraldMonsterStyle(candidate));
const mapsUpdated=await withTsModule(resolve('src/project/emeraldMonsterTiles.ts'),'tiles.mjs',m=>m.configureEmeraldMonsterTiles(candidate));
await withTsModule(resolve('src/project/emeraldMonsterCast.ts'),'cast.mjs',m=>m.configureEmeraldMonsterCast(candidate));
const creatureAssets=await withTsModule(resolve('src/project/emeraldMonsterCreatureArt.ts'),'creatures.mjs',m=>m.configureEmeraldMonsterCreatureArt(candidate,true));
await withTsModule(resolve('src/project/emeraldMonsterOpening.ts'),'opening.mjs',m=>m.configureEmeraldMonsterOpening(candidate,{pages:[
  {id:'emerald_starlight_welcome',text:'안녕! 나는 천문박사란다.\n여기는 사람과 몬스터가 함께 사는 별빛섬이지.'},
  {id:'emerald_starlight_grass',text:'이 친구는 새싹토야. 풀숲을 좋아하지.\n작은 친구도 든든한 동료가 된단다.',monsterSpeciesId:'mx_species_spriglet'},
  {id:'emerald_starlight_fire',text:'숯비늘은 따뜻한 불을 품고 있어.\n잘하는 기술도, 사는 곳도 다르단다.',monsterSpeciesId:'mx_species_coalbit'},
  {id:'emerald_starlight_water',text:'여울랑은 물길을 자유롭게 헤엄친단다.\n너와 함께할 첫 친구는 네가 직접 고르렴.',monsterSpeciesId:'mx_species_rivulet'},
  {id:'emerald_starlight_beacon',text:'우리 등대의 별빛은 먼 배들의 길잡이였지.\n그런데 요즘은 밤이 되어도 빛이 희미하구나.'},
  {id:'emerald_starlight_company',text:'밤막회사가 별빛을 거둔다는구나.\n섬을 돌아다니며 무슨 일인지 살펴보렴.'},
  {id:'emerald_starlight_journey',text:'함께 체육관에 도전해 배지를 모아 보렴.\n사라진 등대의 빛도 찾을 수 있겠지.'},
  {id:'emerald_starlight_departure',text:'별싹 마을 북동쪽 연구소에서 기다리마.\n너와 첫 친구의 모험을 시작하렴!'},
]}));
if(!isDeepStrictEqual(candidate.session,before.session))throw Error('Authored session changed');
if(!isDeepStrictEqual([candidate.startMapId,candidate.startPos],[before.startMapId,before.startPos]))throw Error('Starting position changed');
const mapsBefore=Object.keys(before.maps),mapsAfter=Object.keys(candidate.maps);
if(!isDeepStrictEqual(mapsBefore,mapsAfter))throw Error('Map identities changed');
for(const id of mapsBefore){
  const old=structuredClone(before.maps[id]),next=structuredClone(candidate.maps[id]);
  delete old.tilesetId;delete next.tilesetId;
  for(const map of [old,next])for(const event of map.events)for(const page of event.pages){
    delete page.graphic.sprite;delete page.graphic.pattern;
  }
  if(!isDeepStrictEqual(old,next))throw Error('Map raster/events/routes changed: '+id);
  const a=before.tilesets[before.maps[id].tilesetId],b=candidate.tilesets[candidate.maps[id].tilesetId];
  for(const field of ['priority','passability','terrain','autotileGroups','structureKits','slideTiles','ledgeDirections']){
    if(!isDeepStrictEqual(a[field],b[field]))throw Error('Authored tile table changed: '+id+' '+field);
  }
}
for(const key of Object.keys(before.database)){
  if(key==='actors'){
    const projectActors = [before,candidate].map(project => project.database.actors.map(actor => {
      const value=structuredClone(actor);delete value.characterResourceId;delete value.characterIndex;return value;
    }));
    if(!isDeepStrictEqual(...projectActors))throw Error('Actor data changed beyond character artwork');
    continue;
  }
  if(!isDeepStrictEqual(before.database[key],candidate.database[key]))throw Error('Database changed: '+key);
}
const wire=await withTsModule(resolve('src/project/cinematicWire.ts'),'encode-campaign.mjs',m=>m.encodeCinematicWire(candidate));
await fs.mkdir(output,{recursive:true});
await fs.writeFile(resolve(output,'prepared-canonical.json'),JSON.stringify(wire));
await fs.writeFile(resolve(output,'adoption-receipt.json'),JSON.stringify({sourceSha256:createHash('sha256').update(raw).digest('hex'),maps:mapsAfter.length,mapsUpdated,species:before.database.monsterSpecies.length,creatureAssets:creatureAssets.length,openingPages:candidate.system.opening.scenes.length,sessionPreserved:true,startPreserved:true,mapRasterEventsRoutesPreserved:true,authoredTileTablesPreserved:true,databasePreservedExceptHeroGraphic:true,canonicalSaved:false},null,2));
console.log(JSON.stringify({output,mapsUpdated,creatureAssets:creatureAssets.length,canonicalSaved:false}));
