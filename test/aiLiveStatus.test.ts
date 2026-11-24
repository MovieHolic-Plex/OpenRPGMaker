// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";
import { createAiLiveStatus, isQuietTool, liveStatusHeadline, plannedStepsFromTodoArgs } from "@/editor/panels/aiLiveStatus";
import type { Project } from "@/project/types";

describe("liveStatusHeadline", () => {
  it("names the map, the action and the step count when a plan exists", () => {
    expect(liveStatusHeadline({ action: "집을 만드는 중", mapName: "숲속 마을", done: 3, planned: 9 })).toBe("숲속 마을에서 집을 만드는 중 · 4/9 단계");
  });

  it("does not invent a denominator without a plan", () => {
    expect(liveStatusHeadline({ action: "길을 그리는 중", done: 2, planned: 0 })).toBe("길을 그리는 중 · 2단계 끝");
    expect(liveStatusHeadline({ action: "요청을 읽고 있어요", done: 0, planned: 0 })).toBe("요청을 읽고 있어요");
  });

  it("never shows a step number past the total", () => {
    expect(liveStatusHeadline({ action: "다듬는 중", done: 5, planned: 3 })).toBe("다듬는 중 · 5/5 단계");
  });
});

describe("plannedStepsFromTodoArgs", () => {
  it("reads the v2 todo init list across phases", () => {
    expect(plannedStepsFromTodoArgs({ op: "init", list: [
      { phase: "땅", items: [{ content: "숲 바닥 깔기" }, "길 내기"] },
      { phase: "집", items: [{ content: "집 3채" }] },
    ] })).toEqual({ op: "init", items: ["숲 바닥 깔기", "길 내기", "집 3채"] });
  });

  it("reads append and ignores other operations", () => {
    expect(plannedStepsFromTodoArgs({ op: "append", phase: "마무리", items: [{ content: "NPC 두기" }] })).toEqual({ op: "append", items: ["NPC 두기"] });
    expect(plannedStepsFromTodoArgs({ op: "done", task: "t1" })).toBeNull();
  });
});

describe("createAiLiveStatus finish", () => {
  const base = { maps: {} } as unknown as Project;

  it("hides the line when a turn ends without any step (connection failure, refused start)", () => {
    const status = createAiLiveStatus({ baseProject: base });
    expect(status.root.hidden).toBe(false);
    status.finish();
    expect(status.root.hidden).toBe(true);
  });

  it("keeps the finished summary when the turn did work", () => {
    const status = createAiLiveStatus({ baseProject: base });
    status.event({ type: "tool_start", id: "t1", name: "build_house", args: {} });
    status.event({ type: "tool_end", id: "t1", name: "build_house", ok: true, summary: "" });
    status.finish();
    expect(status.root.hidden).toBe(false);
    expect(status.root.textContent).toContain("1단계를 마쳤어요");
  });

  it("between tools shows the last finished step, never the stale opening line (qa1124 «요청을 읽고 있어요 · 6/6»)", () => {
    const status = createAiLiveStatus({ baseProject: base });
    status.status("요청을 읽고 있어요");
    status.event({ type: "tool_start", id: "t1", name: "make_place", args: {} });
    status.event({ type: "tool_end", id: "t1", name: "make_place", ok: true, summary: "" });
    const line = () => status.root.querySelector("[data-testid=ai-live-status-line]")!.textContent!;
    expect(line()).not.toContain("요청을 읽고 있어요");
    expect(line()).toContain("장소 짓기 끝");
    status.event({ type: "execution_status", name: "v2.blueprint.auto_path", ok: true, summary: "청사진 경로 자동 짓기 — 길 3개" });
    expect(line()).toContain("청사진 경로 자동 짓기");
    status.event({ type: "execution_status", name: "turn.diag", ok: true, summary: "stop=toolUse blocks=text(0)" });
    expect(line()).not.toContain("stop=");
  });
});

describe("isQuietTool", () => {
  it("keeps reads out of the step list and builds in it", () => {
    expect(isQuietTool("read_tileset_reference")).toBe(true);
    expect(isQuietTool("todo")).toBe(true);
    expect(isQuietTool("build_house")).toBe(false);
  });
});
