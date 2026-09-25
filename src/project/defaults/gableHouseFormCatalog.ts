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
  /** 층수(기본 1). 2 = 벽 5줄(윗 띠·2층 창 줄·층 띠·1층 창 줄·아랫줄). wall:"low" 와 함께 쓰지 않는다. */
  readonly stories?: 1 | 2;
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
  /** 층수(기본 1). 2 = 벽 5줄. */
  readonly stories?: 1 | 2;
  readonly ends?: "hip" | "verge";
  readonly door?: boolean;
}

export type GablePart = GableFrontPart | GableBlockPart;

export interface GableHouseFormSpec {
  readonly id: string;
  readonly name: string;
  readonly parts: readonly GablePart[];
  /**
   * 자동 추첨 가중치(기본 1). 0 이면 자동 추첨(author_house 생략 배정·마을 분배)에서 빠지고 templateId 로 명시할 때만 짓는다.
   * 2026-09-25 사용자 검토: 곁채 둘은 어색해서 0, 달개는 애매해서 낮춘다.
   */
  readonly mix?: number;
  /** 창고·헛간 — 창 없이 자동 추첨에 나와도 된다(2026-09-25 3차: 창 없는 창고는 괜찮다, 이름에 밝힌다). */
  readonly shed?: boolean;
}

const front = (x: number, w: number, bottom: number, extra: Partial<Omit<GableFrontPart, "kind" | "x" | "w" | "bottom">> = {}): GableFrontPart =>
  ({ kind: "front", x, w, bottom, ...extra });
const block = (x: number, w: number, bottom: number, roofRows: number, extra: Partial<Omit<GableBlockPart, "kind" | "x" | "w" | "bottom" | "roofRows">> = {}): GableBlockPart =>
  ({ kind: "block", x, w, bottom, roofRows, ...extra });

/**
 * 단층 박공 형태. id 는 gable-* 로 시작한다 — author_house templateId 와 마을 슬롯 후보가 같은 id 를 쓴다.
 * 폭 ≤8·높이 ≤9 는 마을 형태 경로(morphologyPlan)가 받는 상한이다. 그보다 큰 형태는 author_house 전용.
 *
 * 2026-09-25 사용자 검토 규칙(합성기 auditGableHouseForm 이 형태마다 검사한다):
 *  · 정면 박공이 측면 본채에 붙으면 본채 지붕은 날개 바깥 끝까지 뒤로 이어진다 — 사선 칸 뒤가 비면 안 된다.
 *    그래서 교차 박공의 본채(block)는 박공 날개를 끝까지 품는다(날개가 본채 폭 안에 있다).
 *  · (3차) 창은 민벽 칸에만, 좌우는 벽(끝 모서리 가능)·문 아님 — 문이 달린 폭 4 박공(문 옆에 「끝 | 창 | 끝」 3칸이 안 남는다)은 창을 낼 자리가 없어
 *    자동 추첨에서 뺐다(mix 0: 오두막·뾰족 오두막). 창 없는 창고는 shed 로 둔다.
 *  · 보이는 벽 면은 어디든 3칸 이상. 폭 8 본채 가운데에 폭 4 박공을 두면 양옆이 2칸이 되므로, 폭 8 이하에서는
 *    박공을 한쪽 끝에 붙이고(ㄱ·ㄴ자·현관) 가운데 박공(T자·합각)은 폭 10(author_house 전용)으로 짓는다.
 */
