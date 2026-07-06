import { STATUS_MENU_COMMAND_IDS, type StatusMenuCommandId } from "@/player/playerStatusMenuModel";

export const TITLE_MENU_ITEM_COUNT = 3;

export type RuntimeMenuKey =
  | "ArrowDown"
  | "ArrowUp"
  | "Enter"
  | " "
  | "z"
  | "e"
  | "x"
  | "Escape";

export type StatusMenuKeyboardMode = "function" | "main";

export type StatusMenuKeyboardState = {
  readonly selectedCommand: StatusMenuCommandId;
  readonly mode: StatusMenuKeyboardMode;
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

export function moveTitleSelection(selectedIndex: number, key: "ArrowDown" | "ArrowUp"): number {
  const delta = key === "ArrowDown" ? 1 : -1;
  return wrapIndex(selectedIndex + delta, TITLE_MENU_ITEM_COUNT);
}

export function reduceStatusMenuKeyboard(
  state: StatusMenuKeyboardState,
  key: RuntimeMenuKey
): StatusMenuKeyboardResult {
  if (key === "ArrowDown" || key === "ArrowUp") {
    return {
      selectedCommand: nextStatusCommand(state.selectedCommand, key === "ArrowDown" ? 1 : -1),
      mode: state.mode,
      action: "select",
    };
  }
  if (key === "Enter" || key === " " || key === "e") {
    return {
      selectedCommand: state.selectedCommand,
      mode: state.mode === "main" ? "function" : state.mode,
      action: state.mode === "main" ? "enter-function" : "activate",
    };
  }
  if (key === "Escape") {
    return state.mode === "function"
      ? { selectedCommand: state.selectedCommand, mode: "main", action: "back-to-main" }
      : { selectedCommand: state.selectedCommand, mode: "main", action: "close" };
  }
  if (key === "x") {
    return state.mode === "function"
      ? { selectedCommand: state.selectedCommand, mode: "main", action: "back-to-main" }
      : { selectedCommand: state.selectedCommand, mode: "main", action: "close" };
  }
  return { selectedCommand: state.selectedCommand, mode: state.mode, action: "none" };
}

function nextStatusCommand(current: StatusMenuCommandId, delta: number): StatusMenuCommandId {
  const currentIndex = STATUS_MENU_COMMAND_IDS.indexOf(current);
  return STATUS_MENU_COMMAND_IDS[wrapIndex(currentIndex + delta, STATUS_MENU_COMMAND_IDS.length)] ?? "items";
}

function wrapIndex(index: number, length: number): number {
  return ((index % length) + length) % length;
}

// ── 공용 커서 메뉴용 순수 계층 (RM2003 키 관례 통일) ──
// 결정(confirm): Z / Enter / Space (+ 레거시 e). 취소(cancel): X / Esc.
export const CONFIRM_KEYS: ReadonlySet<string> = new Set(["z", "Z", "Enter", " ", "e"]);
export const CANCEL_KEYS: ReadonlySet<string> = new Set(["x", "X", "Escape"]);

export function isConfirmKey(key: string): boolean {
  return CONFIRM_KEYS.has(key);
}

export function isCancelKey(key: string): boolean {
  return CANCEL_KEYS.has(key);
}

export type CursorDirection = "up" | "down" | "left" | "right";

export function navDirection(key: string): CursorDirection | null {
  switch (key) {
    case "ArrowUp":
      return "up";
    case "ArrowDown":
      return "down";
    case "ArrowLeft":
      return "left";
    case "ArrowRight":
      return "right";
    default:
      return null;
  }
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
