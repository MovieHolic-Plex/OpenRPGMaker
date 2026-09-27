import { inBounds, isPassable } from "@/project/collision";
import {
  characterFootprintCells,
  normalizeCharacterFootprint,
  normalizePassRows,
} from "@/project/footprint";
import type {
  CharacterFootprint,
  Dir,
  EventPageGraphic,
  FieldSpawnDef,
  GameEvent,
  GameMap,
  Project,
  Rect,
} from "@/project/types";
import { eventBodyRect } from "@/project/eventFootprintQuery";
import { resolveLocationAnchorRect } from "@/project/locationAnchors";
import type { RuntimeEventPositions } from "@/project/runtimeEventState"
import type { RoguelikeRunState } from "@/project/roguelikeRun";
import { resolveRoguelikeRoomFieldSpawns, roguelikeRoomGenerationKey } from "@/project/roguelikeRooms";

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
  /** 몸 크기. 스폰 정의에서 그대로 내려오고 합성 페이지에 실린다. */
  readonly footprint: CharacterFootprint;
  /** 통행 차단 행. 몸 높이 전체면 통행 사각 === 몸 사각(항등). */
  readonly passRows: number;
  readonly chase: boolean;
  /** EnemyActionProfile.aggroRange에서 온 시야. 생략 시 기본 8. */
  readonly sightRange?: number;
  /** EnemyActionProfile.moveIntervalMs에서 온 추적 결정 간격. */
  readonly moveIntervalMs?: number;
}

export interface FieldSpawnRuntimeEntry {
  readonly spawn: NormalizedFieldSpawn;
  alive: FieldSpawnInstance[];
  respawnTimersMs: number[];
  /** persistKill 스폰에서 영구 처치된 수. alive와 합산해 배치 상한을 구성한다. */
  persistedDead: number;
  cursor: number;
  serial: number;
}

export interface FieldSpawnRuntimeState {
  readonly mapId: string;
  readonly roguelikeGenerationKey?: string;
  readonly roguelikeRunRef?: RoguelikeRunState;
  // 필드 스폰 상태는 세이브에 저장하지 않는다. 로드/맵 진입 시 authored fieldSpawns에서 초기 배치로 다시 만든다.
  entries: FieldSpawnRuntimeEntry[];
  fixedAccumulatorMs: number;
}

export interface NormalizedFieldSpawn {
  readonly id: string;
  readonly troopId: string;
  readonly area: Rect;
  readonly maxAlive: number;
  readonly respawnMs: number;
  readonly graphic: EventPageGraphic;
  readonly footprint: CharacterFootprint;
  readonly passRows: number;
  readonly chase: boolean;
  readonly persistKill: boolean;
  readonly factionId?: string;
  readonly onKillSwitchId?: string;
}

export function isFieldSpawnEventId(eventId: string): boolean {
  return eventId.startsWith(FIELD_SPAWN_EVENT_PREFIX);
}

export function createFieldSpawnRuntime(
  project: Project,
  map: GameMap,
  player: { readonly x: number; readonly y: number },
  killedCounts?: Readonly<Record<string, number>>,
  roguelikeRun?: RoguelikeRunState
): FieldSpawnRuntimeState {
  const generationKey = roguelikeRoomGenerationKey(map, roguelikeRun);
  const spawns = resolveRoguelikeRoomFieldSpawns(map, roguelikeRun);
  const state: FieldSpawnRuntimeState = {
    mapId: map.id,
    ...(generationKey ? { roguelikeGenerationKey: generationKey, roguelikeRunRef: roguelikeRun } : {}),
    entries: spawns.map((spawn) => ({
      spawn: normalizeFieldSpawn(project, map, spawn),
      alive: [],
      respawnTimersMs: [],
      persistedDead: generationKey ? 0 : Math.max(0, Math.round(killedCounts?.[spawn.id] ?? 0)),
      cursor: 0,
      serial: 0,
    })),
    fixedAccumulatorMs: 0,
  };
  // 첫 배치도 점유를 한 번만 만든다(엔트리 여러 개가 같은 집합을 이어 쓴다).
  let occupied: Set<string> | undefined;
  const occupancy = () => (occupied ??= occupiedCells(state, map, player));
  for (const entry of state.entries) {
    spawnUntilCapacity(state, entry, project, map, player, occupancy);
  }
  return state;
}

