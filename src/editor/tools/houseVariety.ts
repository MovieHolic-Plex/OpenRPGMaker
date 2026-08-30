// editor/tools/houseVariety.ts
// 맵에 실제로 깔린 집을 타일에서 되읽어 "모양·킷 다양성"을 판정한다.
//
// 왜 필요한가(2026-08-31): author_house 는 kitId 6종만 흔들 수 있어서 AI 가 같은 사각형에
// 색만 바꿔 깔았다. 모양 어휘(templateId)를 열어 주더라도 모델이 "지금 몇 종을 썼는지"를
// 볼 수단이 없으면 여전히 한 종에 수렴한다. 그래서 감지 → 리포트 → 프롬프트 되먹임의
// 관찰 고리를 만든다. look_at_houses(비전 툴)와 author_house 결과가 같은 리포트를 공유한다.
//
// 감지 규약:
//  · 집 칸 = 하위/상위 중 어느 한 레이어의 타일이 "집 킷 타일 집합"에 속하는 칸.
//    문(116/146)은 벽 타일을 덮어쓰므로 집합에 포함한다. 창(85/87)·굴뚝(326)·깃발(208/209)·
//    울타리는 이미 집 칸인 곳의 상위에만 얹히거나 킷 밖이라 마스크를 바꾸지 않는다.
//  · 4방 연결 성분 = 건물 한 덩이. estate-* 처럼 본채와 헛간이 떨어진 템플릿은 두 덩이로 잡히고,
//    각 덩이는 홀로 서 있는 템플릿과 구별할 수 없으므로 본채가 rect-* 로 읽힐 수 있다.
//    다양성 집계(서로 다른 덩이 = 서로 다른 모양)에는 영향이 없다.
//  · 모양 서명 = bbox 로 정규화한 집 칸 마스크 + 벽 밴드 행 수. 카탈로그 34종을 **같은 코드로**
//    스크래치 맵에 시공해 만든 서명 표와 맞춰 templateId 를 되찾는다(추정·허용오차 없음).
//  · 서명에 벽 행 수를 넣는 이유: 마스크만 보면 stories 1/2/3 과 lowWall 이 전부 같은 직사각형이라
//    "층수를 흔들었는데 모양 1종"이라는 거짓 단조 경고가 난다. 벽 밴드는 실제 실루엣 축이다.
//  · 서명 표는 kitId 로 갈라 담는다: bright 계열 지붕은 용마루를 마스크 한 행 **위**에 그려서
//    같은 템플릿이 킷에 따라 다른 높이가 된다(rect-tall+amber = 7×9 = rect-2f+blue 충돌).

import {
  CHIMNEY_TILE,
  HOUSE_KITS,
  MIXABLE_HOUSE_KIT_IDS,
  stampFootprintHouseKit,
  type HouseKit,
  type HouseKitId,
} from "@/editor/houseKit";
import { TILE } from "@/project/defaults/constants";
import { HOUSE_TEMPLATE_DEFS } from "@/project/defaults/houseTemplateCatalog";
import type { GameMap } from "@/project/types";
import { applyRoofDeck, ROOF_DECK_PLANK } from "./village/houses";

const DOOR_TOP_TILE = 116;
const DOOR_BOTTOM_TILE = 146;

/** 덩이로 인정하는 최소 칸 수 — 문짝만 남은 잔해·단독 소품을 집으로 세지 않는다. */
const MIN_HOUSE_CELLS = 8;

export type HouseRect = { readonly x: number; readonly y: number; readonly w: number; readonly h: number };
export type HousePoint = { readonly x: number; readonly y: number };

/** 지붕 색 — kitId 6종은 지붕색 3가지로 접힌다. "색만 바꾼 다양성"을 잡아내는 축. */
export type HouseRoofColor = "blue" | "orange" | "red";

export type DetectedHouse = {
  readonly index: number;
  readonly bbox: HouseRect;
  readonly cells: number;
  /** 식별 실패(킷 밖 손그림 구조물)는 null. */
  readonly kitId: HouseKitId | null;
  readonly roofColor: HouseRoofColor | null;
  /** 카탈로그 34종과 마스크가 일치하면 그 id, 아니면 null(=custom). */
  readonly templateId: string | null;
  readonly shapeKey: string;
  /** 벽 밴드 행 수 — lowWall 2, 1층 3, 2층 5, 3층 7. 여러 날개면 합집합이라 더 클 수 있다. */
  readonly wallRows: number;
  readonly doorAt: HousePoint | null;
  readonly chimney: boolean;
  readonly roofDeck: boolean;
};

