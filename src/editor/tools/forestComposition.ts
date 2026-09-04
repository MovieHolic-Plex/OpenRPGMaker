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
import type { AutotileGroup, GameMap, Project } from "@/project/types";
import { mulberry32 } from "@/util/rng";
import { forestCoverageTarget, type ForestDensity } from "./forestDensity";
import { inMapBounds, reachableCells } from "./mapHelpers";
import { placePropsOnDraft } from "./placePropsDomain";
import { isPathSurfaceTile, protectedEventCells } from "./placementTools";
import { tilePassability } from "@/project/collision";
import { shapeAutotileGroupAround } from "@/project/defaults/autotileEngine";
import { autotileGroupsForTileset, DEFAULT_UNDERGROWTH_AUTOTILE_GROUP } from "@/project/defaults/autotileGroups";
import { isLakeAutotileTile, LAKE_AUTOTILE_TILE } from "@/project/defaults/lakeAutotile";

const TALL_GRASS_TILES: readonly number[] = CHIPSET_TILE_GROUPS.tallGrass;
const FOREST_FLOOR_LOWER = new Set<number>([
  TILE.GRASS,
  ...CHIPSET_TILE_GROUPS.grassGround,
  ...TALL_GRASS_TILES,
]);

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

// 지분 실측 이력과 2026-08-31 개정:
// 이전 판은 덤불 0.60 이었다. 렌더로 보면 덤불이 250개 깔려 **같은 스프라이트 하나가 격자로
// 반복되는 벽지**가 됐다(사용자 지적의 실체). 덤불 재료는 사실상 단일 칩(289)이다.
//
// 그럼 덤불을 줄이면 되느냐 — 안 된다. 실측(26×20): 나무 중심(0.55/0.30/0.12)은 보기는 좋지만
// 통행 가능 49.8% · 커버리지 69% 로, dense 가 지키기로 한 계약(<30% 통행 · ≥90% 커버리지)을
// 둘 다 깨다. 2×2 나무는 밑동 한 칸만 막고 수관은 통행 가능이라, 지면을 막는 것은 덤불뿐이다.
//
// 스프라이트 다샘화(놓인 덤불 일부를 통나무·그루터기·돌로 교체)도 실측으로 막혔다: 그 칩들은
// 이 칩셋에서 **통행 가능 prop** 이고 treeCoverage 집계에도 안 들어간다 — 한 칸 바꿀 때마다
// 커버리지가 1칸 줄고 그 칸이 다시 열린다(실측: 커버리지 99%→75%, 통행 26%→31%).
// 즉 지면을 막으면서 커버리지로 세어지는 칩은 289 하나뿐이고, dense/impassable 의 수치 계약은
// 그 한 칩을 거의 카펫처럼 깔도록 강제한다. 시각적 반복은 이 계약과 정면으로 충돌한다.
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
  /** dense 에서 가장자리 덤불을 걷어 낸 칸 수. impassable 은 항상 0. */
  readonly feathered: number;
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
      warnings: [`맵 없음: ${input.mapId}`], liftedTrunks: 0, closedGaps: 0, feathered: 0,
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
        // 2×2 활엽수만 원점을 직접 준다 — 큰 원자가 대각선으로 서야 숲의 결이 보인다.
        ...(layer.material === "활엽수"
          ? { origins: staggeredBroadleafOrigins(input.area, input.seed, count) }
          : {}),
      });
      const layerPlaced = Number((result.data as { placed?: number } | undefined)?.placed ?? 0);
      if (layerPlaced > 0) materials.push(layer.material);
      placed += layerPlaced;
    } catch (error) {
      warnings.push(error instanceof Error ? error.message : String(error));
    }
  }

  // 밑동 리프트 없음 — 밑동(290/292/293)은 lower solid 가 정위치다. 상위로 들어올리면
  // 런타임 렌더러의 lower 투명-밑동 잔디 받침(playSceneMapRuntime)이 빗나가 투명 픽셀 구멍이
  // 생긴다. 벤치마크 계약(trunkCellsOf)도 lower 밑동을 기대한다.
  const lifted = 0;
  // impassable 만 남은 틈을 닫는다 — dense 는 "지나갈 수 있는 두꺼운 숲", impassable 은 "못 지나감".
  const closedGaps = input.density === "impassable"
    ? closeGapsWithBushes(draft, map, input.area, input.seed)
    : 0;
  const feathered = input.density === "dense" ? featherForestEdge(draft, map, input.area, input.seed) : 0;
  const undergrowthCells = paintForestFloor(draft, map, input.area, input.seed);
  return { placed, requested, materials, undergrowthCells, warnings, liftedTrunks: lifted, closedGaps, feathered };
}

