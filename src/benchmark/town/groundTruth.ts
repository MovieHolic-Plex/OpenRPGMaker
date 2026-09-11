// benchmark/town/groundTruth.ts
// combined_town 정답표 — 손으로 쓴 정답은 하나도 없다.
//
// 이 파일의 규칙: 정답은 **실제로 도는 엔진을 호출해서** 만든다.
//   오토타일   autotileVariantForMask × DEFAULT_ROAD_AUTOTILE_GROUP
//   벽/지붕    stampRectHouseKit (HOUSE_KITS 나인슬라이스·피라미드 문법)
//   문         village/houses.ts 규약 (하위 레이어에 상단 116 / 하단 146)
//   울타리     placeHouseLotFences (둘레 문법 + 모서리 강등 로직 포함)
//   길/광장    DEFAULT_ROAD/COBBLE_AUTOTILE_GROUP
//   통행성·레이어  defaultTilesets()[easyrpg_chipset_combined_town]
//
// 그래서 엔진 문법이 바뀌면 정답이 같이 바뀌고, 옛 점수는 매니페스트 해시가
// 달라져 자동으로 비교 대상에서 빠진다. 픽스처 기하가 엔진 제약을 어기면
// 여기서 즉시 throw 한다 — 조용히 어긋난 정답으로 채점하는 것이 최악이다.

import { deriveTreePairs } from "@/benchmark/groundTruth";
import { HOUSE_KITS, stampRectHouseKit, type HouseKitId, type RectHousePlan } from "@/editor/houseKit";
import { placeHouseLotFences } from "@/editor/tools/village/fences";
import {
  BANNED_STONE_TILES,
  DOOR_BOTTOM_TILE,
  DOOR_TOP_TILE,
  type BuiltHouse,
  type Rect,
} from "@/editor/tools/village/constants";
import {
  autotileNeighborMask,
  autotileVariantForMask,
} from "@/project/defaults/autotileEngine";
import {
  DEFAULT_COBBLE_AUTOTILE_GROUP,
  DEFAULT_ROAD_AUTOTILE_GROUP,
} from "@/project/defaults/autotileGroups";
import { COBBLE_TILE, DIRT_ROAD_TILE } from "@/project/defaults/chipsetMapping";
import { TILE } from "@/project/defaults/constants";
import { defaultTilesets } from "@/project/defaults/defaultAssets";
import { COMBINED_TOWN_TILE_SEMANTICS } from "@/project/defaults/tileSemanticsCombinedTown";
import type { AutotileGroup, GameMap, PassFlag, TilesetDef } from "@/project/types";
import { digestOf } from "../interior/hash";
import {
  ROOF_GRID,
  AUTOTILE_EXPECTED_ROLE_COUNTS,
  AUTOTILE_SHAPE_HEIGHT,
  AUTOTILE_SHAPE_WIDTH,
  autotileShapeCells,
  DOOR_GRID,
  FENCE_GRID,
  LAYER_PROBE_TILES,
  PASSABILITY_PROBE_TILES,
  ROAD_GRID,
  TREE_GRID,
  VILLAGE_GRID,
  WALL_GRID,
  WALL_PROBE_TILES,
  WALL_PROBE_TRAPS,
  type FixtureHousePlan,
} from "./fixtures";
import {
  EMPTY_CELL,
  TOWN_TILE_COUNT,
  TOWN_TILESET_ID,
  type AutotileCell,
  type AutotileReference,
  type AutotileRole,
  type PlacementReference,
  type TownGroundTruth,
  type TownPlacementKey,
  type TownProbeSet,
} from "./types";

// ── 공용 헬퍼 ─────────────────────────────────────────────────────────────

function freezeSet(values: Iterable<number>): ReadonlySet<number> {
  const sorted = [...new Set(values)].sort((a, b) => a - b);
  for (const id of sorted) {
    if (!Number.isInteger(id) || id < 0 || id >= TOWN_TILE_COUNT) {
      throw new Error(`town groundTruth: 타일 id 범위 초과 — ${id} (허용 0..${TOWN_TILE_COUNT - 1})`);
    }
  }
  return Object.freeze(new Set<number>(sorted));
}

