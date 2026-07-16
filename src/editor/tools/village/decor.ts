// editor/tools/village/decor.ts
// 마을 소품 레이어 — 마당 꾸밈, 길 옆 벤치, 우물, 깃발, 바위 노두, 활엽수 군락, place_props 위임.

import { COBBLE_TILE } from "@/project/defaults/chipsetMapping";
import { shapeCobbleAround } from "@/project/defaults/cobbleAutotile";
import { TILE } from "@/project/defaults/constants";
import type { GameMap, Project } from "@/project/types";
import { mulberry32, type Rng } from "@/util/rng";
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
  const tiles = kinds
    .map((kind) => CLUSTER_PROP_TILES[kind])
    .filter((tile): tile is number => typeof tile === "number")
    .slice(0, 3);
  if (tiles.length < 2) return 0;
  const freeGrass = (x: number, y: number): boolean =>
    inMapBounds(map, x, y)
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
function placeFlowerRings(map: GameMap, houses: readonly BuiltHouse[], seed: number): number {
  const rng = mulberry32((seed ^ 0x85ebca6b) >>> 0);
  const blocked = houseBlockedCells(houses);
  const freeGrass = (x: number, y: number): boolean =>
    inMapBounds(map, x, y)
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
  const protectedCells = new Set<string>();
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
  let placed = 0;
  const pool = YARD_STYLE_POOLS[intent.yardStyle];
  for (let i = 0; i < houses.length; i += 1) {
    const house = houses[i] as BuiltHouse;
    const fromPlan = intent.houseYards[i];
    const theme = (fromPlan && fromPlan.length > 0
      ? fromPlan
      : pool[i % pool.length]) as readonly YardDecorKind[];
    const yardArea = yardAreaForHouse(
      map,
      [{ x: house.bbox.x, y: house.bbox.y, w: house.bbox.w, h: house.bbox.h }],
      house.doorAt,
      { depth: 3, pad: 1 },
    );
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
  placed += placeFlowerRings(map, houses, seed);
  // 우물 하나 — 광장 근처 (382).
  placed += placeVillageWell(map, plaza, houses);
  // 화려한 깃발 — 중요한 집 문 양옆 벽면 (208/209).
  placed += placeEntranceBanners(map, houses);
  placed += placeShopSigns(map, houses, plaza);

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
    placed += placeBroadleafGroves(map, area, plaza, houses, seed, intent.edgeTrees === "dense" ? 16 : 9);
    const treeArea = {
      x: area.x + 1,
      y: area.y + 1,
      w: Math.max(2, area.w - 2),
      h: Math.max(2, area.h - 2),
    };
    placed += placePropsCount(draft, {
      mapId: map.id,
      area: treeArea,
      material: "침엽수",
      count: Math.max(18, Math.floor((treeArea.w * treeArea.h) / (intent.edgeTrees === "dense" ? 78 : 118))),
      minGap: 3,
      naturalness: 0.62,
      seed: seed + 1000,
    }, warnings);
    // 바위 노두 — 포석(129 블록) 패치 위에 바위(441/442)를 얹는다.
    placed += placeRockOutcrops(map, treeArea, houses, seed);
  }

  return placed;
}

/**
 * 우물(382) — 마을에 하나, 광장 근처 잔디에. (2026-07-16 사용자 확정: 우물은 382)
 */
