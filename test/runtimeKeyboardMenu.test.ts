import { describe, expect, it } from "vitest";
import {
  isCancelKey,
  isConfirmKey,
  moveCursorIndex,
  moveTitleSelection,
  navDirection,
  reduceStatusMenuKeyboard,
  type StatusMenuKeyboardState,
} from "@/player/runtimeKeyboardMenu";

describe("runtime keyboard menus", () => {
  it("moves title selection with wrapping arrow keys for count 1/2/3", () => {
    // count 3 (default)
    expect(moveTitleSelection(0, "ArrowDown")).toBe(1);
    expect(moveTitleSelection(0, "ArrowUp")).toBe(2);
    expect(moveTitleSelection(2, "ArrowDown")).toBe(0);
    // count 2 (e.g. continue hidden): New ↔ Quit
    expect(moveTitleSelection(0, "ArrowDown", 2)).toBe(1);
    expect(moveTitleSelection(1, "ArrowDown", 2)).toBe(0);
    expect(moveTitleSelection(0, "ArrowUp", 2)).toBe(1);
    // count 1 (only newGame): sticky 0
    expect(moveTitleSelection(0, "ArrowDown", 1)).toBe(0);
    expect(moveTitleSelection(0, "ArrowUp", 1)).toBe(0);
    // invalid count coerces to ≥1
    expect(moveTitleSelection(0, "ArrowDown", 0)).toBe(0);
  });

  it("moves X-menu command selection and enters/cancels function mode", () => {
    let state: StatusMenuKeyboardState = { selectedCommand: "items", mode: "main" };

    state = reduceStatusMenuKeyboard(state, "ArrowDown");
    expect(state).toEqual({ selectedCommand: "skills", mode: "main", action: "select" });

    state = reduceStatusMenuKeyboard(state, "ArrowDown");
    expect(state).toEqual({ selectedCommand: "equipment", mode: "main", action: "select" });

    state = reduceStatusMenuKeyboard(state, "ArrowUp");
    expect(state).toEqual({ selectedCommand: "skills", mode: "main", action: "select" });

    state = reduceStatusMenuKeyboard(state, "Enter");
    expect(state).toEqual({ selectedCommand: "skills", mode: "function", action: "enter-function" });

    state = reduceStatusMenuKeyboard(state, "Escape");
    expect(state).toEqual({ selectedCommand: "skills", mode: "main", action: "back-to-main" });

    expect(reduceStatusMenuKeyboard(state, "z")).toEqual({
      selectedCommand: "skills",
      mode: "function",
      action: "enter-function",
    });
  });

  it("backs out of X-menu function mode with the cancel key before closing", () => {
    const state: StatusMenuKeyboardState = { selectedCommand: "skills", mode: "function" };

    expect(reduceStatusMenuKeyboard(state, "x")).toEqual({
      selectedCommand: "skills",
      mode: "main",
      action: "back-to-main",
    });
  });
});

describe("status menu grid cursor (hub skin)", () => {
  it("columns>1 이면 ←→ 도 격자를 움직이고 ↑↓ 는 열 수만큼 뛴다(토러스 래핑)", () => {
    const ids = ["items", "skills", "equipment", "party-menu", "record-menu", "system-menu"] as const;
    const base = { mode: "main" as const, commandIds: ids, columns: 3 };
    expect(reduceStatusMenuKeyboard({ ...base, selectedCommand: "items" }, "ArrowRight").selectedCommand).toBe("skills");
    expect(reduceStatusMenuKeyboard({ ...base, selectedCommand: "items" }, "ArrowDown").selectedCommand).toBe("party-menu");
    expect(reduceStatusMenuKeyboard({ ...base, selectedCommand: "items" }, "ArrowLeft").selectedCommand).toBe("system-menu");
    expect(reduceStatusMenuKeyboard({ ...base, selectedCommand: "party-menu" }, "ArrowDown").selectedCommand).toBe("items");
    expect(reduceStatusMenuKeyboard({ ...base, selectedCommand: "items" }, "ArrowRight").action).toBe("select");
    // 1열은 기존과 같다 — ←→ 는 none
    expect(reduceStatusMenuKeyboard({ selectedCommand: "items", mode: "main", commandIds: ids }, "ArrowRight").action).toBe("none");
  });
});

describe("runtime cursor pure helpers", () => {
  it("classifies confirm/cancel keys (RM2003 Z/X + Enter/Esc/Space)", () => {
    for (const key of ["z", "Z", "Enter", " ", "e"]) expect(isConfirmKey(key)).toBe(true);
    for (const key of ["x", "X", "Escape"]) expect(isCancelKey(key)).toBe(true);
    expect(isConfirmKey("x")).toBe(false);
    expect(isCancelKey("z")).toBe(false);
    expect(isConfirmKey("a")).toBe(false);
  });

  it("maps arrow keys to directions", () => {
    expect(navDirection("ArrowUp")).toBe("up");
    expect(navDirection("ArrowDown")).toBe("down");
    expect(navDirection("ArrowLeft")).toBe("left");
    expect(navDirection("ArrowRight")).toBe("right");
    expect(navDirection("z")).toBeNull();
  });

  it("moves a 1D cursor with wrapping (↑↓←→ all ±1)", () => {
    expect(moveCursorIndex(0, 3, "down")).toBe(1);
    expect(moveCursorIndex(0, 3, "right")).toBe(1);
    expect(moveCursorIndex(0, 3, "up")).toBe(2);
    expect(moveCursorIndex(2, 3, "down")).toBe(0);
  });

  it("clamps a 1D cursor when wrap is disabled", () => {
    expect(moveCursorIndex(0, 3, "up", { wrap: false })).toBe(0);
    expect(moveCursorIndex(2, 3, "down", { wrap: false })).toBe(2);
  });

  it("moves a grid cursor by columns", () => {
    expect(moveCursorIndex(0, 4, "down", { columns: 2 })).toBe(2);
    expect(moveCursorIndex(0, 4, "right", { columns: 2 })).toBe(1);
    expect(moveCursorIndex(0, 2, "left", { columns: 2 })).toBe(1);
  });

  it("returns 0 for empty collections", () => {
    expect(moveCursorIndex(0, 0, "down")).toBe(0);
  });
});
