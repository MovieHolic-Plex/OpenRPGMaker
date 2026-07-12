// editor/selectionChipHint.ts
// 선택 도구를 처음 켰을 때 1회 — "영역 드래그 → ✨ AI 작업 칩" 발견 힌트.
// 칩(selectionActionChips)은 영역을 드래그해야만 나타나므로, 그 사실을 모르는
// 초보는 기능 자체를 발견할 수 없다. 도구 활성화 순간에 한 번만 알려준다.
import { editorState } from "@/editor/editorState";
import { toast } from "@/util/toast";

export const SELECTION_CHIP_HINT_KEY = "rpg-zzu:hint-selection-chips-v1";
export const SELECTION_CHIP_HINT_TEXT = "영역을 드래그하면 ✨ AI 작업 버튼이 나타나요 — 선택한 곳만 AI가 고쳐줍니다.";

let installed = false;
let lastTool: string | null = null;

function resolveStorage(storage?: Storage | null): Storage | null {
  if (storage !== undefined) return storage;
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null;
  }
}

function alreadySeen(storage: Storage | null): boolean {
  try {
    return storage?.getItem(SELECTION_CHIP_HINT_KEY) === "1";
  } catch {
    return true; // 저장 불가 환경에서는 반복 노출보다 침묵을 택한다.
  }
}

function markSeen(storage: Storage | null): void {
  try {
    storage?.setItem(SELECTION_CHIP_HINT_KEY, "1");
  } catch {
    /* private mode / quota */
  }
}

/** 에디터 부팅 시 1회 설치. 도구가 select로 "바뀌는" 순간에만 반응한다. */
export function installSelectionChipHint(storage?: Storage | null): void {
  if (installed) return;
  installed = true;
  lastTool = editorState.get().tool;
  editorState.subscribe(() => {
    const tool = editorState.get().tool;
    const changed = tool !== lastTool;
    lastTool = tool;
    if (!changed || tool !== "select") return;
    const store = resolveStorage(storage);
    if (alreadySeen(store)) return;
    markSeen(store);
    toast(SELECTION_CHIP_HINT_TEXT, "info");
  });
}

/** 테스트 헬퍼: 모듈 상태 초기화. */
export function resetSelectionChipHintForTests(): void {
  installed = false;
  lastTool = null;
}
