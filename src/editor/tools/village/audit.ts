// editor/tools/village/audit.ts
// 시공 감사·비평 — 문 연결/무결, 용마루 침범, 길 성분, 울타리/NPC 집계, 도달성 비평.

import { checkReachability } from "@/project/lint/reachability";
import { DEFAULT_COBBLE_AUTOTILE_GROUP, DEFAULT_ROAD_AUTOTILE_GROUP, DEFAULT_SAND_AUTOTILE_GROUP } from "@/project/defaults/autotileGroups";
import { isWaterChipsetTile } from "@/project/defaults/chipsetMapping";
import { TILE } from "@/project/defaults/constants";
import type { Command, GameEvent, GameMap, Project } from "@/project/types";
import { ToolError, type ToolExecResult } from "../types";
import {
  coordKey,
  DOOR_BOTTOM_TILE,
  DOOR_TOP_TILE,
  pointFromKey,
  ROAD_TILES,
  WINDOW_TILES,
  type BuiltHouse,
  type Point,
  type Rect,
  type VillageAudit,
} from "./constants";
import { countFenceTiles, houseHasFence } from "./fences";
import { houseKitRoofUpperTiles } from "./houses";

export function critiqueBuiltVillage(
  project: Project,
  map: GameMap,
  doorFronts: readonly Point[],
): { readonly ok: boolean; readonly summary: string; readonly issues: readonly string[]; readonly reachableDoors: number } {
  const issues: string[] = [];
  const start = project.startMapId === map.id
    ? project.startPos
    : { x: Math.floor(map.width / 2), y: Math.floor(map.height / 2) };
  const targets = doorFronts.length > 0 ? doorFronts : [start];
  let reachableDoors = 0;
  try {
    const result = checkReachability(project, map.id, start, [...targets]);
    reachableDoors = targets.length - result.unreachable.length;
    if (!result.reachable) {
      issues.push(`시작점(${start.x},${start.y})에서 도달 불가 ${result.unreachable.length}/${targets.length}곳`);
    }
  } catch (err) {
    issues.push(err instanceof Error ? err.message : String(err));
  }
  return {
    ok: issues.length === 0,
    summary: issues.length === 0
      ? `시작→문앞 전부 도달 (${reachableDoors}/${targets.length})`
      : issues.join("; "),
    issues,
    reachableDoors,
  };
}

export function critiqueVillageMap(project: Project, args: Record<string, unknown>): ToolExecResult {
  const mapId = typeof args.mapId === "string" ? args.mapId : "";
  const map = project.maps[mapId];
  if (!map) throw new ToolError(`맵을 찾을 수 없습니다: ${mapId}`, { code: "map-not-found", mapId });
  const fronts: Point[] = [];
  if (Array.isArray(args.doorFronts)) {
    for (const entry of args.doorFronts) {
      if (typeof entry !== "object" || entry === null) continue;
      const rec = entry as Record<string, unknown>;
      if (typeof rec.x === "number" && typeof rec.y === "number") fronts.push({ x: rec.x, y: rec.y });
    }
  }
  // 문 앞 미지정 시: 이벤트 위치(문 이벤트) 남쪽 1칸을 후보로.
  if (fronts.length === 0) {
    for (const event of map.events) {
      fronts.push({ x: event.x, y: Math.min(map.height - 1, event.y + 1) });
    }
  }
  const critique = critiqueBuiltVillage(project, map, fronts.slice(0, 24));
  return {
    summary: `마을 비평: ${critique.summary}`,
    data: critique,
  };
}