export type HouseVarietyReport = {
  readonly houses: number;
  readonly distinctShapes: number;
  readonly distinctKits: number;
  readonly distinctRoofColors: number;
  readonly shapeCounts: readonly (readonly [string, number])[];
  readonly kitCounts: readonly (readonly [string, number])[];
  readonly roofColorCounts: readonly (readonly [HouseRoofColor, number])[];
  /** 2채 이상 겹치는 모양 — 여기 값이 있으면 "비슷한 집"이 실제로 생긴 것. */
  readonly repeatedShapes: readonly (readonly [string, number])[];
  readonly repeatedKits: readonly (readonly [string, number])[];
  /** 아직 안 쓴 카탈로그 모양 — 다음 호출에서 바로 골라 쓸 재료. */
  readonly unusedTemplateIds: readonly string[];
  readonly unusedKitIds: readonly HouseKitId[];
  readonly verdict: "diverse" | "mixed" | "monotonous";
  readonly advice: readonly string[];
};

// ── 킷 타일 색인 ─────────────────────────────────────────────────────────────

/** 벽 밴드 계열(벽 3슬라이스 + 하프팀버 기둥 + 창) — 지붕과 겹치지 않는다. */
function kitWallTileIds(kit: HouseKit): readonly number[] {
  return [...kit.wall.top, ...kit.wall.mid, ...kit.wall.bottom, ...(kit.postColumn?.tiles ?? []), kit.windowTile];
}

function kitRoofTileIds(kit: HouseKit): readonly number[] {
  const out: number[] = [];
  for (const value of Object.values(kit.roof)) {
    if (typeof value === "number") out.push(value);
    else if (value && typeof value === "object") {
      for (const nested of Object.values(value)) {
        if (typeof nested === "number") out.push(nested);
      }
    }
  }
  return out;
}

const ROOF_TILES: ReadonlySet<number> = new Set<number>(
  Object.values(HOUSE_KITS).flatMap((kit) => kitRoofTileIds(kit)),
);

/**
 * 벽 밴드 판정 타일. 지붕 집합과 겹치는 값은 빼서 "이 행은 벽인가"를 오판하지 않게 한다
 * (킷마다 숫자가 재사용되므로 교집합 제거는 필수).
 */
const WALL_BAND_TILES: ReadonlySet<number> = new Set<number>(
  [
    ...Object.values(HOUSE_KITS).flatMap((kit) => kitWallTileIds(kit)),
    DOOR_TOP_TILE,
    DOOR_BOTTOM_TILE,
  ].filter((tile) => !ROOF_TILES.has(tile)),
);

/** 어떤 킷이든 집 몸체로 보는 타일 전체 + 문. 마스크(=모양) 판정의 유일한 기준. */
const HOUSE_MASK_TILES: ReadonlySet<number> = new Set<number>([
  ...Object.values(HOUSE_KITS).flatMap((kit) => [...kitWallTileIds(kit), ...kitRoofTileIds(kit)]),
  DOOR_TOP_TILE,
  DOOR_BOTTOM_TILE,
]);

/** 벽 계열 판정용 — timber-hall 의 기둥은 blue-stone 벽과 타일을 공유하므로 먼저 본다. */
const POST_TILES: ReadonlySet<number> = new Set<number>(HOUSE_KITS["timber-hall"].postColumn?.tiles ?? []);
const WALL_STONE_15: ReadonlySet<number> = new Set<number>([15, 17, 45, 47, 75, 77]);
const WALL_PLASTER_12: ReadonlySet<number> = new Set<number>([12, 13, 14, 42, 43, 44, 72, 73, 74]);
const WALL_WOOD_102: ReadonlySet<number> = new Set<number>([102, 103, 104, 132, 133, 134, 162, 163, 164]);

const BLUE_ROOF_TILES: ReadonlySet<number> = new Set<number>([406, 407, 467, 356, 357, 386, 387]);
/** 사선 트림 376/377 은 bright 전용 — aframe 은 캡(354/355)만 쓴다. */
const BRIGHT_ROOF_TRIM: ReadonlySet<number> = new Set<number>([376, 377]);
const AFRAME_ROOF_TILES: ReadonlySet<number> = new Set<number>([354, 355, 384, 385]);

