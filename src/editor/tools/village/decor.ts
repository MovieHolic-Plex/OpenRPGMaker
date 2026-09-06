// editor/tools/village/decor.ts
// 마을 소품 레이어 — 마당 꾸밈, 길 옆 벤치, 우물, 깃발, 바위 노두, 활엽수 군락, place_props 위임.

import { HOUSE_KITS } from "@/editor/houseKit";
import { COBBLE_TILE } from "@/project/defaults/chipsetMapping";
import { shapeAutotileGroupAround } from "@/project/defaults/autotileEngine";
import { DEFAULT_COBBLE_AUTOTILE_GROUP } from "@/project/defaults/autotileGroups";
import { protectedHouseCells } from "../houseProtection";
import { TILE } from "@/project/defaults/constants";
import type { GameMap, Project } from "@/project/types";
import { mulberry32, type Rng } from "@/util/rng";
import {
  DEFAULT_FOREST_DENSITY,
  forestPackingFor,
  forestPlacementPlan,
  treeFootprintCells,
} from "../forestDensity";
import { inMapBounds } from "../mapHelpers";
import {
  materialForYardDecor,
  yardAreaForHouse,
  yardScatterParams,
  type YardDecorKind,
} from "../houseLotDecor";
import { CONSTRUCTION_TOOLS_V3 } from "../v3";
import {
  coordKey,
  expandRect,
  pointInRect,
  rectsOverlap,
  requireTool,
  ROAD_TILES,
  runNested,
  shuffled,
  YARD_STYLE_POOLS,
  type BuiltHouse,
  type Plaza,
  type Point,
  type Rect,
  type VillageIntent,
} from "./constants";
import { houseBlockedCells } from "./houses";
import { paintFlowerField, paintPlazaFence, placeMarketDeckProps } from "./plaza";
import { paintPlazaGatePath } from "./roads";

const placePropsTool = requireTool(CONSTRUCTION_TOOLS_V3, "place_props");

/** 마을 전역 나무 산포가 가질 밀도 지분 — 남은 밀도는 숲 밴드(terrainPass)가 채운다. */
const INTERIOR_TREE_SHARE = 0.25;

/** 클러스터(나란히 무리) 배치 대상 소품 → 타일 id. 전부 combined_town 단독 소품. */
const CLUSTER_PROP_TILES: Partial<Record<YardDecorKind, number>> = {
  wood_box: 237,
  barrel: 177,
  jar: 352,
  firewood: 349,
};

/**
 * 마당 소품 클러스터 — 상자·통·항아리류를 2~3칸 가로로 나란히 붙여 "생활의 무리"를 만든다.
 * (참조 맵 문법 L5: 소품은 점이 아니라 무리.)
 */
function placeYardCluster(
  map: GameMap,
  yardArea: Rect,
  kinds: readonly YardDecorKind[],
  front: Point,
  rng: Rng,
): number {
  const blocked = new Set(protectedHouseCells(map).map(({ x, y }) => coordKey(x, y)));
  const tiles = kinds
    .map((kind) => CLUSTER_PROP_TILES[kind])
    .filter((tile): tile is number => typeof tile === "number")
    .slice(0, 3);
  if (tiles.length < 2) return 0;
  const freeGrass = (x: number, y: number): boolean =>
    inMapBounds(map, x, y)
    && !blocked.has(coordKey(x, y))
    // 문 앞(transfer 목적지)과 게이트 3칸은 절대 막지 않는다.
    && !(y === front.y && Math.abs(x - front.x) <= 1)
    && (map.lowerTiles[y * map.width + x] ?? TILE.EMPTY) === TILE.GRASS
    && (map.upperTiles[y * map.width + x] ?? TILE.EMPTY) === TILE.EMPTY;
  // 마당 안에서 가로 연속 빈 런을 찾는다 — 시작점은 rng로 셔플.
  const anchors: Point[] = [];
  for (let y = yardArea.y; y < yardArea.y + yardArea.h; y += 1) {
    for (let x = yardArea.x; x <= yardArea.x + yardArea.w - tiles.length; x += 1) {
      anchors.push({ x, y });
    }
  }
  for (const anchor of shuffled(anchors, rng)) {
    let ok = true;
    for (let i = 0; i < tiles.length && ok; i += 1) {
      if (!freeGrass(anchor.x + i, anchor.y)) ok = false;
    }
    if (!ok) continue;
    for (let i = 0; i < tiles.length; i += 1) {
      map.upperTiles[anchor.y * map.width + anchor.x + i] = tiles[i]!;
    }
    return tiles.length;
  }
  return 0;
}

