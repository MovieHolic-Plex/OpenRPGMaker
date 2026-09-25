// project/defaults/houseTemplateCatalog.ts
// 마을 집 형태 카탈로그 — 선언형 데이터 정본(34종).
//
// 2026-08 데이터화: 예전에는 village/constants.ts가 템플릿마다 wingsAt(x, y) 함수를 들고 있어서
// 형태를 JSON으로 옮길 수 없었다(데이터베이스 탭·프로젝트 저장 불가). 이제 날개는 원점(0,0)
// 기준 사각형 배열이고, 시공 좌표는 houseTemplateWingsAt()이 평행이동으로 만든다.
// 함수형 카탈로그와의 동일성은 test/fixtures/houseTemplates.baseline.json(리팩터 전 덤프)이 고정한다.
//
// 카탈로그 규칙:
//  · 열 구간(footprint interval) 높이 >= 벽 밴드 + 2 (1층 5 / 2층 7 / 3층 9 / lowWall 4).
//  · w <= 8 — 후보 슬롯 폭(slotWidth) 필터를 통과해야 실제 배치된다. 큰 필지는 세로로 늘린다.
//  · estate-*: 본채 + 분리 헛간 날개 한 필지 — 울타리 패스(fences.ts)가 bbox+1 둘레를 치므로
//    자동으로 "울타리 안에 헛간 있는 큰 집"이 된다.
//
// ⚠ 여기 값은 좌표·치수만이다. 타일 번호는 킷(editor/houseKit.ts)이 갖는다.

import type { HouseKitId } from "@/editor/houseKit";

/** 원점 기준 날개 사각형. FootprintWing과 같은 모양이지만 좌표계가 템플릿 로컬이다. */
export interface HouseTemplateWing {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
  /** 이 날개만의 층수(계단식 2층). 생략하면 템플릿의 stories 를 쓴다. */
  readonly stories?: 1 | 2 | 3;
}

/** 집 형태 한 종. 순수 데이터 — 구조 복제·JSON 직렬화가 그대로 된다. */
export interface HouseTemplateDef {
  readonly id: string;
  readonly name: string;
  readonly w: number;
  readonly h: number;
  /** footprint 층수. 기본 1. */
  readonly stories?: 1 | 2 | 3;
  /** 낮은 벽(상단+하단 2행) — 헛간·창고·오두막. */
  readonly lowWall?: boolean;
  /** 킷 강제 — 옥상 데크처럼 지오메트리가 킷에 종속인 템플릿. 랜덤 믹스보다 우선. */
  readonly kitId?: HouseKitId;
  /** 옥상 판자 데크 + 벽면 사다리(파랑 평지붕 전용) — houses.ts applyRoofDeck. */
  readonly roofDeck?: boolean;
  /** 원점(0,0) 기준 날개. 선언 순서가 문 판정(가장 긴 외부 하단 런)에 영향을 준다. */
  readonly wings: readonly HouseTemplateWing[];
}

