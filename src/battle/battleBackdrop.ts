import {
  DEFAULT_BATTLE_FIELD_BACKGROUND_ID,
  normalizeBattleFieldBackgroundId,
} from "@/project/databaseEnemyTroopRecordModel";
import type { Project } from "@/project/types";
import type { TroopId } from "@/project/types/base";

export type BattleBackdropLocation = {
  readonly mapId: string;
  readonly x: number;
  readonly y: number;
};

/**
 * Resolve the battle field background for a fight.
 * Priority: explicit override → troop preview → terrain at map tile → forest fallback.
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
  return DEFAULT_BATTLE_FIELD_BACKGROUND_ID;
}

/** Look up tileset terrain tag at a map tile and map it to database.terrains battle background. */
export function terrainBattleBackgroundAt(
  project: Project,
  location: BattleBackdropLocation | undefined
): string | undefined {
  if (!location) return undefined;
  const map = project.maps[location.mapId];
  if (!map) return undefined;
  const x = Math.trunc(location.x);
  const y = Math.trunc(location.y);
  if (x < 0 || y < 0 || x >= map.width || y >= map.height) return undefined;
  const tileIndex = map.lowerTiles[y * map.width + x];
  if (typeof tileIndex !== "number" || tileIndex < 0) return undefined;
  const tileset = project.tilesets[map.tilesetId];
  if (!tileset) return undefined;
  const tag =
    tileset.tileMeta?.[tileIndex]?.terrainTag
    ?? tileset.terrain?.[tileIndex]
    ?? 0;
  if (!tag || tag <= 0) return undefined;
  const terrains = project.database.terrains ?? [];
  // RM-style: terrain tag N selects the Nth authored terrain record (1-based).
  const byIndex = terrains[tag - 1];
  if (byIndex?.battleBackgroundResourceId) return byIndex.battleBackgroundResourceId;
  const byId = terrains.find((entry) => entry.id === `terrain_${tag}` || entry.id.endsWith(`_${tag}`));
  return byId?.battleBackgroundResourceId;
}