/**
 * 꽃덤불 링 — 집 옆 벽 아래 자투리 잔디의 2×2에 꽃덤불(288)+덤불(289)을 격자로 섞고
 * 둘레에 꽃잎(348)을 한두 장 흘린다 (참조 맵 문법 L4: 꽃은 흩뿌림이 아니라 클러스터).
 */
function placeFlowerRings(map: GameMap, houses: readonly BuiltHouse[], seed: number, area: Rect): number {
  const rng = mulberry32((seed ^ 0x85ebca6b) >>> 0);
  const blocked = houseBlockedCells(houses, map);
  const freeGrass = (x: number, y: number): boolean =>
    inMapBounds(map, x, y)
    && pointInRect({ x, y }, area)
    && (map.lowerTiles[y * map.width + x] ?? TILE.EMPTY) === TILE.GRASS
    && (map.upperTiles[y * map.width + x] ?? TILE.EMPTY) === TILE.EMPTY
    && !blocked.has(coordKey(x, y));
  let rings = 0;
  for (const house of shuffled([...houses], rng)) {
    if (rings >= 2) break;
    // 후보: 집 좌/우 벽 옆 1칸 떨어진 2×2 (벽 밑 자투리 화단 느낌)
    const wallMidY = house.bbox.y + Math.floor(house.bbox.h * 0.6);
    for (const anchorX of [house.bbox.x - 3, house.bbox.x + house.bbox.w + 1]) {
      const cells = [
        { x: anchorX, y: wallMidY },
        { x: anchorX + 1, y: wallMidY },
        { x: anchorX, y: wallMidY + 1 },
        { x: anchorX + 1, y: wallMidY + 1 },
      ];
      if (!cells.every((cell) => freeGrass(cell.x, cell.y))) continue;
      map.upperTiles[cells[0]!.y * map.width + cells[0]!.x] = 288;
      map.upperTiles[cells[1]!.y * map.width + cells[1]!.x] = 289;
      map.upperTiles[cells[2]!.y * map.width + cells[2]!.x] = 289;
      map.upperTiles[cells[3]!.y * map.width + cells[3]!.x] = 288;
      // 둘레 꽃잎 1~2장
      for (const petal of [{ x: anchorX - 1, y: wallMidY + 1 }, { x: anchorX + 2, y: wallMidY }]) {
        if (freeGrass(petal.x, petal.y) && rng() < 0.7) {
          map.upperTiles[petal.y * map.width + petal.x] = 348;
        }
      }
      rings += 1;
      break;
    }
  }
  return rings * 4;
}

/** 돌마당 토핑 — 돌 위에 덤불(289)을 드물게 얹어 "오래된 마당" 표정 (참조 맵 문법 L1). */
export function placeStoneToppings(
  map: GameMap,
  area: Rect,
  houses: readonly BuiltHouse[],
  seed: number,
): number {
  const rng = mulberry32((seed ^ 0x51ed2701) >>> 0);
  // 문 앞(transfer 목적지)과 그 옆 게이트 칸은 절대 막지 않는다.
  const protectedCells = houseBlockedCells(houses, map);
  for (const house of houses) {
    for (let dx = -1; dx <= 1; dx += 1) protectedCells.add(coordKey(house.front.x + dx, house.front.y));
  }
  const stoneCells: Point[] = [];
  for (let y = area.y; y < area.y + area.h; y += 1) {
    for (let x = area.x; x < area.x + area.w; x += 1) {
      const index = y * map.width + x;
      if (protectedCells.has(coordKey(x, y))) continue;
      if ((map.lowerTiles[index] ?? TILE.EMPTY) === COBBLE_TILE.BODY && (map.upperTiles[index] ?? TILE.EMPTY) === TILE.EMPTY) {
        stoneCells.push({ x, y });
      }
    }
  }
  let placed = 0;
  for (const cell of shuffled(stoneCells, rng)) {
    if (placed >= 3) break;
    map.upperTiles[cell.y * map.width + cell.x] = 289;
    placed += 1;
  }
  return placed;
}