export function fieldSpawnRuntimeNeedsRefresh(
  state: FieldSpawnRuntimeState | null,
  map: GameMap,
  roguelikeRun: RoguelikeRunState | undefined
): boolean {
  if (!state || state.mapId !== map.id) return true;
  const activeRun = roguelikeRun?.status === "active" ? roguelikeRun : undefined;
  return state.roguelikeRunRef !== activeRun
    || state.roguelikeGenerationKey !== roguelikeRoomGenerationKey(map, roguelikeRun);
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
  // 점유 칸은 틱 하나에서 한 번만 만든다. 스폰에 성공하면 그 몸을 바로 더한다 — 스폰마다 맵 전체 점유를
  // 다시 만들던 것과 같은 집합이다(이 루프 안에서 점유를 바꾸는 것은 스폰뿐이다). 예전에는 대량 리스폰에서
  // 스폰 수의 제곱이었다(448마리 약 17ms, 640마리 약 36ms, Node 실측).
  let occupied: Set<string> | undefined;
  const occupancy = () => (occupied ??= occupiedCells(state, map, player));
  while (state.fixedAccumulatorMs >= FIELD_SPAWN_FIXED_STEP_MS) {
    state.fixedAccumulatorMs -= FIELD_SPAWN_FIXED_STEP_MS;
    for (const entry of state.entries) {
      const nextTimers: number[] = [];
      for (const timer of entry.respawnTimersMs) {
        const remaining = timer - FIELD_SPAWN_FIXED_STEP_MS;
        if (remaining <= 0) {
          if (trySpawnInstance(entry, project, map, occupancy())) changed = true;
          else nextTimers.push(FIELD_SPAWN_FIXED_STEP_MS);
        } else {
          nextTimers.push(remaining);
        }
      }
      entry.respawnTimersMs = nextTimers;
      if (entry.respawnTimersMs.length === 0 && spawnUntilCapacity(state, entry, project, map, player, occupancy)) changed = true;
    }
  }
  return changed;
}

// 런타임 스폰 엔트리를 추가하고 즉시 배치한다(spawnFieldEnemy 커맨드용). 이미 같은 id가 있으면 무시.
export function addFieldSpawnEntry(
  state: FieldSpawnRuntimeState,
  project: Project,
  map: GameMap,
  spawn: FieldSpawnDef,
  player: { readonly x: number; readonly y: number },
  killedCount = 0
): void {
  if (state.entries.some((entry) => entry.spawn.id === spawn.id)) return;
  const entry: FieldSpawnRuntimeEntry = {
    spawn: normalizeFieldSpawn(project, map, spawn),
    alive: [],
    respawnTimersMs: [],
    persistedDead: Math.max(0, Math.round(killedCount)),
    cursor: 0,
    serial: 0,
  };
  state.entries.push(entry);
  spawnUntilCapacity(state, entry, project, map, player);
}

// 런타임 스폰 엔트리를 제거한다(despawnFieldEnemy 커맨드용).
export function removeFieldSpawnEntry(state: FieldSpawnRuntimeState, spawnId: string): void {
  const index = state.entries.findIndex((entry) => entry.spawn.id === spawnId);
  if (index >= 0) state.entries.splice(index, 1);
}

export function fieldSpawnTroopId(state: FieldSpawnRuntimeState | null, eventId: string): string | undefined {
  if (!state) return undefined;
  for (const entry of state.entries) {
    const instance = entry.alive.find((candidate) => candidate.eventId === eventId);
    if (instance) return instance.troopId;
  }
  return undefined;
}

export function resolveFieldSpawnVictory(state: FieldSpawnRuntimeState | null, eventId: string): NormalizedFieldSpawn | null {
  if (!state) return null;
  for (const entry of state.entries) {
    const index = entry.alive.findIndex((candidate) => candidate.eventId === eventId);
    if (index < 0) continue;
    entry.alive.splice(index, 1);
    if (entry.spawn.persistKill) {
      // 영구 처치: 리스폰 타이머를 걸지 않고 영구 사망 카운트만 올린다.
      entry.persistedDead += 1;
    } else {
      entry.respawnTimersMs.push(entry.spawn.respawnMs);
    }
    return entry.spawn;
  }
  return null;
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
  const surviving = new Map<string, RuntimeEventPositions[string]>();
  map.events = map.events.filter((event) => {
    if (!isFieldSpawnEventId(event.id)) return true;
    const live = eventPositions[event.id];
    if (live) surviving.set(event.id, live);
    delete eventPositions[event.id];
    return false;
  });
  const events = materializeFieldSpawnEvents(state);
  for (const event of events) {
    map.events.push(event);
    const kept = surviving.get(event.id);
    eventPositions[event.id] = kept ?? { x: event.x, y: event.y };
  }
}

