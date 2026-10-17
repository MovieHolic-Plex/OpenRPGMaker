// 탈것(소형선·대형선·비행선·초코보·광산 수레·뗏목) — 저작 설정(system.vehicles)과 런타임 상태(session.vehicle)의 순수 규칙.
//
// 위치의 진실 공급원:
//   - 타고 있는 탈것은 주인공과 같이 움직이므로 위치를 따로 적지 않는다(주인공 좌표 = 탈것 좌표).
//   - 내리면 그 칸을 session.vehicle.positions[id] 에 적는다. 적힌 값이 없으면 저작 위치를 쓴다.
// 통행:
//   - 소형선/대형선은 지형 레코드의 vehiclePassage.boat / .ship 이 참인 칸만 간다(보통 물).
//   - 초코보는 걷는 칸 + 숲 / 광산 수레는 레일만 / 뗏목은 강·얕은 물만(vehicleCanEnter 의 주석 참고).
//   - 비행선은 충돌을 무시하고, 내릴 때만 발밑 지형의 vehiclePassage.airshipLand 를 본다(지형 기록 없는 보통 땅은 착륙 가능).
// 둘 다 없는 프로젝트(system.vehicles 생략, session.vehicle 없음)는 기존 동작과 같다.
import { inBounds, isPassable } from "@/project/collision";
import { terrainRecordAt } from "@/project/terrainAt";
import type { Dir, GameMap, MapId, Project } from "@/project/types";

export const VEHICLE_IDS = ["boat", "ship", "airship", "chocobo", "cart", "raft"] as const;
export type VehicleId = (typeof VEHICLE_IDS)[number];

/**
 * 탈것 그림(기존 걷기 칩 재사용 — 새 도트 없음). 2026-10-15 이전 세 가지(소형선·대형선·비행선)는 Vehicles 시트였고,
 * 초코보는 Animal 시트의 말(칸 5), 광산 수레는 Vehicles 의 무한궤도 차(칸 5, 임시 — 전용 수레 도트 필요), 뗏목은 Vehicles 의 쪽배(칸 0)를 쓴다.
 */
export const VEHICLE_CHARSET_RESOURCE_ID = "easyrpg-charset-vehicles";
export const VEHICLE_CHARSET_TEXTURE_KEY = "tex_easyrpg_charset_vehicles";
export const ANIMAL_CHARSET_RESOURCE_ID = "easyrpg-charset-animal";
export const ANIMAL_CHARSET_TEXTURE_KEY = "tex_easyrpg_charset_animal";
export const DEFAULT_VEHICLE_CHARACTER_INDEX: Readonly<Record<VehicleId, number>> = { boat: 0, ship: 1, airship: 2, chocobo: 5, cart: 5, raft: 0 };

export function vehicleSheet(id: VehicleId): { readonly resourceId: string; readonly textureKey: string } {
  return id === "chocobo"
    ? { resourceId: ANIMAL_CHARSET_RESOURCE_ID, textureKey: ANIMAL_CHARSET_TEXTURE_KEY }
    : { resourceId: VEHICLE_CHARSET_RESOURCE_ID, textureKey: VEHICLE_CHARSET_TEXTURE_KEY };
}

export interface VehicleConfig {
  id: VehicleId;
  /** Vehicles 캐릭터 시트의 칸(0~7). */
  characterIndex: number;
  /** 처음 세워 둔 맵과 칸. 생략하면 Set Vehicle Location 전까지 어디에도 없다. */
  mapId?: MapId;
  x?: number;
  y?: number;
  /**
   * 비행 시점(비행선 전용, 선택). "mode7" 이면 비행선을 탄 동안 멀리 보기 + 원근 필터(playSceneMode7.ts).
   * 생략 = 기존 탑뷰 그대로(저장 JSON 에도 필드가 없다).
   */
  flightView?: FlightView;
}