/**
 * 마을 소품 레이어.
 * LLM 의도(intent.houseYards / yardStyle / plazaStyle / edgeTrees) → place_props 좌표는 코드.
 */
export function placeVillageDecor(
  draft: Project,
  map: GameMap,
  area: Rect,
  plaza: Plaza,
  houses: readonly BuiltHouse[],
  seed: number,
  intent: VillageIntent,
  warnings: string[]
): number {
  const blocked = houseBlockedCells(houses, map);
  let placed = 0;
  const pool = YARD_STYLE_POOLS[intent.yardStyle];
  for (let i = 0; i < houses.length; i += 1) {
    const house = houses[i] as BuiltHouse;
    const fromPlan = intent.houseYards[i];
    const theme = (fromPlan && fromPlan.length > 0
      ? fromPlan
      : pool[i % pool.length]) as readonly YardDecorKind[];
    const yardArea = intersectRects(
      yardAreaForHouse(
        map,
        [{ x: house.bbox.x, y: house.bbox.y, w: house.bbox.w, h: house.bbox.h }],
        house.doorAt,
        { depth: 3, pad: 1 },
      ),
      area,
    );
    if (!yardArea) continue;
    // 소품은 점이 아니라 "무리" (참조 맵 문법 L5): 상자류 2개 이상이면 나란히 붙여 클러스터로.
    const clusterKinds = theme.filter((kind) => CLUSTER_PROP_TILES[kind] !== undefined);
    const scatterKinds = theme.filter((kind) => CLUSTER_PROP_TILES[kind] === undefined);
    if (clusterKinds.length >= 2) {
      placed += placeYardCluster(map, yardArea, clusterKinds, house.front, mulberry32((seed + i * 131) >>> 0));
    } else {
      scatterKinds.push(...clusterKinds);
    }
    for (let d = 0; d < scatterKinds.length; d += 1) {
      const kind = scatterKinds[d] as YardDecorKind;
      const scatter = yardScatterParams(kind);
      placed += placePropsCount(draft, {
        mapId: map.id,
        area: yardArea,
        material: materialForYardDecor(kind),
        count: 1,
        minGap: scatter.minGap,
        naturalness: scatter.naturalness,
        seed: seed + i * 100 + d * 7 + 11,
      }, warnings);
    }
  }

  // 벤치는 길 옆 전용 — 길과 평행하게 (마당·광장 랜덤 산포 금지).
  placed += placeBenchesAlongRoads(map, area, houses, seed);
  // 돌길이면 포석 위 덤불 토핑 (참조 맵 문법 L1).
  if (intent.pathStyle === "stone") placed += placeStoneToppings(map, area, houses, seed);
  // 꽃덤불 링 — 집 벽 옆 자투리 잔디에 1~2개 (참조 맵 문법 L4).
  placed += placeFlowerRings(map, houses, seed, area);
  // 우물 하나 — 광장 근처 (382).
  if (/분수|fountain/i.test(intent.theme)) {
    warnings.push("요청한 fountain(분수) 타일은 combined_town에서 사용할 수 없어 well(우물 382)로 대체했다.");
  }
  placed += placeVillageWell(map, plaza, houses, area);

  const plazaInner = {
    x: plaza.rect.x + 1,
    y: plaza.rect.y + 1,
    w: Math.max(1, plaza.rect.w - 2),
    h: Math.max(1, plaza.rect.h - 2),
  };
  if (intent.plazaStyle === "market") {
    placed += placeMarketDeckProps(map, plazaInner);
  } else if (intent.plazaStyle === "garden") {
    // 게이트 진입로 — 광장 rect가 도로 마스크로 봉쇄되므로 여기서 유일한 통로를 깐다.
    paintPlazaGatePath(map, plaza, intent.pathStyle);
    // 울타리 정원(2026-07-16): 둘레 문법으로 광장을 두르고 남쪽 게이트를 연다.
    placed += paintPlazaFence(map, plazaInner);
    // 석상 페어 2기 — 울타리 안쪽 위 모서리 (상단 266 + 하단 296, 반쪽 배치 금지).
    for (const sx of [plazaInner.x + 1, plazaInner.x + plazaInner.w - 2]) {
      const topIndex = (plazaInner.y + 1) * map.width + sx;
      const bottomIndex = (plazaInner.y + 2) * map.width + sx;
      const bothFree = plazaInner.h >= 4
        && !blocked.has(coordKey(sx, plazaInner.y + 1))
        && !blocked.has(coordKey(sx, plazaInner.y + 2))
        && (map.upperTiles[topIndex] ?? TILE.EMPTY) === TILE.EMPTY
        && (map.upperTiles[bottomIndex] ?? TILE.EMPTY) === TILE.EMPTY
        && (map.lowerTiles[topIndex] ?? TILE.EMPTY) === TILE.GRASS
        && (map.lowerTiles[bottomIndex] ?? TILE.EMPTY) === TILE.GRASS;
      if (bothFree) {
        map.upperTiles[topIndex] = 266;
        map.upperTiles[bottomIndex] = 296;
        placed += 2;
      }
    }
    // 꽃밭: 울타리 안쪽에 꽃잎(348) 다량 + 꽃 덤불(288)·덤불(289) 혼합 (사용자 문법).
    placed += paintFlowerField(map, {
      x: plazaInner.x + 1,
      y: plazaInner.y + 1,
      w: Math.max(1, plazaInner.w - 2),
      h: Math.max(1, plazaInner.h - 2),
    }, mulberry32((seed ^ 0x2545f491) >>> 0));
  }

  if (intent.edgeTrees !== "none") {
    // edgeTrees="dense" 만 숲 밀도 축을 탄다 — "conifer" 는 숲 요구가 아니라 마을 가장자리 나무라
    // 옛 개수를 그대로 둔다(실측: 밀도를 여기에도 밀었더니 50×50 시공이 1.6s → 31s 가 됐다).
    const density = intent.edgeTrees === "dense"
      ? intent.forestDensity ?? DEFAULT_FOREST_DENSITY
      : undefined;
    const broadleafPlan = density
      ? forestPlacementPlan({ area, footprintCells: treeFootprintCells("활엽수"), density, share: 0.05 })
      : undefined;
    placed += placeBroadleafGroves(map, area, plaza, houses, seed, broadleafPlan ? Math.max(16, broadleafPlan.count) : 9);
    const treeArea = {
      x: area.x + 1,
      y: area.y + 1,
      w: Math.max(2, area.w - 2),
      h: Math.max(2, area.h - 2),
    };
    const coniferPlan = density
      ? forestPlacementPlan({
        area: treeArea,
        footprintCells: treeFootprintCells("침엽수"),
        density,
        // 왜 share 인가: 이 산포의 area 는 숲 밴드가 아니라 **마을 전역**이다. 밀도를 그대로 쓰면
        // 집·길 사이까지 나무로 메워 마을이 사라진다. 정작 두꺼워야 할 숲 밴드는
        // villageTerrainPass 의 forestRects 가 직접 채운다.
        share: INTERIOR_TREE_SHARE,
      })
      : undefined;
    placed += placePropsCount(draft, {
      mapId: map.id,
      area: treeArea,
      material: "침엽수",
      count: coniferPlan?.count ?? Math.max(18, Math.floor((treeArea.w * treeArea.h) / 118)),
      // 밀도 경로는 선형 packer 를 탄다: 자연 산포는 스텝마다 전 후보를 다시 재기 때문에 count 에
      // 제곱으로 들어간다(실측 48×48 에 230그루 = 40s, 같은 수를 dense 로 = 63ms).
      minGap: coniferPlan?.minGap ?? 3,
      naturalness: coniferPlan?.naturalness ?? 0.62,
      ...(density ? { packing: forestPackingFor(density) } : {}),
      seed: seed + 1000,
    }, warnings);
    // 석상 쉼터 — 포석(129 블록) 패치 위 석상/돌기둥. (바위 441/442는 전역 밴, 2026-07-17.)
    placed += placeStoneRestSpots(map, treeArea, houses, seed);
  }

  return placed;
}

