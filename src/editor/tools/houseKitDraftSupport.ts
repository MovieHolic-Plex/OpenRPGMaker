import { appendToTree } from "@/project/mapTree";
import { isPassable, tilePassability } from "@/project/collision";
import { TILE } from "@/project/defaults/constants";
import type { GameEvent, GameMap, MapId, MapTreeNode, Project } from "@/project/types";
import type { FootprintWing, HouseKitWindowsOption } from "@/editor/houseKit";
import {
  createHouseDoorEvent,
  createHouseDoorStepEvent,
  stampHouseDoorBackground,
  type HouseStoryCount,
} from "@/editor/houseInteriors";
import { houseBBox } from "./houseLotDecor";
import { ToolError } from "./types";
import { applyRoofDeck } from "./village/houses";

/** 외장 형태 축 — templateId 가 카탈로그에서 정해 주거나 호출자가 직접 준다. */
export type HouseShapeOptions = {
  /** 외장 층수 — 벽 밴드 행 수를 늘린다. 없으면 1층. */
  readonly stories?: HouseStoryCount;
  /** 낮은 벽(상단+하단 2행) — 헛간·창고. stories 를 무시한다. */
  readonly lowWall?: boolean;
  /** 옥상 판자 데크 + 벽면 사다리(파랑 평지붕 전용). */
  readonly roofDeck?: boolean;
  /** 우측 사선 지붕 굴뚝. */
  readonly chimney?: boolean;
  readonly windows?: HouseKitWindowsOption;
};

export type HouseExteriorPlan = {
  /** 외장에 실제로 적용된 층수 — 실내 층수와 울타리도 이 값을 따라야 한다. */
  readonly stories: HouseStoryCount;
  /** stampFootprintHouseKit 에 그대로 펼치는 형태 인자(kitId·wings 제외). */
  readonly stampOptions: Record<string, unknown>;
  /** 요약에 붙일 형태 표기(", 낮은벽" / ", 2층" / ""). */
  readonly note: string;
};

/** 형태 축을 스탬퍼 입력과 요약 표기로 접는다. lowWall 은 stories 를 무시한다. */
export function houseExteriorPlan(options: HouseShapeOptions): HouseExteriorPlan {
  const stories: HouseStoryCount = options.lowWall ? 1 : options.stories ?? 1;
  return {
    stories,
    stampOptions: {
      stories,
      ...(options.lowWall ? { lowWall: true } : {}),
      ...(options.windows === undefined ? {} : { windows: options.windows }),
      ...(options.chimney ? { chimney: true } : {}),
    },
    note: options.lowWall ? ", 낮은벽" : stories > 1 ? `, ${stories}층` : "",
  };
}

/** 실내 층수는 외장과 같아야 한다 — 명시값이 정본, 없을 때만 높이 휴리스틱(2026-08-31 어긋남 교정). */
export function houseInteriorStories(
  explicit: HouseStoryCount | undefined,
  wings: readonly FootprintWing[],
): HouseStoryCount {
  if (explicit) return explicit;
  return wings.some((wing) => wing.h >= 11) ? 3 : wings.some((wing) => wing.h >= 9) ? 2 : 1;
}

/** 옥상 데크는 스탬퍼 뒤에 얹는다. 얹었으면 true(요약 장식 표기용). */
export function applyHouseRoofDeck(
  map: GameMap,
  wings: readonly FootprintWing[],
  doorAt: { readonly x: number; readonly y: number } | undefined,
  enabled: boolean | undefined,
): boolean {
  if (enabled !== true || doorAt === undefined) return false;
  applyRoofDeck(map, houseBBox(wings), doorAt);
  return true;
}

export function uniqueProjectId(draft: Project, prefix: string, body: string): string {
  const cleanBody = body.replace(/[^a-zA-Z0-9_]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 64) || "1";
  let id = `${prefix}_${cleanBody}`;
  let suffix = 2;
  const eventIds = new Set(Object.values(draft.maps).flatMap((map) => map.events.map((event) => event.id)));
  while (draft.maps[id] || eventIds.has(id)) {
    id = `${prefix}_${cleanBody}_${suffix}`;
    suffix += 1;
  }
  return id;
}

