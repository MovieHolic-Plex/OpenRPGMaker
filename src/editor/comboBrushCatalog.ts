// editor/comboBrushCatalog.ts
// 큐레이션된 Combo Brush 목록 — 지형 도구탭이 "이름 붙은 기능 단위"로 보여 주는 정본.
//
// ── 이 파일이 유일한 정본이고, 아래 두 규칙은 협상 대상이 아니다 ──────────────
// ① **번호 인접으로 조합을 추론하지 않는다.** 타일 번호가 이어져 있다는 사실은
//    "나무 한 그루" 나 "집 한 채" 의 근거가 될 수 없다(칩셋 열이 행을 넘어가면
//    이웃 번호가 전혀 다른 그림이다). 모든 셀은 `CHIPSET_TILE_GROUPS` 의
//    **실측 확정 멤버십**을 인용해서 짠다 — 그 표가 사용자 확정 금본이다.
// ② **새 조합은 콘텐츠 검토를 통과해야 들어온다.** 검토 책임자와 절차는
//    `openwiki/editor-pre-edit-routing.md` 의 「Combo Brush」 항목에 적혀 있다.
//    "AI 가 제안했다" 는 근거가 아니다.
//
// 검증 계약: `test/comboBrushCatalog.test.ts` 가 (a) 모든 셀 타일이 그 조합이 인용한
// CHIPSET_TILE_GROUPS 가방 안에 있는지, (b) 레이어 라우팅이 타일의 실제 홈과 맞는지,
// (c) dx/dy 가 선언한 width/height 를 정확히 채우는지 검사한다. 어긋나면 목록이 아니라
// **테스트가** 먼저 깨진다.

import { CHIPSET_TILE_GROUPS } from "@/project/defaults/chipsetMapping";
import type { PaletteStamp, PaletteStampCell } from "@/editor/tilePaletteStamp";

export type ComboBrushCategoryId = "nature" | "structure" | "furnishing";

export type ComboBrushCatalogEntry = {
  readonly category: ComboBrushCategoryId;
  readonly cells: readonly PaletteStampCell[];
  /** 이 조합의 셀 타일이 나온 CHIPSET_TILE_GROUPS 키 — 근거 추적 + 계약 테스트용. */
  readonly sourceGroups: readonly (keyof typeof CHIPSET_TILE_GROUPS)[];
  readonly height: number;
  readonly id: string;
  readonly name: string;
  /** 저작자에게 보이는 한 줄 설명 — 무엇이 완결되는가. */
  readonly note: string;
  readonly width: number;
};

export const COMBO_BRUSH_CATEGORIES: readonly { readonly id: ComboBrushCategoryId; readonly label: string }[] = [
  { id: "nature", label: "자연" },
  { id: "structure", label: "건물" },
  { id: "furnishing", label: "시설" },
];

function cell(dx: number, dy: number, layer: "lower" | "upper", tile: number): PaletteStampCell {
  return { dx, dy, layer, tile };
}

/**
 * 큐레이션 목록. 기본 칩셋(combined_town) 전용 — 다른 칩셋에서는 노출하지 않는다
 * (타일 번호의 뜻이 칩셋마다 다르므로 그대로 쓰면 엉뚱한 그림이 찍힌다).
 */
