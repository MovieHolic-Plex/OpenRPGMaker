// 저장 금지 맵의 저장 메뉴 이벤트 — 2026-09-24 꿈 세계 도그푸딩: 일기장이 있는 방까지 저장 금지라 저장할 곳이 없었다.
import { describe, expect, it } from "vitest";
import { runTool, type ToolContext } from "@/editor/tools";
import { createBlankProject } from "@/project/defaults";

const diary = { id: "ev_diary", name: "일기장", x: 3, y: 3, trigger: { kind: "action" }, pages: [{ conditions: [], graphic: { transparent: true }, commands: [{ kind: "openSaveMenu" }] }] };

describe("저장 금지 + 저장 메뉴", () => {
  it("저장 금지 맵에 저장 메뉴 이벤트를 두면 경고한다", () => {
    const ctx: ToolContext = { project: createBlankProject() };
    const mapId = ctx.project.startMapId;
    expect(runTool(ctx, "set_map_properties", { mapId, flags: { disableSave: true } }).ok).toBe(true);
    const result = runTool(ctx, "upsert_event", { mapId, event: diary });
    expect(result.ok, result.summary).toBe(true);
    expect((result.diff?.warnings ?? []).join(" ")).toContain("저장 금지 맵");
  });

  it("저장 메뉴 이벤트가 있는 맵에 저장 금지를 켜면 경고한다", () => {
    const ctx: ToolContext = { project: createBlankProject() };
    const mapId = ctx.project.startMapId;
    expect(runTool(ctx, "upsert_event", { mapId, event: diary }).ok).toBe(true);
    const result = runTool(ctx, "set_map_properties", { mapId, flags: { disableSave: true } });
    expect(result.ok, result.summary).toBe(true);
    expect(JSON.stringify(result.diff?.warnings ?? result)).toContain("저장할 수 없게 됩니다");
  });
});

import { buildPiAgentSystemPrompt } from "@/ai/piAgent/systemPrompt";

describe("장르 기믹 안내(꿈 세계)", () => {
  it("기획에 반복 맵·외형 변화가 있을 때만 도구 경로를 한 줄씩 붙인다", () => {
    const project = createBlankProject();
    const plain = buildPiAgentSystemPrompt(project, []).join("\n");
    expect(plain).not.toContain("loop:");
    (project as { gameDesignBrief?: unknown }).gameDesignBrief = { version: 1, presetId: "story-cutscene", summary: "가장자리가 반대편으로 이어지는 숲, 효과를 얻으면 외형이 바뀐다", answers: {} };
    const dream = buildPiAgentSystemPrompt(project, []).join("\n");
    expect(dream).toContain("set_map_properties loop");
    expect(dream).toContain("m2-024-change-actor-graphic");
    expect(dream).toContain("place_props");
    (project as { gameDesignBrief?: unknown }).gameDesignBrief = { version: 1, presetId: "story-cutscene", summary: "볼을 꼬집어 깨어난다", answers: {} };
    expect(buildPiAgentSystemPrompt(project, []).join("\n")).toContain("type:\"switch\"");
  });
});