function placeVillageWell(
  map: GameMap,
  plaza: Plaza,
  houses: readonly BuiltHouse[],
): number {
  const blocked = houseBlockedCells(houses);
  // 우물은 광장의 앵커(리서치: marketplace = well) — 광장 내부 중앙 자리를 최우선으로.
  const centerCandidates = [
    { x: plaza.centerX, y: plaza.centerRow },
    { x: plaza.centerX - 1, y: plaza.centerRow },
    { x: plaza.centerX + 1, y: plaza.centerRow },
    { x: plaza.centerX, y: plaza.centerRow - 1 },
  ];
  for (const cell of centerCandidates) {
    if (!inMapBounds(map, cell.x, cell.y)) continue;
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
        if (!onRing || !inMapBounds(map, x, y)) continue;
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
 * 화려한 깃발(208/209) — 가장 중요한 집(다층 우선)의 "지붕 바로 아래 최상단 벽" 행에 건다.
 * (2026-07-16 사용자 하네싱 지시: 깃발은 벽 최상단 행에 걸리는 장식이다.)
 */
/**
 * 상점 간판(2026-07-17, 사용자 규약 2차) — 벽에 파묻히면 안 보인다:
 * **벽 최상단 높이의 집 바깥 열**(벽 아닌 잔디 칸)에 걸이 간판을 내민다.
 * 무기점 방패(472)·잡화점 물약(473) 번갈아, 광장 게이트를 향한 쪽 우선.
 * 도로 위 장식 금지 룰에 따라 잔디 칸만 쓰고, 실패 시 반대편 → 문 옆 벽면 폴백.
 */
function placeShopSigns(map: GameMap, houses: readonly BuiltHouse[], plaza: Plaza): number {
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
    // 게이트 쪽 측면 우선 — 플레이어 접근 방향에서 먼저 보인다.
    const sides = gate.x >= bbox.x + Math.floor(bbox.w / 2)
      ? [bbox.x + bbox.w, bbox.x - 1]
      : [bbox.x - 1, bbox.x + bbox.w];
    const tryPlace = (x: number, y: number, requireGrass: boolean): boolean => {
      if (!inMapBounds(map, x, y)) return false;
      const cellIndex = y * map.width + x;
      if ((map.upperTiles[cellIndex] ?? TILE.EMPTY) !== TILE.EMPTY) return false;
      if (requireGrass && (map.lowerTiles[cellIndex] ?? TILE.EMPTY) !== TILE.GRASS) return false;
      map.upperTiles[cellIndex] = tile;
      placed += 1;
      return true;
    };
    for (const x of sides) {
      if (tryPlace(x, topWallY, true)) return;
    }
    // 폴백: 문 옆 벽면(구 규약)
    for (const dx of [1, -1]) {
      const x = doorAt.x + dx;
      if (x <= bbox.x || x >= bbox.x + bbox.w - 1) continue;
      if (tryPlace(x, doorAt.y, false)) return;
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
 * 바위 노두 — 412 돌바닥(하위 지면) 패치를 깔고 그 위에 441/442 바위를 얹는다.
 * (사용자 문법: 441/442는 412와 섞어 쓰는 것 — 잔디 위 단독 배치 금지.)
 */
// 보류(412 밴): 자갈 오토타일 확보 후 재개 — export는 미사용 경고 방지 겸 재개 지점 표시.
export function placeRockOutcrops(
  map: GameMap,
  area: Rect,
  houses: readonly BuiltHouse[],
  seed: number,
): number {
  const blocked = houseBlockedCells(houses);
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
    // 포석 패치(129 블록 몸통 → 오토타일 성형) + 바위(441/442, 상위) 1~2개
    const patchCells: Point[] = [];
    for (let y = y0; y < y0 + h; y += 1) {
      for (let x = x0; x < x0 + w; x += 1) {
        map.lowerTiles[y * map.width + x] = COBBLE_TILE.BODY;
        patchCells.push({ x, y });
        placed += 1;
      }
    }
    shapeCobbleAround(map, patchCells);
    const rocks = 1 + Math.floor(rng() * 2);
    for (let i = 0; i < rocks; i += 1) {
      const rx = x0 + Math.floor(rng() * w);
      const ry = y0 + Math.floor(rng() * h);
      const index = ry * map.width + rx;
      if ((map.upperTiles[index] ?? TILE.EMPTY) === TILE.EMPTY) {
        map.upperTiles[index] = rng() < 0.5 ? 441 : 442;
        placed += 1;
      }
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
  const blocked = houseBlockedCells(houses);
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
  const blocked = houseBlockedCells(houses);
  const candidates: Point[] = [];
  for (let y = area.y + 1; y < area.y + area.h - 2; y += 1) {
    for (let x = area.x + 1; x < area.x + area.w - 2; x += 1) {
      if (rectsOverlap({ x, y, w: 2, h: 2 }, expandRect(plaza.rect, 2))) continue;
      candidates.push({ x, y });
    }
  }
  const shuffledCandidates = shuffled(candidates, rng);
  let clusters = 0;
  for (const candidate of shuffledCandidates) {
    if (clusters >= target) break;
    const cells = [candidate, { x: candidate.x + 1, y: candidate.y }, { x: candidate.x, y: candidate.y + 1 }, { x: candidate.x + 1, y: candidate.y + 1 }];
    if (cells.some((cell) => blocked.has(coordKey(cell.x, cell.y)))) continue;
    if (cells.some((cell) => {
      const index = cell.y * map.width + cell.x;
      const lower = map.lowerTiles[index] ?? TILE.EMPTY;
      return lower !== TILE.GRASS || ROAD_TILES.has(lower) || map.upperTiles[index] !== TILE.EMPTY;
    })) continue;
    const index = candidate.y * map.width + candidate.x;
    map.upperTiles[index] = 262;
    map.upperTiles[index + 1] = 263;
    map.upperTiles[index + map.width] = 292;
    map.upperTiles[index + map.width + 1] = 293;
    clusters += 1;
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
