// project/defaults/authoredHouseFormCatalog.ts
// 저작 집 형태 카탈로그 — 유저가 맵에 직접 그려 검증된 집을 셀 레시피로 굳힌 정본.
//
// 왜 별도 카탈로그인가: houseTemplateCatalog 의 날개(wings) 모델은 "한 열 = 지붕 하나
// + 벽 밴드 하나" 라서, 같은 열에 벽→지붕→벽이 세로로 쌓이는 형태(아래 manor 처럼
// 중간 벽 + 발코니 + 전폭 스커트 지붕 + 하단 벽)를 표현하지 못한다. 저작 형태는
// SectionStructureKitDef 와 같은 행렬 데이터(tiles/upperTiles, -1=빈칸)로 셀을 직접 선언한다.
//
// author_house 에서 templateId 로 선택된다 — parseShape 가 날개 카탈로그에 없는 id 를
// 여기서 찾고, 폼이면 시공은 buildHouseKit 이 stampAuthoredHouseForm 에 위임한다.
// 마을 슬롯 카탈로그가 아니므로 w 상한(8)이나 자동 배치 대상이 아니다.
//
// 규칙:
//  · rows.length === h, 각 row.tiles.length === w (upperTiles 도 있으면 w).
//  · 불투명 타일은 하위(tiles), 투명 오버레이(용마루·처마 캡·창문·굴뚝)만 상위(upperTiles).
//    단 예외: 계단 전환 칸처럼 불투명 두 장을 겹쳐야 하는 곳만 상위에 불투명을 둔다.
//  · 문 칸은 벽 타일로 둔다 — 문 렌더링(359 배경·이벤트)은 doorAt + 시공 기계 소관.
//  · 레시피는 원점(0,0) 기준. doorAt 은 문 두 칸의 아래쪽 칸(stampHouseDoorBackground 규약).

import type { HouseKitId } from "@/editor/houseKit";

export interface AuthoredHouseFormRow {
  /** 하위 레이어 셀 — -1 은 그대로 둔다. */
  readonly tiles: readonly number[];
  /** 상위 레이어 셀 — -1 은 그대로 둔다. 생략하면 전부 빈칸. */
  readonly upperTiles?: readonly number[];
}

/** 저작 집 형태 한 종. 순수 데이터 — 구조 복제·JSON 직렬화가 그대로 된다. */
export interface AuthoredHouseFormDef {
  readonly id: string;
  readonly name: string;
  /** 레시피 폭·높이(칸). rows 와 정확히 일치해야 한다. */
  readonly w: number;
  readonly h: number;
  /** 실내 층수(내부 맵 생성에 사용). */
  readonly stories: 1 | 2 | 3;
  /** 명목 재료 킷 — 실내 풍·보호 라벨에 쓰인다. 외장 셀은 rows 가 정본이다. */
  readonly kitId: HouseKitId;
  /** 지상층 문 위치 — 두 칸 문의 아래쪽 칸(레시피 로컬 좌표). */
  readonly doorAt: { readonly x: number; readonly y: number };
  readonly rows: readonly AuthoredHouseFormRow[];
}

export const AUTHORED_HOUSE_FORM_DEFS: readonly AuthoredHouseFormDef[] = [
  {
    // '고양이' 프로젝트 맵에 유저가 직접 그린 2층 저택을 셀 단위로 굳힌 형태.
    // 탑 지붕(계단 사선) + 우측 슬라브 + 중간 회벽(2층 발코니 문) + 발코니 데크·난간
    // + 전폭 스커트 지붕 + 하단 회벽. 재료: 주황 기와(404 계열) + 흰 회벽(15/45/75).
    id: "manor-balcony",
    name: "계단지붕 저택(발코니)",
    w: 13,
    h: 17,
    stories: 2,
    kitId: "bright-plaster",
    doorAt: { x: 6, y: 16 },
    // 지붕 트림(376/377)·용마루(374)·캡은 상위 슬롯에 둔 저작 오버레이다(아래 지면 보존).
    // 374–377 의 홈 분류는 하위로 교정됐지만(roof-body 그룹) 이 폼은 유저 원작의 셀 배치가
    // 정본이라 그대로 둔다. 몸통·벽·발코니는 하위. 예외: (12,3)은 상위가 굴뚝 326 이라 트림을 하위에 둔다.
    rows: [
      { tiles: [-1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1], upperTiles: [-1, 354, 374, 374, 374, 374, 374, 355, -1, -1, -1, -1, -1] },
      { tiles: [-1, -1, 404, 404, 404, 404, 404, -1, -1, -1, -1, -1, -1], upperTiles: [-1, 376, -1, -1, -1, -1, -1, 377, -1, -1, -1, -1, -1] },
      { tiles: [-1, -1, 404, 404, 404, 404, 404, -1, -1, -1, -1, -1, -1], upperTiles: [354, 376, -1, -1, -1, -1, -1, 377, 374, 374, 374, 374, 355] },
      { tiles: [-1, 404, 404, 404, 404, 404, 404, -1, 404, 404, 404, 404, 377], upperTiles: [376, 376, -1, -1, -1, -1, -1, 377, -1, -1, -1, -1, 326] },
      { tiles: [-1, 405, 405, 405, 405, 405, 405, 405, 404, 404, 404, 404, -1], upperTiles: [376, 384, -1, -1, -1, -1, -1, 385, -1, -1, -1, -1, 377] },
      { tiles: [-1, 45, 46, 46, 46, 46, 46, 47, 404, 404, 404, 404, -1], upperTiles: [376, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, 377] },
      { tiles: [-1, 45, 46, 46, 367, 46, 46, 47, 404, 404, 404, 404, -1], upperTiles: [376, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, 377] },
      { tiles: [-1, 75, 76, 76, 359, 76, 76, 77, 404, 404, 404, 404, -1], upperTiles: [376, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, 377] },
      { tiles: [-1, 198, 199, 199, 199, 199, 199, 199, 404, 404, 404, 404, -1], upperTiles: [376, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, 377] },
      { tiles: [-1, 223, 223, 223, 223, 223, 223, 223, 404, 404, 404, 404, -1], upperTiles: [376, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, 377] },
      { tiles: [-1, 167, 163, 167, 163, 167, 163, 167, 404, 404, 404, 404, -1], upperTiles: [376, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, 377] },
      { tiles: [-1, 404, 404, 404, 404, 404, 404, 404, 404, 404, 404, 404, -1], upperTiles: [376, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, 377] },
      { tiles: [-1, 404, 404, 404, 404, 404, 404, 404, 404, 404, 404, 404, -1], upperTiles: [376, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, 377] },
      { tiles: [405, 405, 405, 405, 405, 405, 405, 405, 405, 405, 405, 405, 405], upperTiles: [384, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, 385] },
      { tiles: [15, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 17] },
      { tiles: [45, 46, 46, 46, 46, 46, 46, 46, 46, 46, 46, 46, 47], upperTiles: [-1, 85, -1, 85, -1, -1, -1, -1, -1, 85, -1, 85, -1] },
      { tiles: [75, 76, 76, 76, 76, 76, 76, 76, 76, 76, 76, 76, 77] },
    ],
  },
];

/** id로 저작 형태를 찾는다. 알 수 없는 id는 undefined — 호출부가 다른 카탈로그로 넘긴다. */
export function findAuthoredHouseForm(id: string): AuthoredHouseFormDef | undefined {
  return AUTHORED_HOUSE_FORM_DEFS.find((def) => def.id === id);
}
