// project/structurePlacements.ts
// 맵에 찍힌 구조물 킷 배치(GameMap.structurePlacements)의 순수 계층 — store·킷 정의 의존 없음.
//
// 규약 세 줄:
//  1. 배열 순서가 시간 순서다. 겹치면 **나중에 찍은 것이 이긴다**(뒤에서부터 찾는다).
//  2. `afterHash` 는 킷 정의가 아니라 **찍은 직후 맵 타일을 되읽어** 계산한다. 페인트 경로가
//     오토타일 성형·레이어 재배치·나무 짝 보정을 하므로 "킷이 의도한 그림"과 실제 타일이 다르다.
//  3. 복원은 페인트 API 를 타지 않고 **타일 인덱스를 날것으로 대입**한다. 페인트 경로를 다시 타면
//     오토타일이 원본과 다른 그림을 만든다.

import { TILE } from "@/project/defaults/constants";
import { clearTileStack } from "@/project/mapOverlayTiles";
import type { GameMap, StructurePlacement } from "@/project/types";
import { genId } from "@/util/id";

/** 좌상단 + 크기. 선택 영역·킷 크기와 같은 규약. */
export interface StructureRect {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

/** 한 배치 영역의 타일 스냅샷. 행 우선(길이 w*h). */
export interface StructureTiles {
  readonly lower: number[];
  readonly upper: number[];
}

export interface StructureRestoreResult {
  /** 날것으로 되돌린 칸 수. */
  readonly restored: number;
  /** 나중 배치가 덮고 있어 건너뛴 칸 수. */
  readonly skipped: number;
}

export function structurePlacementsOf(map: GameMap): readonly StructurePlacement[] {
  return map.structurePlacements ?? [];
}

/** 맵 안에 완전히 들어가는가. */
export function structureRectFitsMap(rect: StructureRect, map: Pick<GameMap, "width" | "height">): boolean {
  return rect.w > 0 && rect.h > 0
    && rect.x >= 0 && rect.y >= 0
    && rect.x + rect.w <= map.width
    && rect.y + rect.h <= map.height;
}

/** 맵 경계로 자른 사각형. 교집합이 비면 null — 기록할 배치가 없다는 뜻. */
export function clipStructureRectToMap(rect: StructureRect, map: Pick<GameMap, "width" | "height">): StructureRect | null {
  const left = Math.max(0, rect.x);
  const top = Math.max(0, rect.y);
  const right = Math.min(map.width, rect.x + rect.w);
  const bottom = Math.min(map.height, rect.y + rect.h);
  if (right <= left || bottom <= top) return null;
  return { x: left, y: top, w: right - left, h: bottom - top };
}

export function structureRectContains(rect: StructureRect, x: number, y: number): boolean {
  return x >= rect.x && y >= rect.y && x < rect.x + rect.w && y < rect.y + rect.h;
}

/** 지정 칸을 덮는 배치 — **뒤에서부터** 찾아 나중에 찍은 것을 돌려준다. */
export function structurePlacementAt(map: GameMap, x: number, y: number): StructurePlacement | undefined {
  const placements = structurePlacementsOf(map);
  for (let index = placements.length - 1; index >= 0; index -= 1) {
    const placement = placements[index];
    if (placement && structureRectContains(placement, x, y)) return placement;
  }
  return undefined;
}

/**
 * 재시공으로 **새로 넓어지는 칸**만 보고 이웃과 부딪히는 배치를 찾는다.
 * 이미 겹쳐 찍혀 있던 배치를 같은 크기로 다시 찍는 것은 막지 않는다 — 겹침은 정상(나중이 이김)이고,
 * 막아야 하는 것은 킷이 커져서 남의 자리를 새로 침범하는 경우다.
 */
export function structurePlacementsBlockingGrowth(
  map: GameMap,
  oldRect: StructureRect,
  newRect: StructureRect,
  excludePlacementId?: string,
): readonly StructurePlacement[] {
  const blocking = new Map<string, StructurePlacement>();
  for (let row = 0; row < newRect.h; row += 1) {
    for (let column = 0; column < newRect.w; column += 1) {
      const x = newRect.x + column;
      const y = newRect.y + row;
      if (structureRectContains(oldRect, x, y)) continue;
      for (const placement of structurePlacementsOf(map)) {
        if (placement.id === excludePlacementId) continue;
        if (structureRectContains(placement, x, y)) blocking.set(placement.id, placement);
      }
    }
  }
  return [...blocking.values()];
}

/** 영역의 현재 타일을 그대로 뜬다(성형 없음). 맵 밖 칸은 빈 타일로 채워 길이 w*h 를 보장한다. */
export function captureStructureTiles(map: GameMap, rect: StructureRect): StructureTiles {
  const lower: number[] = [];
  const upper: number[] = [];
  for (let row = 0; row < rect.h; row += 1) {
    for (let column = 0; column < rect.w; column += 1) {
      const x = rect.x + column;
      const y = rect.y + row;
      if (x < 0 || y < 0 || x >= map.width || y >= map.height) {
        lower.push(TILE.EMPTY);
        upper.push(TILE.EMPTY);
        continue;
      }
      const index = y * map.width + x;
      lower.push(map.lowerTiles[index] ?? TILE.EMPTY);
      upper.push(map.upperTiles[index] ?? TILE.EMPTY);
    }
  }
  return { lower, upper };
}

/**
 * 타일 배열의 결정적 해시. 32bit FNV-1a 두 갈래(다른 offset basis)를 이어 16자리 hex.
 * 용도는 "누가 덧칠했는지" soft hint 뿐이라 암호학적 강도는 필요 없고, 동기 계산이어야 한다.
 */
export function structureTilesHash(tiles: StructureTiles): string {
  let a = 0x811c9dc5;
  let b = 0x01000193;
  const feed = (value: number): void => {
    a = Math.imul(a ^ (value & 0xff), 0x01000193) >>> 0;
    a = Math.imul(a ^ ((value >>> 8) & 0xff), 0x01000193) >>> 0;
    b = Math.imul(b ^ (value & 0xffff), 0x85ebca6b) >>> 0;
    b = (b ^ (b >>> 13)) >>> 0;
  };
  feed(tiles.lower.length);
  for (const tile of tiles.lower) feed(tile + 2);
  feed(0xffff);
  for (const tile of tiles.upper) feed(tile + 2);
  return a.toString(16).padStart(8, "0") + b.toString(16).padStart(8, "0");
}

/** 배치가 찍힌 뒤 누가 덧칠했는가. 판정 실패(길이 불일치 등)는 "덧칠됨"으로 본다. */
export function structurePlacementIsOverpainted(map: GameMap, placement: StructurePlacement): boolean {
  return structureTilesHash(captureStructureTiles(map, placement)) !== placement.afterHash;
}

export interface StructurePlacementInput {
  readonly kitId: string;
  readonly rect: StructureRect;
  readonly before: StructureTiles;
  readonly id?: string;
  readonly stampedAt?: string;
}

/**
 * 배치 레코드를 만든다. **찍은 직후의 맵**을 넘겨야 한다 — afterHash 를 그 맵에서 되읽기 때문이다.
 * before 는 찍기 직전에 captureStructureTiles 로 떠 둔 것을 넘긴다.
 */
export function makeStructurePlacement(stampedMap: GameMap, input: StructurePlacementInput): StructurePlacement {
  return {
    id: input.id ?? genId("sp"),
    kitId: input.kitId,
    x: input.rect.x,
    y: input.rect.y,
    w: input.rect.w,
    h: input.rect.h,
    stampedAt: input.stampedAt ?? new Date().toISOString(),
    before: { lower: [...input.before.lower], upper: [...input.before.upper] },
    afterHash: structureTilesHash(captureStructureTiles(stampedMap, input.rect)),
  };
}

/** 찍은 직후의 맵에 배치를 덧붙인다(배열 끝 = 가장 나중). */
export function appendStructurePlacement(map: GameMap, input: StructurePlacementInput): StructurePlacement {
  const placement = makeStructurePlacement(map, input);
  map.structurePlacements = [...structurePlacementsOf(map), placement];
  return placement;
}

/** 이미 만들어 둔 레코드를 맵에 덧붙인다. */
export function pushStructurePlacement(map: GameMap, placement: StructurePlacement): void {
  map.structurePlacements = [...structurePlacementsOf(map), placement];
}

/** 같은 배열 위치(=겹침 순서)를 유지하며 배치를 갈아끼운다. 재시공용. */
export function replaceStructurePlacement(map: GameMap, next: StructurePlacement): boolean {
  const placements = [...structurePlacementsOf(map)];
  const index = placements.findIndex((placement) => placement.id === next.id);
  if (index < 0) return false;
  placements[index] = next;
  map.structurePlacements = placements;
  return true;
}

export function removeStructurePlacement(map: GameMap, placementId: string): boolean {
  const placements = structurePlacementsOf(map);
  const next = placements.filter((placement) => placement.id !== placementId);
  if (next.length === placements.length) return false;
  map.structurePlacements = next;
  return true;
}

/** 이 배치보다 **나중에** 찍힌 배치들이 점유한 칸(맵 인덱스) 집합. */
export function cellsOwnedByLaterPlacements(map: GameMap, placementId: string): ReadonlySet<number> {
  const placements = structurePlacementsOf(map);
  const index = placements.findIndex((placement) => placement.id === placementId);
  const owned = new Set<number>();
  if (index < 0) return owned;
  for (const later of placements.slice(index + 1)) {
    for (let row = 0; row < later.h; row += 1) {
      for (let column = 0; column < later.w; column += 1) {
        const x = later.x + column;
        const y = later.y + row;
        if (x < 0 || y < 0 || x >= map.width || y >= map.height) continue;
        owned.add(y * map.width + x);
      }
    }
  }
  return owned;
}

/**
 * `before` 타일을 **날것으로 대입**해 되돌린다(페인트 API 금지 — 오토타일이 다시 손댄다).
 * 나중 배치가 덮은 칸은 건너뛴다. 반대 순서(나중 배치를 지우면 아래의 이전 그림이 되살아남)는
 * before 규약상 정상 동작이라 아무 처리도 하지 않는다.
 */
export function restoreStructurePlacementTiles(
  map: GameMap,
  placement: StructurePlacement,
  options: { readonly skipCells?: ReadonlySet<number> } = {},
): StructureRestoreResult {
  const skipCells = options.skipCells ?? new Set<number>();
  let restored = 0;
  let skipped = 0;
  for (let row = 0; row < placement.h; row += 1) {
    for (let column = 0; column < placement.w; column += 1) {
      const x = placement.x + column;
      const y = placement.y + row;
      if (x < 0 || y < 0 || x >= map.width || y >= map.height) continue;
      const index = y * map.width + x;
      if (skipCells.has(index)) {
        skipped += 1;
        continue;
      }
      const cell = row * placement.w + column;
      const lower = placement.before.lower[cell];
      const upper = placement.before.upper[cell];
      // 빈 타일(TILE.EMPTY = -1)도 정당한 복원 대상이다 — undefined(기록 손상)만 건너뛴다.
      if (lower === undefined || upper === undefined) continue;
      clearTileStack(map, "lower", index);
      clearTileStack(map, "upper", index);
      map.lowerTiles[index] = lower;
      map.upperTiles[index] = upper;
      restored += 1;
    }
  }
  return { restored, skipped };
}

/** `before` 길이가 w*h 와 맞는가 — 손상된 기록은 정합성 수리에서 떨어뜨린다. */
export function structurePlacementBeforeIsWellFormed(placement: StructurePlacement): boolean {
  const expected = placement.w * placement.h;
  return placement.before?.lower?.length === expected && placement.before?.upper?.length === expected;
}
