// editor/editorUiMode.ts
// 에디터 셸 밀도: 기본(basic) / 전문가(expert).
// - 기본값은 basic. localStorage에 저장·복원.
// - 데이터·이벤트 편집·AI 세션은 공유; 노출 밀도만 분기.

export const EDITOR_UI_MODE_STORAGE_KEY = "rpg-zzu:editor-ui-mode";
export const EDITOR_PRODUCT_BRAND = "AI RPG MAKER";
export type EditorUiMode = "basic" | "expert";
export const DEFAULT_EDITOR_UI_MODE: EditorUiMode = "basic";

// AI 어시스턴트 UI는 기본/전문가 동일 표면 — chrome 플래그로 분기하지 않는다.
// 팔레트 작업탭(칠하기/찾기/속성)도 플래그가 아니라 renderTilePalette의 basic 조기
// return(아이콘 레일)으로 갈라진다.
export type EditorChromeVisibility = {
  readonly mapTree: boolean;
  readonly classicToolbar: boolean;
  readonly canvasChromeDense: boolean;
  readonly helpMenu: boolean;
  readonly gameMenuLabel: string;
};

const BASIC_CHROME: EditorChromeVisibility = {
  // 맵 전환은 아이콘 레일의 맵 플라이아웃(renderBasicLeftRail)에서 제공 — 좌측 맵트리 컬럼은 숨긴다.
  mapTree: false,
  classicToolbar: false,
  canvasChromeDense: false,
  helpMenu: false,
  gameMenuLabel: "실행",
};

const EXPERT_CHROME: EditorChromeVisibility = {
  mapTree: true,
  classicToolbar: true,
  canvasChromeDense: true,
  helpMenu: true,
  gameMenuLabel: "게임",
};

type Listener = () => void;

let currentMode: EditorUiMode = DEFAULT_EDITOR_UI_MODE;
let hydrated = false;
const listeners = new Set<Listener>();

export function parseEditorUiMode(raw: string | null | undefined): EditorUiMode {
  if (raw === "expert") return "expert";
  // empty, invalid, "basic" → basic (first visit default)
  return "basic";
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
  return mode === "expert" ? EXPERT_CHROME : BASIC_CHROME;
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
  // Prefer add/remove over toggle — FakeElement classList in unit tests has no toggle().
  if (mode === "basic") {
    document.body.classList.add("editor-ui-basic");
    document.body.classList.remove("editor-ui-expert");
  } else {
    document.body.classList.add("editor-ui-expert");
    document.body.classList.remove("editor-ui-basic");
  }
  document.body.dataset.editorUiMode = mode;
}

export function setEditorUiMode(mode: EditorUiMode, storage?: Storage | null): void {
  ensureHydrated();
  const next = parseEditorUiMode(mode);
  currentMode = next;
  // Always persist explicit user/agent choice (even if already that mode) so reload restores it.
  saveEditorUiMode(next, storage);
  applyEditorUiModeClasses(next);
  // Always notify: same-mode set still refreshes basic/expert chrome (HMR / re-apply).
  for (const listener of listeners) listener();
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("rpgzzu:editor-ui-mode", { detail: { mode: next } }));
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
  currentMode = loadEditorUiMode();
  applyEditorUiModeClasses(currentMode);
}

// Eager hydrate in browser so first paint CSS classes match storage.
if (typeof document !== "undefined") {
  ensureHydrated();
}

// Headless/browser agent hook (tests + bridge) — not a product UI control.
if (typeof window !== "undefined") {
  window.__rpgzzuEditorUiMode = {
    get: () => getEditorUiMode(),
    set: (mode: EditorUiMode) => setEditorUiMode(mode),
    chrome: () => chromeForMode(getEditorUiMode()),
    brand: EDITOR_PRODUCT_BRAND,
    storageKey: EDITOR_UI_MODE_STORAGE_KEY,
  };
}