export const CURATED_COMBO_BRUSHES: readonly ComboBrushCatalogEntry[] = [
  {
    category: "nature",
    // 나무 = 수관(상위) + 밑동(하위) 세로 2칸. tileActions 의 CANOPY_TO_TRUNK 짝(260↔290)이 정본.
    cells: [cell(0, 0, "upper", 260), cell(0, 1, "lower", 290)],
    height: 2,
    id: "combo_tree_full",
    name: "나무 한 그루",
    note: "수관(상위)과 밑동(바닥)이 한 짝 — 따로 찍으면 밑동 없는 나무가 남습니다.",
    sourceGroups: ["treeObjects"],
    width: 1,
  },
  {
    category: "nature",
    // 넓은 나무 = 262/263 수관 + 292/293 밑동. 같은 짝 표에서 온 2×2.
    cells: [
      cell(0, 0, "upper", 262), cell(1, 0, "upper", 263),
      cell(0, 1, "lower", 292), cell(1, 1, "lower", 293),
    ],
    height: 2,
    id: "combo_tree_wide",
    name: "넓은 나무 (2×2)",
    note: "수관 두 칸과 밑동 두 칸이 한 그루 — 마을 입구·숲 경계에 씁니다.",
    sourceGroups: ["treeObjects"],
    width: 2,
  },
  {
    category: "nature",
    // 석상 = 266(상) + 296(하) 세로 페어. 2026-07-16 사용자 확정 페어.
    cells: [cell(0, 0, "upper", 266), cell(0, 1, "upper", 296)],
    height: 2,
    id: "combo_plaza_statue",
    name: "광장 석상",
    note: "머리(위)와 받침(아래)이 한 조각상 — 광장 중앙에 단독 배치합니다.",
    sourceGroups: ["plazaStatueObjects"],
    width: 1,
  },
  {
    category: "structure",
    // 원형 타워 2칸 폭 5단 — 사용자 맵 (18,18)–(19,24) 실측 금본.
    // 캡·베이스는 upper(하늘에 걸린 실루엣), 목·몸·창은 lower(벽면).
    cells: [
      cell(0, 0, "upper", 24), cell(1, 0, "upper", 25),
      cell(0, 1, "lower", 138), cell(1, 1, "lower", 139),
      cell(0, 2, "lower", 140), cell(1, 2, "lower", 141),
      cell(0, 3, "lower", 142), cell(1, 3, "lower", 143),
      cell(0, 4, "upper", 54), cell(1, 4, "upper", 55),
    ],
    height: 5,
    id: "combo_round_tower",
    name: "원형 타워 (2×5)",
    note: "지붕캡·목·몸·창문·베이스가 한 채 — 조각을 따로 찍으면 층이 어긋납니다.",
    sourceGroups: ["castleRoundTowerObjects"],
    width: 2,
  },
  {
    category: "structure",
    // 성 지붕 여장 면 3×4 — castleRoofDeckObjects 실측 블록 그대로.
    // 레이어는 전부 lower 다: 이 칸들은 불투명 지붕 **면**이라 위에 사람이 서지 않는다.
    // 처음에 upper 로 적었다가 defaultPaintLayerForTile 실측과 어긋나 바로잡았다 —
    // 큐레이션 목록의 레이어는 엔진 판정과 같아야 하고 그 일치를 계약 테스트가 지킨다.
    cells: [
      cell(0, 0, "lower", 18), cell(1, 0, "lower", 19), cell(2, 0, "lower", 20),
      cell(0, 1, "lower", 48), cell(1, 1, "lower", 49), cell(2, 1, "lower", 50),
      cell(0, 2, "lower", 78), cell(1, 2, "lower", 79), cell(2, 2, "lower", 80),
      cell(0, 3, "lower", 108), cell(1, 3, "lower", 109), cell(2, 3, "lower", 110),
    ],
    height: 4,
    id: "combo_castle_roof_deck",
    name: "성 지붕 여장 (3×4)",
    note: "map_castle_keep 실측 지붕 면 한 판 — 성 상단을 통째로 깝니다.",
    sourceGroups: ["castleRoofDeckObjects"],
    width: 3,
  },
  {
    category: "structure",
    // 목조 벽면 3×3 — WOOD_STRUCTURE_OBJECTS 블록(105..167) 그대로.
    cells: [
      cell(0, 0, "lower", 105), cell(1, 0, "lower", 106), cell(2, 0, "lower", 107),
      cell(0, 1, "lower", 135), cell(1, 1, "lower", 136), cell(2, 1, "lower", 137),
      cell(0, 2, "lower", 165), cell(1, 2, "lower", 166), cell(2, 2, "lower", 167),
    ],
    height: 3,
    id: "combo_wood_wall_block",
    name: "목조 벽면 (3×3)",
    note: "모서리·중앙이 갖춰진 목조 건물 벽 한 면 — 이어 찍어 폭을 늘립니다.",
    sourceGroups: ["woodStructureObjects"],
    width: 3,
  },
  {
    category: "structure",
    // 흰 벽 3×3 — 좌/반복/우 열 × 상/몸/하 행. HOUSE_WHITE_WALL_* 열 정의가 정본.
    cells: [
      cell(0, 0, "lower", 15), cell(1, 0, "lower", 16), cell(2, 0, "lower", 17),
      cell(0, 1, "lower", 45), cell(1, 1, "lower", 46), cell(2, 1, "lower", 47),
      cell(0, 2, "lower", 75), cell(1, 2, "lower", 76), cell(2, 2, "lower", 77),
    ],
    height: 3,
    id: "combo_white_wall_block",
    name: "흰 벽 건물면 (3×3)",
    note: "왼쪽·반복·오른쪽 열이 갖춰진 회벽 한 면 — 가운데 열을 이어 폭을 늘립니다.",
    sourceGroups: ["houseWhiteWallObjects"],
    width: 3,
  },
  {
    category: "structure",
    // 출입구 = 상(329) + 하(359) 세로 2칸. stampHouseDoorBackground 가 쓰는 그 짝이다.
    cells: [cell(0, 0, "lower", 329), cell(0, 1, "lower", 359)],
    height: 2,
    id: "combo_house_entrance",
    name: "집 출입구 받침",
    note: "문 이벤트를 놓기 전 깔아야 하는 329/359 받침 두 칸 (외벽 문 배경 규약).",
    sourceGroups: ["houseEntranceObjects"],
    width: 1,
  },
  {
    category: "furnishing",
    // 가로 탁자 3칸 + 위/아래 의자 — 234|235|236 과 175/176 의 쓰임이 실측 주석에 확정돼 있다.
    cells: [
      cell(0, 0, "upper", 175), cell(1, 0, "upper", 175), cell(2, 0, "upper", 175),
      cell(0, 1, "upper", 234), cell(1, 1, "upper", 235), cell(2, 1, "upper", 236),
      cell(0, 2, "upper", 176), cell(1, 2, "upper", 176), cell(2, 2, "upper", 176),
    ],
    height: 3,
    id: "combo_table_horizontal_set",
    name: "가로 탁자 한 벌 (3×3)",
    note: "탁자 좌·중·우와 위·아래 의자 — 여관·식당 한 자리가 한 번에 완성됩니다.",
    sourceGroups: ["tableHorizontalObjects", "chairObjects"],
    width: 3,
  },
  {
    category: "furnishing",
    // 세로 탁자 + 좌우 의자. 205=탁자 왼쪽(오른쪽 봄), 206=오른쪽(왼쪽 봄).
    cells: [
      cell(0, 0, "upper", 205), cell(1, 0, "upper", 144), cell(2, 0, "upper", 206),
      cell(0, 1, "upper", 205), cell(1, 1, "upper", 174), cell(2, 1, "upper", 206),
      cell(0, 2, "upper", 205), cell(1, 2, "upper", 204), cell(2, 2, "upper", 206),
    ],
    height: 3,
    id: "combo_table_vertical_set",
    name: "세로 탁자 한 벌 (3×3)",
    note: "세로 탁자 3칸과 좌·우 의자 열 — 긴 식탁을 세로로 놓을 때 씁니다.",
    sourceGroups: ["tableVerticalObjects", "chairObjects"],
    width: 3,
  },
  {
    category: "furnishing",
    // 집 앞 마당 4소품 한 줄 — 349장작·350우편함·351화분·352항아리.
    cells: [
      cell(0, 0, "upper", 349), cell(1, 0, "upper", 350),
      cell(2, 0, "upper", 351), cell(3, 0, "upper", 352),
    ],
    height: 1,
    id: "combo_house_yard_row",
    name: "집 앞 마당 소품 (4×1)",
    note: "장작·우편함·화분·항아리 한 줄 — 집 정면 아래에 붙여 씁니다.",
    sourceGroups: ["houseYardObjects"],
    width: 4,
  },
  {
    category: "furnishing",
    // 울타리 가로 3칸 — fenceObjects 상단 행(378|379|380).
    cells: [cell(0, 0, "upper", 378), cell(1, 0, "upper", 379), cell(2, 0, "upper", 380)],
    height: 1,
    id: "combo_fence_run",
    name: "울타리 한 구간 (3×1)",
    note: "왼쪽 기둥·중간·오른쪽 기둥 — 이어 찍어 밭·마당을 둘러쌉니다.",
    sourceGroups: ["fenceObjects"],
    width: 3,
  },
];