const ROOF_COLOR_BY_KIT: Readonly<Record<HouseKitId, HouseRoofColor>> = {
  "blue-stone": "blue",
  "slate-wood": "blue",
  "bright-plaster": "orange",
  "amber-wood": "orange",
  "timber-hall": "red",
  "aframe-stone": "red",
};

export function roofColorForKit(kitId: HouseKitId): HouseRoofColor {
  return ROOF_COLOR_BY_KIT[kitId];
}

// ── 감지 ─────────────────────────────────────────────────────────────────────

type Component = {
  readonly cells: readonly number[];
  readonly bbox: HouseRect;
};

function isHouseCell(map: GameMap, index: number): boolean {
  const lower = map.lowerTiles[index] ?? TILE.EMPTY;
  if (lower !== TILE.EMPTY && HOUSE_MASK_TILES.has(lower)) return true;
  const upper = map.upperTiles[index] ?? TILE.EMPTY;
  return upper !== TILE.EMPTY && HOUSE_MASK_TILES.has(upper);
}

function clampBounds(map: GameMap, bounds: HouseRect | undefined): HouseRect {
  if (!bounds) return { x: 0, y: 0, w: map.width, h: map.height };
  const x = Math.max(0, Math.min(map.width - 1, bounds.x));
  const y = Math.max(0, Math.min(map.height - 1, bounds.y));
  return { x, y, w: Math.max(1, Math.min(map.width - x, bounds.w)), h: Math.max(1, Math.min(map.height - y, bounds.h)) };
}

function connectedComponents(map: GameMap, area: HouseRect): Component[] {
  const seen = new Uint8Array(map.width * map.height);
  const out: Component[] = [];
  for (let y = area.y; y < area.y + area.h; y += 1) {
    for (let x = area.x; x < area.x + area.w; x += 1) {
      const start = y * map.width + x;
      if (seen[start] === 1 || !isHouseCell(map, start)) continue;
      const cells: number[] = [];
      const stack: number[] = [start];
      seen[start] = 1;
      let minX = x;
      let maxX = x;
      let minY = y;
      let maxY = y;
      while (stack.length > 0) {
        const index = stack.pop() as number;
        cells.push(index);
        const cx = index % map.width;
        const cy = Math.floor(index / map.width);
        if (cx < minX) minX = cx;
        if (cx > maxX) maxX = cx;
        if (cy < minY) minY = cy;
        if (cy > maxY) maxY = cy;
        // 4방 확장. 탐색은 area 밖으로도 나간다 — 잘린 bbox 로 모양을 오판하지 않게.
        const neighbours = [
          cx > 0 ? index - 1 : -1,
          cx + 1 < map.width ? index + 1 : -1,
          cy > 0 ? index - map.width : -1,
          cy + 1 < map.height ? index + map.width : -1,
        ];
        for (const next of neighbours) {
          if (next < 0 || seen[next] === 1 || !isHouseCell(map, next)) continue;
          seen[next] = 1;
          stack.push(next);
        }
      }
      if (cells.length >= MIN_HOUSE_CELLS) {
        out.push({ cells, bbox: { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 } });
      }
    }
  }
  return out.sort((a, b) => a.bbox.y - b.bbox.y || a.bbox.x - b.bbox.x);
}

/** 벽 밴드 타일이 하나라도 있는 행의 수 — 층수·lowWall 을 마스크에 실어 주는 구조 축. */
function wallRowCount(map: GameMap, component: Component): number {
  const rows = new Set<number>();
  for (const index of component.cells) {
    const lower = map.lowerTiles[index] ?? TILE.EMPTY;
    const upper = map.upperTiles[index] ?? TILE.EMPTY;
    if (WALL_BAND_TILES.has(lower) || WALL_BAND_TILES.has(upper)) rows.add(Math.floor(index / map.width));
  }
  return rows.size;
}

/**
 * 모양 서명 — 같은 실루엣이면 위치와 무관하게 같은 문자열.
 * 마스크(칸 점유)만으로는 1층/2층/낮은벽이 전부 같은 직사각형이라 벽 밴드 행 수를 함께 싣고,
 * 옥상 데크는 마스크를 바꾸지 않으므로(판자·사다리가 상위 소품) 플래그로 붙인다.
 */
