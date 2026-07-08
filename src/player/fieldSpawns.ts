import { inBounds, isPassable } from "@/project/collision";
import type { Dir, EventPageGraphic, FieldSpawnDef, GameEvent, GameMap, Project, Rect } from "@/project/types";
import type { RuntimeEventPositions } from "@/player/runtimeEventState";

export const FIELD_SPAWN_EVENT_PREFIX = "__field_spawn__";
export const FIELD_SPAWN_FIXED_STEP_MS = 1000;
export const DEFAULT_FIELD_SPAWN_MAX_ALIVE = 3;
export const DEFAULT_FIELD_SPAWN_RESPAWN_SEC = 10;

export interface FieldSpawnInstance {
  readonly eventId: string;
  readonly spawnId: string;
  readonly troopId: string;
  readonly x: number;
  readonly y: number;
  readonly graphic: EventPageGraphic;
  readonly chase: boolean;
}

export interface FieldSpawnRuntimeEntry {
  readonly spawn: NormalizedFieldSpawn;
  alive: FieldSpawnInstance[];
  respawnTimersMs: number[];
  cursor: number;
  serial: number;
}

export interface FieldSpawnRuntimeState {
  readonly mapId: string;
  // 필드 스폰 상태는 세이브에 저장하지 않는다. 로드/맵 진입 시 authored fieldSpawns에서 초기 배치로 다시 만든다.
  entries: FieldSpawnRuntimeEntry[];
  fixedAccumulatorMs: number;
}

interface NormalizedFieldSpawn {
  readonly id: string;
  readonly troopId: string;
  readonly area: Rect;
  readonly maxAlive: number;
  readonly respawnMs: number;
  readonly graphic: EventPageGraphic;
  readonly chase: boolean;
}

export function isFieldSpawnEventId(eventId: string): boolean {
  return eventId.startsWith(FIELD_SPAWN_EVENT_PREFIX);
}

export function createFieldSpawnRuntime(
  project: Project,
  map: GameMap,
  player: { readonly x: number; readonly y: number }
): FieldSpawnRuntimeState {
  const state: FieldSpawnRuntimeState = {
    mapId: map.id,
    entries: (map.fieldSpawns ?? []).map((spawn) => ({
      spawn: normalizeFieldSpawn(project, spawn),
      alive: [],
      respawnTimersMs: [],
      cursor: 0,
      serial: 0,
    })),
    fixedAccumulatorMs: 0,
  };
  for (const entry of state.entries) {
    spawnUntilCapacity(state, entry, project, map, player);
  }
  return state;
}

export function advanceFieldSpawns(
  state: FieldSpawnRuntimeState | null,
  project: Project,
  map: GameMap,
  player: { readonly x: number; readonly y: number },
  deltaMs: number
): boolean {
  if (!state || state.mapId !== map.id) return false;
  let changed = false;
  state.fixedAccumulatorMs += Math.max(0, deltaMs);
  while (state.fixedAccumulatorMs >= FIELD_SPAWN_FIXED_STEP_MS) {
    state.fixedAccumulatorMs -= FIELD_SPAWN_FIXED_STEP_MS;
    for (const entry of state.entries) {
      const nextTimers: number[] = [];
      for (const timer of entry.respawnTimersMs) {
        const remaining = timer - FIELD_SPAWN_FIXED_STEP_MS;
        if (remaining <= 0) {
          if (trySpawnInstance(state, entry, project, map, player)) changed = true;
          else nextTimers.push(FIELD_SPAWN_FIXED_STEP_MS);
        } else {
          nextTimers.push(remaining);
        }
      }
      entry.respawnTimersMs = nextTimers;
      if (entry.respawnTimersMs.length === 0 && spawnUntilCapacity(state, entry, project, map, player)) changed = true;
    }
  }
  return changed;
}

export function fieldSpawnTroopId(state: FieldSpawnRuntimeState | null, eventId: string): string | undefined {
  if (!state) return undefined;
  for (const entry of state.entries) {
    const instance = entry.alive.find((candidate) => candidate.eventId === eventId);
    if (instance) return instance.troopId;
  }
  return undefined;
}

export function resolveFieldSpawnVictory(state: FieldSpawnRuntimeState | null, eventId: string): boolean {
  if (!state) return false;
  for (const entry of state.entries) {
    const index = entry.alive.findIndex((candidate) => candidate.eventId === eventId);
    if (index < 0) continue;
    entry.alive.splice(index, 1);
    entry.respawnTimersMs.push(entry.spawn.respawnMs);
    return true;
  }
  return false;
}

export function fieldSpawnAliveCount(state: FieldSpawnRuntimeState | null): number {
  return state?.entries.reduce((sum, entry) => sum + entry.alive.length, 0) ?? 0;
}

export function materializeFieldSpawnEvents(state: FieldSpawnRuntimeState | null): GameEvent[] {
  if (!state) return [];
  const events: GameEvent[] = [];
  for (const entry of state.entries) {
    for (const instance of entry.alive) {
      events.push(fieldSpawnEvent(instance));
    }
  }
  return events;
}

export function syncFieldSpawnEventsIntoMap(
  map: GameMap,
  state: FieldSpawnRuntimeState | null,
  eventPositions: RuntimeEventPositions
): void {
  map.events = map.events.filter((event) => {
    if (!isFieldSpawnEventId(event.id)) return true;
    delete eventPositions[event.id];
    return false;
  });
  const events = materializeFieldSpawnEvents(state);
  for (const event of events) {
    map.events.push(event);
    eventPositions[event.id] = { x: event.x, y: event.y };
  }
}

