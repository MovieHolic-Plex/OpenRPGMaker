// 숲 합성 — "빽빽한 숲"을 한 재료로 심지 않고 수종·덤불·하층식생으로 조립한다.
//
// 왜 필요한가 (2026-08-30 렌더 실측): 밀도만 올리고 한 재료(침엽수)를 packing:"dense" 로
// 깔면 (1) 1칸 침엽수의 수관이 다음 나무의 수관 위에 바로 얹혀 **밑동이 안 보이는 세로 사슬**이
// 되고 (2) 같은 스프라이트가 231번 반복되고 (3) 틈이 맨 잔디 단색이라 "산울타리 밭"으로 읽혔다.
// 숲은 수관 모양이 섞이고, 나무마다 밑동이 보이고, 바닥에 하층식생이 깔려야 숲으로 읽힌다.

import { CHIPSET_TILE_GROUPS } from "@/project/defaults/chipsetMapping";
import { TILE } from "@/project/defaults/constants";
import { isTreeCanopyTileId, isTreeTrunkTileId } from "@/project/tilesetHarness";
import { resolveMaterialByLabel } from "@/project/tileVocabulary";
import type { GameMap, Project } from "@/project/types";
import { mulberry32 } from "@/util/rng";
import { forestCoverageTarget, type ForestDensity } from "./forestDensity";
import { inMapBounds, reachableCells } from "./mapHelpers";
import { placePropsOnDraft } from "./placePropsDomain";
import { isPathSurfaceTile, protectedEventCells } from "./placementTools";
import { tilePassability } from "@/project/collision";
import { isLakeAutotileTile } from "@/project/defaults/lakeAutotile";

const TALL_GRASS_TILES: readonly number[] = CHIPSET_TILE_GROUPS.tallGrass;

type Rect = { readonly x: number; readonly y: number; readonly w: number; readonly h: number };

/** 하층식생 라벨 — 실제 타일셋에서 이 이름으로 조회한다(칩셋마다 타일 번호가 다르다). */
const UNDERGROWTH_LABEL = "키큰 풀";

/**
 * impassable 의 틈을 닫는 재료 — 통행 불가 1칸 식생.
 * "꽃 덤불"(288)은 이 칩셋에서 흰 블록으로 렌더돼(실측) 넣지 않는다.
 */
const BLOCKING_BUSH_LABELS: readonly string[] = ["덤불"];

/**
 * repairTreePairs 가 보존할 수 있는 타일은 숲 합성이 gap closure에 실제로 쓰는 blocking-bush
 * id뿐이다. 라벨을 현재 타일셋에서 다시 풀어 일반 가구·상자·장식까지 예외가 넓어지지 않게 한다.
 */
export function resolveForestCanopyReplacementExemptTileIds(project: Project): ReadonlySet<number> {
  const tileIds = new Set<number>();
  for (const map of Object.values(project.maps)) {
    const tileset = project.tilesets[map.tilesetId];
    if (!tileset) continue;
    for (const label of BLOCKING_BUSH_LABELS) {
      const access = resolveMaterialByLabel(tileset, label, { preferGroup: false, preferRoles: ["prop", "decoration"] });
      if (access.status === "missing" || access.kind === "group") continue;
      const pass = tilePassability(tileset, TILE.GRASS, access.tileId);
      if (!pass.up && !pass.down && !pass.left && !pass.right) tileIds.add(access.tileId);
    }
  }
  return tileIds;
}

/**
 * 수종 지분. 왜 덤불이 끼는가: 밑동을 보이게 하면 나무 한 그루가 세로 2칸(수관+밑동)을 쓰므로
 * 통행을 막는 칸은 최대 절반이다(실측: 밑동 규칙만 넣은 침엽수 dense = 통행 가능 50.0%).
 * 덤불(1칸·solid)은 밑동이 없어 그 상한에 걸리지 않는다 — 울창함을 실제 통행 차단으로
 * 되돌리는 유일한 자연 재료다.
 *
 * 지분 합을 1 미만으로 남긴 이유: 수관으로 전면을 달아 버리면 밑동도 하층식생도 안 보여
 * 평평해진다(실측: 커버리지 100% 렌더는 바닥이 사라진 수관 통통이었다).
 */