function isSolid(flag: PassFlag): boolean {
  return !flag.up && !flag.down && !flag.left && !flag.right;
}

function townTileset(): TilesetDef {
  const tileset = defaultTilesets()[TOWN_TILESET_ID];
  if (!tileset) throw new Error(`town groundTruth: 타일셋 ${TOWN_TILESET_ID} 없음`);
  if (tileset.count !== TOWN_TILE_COUNT) {
    throw new Error(`town groundTruth: 타일 수 불일치 — ${tileset.count} (기대 ${TOWN_TILE_COUNT})`);
  }
  return tileset;
}

/**
 * 스탬퍼가 쓸 수 있는 최소 GameMap. 두 레이어를 EMPTY 로 채운다 — 스탬퍼는
 * upperIfEmpty 로 "빈 칸에만" 상위를 얹으므로 초기값이 EMPTY 여야 문법이 산다.
 */
function blankMap(width: number, height: number): GameMap {
  return {
    id: "bench_town",
    name: "town-bench",
    width,
    height,
    tilesetId: TOWN_TILESET_ID,
    tileSize: 16,
    lowerTiles: new Array<number>(width * height).fill(TILE.EMPTY),
    upperTiles: new Array<number>(width * height).fill(TILE.EMPTY),
    events: [],
  };
}

const EMPTY_GRID = (width: number, height: number): number[] =>
  new Array<number>(width * height).fill(EMPTY_CELL);

function toPlanRect(plan: FixtureHousePlan, height: number): Rect {
  return { x: plan.x, y: plan.y, w: plan.width, h: height };
}

function rectHousePlan(plan: FixtureHousePlan): RectHousePlan {
  return {
    x: plan.x,
    y: plan.y,
    width: plan.width,
    stories: plan.stories,
    roofBodyRows: plan.roofBodyRows,
    kitId: plan.kitId,
    lowWall: plan.lowWall,
    windows: plan.windows ?? false,
  };
}

/** 집 한 채를 실제 스탬퍼로 찍는다. 거부되면 픽스처 기하가 틀린 것이므로 즉시 throw. */
function stampHouse(
  map: GameMap,
  plan: FixtureHousePlan,
  label: string,
): { readonly doorAt: { readonly x: number; readonly y: number }; readonly height: number } {
  const result = stampRectHouseKit(map, rectHousePlan(plan));
  if (!result.ok || !result.doorAt || result.height === undefined) {
    throw new Error(`town groundTruth: ${label} 스탬프 실패 — ${result.reason ?? "이유 미보고"}`);
  }
  return { doorAt: result.doorAt, height: result.height };
}

// ── 프로브 정답 ───────────────────────────────────────────────────────────

function passabilityProbe(passability: readonly PassFlag[]): TownProbeSet {
  const positives: number[] = [];
  const traps: number[] = [];
  for (const tile of PASSABILITY_PROBE_TILES) {
    const flag = passability[tile];
    if (!flag) throw new Error(`town groundTruth: 통행성 프로브 타일 ${tile} 의 passFlag 없음`);
    if (!isSolid(flag)) positives.push(tile);
    // 함정: 바닥/석축처럼 평평해 보이는데 통행 불가인 타일(constants.ts 경고 대상).
    else if (tile === TILE.FLOOR || tile === TILE.STAIRS || tile === TILE.WALL) traps.push(tile);
  }
  if (positives.length === 0 || positives.length === PASSABILITY_PROBE_TILES.length) {
    throw new Error("town groundTruth: 통행성 프로브가 한쪽으로 쏠렸다 — 균형 정확도가 무의미해진다");
  }
  return Object.freeze({
    probes: Object.freeze([...PASSABILITY_PROBE_TILES]),
    positives: freezeSet(positives),
    traps: freezeSet(traps),
    source: "defaultTilesets().easyrpg_chipset_combined_town.passability (통행 가능 = 4방향 중 하나라도 열림)",
  });
}

