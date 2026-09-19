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
