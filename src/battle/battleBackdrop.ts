import {
  DEFAULT_BATTLE_FIELD_BACKGROUND_ID,
  normalizeBattleFieldBackgroundId,
} from "@/project/databaseEnemyTroopRecordModel";
import { terrainRecordAt } from "@/project/terrainAt";
import { normalizeBattleBackdropAnimation } from "@/project/battleBackdropAnimation";
import type { BattleBackdropAnimation, Project } from "@/project/types";
import type { TroopId } from "@/project/types/base";

export type BattleBackdropLocation = {
  readonly mapId: string;
  readonly x: number;
  readonly y: number;
};

/**
 * Resolve the battle field background for a fight.
 * Priority: explicit override → troop preview → terrain at map tile → map climate → forest fallback.
 * EasyRPG sky panoramas are rewritten by normalizeBattleFieldBackgroundId.
 */
export function resolveBattleBackdrop(input: {
  readonly project: Project;
  readonly troopId: TroopId;
  readonly overrideResourceId?: string;
  readonly location?: BattleBackdropLocation;
}): string {
  const id = resolveBattleBackdropId(input);
  return input.project.system.battleUiStyle === "pokemon" ? pokemonBattleBackdropId(id) : id;
}

/** 포켓몬 전투의 정본 바닥(GBA 줄무늬). 이 id 의 배경 그림은 포켓몬 스킨 CSS 가 숨긴다. */
export const POKEMON_BATTLE_BACKDROP_ID = "battle-skin-pokemon-backdrop";

/**
 * 포켓몬 전투는 도트 겹 배경(battle-scenery-*)을 쓰지 않는다 — 그 id 는 줄무늬 바닥 표지로 돌린다.
 * Scarloxy 배경·업로드 그림처럼 저자가 고른 그림은 그대로 둔다.
 */
export function pokemonBattleBackdropId(id: string): string {
  return id.startsWith("battle-scenery-") ? POKEMON_BATTLE_BACKDROP_ID : id;
}

function resolveBattleBackdropId(input: {
  readonly project: Project;
  readonly troopId: TroopId;
  readonly overrideResourceId?: string;
  readonly location?: BattleBackdropLocation;
}): string {
  const troop = input.project.database.troops.find((entry) => entry.id === input.troopId);
  const override = normalizeBattleFieldBackgroundId(input.overrideResourceId);
  if (override) return override;
  const troopBg = normalizeBattleFieldBackgroundId(troop?.previewBackgroundResourceId);
  // 적 그룹의 숲 배경은 만들 때 도구가 찍는 기본값인 경우가 많다(jrpg-real-1 J08: 지하묘지 박쥐 그룹이 숲 배경 값을 들고 있었다).
  // 숲이 아닌 값은 저작 의도이므로 그대로 이기고, 숲 값은 맵·지형·기후·던전 이름이 더 구체적으로 말해 주면 물러난다.
  if (troopBg && troopBg !== DEFAULT_BATTLE_FIELD_BACKGROUND_ID) return troopBg;
  const terrainBg = normalizeBattleFieldBackgroundId(terrainBattleBackgroundAt(input.project, input.location));
  if (terrainBg) return terrainBg;
  // 맵에 저작한 전투 배경(set_map_properties battleBackground). 예전엔 에디터가 저장만 하고 런타임이 읽지 않아 늘 숲이 나왔다(jrpg-real-1 J08).
  const mapBg = authoredMapBattleBackground(input.project, input.location?.mapId);
  if (mapBg) return mapBg;
  const climateBg = climateBattleBackground(input.project, input.location?.mapId);
  if (climateBg) return climateBg;
  // 아무도 배경을 정하지 않은 던전·동굴 맵은 숲이 아니라 동굴이다(고대 지하묘지의 박쥐 전투가 숲에서 벌어졌다).
  const dungeonBg = dungeonBattleBackground(input.project, input.location?.mapId);
  if (dungeonBg) return dungeonBg;
  // 마을·도시·폐허·사막으로 읽히는 맵 이름도 숲이 아니다(jrpg-loop-1 ct1: 안개 낀 「멸망한 폐허 크로노폴리스」의 보스전이 울창한 숲에서 벌어졌다).
  const placeBg = placeNameBattleBackground(input.project, input.location?.mapId);
  if (placeBg) return placeBg;
  // 실내 칩셋 맵(이름이 숲·사막·마을을 말하지 않는)의 전투가 기본값 숲에서 벌어지지 않게 — 겹 배경 다섯(숲·평원·동굴·눈·사막) 중 동굴이 가장 가깝다.
  const interiorBg = interiorBattleBackground(input.project, input.location?.mapId);
  if (interiorBg) return interiorBg;
  if (troopBg) return troopBg;
  return input.project.system.battleUiStyle === "pokemon"
    ? POKEMON_BATTLE_BACKDROP_ID
    : DEFAULT_BATTLE_FIELD_BACKGROUND_ID;
}

