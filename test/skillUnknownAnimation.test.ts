// 없는 전투 애니메이션 id 는 비우고 경고 — 커밋 거부·연쇄 거부를 하지 않는다(2026-09-24 JRPG 도그푸딩).
import { describe, expect, it } from "vitest";
import { runTool } from "@/editor/tools/toolRunner";
import { createBlankProject } from "@/project/defaults";

describe("upsert_skill/upsert_class 의 없는 animationId", () => {
  it("스킬을 저장하고 animationId 를 비우며 후보를 알린다", () => {
    const ctx = { project: createBlankProject() };
    const result = runTool(ctx, "upsert_skill", { skill: { id: "skill_heavy_strike", name: "강타", power: 30, animationId: "anim_slash" } }, { dryRun: false });
    expect(result.ok, result.summary).toBe(true);
    expect(ctx.project.database.skills.find((skill) => skill.id === "skill_heavy_strike")?.animationId).toBeUndefined();
    expect(JSON.stringify(result.diff?.warnings)).toContain("anim_slash");
    const klass = ctx.project.database.classes[0]!;
    const cls = runTool(ctx, "upsert_class", { class: { id: klass.id, animationId: "anim_nope", learnedSkills: [{ level: 1, skillId: "skill_heavy_strike" }] } }, { dryRun: false });
    expect(cls.ok, cls.summary).toBe(true);
  });
});
