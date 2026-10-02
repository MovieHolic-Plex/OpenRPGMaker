import type { Project } from "@/project/types";
import { terrainRecordAt, type TerrainLocation } from "@/project/terrainAt";
import { climateBattleBackground } from "@/battle/battleBackdrop";

export const BATTLE_SCENERY_BIOMES = ["plains", "forest", "cave", "snow", "desert"] as const;
export type BattleSceneryBiome = typeof BATTLE_SCENERY_BIOMES[number];
export const BATTLE_SCENERY_LAYERS = ["sky", "far", "mid", "ground"] as const;

/** 그림 에이전트와 런타임·내보내기가 공유하는 고정 경로 계약. */
export const BATTLE_SCENERY_CATALOG = BATTLE_SCENERY_BIOMES.map((biome) => ({
  biome,
  resourceId: `battle-scenery-${biome}`,
  layers: Object.fromEntries(BATTLE_SCENERY_LAYERS.map((layer) =>
    [layer, `assets/generated/battle-scenery/${biome}/${layer}.png`])) as Record<typeof BATTLE_SCENERY_LAYERS[number], string>,
  /** 네 겹을 합친 한 장(640×360). 편집기 종류 카드·미리보기와 단일 그림 대체에 쓴다. */
  preview: `assets/generated/battle-scenery/${biome}/preview.png`,
}));

/** 조수 도구 설명 — 전투 배경 id 칸(적 그룹·지형·맵)이 공유한다. */
export const BATTLE_BACKDROP_ID_HINT =
  "전투 배경. 도트 측면 전투(기본)는 그림을 그대로 깔지 않고 겹 배경 종류로 푼다 — "
  + BATTLE_SCENERY_BIOMES.map((biome) => `battle-scenery-${biome}`).join(" | ")
  + " 중 하나를 쓴다(이스턴 RPG 기본 배경·옛 스킨 배경은 전부 풀밭이 된다). 업로드한 그림 id 만 그대로 깔린다. 몬스터 대치(포켓몬식)는 고른 그림을 그대로 쓴다.";

export function sceneryBiomeFromResourceId(id: string | undefined): BattleSceneryBiome | undefined {
  return BATTLE_SCENERY_CATALOG.find((entry) => entry.resourceId === id)?.biome;
}

export interface SceneryContext {
  readonly backdropResourceId?: string;
  readonly troopId?: string;
  readonly location?: TerrainLocation;
}

/** undefined 는 저작자가 고른 임의 그림이므로 교체하지 말라는 뜻이다. */
export function resolveSceneryBiome(project: Project, input: SceneryContext = {}): BattleSceneryBiome | undefined {
  const troop = project.database.troops.find((entry) => entry.id === input.troopId);
  const id = input.backdropResourceId ?? troop?.previewBackgroundResourceId;
  const explicit = sceneryBiomeFromResourceId(id);
  if (explicit) return explicit;
  if (id) {
    if (id === "generated-battle-reference-forest") return "forest";
    if (id === "scarloxy-backdrop-ice") return "snow";
    if (id === "scarloxy-backdrop-sand") return "desert";
    if (/^easyrpg-backdrop-|^battle-skin-.*-backdrop$/.test(id)) return "plains";
    return undefined;
  }
  const name = terrainRecordAt(project, input.location)?.record.name ?? "";
  const names: readonly [RegExp, BattleSceneryBiome][] = [
    [/설원|눈|snow|ice/i, "snow"], [/사막|desert|sand/i, "desert"],
    [/동굴|던전|cave|dungeon/i, "cave"], [/숲|forest|wood/i, "forest"],
    [/초원|평원|plains|grass|meadow/i, "plains"],
  ];
  for (const [pattern, biome] of names) if (pattern.test(name)) return biome;
  if (climateBattleBackground(project, input.location?.mapId) === "scarloxy-backdrop-ice") return "snow";
  const map = input.location && project.maps[input.location.mapId];
  if (map && /dungeon|cave|interior/i.test(map.tilesetId)) return "cave";
  return "plains";
}