/** Look up tileset terrain tag at a map tile and map it to database.terrains battle background. */
export function terrainBattleBackgroundAt(
  project: Project,
  location: BattleBackdropLocation | undefined
): string | undefined {
  const found = terrainRecordAt(project, location);
  if (!found) return undefined;
  if (found.record.battleBackgroundResourceId) return found.record.battleBackgroundResourceId;
  const byId = (project.database.terrains ?? []).find((entry) => entry.id === `terrain_${found.tag}` || entry.id.endsWith(`_${found.tag}`));
  return byId?.battleBackgroundResourceId;
}

/** 던전·동굴로 읽히는 맵 이름 — 이름이 곧 장소의 성격이다(지하묘지·갱도·미궁 …). */
const DUNGEON_MAP_NAME = /던전|동굴|지하|묘지|무덤|고분|납골|광산|갱도|미궁|미로|하수도|감옥|옥사|석굴|catacomb|crypt|tomb|\bcave\b|dungeon|\bmine\b|sewer|prison|jail|labyrinth|maze/iu;
const DUNGEON_TILESET_ID = /dungeon|cave/iu;
/** 실내 전용 칩셋(집·성·기숙사·연구소 방). 이름이 아무 장소도 말하지 않는 실내 전투는 숲보다 막힌 돌 공간(동굴 겹 배경)이 가깝다. */
const INTERIOR_TILESET_ID = /interior|_rooms\b|manor|gyms?\b/iu;

/** 맵이 `battleBackground` 를 저작했으면 그 값(emerald:<갈래> 는 emeraldBattleTerrain 의 몫이므로 제외). */
export function authoredMapBattleBackground(project: Project, mapId: string | undefined): string | undefined {
  const raw = mapId ? project.maps[mapId]?.battleBackground : undefined;
  if (!raw || /^emerald:/u.test(raw)) return undefined;
  return normalizeBattleFieldBackgroundId(raw);
}

/** 던전·동굴 맵이면 동굴 겹 배경, 아니면 undefined. */
export function dungeonBattleBackground(project: Project, mapId: string | undefined): string | undefined {
  const map = mapId ? project.maps[mapId] : undefined;
  if (!map) return undefined;
  if (DUNGEON_MAP_NAME.test(map.name ?? "") || DUNGEON_TILESET_ID.test(map.tilesetId ?? "")) return "battle-scenery-cave";
  return undefined;
}

/** 실내 칩셋 맵이면 동굴 겹 배경(숲 이름 맵은 제외), 아니면 undefined. */
export function interiorBattleBackground(project: Project, mapId: string | undefined): string | undefined {
  const map = mapId ? project.maps[mapId] : undefined;
  if (!map || !INTERIOR_TILESET_ID.test(map.tilesetId ?? "") || FOREST_MAP_NAME.test(map.name ?? "")) return undefined;
  return "battle-scenery-cave";
}

const FOREST_MAP_NAME = /숲|삼림|밀림|수풀|forest|woods?\b/iu;
const DESERT_MAP_NAME = /사막|오아시스|모래|desert|oasis/iu;
const OPEN_PLACE_MAP_NAME = /마을|도시|항구|성채|성곽|성문|광장|거리|시가지|폐허|town|city|village|harbou?r|ruins?\b|plaza/iu;

/**
 * 맵 이름이 곧 장소의 성격이다. 숲이라는 낱말이 있으면 숲 그대로(undefined), 사막은 사막, 마을·도시·폐허는 하늘이 트인 평원 겹 배경.
 * 눈·던전은 앞선 단계(기후·던전)가 이미 정했으므로 여기 오지 않는다.
 */
export function placeNameBattleBackground(project: Project, mapId: string | undefined): string | undefined {
  const name = (mapId ? project.maps[mapId]?.name : undefined) ?? "";
  if (!name || FOREST_MAP_NAME.test(name)) return undefined;
  if (DESERT_MAP_NAME.test(name)) return "battle-scenery-desert";
  if (OPEN_PLACE_MAP_NAME.test(name)) return "battle-scenery-plains";
  return undefined;
}

/** 눈 날씨 맵(또는 그 맵이 매달린 상위 맵)의 전투는 설원 배경. */
const CLIMATE_BATTLE_BACKGROUNDS: Readonly<Record<string, string>> = {
  snow: "scarloxy-backdrop-ice",
};

