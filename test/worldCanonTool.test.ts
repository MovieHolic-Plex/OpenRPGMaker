import { describe, expect, it } from "vitest";
import { createBlankProject } from "@/project/defaults";
import { runTool, type ToolContext } from "@/editor/tools";

describe("set_world_canon", () => {
  it("stores the world backbone and preserves omitted fields on a later patch", () => {
    const ctx: ToolContext = { project: createBlankProject() };
    const first = runTool(ctx, "set_world_canon", {
      canon: {
        name: "아르카디아",
        premise: "왕국의 봉인이 무너지고 변방의 주인공이 움직인다.",
        era: "봉건 중세",
        tones: ["mythic", "grim"],
        laws: { power: { present: true, note: "혈통과 계약이 함께 작동한다" } },
      },
    });
    expect(first.ok, first.summary).toBe(true);
    const second = runTool(ctx, "set_world_canon", { canon: { techCeiling: "화약 이전" } });
    expect(second.ok, second.summary).toBe(true);
    expect(ctx.project.worldCanon).toMatchObject({ name: "아르카디아", era: "봉건 중세", techCeiling: "화약 이전" });
    expect(ctx.project.worldCanon?.laws?.power?.present).toBe(true);
  });
});