function shapeSignature(map: GameMap, component: Component): string {
  const { bbox, cells } = component;
  const rows: string[] = [];
  const filled = new Set(cells);
  for (let dy = 0; dy < bbox.h; dy += 1) {
    let row = "";
    for (let dx = 0; dx < bbox.w; dx += 1) {
      row += filled.has((bbox.y + dy) * map.width + bbox.x + dx) ? "#" : ".";
    }
    rows.push(row);
  }
  const deck = hasRoofDeck(map, cells) ? "|deck" : "";
  return `${bbox.w}x${bbox.h}:${rows.join("/")}|w${wallRowCount(map, component)}${deck}`;
}

function classifyKit(map: GameMap, cells: readonly number[]): HouseKitId | null {
  let post = false;
  let stone15 = false;
  let plaster12 = false;
  let wood102 = false;
  let blueRoof = false;
  let brightTrim = false;
  let aframeCap = false;
  for (const index of cells) {
    for (const tile of [map.lowerTiles[index] ?? TILE.EMPTY, map.upperTiles[index] ?? TILE.EMPTY]) {
      if (tile === TILE.EMPTY) continue;
      if (POST_TILES.has(tile)) post = true;
      if (WALL_STONE_15.has(tile)) stone15 = true;
      if (WALL_PLASTER_12.has(tile)) plaster12 = true;
      if (WALL_WOOD_102.has(tile)) wood102 = true;
      if (BLUE_ROOF_TILES.has(tile)) blueRoof = true;
      if (BRIGHT_ROOF_TRIM.has(tile)) brightTrim = true;
      if (AFRAME_ROOF_TILES.has(tile)) aframeCap = true;
    }
  }
  if (post) return "timber-hall";
  if (blueRoof) return wood102 ? "slate-wood" : stone15 ? "blue-stone" : null;
  if (brightTrim) return wood102 ? "amber-wood" : plaster12 ? "bright-plaster" : null;
  if (aframeCap) return plaster12 ? "aframe-stone" : wood102 ? "amber-wood" : null;
  return null;
}

function findDoor(map: GameMap, cells: readonly number[]): HousePoint | null {
  for (const index of cells) {
    if ((map.lowerTiles[index] ?? TILE.EMPTY) !== DOOR_BOTTOM_TILE) continue;
    return { x: index % map.width, y: Math.floor(index / map.width) };
  }
  return null;
}

function hasChimney(map: GameMap, cells: readonly number[]): boolean {
  return cells.some((index) => (map.upperTiles[index] ?? TILE.EMPTY) === CHIMNEY_TILE);
}

/** 옥상 데크는 스탬퍼가 아니라 applyRoofDeck 이 나중에 얹는다 — 판자로 되읽는다. */
function hasRoofDeck(map: GameMap, cells: readonly number[]): boolean {
  return cells.some((index) => (map.upperTiles[index] ?? TILE.EMPTY) === ROOF_DECK_PLANK);
}

/** 맵(또는 그 일부)에 실제로 서 있는 집을 되읽는다. */
export function detectHouses(map: GameMap, bounds?: HouseRect): readonly DetectedHouse[] {
  const area = clampBounds(map, bounds);
  const catalog = catalogSignatures();
  return connectedComponents(map, area).map((component, index) => {
    const shapeKey = shapeSignature(map, component);
    const kitId = classifyKit(map, component.cells);
    const templateId = kitId === null ? null : catalog.get(`${kitId}|${shapeKey}`) ?? null;
    return {
      index,
      bbox: component.bbox,
      cells: component.cells.length,
      kitId,
      roofColor: kitId === null ? null : roofColorForKit(kitId),
      templateId,
      shapeKey,
      wallRows: wallRowCount(map, component),
      doorAt: findDoor(map, component.cells),
      chimney: hasChimney(map, component.cells),
      roofDeck: hasRoofDeck(map, component.cells),
    };
  });
}

// ── 카탈로그 서명 표 ─────────────────────────────────────────────────────────

let CATALOG_SIGNATURE_CACHE: ReadonlyMap<string, string> | undefined;

/**
 * 34종 × 킷 × 층수를 스크래치 맵에 실제로 시공해 서명 표를 만든다.
 * 감지와 **같은** shapeSignature 를 쓰므로 매칭에 허용오차가 없다.
 * 키에 kitId 를 붙이는 이유: bright 계열 지붕은 용마루를 마스크 위 한 행에 그려서 같은
 * 템플릿이 킷에 따라 다른 높이가 된다. 킷을 섞어 담으면 rect-tall+amber(7×9)가
 * rect-2f+blue(7×9)를 가로챈다(2026-08-31 실측).
 * 선언 층수(def.stories)를 먼저 등록해 같은 키가 겹칠 때 카탈로그 기본형이 이기게 한다.
 * 최초 호출 때 한 번만 계산한다(작은 맵 수백 장 — 무시할 비용).
 */
