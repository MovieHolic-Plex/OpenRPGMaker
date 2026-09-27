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
  const troop = input.project.database.troops.find((entry) => entry.id === input.troopId);
  const override = normalizeBattleFieldBackgroundId(input.overrideResourceId);
  if (override) return override;
  const troopBg = normalizeBattleFieldBackgroundId(troop?.previewBackgroundResourceId);
  if (troopBg) return troopBg;
  const terrainBg = normalizeBattleFieldBackgroundId(terrainBattleBackgroundAt(input.project, input.location));
  if (terrainBg) return terrainBg;
  const climateBg = climateBattleBackground(input.project, input.location?.mapId);
  if (climateBg) return climateBg;
  return input.project.system.battleUiStyle === "pokemon"
    ? "battle-skin-pokemon-backdrop"
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
// 실제 움직임은 styles/runtime/battle/24-backdrop-motion.css 의 keyframes 가 그린다(스크롤·물결·색 순환).
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
