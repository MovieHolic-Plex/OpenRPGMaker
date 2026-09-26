// editor/uiCopy.ts
// - 모드별 용어 스타일(jargonStyle)에 따라 UI 문구를 반환하는 단일 테이블.
// - plain: 초보용 일상어(자료집/바닥/장식), technical: 기존 도메인 용어(데이터베이스/하위/상위).

export type UiCopyStyle = "plain" | "technical";

export type UiCopyKey =
  | "database"
  | "databaseShort"
  | "tilesetMissing"
  | "layerRelief"
  | "layerLower"
  | "layerUpper"
  | "layerEvent"
  | "onlineSave"
  | "resources"
  | "resourceLibrary"
  | "world"
  | "audio"
  | "audioShort"
  | "mapEventSearch"
  | "mapEventSearchShort"
  | "testPlay"
  | "testPlayShort"
  | "battleTest"
  | "battleTestShort"
  | "viewMenu";

// 2026-08-21 용어 정리 라운드: technical 쪽 값이 곧 RM 유래 용어였다 — 하위/상위는 下層/上層의
// 직역이다. **레이어 이름은 두 스타일을 하나로 통일**한다(감독 지시: 초보 용어를 전 모드
// 표준으로). 밀도 축(jargonStyle)은 남기되, 레이어처럼 "전문가라고 다르게 부를 이유가
// 없는" 항목은 같은 말을 쓴다.
// 2026-09-19: 맵 레이어 세 이름은 바닥 / 상위 / 이벤트. 예전 화면 이름 「덧그림」은 폐기.
// 「장식」은 타일 분류 이름(팔레트 필터 · tileMeta role "decoration")이라 레이어에 쓰지 않는다.
const UI_COPY: Record<UiCopyKey, Record<UiCopyStyle, string>> = {
  database: { plain: "자료집", technical: "데이터베이스" },
  // `databaseShort.plain` 은 2026-08-30 까지 `"자료"` 였다. 축약형인데 정본(`자료집`)의 축약으로
  // 읽히지 않고 **다른 낱말**로 보였고, 같은 헤더의 `자료 보관함`(소재 보관함으로 개칭)과 앞
  // 두 글자가 겹쳐 서로 다른 두 개념이 한 이름처럼 보였다. `자료집`은 4글자라 툴바에 들어간다.
  databaseShort: { plain: "자료집", technical: "DB" },
  tilesetMissing: { plain: "그림이 없습니다", technical: "타일 그림판이 없습니다" },
  // 레이어가 아니라 높이 붓이지만 레이어 전환 줄 맨 왼쪽에 함께 선다(2026-09-26).
  layerRelief: { plain: "높이", technical: "높이" },
  layerLower: { plain: "바닥", technical: "바닥" },
  layerUpper: { plain: "상위", technical: "상위" },
  layerEvent: { plain: "이벤트", technical: "이벤트" },
  onlineSave: { plain: "온라인 저장", technical: "온라인 저장" },
  // `resources.plain` 은 2026-08-26 까지 `"자료"` 였다 — `databaseShort.plain` 과 글자까지 같아서
  // 같은 메뉴에 라벨이 똑같은 항목이 두 개 뜨는 사고가 있었다(standard ⋯ 메뉴). 자료집(DB)과
  // 소재(그림·소리 파일)는 다른 것이므로 이름도 다르게 둔다. 클래식 툴바는 이미 "소재"를 썼다.
  resources: { plain: "소재", technical: "리소스" },
  // 보관함 표면의 정본. 도구 메뉴는 `자료 보관함` 이라는 제3의 이름을 쓰고 있었다 —
  // 툴바는 `소재`, uiCopy 는 `소재/리소스` 라서 한 개념에 세 이름이었다. 정본은 축약(`소재`)을
  // 포함해야 하므로 `${resources} 보관함` 형태로 파생한다.
  resourceLibrary: { plain: "소재 보관함", technical: "리소스 보관함" },
  // 화면에 실제로 나가는 이름은 언제나 `세계관` 이었는데 이 표만 `세계/월드` 를 들고 있었다 —
  // 아무도 참조하지 않는 죽은 값이어서 다음 사람이 이 표를 믿고 `세계` 를 쓰면 분열이 생긴다.
  world: { plain: "세계관", technical: "세계관" },
  // 음악·효과음 표면은 메뉴 `음악·효과음`, 툴바 라벨 `음악`, 툴바 title `음악/효과음`,
  // 모달 제목 `음악/효과음 테스트` 로 네 갈래였다. 구분자는 가운뎃점 하나로 통일한다.
  audio: { plain: "음악·효과음", technical: "음악·효과음" },
  audioShort: { plain: "음악", technical: "음악" },
  // 찾기 표면은 메뉴 `맵·이벤트 찾기`, 툴바 `찾기`/title `맵/이벤트 찾기`, 모달 제목 `검색`,
  // aria-label `맵/이벤트 검색` 으로 갈라져 `찾기`와 `검색`이 같은 화면에서 섞였다.
  mapEventSearch: { plain: "맵·이벤트 찾기", technical: "맵·이벤트 찾기" },
  mapEventSearchShort: { plain: "찾기", technical: "찾기" },
  // 테스트 실행은 메뉴 `시연 실행`, 톱바 버튼 `테스트`, 클래식 툴바 `실행` 세 이름이었다.
  testPlay: { plain: "테스트 실행", technical: "테스트 실행" },
  testPlayShort: { plain: "테스트", technical: "테스트" },
  battleTest: { plain: "랜덤 전투 테스트", technical: "랜덤 전투 테스트" },
  battleTestShort: { plain: "전투", technical: "전투" },
  // 톱바 ▤ 메뉴(패널·밀도·편집 모드)의 글자 라벨. 2026-09-03 까지는 글리프 「▤」 하나뿐이어서
  // 초보/표준/전문가 전환의 유일한 진입점이 장식처럼 보였고, 사용자가 "진입점이 없다"고 했다.
  // 「보기」는 배치·밀도·모드 같은 화면 설정을 담는 메뉴의 관용 이름이다.
  viewMenu: { plain: "보기", technical: "보기" },
};

export function uiLabel(key: UiCopyKey, style: UiCopyStyle = "plain"): string {
  return UI_COPY[key][style];
}

export function layerUiLabel(layer: "lower" | "upper" | "event", style: UiCopyStyle = "plain"): string {
  return uiLabel(layer === "event" ? "layerEvent" : layer === "upper" ? "layerUpper" : "layerLower", style);
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
  place_concept: "시설 짓기",
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