function spawnUntilCapacity(
  state: FieldSpawnRuntimeState,
  entry: FieldSpawnRuntimeEntry,
  project: Project,
  map: GameMap,
  player: { readonly x: number; readonly y: number },
  occupancy?: () => Set<string>,
): boolean {
  let changed = false;
  const occupied = occupancy?.() ?? occupiedCells(state, map, player);
  while (entry.alive.length + entry.persistedDead < entry.spawn.maxAlive) {
    if (!trySpawnInstance(entry, project, map, occupied)) break;
    changed = true;
  }
  return changed;
}

/** `occupied` 는 호출부가 소유한 점유 집합이다. 성공하면 새 몸을 거기 더한다. */
function trySpawnInstance(
  entry: FieldSpawnRuntimeEntry,
  project: Project,
  map: GameMap,
  occupied: Set<string>,
): boolean {
  const point = nextSpawnPoint(entry, project, map, occupied);
  if (!point) return false;
  entry.serial += 1;
  const tuning = resolveChaseTuning(project, entry.spawn.troopId);
  entry.alive.push({
    eventId: fieldSpawnEventId(entry.spawn.id, entry.serial),
    spawnId: entry.spawn.id,
    troopId: entry.spawn.troopId,
    x: point.x,
    y: point.y,
    graphic: entry.spawn.graphic,
    footprint: entry.spawn.footprint,
    passRows: entry.spawn.passRows,
    chase: entry.spawn.chase,
    ...(tuning.sightRange !== undefined ? { sightRange: tuning.sightRange } : {}),
    ...(tuning.moveIntervalMs !== undefined ? { moveIntervalMs: tuning.moveIntervalMs } : {}),
  });
  for (const cell of characterFootprintCells(point.x, point.y, entry.spawn.footprint)) occupied.add(pointKey(cell.x, cell.y));
  return true;
}

// 트룹 첫 적의 actionProfile에서 추적 튜닝(시야/결정 간격)을 읽는다.
function resolveChaseTuning(project: Project, troopId: string): { sightRange?: number; moveIntervalMs?: number } {
  const troop = project.database.troops.find((entry) => entry.id === troopId);
  const firstEnemyId = troop?.members?.find((member) => member.hidden !== true)?.enemyId ?? troop?.enemyIds[0];
  const profile = project.database.enemies.find((enemy) => enemy.id === firstEnemyId)?.actionProfile;
  if (!profile) return {};
  return {
    ...(profile.aggroRange !== undefined ? { sightRange: profile.aggroRange } : {}),
    ...(profile.moveIntervalMs !== undefined ? { moveIntervalMs: profile.moveIntervalMs } : {}),
  };
}

function nextSpawnPoint(
  entry: FieldSpawnRuntimeEntry,
  project: Project,
  map: GameMap,
  occupied: ReadonlySet<string>,
): { readonly x: number; readonly y: number } | null {
  const area = entry.spawn.area;
  const width = Math.max(0, Math.trunc(area.w));
  const height = Math.max(0, Math.trunc(area.h));
  const total = width * height;
  if (total <= 0) return null;
  for (let offset = 0; offset < total; offset += 1) {
    const index = (entry.cursor + offset) % total;
    const x = Math.trunc(area.x) + (index % width);
    const y = Math.trunc(area.y) + Math.floor(index / width);
    // 앵커 한 칸이 아니라 **스폰될 몸 전체**가 비어 있고 통행 가능해야 한다. 앵커만 보면
    // 3x3 스폰이 벽에 절반 박히거나 남의 몸통을 뚫고 나온다. 1x1 이면 검사가 한 칸이다(항등).
    if (!bodyFitsAt(project, map, occupied, x, y, entry.spawn.footprint)) continue;
    entry.cursor = (index + 1) % total;
    return { x, y };
  }
  return null;
}

