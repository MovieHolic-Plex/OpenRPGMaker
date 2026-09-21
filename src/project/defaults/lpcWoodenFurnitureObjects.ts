import type { InteriorObjectDef } from "./interiorObjectCatalog";
import { LPC_WOODEN_FURNITURE_TILESET_TEXTURE_KEY } from "./constants";

/**
 * [LPC] Wooden Furniture 공용 오브젝트 정본 (2026-09-22).
 *
 * 왜 코드 카탈로그인가: 실내 오브젝트 카탈로그(interiorObjectCatalog)는 **실내 칩셋 전용**이라
 * 다른 타일셋에 섞이지 않는다. 이 시트는 자기 타일셋을 쓰므로 별도 정본이 필요하다.
 * 시드 경로는 Tibo 실내 확장과 같다 — 타일셋 `structureKits` 로 굽고, 자료집 오브젝트 탭이
 * 그 킷을 공용 오브젝트로 보여준다(`spatialCatalog.objectCards` 의 source 판정 참조).
 *
 * 좌표 근거: 시트는 32px 셀 16열 × 32행이다. 아래 `rect(c0, r0, w, h)` 는 **셀 격자 좌표**이며,
 * 각 항목을 실제 타일 픽셀로 렌더한 연락처 시트로 온전함을 확인했다. 가구마다 경계가 달라
 * 자동 분할(연결 요소·최대 사각형)은 쓰지 않았다 — 인접 가구가 붙어 있어 뭉치거나 잘린다.
 *
 * 레이어 계약: 이 시트의 가구는 **오브젝트 실루엣**이라 상위 레이어에 얹는다 — 하위로 깔면
 * 발밑 바닥을 덮어 맵이 걸어다닐 수 없게 된다. 이 시트에는 사람이 올라서는 바닥(데크·다리)
 * 종류가 없고 전부 가구다.
 */

/** 오브젝트 한 칸 — 킷 원점 기준 상대 좌표. */
export type LpcFurnitureCell = {
  readonly dx: number;
  readonly dy: number;
  readonly tile: number;
};

export type LpcFurnitureObjectDef = {
  readonly id: string;
  readonly label: string;
  readonly description: string;
  readonly width: number;
  readonly height: number;
  /** 실내 방 문법 역할(있으면 실내 가구로도 취급된다). */
  readonly interiorRole?: string;
  readonly snap: "wall-north" | "wall-any" | "floor" | "free";
  readonly themes: readonly string[];
  readonly cells: readonly LpcFurnitureCell[];
};

const TILES_PER_ROW = 16;

/** 셀 사각형(열, 행, 너비, 높이) → 상대 좌표 셀 목록. */
function rect(c0: number, r0: number, w: number, h: number): readonly LpcFurnitureCell[] {
  const cells: LpcFurnitureCell[] = [];
  for (let dy = 0; dy < h; dy += 1) {
    for (let dx = 0; dx < w; dx += 1) {
      cells.push({ dx, dy, tile: (r0 + dy) * TILES_PER_ROW + (c0 + dx) });
    }
  }
  return cells;
}

function def(
  id: string,
  label: string,
  description: string,
  snap: LpcFurnitureObjectDef["snap"],
  themes: readonly string[],
  cells: readonly LpcFurnitureCell[],
  interiorRole?: string,
): LpcFurnitureObjectDef {
  return {
    id,
    label,
    description,
    width: Math.max(...cells.map((cell) => cell.dx)) + 1,
    height: Math.max(...cells.map((cell) => cell.dy)) + 1,
    ...(interiorRole ? { interiorRole } : {}),
    snap,
    themes,
    cells,
  };
}

// 테마는 자유 문자열 배열이다(StructureKitAiMeta.themes). 실내 7종 id 를 쓰면 실내 방 문법과
// 어휘가 맞는다. 여러 테마를 붙일 때 `as const` 튜플의 concat 은 타입이 갈라지므로
// 처음부터 `readonly string[]` 로 둔다.
const BEDROOM: readonly string[] = ["bedroom"];
const STUDY: readonly string[] = ["study"];
const DINING: readonly string[] = ["dining"];
const KITCHEN: readonly string[] = ["kitchen"];
const STORAGE: readonly string[] = ["storage"];
const TAVERN: readonly string[] = ["tavern"];
const CORRIDOR: readonly string[] = ["corridor"];