/** 검토 담당(위키와 같은 말) — 목록에 새 조합을 넣을 때 승인해야 하는 역할. */
export const COMBO_BRUSH_REVIEW_OWNER = "타일 콘텐츠 검토 담당(감독) — openwiki/editor-pre-edit-routing.md 「Combo Brush」";

export function comboBrushCatalogEntry(id: string): ComboBrushCatalogEntry | undefined {
  return CURATED_COMBO_BRUSHES.find((entry) => entry.id === id);
}

/** 이 타일셋에서 쓸 수 있는 조합만 — 타일 번호가 실제로 존재하는지까지 본다. */
export function curatedComboBrushesForTileset(input: {
  readonly isDefaultChipset: boolean;
  readonly tileCount: number;
}): readonly ComboBrushCatalogEntry[] {
  if (!input.isDefaultChipset) return [];
  return CURATED_COMBO_BRUSHES.filter((entry) =>
    entry.cells.every((cell) => cell.tile >= 0 && cell.tile < input.tileCount));
}

/** 큐레이션 조합 → 기존 스탬프 페인트 경로가 먹는 PaletteStamp. */
export function comboBrushStampFromCatalog(entry: ComboBrushCatalogEntry): PaletteStamp {
  const firstTile = entry.cells[0]?.tile ?? 0;
  return {
    cells: entry.cells.map((cell) => ({ ...cell })),
    height: entry.height,
    label: entry.name,
    origin: "curated",
    source: { endTile: firstTile, startTile: firstTile },
    width: entry.width,
  };
}