export const FLIGHT_VIEWS = ["mode7"] as const;
export type FlightView = (typeof FLIGHT_VIEWS)[number];

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
    const flightView = record.id === "airship" && record.flightView === "mode7" ? ("mode7" as const) : undefined;
    byId.set(record.id, {
      id: record.id,
      characterIndex,
      ...(flightView ? { flightView } : {}),
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

/**
 * 탄 채로 (x,y) 로 들어갈 수 있나. 비행선은 맵 안이면 어디든, 나머지는 지형이 그 탈것을 허용해야 한다.
 *   - 소형선·대형선: 지형 레코드 vehiclePassage.boat / .ship. 레코드가 없는 칸은 칸 이름표 water 로 판정한다.
 *   - 뗏목: 레코드 raft 가 참이거나(강), raft 를 적지 않은 물 레코드 중 대형선이 못 다니는 것(boat 참·ship 거짓 — 호수)·이름표 water. 바다 레코드(raft:false 또는 ship 참)는 못 간다.
 *   - 초코보(걷는 탈것): 걸을 수 있는 칸 + 레코드 chocobo 가 참인 칸 + 이름표 tree/forest 칸(걸을 수 없는 숲도 지난다). 물·산은 못 간다.
 *   - 광산 수레: 레코드 cart 가 참이거나 레일 칸(칸 이름표·태그에 선로·레일·궤도·rail — 가드레일 제외)만.
 */
export function vehicleCanEnter(project: Project, map: GameMap, id: VehicleId, x: number, y: number): boolean {
  if (!inBounds(map, x, y)) return false;
  if (id === "airship") return true;
  const record = terrainRecordAt(project, { mapId: map.id, x, y })?.record;
  const passage = record?.vehiclePassage;
  switch (id) {
    case "boat": return passage ? passage.boat === true : isWaterTagged(project, map, x, y);
    case "ship": return passage ? passage.ship === true : isWaterTagged(project, map, x, y);
    case "raft":
      if (passage?.raft !== undefined) return passage.raft;
      return passage ? passage.boat === true && passage.ship !== true : isWaterTagged(project, map, x, y);
    case "chocobo":
      return isPassable(project, map, x, y) || passage?.chocobo === true || isTileTagged(project, map, x, y, FOREST_TAGS);
    case "cart":
      return passage?.cart === true || isRailTile(project, map, x, y);
  }
}

const FOREST_TAGS = ["tree", "forest"] as const;
const RAIL_LABEL = /선로|레일|궤도|철길|\brail|\btrack/i;

function lowerTileMeta(project: Pick<Project, "tilesets">, map: GameMap, x: number, y: number) {
  const tile = map.lowerTiles[y * map.width + x];
  if (typeof tile !== "number" || tile < 0) return undefined;
  return project.tilesets[map.tilesetId]?.tileMeta?.[tile];
}

function isTileTagged(project: Pick<Project, "tilesets">, map: GameMap, x: number, y: number, tags: readonly string[]): boolean {
  return lowerTileMeta(project, map, x, y)?.tags?.some((tag) => tags.includes(tag)) === true;
}

/** 바닥 칸이 칸 이름표 water 를 가졌나(지형 태그·기록과 무관한 칩셋 정의 속성). */
export function isWaterTagged(project: Pick<Project, "tilesets">, map: GameMap, x: number, y: number): boolean {
  return isTileTagged(project, map, x, y, ["water"]);
}

/** 바닥 칸이 레일인가 — 칸 이름(선로·레일·궤도)이나 태그(rail·railway·track). 가드레일은 레일이 아니다. */
export function isRailTile(project: Pick<Project, "tilesets">, map: GameMap, x: number, y: number): boolean {
  const meta = lowerTileMeta(project, map, x, y);
  if (!meta) return false;
  if (meta.tags?.some((tag) => tag === "rail" || tag === "railway" || tag === "track")) return true;
  const label = meta.label ?? "";
  return !label.includes("가드레일") && RAIL_LABEL.test(label);
}

/**
 * 비행선이 (x,y) 에 내려앉을 수 있나 — 걸어 설 수 있는 칸이어야 하고, 지형 기록이 있으면 그 airshipLand 를 따른다.
 * 태그 0(보통 땅)은 기록이 없다(terrainRecordAt) — 그런 땅은 걸을 수 있는 한 착륙할 수 있다.
 * 막고 싶은 칸은 지형 기록을 붙이고 airshipLand 를 끈다.
 */
export function airshipCanLand(project: Project, map: GameMap, x: number, y: number): boolean {
  if (!inBounds(map, x, y) || !isPassable(project, map, x, y)) return false;
  const terrain = terrainRecordAt(project, { mapId: map.id, x, y });
  return terrain ? terrain.record.vehiclePassage.airshipLand === true : true;
}

/** 걸음 속도 배율. 대형선·비행선·초코보·광산 수레는 두 배로 빠르다(소형선·뗏목은 걷기와 같다). */
export function vehicleSpeedFactor(session: Pick<VehicleSession, "vehicle">): number {
  const id = boardedVehicleId(session);
  return id === "ship" || id === "airship" || id === "chocobo" || id === "cart" ? 2 : 1;
}
