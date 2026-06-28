import { STATUS_MENU_COMMAND_IDS, type StatusMenuCommandId } from "@/player/playerStatusMenuModel";

export const TITLE_MENU_ITEM_COUNT = 3;

export type RuntimeMenuKey =
  | "ArrowDown"
  | "ArrowUp"
  | "Enter"
  | " "
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
