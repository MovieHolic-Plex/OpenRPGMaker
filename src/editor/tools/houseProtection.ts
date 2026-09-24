import type { GameMap, MapLayoutRegion, Project, Rect } from "@/project/types";
import { ToolError } from "./types";

type Cell = { readonly x: number; readonly y: number };
type Bounds = Pick<GameMap, "width" | "height">;
export const HOUSE_WALL_LADDER = 322;

/** Same column as the authored deck; only its one ground attachment lies outside the bbox. */
export function roofDeckLadderAttachment(bbox: Rect, door: Cell): Cell {
  const left = bbox.x + 2;
  const right = bbox.x + bbox.w - 3;
  return { x: Math.abs(right - door.x) >= Math.abs(left - door.x) ? right : left, y: bbox.y + bbox.h };
}

/** Full bbox (including gaps between wings) and full-width north ridge, clipped when bounds exist. */
export function houseFootprintCells(bbox: Rect, bounds?: Bounds): Cell[] {
  return rectCells({ x: bbox.x, y: bbox.y - 1, w: bbox.w, h: bbox.h + 1 }, bounds);
}

function rectCells(rect: Rect, bounds?: Bounds): Cell[] {
  const cells: Cell[] = [];
  for (let y = Math.max(0, rect.y); y < Math.min(bounds?.height ?? Infinity, rect.y + rect.h); y += 1) {
    for (let x = Math.max(0, rect.x); x < Math.min(bounds?.width ?? Infinity, rect.x + rect.w); x += 1) cells.push({ x, y });
  }
  return cells;
}

function cellKey(cell: Cell): string { return `${cell.x},${cell.y}`; }
function inMap(map: Bounds, cell: Cell): boolean {
  return cell.x >= 0 && cell.y >= 0 && cell.x < map.width && cell.y < map.height;
}
function isRoofDeck(region: MapLayoutRegion): boolean {
  return region.shape === "rooftop-deck" || region.tags?.includes("roof-deck") === true
    || region.tags?.includes("shape:rooftop-deck") === true;
}
function regionCells(map: GameMap, region: MapLayoutRegion): Cell[] {
  const cells = houseFootprintCells(region, map);
  if (region.doorAt && isRoofDeck(region)) {
    const ladder = roofDeckLadderAttachment(region, region.doorAt);
    if (inMap(map, ladder) && map.upperTiles[ladder.y * map.width + ladder.x] === HOUSE_WALL_LADDER) cells.push(ladder);
  }
  return cells;
}

type Ownership = {
  readonly source: "layout" | "placement";
  readonly id: string;
  readonly rect: Rect;
  readonly cells: readonly Cell[];
};
function ownerships(map: GameMap): Ownership[] {
  return [
    ...(map.layoutPlan?.regions ?? []).filter((region) => region.role === "house")
      .map((region): Ownership => ({ source: "layout", id: region.id, rect: region, cells: regionCells(map, region) })),
    ...(map.structurePlacements ?? []).map((placement): Ownership => ({
      source: "placement", id: placement.id, rect: placement,
      cells: rectCells(placement, map),
    })),
  ];
}

/** The same accepted ownership geometry used by the final invariant, independent of passability. */
export function protectedHouseCells(map: GameMap): readonly Cell[] {
  return ownerships(map).flatMap((owner) => owner.cells);
}

type CellSnapshot = Cell & {
  readonly lower: number;
  readonly upper: number;
  readonly lowerStack: readonly number[] | undefined;
  readonly upperStack: readonly number[] | undefined;
};
export type HouseSnapshot = {
  readonly mapId: string;
  readonly width: number;
  readonly height: number;
  readonly tileSize: number;
  readonly tilesetId: string;
  readonly source: Ownership["source"];
  readonly id: string;
  readonly rect: Rect;
  readonly cells: readonly CellSnapshot[];
};

function snapshotHouse(map: GameMap, owner: Ownership): HouseSnapshot {
  const { x, y, w, h } = owner.rect;
  // Layout metadata is retained by project IO without a rectangle shape guard.
  if (![x, y, w, h].every(Number.isSafeInteger) || w <= 0 || h <= 0) {
    throw new ToolError("완성된 집의 보호 영역 좌표가 유효하지 않습니다.", { code: "protected-house-write", mapId: map.id });
  }
  return {
    mapId: map.id, width: map.width, height: map.height, tileSize: map.tileSize, tilesetId: map.tilesetId,
    source: owner.source, id: owner.id, rect: { x, y, w, h },
    cells: owner.cells.map((cell) => {
      const index = cell.y * map.width + cell.x;
      return { ...cell, lower: map.lowerTiles[index], upper: map.upperTiles[index],
        lowerStack: map.lowerTileStacks?.[index]?.slice(), upperStack: map.upperTileStacks?.[index]?.slice() };
    }),
  };
}