function catalogSignatures(): ReadonlyMap<string, string> {
  if (CATALOG_SIGNATURE_CACHE) return CATALOG_SIGNATURE_CACHE;
  const table = new Map<string, string>();
  for (const def of HOUSE_TEMPLATE_DEFS) {
    const kitIds: readonly HouseKitId[] = def.kitId ? [def.kitId] : MIXABLE_HOUSE_KIT_IDS;
    const storyOptions: readonly (1 | 2 | 3)[] = def.lowWall ? [1] : [...new Set<1 | 2 | 3>([def.stories ?? 1, 1, 2, 3])];
    for (const kitId of kitIds) {
      for (const stories of storyOptions) {
        const stamp = { templateId: def.id, wings: def.wings, kitId, stories, lowWall: def.lowWall === true, roofDeck: def.roofDeck === true };
        for (const signature of stampSignatures(stamp)) {
          const key = `${kitId}|${signature}`;
          if (!table.has(key)) table.set(key, def.id);
        }
      }
    }
  }
  CATALOG_SIGNATURE_CACHE = table;
  return table;
}

function stampBBox(wings: readonly HouseRect[]): HouseRect {
  const x = Math.min(...wings.map((wing) => wing.x));
  const y = Math.min(...wings.map((wing) => wing.y));
  const right = Math.max(...wings.map((wing) => wing.x + wing.w));
  const bottom = Math.max(...wings.map((wing) => wing.y + wing.h));
  return { x, y, w: right - x, h: bottom - y };
}

type CatalogStamp = {
  readonly templateId: string;
  readonly wings: readonly HouseRect[];
  readonly kitId: HouseKitId;
  readonly stories: 1 | 2 | 3;
  readonly lowWall: boolean;
  readonly roofDeck: boolean;
};

function stampSignatures(stamp: CatalogStamp): readonly string[] {
  const { templateId, wings, kitId, stories, lowWall } = stamp;
  // 용마루(bbox.y-1)·처마·데크 사다리(bbox 하단+1)가 맵 밖으로 나가지 않게 여백 2칸을 둔다.
  const pad = 2;
  const width = Math.max(...wings.map((wing) => wing.x + wing.w)) + pad * 2;
  const height = Math.max(...wings.map((wing) => wing.y + wing.h)) + pad * 2;
  const scratch = {
    id: `scratch_${templateId}_${kitId}_${stories}`,
    name: templateId,
    width,
    height,
    lowerTiles: new Array<number>(width * height).fill(TILE.EMPTY),
    upperTiles: new Array<number>(width * height).fill(TILE.EMPTY),
    events: [],
  } as unknown as GameMap;
  const placed = wings.map((wing) => ({ x: wing.x + pad, y: wing.y + pad, w: wing.w, h: wing.h }));
  const result = stampFootprintHouseKit(scratch, {
    kitId,
    stories,
    ...(lowWall ? { lowWall: true } : {}),
    wings: placed,
  });
  if (!result.ok) return [];
  // 데크는 스탬퍼 밖(houseKitDomain → applyRoofDeck)에서 얹히므로 서명 표도 같은 순서로 얹는다.
  if (stamp.roofDeck && result.doorAt) applyRoofDeck(scratch, stampBBox(placed), result.doorAt);
  // 문 유/무 두 가지 마스크를 모두 등록한다 — 문은 벽 타일을 덮어써 마스크를 바꾸지 않지만,
  // door:false 로 시공된 집과 문짝이 길에 지워진 집을 같은 모양으로 보게 하는 보험이다.
  const signatures = new Set<string>();
  const collect = (): void => {
    for (const component of connectedComponents(scratch, { x: 0, y: 0, w: width, h: height })) {
      signatures.add(shapeSignature(scratch, component));
    }
  };
  collect();
  if (result.doorAt) {
    scratch.lowerTiles[(result.doorAt.y - 1) * width + result.doorAt.x] = DOOR_TOP_TILE;
    scratch.lowerTiles[result.doorAt.y * width + result.doorAt.x] = DOOR_BOTTOM_TILE;
    collect();
  }
  return [...signatures];
}

// ── 리포트 ───────────────────────────────────────────────────────────────────