/**
 * dense 전용 — 영역 가장자리의 막는 덤불을 해시 스트라이드로 걷어 직선 경계를 깨뜨린다.
 * 좁은 도형은 가장자리 비율이 높아 스트라이드를 늘린다.
 */
function featherForestEdge(draft: Project, map: GameMap, area: Rect, seed: number): number {
  const tileset = draft.tilesets[map.tilesetId];
  const bushIds = new Set<number>();
  if (tileset) {
    for (const label of BLOCKING_BUSH_LABELS) {
      const access = resolveMaterialByLabel(tileset, label, { preferGroup: false, preferRoles: ["prop", "decoration"] });
      if (access.status === "missing" || access.kind === "group") continue;
      const pass = tilePassability(tileset, TILE.GRASS, access.tileId);
      if (pass.up || pass.down || pass.left || pass.right) continue;
      bushIds.add(access.tileId);
    }
  }
  if (bushIds.size === 0) bushIds.add(289);

  const edgeCells = 2 * area.w + 2 * area.h - 4;
  const edgeRatio = edgeCells / Math.max(1, area.w * area.h);
  const stride = edgeRatio > 0.4 ? 4 : 2;
  let feathered = 0;
  for (let y = area.y; y < area.y + area.h; y += 1) {
    for (let x = area.x; x < area.x + area.w; x += 1) {
      const onEdge = x === area.x || y === area.y || x === area.x + area.w - 1 || y === area.y + area.h - 1;
      if (!onEdge || !inMapBounds(map, x, y)) continue;
      const index = y * map.width + x;
      if (!bushIds.has(map.upperTiles[index] ?? TILE.EMPTY)) continue;
      const hash = Math.imul(x * 0x1f1f1f1f ^ y * 0x85ebca6b ^ seed, 0xc2b2ae35) >>> 0;
      if (hash % stride !== 0) continue;
      map.upperTiles[index] = TILE.EMPTY;
      feathered += 1;
    }
  }
  return feathered;
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
/**
 * 2×2 활엽수 원점 — **대각 엇갈림 격자**.
 *
 * 왜 격자를 직접 만드는가 (2026-08-31 사용자 지적): 배치기가 후보를 고르면(행 우선이든 시드
 * 셔플이든) 2×2 원자가 가로로 줄을 맞추거나 뭉쳐서 "나무 몇 줄"로 읽혔다. 사용자가 원한 결은
 * **2×2 나무가 대각선으로 서고 그 사이로 다른 것이 엮이는** 숲이다.
 *
 * 규칙: 가로 3칸(2 + 틈 1)·세로 3칸 간격의 격자에 행마다 x 를 1칸씩 누적 이동시킨다 —
 * 누적이므로 원자들이 ↘ 방향 대각선을 이룬다(행마다 0,1,2,0,1,2… 로 감는다). 완전한 자를 대면
 * 기계적이라 시드 지터를 ±1 준다. 지터는 격자 주기(3)보다 작아 대각선 결은 유지된다.
 */
function staggeredBroadleafOrigins(area: Rect, seed: number, limit: number): readonly { x: number; y: number }[] {
  const STEP = 3;
  const rng = mulberry32((seed ^ 0x2ac1) >>> 0);
  const origins: { x: number; y: number }[] = [];
  let row = 0;
  for (let y = area.y; y < area.y + area.h - 1; y += STEP) {
    const shift = row % STEP;
    for (let x = area.x + shift; x < area.x + area.w - 1; x += STEP) {
      const jitterX = rng() < 0.34 ? (rng() < 0.5 ? -1 : 1) : 0;
      const jitterY = rng() < 0.22 ? (rng() < 0.5 ? -1 : 1) : 0;
      origins.push({
        x: Math.max(area.x, Math.min(area.x + area.w - 2, x + jitterX)),
        y: Math.max(area.y, Math.min(area.y + area.h - 2, y + jitterY)),
      });
    }
    row += 1;
  }
  // 격자 순서 그대로면 앞줄만 채우고 count 에서 끊긴다 — 셔플해 영역 전체에 골고루 남긴다.
  for (let i = origins.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = origins[i]!;
    origins[i] = origins[j]!;
    origins[j] = tmp;
  }
  return origins.slice(0, Math.max(limit, Math.ceil(limit * 1.6)));
}

/**
 * 숲 바닥에 엮는 재료 — 스와치 실측(2026-08-31)으로 고른 것만 쓴다.
 *
 * 왜 지면 타일이 아니라 **투명 스프라이트**인가: `groundDetail`(402 분홍 흙 · 432/433 회색 자갈)은
 * 칸 전체를 채우는 하드 엣지 사각형이라 한 칸씩 흩으면 잔디 위에 **분홍·회색 네모**가 뜬다
 * (렌더 실측: 글리치로 읽혔다). 통나무·그루터기·돌·들꽃은 투명 배경 스프라이트라 잔디에 얹혀도
 * 경계가 안 보이고 숲 바닥의 잡동사니로 읽힌다.
 *
 * 제외한 것: `smallObjects` 의 349(문짝)·350(새집)·351(화분)·352(항아리)와 `upperObjects` 전부는
 * 사람이 만든 물건이라 숲에 두면 마을처럼 보인다. `stakeObjects`(378·408·438)는 울타리 말뚝이다.
 */
const FLOOR_LITTER: readonly number[] = [
  259, // 쓰러진 통나무·마른 가지
  440, // 그루터기
  319, // 작은 돌
  348, // 들꽃
];

/** 바닥 톤을 바꾸는 짙은 풀 — 점무늬 변형은 넓게 깔면 벽지가 되므로 진한 단색 위주로 쓴다. */
const FLOOR_DARK_GRASS: readonly number[] = [245, 275, 335];

/**
 * 숲 바닥 — 잔디 한 종류가 아니라 **여러 재료를 엮는다**.
 *
 * 왜 (2026-08-31 사용자 지적): 잔디만 깔린 숲은 나무를 아무리 심어도 평평하다.
 * `skyStairMaps.ts` 가 이미 적어 둔 교훈이고, 밀도 작업이 그걸 놓쳤다.
 *
 * 전체 파이프라인은 `plantForestComposition` 이 정한다: 나무 심기 → 틈 닫기/가장자리
 * 다듬기 → 여기 바닥 칠하기(톤 → 잡동사니 → 짙은 수풀 → 웅덩이). 그러므로:
 * 1. **바닥 톤** — 짙은 풀을 저주파 얼룩으로 깔아 밝고 어두운 결을 만든다. 칸마다 독립 난수를
 *    쓰면 소금후추처럼 지저분하고, 넓게 채우면 점무늬 벽지가 된다 — 얼룩 임계로 덩어리를 만든다.
 * 2. **잡동사니** — 통나무·그루터기·돌·들꽃을 상위 레이어에 드물게 얹는다. 상위가 빈 칸에만
 *    얹어 수관·덤불을 지우지 않고, 보호셀(시작칸·이벤트)은 반드시 건너뛴다 — 여기서 막는 칩을
 *    올리면 시공 제안이 통째로 반려된다(단일 타일 경로에서 이미 겪은 결함이다).
 * 3. **짙은 수풀 오토타일**(앵커 9) — 키큰 풀 톤과 다른 바닥. 드물게 작은 덩어리로만 깐다.
 * 4. **작은 물웅덩이** — 맨바닥에만 찍어 기존 것을 지우지 않으므로 안 나올 수도 있다.
 */
function paintForestFloor(draft: Project, map: GameMap, area: Rect, seed: number): number {
  const tileset = draft.tilesets[map.tilesetId];
  if (!tileset) return 0;
  const access = resolveMaterialByLabel(tileset, UNDERGROWTH_LABEL, { preferGroup: true, preferRoles: ["terrain"] });
  const inChipset = (tile: number): boolean => TALL_GRASS_TILES.includes(tile);
  const tall = access.status === "missing"
    ? []
    : access.kind === "group"
      ? access.group.tileIds.filter(inChipset)
      : [access.tileId];
  // 짙은 단색 변형이 있으면 그것만, 없으면 조회된 것을 그대로 쓴다.
  const tone = FLOOR_DARK_GRASS.filter((tile) => tall.includes(tile));
  const toneTiles = tone.length > 0 ? tone : tall;

  const protectedCells = protectedEventCells(draft, map);
  const rng = mulberry32((seed ^ 0x51f7) >>> 0);
  /** 저주파 얼룩 — 주기가 다른 두 해시를 겹쳐 덩어리를 만든다. */
  const blob = (x: number, y: number, salt: number): number => {
    const a = Math.imul((Math.floor(x / 3) * 73856093) ^ (Math.floor(y / 3) * 19349663) ^ (seed + salt), 0x27d4eb2d) >>> 0;
    const b = Math.imul((Math.floor(x / 7) * 83492791) ^ (Math.floor(y / 5) * 2971215073) ^ (seed + salt * 7), 0x165667b1) >>> 0;
    return ((a % 1024) / 1024) * 0.6 + ((b % 1024) / 1024) * 0.4;
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

      if (toneTiles.length > 0 && blob(x, y, 3) > 0.55) {
        map.lowerTiles[index] = toneTiles[Math.floor(rng() * toneTiles.length)] ?? toneTiles[0]!;
        painted += 1;
      }
      // 잡동사니는 빈 상위 칸에만, 보호셀은 건너뛴다.
      if (upper !== TILE.EMPTY) continue;
      if (protectedCells.has(`${x},${y}`)) continue;
      if (rng() >= 0.11) continue;
      map.upperTiles[index] = FLOOR_LITTER[Math.floor(rng() * FLOOR_LITTER.length)] ?? FLOOR_LITTER[0]!;
      painted += 1;
    }
  }
  painted += scatterUndergrowthAutotile(draft, map, area, seed);
  painted += scatterForestPuddles(draft, map, area, seed);
  return painted;
}