export const LPC_WOODEN_FURNITURE_OBJECTS: readonly LpcFurnitureObjectDef[] = [
  // ── 침대 ────────────────────────────────────────────────────────────
  // 가로 침대는 머리판 한 줄(2×1), 세로 침대는 두 줄(1×2), 캐노피 침대는 2×3 이다.
  def("lpc_bed_plain", "침대(민무늬)", "머리판이 민무늬인 나무 침대입니다. 2×1칸이며 북쪽 벽에 등을 대고 놓습니다.", "wall-north", BEDROOM, rect(0, 14, 2, 1), "bed"),
  def("lpc_bed_decor", "침대(조각 머리판)", "머리판에 조각 장식이 있는 나무 침대입니다. 2×1칸.", "wall-north", BEDROOM, rect(2, 14, 2, 1), "bed"),
  def("lpc_bed_gold", "침대(금장 머리판)", "머리판에 금색 포인트가 들어간 침대입니다. 2×1칸.", "wall-north", BEDROOM, rect(4, 14, 2, 1), "bed"),
  def("lpc_bed_poster", "침대(4주식)", "기둥이 네 모서리에 선 4주식 침대입니다. 2×2칸.", "wall-north", BEDROOM, rect(6, 14, 2, 2), "bed"),
  def("lpc_bed_red_v", "침대(붉은 이불·세로)", "붉은 이불을 덮은 세로형 침대입니다. 1×2칸.", "wall-north", BEDROOM, rect(13, 13, 1, 2), "bed"),
  def("lpc_bed_red_v2", "침대(진붉은 이불·세로)", "진한 붉은 이불의 세로형 침대입니다. 1×2칸.", "wall-north", BEDROOM, rect(14, 13, 1, 2), "bed"),
  def("lpc_bed_white_v", "침대(흰 이불·세로)", "흰 이불을 덮은 세로형 침대입니다. 1×2칸.", "wall-north", BEDROOM, rect(15, 13, 1, 2), "bed"),
  def("lpc_bed_canopy", "캐노피 침대", "금색 커튼이 달린 4주식 캐노피 침대입니다. 2×3칸으로 가장 큰 침대입니다.", "wall-north", BEDROOM, rect(8, 13, 2, 3), "bed"),

  // ── 수납 ────────────────────────────────────────────────────────────
  def("lpc_wardrobe_arch", "아치형 옷장", "아치 장식 문이 달린 옷장입니다. 2×2칸이며 벽에 붙여 놓습니다.", "wall-north", BEDROOM.concat(STORAGE), rect(12, 11, 2, 2), "wardrobe"),
  def("lpc_dresser", "서랍장", "서랍 여러 단이 달린 수납장입니다. 2×2칸.", "wall-north", BEDROOM.concat(STORAGE), rect(14, 11, 2, 2), "wardrobe"),
  def("lpc_tall_cabinet", "높은 수납장", "문 두 짝이 달린 키 큰 수납장입니다. 1×2칸.", "wall-north", STORAGE.concat(STUDY), rect(13, 2, 1, 2), "wardrobe"),

  // ── 벽면 선반 ───────────────────────────────────────────────────────
  def("lpc_shelf_drawers", "선반(서랍장)", "서랍이 여러 단인 벽면 수납 선반입니다. 1×3칸.", "wall-north", STORAGE.concat(STUDY), rect(9, 4, 1, 3), "bookshelf"),
  def("lpc_shelf_empty", "선반(빈칸)", "비어 있는 벽면 선반입니다. 1×3칸.", "wall-north", STORAGE.concat(STUDY), rect(10, 4, 1, 3), "bookshelf"),
  def("lpc_shelf_books", "책 선반", "책이 꽂힌 벽면 책장입니다. 1×3칸.", "wall-north", STUDY, rect(11, 4, 1, 3), "bookshelf"),
  def("lpc_shelf_plates", "접시 선반", "접시와 그릇을 올린 벽면 선반입니다. 1×3칸.", "wall-north", KITCHEN.concat(DINING), rect(13, 4, 1, 3), "bookshelf"),

  // ── 탁자·걸상·의자 ──────────────────────────────────────────────────
  def("lpc_table_long", "긴 탁자", "여러 사람이 둘러앉는 긴 나무 탁자입니다. 3×1칸.", "floor", DINING.concat(TAVERN), rect(10, 7, 3, 1), "table"),
  def("lpc_table_long_low", "긴 탁자(낮은 다리)", "다리가 낮은 긴 탁자입니다. 3×1칸.", "floor", DINING.concat(TAVERN), rect(10, 8, 3, 1), "table"),
  def("lpc_table_round", "둥근 탁자", "다리 하나가 받치는 둥근 탁자입니다.", "floor", DINING.concat(TAVERN), rect(13, 7, 1, 1), "table"),
  def("lpc_table_round_low", "둥근 탁자(낮은 다리)", "다리가 낮은 둥근 탁자입니다.", "floor", DINING.concat(TAVERN), rect(13, 8, 1, 1), "table"),
  def("lpc_stool_a", "걸상 A", "등받이 없는 나무 걸상입니다.", "floor", KITCHEN.concat(TAVERN, DINING), rect(14, 7, 1, 1), "table"),
  def("lpc_stool_b", "걸상 B", "상판이 둥근 걸상입니다.", "floor", KITCHEN.concat(TAVERN), rect(15, 7, 1, 1), "table"),
  def("lpc_stool_c", "걸상 C", "다리가 낮은 걸상입니다.", "floor", KITCHEN.concat(TAVERN, DINING), rect(14, 8, 1, 1), "table"),
  def("lpc_stool_d", "걸상 D", "상판이 둥근 낮은 걸상입니다.", "floor", KITCHEN.concat(TAVERN), rect(15, 8, 1, 1), "table"),
  def("lpc_chair_high", "등받이 의자", "등받이가 높은 나무 의자입니다.", "floor", DINING.concat(STUDY), rect(12, 17, 1, 1), "table"),
  def("lpc_chair_side", "의자(옆모습)", "옆에서 본 등받이 의자입니다. 탁자 좌우에 놓습니다. 1×2칸.", "floor", DINING.concat(STUDY), rect(13, 17, 1, 2), "table"),
  def("lpc_chair_wicker", "라탄 의자", "등받이가 격자로 짜인 의자입니다.", "floor", DINING.concat(TAVERN), rect(12, 19, 1, 1), "table"),

  // ── 악기·교회 ───────────────────────────────────────────────────────
  def("lpc_piano_grand", "그랜드 피아노", "뚜껑을 연 그랜드 피아노입니다. 2×3칸.", "wall-north", TAVERN.concat(DINING), rect(0, 26, 2, 3)),
  def("lpc_piano_upright", "업라이트 피아노", "벽에 붙여 놓는 세로형 피아노입니다. 2×2칸.", "wall-north", TAVERN.concat(DINING), rect(2, 26, 2, 2)),
  def("lpc_organ", "교회 오르간", "금색 파이프가 솟은 대형 오르간입니다. 3×3칸.", "wall-north", TAVERN, rect(5, 26, 3, 3)),
  def("lpc_arch_door", "아치문", "성당·예배당의 뾰족한 아치문입니다. 1×2칸이며 벽에 세웁니다.", "wall-any", TAVERN.concat(CORRIDOR), rect(10, 30, 1, 2)),
  def("lpc_bench_wood", "나무 벤치", "등받이 없는 긴 나무 벤치입니다. 3×1칸.", "wall-north", TAVERN.concat(DINING, CORRIDOR), rect(8, 27, 3, 1)),
  def("lpc_mirror_tall", "전신 거울", "벽에 세우는 전신 거울입니다. 1×3칸.", "wall-any", BEDROOM.concat(DINING), rect(3, 16, 1, 3)),

  // ── 벽난로·시계 ─────────────────────────────────────────────────────
  def("lpc_fireplace", "벽난로", "아치형 아궁이가 있는 석조 벽난로입니다. 3×3칸이며 북쪽 벽에 붙여 놓습니다.", "wall-north", KITCHEN.concat(TAVERN, BEDROOM), rect(12, 23, 3, 3), "stove"),
  def("lpc_clock_tall", "괘종시계", "진자와 문자판이 있는 대형 괘종시계입니다. 1×3칸.", "wall-any", BEDROOM.concat(STUDY, CORRIDOR), rect(10, 23, 1, 3)),

  // ── 주방 설비 ───────────────────────────────────────────────────────
  def("lpc_sink", "싱크대", "수도꼭지와 개수대가 달린 조리대입니다. 1×2칸.", "wall-north", KITCHEN, rect(6, 0, 1, 2), "stove"),
  def("lpc_stove", "화구 조리대", "화구가 올라간 조리대입니다. 1×2칸.", "wall-north", KITCHEN, rect(7, 0, 1, 2), "stove"),
  def("lpc_cutting_board", "도마 조리대", "도마와 채소가 놓인 조리대입니다. 1×2칸.", "wall-north", KITCHEN, rect(8, 0, 1, 2), "stove"),
  def("lpc_pot_shelf", "냄비 걸이 선반", "냄비가 걸린 벽면 선반입니다. 1×2칸.", "wall-north", KITCHEN, rect(9, 0, 1, 2), "stove"),
  def("lpc_bowl_counter", "대야 조리대", "큰 대야와 접시가 놓인 조리대입니다. 1×2칸.", "wall-north", KITCHEN.concat(DINING), rect(12, 0, 1, 2), "stove"),
];

