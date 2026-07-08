import { timePhaseFor, type GameTime } from "@/project/gameTime";
import type { GameEvent, MapId, NpcScheduleEntry } from "@/project/types";

export type NpcScheduleMatch = {
  readonly index: number;
  readonly entry: NpcScheduleEntry;
};

export type NpcScheduleTarget = {
  readonly key: string;
  readonly mapId: MapId;
  readonly x: number;
  readonly y: number;
  readonly facing?: NpcScheduleEntry["facing"];
  readonly activity?: string;
  readonly matched: boolean;
};

export function matchNpcSchedule(
  schedule: readonly NpcScheduleEntry[] | undefined,
  time: GameTime | undefined
): NpcScheduleMatch | null {
  if (!time || !schedule?.length) return null;
  for (const [index, entry] of schedule.entries()) {
    if (npcScheduleWhenMatches(entry, time)) return { index, entry };
  }
  return null;
}

export function npcScheduleTargetForEvent(
  sourceMapId: MapId,
  event: GameEvent,
  time: GameTime | undefined
): NpcScheduleTarget | null {
  if (!event.schedule?.length) return null;
  const match = matchNpcSchedule(event.schedule, time);
  if (!match) {
    return {
      key: `origin:${sourceMapId}:${event.x},${event.y}`,
      mapId: sourceMapId,
      x: event.x,
      y: event.y,
      matched: false,
    };
  }
  const { entry, index } = match;
  return {
    key: `schedule:${index}:${entry.at.mapId}:${entry.at.x},${entry.at.y}:${entry.facing ?? ""}:${entry.activity ?? ""}`,
    mapId: entry.at.mapId,
    x: Math.trunc(entry.at.x),
    y: Math.trunc(entry.at.y),
    facing: entry.facing,
    activity: cleanActivity(entry.activity),
    matched: true,
  };
}

export function npcScheduleWhenMatches(entry: NpcScheduleEntry, time: GameTime): boolean {
  const when = entry.when ?? {};
  if (when.timePhase !== undefined && timePhaseFor(time) !== when.timePhase) return false;
  if (when.season !== undefined && time.season !== when.season) return false;
  if (when.dayRange !== undefined && !numberInInclusiveRange(time.day, when.dayRange)) return false;
  if (when.hourRange !== undefined && !hourInRange(time.hour, when.hourRange)) return false;
  return true;
}

function hourInRange(hour: number, range: readonly [number, number]): boolean {
  const start = Math.trunc(range[0]);
  const end = Math.trunc(range[1]);
  if (start === end) return false;
  if (start < end) return hour >= start && hour < end;
  return hour >= start || hour < end;
}

function numberInInclusiveRange(value: number, range: readonly [number, number]): boolean {
  const start = Math.trunc(range[0]);
  const end = Math.trunc(range[1]);
  return start <= end ? value >= start && value <= end : value >= end && value <= start;
}

function cleanActivity(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}
