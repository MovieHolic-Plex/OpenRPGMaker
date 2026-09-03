// editor/editorUiMode.ts
// - 데이터·이벤트 편집·AI 세션은 공유; 노출 밀도만 분기.
// - 용어 매핑: 모드명 beginner|standard|expert ↔ uiDensity DOM 값 beginner|expert|play|shared.
//   레거시 데이터 값 "basic"은 폐기됨(심볼/클래스명 BASIC_ZOOM_LEVELS, basic-rail-*, is-basic-chrome은 의도적으로 유지).

import { PRODUCT_BRAND } from "@/brand";

export const EDITOR_UI_MODE_STORAGE_KEY = "oprn:editor-ui-mode";
/** 표시 브랜드는 src/brand.ts 가 단일 원천 — 여기서 문자열을 다시 적지 않는다. */
export const EDITOR_PRODUCT_BRAND = PRODUCT_BRAND;
export type EditorUiMode = "beginner" | "standard" | "expert";
export const DEFAULT_EDITOR_UI_MODE: EditorUiMode = "standard";

// AI 어시스턴트 UI는 기본/전문가 동일 표면 — chrome 플래그로 분기하지 않는다.
// 팔레트 작업탭(칠하기/찾기/속성)도 플래그가 아니라 renderTilePalette의 basic 조기
// return(아이콘 레일)으로 갈라진다.
export type EditorChromeVisibility = {
  readonly mapTree: boolean;
  // 톱바 도구 자리 — true 면 세계관·음악·찾기가 인라인 아이콘 버튼(1클릭), false 면 「도구 ▾」 메뉴.
  // 2026-09-03 까지는 `classicToolbar`(전문가 전용 두 번째 툴바 행, 15개 중 14개가 메뉴 복제)였다.
  readonly toolStrip: boolean;
  readonly canvasChromeDense: boolean;
  readonly helpMenu: boolean;
  // 48px 아이콘 레일 좌패널(basicLeftRail) — 아니면 일반 팔레트/맵트리 컬럼.
  readonly paletteRail: boolean;
  // 좌패널 폭 상한(px). null이면 상한 없음(사용자 저장값 그대로).
  readonly leftPanelMaxWidthPx: number | null;
  // 레이어 라벨 용어 — plain: 바닥/장식, technical: 하위/상위.
  readonly layerTermStyle: "plain" | "technical";
  // 탑바 굵은 '테스트' 플레이 버튼 노출.
  readonly prominentTestPlay: boolean;
  // 첫 방문 코치마크 3점 노출.
  readonly coachMarks: boolean;
  // 표준 모드용 시작 웰컴 표면 노출.
  readonly standardWelcome: boolean;
  // 상태바 칸 밀도 — beginner: 레이어·맵·저장(+조건부 힌트/설계도/AI 오류).
  readonly statusbarDensity: "beginner" | "full";
  // 데이터베이스 내비게이션 노출 범위 — grouped: 카테고리 그룹, all: 전체 평면.
  // 예전 "common"(자주 쓰는 6개 + 「모든 자료」 접이식)은 없앴다 — 초보도 카테고리로 찾는다.
  readonly databaseNav: "grouped" | "all";
  // 이벤트 편집 초보용 크롬(단계별 안내) 노출.
  readonly eventBeginnerChrome: boolean;
  // 전반 용어 스타일 — plain: 자료집/바닥/장식, technical: 데이터베이스/하위/상위.
  readonly jargonStyle: "plain" | "technical";
};

const BEGINNER_CHROME: EditorChromeVisibility = {
  // 맵 전환은 아이콘 레일의 맵 플라이아웃(renderBasicLeftRail)에서 제공 — 좌측 맵트리 컬럼은 숨긴다.
  mapTree: false,
  toolStrip: false,
  canvasChromeDense: false,
  // 도움말(단축키 표)은 초보용 모드에서 더 필요하다 — 기본 모드에서도 노출.
  helpMenu: true,
  paletteRail: true,
  leftPanelMaxWidthPx: null,
  layerTermStyle: "plain",
  prominentTestPlay: true,
  coachMarks: true,
  standardWelcome: false,
  statusbarDensity: "beginner",
  databaseNav: "grouped",
  eventBeginnerChrome: true,
  jargonStyle: "plain",
};

const STANDARD_CHROME: EditorChromeVisibility = {
  mapTree: true,
  toolStrip: false,
  canvasChromeDense: true,
  helpMenu: true,
  paletteRail: false,
  leftPanelMaxWidthPx: 300,
  layerTermStyle: "technical",
  prominentTestPlay: false,
  coachMarks: false,
  standardWelcome: true,
  statusbarDensity: "full",
  databaseNav: "grouped",
  eventBeginnerChrome: true,
  jargonStyle: "plain",
};

const EXPERT_CHROME: EditorChromeVisibility = {
  mapTree: true,
  toolStrip: true,
  canvasChromeDense: true,
  helpMenu: true,
  paletteRail: false,
  leftPanelMaxWidthPx: 320,
  layerTermStyle: "technical",
  prominentTestPlay: false,
  coachMarks: false,
  standardWelcome: false,
  statusbarDensity: "full",
  // 전문가도 그룹 사이드바를 쓴다 — 24개 플랫 리스트보다 그룹 스캔이 빠르다.
  // "all"(플랫)은 renderDatabasePanel 의 폴백 분기로만 남는다.
  databaseNav: "grouped",
  eventBeginnerChrome: false,
  jargonStyle: "technical",
};