function intersectRects(a: Rect, b: Rect): Rect | undefined {
  const x = Math.max(a.x, b.x);
  const y = Math.max(a.y, b.y);
  const x2 = Math.min(a.x + a.w, b.x + b.w);
  const y2 = Math.min(a.y + a.h, b.y + b.h);
  return x2 > x && y2 > y ? { x, y, w: x2 - x, h: y2 - y } : undefined;
}

/**
 * 우물(382) — 마을에 하나, 광장 근처 잔디에. (2026-07-16 사용자 확정: 우물은 382)
 */
function placeVillageWell(
  map: GameMap,
  plaza: Plaza,
  houses: readonly BuiltHouse[],
  area: Rect,
): number {
  const blocked = houseBlockedCells(houses, map);
  // 우물은 광장의 앵커(리서치: marketplace = well) — 광장 내부 중앙 자리를 최우선으로.
  const centerCandidates = [
    { x: plaza.centerX, y: plaza.centerRow },
    { x: plaza.centerX - 1, y: plaza.centerRow },
    { x: plaza.centerX + 1, y: plaza.centerRow },
    { x: plaza.centerX, y: plaza.centerRow - 1 },
  ];
  for (const cell of centerCandidates) {
    if (!inMapBounds(map, cell.x, cell.y) || !pointInRect(cell, area) || blocked.has(coordKey(cell.x, cell.y))) continue;
    const index = cell.y * map.width + cell.x;
    if ((map.lowerTiles[index] ?? TILE.EMPTY) !== TILE.GRASS) continue;
    if ((map.upperTiles[index] ?? TILE.EMPTY) !== TILE.EMPTY) continue;
    map.upperTiles[index] = 382;
    return 1;
  }
  for (const distance of [2, 3, 4]) {
    const rect = expandRect(plaza.rect, distance);
    for (let y = rect.y; y < rect.y + rect.h; y += 1) {
      for (let x = rect.x; x < rect.x + rect.w; x += 1) {
        // 확장 사각형의 테두리만 (광장에서 distance칸 떨어진 링)
        const onRing = x === rect.x || x === rect.x + rect.w - 1 || y === rect.y || y === rect.y + rect.h - 1;
        if (!onRing || !inMapBounds(map, x, y) || !pointInRect({ x, y }, area)) continue;
        const index = y * map.width + x;
        if ((map.lowerTiles[index] ?? TILE.EMPTY) !== TILE.GRASS) continue;
        if ((map.upperTiles[index] ?? TILE.EMPTY) !== TILE.EMPTY) continue;
        if (blocked.has(coordKey(x, y))) continue;
        map.upperTiles[index] = 382;
        return 1;
      }
    }
  }
  return 0;
}

