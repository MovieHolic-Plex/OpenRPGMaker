// 숲 밀도 — 모델이 넘긴 density enum 을 그루 수·패킹으로 바꾸는 단일 근거.
//
// 왜 필요한가 (실측 2026-08-30): plant_tree_clusters / stepForestBig 의 기본 개수가
// `min(10, 면적/28)` 로 캡돼 있어서 40×40 숲 밴드(1600칸)에 2×2 활엽수 10그루 = 40타일,
// 커버리지 2.5% 가 나왔다. 사용자가 보는 결과는 "숲"이 아니라 "잔디밭에 나무 몇 그루"다.
// 숲은 그 지역을 사실상 통행 불가로 만드는 지형이므로, 밀도를 이름 붙은 축으로 올린다.
// 사용자 문장 정규식은 쓰지 않는다 — 숲/울창/드문드문 매핑은 조수가 density enum 으로 넣는다.

export type ForestDensity = "sparse" | "normal" | "dense" | "impassable";

export const FOREST_DENSITIES: readonly ForestDensity[] = ["sparse", "normal", "dense", "impassable"];

/** 숲 레이어 기본값 — "숲"이라는 말 자체가 빽빽함을 뜻한다. */
export const DEFAULT_FOREST_DENSITY: ForestDensity = "dense";

type DensitySpec = {
  /** 나무 발자국이 덮어야 할 영역 비율(0~1). */
  readonly coverage: number;
  readonly minGap: number;
  readonly naturalness: number;
  /** true 면 place_props packing:"dense"(선형 채우기)로 보낸다. */
  readonly packDense: boolean;
};

const SPECS: Readonly<Record<ForestDensity, DensitySpec>> = {
  sparse: { coverage: 0.15, minGap: 3, naturalness: 0.55, packDense: false },
  // 왜 normal 간격은 1인가: 24×24 양 수종 실측에서 간격 2는 선언 40%에 대해 18.1%/25.5%에
  // 멈췄고, 간격 1은 자연 산포를 유지하면서 35.1%/43.9%를 냈다.
  normal: { coverage: 0.4, minGap: 1, naturalness: 0.6, packDense: false },
  // 왜 dense 의 packDense 가 false 인가: 이 계획 객체는 PR #355 의 저작 기본값과 나란히 보이는
  // «모양» 계산이고(`test/forestDensityPriority.test.ts` 가 그 모양을 고정한다), 실제 시공의
  // 패킹은 `forestPackingFor` 가 정한다 — dense·impassable 은 자연 산포가 아니라 선형 packer 로 나간다.
  dense: { coverage: 0.8, minGap: 0, naturalness: 0.65, packDense: false },
  impassable: { coverage: 1, minGap: 0, naturalness: 0.5, packDense: true },
};

export function forestCoverageTarget(density: ForestDensity): number {
  return SPECS[density].coverage;
}

/**
 * 실행 시점의 패킹 — dense·impassable 은 선형 packer 로 나간다.
 *
 * 왜 `forestPlacementPlan().packing` 과 분리하는가(실측): 자연 산포는 간격을 지키다 일찍 포기해
 * 24×24 에서 231그루 요청 중 79그루만 놓고 커버리지 44% · 통행 가능 72.6% 에 멈추었고(선언은 80%),
 * 96×96 은 399초에도 끝나지 않았다. 그래서 밀도가 지시한 숲은 반드시 이 경로로 보낸다.
 */
export function forestPackingFor(density: ForestDensity): "natural" | "dense" {
  return density === "dense" || density === "impassable" ? "dense" : "natural";
}

/**
 * 도구 인자에서만 밀도를 읽는다. 사용자 문장·테마 문자열을 훑지 않는다 —
 * 숲/울창/드문드문 매핑은 모델이 density enum 으로 넘긴다.
 */
export function parseOptionalForestDensity(value: unknown): ForestDensity | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  return FOREST_DENSITIES.includes(value as ForestDensity) ? (value as ForestDensity) : undefined;
}

