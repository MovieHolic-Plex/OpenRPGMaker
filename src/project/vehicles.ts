// 탈것(소형선·대형선·비행선) — 저작 설정(system.vehicles)과 런타임 상태(session.vehicle)의 순수 규칙.
//
// 위치의 진실 공급원:
//   - 타고 있는 탈것은 주인공과 같이 움직이므로 위치를 따로 적지 않는다(주인공 좌표 = 탈것 좌표).
//   - 내리면 그 칸을 session.vehicle.positions[id] 에 적는다. 적힌 값이 없으면 저작 위치를 쓴다.
// 통행:
//   - 소형선/대형선은 지형 레코드의 vehiclePassage.boat / .ship 이 참인 칸만 간다(보통 물).
//   - 비행선은 충돌을 무시하고, 내릴 때만 발밑 지형의 vehiclePassage.airshipLand 를 본다.
// 둘 다 없는 프로젝트(system.vehicles 생략, session.vehicle 없음)는 기존 동작과 같다.
import { inBounds, isPassable } from "@/project/collision";
import { terrainRecordAt } from "@/project/terrainAt";
import type { Dir, GameMap, MapId, Project } from "@/project/types";

export const VEHICLE_IDS = ["boat", "ship", "airship"] as const;
export type VehicleId = (typeof VEHICLE_IDS)[number];

/** Vehicles.png(EasyRPG) 의 캐릭터 칸. 0=소형선, 1=대형선, 2=비행선. */
export const DEFAULT_VEHICLE_CHARACTER_INDEX: Readonly<Record<VehicleId, number>> = { boat: 0, ship: 1, airship: 2 };
export const VEHICLE_CHARSET_RESOURCE_ID = "easyrpg-charset-vehicles";
export const VEHICLE_CHARSET_TEXTURE_KEY = "tex_easyrpg_charset_vehicles";

export interface VehicleConfig {
  id: VehicleId;
  /** Vehicles 캐릭터 시트의 칸(0~7). */
  characterIndex: number;
  /** 처음 세워 둔 맵과 칸. 생략하면 Set Vehicle Location 전까지 어디에도 없다. */
  mapId?: MapId;
  x?: number;
  y?: number;
}

export interface VehicleLocation {
  mapId: MapId;
  x: number;
  y: number;
  direction?: Dir;
}

export interface VehicleSessionState {
  /** 지금 타고 있는 탈것. 없으면 걷는 중. */
  boardedId?: VehicleId;
  /** 저작 위치를 덮어쓴 세워 둔 자리(내린 곳, Set Vehicle Location). */
  positions?: Partial<Record<VehicleId, VehicleLocation>>;
}

type VehicleSession = {
  vehicle?: VehicleSessionState;
  currentMapId: MapId;
  x: number;
  y: number;
};

export function isVehicleId(value: unknown): value is VehicleId {
  return typeof value === "string" && (VEHICLE_IDS as readonly string[]).includes(value);
}

/** 저장·불러오기 정규화. 잘못된 항목은 버리고, 같은 id 는 뒤의 것이 이긴다. 비면 undefined(생략). */
export function normalizeVehicleConfigs(value: unknown): VehicleConfig[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const byId = new Map<VehicleId, VehicleConfig>();
  for (const entry of value) {
    if (!entry || typeof entry !== "object") continue;
    const record = entry as Record<string, unknown>;
    if (!isVehicleId(record.id)) continue;
    const characterIndex = typeof record.characterIndex === "number" && Number.isFinite(record.characterIndex)
      ? Math.min(7, Math.max(0, Math.trunc(record.characterIndex)))
      : DEFAULT_VEHICLE_CHARACTER_INDEX[record.id];
    const placed = typeof record.mapId === "string" && record.mapId
      && typeof record.x === "number" && Number.isFinite(record.x)
      && typeof record.y === "number" && Number.isFinite(record.y);
    byId.set(record.id, {
      id: record.id,
      characterIndex,
      ...(placed ? { mapId: record.mapId as string, x: Math.trunc(record.x as number), y: Math.trunc(record.y as number) } : {}),
    });
  }
  return byId.size > 0 ? [...byId.values()] : undefined;
}