export const GABLE_HOUSE_FORM_SPECS: readonly GableHouseFormSpec[] = [
  // ── 박공 하나 ──
  { id: "gable-cottage", name: "박공 오두막", parts: [front(0, 4, 0)], mix: 0 },
  { id: "gable-house", name: "박공집", parts: [front(0, 6, 0)] },
  { id: "gable-steep", name: "뾰족 박공집", parts: [front(0, 6, 0, { steep: 1 })] },
  { id: "gable-tall-cottage", name: "뾰족 박공 오두막", parts: [front(0, 4, 0, { steep: 1 })], mix: 0 },
  { id: "gable-shed", name: "박공 창고(창 없음)", parts: [front(0, 4, 0, { wall: "low" })], shed: true },
  { id: "gable-barn", name: "낮은 헛간 박공", parts: [front(0, 6, 0, { wall: "low" })] },
  // ── 박공 둘 ──
  { id: "gable-twin", name: "쌍박공", parts: [front(0, 4, 0, { door: true }), front(4, 4, 0)] },
  { id: "gable-twin-step", name: "엇갈린 쌍박공", parts: [front(0, 4, 0, { door: true }), front(4, 4, -1)] },
  { id: "gable-twin-big", name: "큰 박공 + 작은 박공", parts: [front(0, 6, 0, { door: true }), front(6, 4, -1, { wall: "low" })] },
  // ── 측면 박공 본채 + 정면 박공(본채가 박공 날개를 끝까지 품는다) ──
  { id: "gable-cross", name: "교차 박공 T자", parts: [block(0, 10, -2, 3), front(3, 4, 0, { steep: 2, door: true })] },
  { id: "gable-cross-l", name: "교차 박공 ㄱ자", parts: [block(0, 8, -2, 3), front(0, 4, 0, { steep: 2, door: true })] },
  { id: "gable-cross-r", name: "교차 박공 ㄴ자", parts: [block(0, 8, -2, 3), front(4, 4, 0, { steep: 2, door: true })] },
  // 합각 본채: 모임지붕 본채 앞으로 한 줄 튀어나온 정면 박공 — 박공 몸통이 본채 처마보다 앞에 서서 깊이가 읽힌다.
  { id: "gable-dormer", name: "합각 본채", parts: [block(0, 10, -1, 4), front(3, 4, 0, { steep: 1, door: true })] },
  { id: "gable-porch", name: "현관 박공", parts: [block(0, 8, -2, 3, { ends: "verge" }), front(0, 4, 0, { wall: "low", steep: 1, door: true })] },
  { id: "gable-porch-wide", name: "현관 박공 장옥", parts: [block(0, 8, -2, 3), front(4, 4, 0, { wall: "low", steep: 1, door: true })] },
  // ── 정면 박공 본채 + 곁채 — 어색해서 자동 추첨 제외(명시하면 짓는다) ──
  { id: "gable-annex", name: "박공 + 곁채", parts: [front(0, 4, 0, { door: true }), block(4, 4, -1, 3, { wall: "low" })], mix: 0 },
  { id: "gable-annex-l", name: "곁채 + 박공", parts: [block(0, 3, -1, 3, { wall: "low" }), front(3, 4, 0, { door: true })], mix: 0 },
  // 박공 + 한쪽 달개: 달개 지붕이 박공 뒤로 이어지고 벽은 3칸. 애매해서 가중치를 낮춘다.
  { id: "gable-lean", name: "박공 + 달개", parts: [block(0, 8, 0, 2, { wall: "low" }), front(0, 4, 0, { door: true })], mix: 0.35 },
  // ── 측면 박공 덩어리(용마루가 좌우로) ──
  { id: "gable-long", name: "측면 박공 장옥", parts: [block(0, 8, 0, 3, { ends: "verge" })] },
  { id: "gable-long-low", name: "측면 박공 헛간", parts: [block(0, 7, 0, 3, { ends: "verge", wall: "low" })] },
  { id: "gable-long-step", name: "측면 박공 두 채", parts: [block(0, 5, -1, 3, { ends: "verge" }), block(5, 3, 0, 3, { ends: "verge", door: true })] },
  { id: "gable-hall", name: "측면 박공 + 정면 박공 두 개", parts: [block(0, 8, -1, 3, { ends: "verge" }), front(0, 4, 0, { door: true }), front(4, 4, 0)] },
  // ── 2층(2026-09-25) — 벽 5줄: 윗 띠 · 2층 창 줄 · 층 띠(벽 윗줄 칸 재사용) · 1층 창·문 줄 · 아랫줄. 문은 1층에만. ──
  { id: "gable-2f", name: "2층 박공집", parts: [front(0, 6, 0, { stories: 2 })] },
  { id: "gable-2f-narrow", name: "좁은 2층 박공집", parts: [front(0, 4, 0, { stories: 2 })] },
  { id: "gable-2f-long", name: "2층 측면 박공 장옥", parts: [block(0, 8, 0, 3, { ends: "verge", stories: 2 })] },
  { id: "gable-2f-lean", name: "2층 박공 + 단층 곁채", parts: [block(0, 8, 0, 2), front(0, 4, 0, { stories: 2, door: true })] },
  { id: "gable-2f-porch", name: "2층 장옥 + 현관 박공", parts: [block(0, 8, -1, 3, { stories: 2 }), front(0, 4, 0, { wall: "low", steep: 1, door: true })] },
];

/** 자동 추첨 가중치 — 0 이면 자동 추첨 제외. */
export function gableFormMixWeight(spec: GableHouseFormSpec): number {
  return Math.max(0, spec.mix ?? 1);
}

export function findGableHouseFormSpec(id: string): GableHouseFormSpec | undefined {
  return GABLE_HOUSE_FORM_SPECS.find((spec) => spec.id === id);
}