/**
 * 밑동이 보이는 숲에서 나무 하나가 실제로 잡는 **맵 칸** 수.
 *
 * `treeFootprintCells` 와 다른 이유(실측): 그 함수는 수관이 남의 밑동 칸에 곹치는 예전 셈을
 * 전제해 침엽수를 1칸으로 셀다. 밑동을 보이게 하면 침엽수는 수관칸+밑동칸 = 2칸,
 * 2×2 활엽수는 4칸을 단독으로 쓴다. 1·2 로 세면 그루 수가 두 배가 되어 영역이 수관으로
 * 전부 달리고(커버리지 100%) 바닥이 한 칸도 안 보인다.
 */
const VISIBLE_TRUNK_CELLS = { "활엽수": 4, "침엽수": 2, "덤불": 1 } as const;

// 지분 실측(24×24, 밑동 보이는 규칙): 덤불 0.46 = 커버리지 88% · 통행 가능 37.5% → dense 가
// 아니라 산책로였다. 0.6 = 커버리지 99.5% · 통행 가능 26.2%, 0.7 이상은 자리가 차서 포화한다.
//
// impassable 이 dense 와 같은 배합인 이유: 덤불 지분을 더 올려 막으려 하면(0.7) 나무가 굶어
// 나무 34% · 덤불 밭이 되고 렌더가 "덤불 격자"로 읽혔다. 두 등급의 차이는 **배합이 아니라
// 남은 틈을 닫는지**다 — 같은 숲을 만들고 impassable 만 closeGapsWithBushes 로 통행을 끊는다.
const MIX: Readonly<Record<"dense" | "impassable", { broadleaf: number; conifer: number; bush: number }>> = {
  dense: { broadleaf: 0.3, conifer: 0.34, bush: 0.6 },
  impassable: { broadleaf: 0.3, conifer: 0.34, bush: 0.6 },
};

export type ForestCompositionResult = {
  readonly placed: number;
  readonly requested: number;
  readonly materials: readonly string[];
  readonly undergrowthCells: number;
  readonly warnings: readonly string[];
  /** 하위→상위로 옮긴 밑동 칸 수(투명 구멍 방지). */
  readonly liftedTrunks: number;
  /** impassable 에서 덤불로 막은 남은 통행 칸 수. dense 는 항상 0(지나갈 틈을 남긴다). */
  readonly closedGaps: number;
};

export function forestCompositionApplies(density: ForestDensity): density is "dense" | "impassable" {
  return density === "dense" || density === "impassable";
}

/**
 * dense·impassable 숲을 조립한다. 큰 원자(2×2 활엽수)를 먼저, 1칸 침엽수, 마지막에 덤불 —
 * 순서를 뒤집으면 2×2 가 들어갈 틈이 없어 군락 품질 게이트가 흔들린다(기존 실측 규칙 유지).
 */
export function plantForestComposition(draft: Project, input: {
  readonly mapId: string;
  readonly area: Rect;
  readonly density: "dense" | "impassable";
  readonly seed: number;
  /** 사용자가 지목한 수종 — 지분을 조금 더 갖는다(요청한 나무가 주인공으로 보이게). */
  readonly primary?: "침엽수" | "활엽수";
}): ForestCompositionResult {
  const map = draft.maps[input.mapId];
  if (!map) {
    return {
      placed: 0, requested: 0, materials: [], undergrowthCells: 0,
      warnings: [`맵 없음: ${input.mapId}`], liftedTrunks: 0, closedGaps: 0,
    };
  }
  const cells = Math.max(0, Math.floor(input.area.w)) * Math.max(0, Math.floor(input.area.h));
  const targetCells = Math.ceil(cells * forestCoverageTarget(input.density));
  const mix = shareWithPrimary(MIX[input.density], input.primary);
  const warnings: string[] = [];
  const materials: string[] = [];
  let placed = 0;
  let requested = 0;

  const layers = [
    { material: "활엽수" as const, share: mix.broadleaf },
    { material: "침엽수" as const, share: mix.conifer },
    { material: "덤불" as const, share: mix.bush },
  ];
  for (let index = 0; index < layers.length; index += 1) {
    const layer = layers[index]!;
    const count = Math.max(1, Math.round((targetCells * layer.share) / VISIBLE_TRUNK_CELLS[layer.material]));
    requested += count;
    try {
      const result = placePropsOnDraft(draft, {
        mapId: input.mapId,
        area: input.area,
        material: layer.material,
        count,
        minGap: 0,
        packing: "dense",
        trunkVisible: true,
        seed: input.seed + index * 101,
      });
      const layerPlaced = Number((result.data as { placed?: number } | undefined)?.placed ?? 0);
      if (layerPlaced > 0) materials.push(layer.material);
      placed += layerPlaced;
    } catch (error) {
      warnings.push(error instanceof Error ? error.message : String(error));
    }
  }

  const lifted = liftTrunksToUpper(map, input.area);
  // impassable 만 남은 틈을 닫는다 — dense 는 "지나갈 수 있는 두꺼운 숲", impassable 은 "못 지나감".
  const closedGaps = input.density === "impassable"
    ? closeGapsWithBushes(draft, map, input.area, input.seed)
    : 0;
  const undergrowthCells = paintUndergrowth(draft, map, input.area, input.seed);
  return { placed, requested, materials, undergrowthCells, warnings, liftedTrunks: lifted, closedGaps };
}

