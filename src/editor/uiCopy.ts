// editor/uiCopy.ts
// - 모드별 용어 스타일(jargonStyle)에 따라 UI 문구를 반환하는 단일 테이블.
// - plain: 초보용 일상어(자료집/바닥/장식), technical: 기존 도메인 용어(데이터베이스/하위/상위).

export type UiCopyStyle = "plain" | "technical";

export type UiCopyKey =
  | "database"
  | "databaseShort"
  | "tilesetMissing"
  | "layerLower"
  | "layerUpper"
  | "layerEvent"
  | "onlineSave"
  | "resources"
  | "world";

// 2026-08-21 용어 정리 라운드: technical 쪽 값이 곧 RM 유래 용어였다 — 하위/상위는 下層/上層의
// 직역이다. **레이어 이름은 두 스타일을 하나로 통일**한다(감독 지시: 초보 용어를 전 모드
// 표준으로). 밀도 축(jargonStyle)은 남기되, 레이어처럼 "전문가라고 다르게 부를 이유가
// 없는" 항목은 같은 말을 쓴다.
//
// 상위 레이어를 왜 "장식"이 아니라 "덧그림"인가 — `장식`은 이미 **타일 분류** 이름이다
// (팔레트 필터 칩, tileMeta role "decoration", 타일 의미 태그). 레이어에도 쓰면 같은
// 화면에서 두 뜻이 겹친다. "덧그림"은 그 레이어가 실제로 하는 일(캐릭터 위에 덧그린다)이다.
const UI_COPY: Record<UiCopyKey, Record<UiCopyStyle, string>> = {
  database: { plain: "자료집", technical: "데이터베이스" },
  databaseShort: { plain: "자료", technical: "DB" },
  tilesetMissing: { plain: "그림이 없습니다", technical: "타일 그림판이 없습니다" },
  layerLower: { plain: "바닥", technical: "바닥" },
  layerUpper: { plain: "덧그림", technical: "덧그림" },
  layerEvent: { plain: "이벤트", technical: "이벤트" },
  onlineSave: { plain: "온라인 저장", technical: "온라인 저장" },
  // `resources.plain` 은 2026-08-26 까지 `"자료"` 였다 — `databaseShort.plain` 과 글자까지 같아서
  // 같은 메뉴에 라벨이 똑같은 항목이 두 개 뜨는 사고가 있었다(standard ⋯ 메뉴). 자료집(DB)과
  // 소재(그림·소리 파일)는 다른 것이므로 이름도 다르게 둔다. 클래식 툴바는 이미 "소재"를 썼다.
  resources: { plain: "소재", technical: "리소스" },
  world: { plain: "세계", technical: "월드" },
};

export function uiLabel(key: UiCopyKey, style: UiCopyStyle = "plain"): string {
  return UI_COPY[key][style];
}

/**
 * 도구 이름 단일 원천.
 *
 * 2026-08-21 실측: 같은 도구가 네 군데에서 다르게 불렸다 — 도구막대 "펜", 상태바 "펜",
 * 도움말 "브러시(연필)", 커맨드 팔레트 "브러시", AI 브리핑 "펜". 라벨은 **행위**를
 * 말하고(칠하기·지우기·집기) 한 곳에서만 정의한다. `TOOL_LABEL[tool]` 을 쓰지 않고
 * 문자열을 새로 적으면 다시 갈라진다.
 */
export const TOOL_LABEL = {
  paint: "칠하기",
  erase: "지우기",
  fill: "채우기",
  select: "영역 선택",
  eyedropper: "타일 집기",
  pan: "화면 밀기",
  collision: "통행 표시",
  event: "장면 놓기",
} as const satisfies Record<string, string>;

export function toolLabel(tool: string): string {
  return (TOOL_LABEL as Record<string, string | undefined>)[tool] ?? tool;
}

const USER_FACING_TOOL_NAMES: Readonly<Record<string, string>> = {
  paint_road: "길 그리기",
  build_house: "마을 짓기",
  author_village: "마을 짓기",
  make_villager: "사람 만들기",
  run_lint: "검사",
  plan_world: "세계 계획",
};

/** Replace a bare internal tool id while leaving ordinary user-facing sentences intact. */
export function sanitizeUserFacingToolId(raw: string): string {
  const mapped = USER_FACING_TOOL_NAMES[raw];
  if (mapped) return mapped;
  return /^[a-z][a-z0-9_]*$/.test(raw) ? "작업" : raw;
}