/** Always read accepted project values afresh; never reuse a session or original-kit baseline. */
export function captureHouseProtection(project: Project): HouseSnapshot[] {
  return Object.values(project.maps).flatMap((map) => ownerships(map).map((owner) => snapshotHouse(map, owner)));
}

// Draft-local seals do not persist or follow clones. Durable ownership lives in existing map metadata.
const completedInDraft = new WeakMap<Project, HouseSnapshot[]>();
export function uniqueHouseRegionId(map: GameMap, prefix: string, reserved = new Set<string>()): string {
  const used = new Set([...(map.layoutPlan?.regions ?? []).map((region) => region.id), ...reserved]);
  let suffix = 1;
  while (used.has(`${prefix}_${suffix}`)) suffix += 1;
  const id = `${prefix}_${suffix}`;
  reserved.add(id);
  return id;
}
export function registerCompletedHouse(project: Project, map: GameMap, fields: Omit<MapLayoutRegion, "id" | "role">): void {
  const region: MapLayoutRegion = { ...fields, id: uniqueHouseRegionId(map, "house"), role: "house" };
  map.layoutPlan ??= { version: 1, kind: "houses", regions: [] };
  map.layoutPlan.regions.push(region);
  const seals = completedInDraft.get(project) ?? [];
  seals.push(snapshotHouse(map, { source: "layout", id: region.id, rect: region, cells: regionCells(map, region) }));
  completedInDraft.set(project, seals);
}
function sameOwner(a: HouseSnapshot, b: HouseSnapshot): boolean {
  return a.mapId === b.mapId && a.source === b.source && a.id === b.id;
}
export function newlyBuiltHouseSnapshots(project: Project, before: readonly HouseSnapshot[]): HouseSnapshot[] {
  const seals = completedInDraft.get(project) ?? [];
  // Village registration is still at the end of its pipeline in Phase 1, not an internal early seal.
  return [...seals, ...captureHouseProtection(project).filter((house) =>
    !before.some((old) => sameOwner(old, house)) && !seals.some((seal) => sameOwner(seal, house)))];
}

export function assertHousePlacement(map: GameMap, bbox: Rect): void {
  const requested = new Set(houseFootprintCells(bbox, map).map(cellKey));
  for (const owner of ownerships(map)) {
    const overlap = owner.cells.find((cell) => requested.has(cellKey(cell)));
    if (overlap) throw new ToolError("완성된 집과 새 집 영역이 겹칩니다. 다른 위치를 선택하세요.", { code: "house-overlap", mapId: map.id, ...overlap });
  }
}

function sameStack(a: readonly number[] | undefined, b: readonly number[] | undefined): boolean {
  return a === undefined ? b === undefined : b !== undefined && a.length === b.length && a.every((tile, index) => tile === b[index]);
}
function containsRect(outer: Rect, inner: Rect): boolean {
  return outer.x <= inner.x && outer.y <= inner.y && outer.x + outer.w >= inner.x + inner.w && outer.y + outer.h >= inner.y + inner.h;
}
function rejectWrite(house: HouseSnapshot, cell?: Cell): never {
  throw new ToolError("완성된 집의 보호 영역은 AI가 변경할 수 없습니다. 집 밖에서 작업하세요. 직접 편집은 가능합니다.",
    { code: "protected-house-write", mapId: house.mapId, ...cell });
}

const EMPTY_KEYS: ReadonlySet<string> = new Set<string>();

/** sameOwner 와 같은 판정을 색인 키로 옮긴다. 이어 붙이면 맵·집 id 에 든 구분자가 두 짝을
 *  같은 키로 만들 수 있으므로 JSON 배열로 굳힌다. */
function ownerKey(house: HouseSnapshot): string {
  return JSON.stringify([house.mapId, house.source, house.id]);
}

/** 셀에서 바로 잰 경계 — rect 가 아니다. 지붕 데크 사다리처럼 rect 밖에 붙는 칸이 있다. */
type HouseIndex = { readonly keys: ReadonlySet<string>; readonly minX: number; readonly minY: number; readonly maxX: number; readonly maxY: number };
const EMPTY_INDEX: HouseIndex = { keys: EMPTY_KEYS, minX: 1, minY: 1, maxX: 0, maxY: 0 };

/** 스냅숏 하나의 셀 키 집합·경계 — 같은 집이 바깥·안쪽 루프에서 반복해 나오므로 한 번만 만든다. */
function houseIndexOf(cache: Map<HouseSnapshot, HouseIndex>, house: HouseSnapshot | undefined): HouseIndex {
  if (!house) return EMPTY_INDEX;
  const known = cache.get(house);
  if (known) return known;
  const keys = new Set<string>();
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const cell of house.cells) {
    keys.add(cellKey(cell));
    if (cell.x < minX) minX = cell.x;
    if (cell.y < minY) minY = cell.y;
    if (cell.x > maxX) maxX = cell.x;
    if (cell.y > maxY) maxY = cell.y;
  }
  const index: HouseIndex = { keys, minX, minY, maxX, maxY };
  cache.set(house, index);
  return index;
}