function undergrowthAutotileGroup(draft: Project, map: GameMap): AutotileGroup {
  return autotileGroupsForTileset(draft.tilesets[map.tilesetId]).find((group) => group.id === "builtin_undergrowth")
    ?? DEFAULT_UNDERGROWTH_AUTOTILE_GROUP;
}

function undergrowthBodyTile(group: AutotileGroup): number {
  return group.variantMap["255"] ?? group.memberTileIds[0] ?? 70;
}

function isForestFloorLower(tile: number, extra?: ReadonlySet<number>): boolean {
  return FOREST_FLOOR_LOWER.has(tile) || extra?.has(tile) === true;
}

function patchCount(cells: number, every: number, minArea: number, max: number): number {
  if (cells < minArea) return 0;
  return Math.min(max, Math.max(1, Math.round(cells / every)));
}

function shuffledPatchOrigins(area: Rect, patchW: number, patchH: number, inset: number, rng: () => number): { x: number; y: number }[] {
  const x0 = area.x + inset;
  const y0 = area.y + inset;
  const x1 = area.x + area.w - patchW - inset;
  const y1 = area.y + area.h - patchH - inset;
  const origins: { x: number; y: number }[] = [];
  if (x1 < x0 || y1 < y0) return origins;
  for (let y = y0; y <= y1; y += 1) {
    for (let x = x0; x <= x1; x += 1) origins.push({ x, y });
  }
  for (let i = origins.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = origins[i]!;
    origins[i] = origins[j]!;
    origins[j] = tmp;
  }
  return origins;
}

