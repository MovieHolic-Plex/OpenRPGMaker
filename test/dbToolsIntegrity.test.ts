import { describe, expect, it } from "vitest";
import { createBlankProject, createSampleAdventureProject } from "@/project/defaults/defaultProject";
import { runTool } from "@/editor/tools/toolRunner";
import type { ToolContext } from "@/editor/tools/types";

describe("DB write tools", () => {
  it("upsert_item 부분 수정은 기존 필드를 보존하고 최종 레코드 전체를 반환한다", () => {
    const ctx: ToolContext = { project: createSampleAdventureProject() };
    const before = structuredClone(ctx.project.database.items.find((item) => item.id === "item_potion"));
    expect(before).toBeDefined();

    const result = runTool(ctx, "upsert_item", { item: { id: "item_potion", price: 120 } }, { dryRun: false });

    expect(result.ok, JSON.stringify(result.issues)).toBe(true);
    const after = ctx.project.database.items.find((item) => item.id === "item_potion");
    expect(after?.price).toBe(120);
    expect(after?.name).toBe(before?.name);
    expect(after?.description).toBe(before?.description);
    expect(after?.skillId).toBe(before?.skillId);
    expect(after?.hpRecovery).toEqual(before?.hpRecovery);
    expect(result.data).toEqual(after);
  });

  it("upsert_equipment은 중첩 statBonuses를 반영하고 알 수 없는 필드를 거부한다", () => {
    const ctx: ToolContext = { project: createBlankProject() };
    const created = runTool(ctx, "upsert_equipment", {
      equipment: { id: "equip_test_sword", name: "시험검", slot: "weapon", statBonuses: { attack: 12 } },
    }, { dryRun: false });
    expect(created.ok, JSON.stringify(created.issues)).toBe(true);
    expect(ctx.project.database.equipment.find((entry) => entry.id === "equip_test_sword")?.statBonuses.attack).toBe(12);

    const rejected = runTool(ctx, "upsert_equipment", {
      equipment: { id: "equip_test_sword", statBonuses: { attackPower: 99 } },
    }, { dryRun: false });
    expect(rejected.ok).toBe(false);
    expect(rejected.issues?.[0]?.code).toBe("unknown-db-field");
    expect(rejected.issues?.[0]?.message).toContain("허용 필드");
  });

  it("upsert_actor 신규 기본 maxLevel은 99다", () => {
    const ctx: ToolContext = { project: createBlankProject() };
    const klass = ctx.project.database.classes[0];
    const result = runTool(ctx, "upsert_actor", { actor: { id: "actor_new", name: "새 동료", classId: klass.id } }, { dryRun: false });
    expect(result.ok, JSON.stringify(result.issues)).toBe(true);
    expect(ctx.project.database.actors.find((actor) => actor.id === "actor_new")?.maxLevel).toBe(99);
  });

  it("upsert_state는 raw spread로 임의 필드를 저장하지 않는다", () => {
    const ctx: ToolContext = { project: createBlankProject() };
    const result = runTool(ctx, "upsert_state", { state: { id: "state_x", name: "X", rawInjected: true } }, { dryRun: false });
    expect(result.ok).toBe(false);
    expect(ctx.project.database.states.some((state) => state.id === "state_x")).toBe(false);
  });
});