function layerProbe(priority: readonly ("lower" | "upper")[]): TownProbeSet {
  const positives: number[] = [];
  for (const tile of LAYER_PROBE_TILES) {
    const value = priority[tile];
    if (!value) throw new Error(`town groundTruth: 레이어 프로브 타일 ${tile} 의 priority 없음`);
    if (value === "upper") positives.push(tile);
  }
  if (positives.length === 0 || positives.length === LAYER_PROBE_TILES.length) {
    throw new Error("town groundTruth: 레이어 프로브가 한쪽으로 쏠렸다");
  }
  return Object.freeze({
    probes: Object.freeze([...LAYER_PROBE_TILES]),
    positives: freezeSet(positives),
    // 나무 캐노피(상위)와 줄기(하위)가 같은 나무의 위아래라는 것이 이 프로브의 함정이다.
    traps: freezeSet([290, 291, 404, 405]),
    source: "defaultTilesets().easyrpg_chipset_combined_town.priority === upper",
  });
}

/** 집 벽면 = 모든 키트의 벽 나인슬라이스 ∪ TILE.WALL. 프로브 목록과 교집합만 쓴다. */
function wallProbe(): TownProbeSet {
  const wallFaces = new Set<number>([TILE.WALL]);
  for (const kit of Object.values(HOUSE_KITS)) {
    for (const slice of [kit.wall.top, kit.wall.mid, kit.wall.bottom]) {
      for (const tile of slice) wallFaces.add(tile);
    }
  }
  const positives: number[] = [];
  for (const tile of WALL_PROBE_TILES) if (wallFaces.has(tile)) positives.push(tile);
  const traps = freezeSet(WALL_PROBE_TRAPS);
  // 교차 검증: 명시 함정 목록과 파생 정답이 겹치면 둘 중 하나가 틀린 것이다.
  for (const trap of traps) {
    if (wallFaces.has(trap)) {
      throw new Error(`town groundTruth: 벽 프로브 함정 ${trap} 이 키트 벽 나인슬라이스에도 있다`);
    }
  }
  if (positives.length + traps.size !== WALL_PROBE_TILES.length) {
    throw new Error(
      `town groundTruth: 벽 프로브 분류 누락 — 정답 ${positives.length} + 함정 ${traps.size} ≠ ${WALL_PROBE_TILES.length}`,
    );
  }
  return Object.freeze({
    probes: Object.freeze([...WALL_PROBE_TILES]),
    positives: freezeSet(positives),
    traps,
    source: "houseKit.HOUSE_KITS[*].wall.{top,mid,bottom} ∪ TILE.WALL",
  });
}

// ── 1번 오토타일 정답 ─────────────────────────────────────────────────────

/** 역할 타일 → 역할 이름. 흙길 11역할은 서로 다른 id 라 역방향 조회가 성립한다. */
function roadRoleByTile(): ReadonlyMap<number, AutotileRole> {
  const entries: readonly [number, AutotileRole][] = [
    [DIRT_ROAD_TILE.BODY, "body"],
    [DIRT_ROAD_TILE.EDGE_NORTH, "edgeN"],
    [DIRT_ROAD_TILE.EDGE_SOUTH, "edgeS"],
    [DIRT_ROAD_TILE.EDGE_WEST, "edgeW"],
    [DIRT_ROAD_TILE.EDGE_EAST, "edgeE"],
    [DIRT_ROAD_TILE.CORNER_NORTH_WEST, "cornerNW"],
    [DIRT_ROAD_TILE.CORNER_NORTH_EAST, "cornerNE"],
    [DIRT_ROAD_TILE.CORNER_SOUTH_WEST, "cornerSW"],
    [DIRT_ROAD_TILE.CORNER_SOUTH_EAST, "cornerSE"],
    [DIRT_ROAD_TILE.ISOLATED, "isolated"],
    [DIRT_ROAD_TILE.INNER_CORNER, "inner"],
  ];
  const map = new Map<number, AutotileRole>(entries);
  if (map.size !== entries.length) {
    throw new Error("town groundTruth: 흙길 역할 타일에 중복 id 가 있다 — 역할 역방향 조회가 깨진다");
  }
  return map;
}

