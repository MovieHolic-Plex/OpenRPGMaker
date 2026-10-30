// set_project_settings 가 fieldHud.font 를 버리던 결함(2026-10-30): 스키마에 칸이 없고 처리기가 읽지 않았다.
import { describe, expect, it } from "vitest";
import { activeTools, runTool } from "@/editor/tools";
import { createBlankProject } from "@/project/defaults";
import { HUD_FONTS } from "@/project/fieldHud";

describe("set_project_settings fieldHud.font", () => {
  it("스키마가 빈 문자열 없는 글꼴 enum 을 싣는다", () => {
    const tool = activeTools().find((entry) => entry.name === "set_project_settings")!;
    const font = (tool.parameters as { properties: { fieldHud: { properties: { font: { enum: string[] } } } } }).properties.fieldHud.properties.font;
    expect(font.enum).toEqual(Object.keys(HUD_FONTS));
    expect(font.enum).not.toContain("");
  });

  it("고른 글꼴을 저장하고, 모르는 글꼴은 거절한다", () => {
    const ctx = { project: createBlankProject() };
    expect(runTool(ctx, "set_project_settings", { fieldHud: { font: "round" } }).ok).toBe(true);
    expect(ctx.project.system.fieldHud?.font).toBe("round");
    expect(runTool(ctx, "set_project_settings", { fieldHud: { font: "comic" } }).ok).toBe(false);
    expect(ctx.project.system.fieldHud?.font).toBe("round");
  });
});
