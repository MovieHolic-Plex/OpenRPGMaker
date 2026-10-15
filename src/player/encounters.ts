import type { EncounterTableEntry, GameMap, Project } from "@/project/types";
import { terrainRecordAt } from "@/project/terrainAt";
import type { PlaySessionLike } from "@/project/sessionRuntimeTypes"
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
  position: EncounterPosition,
  // terrainId 조건(풀 칸에서만 등)을 판정하려면 필요하다. 없으면 terrainId 항목은 나오지 않는다(지형을 모르면 조용히 맵 전체로 번지지 않게).
  project?: Project
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
    // 로케이션 참조가 레거시 raw 사각형보다 이긴다. 둘을 같이 쓰는 저작은 없지만,
    // 복구로 freezeRect 를 받은 직후처럼 공존 상황이 생기면 이름 붙은 장소가 진상이다.
    if (conditions.locationId) {
      const location = (map.locations ?? []).find((entry) => entry.id === conditions.locationId);
      // 삭제된 로케이션을 가리키는 항목은 뿱지 않는다 — 맵 전역으로 조용하게 번지면
      // 서생지 적이 마을 광장에서 튀어나온다. lint 가 `map-location-missing-ref` 로 알린다.
      if (!location || !pointInRect(position, location)) return false;
    } else if (conditions.region && !pointInRect(position, conditions.region)) return false;
    if (conditions.terrainId) {
      if (!project || terrainRecordAt(project, { mapId: map.id, x: position.x, y: position.y })?.record.id !== conditions.terrainId) return false;
    }
    if (conditions.timePhase && !conditionMatchesTimePhase(session.gameTime, conditions.timePhase)) return false;
    if (conditions.season && !conditionMatchesSeason(session.gameTime, conditions.season)) return false;
    return true;
  });
}

/** 가중 추첨으로 조우 항목 하나를 뽑는다(pickWeightedEncounterTroop 과 같은 규칙, 항목 전체를 돌려준다). */
export function pickWeightedEncounterEntry(
  entries: readonly EncounterTableEntry[],
  rng: Rng
): EncounterTableEntry | undefined {
  let total = 0;
  for (const entry of entries) {
    if (Number.isInteger(entry.weight) && entry.weight > 0) total += entry.weight;
  }
  if (total <= 0) return undefined;
  let cursor = rng() * total;
  for (const entry of entries) {
    if (!Number.isInteger(entry.weight) || entry.weight <= 0) continue;
    cursor -= entry.weight;
    if (cursor < 0) return entry;
  }
  return entries.find((entry) => Number.isInteger(entry.weight) && entry.weight > 0);
}

/** 항목의 야생 레벨 범위에서 레벨을 굴린다. 범위가 없으면 undefined(= enemy 레코드 레벨). 굴림은 범위가 있을 때만 난수를 쓴다. */
export function rollEncounterLevel(entry: EncounterTableEntry, rng: Rng): number | undefined {
  const lo = entry.levelMin ?? entry.levelMax;
  const hi = entry.levelMax ?? entry.levelMin;
  if (lo === undefined || hi === undefined) return undefined;
  const min = Math.max(1, Math.min(99, Math.trunc(Math.min(lo, hi))));
  const max = Math.max(1, Math.min(99, Math.trunc(Math.max(lo, hi))));
  return min + Math.min(max - min, Math.floor(rng() * (max - min + 1)));
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
  rng: Rng = () => nextSessionRandom(session, "encounter"),
  project?: Project
): string | undefined {
  return pickEncounterForMap(map, session, position, rng, project)?.troopId;
}

/** 조우 하나를 뽑는다: 무리 id 와(조우표 항목에 levelMin/levelMax 가 있으면) 굴린 야생 레벨. */
export function pickEncounterForMap(
  map: GameMap,
  session: PlaySessionLike,
  position: EncounterPosition,
  rng: Rng = () => nextSessionRandom(session, "encounter"),
  project?: Project
): { troopId: string; level?: number } | undefined {
  if (map.encounterTable && map.encounterTable.length > 0) {
    const entry = pickWeightedEncounterEntry(eligibleEncounterEntries(map, session, position, project), rng);
    if (!entry) return undefined;
    const level = rollEncounterLevel(entry, rng);
    return level === undefined ? { troopId: entry.troopId } : { troopId: entry.troopId, level };
  }
  const troops = map.troopIds;
  if (!troops || troops.length === 0) return undefined;
  const troopId = troops[Math.floor(rng() * troops.length)] ?? troops[0];
  return troopId ? { troopId } : undefined;
}

function pointInRect(point: EncounterPosition, rect: { readonly x: number; readonly y: number; readonly w: number; readonly h: number }): boolean {
  return (
    point.x >= rect.x &&
    point.y >= rect.y &&
    point.x < rect.x + Math.max(0, rect.w) &&
    point.y < rect.y + Math.max(0, rect.h)
  );
}