export function auditVillage(map: GameMap, houses: readonly BuiltHouse[], upperBefore: readonly number[], area: Rect): VillageAudit {
  const doorsConnected = houses.filter((house) => doorHasRoad(map, house.doorAt)).length;
  // 문 타일 자체가 살아있는지(도로 관통 등으로 덮이지 않았는지)도 직접 검사한다.
  const lowerAt = (x: number, y: number): number => map.lowerTiles[y * map.width + x] ?? TILE.EMPTY;
  const doorsIntact = houses.filter(
    (house) => lowerAt(house.doorAt.x, house.doorAt.y) === DOOR_BOTTOM_TILE && lowerAt(house.doorAt.x, house.doorAt.y - 1) === DOOR_TOP_TILE
  ).length;
  let roadInsideHouses = 0;
  for (const house of houses) {
    for (let y = house.bbox.y; y < house.bbox.y + house.bbox.h; y += 1) {
      for (let x = house.bbox.x; x < house.bbox.x + house.bbox.w; x += 1) {
        if (ROAD_TILES.has(lowerAt(x, y))) roadInsideHouses += 1;
      }
    }
  }
  // 용마루 행(bbox.y-1) 무결성 — 길이 upper를 지우거나 키트 외 upper가 얹히면 지붕이 찢어져 보인다.
  const ridgeKeep = houseKitRoofUpperTiles();
  let ridgeInvaded = 0;
  for (const house of houses) {
    const y = house.bbox.y - 1;
    if (y < 0) continue;
    for (let x = house.bbox.x; x < house.bbox.x + house.bbox.w; x += 1) {
      if (ROAD_TILES.has(lowerAt(x, y))) ridgeInvaded += 1;
      const upper = map.upperTiles[y * map.width + x] ?? TILE.EMPTY;
      if (upper !== TILE.EMPTY && !ridgeKeep.has(upper)) ridgeInvaded += 1;
    }
  }
  const roadComponents = countRoadComponents(map, area);
  const fencedHouses = houses.filter((house) => houseHasFence(map, house)).length;
  const fenceTiles = countFenceTiles(map, area);
  const npcEvents = map.events.filter(isNpcEvent);
  const npcsWithText = npcEvents.filter(eventHasText).length;
  let windowCount = 0;
  for (let i = 0; i < map.upperTiles.length; i += 1) {
    if (upperBefore[i] !== map.upperTiles[i] && WINDOW_TILES.has(map.upperTiles[i] ?? TILE.EMPTY)) windowCount += 1;
  }
  return {
    doorsConnected,
    doorsIntact,
    roadInsideHouses,
    ridgeInvaded,
    roadComponents,
    npcCount: npcEvents.length,
    npcsWithText,
    windowCount,
    fencedHouses,
    fenceTiles,
  };
}

function doorHasRoad(map: GameMap, door: Point): boolean {
  for (let y = door.y + 1; y <= door.y + 3; y += 1) {
    for (let x = door.x - 1; x <= door.x + 1; x += 1) {
      if (x < 0 || y < 0 || x >= map.width || y >= map.height) continue;
      if (ROAD_TILES.has(map.lowerTiles[y * map.width + x] ?? TILE.EMPTY)) return true;
    }
  }
  return false;
}

const COBBLE_SURFACE = new Set<number>(DEFAULT_COBBLE_AUTOTILE_GROUP.memberTileIds);
// 조경 흙마당(밭 지구 세트) 판정용 — 순수 흙길 소형 성분은 도로망이 아니다 (2026-07-17).
const DIRT_SURFACE = new Set<number>(DEFAULT_ROAD_AUTOTILE_GROUP.memberTileIds);
// 백사장 판정용 — 물에 접한 순수 모래 성분은 해변이지 길이 아니다 (2026-07-17).
const SAND_SURFACE = new Set<number>(DEFAULT_SAND_AUTOTILE_GROUP.memberTileIds);

/** 성분>1 진단용 — 각 도로 성분의 대표 좌표와 크기. (노두/흙마당 필터 적용 후) */
export function roadComponentNotes(map: GameMap, area: Rect): string[] {
  return collectRoadComponents(map, area).map((cells) => {
    const tiles = new Set(cells.map((key) => {
      const point = pointFromKey(key);
      return map.lowerTiles[point.y * map.width + point.x] ?? TILE.EMPTY;
    }));
    const first = pointFromKey(cells[0]!);
    return `(${first.x},${first.y})×${cells.length}[${[...tiles].slice(0, 6).join("/")}]`;
  });
}