/**
 * Finish house-owned banners and signs before sealing the fixed house geometry.
 * Signs stay visible on empty upper cells over actual kit walls, never in the yard.
 */
export function finishVillageHouseDecor(map: GameMap, houses: readonly BuiltHouse[], plaza: Plaza): number {
  return placeEntranceBanners(map, houses) + placeShopSigns(map, houses, plaza);
}

function placeShopSigns(map: GameMap, houses: readonly BuiltHouse[], plaza: Plaza): number {
  const blocked = new Set(protectedHouseCells(map).map(({ x, y }) => coordKey(x, y)));
  const gate = { x: plaza.centerX, y: plaza.rect.y + plaza.rect.h };
  const shops = houses
    .filter((house) => house.program === "shop" || house.program === "inn")
    .sort((a, b) =>
      (Math.abs(a.front.x - gate.x) + Math.abs(a.front.y - gate.y))
      - (Math.abs(b.front.x - gate.x) + Math.abs(b.front.y - gate.y)));
  let placed = 0;
  let shopIndex = 0;
  shops.forEach((house) => {
    // 여관은 이식된 INN 간판(443, builder.ensureInnSignGraft), 상점은 무기(472)/잡화(473) 교대.
    const tile = house.program === "inn" ? 443 : (shopIndex++ % 2 === 0 ? 472 : 473);
    const { doorAt, bbox, stories } = house;
    const wallBandRows = 2 + (2 * stories - 1);
    const topWallY = bbox.y + bbox.h - wallBandRows;
    const { wall, postColumn } = HOUSE_KITS[house.kitId];
    const wallTiles = new Set([...wall.top, ...wall.mid, ...wall.bottom, ...(postColumn?.tiles ?? [])]);
    // Gate-facing wall first; other rows cover narrow houses, low walls and uneven wings.
    const columns = Array.from({ length: bbox.w }, (_, i) => bbox.x + i);
    if (gate.x >= bbox.x + Math.floor(bbox.w / 2)) columns.reverse();
    const rows = [topWallY, ...Array.from({ length: bbox.h }, (_, i) => bbox.y + i).filter((y) => y !== topWallY)];
    for (const y of rows) {
      for (const x of columns) {
        if (!pointInRect({ x, y }, bbox) || !inMapBounds(map, x, y) || blocked.has(coordKey(x, y))) continue;
        if (x === doorAt.x && (y === doorAt.y || y === doorAt.y - 1)) continue;
        const index = y * map.width + x;
        if (!wallTiles.has(map.lowerTiles[index]) || map.upperTiles[index] !== TILE.EMPTY) continue;
        map.upperTiles[index] = tile;
        placed += 1;
        return;
      }
    }
  });
  return placed;
}