/**
 * 트룹·지형이 배경을 정하지 않은 전투의 기본값이 늘 여름 숲이라, 눈보라 항구 이야기의 등대 보스전이
 * 반딧불 숲에서 벌어졌다(2026-09-23 도그푸딩). 실내·던전은 기후가 없으므로 맵 트리의 상위 맵 기후를 따른다.
 */
export function climateBattleBackground(project: Project, mapId: string | undefined): string | undefined {
  const seen = new Set<string>();
  let current = mapId;
  while (current && !seen.has(current)) {
    seen.add(current);
    const climate = project.maps[current]?.climate;
    const weather = climate?.mode === "fixed" ? climate.weather : undefined;
    if (weather && CLIMATE_BATTLE_BACKGROUNDS[weather]) return CLIMATE_BATTLE_BACKGROUNDS[weather];
    current = mapTreeParentId(project.mapTree, current);
  }
  return undefined;
}

type TreeNode = { readonly mapId: string; readonly children?: readonly TreeNode[] };

function mapTreeParentId(tree: unknown, mapId: string): string | undefined {
  const visit = (node: TreeNode | undefined, parent: string | undefined): string | undefined => {
    if (!node || typeof node !== "object") return undefined;
    if (node.mapId === mapId) return parent;
    for (const child of node.children ?? []) {
      const found = visit(child, node.mapId);
      if (found !== undefined) return found;
    }
    return undefined;
  };
  const roots = Array.isArray(tree) ? tree as TreeNode[] : [tree as TreeNode];
  for (const root of roots) {
    const found = visit(root, undefined);
    if (found !== undefined) return found;
  }
  return undefined;
}

// ---------------------------------------------------------------------------
// 움직이는 전투 배경(마더2식) — 트룹의 backdropAnimation 을 정규화하고 CSS 변수로 옮긴다.
// 실제 움직임은 styles/runtime/battle/30-backdrop-motion.css 의 keyframes 가 그린다(스크롤·물결·색 순환).
// prefers-reduced-motion 이면 CSS 가 전부 멈춘다.
// ---------------------------------------------------------------------------


/** 스크롤 한 사이클의 이동 거리(px). 배경은 repeat 로 깔리므로 이 거리만큼 밀었다가 되감아도 이음매가 없다. */
export const BACKDROP_SCROLL_TILE_PX = 640;

export { normalizeBattleBackdropAnimation };

export type BattleBackdropMotion = {
  /** 배경 노드 data-backdrop-motion 에 쓰는 효과 목록(scroll wave palette 공백 구분). */
  readonly kinds: readonly ("scroll" | "wave" | "palette")[];
  /** 배경 노드 인라인 스타일로 거는 CSS 변수. */
  readonly vars: Readonly<Record<string, string>>;
};

/** CSS 가 읽을 변수로 번역한다. 효과가 하나도 없으면 undefined. */
export function battleBackdropMotion(animation: BattleBackdropAnimation | undefined): BattleBackdropMotion | undefined {
  const normalized = normalizeBattleBackdropAnimation(animation);
  if (!normalized) return undefined;
  const kinds: ("scroll" | "wave" | "palette")[] = [];
  const vars: Record<string, string> = {};
  const sx = normalized.scrollX ?? 0;
  const sy = normalized.scrollY ?? 0;
  if (sx !== 0 || sy !== 0) {
    kinds.push("scroll");
    // 느린 축이 한 타일을 지나는 시간을 한 사이클로 잡고, 두 축 모두 그 시간 동안 자기 속도만큼 민다.
    const fastest = Math.max(Math.abs(sx), Math.abs(sy));
    const seconds = BACKDROP_SCROLL_TILE_PX / fastest;
    vars["--battle-backdrop-scroll-duration"] = `${round(seconds)}s`;
    vars["--battle-backdrop-scroll-x"] = `${round(sx * seconds)}px`;
    vars["--battle-backdrop-scroll-y"] = `${round(sy * seconds)}px`;
  }
  if (normalized.waveAmplitude) {
    kinds.push("wave");
    const frequency = normalized.waveFrequency ?? 1;
    vars["--battle-backdrop-wave-amplitude"] = `${round(normalized.waveAmplitude)}px`;
    vars["--battle-backdrop-wave-duration"] = `${round(1 / frequency)}s`;
  }
  if (normalized.paletteCycleSeconds) {
    kinds.push("palette");
    vars["--battle-backdrop-palette-duration"] = `${round(normalized.paletteCycleSeconds)}s`;
  }
  // 진폭 없는 주파수처럼 보이는 효과가 하나도 없으면 정지 배경이다.
  return kinds.length > 0 ? { kinds, vars } : undefined;
}

function round(value: number): number {
  return Math.round(value * 1000) / 1000;
}