function countRoadComponents(map: GameMap, area: Rect): number {
  return collectRoadComponents(map, area).length;
}

function collectRoadComponents(map: GameMap, area: Rect): string[][] {
  const road = new Set<string>();
  for (let y = area.y; y < area.y + area.h; y += 1) {
    for (let x = area.x; x < area.x + area.w; x += 1) {
      const index = y * map.width + x;
      // 상위 판자 다리(199)는 "하위가 물일 때만" 도로 연결로 인정 — 수로가 대로를 지나가면
      // 하위가 물이 된다 (2026-07-17). 옥상 데크(지붕 위 199)는 도로가 아니다.
      const isBridge = (map.upperTiles[index] ?? TILE.EMPTY) === 199
        && isWaterChipsetTile(map.lowerTiles[index] ?? TILE.EMPTY);
      if (isBridge || ROAD_TILES.has(map.lowerTiles[index] ?? TILE.EMPTY)) road.add(coordKey(x, y));
    }
  }
  const components: string[][] = [];
  while (road.size > 0) {
    const first = road.values().next().value as string | undefined;
    if (!first) break;
    const cells: string[] = [];
    const stack = [first];
    road.delete(first);
    while (stack.length > 0) {
      const key = stack.pop() as string;
      cells.push(key);
      const point = pointFromKey(key);
      for (const next of [
        { x: point.x + 1, y: point.y },
        { x: point.x - 1, y: point.y },
        { x: point.x, y: point.y + 1 },
        { x: point.x, y: point.y - 1 },
      ]) {
        const nextKey = coordKey(next.x, next.y);
        if (!road.has(nextKey)) continue;
        road.delete(nextKey);
        stack.push(nextKey);
      }
    }
    // 자연 성분 제외 규칙: ① 16칸 미만의 순수 포석(바위 노두)·순수 흙길(조경 흙마당),
    // ② 물에 접한 순수 모래(백사장 — 모래가 길 재질과 겹쳐 오검출되던 것, 2026-07-17).
    const tileAtKey = (key: string): number => {
      const point = pointFromKey(key);
      return map.lowerTiles[point.y * map.width + point.x] ?? TILE.EMPTY;
    };
    const touchesWater = (): boolean => cells.some((key) => {
      const point = pointFromKey(key);
      return [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => {
        const nx = point.x + dx!;
        const ny = point.y + dy!;
        if (nx < 0 || ny < 0 || nx >= map.width || ny >= map.height) return false;
        return isWaterChipsetTile(map.lowerTiles[ny * map.width + nx] ?? TILE.EMPTY);
      });
    });
    // 백사장/잔교: 모래 또는 "물 위 판자(잔교 199)" 셀로만 이뤄지고 물에 접한 성분 = 물가 도크.
    const isBeachDockCell = (key: string): boolean => {
      const point = pointFromKey(key);
      const lower = map.lowerTiles[point.y * map.width + point.x] ?? TILE.EMPTY;
      const upper = map.upperTiles[point.y * map.width + point.x] ?? TILE.EMPTY;
      return SAND_SURFACE.has(lower) || (upper === 199 && isWaterChipsetTile(lower));
    };
    const isNatureOutcrop =
      (cells.length < 16 && (
        cells.every((key) => COBBLE_SURFACE.has(tileAtKey(key)))
        || cells.every((key) => DIRT_SURFACE.has(tileAtKey(key)))
      ))
      || (cells.every(isBeachDockCell) && touchesWater());
    if (!isNatureOutcrop) components.push(cells);
  }
  return components;
}

function isNpcEvent(event: GameEvent): boolean {
  return event.id.startsWith("ev_village_");
}

function eventHasText(event: GameEvent): boolean {
  return (event.pages ?? []).some((page) => page.commands.some(isTextCommand));
}

function isTextCommand(command: Command): boolean {
  return command.kind === "text";
}