function roadBlock(): Readonly<Record<AutotileRole, number>> {
  return Object.freeze({
    body: DIRT_ROAD_TILE.BODY,
    edgeN: DIRT_ROAD_TILE.EDGE_NORTH,
    edgeS: DIRT_ROAD_TILE.EDGE_SOUTH,
    edgeW: DIRT_ROAD_TILE.EDGE_WEST,
    edgeE: DIRT_ROAD_TILE.EDGE_EAST,
    cornerNW: DIRT_ROAD_TILE.CORNER_NORTH_WEST,
    cornerNE: DIRT_ROAD_TILE.CORNER_NORTH_EAST,
    cornerSW: DIRT_ROAD_TILE.CORNER_SOUTH_WEST,
    cornerSE: DIRT_ROAD_TILE.CORNER_SOUTH_EAST,
    inner: DIRT_ROAD_TILE.INNER_CORNER,
    isolated: DIRT_ROAD_TILE.ISOLATED,
  });
}

/**
 * 마킹된 칸 집합을 그룹 몸통 타일로 칠한 뒤, 칸마다 이웃 마스크를 읽어 변형
 * 타일을 결정한다. shapeAutotileGroupAround 를 쓰지 않는 이유는 방문 순서 의존을
 * 없애기 위해서다 — 여기서는 "칠하기 전 집합"만 보고 전부 한 번에 결정한다.
 */
function shapeGroupOverCells(
  width: number,
  height: number,
  cells: readonly { readonly x: number; readonly y: number }[],
  group: AutotileGroup,
  bodyTile: number,
): Map<number, number> {
  const canvas = blankMap(width, height);
  for (const cell of cells) canvas.lowerTiles[cell.y * width + cell.x] = bodyTile;
  const connect = new Set<number>(group.connectTileIds ?? group.memberTileIds);
  const shaped = new Map<number, number>();
  for (const cell of cells) {
    const mask = autotileNeighborMask(
      canvas,
      cell.x,
      cell.y,
      (tile) => connect.has(tile),
      group.neighborhood ?? 4,
    );
    const variant = autotileVariantForMask(group, mask);
    if (variant === undefined) {
      throw new Error(`town groundTruth: ${group.id} 마스크 ${mask} 에 대응하는 변형 타일이 없다`);
    }
    shaped.set(cell.y * width + cell.x, variant);
  }
  return shaped;
}

function buildAutotileReference(): AutotileReference {
  const width = AUTOTILE_SHAPE_WIDTH;
  const height = AUTOTILE_SHAPE_HEIGHT;
  const shape = autotileShapeCells();
  const cells = shape.map((index) => ({ x: index % width, y: Math.floor(index / width) }));
  const shaped = shapeGroupOverCells(width, height, cells, DEFAULT_ROAD_AUTOTILE_GROUP, DIRT_ROAD_TILE.BODY);
  const roleByTile = roadRoleByTile();

  const answer: AutotileCell[] = [];
  const roleCounts: Record<string, number> = {};
  for (const index of shape) {
    const tile = shaped.get(index);
    if (tile === undefined) throw new Error(`town groundTruth: 오토타일 칸 ${index} 의 정답이 비었다`);
    const role = roleByTile.get(tile);
    if (!role) {
      throw new Error(`town groundTruth: 오토타일 결과 ${tile} 이 11역할 중 어느 것도 아니다`);
    }
    roleCounts[role] = (roleCounts[role] ?? 0) + 1;
    answer.push(Object.freeze({ x: index % width, y: Math.floor(index / width), tile, role }));
  }

  // 도형이 11역할을 전부 만드는지 — 픽스처 주석의 실측 분포와 대조한다. 어긋나면
  // 엔진 문법이 바뀐 것이고, 그때는 도형을 다시 고르거나 주석을 갱신해야 한다.
  for (const [role, expected] of Object.entries(AUTOTILE_EXPECTED_ROLE_COUNTS)) {
    const actual = roleCounts[role] ?? 0;
    if (actual !== expected) {
      throw new Error(
        `town groundTruth: 오토타일 역할 분포 불일치 — ${role} ${actual}개 (기대 ${expected}개). ` +
          `엔진 문법이 바뀌었거나 도형이 바뀌었다.`,
      );
    }
  }

  return Object.freeze({
    width,
    height,
    shape: Object.freeze([...shape]),
    cells: Object.freeze(answer),
    block: roadBlock(),
    groupId: DEFAULT_ROAD_AUTOTILE_GROUP.id,
  });
}