export const LPC_WOODEN_FURNITURE_TEXTURE = LPC_WOODEN_FURNITURE_TILESET_TEXTURE_KEY;

/**
 * 공용 오브젝트 조회 — 복제·편집 경로가 쓰는 해석기.
 *
 * 왜 필요한가: `copyBuiltin` 과 `copyBuiltinObjectIntoProject` 는 `interiorObjectById` ·
 * `tiboInteriorObjectById` 만 본다. LPC 킷은 그 둘에 없어서 "내 오브젝트로 복제" 가
 * **아무 일도 하지 않고 조용히 끝난다**(버튼이 죽은 것처럼 보인다). 실내 오브젝트와 같은
 * 모양(InteriorObjectDef)으로 돌려주면 두 경로가 그대로 동작한다.
 */
export function lpcFurnitureObjectById(id: string): InteriorObjectDef | undefined {
  const object = LPC_WOODEN_FURNITURE_OBJECTS.find((entry) => entry.id === id);
  if (!object) return undefined;
  return {
    id: object.id,
    label: object.label,
    description: object.description,
    role: object.interiorRole ?? null,
    width: object.width,
    height: object.height,
    // 이 시트의 가구는 전부 상위 레이어 실루엣이다(파일 헤더의 레이어 계약).
    layer: "upper",
    cells: object.cells.map((cell) => ({ dx: cell.dx, dy: cell.dy, layer: "upper" as const, tile: cell.tile })),
    themes: [...object.themes],
    snap: object.snap,
  };
}