export function coerceForestDensity(value: unknown, fallback: ForestDensity = DEFAULT_FOREST_DENSITY): ForestDensity {
  return FOREST_DENSITIES.includes(value as ForestDensity) ? (value as ForestDensity) : fallback;
}

export type ForestTreeKind = "침엽수" | "활엽수";

/**
 * 이미 해석된 재료(칩셋 그룹·라벨)가 숲 합성 대상인지. 호출자가 넣은 원문 쿼리를
 * 정규식으로 분류하지 않는다 — resolveMaterialByLabel 이 고른 그룹 id / 정확 라벨만 본다.
 */
export function forestTreeKindFromResolvedMaterial(input: {
  readonly kind: "group" | "tile";
  readonly groupId?: string;
  readonly groupName?: string;
  readonly matchedLabel?: string;
}): ForestTreeKind | undefined {
  const id = input.groupId ?? "";
  if (id.includes("broadleaf-tree")) return "활엽수";
  if (id.includes("conifer-tree") || id.includes("dry-tree")) return "침엽수";
  // 숲 나무 확장 띠(forest-trees:*)의 물체도 숲 재료다 — 「숲 나무 · 숲 벽」에 density 를 주면 숲을 원한 것이므로
  // 굽이숲 수관으로 보낸다(2026-09-27: density 를 거절당한 모델이 밑동뿐인 숲 벽을 낱개로 뿌렸다).
  if (id.startsWith("forest-trees:") && !id.includes("bush")) return "활엽수";
  const name = input.groupName ?? "";
  if (name === "활엽수") return "활엽수";
  if (name === "침엽수" || name === "마른나무") return "침엽수";
  const label = input.matchedLabel ?? "";
  if (label === "활엽수") return "활엽수";
  if (label === "침엽수" || label === "마른나무") return "침엽수";
  return undefined;
}

export type ForestPlacementPlan = {
  readonly count: number;
  readonly minGap: number;
  readonly naturalness: number;
  readonly packing: "natural" | "dense";
};

/**
 * 밀도 → place_props 인자. count 는 "발자국이 영역의 coverage 비율을 덮는 그루 수"다.
 * footprintCells = 나무 한 그루가 먹는 칸 수(침엽수 1×2 = 2, 활엽수 2×2 = 4).
 * share = 이 패스가 가질 커버리지 지분 — 침엽수·활엽수를 나눠 심을 때 뒤 패스가 자리를 못 찾아
 * 2×2 군락 게이트에 걸리는 것을 막는다.
 */
export function forestPlacementPlan(input: {
  readonly area: { readonly w: number; readonly h: number };
  readonly footprintCells: number;
  readonly density: ForestDensity;
  readonly share?: number;
}): ForestPlacementPlan {
  const spec = SPECS[input.density];
  const cells = Math.max(0, Math.floor(input.area.w)) * Math.max(0, Math.floor(input.area.h));
  const footprint = Math.max(1, Math.floor(input.footprintCells));
  const share = input.share === undefined ? 1 : Math.min(1, Math.max(0, input.share));
  // sparse 침엽수는 수관·밑동 두 칸이 드러나므로 개수 산정에서만 2칸으로 보정한다.
  const sparseConifer = input.density === "sparse" && footprint === 1;
  const countFootprint = sparseConifer ? 2 : footprint;
  const count = Math.max(1, Math.ceil((cells * spec.coverage * share) / countFootprint));
  return {
    count,
    minGap: sparseConifer ? 1 : spec.minGap,
    naturalness: spec.naturalness,
    packing: spec.packDense ? "dense" : "natural",
  };
}

/**
 * 나무 한 그루가 먹는 **맵 칸** 수. 스탬프 타일 수가 아니다 — 수관(upper)과 밑동(lower)이
 * 같은 칸에 적층되기 때문이다(실측: 침엽수 1칸에 upper 260 + lower 290, 2×2 활엽수는
 * 가로 2칸에 upper 262·263 + lower 292·293). 타일 수(2·4)로 세면 개수가 절반이 되어
 * impassable 이 50% 커버리지에서 멈춘다.
 */
export function treeFootprintCells(material: "침엽수" | "활엽수"): number {
  return material === "활엽수" ? 2 : 1;
}