/** 경계가 안 닿으면 칸도 안 겹친다 — 마을 대부분의 짝이 여기서 끝난다. */
function boundsTouch(a: HouseIndex, b: HouseIndex): boolean {
  return a.minX <= b.maxX && b.minX <= a.maxX && a.minY <= b.maxY && b.minY <= a.maxY;
}

/**
 * Called after every global postprocessor, before commit (also for dry-run). No tool/selection/spec exemption.
 * 예외는 딱 하나: before 스냅숏의 집이 있던 맵 자체가 통째로 지워졌을 때다 — 셀 단위 보호의 대상이
 * 아니고, 맵 소멸은 시작맵 가드·무결성 왕복·(에디터) 맵 파괴 승인의 소관이다(2026-09-24 story r3).
 *
 * 마을 한 채를 지을 때마다 세 번 불린다(fences/decor/landscape). 예전에는 짝마다
 * `before.find(...)` 로 훑고 `new Set(...cells.map(cellKey))` 를 **안쪽 루프에서** 다시 만들어
 * 집 H채·칸 C개에 O(H²·C) 의 문자열을 찍었다 — 실프로젝트 「지역」 탭 열기 2.5 초 중 1.9 초가
 * 여기였다(2026-09-15 CPU 프로파일, output/evidence/db-tab-perf/profile-regions-after.txt).
 * 판정은 그대로 두고, 소유자 색인과 셀 키 집합을 한 번만 만들도록 끌어올렸다.
 */
export function assertHouseProtection(before: readonly HouseSnapshot[], project: Project, built: readonly HouseSnapshot[]): void {
  const after = captureHouseProtection(project);
  const keys = new Map<HouseSnapshot, HouseIndex>();
  const afterByOwner = new Map<string, HouseSnapshot[]>();
  for (const owner of after) {
    const bucket = afterByOwner.get(ownerKey(owner));
    if (bucket) bucket.push(owner);
    else afterByOwner.set(ownerKey(owner), [owner]);
  }
  const beforeByOwner = new Map<string, HouseSnapshot>();
  for (const old of before) if (!beforeByOwner.has(ownerKey(old))) beforeByOwner.set(ownerKey(old), old);

  for (const house of [...before, ...built]) {
    const map = project.maps[house.mapId];
    // 맵이 통째로 지워지면 집도 통째로 사라진다 — 셀 단위 보호의 대상이 아니다. 맵 삭제는
    // 시작맵 가드·무결성 왕복(performMapDeletion roundtrip)·(에디터) 파괴 승인의 소관이고,
    // 집 보호가 함께 물고 있으면 고아·중복 맵을 지우는 remove_map 이 막힌다
    // (2026-09-24 감성 스토리 r3: 같은 거부로 두 번 — 고아 맵 12개가 정리되지 못함).
    if (!map) continue;
    if (map.id !== house.mapId || map.tilesetId !== house.tilesetId || map.tileSize !== house.tileSize
      || map.width < house.width || map.height < house.height) rejectWrite(house);
    const owners = afterByOwner.get(ownerKey(house)) ?? [];
    const owner = owners[0];
    if (owners.length !== 1 || !owner || !containsRect(owner.rect, house.rect)) rejectWrite(house);
    const covered = houseIndexOf(keys, owner).keys;
    for (const cell of house.cells) {
      const index = cell.y * map.width + cell.x;
      if (!covered.has(cellKey(cell)) || map.lowerTiles[index] !== cell.lower || map.upperTiles[index] !== cell.upper
        || !sameStack(cell.lowerStack, map.lowerTileStacks?.[index]) || !sameStack(cell.upperStack, map.upperTileStacks?.[index])) rejectWrite(house, cell);
    }
  }
  for (const [index, house] of after.entries()) {
    const oldCells = houseIndexOf(keys, beforeByOwner.get(ownerKey(house))).keys;
    const mine = houseIndexOf(keys, house);
    for (let next = index + 1; next < after.length; next += 1) {
      const other = after[next]!;
      if (other.mapId !== house.mapId) continue;
      if (!boundsTouch(mine, houseIndexOf(keys, other))) continue;
      const oldOtherCells = houseIndexOf(keys, beforeByOwner.get(ownerKey(other))).keys;
      const overlap = other.cells.find((cell) => mine.keys.has(cellKey(cell))
        && (!oldCells.has(cellKey(cell)) || !oldOtherCells.has(cellKey(cell))));
      if (overlap) throw new ToolError("새 집의 보호 영역이 다른 완성된 집과 겹칩니다.", { code: "house-overlap", mapId: house.mapId, x: overlap.x, y: overlap.y });
    }
  }
}
