import { directionForKey, isCancelKey, isConfirmKey } from "@/player/keyBindings";
import { STATUS_MENU_COMMAND_IDS, type StatusMenuRailId } from "@/player/playerStatusMenuModel";

export const TITLE_MENU_ITEM_COUNT = 3;

export type RuntimeMenuKey =
  | "ArrowLeft"
  | "ArrowRight"
  | "ArrowDown"
  | "ArrowUp"
  | "w"
  | "a"
  | "s"
  | "d"
  | "Enter"
  | " "
  | "z"
  | "e"
  | "x"
  | "Escape";

export type StatusMenuKeyboardMode = "function" | "main";

export type StatusMenuKeyboardState = {
  readonly selectedCommand: StatusMenuRailId;
  readonly mode: StatusMenuKeyboardMode;
  /** 레일이 실제로 그리는 항목들 — 접힌 그룹 열기 항목도 포함한다. */
  readonly commandIds?: readonly StatusMenuRailId[];
  /** 레일 열 수. 2 이상이면 ←→ 도 커서를 움직이고 ↑↓ 는 열 수만큼 뛴다(허브 타일). 기본 1. */
  readonly columns?: number;
};

export type StatusMenuKeyboardAction =
  | "activate"
  | "back-to-main"
  | "close"
  | "enter-function"
  | "none"
  | "select";

export type StatusMenuKeyboardResult = StatusMenuKeyboardState & {
  readonly action: StatusMenuKeyboardAction;
};

export function moveTitleSelection(
  selectedIndex: number,
  key: "ArrowDown" | "ArrowUp",
  visibleCount: number = TITLE_MENU_ITEM_COUNT,
): number {
  const count = Math.max(1, visibleCount | 0);
  const delta = key === "ArrowDown" ? 1 : -1;
  return wrapIndex(selectedIndex + delta, count);
}

export function reduceStatusMenuKeyboard(
  state: StatusMenuKeyboardState,
  key: RuntimeMenuKey
): StatusMenuKeyboardResult {
  const dir = directionForKey(key);
  const columns = Math.max(1, state.columns ?? 1);
  if (dir && (columns > 1 || dir === "up" || dir === "down")) {
    const ids = state.commandIds && state.commandIds.length > 0 ? state.commandIds : STATUS_MENU_COMMAND_IDS;
    const index = Math.max(0, ids.indexOf(state.selectedCommand));
    return {
      selectedCommand: ids[moveCursorIndex(index, ids.length, dir, { columns })] ?? "items",
      mode: state.mode,
      action: "select",
    };
  }
  // 판정은 정본(keyBindings)에 위임 — 대문자 Z/X 가 여기서만 죽던 결함(적대 리뷰 6).
  if (isConfirmKey(key)) {
    return {
      selectedCommand: state.selectedCommand,
      mode: state.mode === "main" ? "function" : state.mode,
      action: state.mode === "main" ? "enter-function" : "activate",
    };
  }
  if (isCancelKey(key)) {
    return state.mode === "function"
      ? { selectedCommand: state.selectedCommand, mode: "main", action: "back-to-main" }
      : { selectedCommand: state.selectedCommand, mode: "main", action: "close" };
  }
  return { selectedCommand: state.selectedCommand, mode: state.mode, action: "none" };
}

function wrapIndex(index: number, length: number): number {
  return ((index % length) + length) % length;
}

// ── 공용 커서 메뉴용 순수 계층 ──
// 키 계약은 keyBindings 정본이 소유한다. 여기서는 재수출만 한다(기존 import 경로 호환).
export { CANCEL_KEYS, CONFIRM_KEYS, isCancelKey, isConfirmKey } from "@/player/keyBindings";

export type CursorDirection = "up" | "down" | "left" | "right";

// 방향키 + WASD. 필드는 WASD 로 걷는데 메뉴에서는 방향키만 먹던 비대칭을 없앤다.
export function navDirection(key: string): CursorDirection | null {
  return directionForKey(key);
}

// 커서 이동 인덱스 계산. columns<=1 이면 1D 리스트(up/left=-1, down/right=+1, 관용적).
// columns>1 이면 격자(up/down=±columns, left/right=±1). wrap 기본 true.
export function moveCursorIndex(
  index: number,
  count: number,
  dir: CursorDirection,
  opts: { readonly columns?: number; readonly wrap?: boolean } = {}
): number {
  if (count <= 0) return 0;
  const wrap = opts.wrap ?? true;
  const columns = Math.max(1, opts.columns ?? 1);
  if (columns <= 1) {
    const delta = dir === "up" || dir === "left" ? -1 : 1;
    const next = index + delta;
    return wrap ? wrapIndex(next, count) : Math.max(0, Math.min(count - 1, next));
  }
  const delta = dir === "up" ? -columns : dir === "down" ? columns : dir === "left" ? -1 : 1;
  const next = index + delta;
  if (next < 0 || next >= count) return wrap ? wrapIndex(next, count) : index;
  return next;
}
