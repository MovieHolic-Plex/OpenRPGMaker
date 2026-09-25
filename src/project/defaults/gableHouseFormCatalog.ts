// project/defaults/gableHouseFormCatalog.ts
// 박공 조합 형태 카탈로그 — 정면 박공(세모 합각)·측면 박공 덩어리를 부품으로 짜 맞춘 단층 집.
//
// 왜 필요한가(2026-09-25 사용자 「집 모양이 다 비슷비슷해서 아쉽네」): 날개 문법(houseTemplateCatalog)의
// 34종은 바닥 모양만 다르고 지붕이 전부 같은 모임지붕이라 위에서 보면 네모 덩어리 조합으로 읽혔다.
// 실루엣이 갈리는 집은 참고 사례에서 잘라 온 박공 6채(ref-walled-01·02·04, ref-castle-05·08·23)뿐이었고,
// 그 셀 레시피는 재료가 박혀 있어 킷과 조합되지 않았다. 여기서는 그 참고 집들이 쓰는 박공 문법
// (삼각 몸통 + 합각 벽 + 사선 캡)을 부품으로 떼어, 날개 문법처럼 **킷과 무관한 좌표 데이터**로 선언한다.
// 타일 번호는 여기 없다 — 시공 좌표를 셀 레시피로 바꾸는 일은 editor/gableHouseCompose.ts 가 킷을 받아 한다.
//
// 부품:
//  · front — 정면 박공(용마루가 앞뒤로 달리고 합각이 남쪽을 본다). 폭은 짝수 4·6·8.
//    지붕 = 합각 행 (w/2-1) + steep(온폭 몸통 행) + 좁아지는 몸통 행 (w/2-1) + 꼭대기 캡 행 1.
//  · block — 측면 박공/모임 덩어리(용마루가 좌우로 달린다). roofRows 는 용마루·몸통·처마를 합친 행 수(≥2).
//    ends:"hip" 은 윗줄을 1칸씩 들이고 모서리 캡, "verge" 는 좌우 끝 열을 사선 박공 테(밝은/어두운 면)로.
//  · 좌표는 부품끼리의 상대값이다. bottom = 그 부품 벽 맨 아랫줄. 합성기가 bbox 를 원점으로 옮긴다.
//  · 그리는 순서 = bottom 오름차순(뒤→앞), 같은 줄이면 block 먼저. 앞 부품의 불투명 칸이 뒤 부품을 덮고,
//    사선 캡(투명)은 뒤 부품 지붕 위에 얹혀 박공이 본채 지붕에서 솟는 모양이 된다.
//  · 문은 door:true 부품(없으면 가장 앞 부품)의 벽 아랫줄. 정면 박공은 가운데 왼쪽 칸.

export type GableWallHeight = "normal" | "low";

export interface GableFrontPart {
  readonly kind: "front";
  readonly x: number;
  /** 짝수 ≥4. */
  readonly w: number;
  readonly bottom: number;
  readonly wall?: GableWallHeight;
  /** 합각과 좁아지는 몸통 사이의 온폭 몸통 행 — 뾰족함·뒤채까지 이어지는 날개 지붕. */
  readonly steep?: number;
  readonly door?: boolean;
}

export interface GableBlockPart {
  readonly kind: "block";
  readonly x: number;
  /** ≥3. */
  readonly w: number;
  readonly bottom: number;
  /** 지붕 행(용마루 + 몸통 + 처마) ≥2. */
  readonly roofRows: number;
  readonly wall?: GableWallHeight;
  readonly ends?: "hip" | "verge";
  readonly door?: boolean;
}

export type GablePart = GableFrontPart | GableBlockPart;

export interface GableHouseFormSpec {
  readonly id: string;
  readonly name: string;
  readonly parts: readonly GablePart[];
}

const front = (x: number, w: number, bottom: number, extra: Partial<Omit<GableFrontPart, "kind" | "x" | "w" | "bottom">> = {}): GableFrontPart =>
  ({ kind: "front", x, w, bottom, ...extra });
const block = (x: number, w: number, bottom: number, roofRows: number, extra: Partial<Omit<GableBlockPart, "kind" | "x" | "w" | "bottom" | "roofRows">> = {}): GableBlockPart =>
  ({ kind: "block", x, w, bottom, roofRows, ...extra });

