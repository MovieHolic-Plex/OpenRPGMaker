import {
  DEFAULT_BATTLE_FIELD_BACKGROUND_ID,
  normalizeBattleFieldBackgroundId,
} from "@/project/databaseEnemyTroopRecordModel";
import { terrainRecordAt } from "@/project/terrainAt";
import type { Project } from "@/project/types";
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
