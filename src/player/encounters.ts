import type { EncounterTableEntry, GameMap } from "@/project/types";
import type { PlaySessionLike } from "@/player/types";
import { nextSessionRandom } from "@/project/session";
import { conditionMatchesSeason, conditionMatchesTimePhase } from "@/project/gameTime";
import type { Rng } from "@/util/rng";

export interface EncounterPosition {
  readonly x: number;
  readonly y: number;
}

export function partyEncounterLevel(session: PlaySessionLike): number {
  const levels = session.partyActorIds.map((actorId) => session.actorLevels?.[actorId] ?? 1);
  return Math.max(1, ...levels);
}

export function eligibleEncounterEntries(
  map: GameMap,
  session: PlaySessionLike,
  position: EncounterPosition
): EncounterTableEntry[] {
  const partyLevel = partyEncounterLevel(session);
  return (map.encounterTable ?? []).filter((entry) => {
    if (!Number.isInteger(entry.weight) || entry.weight <= 0) return false;
    const conditions = entry.conditions;
    if (!conditions) return true;
    if (conditions.switchId && session.switches[conditions.switchId] !== true) return false;
    if (conditions.variableId && (session.variables[conditions.variableId] ?? 0) < (conditions.atLeast ?? 0)) return false;
    if (conditions.minPartyLevel !== undefined && partyLevel < conditions.minPartyLevel) return false;
    if (conditions.maxPartyLevel !== undefined && partyLevel > conditions.maxPartyLevel) return false;
    if (conditions.region && !pointInRect(position, conditions.region)) return false;
    if (conditions.timePhase && !conditionMatchesTimePhase(session.gameTime, conditions.timePhase)) return false;
    if (conditions.season && !conditionMatchesSeason(session.gameTime, conditions.season)) return false;
    return true;
  });
}

export function pickWeightedEncounterTroop(
  entries: readonly EncounterTableEntry[],
  rng: Rng
): string | undefined {
  let total = 0;
  for (const entry of entries) {
    if (Number.isInteger(entry.weight) && entry.weight > 0) total += entry.weight;
  }
  if (total <= 0) return undefined;
  let cursor = rng() * total;
  for (const entry of entries) {
    if (!Number.isInteger(entry.weight) || entry.weight <= 0) continue;
    cursor -= entry.weight;
    if (cursor < 0) return entry.troopId;
  }
  return entries.find((entry) => Number.isInteger(entry.weight) && entry.weight > 0)?.troopId;
}

export function pickEncounterTroopForMap(
  map: GameMap,
  session: PlaySessionLike,
  position: EncounterPosition,
  rng: Rng = () => nextSessionRandom(session, "encounter")
): string | undefined {
  if (map.encounterTable && map.encounterTable.length > 0) {
    return pickWeightedEncounterTroop(eligibleEncounterEntries(map, session, position), rng);
  }
  const troops = map.troopIds;
  if (!troops || troops.length === 0) return undefined;
  return troops[Math.floor(rng() * troops.length)] ?? troops[0];
}

function pointInRect(point: EncounterPosition, rect: { readonly x: number; readonly y: number; readonly w: number; readonly h: number }): boolean {
  return (
    point.x >= rect.x &&
    point.y >= rect.y &&
    point.x < rect.x + Math.max(0, rect.w) &&
    point.y < rect.y + Math.max(0, rect.h)
  );
}