/**
 * 단층 박공 형태. id 는 gable-* 로 시작한다 — author_house templateId 와 마을 슬롯 후보가 같은 id 를 쓴다.
 * 폭 ≤8·높이 ≤9 는 마을 형태 경로(morphologyPlan)가 받는 상한이다. 그보다 큰 형태는 author_house 전용.
 */
export const GABLE_HOUSE_FORM_SPECS: readonly GableHouseFormSpec[] = [
  // ── 박공 하나 ──
  { id: "gable-cottage", name: "박공 오두막", parts: [front(0, 4, 0)] },
  { id: "gable-house", name: "박공집", parts: [front(0, 6, 0)] },
  { id: "gable-steep", name: "뾰족 박공집", parts: [front(0, 6, 0, { steep: 1 })] },
  { id: "gable-tall-cottage", name: "뾰족 박공 오두막", parts: [front(0, 4, 0, { steep: 1 })] },
  { id: "gable-shed", name: "박공 창고", parts: [front(0, 4, 0, { wall: "low" })] },
  { id: "gable-barn", name: "낮은 헛간 박공", parts: [front(0, 6, 0, { wall: "low" })] },
  // ── 박공 둘 ──
  { id: "gable-twin", name: "쌍박공", parts: [front(0, 4, 0, { door: true }), front(4, 4, 0)] },
  { id: "gable-twin-step", name: "엇갈린 쌍박공", parts: [front(0, 4, 0, { door: true }), front(4, 4, -1)] },
  { id: "gable-twin-big", name: "큰 박공 + 작은 박공", parts: [front(0, 6, 0, { door: true }), front(6, 4, -1, { wall: "low" })] },
  // ── 측면 박공 본채 + 정면 박공 ──
  { id: "gable-cross", name: "교차 박공 T자", parts: [block(0, 8, -2, 3), front(2, 4, 0, { steep: 2, door: true })] },
  { id: "gable-cross-l", name: "교차 박공 ㄱ자", parts: [block(2, 6, -2, 3), front(0, 4, 0, { steep: 2, door: true })] },
  { id: "gable-cross-r", name: "교차 박공 ㄴ자", parts: [block(0, 6, -2, 3), front(4, 4, 0, { steep: 2, door: true })] },
  { id: "gable-dormer", name: "합각 본채", parts: [block(0, 8, 0, 4, { ends: "verge" }), front(2, 4, 0, { door: true })] },
  { id: "gable-porch", name: "현관 박공", parts: [block(0, 7, -2, 3, { ends: "verge" }), front(2, 4, 0, { wall: "low", steep: 1, door: true })] },
  { id: "gable-porch-wide", name: "현관 박공 장옥", parts: [block(0, 8, -2, 3), front(4, 4, 0, { wall: "low", steep: 1, door: true })] },
  // ── 정면 박공 본채 + 곁채 ──
  { id: "gable-annex", name: "박공 + 곁채", parts: [front(0, 4, 0, { door: true }), block(4, 4, -1, 3, { wall: "low" })] },
  { id: "gable-annex-l", name: "곁채 + 박공", parts: [block(0, 3, -1, 3, { wall: "low" }), front(3, 4, 0, { door: true })] },
  { id: "gable-lean", name: "박공 + 달개", parts: [block(0, 8, 0, 2, { wall: "low" }), front(2, 4, 0, { door: true })] },
  // ── 측면 박공 덩어리(용마루가 좌우로) ──
  { id: "gable-long", name: "측면 박공 장옥", parts: [block(0, 8, 0, 3, { ends: "verge" })] },
  { id: "gable-long-low", name: "측면 박공 헛간", parts: [block(0, 7, 0, 3, { ends: "verge", wall: "low" })] },
  { id: "gable-long-step", name: "측면 박공 두 채", parts: [block(0, 5, 0, 3, { ends: "verge", door: true }), block(5, 3, -1, 3, { ends: "verge", wall: "low" })] },
  { id: "gable-hall", name: "측면 박공 + 정면 박공 두 개", parts: [block(0, 8, -1, 3, { ends: "verge" }), front(0, 4, 0, { door: true }), front(4, 4, 0)] },
];

export function findGableHouseFormSpec(id: string): GableHouseFormSpec | undefined {
  return GABLE_HOUSE_FORM_SPECS.find((spec) => spec.id === id);
}
