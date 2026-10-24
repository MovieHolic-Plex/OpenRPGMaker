import { assignTrainerSprites } from "./trainerArt";
import { createExpeditionSeed } from "./seed";
import { distributeNpcCharsets } from "./npcFaces";
import { configureScarloxyPokemonDemoProject } from "@/project/defaults/scarloxyPokemonDemoGame";
import { configureExpeditionRoster } from "./roster";
import { configureExpeditionAudio } from "./audio";
import { configureExpeditionOpening } from "./opening";
import { authorExpeditionWorld } from "./world";
import type { HomeTownLayout, StartTheme } from "./townLayouts";
import { clampGymCount, FULL_GYMS, planFromBuilt, retellForGymCount } from "./campaignPlan";
import { pruneUnusedSpecies } from "./campaignSpecies";
import { deserialize, serialize } from "@/project/io";
import { DEFAULT_ACTOR_ID } from "@/project/defaults/constants";
import { prepareWebExport } from "@/project/webExport";
import { configureMonsterPresentation } from "@/project/monsterPresentation";
import { configureEmeraldMonsterStyle } from "@/project/emeraldMonsterStyle";
import { configureEmeraldMonsterOpening } from "@/project/emeraldMonsterOpening";
import { configureEmeraldMonsterCast } from "@/project/emeraldMonsterCast";
import { remapCharsetsToPreset } from "@/project/genreLockCharsets";
import { monsterTitleThemeFromStart } from "@/project/emeraldMonsterTitleArt";

/** Complete, ordinary editable campaign: the player uses the shipping engine. */
/** gymTypes: 기획서의 1~8관 타입(「바위 체육관」→rock) — 관장 동료만 그 타입으로 바꾼다. 맵·장치는 그대로. firstGymType 은 gymTypes[0] 의 옛 이름. */
/** startTheme: 기획서의 시작 마을 풍경(사막·눈·바닷가). 생략하면 풀밭 별싹 마을. */
/** gymCount: 체육관(=배지) 수 0~8, 생략 = 8(본래 90맵 캠페인). 적으면 마을·길·리그를 앞에서부터 잘라 쓰고 정의에 plan(검수 하한)을 싣는다.
 * speciesCount: 도감을 이 수 이상으로 줄인다(쓰지 않는 계통만 덜어 냄 — 실제 수는 plan.species). 생략 = 60종. */
export interface ExpeditionOptions { readonly firstGymType?: string; readonly gymTypes?: readonly (string | undefined)[]; readonly startTheme?: StartTheme; readonly gymCount?: number; readonly speciesCount?: number; readonly startLayout?: HomeTownLayout }

export function createMonsterExpedition(options: ExpeditionOptions = {}) {
  const project = createExpeditionSeed();
  const hero = project.database.actors.find(a => a.id === DEFAULT_ACTOR_ID)!;
  configureScarloxyPokemonDemoProject(project);
  configureMonsterPresentation(project);
  // 주인공 걷기 그림은 몬스터 테이밍 팩 트레이너(Scarloxy People1 0번)로 둔다 — 예전에는 여기서 기본 Actor1 로 되돌렸다(2026-10-16 장르 잠금 charset).
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
  const manifest = authorExpeditionWorld(project, options);
  const usedTilesets = new Set(Object.values(project.maps).map(map => map.tilesetId));
  project.tilesets = Object.fromEntries(Object.entries(project.tilesets).filter(([id]) => usedTilesets.has(id)));
  project.database.monsterSpecies = project.database.monsterSpecies?.filter(s => s.id.startsWith("mx_species_"));
  project.database.enemies = project.database.enemies.filter(e => e.id.startsWith("mx_enemy_"));
  project.database.troops = project.database.troops.filter(t => t.id.startsWith("mx_troop_"));
  project.system.initialTroopId = project.database.troops[0]!.id;
  // The shared campaign and editor tool must produce the same coherent profile.
  // Apply after world creation so the intro names the actual starting place.
  configureEmeraldMonsterStyle(project);
  // Tiles stay on the bright monster_* kit (tone A, 2026-10-06); emerald_monster_* is kept only for projects already on it.
  configureEmeraldMonsterCast(project, { startTheme: options.startTheme });
  configureEmeraldMonsterOpening(project, { titleTheme: monsterTitleThemeFromStart(options.startTheme) });
  // 체육관 수를 줄인 캠페인의 서사·타이틀 속 「여덟」을 그 수로 고친다(8관은 그대로).
  retellForGymCount(project, options.gymCount ?? 8);
  // 체육관 수·종 수를 요청한 캠페인은 만든 결과를 검수 하한(plan)으로 정의에 싣는다. 기본 캠페인은 plan 없이 옛 고정 계약(72/60/8/142) 그대로.
  const gymCount = clampGymCount(options.gymCount);
  const requestedSpecies = typeof options.speciesCount === "number" && Number.isFinite(options.speciesCount) ? Math.max(1, Math.round(options.speciesCount)) : undefined;
  if (requestedSpecies !== undefined && requestedSpecies < project.system.monsterCampaign!.speciesIds.length) pruneUnusedSpecies(project, requestedSpecies);
  if (gymCount < FULL_GYMS || requestedSpecies !== undefined) {
    let links = 0;
    const count = (value: unknown): void => { if (Array.isArray(value)) value.forEach(count); else if (value && typeof value === "object") { if ((value as { kind?: unknown }).kind === "transfer") links++; Object.values(value).forEach(count); } };
    for (const map of Object.values(project.maps)) for (const e of map.events) count(e.pages ?? e.commands);
    project.system.monsterCampaign!.plan = planFromBuilt({ gyms: gymCount, species: project.system.monsterCampaign!.speciesIds.length, maps: Object.keys(project.maps).length, links });
  }
  // 트레이너 전투 인물 그림(번들 그림 role id) — 시각 QA D03: 67개 troop 전부 비어 있어 상대·주인공 그림과 등장 연출이 없었다.
  assignTrainerSprites(project);
  // 캐릭터 칩도 장르 잠금 표(monster-collect)에 맞춘다: RTP 사람 칩 → 몬스터 테이밍 트레이너 칩(같은 인물은 늘 같은 칩, 성별·나이가 가까운 것). 이 프로젝트는 방금 생성한 것이라 바꿔도 저작자 그림을 해치지 않는다.
  remapCharsetsToPreset(project, "monster-collect");
  // 같은 장르 칩 10칸 안에서 역할별로 얼굴을 나눈다(시각 QA D02).
  distributeNpcCharsets(project);
  // The canonical loader checks command IDs, tiles, assets and all DB references.
  const serialized = serialize(project);
  const reloaded = deserialize(serialized);
  return { project: reloaded, serialized, manifest };
}

export const prepareExpeditionExport = prepareWebExport;