function spawnUntilCapacity(
  state: FieldSpawnRuntimeState,
  entry: FieldSpawnRuntimeEntry,
  project: Project,
  map: GameMap,
  player: { readonly x: number; readonly y: number }
): boolean {
  let changed = false;
  while (entry.alive.length < entry.spawn.maxAlive) {
    if (!trySpawnInstance(state, entry, project, map, player)) break;
    changed = true;
  }
  return changed;
}

function trySpawnInstance(
  state: FieldSpawnRuntimeState,
  entry: FieldSpawnRuntimeEntry,
  project: Project,
  map: GameMap,
  player: { readonly x: number; readonly y: number }
): boolean {
  const point = nextSpawnPoint(state, entry, project, map, player);
  if (!point) return false;
  entry.serial += 1;
  entry.alive.push({
    eventId: fieldSpawnEventId(entry.spawn.id, entry.serial),
    spawnId: entry.spawn.id,
    troopId: entry.spawn.troopId,
    x: point.x,
    y: point.y,
    graphic: entry.spawn.graphic,
    chase: entry.spawn.chase,
  });
  return true;
}

function nextSpawnPoint(
  state: FieldSpawnRuntimeState,
  entry: FieldSpawnRuntimeEntry,
  project: Project,
  map: GameMap,
  player: { readonly x: number; readonly y: number }
): { readonly x: number; readonly y: number } | null {
  const area = entry.spawn.area;
  const width = Math.max(0, Math.trunc(area.w));
  const height = Math.max(0, Math.trunc(area.h));
  const total = width * height;
  if (total <= 0) return null;
  const occupied = occupiedCells(state, map, player);
  for (let offset = 0; offset < total; offset += 1) {
    const index = (entry.cursor + offset) % total;
    const x = Math.trunc(area.x) + (index % width);
    const y = Math.trunc(area.y) + Math.floor(index / width);
    if (!inBounds(map, x, y)) continue;
    if (occupied.has(pointKey(x, y))) continue;
    if (!isPassable(project, map, x, y)) continue;
    entry.cursor = (index + 1) % total;
    return { x, y };
  }
  return null;
}

function occupiedCells(
  state: FieldSpawnRuntimeState,
  map: GameMap,
  player: { readonly x: number; readonly y: number }
): Set<string> {
  const occupied = new Set<string>([pointKey(player.x, player.y)]);
  for (const event of map.events) {
    if (isFieldSpawnEventId(event.id)) continue;
    occupied.add(pointKey(event.x, event.y));
  }
  for (const entry of state.entries) {
    for (const instance of entry.alive) occupied.add(pointKey(instance.x, instance.y));
  }
  return occupied;
}

function fieldSpawnEvent(instance: FieldSpawnInstance): GameEvent {
  return {
    id: instance.eventId,
    x: instance.x,
    y: instance.y,
    trigger: { kind: "eventTouch" },
    commands: [{ kind: "battleProcessing", troopId: instance.troopId, canEscape: true, canLose: true }],
    pages: [
      {
        id: `${instance.eventId}_page`,
        name: "필드 몬스터",
        conditions: [],
        graphic: instance.graphic,
        trigger: { kind: "eventTouch" },
        priority: "same",
        overlapForbidden: true,
        animationType: "normal",
        movement: instance.chase
          ? { type: "chase", speed: 3, frequency: 4, sightRange: 8, giveUpRange: 14, pathfind: true }
          : { type: "fixed", speed: 3, frequency: 3 },
        commands: [{ kind: "battleProcessing", troopId: instance.troopId, canEscape: true, canLose: true }],
      },
    ],
  };
}

function normalizeFieldSpawn(project: Project, spawn: FieldSpawnDef): NormalizedFieldSpawn {
  return {
    id: spawn.id,
    troopId: spawn.troopId,
    area: {
      x: Math.trunc(spawn.area.x),
      y: Math.trunc(spawn.area.y),
      w: Math.max(0, Math.trunc(spawn.area.w)),
      h: Math.max(0, Math.trunc(spawn.area.h)),
    },
    maxAlive: positiveInteger(spawn.maxAlive, DEFAULT_FIELD_SPAWN_MAX_ALIVE),
    respawnMs: Math.max(0, Math.round((spawn.respawnSec ?? DEFAULT_FIELD_SPAWN_RESPAWN_SEC) * 1000)),
    graphic: spawn.graphic ?? defaultFieldSpawnGraphic(project, spawn.troopId),
    chase: spawn.chase === true,
  };
}

function defaultFieldSpawnGraphic(project: Project, troopId: string): EventPageGraphic {
  const troop = project.database.troops.find((entry) => entry.id === troopId);
  const firstEnemyId = troop?.members?.find((member) => member.hidden !== true)?.enemyId ?? troop?.enemyIds[0];
  const resourceId = project.database.enemies.find((enemy) => enemy.id === firstEnemyId)?.monsterResourceId;
  return resourceId
    ? { sprite: { type: "uploaded", id: resourceId }, direction: "down" as Dir, pattern: 0 }
    : { transparent: true };
}

function positiveInteger(value: number | undefined, fallback: number): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  return Math.max(1, Math.trunc(value));
}

function fieldSpawnEventId(spawnId: string, serial: number): string {
  return `${FIELD_SPAWN_EVENT_PREFIX}${safeIdPart(spawnId)}_${serial}`;
}

function safeIdPart(value: string): string {
  return value.replace(/[^a-zA-Z0-9_-]/g, "_");
}

function pointKey(x: number, y: number): string {
  return `${x},${y}`;
}
