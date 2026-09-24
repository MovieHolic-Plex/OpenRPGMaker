import { describe, expect, it } from "vitest";
import { createSampleAdventureProject } from "@/project/defaults/defaultProject";
import { runTool } from "@/editor/tools/toolRunner";
import type { ToolContext } from "@/editor/tools/types";

describe("upsert_item/upsert_equipment iconResourceId", () => {
  it("아이템 id 를 그림 id 로 보내면 그 아이템의 그림으로 바꿔 저장한다", () => {
    const ctx: ToolContext = { project: createSampleAdventureProject() };
    const potionIcon = ctx.project.database.items.find((item) => item.id === "item_potion")?.iconResourceId;
    expect(potionIcon).toBeTruthy();
    const result = runTool(ctx, "upsert_item", { item: { id: "item_dream_drop", name: "꿈 방울", iconResourceId: "item_potion" } }, { dryRun: false });
    expect(result.ok, result.summary).toBe(true);
    expect(ctx.project.database.items.find((item) => item.id === "item_dream_drop")?.iconResourceId).toBe(potionIcon);
    expect(result.diff?.warnings?.join("\n")).toContain("레코드 id");
  });

  it("없는 그림 id 는 비우고 레코드는 저장한다", () => {
    const ctx: ToolContext = { project: createSampleAdventureProject() };
    const item = runTool(ctx, "upsert_item", { item: { id: "item_dream_bell", name: "꿈 종", iconResourceId: "nope_bell_icon" } }, { dryRun: false });
    expect(item.ok, item.summary).toBe(true);
    expect(ctx.project.database.items.find((entry) => entry.id === "item_dream_bell")?.iconResourceId).toBeUndefined();
    expect(item.diff?.warnings?.join("\n")).toContain("없는 그림");
    const equip = runTool(ctx, "upsert_equipment", { equipment: { id: "equip_dream_pen", name: "꿈 펜", slot: "weapon", iconResourceId: "item_quill_missing" } }, { dryRun: false });
    expect(equip.ok, equip.summary).toBe(true);
    expect(ctx.project.database.equipment.find((entry) => entry.id === "equip_dream_pen")).toBeDefined();
  });
});