function placeEntranceBanners(map: GameMap, houses: readonly BuiltHouse[]): number {
  // 여관은 이식된 INN 간판(placeShopSigns)이 담당 — 깃발은 다층 중요 건물 하나만.
  const important = houses.find((house) => house.stories > 1) ?? houses[0];
  if (!important) return 0;
  return placeBannersOnHouse(map, important);
}

function placeBannersOnHouse(map: GameMap, house: BuiltHouse): number {
  const wallBandRows = 2 + (2 * house.stories - 1);
  const topWallY = house.bbox.y + house.bbox.h - wallBandRows;
  const { doorAt } = house;
  let placed = 0;
  for (const [dx, tile] of [[-1, 208], [1, 209]] as const) {
    const x = doorAt.x + dx;
    if (x <= house.bbox.x || x >= house.bbox.x + house.bbox.w - 1) continue;
    if (!inMapBounds(map, x, topWallY)) continue;
    const index = topWallY * map.width + x;
    if ((map.upperTiles[index] ?? TILE.EMPTY) !== TILE.EMPTY) continue;
    // 벽면(통행 불가 lower) 위에만 — 깃발은 벽걸이 장식이다.
    if ((map.lowerTiles[index] ?? TILE.EMPTY) === TILE.GRASS) continue;
    map.upperTiles[index] = tile;
    placed += 1;
  }
  return placed;
}

/**
 * 석상 쉼터 — 포석(129 블록) 패치를 깔고 그 위에 석상(266/296) 또는 돌기둥(267/297)
 * 세로 페어를 세운다. (바위 441/442는 전역 밴 — 2026-07-17 사용자: "석상이나 기둥이 낫다".)
 */
export function placeStoneRestSpots(
  map: GameMap,
  area: Rect,
  houses: readonly BuiltHouse[],
  seed: number,
): number {
  const blocked = houseBlockedCells(houses, map);
  const rng = mulberry32((seed ^ 0x3c6ef372) >>> 0);
  const freeGrass = (x: number, y: number): boolean =>
    inMapBounds(map, x, y)
    && (map.lowerTiles[y * map.width + x] ?? TILE.EMPTY) === TILE.GRASS
    && (map.upperTiles[y * map.width + x] ?? TILE.EMPTY) === TILE.EMPTY
    && !blocked.has(coordKey(x, y));
  let placed = 0;
  let attempts = 0;
  let outcrops = 0;
  while (outcrops < 2 && attempts < 40) {
    attempts += 1;
    const w = 2 + Math.floor(rng() * 2); // 2~3
    const h = 2;
    const x0 = area.x + 1 + Math.floor(rng() * Math.max(1, area.w - w - 2));
    const y0 = area.y + 1 + Math.floor(rng() * Math.max(1, area.h - h - 2));
    let ok = true;
    // 패치 + 둘레 1칸 링까지 잔디여야 한다 — 길·다른 노두와 붙으면 도로망 감사가 헷갈린다.
    for (let y = y0 - 1; y < y0 + h + 1 && ok; y += 1) {
      for (let x = x0 - 1; x < x0 + w + 1 && ok; x += 1) {
        if (!inMapBounds(map, x, y)) continue;
        if ((map.lowerTiles[y * map.width + x] ?? TILE.EMPTY) !== TILE.GRASS) ok = false;
        else if (x >= x0 && x < x0 + w && y >= y0 && y < y0 + h && !freeGrass(x, y)) ok = false;
      }
    }
    if (!ok) continue;
    // 포석 패치(129 블록 몸통 → 오토타일 성형) + 석상 또는 돌기둥 세로 페어 1주.
    const patchCells: Point[] = [];
    for (let y = y0; y < y0 + h; y += 1) {
      for (let x = x0; x < x0 + w; x += 1) {
        map.lowerTiles[y * map.width + x] = COBBLE_TILE.BODY;
        patchCells.push({ x, y });
        placed += 1;
      }
    }
    shapeAutotileGroupAround(map, DEFAULT_COBBLE_AUTOTILE_GROUP, patchCells, (x, y) => !blocked.has(coordKey(x, y)));
    // 세로 2칸(상단/하단)이 패치 안에 들어가는 열을 골라 세운다 — h=2라 항상 성립.
    const px = x0 + Math.floor(rng() * w);
    const topIndex = y0 * map.width + px;
    const bottomIndex = (y0 + 1) * map.width + px;
    if ((map.upperTiles[topIndex] ?? TILE.EMPTY) === TILE.EMPTY && (map.upperTiles[bottomIndex] ?? TILE.EMPTY) === TILE.EMPTY) {
      const statue = rng() < 0.5;
      map.upperTiles[topIndex] = statue ? 266 : 267;
      map.upperTiles[bottomIndex] = statue ? 296 : 297;
      placed += 2;
    }
    outcrops += 1;
  }
  return placed;
}

