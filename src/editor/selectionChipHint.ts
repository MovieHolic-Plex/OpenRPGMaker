// editor/selectionChipHint.ts
// 선택 액션 바 발견 힌트 — 제스처별로 하나씩, 각 1회.
//
// 1) 선택 도구(V)를 처음 켠 순간 — 좌드래그로 영역을 잡는 경로.
// 2) 첫 우클릭 드래그가 성공한 직후 — 도구와 무관하게 캔버스 어디서나 되는 경로.
//
// 2번을 따로 두는 이유: 우클릭 드래그는 도구를 바꾸지 않으므로 1번 트리거에 걸리지 않고,
// 기본 UI 모드(beginner)는 선택 도구가 도구막대에 없어 1번이 아예 안 뜬다. 그래서 이
// 저장소에서 가장 강력한 진입점이 안내 없이 숨어 있었다(헬프 모달에도 항목이 없었다).
// 안내는 화면에 실제로 있는 라벨만 가리킨다.
import { editorState } from "@/editor/editorState";
import { toast } from "@/util/toast";

export const SELECTION_CHIP_HINT_KEY = "oprn:hint-selection-chips-v1";
export const SELECTION_CHIP_HINT_TEXT = "영역을 드래그하면 복사·붙여넣기·✨ AI 작업 버튼이 나타나요 — 선택한 곳을 자유롭게 다루세요.";

export const RIGHT_DRAG_REGION_HINT_KEY = "oprn:hint-right-drag-region-v1";
export const RIGHT_DRAG_REGION_HINT_TEXT = "영역을 잡았어요 — 「AI 작업」으로 이 구획을 통째로 만들거나, 복사·지우기로 직접 다룰 수 있어요.";

let installed = false;
let lastTool: string | null = null;
let rightDragHintStorage: Storage | null | undefined;

function resolveStorage(storage?: Storage | null): Storage | null {
  if (storage !== undefined) return storage;
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null;
  }
}

function alreadySeen(storage: Storage | null, key: string = SELECTION_CHIP_HINT_KEY): boolean {
  try {
    return storage?.getItem(key) === "1";
  } catch {
    return true; // 저장 불가 환경에서는 반복 노출보다 침묵을 택한다.
  }
}

function markSeen(storage: Storage | null, key: string = SELECTION_CHIP_HINT_KEY): void {
  try {
    storage?.setItem(key, "1");
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

/**
 * 우클릭 드래그로 영역이 잡힌 직후 EditScene 이 부른다. 배우기 가장 좋은 순간은
 * 제스처가 방금 통한 순간이지, 도구를 고른 순간이 아니다. 1회만 뜬다.
 */
export function notifyRightDragRegionSelected(): void {
  const store = resolveStorage(rightDragHintStorage);
  if (alreadySeen(store, RIGHT_DRAG_REGION_HINT_KEY)) return;
  markSeen(store, RIGHT_DRAG_REGION_HINT_KEY);
  toast(RIGHT_DRAG_REGION_HINT_TEXT, "info");
}

/** 테스트 주입: 우클릭 드래그 힌트가 볼 저장소. undefined 면 localStorage. */
export function setRightDragRegionHintStorage(storage?: Storage | null): void {
  rightDragHintStorage = storage;
}

/** 테스트 헬퍼: 모듈 상태 초기화. */
export function resetSelectionChipHintForTests(): void {
  installed = false;
  lastTool = null;
  rightDragHintStorage = undefined;
}
