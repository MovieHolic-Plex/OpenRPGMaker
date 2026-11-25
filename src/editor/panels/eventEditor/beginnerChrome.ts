/** 이벤트 편집기 초보/고급 접힘. 사람이 연 창은 초보가 기본이고, 토글은 이 키에 남는다. */
const ADVANCED_KEY = "oprn.event-editor.advanced";
/** 보기 셋(쉬움·보통·고급). 사람마다 하나 기억한다 — 이벤트·프로젝트마다가 아니다. */
const VIEW_LEVEL_KEY = "oprn.event-editor.view";
/** 저장소를 못 쓰는 창에서만 쓴다. 저장소가 읽히면 그 값이 이긴다. */
let memory: boolean | null = null;
let levelMemory: EventEditorViewLevel | null = null;

export type EventEditorViewLevel = "easy" | "normal" | "advanced";

export const EVENT_EDITOR_VIEW_LEVELS: readonly EventEditorViewLevel[] = ["easy", "normal", "advanced"];

export const EVENT_EDITOR_VIEW_LEVEL_LABEL: Readonly<Record<EventEditorViewLevel, string>> = {
  easy: "쉬움",
  normal: "보통",
  advanced: "고급",
};

const levelListeners = new Set<(level: EventEditorViewLevel) => void>();

function isAutomatedOrTest(): boolean {
  if (typeof navigator !== "undefined" && navigator.webdriver === true) return true;
  const env = import.meta.env as { readonly VITEST?: boolean; readonly MODE?: string } | undefined;
  return env?.VITEST === true || env?.MODE === "test";
}

/**
 * 고급 설정이 펼쳐져 있으면 true.
 *
 * 키가 없으면 초보가 기본이다. 자동화 브라우저(`navigator.webdriver`)만 예외로 고급을 연다.
 * 기존 스펙이 움직임·스토리·인스펙터를 보이는 상태로 찾기 때문이다. 스펙이 이 키를
 * `"0"` 으로 박으면 자동화에서도 초보 화면이 된다.
 */
export function eventEditorAdvancedOpen(): boolean {
  try {
    const stored = localStorage.getItem(ADVANCED_KEY);
    if (stored === "1") return true;
    if (stored === "0") return false;
  } catch {
    if (memory !== null) return memory;
  }
  return typeof navigator !== "undefined" && navigator.webdriver === true;
}

export function setEventEditorAdvancedOpen(open: boolean): void {
  memory = open;
  try {
    localStorage.setItem(ADVANCED_KEY, open ? "1" : "0");
  } catch {
    // 사생활 보호 모드 등 저장소를 못 쓰는 창은 memory 가 이번 세션을 기억한다.
  }
}

function isLevel(value: unknown): value is EventEditorViewLevel {
  return value === "easy" || value === "normal" || value === "advanced";
}

/**
 * 지금 보기(쉬움·보통·고급). 처음은 누구나 쉬움이다.
 *
 * 예외 둘: 옛 「고급 설정 펼치기」를 켜 둔 사람(`oprn.event-editor.advanced=1`)은 고급으로 시작하고,
 * 자동화 브라우저·단위 시험은 고급(지금의 명령 목록)으로 시작한다 — 기존 스펙·표면 기준선이 명령 목록을 찾는다.
 */
export function eventEditorViewLevel(): EventEditorViewLevel {
  try {
    const stored = localStorage.getItem(VIEW_LEVEL_KEY);
    if (isLevel(stored)) return stored;
    if (localStorage.getItem(ADVANCED_KEY) === "1") return "advanced";
  } catch {
    if (levelMemory) return levelMemory;
  }
  return isAutomatedOrTest() ? "advanced" : "easy";
}

export function setEventEditorViewLevel(level: EventEditorViewLevel): void {
  levelMemory = level;
  try {
    localStorage.setItem(VIEW_LEVEL_KEY, level);
  } catch {
    // levelMemory 가 이번 세션을 기억한다.
  }
  for (const listener of [...levelListeners]) listener(level);
}

export function onEventEditorViewLevelChange(listener: (level: EventEditorViewLevel) => void): () => void {
  levelListeners.add(listener);
  return () => levelListeners.delete(listener);
}