/** 이 앵커에 몸을 놓을 수 있는가 — 몸 사각 전 칸이 맵 안이고 통행 가능하고 비어 있는가. */
function bodyFitsAt(
  project: Project,
  map: GameMap,
  occupied: ReadonlySet<string>,
  x: number,
  y: number,
  footprint: CharacterFootprint
): boolean {
  for (const cell of characterFootprintCells(x, y, footprint)) {
    if (!inBounds(map, cell.x, cell.y)) return false;
    if (occupied.has(pointKey(cell.x, cell.y))) return false;
    if (!isPassable(project, map, cell.x, cell.y)) return false;
  }
  return true;
}

function occupiedCells(
  state: FieldSpawnRuntimeState,
  map: GameMap,
  player: { readonly x: number; readonly y: number }
): Set<string> {
  const occupied = new Set<string>([pointKey(player.x, player.y)]);
  for (const event of map.events) {
    if (isFieldSpawnEventId(event.id)) continue;
    // 이벤트의 **몸 사각 전 칸**을 점유로 등록한다. 앵커 한 칸만 등록하던 시절에는
    // 2x2 골렘의 몸통 안에서 몬스터가 솟았다.
    const rect = eventBodyRect(event);
    for (let y = rect.top; y <= rect.bottom; y += 1) {
      for (let x = rect.left; x <= rect.right; x += 1) occupied.add(pointKey(x, y));
    }
  }
  for (const entry of state.entries) {
    for (const instance of entry.alive) {
      for (const cell of characterFootprintCells(instance.x, instance.y, instance.footprint)) {
        occupied.add(pointKey(cell.x, cell.y));
      }
    }
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
        // 몸 크기를 합성 페이지에 실어야 런타임 뷰·전투·통행이 다중 타일로 본다.
        // 예전에는 안 실려서 어떤 스폰도 1x1 이었고, 전투의 몸 사각 판정은 도달 불가였다.
        footprint: instance.footprint,
        passRows: instance.passRows,
        trigger: { kind: "eventTouch" },
        priority: "same",
        overlapForbidden: true,
        animationType: "normal",
        movement: instance.chase
          ? {
              type: "chase",
              speed: 3,
              frequency: 4,
              sightRange: instance.sightRange ?? 8,
              giveUpRange: (instance.sightRange ?? 8) + 6,
              pathfind: true,
              ...(instance.moveIntervalMs !== undefined ? { moveIntervalMs: instance.moveIntervalMs } : {}),
            }
          : { type: "fixed", speed: 3, frequency: 3 },
        commands: [{ kind: "battleProcessing", troopId: instance.troopId, canEscape: true, canLose: true }],
      },
    ],
  };
}

function normalizeFieldSpawn(project: Project, map: GameMap, spawn: FieldSpawnDef): NormalizedFieldSpawn {
  // 로케이션이 있으면 그 사각형을 쓴다 — 옮긴 구역을 스폰이 따라가야 한다.
  // 끊긴 참조(구역 삭제)는 옛 area 로 폴백한다: 조용히 스폰이 사라지는 것보다 낫고,
  // lint 가 그 끊김을 따로 올린다.
  const anchored = resolveLocationAnchorRect(project, map.id, { locationId: spawn.locationId });
  const area = anchored ?? spawn.area;
  return {
    id: spawn.id,
    troopId: spawn.troopId,
    area: {
      x: Math.trunc(area.x),
      y: Math.trunc(area.y),
      w: Math.max(0, Math.trunc(area.w)),
      h: Math.max(0, Math.trunc(area.h)),
    },
    maxAlive: positiveInteger(spawn.maxAlive, DEFAULT_FIELD_SPAWN_MAX_ALIVE),
    respawnMs: Math.max(0, Math.round((spawn.respawnSec ?? DEFAULT_FIELD_SPAWN_RESPAWN_SEC) * 1000)),
    graphic: spawn.graphic ?? defaultFieldSpawnGraphic(project, spawn.troopId),
    footprint: normalizeCharacterFootprint(spawn.footprint),
    passRows: normalizePassRows(spawn.passRows, normalizeCharacterFootprint(spawn.footprint).height),
    chase: spawn.chase === true,
    persistKill: spawn.persistKill === true,
    ...(spawn.factionId ? { factionId: spawn.factionId } : {}),
    ...(spawn.onKillSwitchId ? { onKillSwitchId: spawn.onKillSwitchId } : {}),
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