/**
 * 밑동을 하위→상위 레이어로 옮기고 그 칸에 지면을 되돌린다.
 *
 * 왜 필요한가 (렌더 실측): 재료 상 밑동(290/292/293)은 solid 이라 어효 layerHome 이 하위이다.
 * 하위에 올리면 밑동 칩의 **투몥 화소가 그냥 구멍**이 된다 — 수관을 올리지 않자마자
 * 밑동 자리마다 헬 바닥이 드러나 학 상자로 보여다. 예전 디자인이 수관을 밑동 위에 곹치던
 * 진짜 이유가 이것이다(그 대가로 나무가 안 보이게 됐다).
 * `skyStairMaps.ts` 가 이밌 배운 방식이 정답이다 — 나무는 상위로, 하위에는 지면을 남긴다.
 * 통행은 그대로다 — 상위 solid 이 합성 passability 를 지배한다.
 */
function liftTrunksToUpper(map: GameMap, area: Rect): number {
  let lifted = 0;
  for (let y = area.y; y < area.y + area.h; y += 1) {
    for (let x = area.x; x < area.x + area.w; x += 1) {
      if (!inMapBounds(map, x, y)) continue;
      const index = y * map.width + x;
      const lower = map.lowerTiles[index] ?? TILE.EMPTY;
      if (!isTreeTrunkTileId(lower)) continue;
      if ((map.upperTiles[index] ?? TILE.EMPTY) !== TILE.EMPTY) continue;
      map.upperTiles[index] = lower;
      map.lowerTiles[index] = TILE.GRASS;
      lifted += 1;
    }
  }
  return lifted;
}

/**
 * impassable 전용 — 밖에서 **걸어 들어올 수 있는** 칸만 덤불로 닫는다.
 *
 * 왜 이 형태인가 (실측 2026-08-30):
 * - 수관 타일(침엽수 상단·활엽수 상단 2칸)은 칩셋에서 4방향 통행 가능이다 — 주인공이 나무 뒤로
 *   지나가는 RM2003 관례다. 그래서 나무는 **밑동 칸 하나만** 막고, 나무만 심으면 62% 차단이
 *   천장이다("통행 불가"라는 말과 다르다).
 * - 칸을 막는 유일한 방법은 상위 레이어에 막는 칩(덤불·밑동)을 두는 것이다. 하위에 식생 칩을
 *   깔면 투명 픽셀 아래 지면이 없어 흰 구멍이 뚫린다(121칸이 흰 블록으로 렌더된 걸 확인했다).
 *   상위는 칸당 하나뿐이라(스택은 폐기된 개념이다) 수관과 덤불은 같은 칸에 공존할 수 없다.
 * - 즉 "모든 칸 통행 불가"와 "수관이 보이는 숲"은 이 데이터 모델에서 동시에 불가능하다.
 *
 * 그래서 전부 덮지 않고 **경로**를 끊는다. 영역 경계에 닿은 통행 가능 연결요소만 덤불로 닫고,
 * 사방이 막혀 밖에서 닿지 않는 안쪽 주머니는 수관 그대로 남긴다 — 지나갈 수 없다는 약속은
 * 지키면서 나무 그루는 살린다. 시각 다양성을 위해 덤불·꽃덤불을 seed 로 섞는다(한 스프라이트로
 * 도배하면 "벽"으로 읽힌다). 시작칸·이벤트칸·길·물은 건드리지 않는다 — 무결성 게이트가 커밋을
 * 거부하고, 지나갈 길을 남기는 것은 편집자의 선택이어야 한다.
 */