/**
 * 벤치는 마당 랜덤 산포가 아니라 길 옆에, 길과 "평행"하게 놓는다 (2026-07-16).
 * 가로 길 옆 → 가로 벤치(327+328), 세로 길 옆 → 세로 의자(358+388).
 * 드묾: 50×50 기준 2~3쌍, 벤치끼리 최소 8칸 이격, 문 앞 게이트는 피한다.
 */
function placeBenchesAlongRoads(
  map: GameMap,
  area: Rect,
  houses: readonly BuiltHouse[],
  seed: number,
): number {
  const blocked = houseBlockedCells(houses, map);
  const isRoad = (x: number, y: number): boolean =>
    inMapBounds(map, x, y) && ROAD_TILES.has(map.lowerTiles[y * map.width + x] ?? TILE.EMPTY);
  const freeGrass = (x: number, y: number): boolean =>
    inMapBounds(map, x, y)
    && (map.lowerTiles[y * map.width + x] ?? TILE.EMPTY) === TILE.GRASS
    && (map.upperTiles[y * map.width + x] ?? TILE.EMPTY) === TILE.EMPTY
    && !blocked.has(coordKey(x, y));
  const nearGate = (x: number, y: number): boolean =>
    houses.some((house) => Math.abs(x - house.front.x) <= 2 && Math.abs(y - house.front.y) <= 2);

  type BenchSpot = { readonly kind: "h" | "v"; readonly x: number; readonly y: number };
  const candidates: BenchSpot[] = [];
  for (let y = area.y + 1; y < area.y + area.h - 1; y += 1) {
    for (let x = area.x + 1; x < area.x + area.w - 2; x += 1) {
      // 가로 벤치: (x,y)+(x+1,y) 잔디, 바로 아래(또는 위)가 가로로 이어지는 길.
      for (const dy of [1, -1]) {
        const ry = y + dy;
        if (isRoad(x, ry) && isRoad(x + 1, ry) && (isRoad(x - 1, ry) || isRoad(x + 2, ry))
          && freeGrass(x, y) && freeGrass(x + 1, y) && !nearGate(x, y)) {
          candidates.push({ kind: "h", x, y });
          break;
        }
      }
      // 세로 의자: (x,y)+(x,y+1) 잔디, 바로 옆이 세로로 이어지는 길.
      for (const dx of [1, -1]) {
        const rx = x + dx;
        if (isRoad(rx, y) && isRoad(rx, y + 1) && (isRoad(rx, y - 1) || isRoad(rx, y + 2))
          && freeGrass(x, y) && freeGrass(x, y + 1) && !nearGate(x, y)) {
          candidates.push({ kind: "v", x, y });
          break;
        }
      }
    }
  }
  const rng = mulberry32((seed ^ 0x9e3779b9) >>> 0);
  const shuffledSpots = shuffled(candidates, rng);
  const anchors: Point[] = [];
  let placed = 0;
  for (const spot of shuffledSpots) {
    if (anchors.length >= 3) break;
    if (anchors.some((a) => Math.max(Math.abs(a.x - spot.x), Math.abs(a.y - spot.y)) < 8)) continue;
    const index = spot.y * map.width + spot.x;
    if (spot.kind === "h") {
      if (!freeGrass(spot.x, spot.y) || !freeGrass(spot.x + 1, spot.y)) continue;
      map.upperTiles[index] = 327;
      map.upperTiles[index + 1] = 328;
    } else {
      if (!freeGrass(spot.x, spot.y) || !freeGrass(spot.x, spot.y + 1)) continue;
      map.upperTiles[index] = 358;
      map.upperTiles[index + map.width] = 388;
    }
    anchors.push({ x: spot.x, y: spot.y });
    placed += 2;
  }
  return placed;
}

