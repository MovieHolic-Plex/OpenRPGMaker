import { buildEdgeCornerInnerVariantMap } from "./autotileEngine";
import type { AutotileGroup } from "../types";

// 실내 칩셋(easyrpg_chipset_interior)의 지형/카펫 RM2k3 오토타일 블록 6종.
// 2026-07-12 vision 감사로 확정된 표준 3×4 배치: 윗줄 = 고립 · 바탕(잔디) · 오목 코너 소스,
// 아래 3×3 = 본체(볼록 코너/변/중앙). 바탕 칸은 멤버가 아니다.
// 배치는 흙길/모래(combined_town)와 동일하게 buildEdgeCornerInnerVariantMap(8방·11분류)로 성형한다.
// (데크 128·흙무더기 365의 "오목" 칸은 평면 변형이라 오목 코너가 몸통처럼 보이지만 시각 무해.)

const COLS = 30;

type InteriorTerrainBlockSpec = {
  readonly key: string;
  readonly name: string;
  readonly col: number;
  readonly row: number;
  /**
   * standard  = 3×4 RM 블록(윗줄: 고립·바탕·오목, 아래 3×3 본체)
   * nineSlice = 3×3 본체만(고립/오목 아트 없음 — 둘 다 몸통으로 폴백. 예: 붉은 카펫, 사용자 결정 2026-07-12)
   */
  readonly layout?: "standard" | "nineSlice";
};

export const INTERIOR_TERRAIN_AUTOTILE_PREFIX = "harness-interior-house-v1-terrain-";

const INTERIOR_TERRAIN_BLOCKS: readonly InteriorTerrainBlockSpec[] = [
  { key: "hedge", name: "숲 수풀(월드맵 겸용)", col: 0, row: 12 },
  { key: "mound", name: "산 둔덕(월드맵 겸용)", col: 3, row: 12 },
  { key: "dirt", name: "흙땅", col: 6, row: 0 },
  { key: "deck", name: "나무 단상(데크)", col: 6, row: 4 },
  { key: "cobble", name: "자갈 포장", col: 6, row: 8 },
  { key: "teal-carpet", name: "청록 카펫", col: 9, row: 8 },
  { key: "sand", name: "모래밭", col: 9, row: 0 },
  { key: "dark-grass", name: "짙은 잔디", col: 3, row: 8 },
  // 붉은 카펫은 9-슬라이스 + 아래 계단 행(465~467, 별개) — 고립은 몸통 406으로.
  { key: "red-carpet", name: "붉은 카펫", col: 15, row: 12, layout: "nineSlice" },
];

function tileAt(spec: InteriorTerrainBlockSpec, dx: number, dy: number): number {
  return (spec.row + dy) * COLS + (spec.col + dx);
}

function createGroup(spec: InteriorTerrainBlockSpec): AutotileGroup {
  // nineSlice는 3×3이 블록 원점부터 시작(윗줄 없음) — 행 오프셋으로 흡수한다.
  const gridTop = spec.layout === "nineSlice" ? 0 : 1;
  const cornerNW = tileAt(spec, 0, gridTop);
  const edgeN = tileAt(spec, 1, gridTop);
  const cornerNE = tileAt(spec, 2, gridTop);
  const edgeW = tileAt(spec, 0, gridTop + 1);
  const body = tileAt(spec, 1, gridTop + 1);
  const edgeE = tileAt(spec, 2, gridTop + 1);
  const cornerSW = tileAt(spec, 0, gridTop + 2);
  const edgeS = tileAt(spec, 1, gridTop + 2);
  const cornerSE = tileAt(spec, 2, gridTop + 2);
  const isolated = spec.layout === "nineSlice" ? body : tileAt(spec, 0, 0);
  const inner = spec.layout === "nineSlice" ? body : tileAt(spec, 2, 0);
  const memberTileIds = [...new Set([isolated, inner, cornerNW, edgeN, cornerNE, edgeW, body, edgeE, cornerSW, edgeS, cornerSE])];
  return {
    id: `${INTERIOR_TERRAIN_AUTOTILE_PREFIX}${spec.key}`,
    name: spec.name,
    neighborhood: 8,
    memberTileIds,
    connectTileIds: [...memberTileIds],
    variantMap: buildEdgeCornerInnerVariantMap({
      body,
      edgeN,
      edgeS,
      edgeW,
      edgeE,
      cornerNW,
      cornerNE,
      cornerSW,
      cornerSE,
      isolated,
      inner,
    }),
  };
}

/** 실내 지형/카펫 오토타일 그룹 6종 — 브러시는 각 블록의 중앙(몸통) 타일. */
export function createInteriorTerrainAutotileGroups(): AutotileGroup[] {
  return INTERIOR_TERRAIN_BLOCKS.map(createGroup);
}