function closeGapsWithBushes(draft: Project, map: GameMap, area: Rect, seed: number): number {
  const tileset = draft.tilesets[map.tilesetId];
  if (!tileset) return 0;
  const variants: number[] = [];
  for (const label of BLOCKING_BUSH_LABELS) {
    const access = resolveMaterialByLabel(tileset, label, { preferGroup: false, preferRoles: ["prop", "decoration"] });
    if (access.status === "missing" || access.kind === "group") continue;
    // 통행 가능한 식생(꽃·풀)으로는 틈을 닫을 수 없다 — 칩셋마다 다르므로 실제 passability 를 본다.
    const pass = tilePassability(tileset, TILE.GRASS, access.tileId);
    if (pass.up || pass.down || pass.left || pass.right) continue;
    variants.push(access.tileId);
  }
  if (variants.length === 0) return 0;

  const protectedCells = protectedEventCells(draft, map);
  const closable = (x: number, y: number): boolean => {
    if (!inMapBounds(map, x, y)) return false;
    if (protectedCells.has(`${x},${y}`)) return false;
    const lower = map.lowerTiles[y * map.width + x] ?? TILE.EMPTY;
    return !isLakeAutotileTile(lower) && !isPathSurfaceTile(lower);
  };

  // 경계에서 걸어 들어올 수 있는 칸을 모은다 — 이 연결요소만 닫으면 경로가 끊긴다.
  const reached = reachableCells(draft, map, area);
  let closed = 0;
  for (const cell of reached) {
    if (!closable(cell.x, cell.y)) continue;
    const index = cell.y * map.width + cell.x;
    const hash = Math.imul(cell.x * 0x1f1f1f1f ^ cell.y * 0x85ebca6b ^ seed, 0xc2b2ae35) >>> 0;
    map.upperTiles[index] = variants[hash % variants.length]!;
    closed += 1;
  }
  return closed;
}

function shareWithPrimary(
  base: { broadleaf: number; conifer: number; bush: number },
  primary: "침엽수" | "활엽수" | undefined,
): { broadleaf: number; conifer: number; bush: number } {
  if (primary === undefined) return base;
  const boost = 0.08;
  return primary === "활엽수"
    ? { broadleaf: base.broadleaf + boost, conifer: Math.max(0.05, base.conifer - boost), bush: base.bush }
    : { broadleaf: Math.max(0.05, base.broadleaf - boost), conifer: base.conifer + boost, bush: base.bush };
}

/**
 * 나무 사이 맨 잔디를 하층식생으로 덮는다. 잔디 한 종류만 깔린 숲은 나무를 아무리 심어도
 * 평평하다(`src/editor/content/skyStairMaps.ts` 가 같은 실측으로 먼저 배운 규칙).
 *
 * 통행성은 건드리지 않는다 — `키큰 풀` 은 잔디와 같은 passable 이고, 밑동·길·물·상위 소품이
 * 있는 칸은 손대지 않는다. 그래서 밀도가 요구한 것보다 더 막히는 일이 없다.
 */
function paintUndergrowth(draft: Project, map: GameMap, area: Rect, seed: number): number {
  const tileset = draft.tilesets[map.tilesetId];
  if (!tileset) return 0;
  const access = resolveMaterialByLabel(tileset, UNDERGROWTH_LABEL, { preferGroup: true, preferRoles: ["terrain"] });
  const variants = access.status === "missing"
    ? []
    : access.kind === "group"
      ? access.group.tileIds.filter((tile) => TALL_GRASS_TILES.includes(tile))
      : [access.tileId];
  if (variants.length === 0) return 0;

  const rng = mulberry32((seed ^ 0x51f7) >>> 0);
  // 값 노이즈 대신 셀별 결정적 해시 — 같은 seed·좌표면 같은 변형이 나오고 덩어리도 생긴다.
  const noise = (x: number, y: number): number => {
    const hash = Math.imul(x * 73856093 ^ y * 19349663 ^ seed, 0x27d4eb2d) >>> 0;
    return (hash % 1024) / 1024;
  };
  const grass = new Set<number>([TILE.GRASS, ...CHIPSET_TILE_GROUPS.grassGround, ...TALL_GRASS_TILES]);
  let painted = 0;
  for (let y = area.y; y < area.y + area.h; y += 1) {
    for (let x = area.x; x < area.x + area.w; x += 1) {
      if (!inMapBounds(map, x, y)) continue;
      const index = y * map.width + x;
      const lower = map.lowerTiles[index] ?? TILE.EMPTY;
      const upper = map.upperTiles[index] ?? TILE.EMPTY;
      if (!grass.has(lower)) continue;
      if (isLakeAutotileTile(lower) || isPathSurfaceTile(lower)) continue;
      if (isTreeTrunkTileId(lower) || isTreeTrunkTileId(upper)) continue;
      // 수관 아래도 칠한다 — 수관은 투명 칩이라 바닥이 그대로 비친다.
      if (upper !== TILE.EMPTY && !isTreeCanopyTileId(upper)) continue;
      if (noise(x, y) < 0.18) continue;
      const variant = variants[Math.floor(rng() * variants.length)] ?? variants[0]!;
      // setLower 는 같은 칸 upper 를 비운다 — 수관을 지우면 안 되므로 하위만 직접 쓴다.
      map.lowerTiles[index] = variant;
      painted += 1;
    }
  }
  return painted;
}

