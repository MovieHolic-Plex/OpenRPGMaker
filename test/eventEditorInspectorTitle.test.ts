/** @vitest-environment happy-dom */
import { describe, expect, it } from "vitest";
import { inspectorTitle } from "@/editor/panels/eventEditor/inspectorChoicesTitle";
import { commandSummary } from "@/editor/panels/eventEditor/commandSummary";
import type { Command } from "@/project/types";

const choicesCmd: Command = {
  kind: "choices",
  prompt: "두 길목을 정리해 줄래?",
  options: [
    { text: "맡는다", branch: [] },
    { text: "나중에", branch: [] },
  ],
  cancelBehavior: "choice2",
};

describe("inspectorTitle", () => {
  it("uses the trimmed prompt as the compact choices title (no options, no cancel)", () => {
    const title = inspectorTitle(choicesCmd);
    expect(title).toBe("두 길목을 정리해 줄래?");
    expect(title).not.toContain("1.맡는다");
    expect(title).not.toContain("나중에");
    expect(title).not.toContain("취소");
  });

  it("falls back to `선택지 N개` when the prompt is empty or whitespace", () => {
    const empty: Command = { ...choicesCmd, prompt: "" };
    const blank: Command = { ...choicesCmd, prompt: "   \n  " };
    const missing: Command = { kind: "choices", options: choicesCmd.options };
    expect(inspectorTitle(empty)).toBe("선택지 2개");
    expect(inspectorTitle(blank)).toBe("선택지 2개");
    expect(inspectorTitle(missing)).toBe("선택지 2개");
  });

  it("collapses multiline prompts to one line", () => {
    const multiline: Command = { ...choicesCmd, prompt: "첫째 줄\n\n  둘째   줄" };
    const title = inspectorTitle(multiline);
    expect(title).toBe("첫째 줄 둘째 줄");
    expect(title).not.toContain("\n");
  });

  it("ellipsizes prompts longer than 80 chars", () => {
    const long: Command = { ...choicesCmd, prompt: "가".repeat(100) };
    const title = inspectorTitle(long);
    expect(title.length).toBeLessThanOrEqual(80);
    expect(title.endsWith("…")).toBe(true);
    expect(title).not.toContain("맡는다");
  });

  it("keeps commandSummary output for non-choices kinds", () => {
    const waitCmd: Command = { kind: "wait", ms: 1500 };
    expect(inspectorTitle(waitCmd)).toBe(commandSummary(waitCmd));
    expect(inspectorTitle(waitCmd)).toContain("대기");
  });

  it("leaves the list-row commandSummary contract untouched", () => {
    const summary = commandSummary(choicesCmd);
    expect(summary).toContain("선택지 표시");
    expect(summary).toContain("맡는다");
    expect(summary).toContain("나중에");
  });
});