/** 세이브 파싱. 모양이 틀린 칸은 버린다. 남는 게 없으면 undefined(생략 = 걷는 중). */
export function parseVehicleSessionState(value: unknown): VehicleSessionState | undefined {
  if (!value || typeof value !== "object") return undefined;
  const record = value as Record<string, unknown>;
  const positions: Partial<Record<VehicleId, VehicleLocation>> = {};
  const rawPositions = record.positions && typeof record.positions === "object" ? record.positions as Record<string, unknown> : {};
  for (const id of VEHICLE_IDS) {
    const entry = rawPositions[id] as Record<string, unknown> | undefined;
    if (!entry || typeof entry.mapId !== "string" || !Number.isSafeInteger(entry.x) || !Number.isSafeInteger(entry.y)) continue;
    const direction = entry.direction === "up" || entry.direction === "down" || entry.direction === "left" || entry.direction === "right" ? entry.direction : undefined;
    positions[id] = { mapId: entry.mapId, x: entry.x as number, y: entry.y as number, ...(direction ? { direction } : {}) };
  }
  const boardedId = isVehicleId(record.boardedId) ? record.boardedId : undefined;
  const hasPositions = Object.keys(positions).length > 0;
  if (!boardedId && !hasPositions) return undefined;
  return { ...(boardedId ? { boardedId } : {}), ...(hasPositions ? { positions } : {}) };
}

export function vehicleConfig(project: Pick<Project, "system">, id: VehicleId): VehicleConfig | undefined {
  return project.system.vehicles?.find((entry) => entry.id === id);
}

export function vehicleCharacterIndex(project: Pick<Project, "system">, id: VehicleId): number {
  return vehicleConfig(project, id)?.characterIndex ?? DEFAULT_VEHICLE_CHARACTER_INDEX[id];
}

export function boardedVehicleId(session: Pick<VehicleSession, "vehicle">): VehicleId | undefined {
  const id = session.vehicle?.boardedId;
  return isVehicleId(id) ? id : undefined;
}

/** 탈것의 현재 자리. 타고 있으면 주인공 자리, 아니면 세운 자리 → 저작 자리 순. */
export function vehicleLocation(project: Pick<Project, "system">, session: VehicleSession, id: VehicleId): VehicleLocation | undefined {
  if (boardedVehicleId(session) === id) return { mapId: session.currentMapId, x: session.x, y: session.y };
  const parked = session.vehicle?.positions?.[id];
  if (parked) return parked;
  const config = vehicleConfig(project, id);
  if (config?.mapId !== undefined && config.x !== undefined && config.y !== undefined) {
    return { mapId: config.mapId, x: config.x, y: config.y };
  }
  return undefined;
}

/** 이 맵 (x,y) 에 세워 둔(타지 않은) 탈것. */
export function parkedVehicleAt(project: Pick<Project, "system">, session: VehicleSession, mapId: MapId, x: number, y: number): VehicleId | undefined {
  return VEHICLE_IDS.find((id) => {
    if (boardedVehicleId(session) === id) return false;
    const location = vehicleLocation(project, session, id);
    return location?.mapId === mapId && location.x === x && location.y === y;
  });
}

export function setParkedVehicleLocation(session: Pick<VehicleSession, "vehicle">, id: VehicleId, location: VehicleLocation): void {
  session.vehicle ??= {};
  session.vehicle.positions = { ...(session.vehicle.positions ?? {}), [id]: { ...location } };
}

/** 탄 채로 (x,y) 로 들어갈 수 있나. 비행선은 맵 안이면 어디든, 배는 지형이 그 배를 허용해야 한다. */
export function vehicleCanEnter(project: Project, map: GameMap, id: VehicleId, x: number, y: number): boolean {
  if (!inBounds(map, x, y)) return false;
  if (id === "airship") return true;
  const passage = terrainRecordAt(project, { mapId: map.id, x, y })?.record.vehiclePassage;
  return id === "boat" ? passage?.boat === true : passage?.ship === true;
}

/** 비행선이 (x,y) 에 내려앉을 수 있나 — 지형이 착륙을 허용하고 걸어 설 수 있는 칸이어야 한다. */
export function airshipCanLand(project: Project, map: GameMap, x: number, y: number): boolean {
  if (!inBounds(map, x, y) || !isPassable(project, map, x, y)) return false;
  return terrainRecordAt(project, { mapId: map.id, x, y })?.record.vehiclePassage.airshipLand === true;
}

/** 걸음 속도 배율. 대형선·비행선은 두 배로 빠르다(소형선은 걷기와 같다). */
export function vehicleSpeedFactor(session: Pick<VehicleSession, "vehicle">): number {
  const id = boardedVehicleId(session);
  return id === "ship" || id === "airship" ? 2 : 1;
}