function tally<T>(values: readonly T[]): (readonly [T, number])[] {
  const counts = new Map<T, number>();
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || String(a[0]).localeCompare(String(b[0])));
}

/** 모양 표기 — 카탈로그 id 가 있으면 그것, 없으면 치수(custom 8x7). */
export function shapeLabel(house: DetectedHouse): string {
  return house.templateId ?? `custom ${house.bbox.w}x${house.bbox.h}`;
}

export function houseVarietyReport(houses: readonly DetectedHouse[]): HouseVarietyReport {
  const shapes = tally(houses.map((house) => shapeLabel(house)));
  const kits = tally(houses.flatMap((house) => (house.kitId === null ? [] : [house.kitId])));
  const roofColors = tally(houses.flatMap((house) => (house.roofColor === null ? [] : [house.roofColor])));
  const repeatedShapes = shapes.filter(([, count]) => count > 1);
  const repeatedKits = kits.filter(([, count]) => count > 1);
  const usedTemplateIds = new Set(houses.flatMap((house) => (house.templateId === null ? [] : [house.templateId])));
  const usedKitIds = new Set(houses.flatMap((house) => (house.kitId === null ? [] : [house.kitId])));
  const unusedTemplateIds = HOUSE_TEMPLATE_DEFS.map((def) => def.id).filter((id) => !usedTemplateIds.has(id));
  const unusedKitIds = (Object.keys(HOUSE_KITS) as HouseKitId[]).filter((id) => !usedKitIds.has(id));

  const distinctShapes = shapes.length;
  const distinctKits = kits.length;
  const distinctRoofColors = roofColors.length;
  // 목표선: 집 수의 60% 이상이 서로 다른 모양이면 diverse. 모양이 1종이면 무조건 monotonous.
  const shapeTarget = Math.max(1, Math.ceil(houses.length * 0.6));
  const verdict: HouseVarietyReport["verdict"] = houses.length <= 1
    ? "diverse"
    : distinctShapes <= 1
      ? "monotonous"
      : distinctShapes >= shapeTarget && distinctRoofColors >= Math.min(2, houses.length)
        ? "diverse"
        : "mixed";

  const advice: string[] = [];
  if (houses.length > 1 && distinctShapes <= 1) {
    advice.push(
      `집 ${houses.length}채가 모두 같은 모양(${shapes[0]?.[0] ?? "?"})이다. `
      + `author_house 의 templateId 로 모양을 바꿔라 — 예: ${unusedTemplateIds.slice(0, 6).join(", ")}.`,
    );
  } else if (repeatedShapes.length > 0) {
    advice.push(
      `모양 반복: ${repeatedShapes.map(([id, count]) => `${id}×${count}`).join(", ")}. `
      + `아직 안 쓴 모양: ${unusedTemplateIds.slice(0, 8).join(", ")}.`,
    );
  }
  if (houses.length > 1 && distinctRoofColors <= 1 && distinctKits > 0) {
    advice.push(
      `지붕색이 ${roofColors[0]?.[0] ?? "?"} 한 가지다. kitId 6종은 지붕색 3가지(blue: blue-stone·slate-wood / `
      + `orange: bright-plaster·amber-wood / red: timber-hall·aframe-stone)로 접히니 색군을 섞어라.`,
    );
  } else if (repeatedKits.length > 0 && unusedKitIds.length > 0) {
    advice.push(`안 쓴 킷: ${unusedKitIds.join(", ")}.`);
  }
  if (houses.length > 2 && !houses.some((house) => house.chimney)) {
    advice.push("굴뚝이 한 채도 없다 — chimney:true 로 실루엣에 변화를 줄 수 있다.");
  }
  if (advice.length === 0) advice.push("모양·지붕색이 충분히 갈렸다. 추가 조정 없이 진행해도 된다.");

  return {
    houses: houses.length,
    distinctShapes,
    distinctKits,
    distinctRoofColors,
    shapeCounts: shapes,
    kitCounts: kits,
    roofColorCounts: roofColors,
    repeatedShapes,
    repeatedKits,
    unusedTemplateIds,
    unusedKitIds,
    verdict,
    advice,
  };
}

/** 한 줄 요약 — 툴 summary/경고에 그대로 싣는다. */
export function houseVarietySummary(report: HouseVarietyReport): string {
  return `집 ${report.houses}채 · 모양 ${report.distinctShapes}종 · 킷 ${report.distinctKits}종 · `
    + `지붕색 ${report.distinctRoofColors}종 → ${report.verdict}`;
}