// ── 3번~9번 배치 정답 ─────────────────────────────────────────────────────

function placement(
  key: TownPlacementKey,
  width: number,
  height: number,
  lower: readonly number[],
  upper: readonly number[],
  baseLower: readonly number[],
  baseUpper: readonly number[],
  source: string,
): PlacementReference {
  for (const [name, grid] of [["lower", lower], ["upper", upper], ["baseLower", baseLower], ["baseUpper", baseUpper]] as const) {
    if (grid.length !== width * height) {
      throw new Error(`town groundTruth: ${key}.${name} 길이 ${grid.length} ≠ ${width * height}`);
    }
  }
  return Object.freeze({
    key,
    width,
    height,
    lower: Object.freeze([...lower]),
    upper: Object.freeze([...upper]),
    baseLower: Object.freeze([...baseLower]),
    baseUpper: Object.freeze([...baseUpper]),
    source,
  });
}

function treePlacement(): PlacementReference {
  const { width, height, spots } = TREE_GRID;
  const pairs = deriveTreePairs();
  const pair = pairs[0];
  if (!pair) throw new Error("town groundTruth: TREE_PAIRS 가 비었다");
  const [canopy, trunk] = pair;
  const lower = EMPTY_GRID(width, height);
  const upper = EMPTY_GRID(width, height);
  for (const spot of spots) {
    const index = spot.y * width + spot.x;
    lower[index] = trunk;
    upper[index] = canopy;
  }
  return placement(
    "treeGrid",
    width,
    height,
    lower,
    upper,
    EMPTY_GRID(width, height),
    EMPTY_GRID(width, height),
    // 수종은 임의다(정본은 침엽 하나로 통일). 3번 채점은 "줄기=하위 / 같은 나무의
    // 캐노피=상위" 라는 쌍 규칙으로 하고, 정본과의 칸 일치는 참고 수치로만 낸다.
    "benchmark/groundTruth.deriveTreePairs()[0] — 수종 무관 쌍 규칙으로 채점",
  );
}

function roadPlacement(): PlacementReference {
  const { width, height, canonicalCells } = ROAD_GRID;
  const shaped = shapeGroupOverCells(
    width,
    height,
    canonicalCells,
    DEFAULT_ROAD_AUTOTILE_GROUP,
    DIRT_ROAD_TILE.BODY,
  );
  const lower = EMPTY_GRID(width, height);
  for (const [index, tile] of shaped) lower[index] = tile;
  return placement(
    "roadGrid",
    width,
    height,
    lower,
    EMPTY_GRID(width, height),
    EMPTY_GRID(width, height),
    EMPTY_GRID(width, height),
    "DEFAULT_ROAD_AUTOTILE_GROUP × 정본 경로(fixtures.ROAD_GRID.canonicalCells)",
  );
}

function shellHousePlacement(): { readonly reference: PlacementReference; readonly doorAt: { x: number; y: number } } {
  const { width, height, house } = WALL_GRID;
  const map = blankMap(width, height);
  const { doorAt, height: houseHeight } = stampHouse(map, house, "wallGrid 집");
  if (houseHeight !== house.width) {
    // 폭 6 · 1층 · 몸통 1행이면 높이도 6 이다. 여기서 어긋나면 픽스처를 다시 잡아야 한다.
    throw new Error(`town groundTruth: wallGrid 집 높이 ${houseHeight} (기대 ${house.width})`);
  }
  return {
    reference: placement(
      "wallGrid",
      width,
      height,
      map.lowerTiles,
      map.upperTiles,
      EMPTY_GRID(width, height),
      EMPTY_GRID(width, height),
      `stampRectHouseKit(${house.kitId}, 폭 ${house.width}, ${house.stories}층)`,
    ),
    doorAt: { x: doorAt.x, y: doorAt.y },
  };
}

function roofPlacement(): PlacementReference {
  const { width, height, house } = ROOF_GRID;
  const map = blankMap(width, height);
  stampHouse(map, house, "roofGrid 집");
  return placement(
    "roofGrid",
    width,
    height,
    map.lowerTiles,
    map.upperTiles,
    EMPTY_GRID(width, height),
    EMPTY_GRID(width, height),
    `stampRectHouseKit(${house.kitId}, 폭 ${house.width}, 지붕 몸통 ${house.roofBodyRows}행)`,
  );
}