/**
 * 숲 속 2×2 물웅덩이. 땅이 보이는 맨바닥에만 찍어 나무·덤불·잡동사니를 하나도
 * 건드리지 않는다 — 좁은 숲 띠의 안쪽 덤불 비율 계약을 깨지 않기 위해서다.
 * 20×20급 이상에서만 한 덩어리(큰 숲은 둘)라 밀도 계약도 유지한다.
 * 합성 숲은 빈 상위 칸이 거의 없으므로 웅덩이가 안 나올 수도 있다 — 그래도
 * “약간”이라 자리를 비우려고 기존 것을 지우지는 않는다.
 */
function scatterForestPuddles(draft: Project, map: GameMap, area: Rect, seed: number): number {
  const cells = Math.max(0, area.w) * Math.max(0, area.h);
  const wanted = cells >= 1600 ? 2 : cells >= 400 ? 1 : 0;
  if (wanted === 0) return 0;
  const thicket = new Set<number>(undergrowthAutotileGroup(draft, map).memberTileIds);
  const protectedCells = protectedEventCells(draft, map);
  const rng = mulberry32((seed ^ 0x0a11) >>> 0);
  const used = new Set<number>();
  let painted = 0;
  for (let n = 0; n < wanted; n += 1) {
    let placed = false;
    for (const origin of shuffledPatchOrigins(area, 2, 2, 1, rng)) {
      const spots: { x: number; y: number }[] = [];
      let blocked = false;
      for (let dy = 0; dy < 2 && !blocked; dy += 1) {
        for (let dx = 0; dx < 2; dx += 1) {
          const x = origin.x + dx;
          const y = origin.y + dy;
          if (!inMapBounds(map, x, y) || protectedCells.has(`${x},${y}`)) {
            blocked = true;
            break;
          }
          const index = y * map.width + x;
          if (used.has(index)) {
            blocked = true;
            break;
          }
          const lower = map.lowerTiles[index] ?? TILE.EMPTY;
          const upper = map.upperTiles[index] ?? TILE.EMPTY;
          if (!isForestFloorLower(lower, thicket) || isLakeAutotileTile(lower) || isPathSurfaceTile(lower)) {
            blocked = true;
            break;
          }
          if (isTreeTrunkTileId(lower) || isTreeTrunkTileId(upper) || isTreeCanopyTileId(upper)) {
            blocked = true;
            break;
          }
          // 빈 상위 칸에만 — 안쪽 덤불을 걷어내면 좁은 숲 띠의 덤불 비율 계약이 깨진다.
          if (upper !== TILE.EMPTY) {
            blocked = true;
            break;
          }
          spots.push({ x, y });
        }
      }
      if (blocked || spots.length !== 4) continue;
      for (const spot of spots) {
        const index = spot.y * map.width + spot.x;
        map.lowerTiles[index] = LAKE_AUTOTILE_TILE.OUTER_CORNER;
        map.upperTiles[index] = TILE.EMPTY;
        used.add(index);
        painted += 1;
      }
      placed = true;
      break;
    }
    if (!placed) break;
  }
  return painted;
}

