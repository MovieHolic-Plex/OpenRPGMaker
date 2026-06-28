import { describe, expect, it } from "vitest";
import {
  moveTitleSelection,
  reduceStatusMenuKeyboard,
  type StatusMenuKeyboardState,
} from "@/player/runtimeKeyboardMenu";

describe("runtime keyboard menus", () => {
  it("moves title selection with wrapping arrow keys", () => {
    expect(moveTitleSelection(0, "ArrowDown")).toBe(1);
    expect(moveTitleSelection(0, "ArrowUp")).toBe(2);
    expect(moveTitleSelection(2, "ArrowDown")).toBe(0);
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