export function appendTreeChildOnce(root: MapTreeNode, mapId: MapId, parentId: MapId): void {
  if (treeContains(root, mapId)) return;
  appendToTree(root, mapId, parentId);
}

export function upsertHouseDoorEvents(
  map: GameMap,
  options: Parameters<typeof createHouseDoorEvent>[0],
): void {
  stampHouseDoorBackground(map, options);
  upsertEvent(map.events, createHouseDoorEvent(options));
  // 열린 문 기본값: 문 앞 통행 칸에 밟으면 열리는 발판 — 문 칸은 벽이라 밟히지 않는다.
  // 문 앞이 맵 밖이면 발판을 생략한다(문 스프라이트만 남는다).
  if (options.y + 1 < map.height) {
    upsertEvent(map.events, createHouseDoorStepEvent({
      eventId: `${options.eventId}_step`,
      doorEventId: options.eventId,
      x: options.x,
      y: options.y + 1,
      interiorMapId: options.interiorMapId,
      name: options.name,
      entryX: options.entryX,
      entryY: options.entryY,
    }));
  }
}

export function upsertEvent(events: GameEvent[], event: GameEvent): void {
  const index = events.findIndex((entry) => entry.id === event.id);
  if (index >= 0) events[index] = event;
  else events.push(event);
}

export function ensureDoorFrontPassable(
  project: Project,
  map: GameMap,
  door: { readonly x: number; readonly y: number },
): string | undefined {
  const front = { x: door.x, y: door.y + 1 };
  if (front.x < 0 || front.y < 0 || front.x >= map.width || front.y >= map.height) {
    throw new ToolError("문 앞이 맵 밖입니다 — 남쪽에 여유를 두세요", {
      code: "house-door-front-out-of-bounds",
      mapId: map.id,
      x: front.x,
      y: front.y,
    });
  }
  if (isPassable(project, map, front.x, front.y)) return undefined;
  const index = front.y * map.width + front.x;
  map.lowerTiles[index] = chooseDoorFrontGroundTile(project, map, front);
  map.upperTiles[index] = TILE.EMPTY;
  clearTileStacksAt(map, index);
  return `문 앞 (${front.x},${front.y}) 통행 확보 — 지면으로 정리`;
}

export function seedFromString(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function treeContains(node: MapTreeNode, mapId: MapId): boolean {
  return node.mapId === mapId || node.children.some((child) => treeContains(child, mapId));
}

function chooseDoorFrontGroundTile(project: Project, map: GameMap, center: { readonly x: number; readonly y: number }): number {
  const tileset = project.tilesets[map.tilesetId];
  if (!tileset) return TILE.GRASS;
  const counts = new Map<number, number>();
  for (let y = center.y - 2; y <= center.y + 2; y += 1) {
    for (let x = center.x - 2; x <= center.x + 2; x += 1) {
      if (x < 0 || y < 0 || x >= map.width || y >= map.height) continue;
      const tile = map.lowerTiles[y * map.width + x] ?? TILE.EMPTY;
      if (tile === TILE.EMPTY) continue;
      const passability = tilePassability(tileset, tile, TILE.EMPTY);
      if (!passability.up && !passability.down && !passability.left && !passability.right) continue;
      counts.set(tile, (counts.get(tile) ?? 0) + 1);
    }
  }
  let bestTile: number = TILE.GRASS;
  let bestCount = 0;
  for (const [tile, count] of counts) {
    if (count <= bestCount) continue;
    bestTile = tile;
    bestCount = count;
  }
  return bestTile;
}

function clearTileStacksAt(map: GameMap, index: number): void {
  if (map.lowerTileStacks?.[index]) {
    delete map.lowerTileStacks[index];
    if (Object.keys(map.lowerTileStacks).length === 0) delete map.lowerTileStacks;
  }
  if (map.upperTileStacks?.[index]) {
    delete map.upperTileStacks[index];
    if (Object.keys(map.upperTileStacks).length === 0) delete map.upperTileStacks;
  }
}
