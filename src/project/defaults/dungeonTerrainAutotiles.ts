import { buildEdgeCornerInnerVariantMap, buildEdgeCornerVariantMap } from "./autotileEngine";
import type { AutotileGroup } from "../types";

// 던전 칩셋(easyrpg_chipset_dungeon)의 지형 RM2k3 오토타일 블록.
// 2026-07-13 vision 감사 + 합성 렌더 검증으로 확정. 실내 칩셋과 같은 표준 3×4 슬롯 격자
// (열 {0,3,6,9,12,15}, 행 {0,4,8,12})에 던전 아트가 들어 있다 — interiorTerrainAutotiles.ts와 동일 계약.
// 표준 배치: 윗줄 = 고립 · 바탕 · 오목 코너 소스, 아래 3×3 = 본체(볼록 코너/변/중앙 몸통).
// 브러시는 각 블록 본체 중앙 타일. 채운 blob은 buildEdgeCornerInnerVariantMap(8방·11분류)로 성형된다.
//
// 대지(고원)는 방향성 절벽(아래 면이 다름)이라 대칭 edge/corner 모델에 안 맞아 제외 —
// 하네스 "plateau" 그룹에서 수동 배치로 남긴다.

const COLS = 30;

type DungeonBlockSpec = {
  readonly key: string;
  readonly name: string;
  readonly col: number;
  readonly row: number;
  /** standard = 3×4(윗줄 고립·바탕·오목 + 아래 3×3). nineSlice = 3×3만(고립/오목은 몸통 폴백). */
  readonly layout?: "standard" | "nineSlice";
};

export const DUNGEON_TERRAIN_AUTOTILE_PREFIX = "harness-dungeon-v1-terrain-";

// 합성 렌더(scripts/verify-dungeon-autotile.mjs)로 테두리/코너 성형을 육안 확인한 블록만 등록한다.
const DUNGEON_TERRAIN_BLOCKS: readonly DungeonBlockSpec[] = [
  // ── 통행 바닥 ──
  { key: "cave-floor", name: "동굴 돌바닥", col: 6, row: 4 },
  { key: "lava-rock", name: "용암 바위 바닥", col: 0, row: 8 },
  { key: "dirt", name: "흙 바위 바닥", col: 0, row: 12 },
  { key: "moss", name: "이끼 덤불 지대", col: 3, row: 12 },
  { key: "ice", name: "빙판 바닥", col: 6, row: 0 },
  // ── blob(테두리 성형) ──
  { key: "ice-crystal", name: "얼음 결정 지대", col: 9, row: 0 },
  { key: "lava-pool", name: "용암 못", col: 3, row: 8 },
  { key: "pit-cave", name: "동굴 구덩이", col: 9, row: 4 },
  { key: "pit-brown", name: "암흑 구덩이(갈색 테)", col: 6, row: 8 },
  { key: "pit-dark", name: "암흑 구덩이(어두운 테)", col: 9, row: 8 },
  { key: "pit-grey", name: "회색 바위 구멍", col: 9, row: 12 },
  // 눈밭: 윗줄(252~254)이 지층 벽이라 3×3 nineSlice로만 성형.
  { key: "snow", name: "눈밭", col: 12, row: 9, layout: "nineSlice" },
];

function tileAt(spec: DungeonBlockSpec, dx: number, dy: number): number {
  return (spec.row + dy) * COLS + (spec.col + dx);
}

function createStandardGroup(spec: DungeonBlockSpec): AutotileGroup {
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
    id: `${DUNGEON_TERRAIN_AUTOTILE_PREFIX}${spec.key}`,
    name: spec.name,
    neighborhood: 8,
    memberTileIds,
    connectTileIds: [...memberTileIds],
    variantMap: buildEdgeCornerInnerVariantMap({
      body, edgeN, edgeS, edgeW, edgeE,
      cornerNW, cornerNE, cornerSW, cornerSE,
      isolated, inner,
    }),
  };
}

// 푸른 발광 심연(366 브러시) — 실내 어두운 벽과 같은 슬롯/기하의 4방 edge/corner 오토타일.
// 몸통 366이 블록 좌상단이고 테두리(글로우)는 4방 연결로 성형된다.
export const DUNGEON_ABYSS_GLOW_AUTOTILE_GROUP_ID = `${DUNGEON_TERRAIN_AUTOTILE_PREFIX}abyss-glow`;

const DUNGEON_ABYSS_GLOW = {
  body: 366, edgeN: 367, edgeS: 427, edgeW: 396, edgeE: 398,
  cornerNW: 368, cornerNE: 369, cornerSW: 426, cornerSE: 428,
} as const;

function createAbyssGlowGroup(): AutotileGroup {
  const memberTileIds = [...new Set(Object.values(DUNGEON_ABYSS_GLOW))];
  return {
    id: DUNGEON_ABYSS_GLOW_AUTOTILE_GROUP_ID,
    name: "푸른 발광 심연 (366 브러시)",
    neighborhood: 4,
    memberTileIds,
    connectTileIds: [...memberTileIds],
    triggerTileIds: memberTileIds,
    variantMap: buildEdgeCornerVariantMap({ ...DUNGEON_ABYSS_GLOW }),
  };
}

/** 던전 지형 오토타일 그룹 13종 — 브러시는 각 블록의 중앙(몸통) 타일. */
export function createDungeonTerrainAutotileGroups(): AutotileGroup[] {
  return [...DUNGEON_TERRAIN_BLOCKS.map(createStandardGroup), createAbyssGlowGroup()];
}