function placeBroadleafGroves(
  map: GameMap,
  area: Rect,
  plaza: Plaza,
  houses: readonly BuiltHouse[],
  seed: number,
  target: number,
): number {
  const rng = mulberry32((seed ^ 0xb7e15162) >>> 0);
  const blocked = houseBlockedCells(houses, map);
  const candidates: Point[] = [];
  for (let y = area.y + 1; y < area.y + area.h - 2; y += 1) {
    for (let x = area.x + 1; x < area.x + area.w - 2; x += 1) {
      if (rectsOverlap({ x, y, w: 2, h: 2 }, expandRect(plaza.rect, 2))) continue;
      candidates.push({ x, y });
    }
  }
  const shuffledCandidates = shuffled(candidates, rng);
  let clusters = 0;
  // 큰나무(2×2) 정본(2026-07-17 사용자): 상단 행(수관 262/263)=상위, 하단 행(밑동 292/293)=하위.
  // 이렇게 나누면 다음 나무의 수관을 앞 나무 밑동 칸 위에 얹을 수 있어 "겹침"이 성립한다.
  const stampBigTree = (x: number, y: number): void => {
    const top = y * map.width + x;
    const bottom = top + map.width;
    map.upperTiles[top] = 262;
    map.upperTiles[top + 1] = 263;
    map.lowerTiles[bottom] = 292;
    map.lowerTiles[bottom + 1] = 293;
  };
  const freeFor = (x: number, y: number, allowLowerTrunk: boolean): boolean => {
    if (!inMapBounds(map, x, y) || !inMapBounds(map, x + 1, y + 1)) return false;
    for (const cell of [{ x, y }, { x: x + 1, y }, { x, y: y + 1 }, { x: x + 1, y: y + 1 }]) {
      if (blocked.has(coordKey(cell.x, cell.y))) return false;
      const index = cell.y * map.width + cell.x;
      const lower = map.lowerTiles[index] ?? TILE.EMPTY;
      const lowerOk = lower === TILE.GRASS || (allowLowerTrunk && cell.y === y && (lower === 292 || lower === 293));
      if (!lowerOk || ROAD_TILES.has(lower) || map.upperTiles[index] !== TILE.EMPTY) return false;
    }
    return true;
  };
  for (const candidate of shuffledCandidates) {
    if (clusters >= target) break;
    if (!freeFor(candidate.x, candidate.y, false)) continue;
    stampBigTree(candidate.x, candidate.y);
    clusters += 1;
    // 대각 캐스케이드(있어 보이는 겹침): 우하(+1,+1) 나무의 수관이 앞 나무 밑동 위에 겹친다.
    if (rng() < 0.6 && freeFor(candidate.x + 1, candidate.y + 1, true)) {
      stampBigTree(candidate.x + 1, candidate.y + 1);
      clusters += 1;
    }
  }
  return clusters * 4;
}

function placePropsCount(
  draft: Project,
  args: Record<string, unknown>,
  warnings: string[]
): number {
  try {
    const result = runNested(placePropsTool, draft, args, warnings);
    const data = result.data as Record<string, unknown> | undefined;
    if (typeof data?.placed === "number") return data.placed;
    return typeof args.count === "number" ? args.count : 0;
  } catch (err) {
    warnings.push(err instanceof Error ? err.message : String(err));
    return 0;
  }
}

/**
 * 미리보기용 침엽수 — 본시공과 같은 place_props.
 * dense packer / forestPlacementPlan 은 타지 않는다(마을 전역 밀도 축은 31s 함정).
 */
export function placePreviewConifers(
  draft: Project,
  map: GameMap,
  count: number,
  seed: number,
): number {
  const treeArea = {
    x: 1,
    y: 1,
    w: Math.max(2, map.width - 2),
    h: Math.max(2, map.height - 2),
  };
  return placePropsCount(draft, {
    mapId: map.id,
    area: treeArea,
    material: "침엽수",
    count,
    minGap: 3,
    naturalness: 0.62,
    seed,
  }, []);
}
