// Transient UI contract fixture; does not author or save an application demo.
import { writeFileSync, readFileSync, mkdirSync } from 'node:fs';
import { createScarloxyPokemonDemoProject } from '../../../src/project/defaults/defaultProject';
const project = createScarloxyPokemonDemoProject();
const originalMap = project.maps[project.startMapId]!;
const minimal = JSON.parse(readFileSync('test/fixtures/projects/battle-v3.json', 'utf8'));
project.maps = minimal.maps;
project.startMapId = minimal.startMapId;
project.startPos = minimal.startPos;
const map = project.maps[project.startMapId]!;
map.tilesetId = originalMap.tilesetId;
for (const troop of project.database.troops) { troop.previewBackgroundResourceId = undefined; troop.autoAlign = true; }
for (const terrain of project.database.terrains ?? []) terrain.battleBackgroundResourceId = undefined;
const species = project.database.monsterSpecies!;
const seed = species.find(s => s.id === "species_scarloxy_mossling")!;
seed.name = "이상해씨";
seed.types = ["grass", "poison"];
seed.graphic.backResourceId = "generated-enemy-reference-seed-back";
const cocoon = project.database.enemies.find(e => e.id === "enemy_pkmn_larvea")!;
cocoon.name = "단데기";
cocoon.level = 7;
cocoon.monsterResourceId = "generated-enemy-reference-cocoon";
species.find(s => s.id === cocoon.speciesId)!.types = ["bug"];

(map.events[0] as unknown as { commands: unknown[] }).commands = [
  {kind:'giveMonster', speciesId:species.find(s => s.id === "species_scarloxy_mossling")!.id, level:11},
  {kind:'giveMonster', speciesId:species.find(s => s.id === "species_scarloxy_sparchu")!.id, level:7},
  {kind:'battleProcessing', troopId:"troop_pkmn_grass_a", canEscape:true, canLose:true},
];
mkdirSync('verify-shots/runtime-qa/pokemon-reference', { recursive: true });
writeFileSync('verify-shots/runtime-qa/pokemon-reference/fixture.json', JSON.stringify(project));