// 나무와 덤불은 다른 것이다. 한 집합으로 묶어 "나무 덮은 비율"이라 보고하면 덤불·꽃덤불을
// 나무로 세어 실적을 부풀린다(실측 2026-08-30: 합성 숲이 "나무 100%"로 보고됐지만 실제 나무
// 타일은 51.5%였고 나머지는 덤불이었다). 허위 완료 금지 원칙에 따라 층을 나눠 센다.
const TREE_CANOPY_TILES = new Set([260, 261, 262, 263]);
const TREE_TRUNK_TILES = new Set([290, 291, 292, 293]);
const BUSH_TILES = new Set([288, 289]);
const UNDERGROWTH_TILES = new Set<number>(CHIPSET_TILE_GROUPS.tallGrass);

function isTreeCell(map: GameMap, x: number, y: number): boolean {
  if (x < 0 || y < 0 || x >= map.width || y >= map.height) return false;
  const i = y * map.width + x;
  const u = map.upperTiles[i] ?? 0;
  const l = map.lowerTiles[i] ?? 0;
  return TREE_CANOPY_TILES.has(u) || TREE_TRUNK_TILES.has(l) || TREE_TRUNK_TILES.has(u);
}

export type ForestMeasure = {
  /** 나무·덤불·하층식생 중 하나라도 있는 칸 비율(0~1) — 사용자가 "숲"으로 보는 것. */
  readonly forestCoverage: number;
  /** 실제 나무(수관·밑동) 타일이 있는 칸 비율(0~1). */
  readonly treeCoverage: number;
  readonly treeCells: number;
  readonly bushCells: number;
  readonly undergrowthCells: number;
  readonly cells: number;
};

/**
 * 시공 보고용 실측 — 지정 rect 들을 칸 단위 합집합으로 훑어 **나무·덤불·하층식생을 따로** 센다.
 * 보고 문장은 이 값을 각자의 이름으로 적어야 한다(숲 덮은 비율 ≠ 나무 칸 수).
 */
export function measureForestArea(
  map: GameMap,
  areas: readonly { x: number; y: number; w: number; h: number }[],
): ForestMeasure {
  const seen = new Set<number>();
  let treeCells = 0;
  let bushCells = 0;
  let undergrowthCells = 0;
  let vegetation = 0;
  for (const area of areas) {
    for (let y = area.y; y < area.y + area.h; y += 1) {
      for (let x = area.x; x < area.x + area.w; x += 1) {
        if (x < 0 || y < 0 || x >= map.width || y >= map.height) continue;
        const index = y * map.width + x;
        if (seen.has(index)) continue;
        seen.add(index);
        const upper = map.upperTiles[index] ?? 0;
        const lower = map.lowerTiles[index] ?? 0;
        const tree = isTreeCell(map, x, y);
        const bush = BUSH_TILES.has(upper) || BUSH_TILES.has(lower);
        const undergrowth = UNDERGROWTH_TILES.has(lower);
        if (tree) treeCells += 1;
        if (bush) bushCells += 1;
        if (undergrowth) undergrowthCells += 1;
        if (tree || bush || undergrowth) vegetation += 1;
      }
    }
  }
  const cells = seen.size;
  return {
    forestCoverage: cells === 0 ? 0 : vegetation / cells,
    treeCoverage: cells === 0 ? 0 : treeCells / cells,
    treeCells,
    bushCells,
    undergrowthCells,
    cells,
  };
}