function doorPlacement(base: PlacementReference, doorAt: { readonly x: number; readonly y: number }): PlacementReference {
  const { width, height } = DOOR_GRID;
  if (doorAt.x !== DOOR_GRID.doorAt.x || doorAt.y !== DOOR_GRID.doorAt.y) {
    throw new Error(
      `town groundTruth: 문 자리 불일치 — 스탬퍼 (${doorAt.x},${doorAt.y}) vs 픽스처 (${DOOR_GRID.doorAt.x},${DOOR_GRID.doorAt.y})`,
    );
  }
  const lower = EMPTY_GRID(width, height);
  lower[(doorAt.y - 1) * width + doorAt.x] = DOOR_TOP_TILE;
  lower[doorAt.y * width + doorAt.x] = DOOR_BOTTOM_TILE;
  return placement(
    "doorGrid",
    width,
    height,
    lower,
    EMPTY_GRID(width, height),
    base.lower,
    base.upper,
    "village/houses.ts 문 규약 — 하위 레이어 상단 116 / 하단 146",
  );
}

function builtHouse(plan: FixtureHousePlan, houseHeight: number, doorAt: { readonly x: number; readonly y: number }): BuiltHouse {
  return {
    bbox: toPlanRect(plan, houseHeight),
    doorAt: { x: doorAt.x, y: doorAt.y },
    front: { x: doorAt.x, y: doorAt.y + 1 },
    kitId: plan.kitId as HouseKitId,
    stories: plan.stories,
    // estate 로 시작하면 둘레 전체를 두르는 다른 분기가 돈다 — 일반 필지 문법을 쓴다.
    templateId: "rect",
  };
}

function fencePlacement(base: PlacementReference): PlacementReference {
  const { width, height, house, seed, houseIndex } = FENCE_GRID;
  if (houseIndex !== 0) {
    throw new Error("town groundTruth: placeHouseLotFences 는 배열 인덱스를 seed 로 쓰므로 houseIndex 는 0 이어야 한다");
  }
  const map = blankMap(width, height);
  // 집을 먼저 세운다 — 울타리 문법이 "이미 얹힌 칸은 덮지 않는다"를 판단하려면
  // 지붕 캡(상위)이 실제로 놓여 있어야 한다.
  const { doorAt, height: houseHeight } = stampHouse(map, house, "fenceGrid 집");
  const before = [...map.upperTiles];
  placeHouseLotFences(map, [builtHouse(house, houseHeight, doorAt)], seed);

  const upper = EMPTY_GRID(width, height);
  let placed = 0;
  for (let index = 0; index < map.upperTiles.length; index += 1) {
    if (map.upperTiles[index] === before[index]) continue;
    upper[index] = map.upperTiles[index]!;
    placed += 1;
  }
  if (placed === 0) throw new Error("town groundTruth: fenceGrid 정본에 울타리가 한 칸도 놓이지 않았다");
  return placement(
    "fenceGrid",
    width,
    height,
    EMPTY_GRID(width, height),
    upper,
    base.lower,
    base.upper,
    `placeHouseLotFences(seed=${seed}) — 필지 = bbox + ${1}칸`,
  );
}