export const HOUSE_TEMPLATE_DEFS: readonly HouseTemplateDef[] = [
  // ── 직사각 계열 ──
  { id: "rect-large", name: "직사각 대", w: 8, h: 7, stories: 1, wings: [{ x: 0, y: 0, w: 8, h: 7 }] },
  { id: "rect-small", name: "직사각 소", w: 6, h: 6, stories: 1, wings: [{ x: 0, y: 0, w: 6, h: 6 }] },
  { id: "rect-tall", name: "직사각 고지붕", w: 7, h: 8, stories: 1, wings: [{ x: 0, y: 0, w: 7, h: 8 }] },
  { id: "rect-wide", name: "납작 장옥", w: 8, h: 6, stories: 1, wings: [{ x: 0, y: 0, w: 8, h: 6 }] },
  { id: "rect-slim", name: "좁은 집", w: 5, h: 6, stories: 1, wings: [{ x: 0, y: 0, w: 5, h: 6 }] },
  { id: "rect-min", name: "소형 오두막", w: 4, h: 5, stories: 1, wings: [{ x: 0, y: 0, w: 4, h: 5 }] },
  { id: "rect-long", name: "고지붕 장옥", w: 8, h: 9, stories: 1, wings: [{ x: 0, y: 0, w: 8, h: 9 }] },
  { id: "rect-2f", name: "직사각 2층", w: 7, h: 9, stories: 2, wings: [{ x: 0, y: 0, w: 7, h: 9 }] },
  { id: "rect-2f-slim", name: "좁은 2층", w: 5, h: 9, stories: 2, wings: [{ x: 0, y: 0, w: 5, h: 9 }] },
  { id: "rect-3f", name: "직사각 3층", w: 8, h: 11, stories: 3, wings: [{ x: 0, y: 0, w: 8, h: 11 }] },
  // ── 낮은 벽(상단+하단 2행) — 헛간·창고·오두막 ──
  { id: "cottage-low", name: "낮은 오두막", w: 5, h: 4, stories: 1, lowWall: true, wings: [{ x: 0, y: 0, w: 5, h: 4 }] },
  { id: "hut-low", name: "외양간", w: 4, h: 4, stories: 1, lowWall: true, wings: [{ x: 0, y: 0, w: 4, h: 4 }] },
  { id: "barn-low", name: "낮은 헛간", w: 6, h: 5, stories: 1, lowWall: true, wings: [{ x: 0, y: 0, w: 6, h: 5 }] },
  // ── ㄱ자 계열(4방향·크기) ──
  { id: "l", name: "ㄱ자", w: 6, h: 8, stories: 1, wings: [{ x: 0, y: 0, w: 3, h: 8 }, { x: 3, y: 0, w: 3, h: 6 }] },
  { id: "l-mirror", name: "ㄴ자(거울)", w: 6, h: 8, stories: 1, wings: [{ x: 0, y: 0, w: 3, h: 6 }, { x: 3, y: 0, w: 3, h: 8 }] },
  { id: "l-wide", name: "ㄱ자 대", w: 8, h: 8, stories: 1, wings: [{ x: 0, y: 0, w: 4, h: 8 }, { x: 4, y: 0, w: 4, h: 6 }] },
  { id: "l-deep", name: "ㄱ자 깊은", w: 7, h: 9, stories: 1, wings: [{ x: 0, y: 0, w: 4, h: 9 }, { x: 4, y: 0, w: 3, h: 6 }] },
  // ── T자(현관 돌출)·본채+별채 ──
  { id: "t-porch", name: "T자 현관", w: 8, h: 9, stories: 1, wings: [{ x: 0, y: 0, w: 8, h: 6 }, { x: 2, y: 6, w: 3, h: 3 }] },
  { id: "t-hall", name: "T자 홀", w: 8, h: 10, stories: 1, wings: [{ x: 0, y: 0, w: 8, h: 6 }, { x: 3, y: 6, w: 3, h: 4 }] },
  { id: "porch-cottage", name: "현관 오두막", w: 6, h: 8, stories: 1, wings: [{ x: 0, y: 0, w: 6, h: 5 }, { x: 1, y: 5, w: 3, h: 3 }] },
  { id: "annex", name: "본채+곁채", w: 8, h: 7, stories: 1, wings: [{ x: 0, y: 0, w: 5, h: 7 }, { x: 5, y: 2, w: 3, h: 5 }] },
  // ── ㄷ자·중정 ──
  {
    id: "u", name: "ㄷ자", w: 8, h: 8, stories: 1,
    wings: [
      { x: 0, y: 0, w: 8, h: 5 },
      { x: 0, y: 5, w: 3, h: 3 },
      { x: 5, y: 5, w: 3, h: 3 },
    ],
  },
  {
    // 2026-09-25 사용자 검토 「너무 튀어나온다」: 팔(날개)을 4칸 → 3칸으로 줄이고 그만큼 본채를 깊게 했다.
    // 팔 지붕이 한 줄뿐이라 안뜰 쪽이 구멍처럼 읽히던 것도 이 비율에서 벽 3줄만 남아 깔끔해진다.
    id: "u-deep", name: "ㄷ자 깊은", w: 8, h: 9, stories: 1,
    wings: [
      { x: 0, y: 0, w: 8, h: 6 },
      { x: 0, y: 6, w: 3, h: 3 },
      { x: 5, y: 6, w: 3, h: 3 },
    ],
  },
  {
    id: "courtyard", name: "ㅁ자 중정", w: 8, h: 12, stories: 1,
    wings: [
      { x: 0, y: 0, w: 8, h: 5 },
      { x: 0, y: 7, w: 8, h: 5 },
      { x: 0, y: 0, w: 3, h: 12 },
      { x: 5, y: 0, w: 3, h: 12 },
    ],
  },
  // ── 오프셋 날개(이미지 #7 계열) ──
  { id: "z-offset", name: "엇갈린 날개", w: 8, h: 10, stories: 1, wings: [{ x: 0, y: 0, w: 5, h: 8 }, { x: 3, y: 2, w: 5, h: 8 }] },
  { id: "z-mirror", name: "엇갈린 날개(거울)", w: 8, h: 10, stories: 1, wings: [{ x: 3, y: 0, w: 5, h: 8 }, { x: 0, y: 2, w: 5, h: 8 }] },
  // ── 대형 필지(estate) — 본채 + 분리 헛간, 울타리가 필지 전체를 감싼다 ──
  { id: "estate-shed-r", name: "필지(헛간 우)", w: 7, h: 14, stories: 1, wings: [{ x: 0, y: 7, w: 7, h: 7 }, { x: 3, y: 0, w: 4, h: 5 }] },
  { id: "estate-shed-l", name: "필지(헛간 좌)", w: 7, h: 14, stories: 1, wings: [{ x: 0, y: 7, w: 7, h: 7 }, { x: 0, y: 0, w: 4, h: 5 }] },
  { id: "estate-barn", name: "큰 필지(외양간)", w: 8, h: 15, stories: 1, wings: [{ x: 0, y: 8, w: 8, h: 7 }, { x: 2, y: 0, w: 6, h: 5 }] },
  // ── 계단식 2층(2026-09-11) — 위층이 드러나는 집. 예전 A자 지붕 4종을 대체한다.
  // 날개마다 stories 를 적어 두면 열 구간마다 벽 밴드가 달라져 "층이 내려앉는" 실루엣이 된다.
  { id: "tier-front", name: "계단식 2층", w: 7, h: 15, stories: 2, wings: [
    // 뒤쪽 2층 본채와 앞쪽 전폭 1층이 겹치지 않고 세로로 붙는다 — 층수 경계에서
    // 열 구간이 나뉘어 본채 벽이 1층 지붕 위로 드러난다. 겹쳐 짜면 앞 날개는
    // 좌우로 삐져나온 폭만 남아 '지붕 플랩'처럼 읽힌다(실측).
    { x: 1, y: 0, w: 5, h: 9, stories: 2 },
    { x: 0, y: 9, w: 7, h: 6, stories: 1 },
  ] },
  { id: "tier-wide", name: "계단식 2층(넓은 1층)", w: 8, h: 11, stories: 2, wings: [
    { x: 2, y: 0, w: 4, h: 11, stories: 2 },
    { x: 0, y: 5, w: 8, h: 6, stories: 1 },
  ] },
  { id: "tier-symmetric", name: "계단식 2층(좌우 날개)", w: 8, h: 12, stories: 2, wings: [
    { x: 2, y: 0, w: 4, h: 12, stories: 2 },
    { x: 0, y: 4, w: 3, h: 8, stories: 1 },
    { x: 5, y: 4, w: 3, h: 8, stories: 1 },
  ] },
  { id: "tier-l", name: "계단식 2층(ㄱ자)", w: 8, h: 13, stories: 2, wings: [
    { x: 0, y: 0, w: 4, h: 13, stories: 2 },
    { x: 0, y: 7, w: 8, h: 6, stories: 1 },
  ] },
  // ── 옥상 데크 — 파랑 평지붕 위 판자 보행면 + 벽면 사다리(322) ──
  { id: "rooftop-deck", name: "옥상 데크", w: 7, h: 8, stories: 1, kitId: "blue-stone", roofDeck: true, wings: [{ x: 0, y: 0, w: 7, h: 8 }] },
];

/** 원점 기준 날개를 시공 좌표로 평행이동한다. 형태 데이터의 유일한 전개 경로. */
export function houseTemplateWingsAt(def: HouseTemplateDef, x: number, y: number): HouseTemplateWing[] {
  return def.wings.map((wing) => ({
    x: wing.x + x,
    y: wing.y + y,
    w: wing.w,
    h: wing.h,
    ...(wing.stories === undefined ? {} : { stories: wing.stories }),
  }));
}

/** id로 형태를 찾는다. 알 수 없는 id는 undefined — 호출부가 경고 후 제거한다. */
export function findHouseTemplateDef(id: string): HouseTemplateDef | undefined {
  return HOUSE_TEMPLATE_DEFS.find((def) => def.id === id);
}