type Listener = () => void;

let currentMode: EditorUiMode = DEFAULT_EDITOR_UI_MODE;
let hydrated = false;
const listeners = new Set<Listener>();

export function parseEditorUiMode(raw: string | null | undefined): EditorUiMode {
  if (raw === "basic" || raw === "beginner") return "beginner";
  if (raw === "standard") return "standard";
  if (raw === "expert") return "expert";
  return DEFAULT_EDITOR_UI_MODE;
}

function resolveStorage(storage?: Storage | null): Storage | null {
  if (storage !== undefined) return storage;
  try {
    if (typeof localStorage === "undefined") return null;
    return localStorage;
  } catch {
    return null;
  }
}

/** Playwright / ?blankProject 등 — 모드를 안 박은 기존 e2e는 표준 바닥을 유지한다. */
function isLikelyAutomationBoot(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const search = window.location?.search ?? "";
    return /(?:^|[?&])(?:blankProject|freshProject|devProject)=/.test(search);
  } catch {
    return false;
  }
}

/** 저장값이 없는 실제 첫 방문은 초보. 자동화 URL은 표준을 유지한다. */
export function applyFirstVisitEditorUiMode(storage?: Storage | null): EditorUiMode {
  const store = resolveStorage(storage);
  if (!store) return DEFAULT_EDITOR_UI_MODE;
  try {
    if (store.getItem(EDITOR_UI_MODE_STORAGE_KEY) != null) return loadEditorUiMode(store);
    if (isLikelyAutomationBoot()) return DEFAULT_EDITOR_UI_MODE;
    saveEditorUiMode("beginner", store);
    return "beginner";
  } catch {
    return DEFAULT_EDITOR_UI_MODE;
  }
}

/** Pure load from a Storage-like object (tests inject MemoryStorage). */
export function loadEditorUiMode(storage?: Storage | null): EditorUiMode {
  const store = resolveStorage(storage);
  if (!store) return DEFAULT_EDITOR_UI_MODE;
  try {
    return parseEditorUiMode(store.getItem(EDITOR_UI_MODE_STORAGE_KEY));
  } catch {
    return DEFAULT_EDITOR_UI_MODE;
  }
}

export function saveEditorUiMode(mode: EditorUiMode, storage?: Storage | null): void {
  const store = resolveStorage(storage);
  if (!store) return;
  try {
    store.setItem(EDITOR_UI_MODE_STORAGE_KEY, mode);
  } catch {
    /* private mode / quota */
  }
}

export function chromeForMode(mode: EditorUiMode): EditorChromeVisibility {
  if (mode === "beginner") return BEGINNER_CHROME;
  if (mode === "expert") return EXPERT_CHROME;
  return STANDARD_CHROME;
}

export function getEditorUiMode(): EditorUiMode {
  ensureHydrated();
  return currentMode;
}

export function getEditorChrome(): EditorChromeVisibility {
  return chromeForMode(getEditorUiMode());
}

/** Apply body hooks used by CSS density gates. Safe when document is missing (unit tests). */
export function applyEditorUiModeClasses(mode: EditorUiMode = getEditorUiMode()): void {
  if (typeof document === "undefined" || !document.body) return;
  document.body.classList.remove("editor-ui-beginner", "editor-ui-standard", "editor-ui-expert");
  document.body.classList.add(`editor-ui-${mode}`);
  document.body.dataset.editorUiMode = mode;
}

export function setEditorUiMode(mode: EditorUiMode, storage?: Storage | null): void {
  ensureHydrated();
  const next = parseEditorUiMode(mode);
  currentMode = next;
  // Always persist explicit user/agent choice (even if already that mode) so reload restores it.
  saveEditorUiMode(next, storage);
  applyEditorUiModeClasses(next);
  for (const listener of listeners) listener();
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("oprn:editor-ui-mode", { detail: { mode: next } }));
  }
}

export function subscribeEditorUiMode(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Test helper: reset module state without touching real localStorage unless passed. */
export function resetEditorUiModeForTests(mode: EditorUiMode = DEFAULT_EDITOR_UI_MODE): void {
  currentMode = mode;
  hydrated = true;
  applyEditorUiModeClasses(mode);
}

function ensureHydrated(): void {
  if (hydrated) return;
  hydrated = true;
  currentMode = applyFirstVisitEditorUiMode();
  applyEditorUiModeClasses(currentMode);
}

// Eager hydrate in browser so first paint CSS classes match storage.
if (typeof document !== "undefined") {
  ensureHydrated();
}

// Headless/browser agent hook (tests + bridge) — not a product UI control.
if (typeof window !== "undefined") {
  window.__oprnEditorUiMode = {
    get: () => getEditorUiMode(),
    set: (mode: EditorUiMode) => setEditorUiMode(mode),
    chrome: () => chromeForMode(getEditorUiMode()),
    brand: EDITOR_PRODUCT_BRAND,
    storageKey: EDITOR_UI_MODE_STORAGE_KEY,
  };
}
