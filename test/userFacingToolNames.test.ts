import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { resetEditorUiModeForTests } from "@/editor/editorUiMode";
import { createConversationLogHost } from "@/editor/panels/aiConversationLog";
import { sanitizeUserFacingToolId } from "@/editor/uiCopy";
import { installFakeDom } from "./fakeDom";

let restoreDom: (() => void) | null = null;

beforeEach(() => {
  restoreDom = installFakeDom();
  resetEditorUiModeForTests("standard");
});

afterEach(() => {
  restoreDom?.();
  restoreDom = null;
});

describe("sanitizeUserFacingToolId", () => {
  it.each([
    ["paint_road", "길 그리기"],
    ["build_house", "마을 짓기"],
    ["author_village", "마을 짓기"],
    ["make_villager", "사람 만들기"],
    ["run_lint", "검사"],
    ["plan_world", "세계 계획"],
  ])("maps %s to plain Korean", (raw, expected) => {
    expect(sanitizeUserFacingToolId(raw)).toBe(expected);
  });

  it("uses a generic label for unknown bare ids and preserves Korean sentences", () => {
    expect(sanitizeUserFacingToolId("unknown_tool_2")).toBe("작업");
    expect(sanitizeUserFacingToolId("길을 세 칸 그렸습니다.")).toBe("길을 세 칸 그렸습니다.");
  });
});

describe("tool command-row titles", () => {
  function appendTool(mode: "standard" | "expert"): HTMLElement {
    resetEditorUiModeForTests(mode);
    const log = document.createElement("div");
    const host = createConversationLogHost({
      log,
      removeStartScreen: () => undefined,
    });
    // 툴 행은 로그가 아니라 작업 띠로 간다 — 만들어진 행 자체를 본다.
    const entry = host.appendToolLine("paint_road", { ok: true, summary: "paint_road" });
    if (!entry) throw new Error("쓰기 툴 행이 만들어져야 한다");
    return entry;
  }

  it("hides raw ids in standard plain-language titles", () => {
    const text = appendTool("standard").textContent ?? "";
    expect(text).toContain("길 그리기");
    expect(text).not.toContain("paint_road");
  });

  it("keeps raw ids in expert titles", () => {
    expect(appendTool("expert").textContent).toContain("paint_road");
  });
});