function villagePlacement(): PlacementReference {
  const { width, height, houses, plaza, roadRow, seed } = VILLAGE_GRID;
  const map = blankMap(width, height);

  // 1) 집 3채 + 문.
  const built: BuiltHouse[] = [];
  for (let index = 0; index < houses.length; index += 1) {
    const plan = houses[index]!;
    const { doorAt, height: houseHeight } = stampHouse(map, plan, `villageGrid 집 ${index}`);
    map.lowerTiles[(doorAt.y - 1) * width + doorAt.x] = DOOR_TOP_TILE;
    map.lowerTiles[doorAt.y * width + doorAt.x] = DOOR_BOTTOM_TILE;
    built.push(builtHouse(plan, houseHeight, doorAt));
  }

  // 2) 대로(흙길) — 한 줄 전폭. 문 앞에서 남쪽 3칸 안이라 doorHasRoad 를 만족한다.
  const roadCells = Array.from({ length: width }, (_unused, x) => ({ x, y: roadRow }));
  for (const [index, tile] of shapeGroupOverCells(width, height, roadCells, DEFAULT_ROAD_AUTOTILE_GROUP, DIRT_ROAD_TILE.BODY)) {
    map.lowerTiles[index] = tile;
  }

  // 3) 광장(포석) — 대로에 맞닿게 깔아 같은 도로 성분이 되게 한다.
  const plazaCells: { x: number; y: number }[] = [];
  for (let y = plaza.y; y < plaza.y + plaza.h; y += 1) {
    for (let x = plaza.x; x < plaza.x + plaza.w; x += 1) plazaCells.push({ x, y });
  }
  for (const [index, tile] of shapeGroupOverCells(width, height, plazaCells, DEFAULT_COBBLE_AUTOTILE_GROUP, COBBLE_TILE.BODY)) {
    map.lowerTiles[index] = tile;
  }

  // 4) 필지 울타리 — 길 위·이미 채워진 상위 칸은 엔진이 알아서 피한다.
  placeHouseLotFences(map, built, seed);

  return placement(
    "villageGrid",
    width,
    height,
    map.lowerTiles,
    map.upperTiles,
    EMPTY_GRID(width, height),
    EMPTY_GRID(width, height),
    "stampRectHouseKit×3 + 문 규약 + 흙길/포석 오토타일 + placeHouseLotFences",
  );
}

/**
 * 전역 금지 타일. `BANNED_STONE_TILES`(411/412/413/443)만 보면 **감독이 2026-07-17 에
 * 전역 밴한 바위 441/442 를 놓친다** — 그 밴은 상수가 아니라 시맨틱 테이블의
 * 라벨("바위(사용 금지)")과 `banned` 태그로만 표현돼 있다(칩셋 보고서 §08).
 * 그래서 태그에서 파생하고 상수와 합집합을 취한다. 대체재는 석상(266/296)·돌기둥(267/297).
 */
function bannedTiles(): ReadonlySet<number> {
  const tagged = COMBINED_TOWN_TILE_SEMANTICS.filter((entry) => entry.tags.includes("banned")).map(
    (entry) => entry.index,
  );
  if (tagged.length === 0) {
    throw new Error("town groundTruth: 시맨틱 테이블에 banned 태그가 하나도 없다 — 밴 목록 파생이 깨졌다");
  }
  return freezeSet([...tagged, ...BANNED_STONE_TILES]);
}

// ── 조립 ──────────────────────────────────────────────────────────────────

export function buildTownGroundTruth(): TownGroundTruth {
  const tileset = townTileset();
  const passFlags = tileset.passability;
  const priority = tileset.priority;

  const shell = shellHousePlacement();
  const placements: Record<TownPlacementKey, PlacementReference> = {
    treeGrid: treePlacement(),
    roadGrid: roadPlacement(),
    wallGrid: shell.reference,
    roofGrid: roofPlacement(),
    doorGrid: doorPlacement(shell.reference, shell.doorAt),
    fenceGrid: fencePlacement(shell.reference),
    villageGrid: villagePlacement(),
  };

  const wall = wallProbe();
  const passability = passabilityProbe(passFlags);
  const layer = layerProbe(priority);
  const autotile = buildAutotileReference();
  const banned = bannedTiles();

  const digest = digestOf({
    wall,
    passability,
    layer,
    autotile,
    placements,
    banned,
    // 통행성·레이어 테이블 전체를 해시에 넣는다 — 타일셋 시드가 바뀌면 4·9번의
    // 구조 채점 결과가 달라지므로 옛 점수와 섞이면 안 된다.
    passFlags: passFlags.map((flag) => (isSolid(flag) ? 0 : 1)),
    priority: priority.map((value) => (value === "upper" ? 1 : 0)),
  });

  return Object.freeze({
    wall,
    passability,
    layer,
    autotile,
    placements: Object.freeze(placements),
    passFlags: Object.freeze(passFlags.map((flag) => Object.freeze({ ...flag }))),
    priority: Object.freeze([...priority]),
    banned,
    digest,
  });
}
