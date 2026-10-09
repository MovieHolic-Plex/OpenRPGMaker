// 짧은 능력치 곡선 입력 — 99칸 미만 배열이 말없이 기본 곡선(Lv1 HP 514)으로 바뀌던 것(2026-09-24 도그푸딩).
import { describe, expect, it } from "vitest";
import { runTool } from "@/editor/tools/toolRunner";
import { createBlankProject } from "@/project/defaults";
import { actorBattlers } from "@/battle/battleBattlers";

describe("upsert_actor 짧은 parameterCurves", () => {
  it("[Lv1, Lv99] 두 끝값을 곡선으로 채워 전투 능력치에 반영한다", () => {
    const ctx = { project: createBlankProject() };
    const result = runTool(ctx, "upsert_actor", {
      actor: { id: "actor_hero", parameterCurves: { maxHp: [160, 3200], maxMp: [12, 240], defense: [30, 300] } },
    }, { dryRun: false });
    expect(result.ok, result.summary).toBe(true);
    const actor = ctx.project.database.actors.find((entry) => entry.id === "actor_hero")!;
    expect(actor.parameterCurves.maxHp).toHaveLength(99);
    expect(actor.parameterCurves.maxHp[0]).toBe(160);
    expect(actor.parameterCurves.maxHp[98]).toBe(3200);
    expect(JSON.stringify(result.diff?.warnings)).toContain("parameterCurves 짧은 배열");
    const [hero] = actorBattlers(ctx.project, { partyActorIds: ["actor_hero"], levels: { actor_hero: 1 } });
    expect(hero!.maxHp).toBe(160);
    expect(hero!.maxMp).toBe(12);
  });

  it("[Lv1] 하나만 주면 기본 비율로 자라고, 레벨 1..n 배열은 마지막 증가폭으로 이어 간다", () => {
    const ctx = { project: createBlankProject() };
    expect(runTool(ctx, "upsert_actor", { actor: { id: "actor_hero", parameterCurves: { maxHp: [100], agility: [20, 22, 25] } } }, { dryRun: false }).ok).toBe(true);
    const curves = ctx.project.database.actors.find((entry) => entry.id === "actor_hero")!.parameterCurves;
    expect(curves.maxHp[0]).toBe(100);
    expect(curves.maxHp[98]).toBe(1000);
    expect(curves.agility.slice(0, 5)).toEqual([20, 22, 25, 28, 31]);
  });

  it("99칸 배열은 그대로 두고, 직업 곡선을 고치면 배우 곡선이 정본이라고 알린다", () => {
    const ctx = { project: createBlankProject() };
    const full = Array.from({ length: 99 }, (_, index) => 50 + index);
    expect(runTool(ctx, "upsert_actor", { actor: { id: "actor_hero", parameterCurves: { maxHp: full } } }, { dryRun: false }).ok).toBe(true);
    expect(ctx.project.database.actors.find((entry) => entry.id === "actor_hero")!.parameterCurves.maxHp).toEqual(full);
    const klass = ctx.project.database.actors.find((entry) => entry.id === "actor_hero")!.classId;
    const result = runTool(ctx, "upsert_class", { class: { id: klass, parameterCurves: { maxHp: [80, 1600] } } }, { dryRun: false });
    expect(result.ok, result.summary).toBe(true);
    expect(JSON.stringify(result.diff?.warnings)).toContain("배우 parameterCurves 가 정합니다");
  });
});
