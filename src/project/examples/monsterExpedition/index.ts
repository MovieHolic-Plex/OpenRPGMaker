import { createExpeditionSeed } from "./seed";
import { configureScarloxyPokemonDemoProject } from "@/project/defaults/scarloxyPokemonDemoGame";
import { configureExpeditionRoster } from "./roster";
import { configureExpeditionAudio } from "./audio";
import { configureExpeditionOpening } from "./opening";
import { authorExpeditionWorld } from "./world";
import { deserialize, serialize } from "@/project/io";
import { DEFAULT_ACTOR_ID } from "@/project/defaults/constants";
import { prepareWebExport } from "@/project/webExport";
import { configureMonsterPresentation } from "@/project/monsterPresentation";
import { configureEmeraldMonsterStyle } from "@/project/emeraldMonsterStyle";
import { configureEmeraldMonsterOpening } from "@/project/emeraldMonsterOpening";
import { configureEmeraldMonsterCast } from "@/project/emeraldMonsterCast";
import { configureEmeraldMonsterTiles } from "@/project/emeraldMonsterTiles";

/** Complete, ordinary editable campaign: the player uses the shipping engine. */
export function createMonsterExpedition() {
  const project = createExpeditionSeed();
  const hero = project.database.actors.find(a => a.id === DEFAULT_ACTOR_ID)!;
  const character = hero.characterResourceId;
  configureScarloxyPokemonDemoProject(project);
  configureMonsterPresentation(project);
  hero.characterResourceId = character;
  hero.characterIndex = 0;
  hero.name = "여행자";
  project.meta.title = "별빛섬 몬스터 원정";
  project.meta.author = "OPRN Studio";
  configureExpeditionRoster(project);
  configureExpeditionAudio(project);
  configureExpeditionOpening(project);
  const ether = project.database.items.find(i => i.id === "item_ether")!;
  ether.ppRecovery = { flat: 10, percentMax: 0 };
  ether.mpRecovery = { flat: 0, percentMax: 0 };
  ether.name = "기술 에테르";
  ether.description = "몬스터가 배운 기술의 PP를 각각 10 회복한다.";
  project.system.menuUiStyle = "pixel";
  project.system.fieldHud = { theme: "collector", font: "pixel", menuStyle: "project", vitals: false, clock: false, tools: false, objective: false, hideEmpty: true };
  project.system.actionCombat = { ...project.system.actionCombat, enabled: false, hud: { hearts: false, stamina: false, enemyHpBars: "never" } };
  if (project.system.titleScreen) project.system.titleScreen.title = project.meta.title;
  project.system.dialogueStyle = "handheld";
  project.system.dialogueSpeed = 2;
  project.session.monsterInstances = {};
  project.session.monsterParty = [];
  project.session.monsterBox = [];
  const manifest = authorExpeditionWorld(project);
  const usedTilesets = new Set(Object.values(project.maps).map(map => map.tilesetId));
  project.tilesets = Object.fromEntries(Object.entries(project.tilesets).filter(([id]) => usedTilesets.has(id)));
  project.database.monsterSpecies = project.database.monsterSpecies?.filter(s => s.id.startsWith("mx_species_"));
  project.database.enemies = project.database.enemies.filter(e => e.id.startsWith("mx_enemy_"));
  project.database.troops = project.database.troops.filter(t => t.id.startsWith("mx_troop_"));
  project.system.initialTroopId = project.database.troops[0]!.id;
  // The shared campaign and editor tool must produce the same coherent profile.
  // Apply after world creation so the intro names the actual starting place.
  configureEmeraldMonsterStyle(project);
  configureEmeraldMonsterTiles(project);
  configureEmeraldMonsterCast(project);
  configureEmeraldMonsterOpening(project);
  // The canonical loader checks command IDs, tiles, assets and all DB references.
  const serialized = serialize(project);
  const reloaded = deserialize(serialized);
  return { project: reloaded, serialized, manifest };
}

export const prepareExpeditionExport = prepareWebExport;