/**
 * 앵커 9 짙은 수풀 오토타일 — 키큰 풀 톤(243 블록)과 결이 다르다.
 * 드물게(약 160칸에 1덩어리, 최대 5) 3×3~5×4 패치. 수관 아래는 칠하고 밑동·물·길은 건너뛴다.
 */
function scatterUndergrowthAutotile(draft: Project, map: GameMap, area: Rect, seed: number): number {
  const group = undergrowthAutotileGroup(draft, map);
  const body = undergrowthBodyTile(group);
  const members = new Set<number>(group.memberTileIds);
  const cells = Math.max(0, area.w) * Math.max(0, area.h);
  const wanted = patchCount(cells, 160, 36, 5);
  if (wanted === 0) return 0;
  const rng = mulberry32((seed ^ 0x9e37) >>> 0);
  const painted: { x: number; y: number }[] = [];
  const used = new Set<number>();
  const sizes: readonly { w: number; h: number }[] = [{ w: 5, h: 4 }, { w: 4, h: 3 }, { w: 3, h: 3 }];
  for (let n = 0; n < wanted; n += 1) {
    let placed = false;
    for (const size of sizes) {
      if (placed) break;
      for (const origin of shuffledPatchOrigins(area, size.w, size.h, 0, rng)) {
        const spots: { x: number; y: number }[] = [];
        for (let dy = 0; dy < size.h; dy += 1) {
          for (let dx = 0; dx < size.w; dx += 1) {
            const x = origin.x + dx;
            const y = origin.y + dy;
            if (!inMapBounds(map, x, y)) continue;
            const index = y * map.width + x;
            if (used.has(index)) continue;
            const lower = map.lowerTiles[index] ?? TILE.EMPTY;
            const upper = map.upperTiles[index] ?? TILE.EMPTY;
            if (!isForestFloorLower(lower, members)) continue;
            if (isLakeAutotileTile(lower) || isPathSurfaceTile(lower)) continue;
            if (isTreeTrunkTileId(lower) || isTreeTrunkTileId(upper)) continue;
            if (upper !== TILE.EMPTY && !isTreeCanopyTileId(upper)) continue;
            spots.push({ x, y });
          }
        }
        if (spots.length < 6) continue;
        for (const spot of spots) {
          const index = spot.y * map.width + spot.x;
          map.lowerTiles[index] = body;
          used.add(index);
          painted.push(spot);
        }
        placed = true;
        break;
      }
    }
  }
  if (painted.length > 0) shapeAutotileGroupAround(map, group, painted);
  return painted.length;
}

// 나무와 덤불은 다른 것이다. 한 집합으로 묶어 "나무 덮은 비율"이라 보고하면 덤불·꽃덤불을
// 나무로 세어 실적을 부풀린다(실측 2026-08-30: 합성 숲이 "나무 100%"로 보고됐지만 실제 나무
// 타일은 51.5%였고 나머지는 덤불이었다). 허위 완료 금지 원칙에 따라 층을 나눠 센다.
const TREE_CANOPY_TILES = new Set([260, 261, 262, 263]);
const TREE_TRUNK_TILES = new Set([290, 291, 292, 293]);
const BUSH_TILES = new Set([288, 289]);
const UNDERGROWTH_TILES = new Set<number>([
  ...CHIPSET_TILE_GROUPS.tallGrass,
  ...DEFAULT_UNDERGROWTH_AUTOTILE_GROUP.memberTileIds,
]);

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
