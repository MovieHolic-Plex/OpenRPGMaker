// 장비 상점 계약 — 무기점·방어구점이 실제로 장비를 팔 수 있어야 한다(2026-09-24 도그푸딩 「잿불 광산의 세 사람」).
// 조수는 upsert_item(type:weapon) 7번·make_villager shop.stock(장비 id) 2번·changeItem(장비 id) 2번 거부를 받고
// 끝내 「돈만 받고 아무것도 안 주는」 선택지 상점을 만들었다. 런타임 상점·소지품은 장비 id 를 그대로 받는다.
import { describe, expect, it } from "vitest";
import { runTool } from "@/editor/tools/toolRunner";
import { createBlankProject } from "@/project/defaults";
import type { Command } from "@/project/types";

function shopCommand(project: ReturnType<typeof createBlankProject>, mapId: string, eventId: string): Extract<Command, { kind: "shop" }> | undefined {
  const event = project.maps[mapId]!.events.find((entry) => entry.id === eventId)!;
  const commands = [...(event.pages?.flatMap((page) => page.commands) ?? []), ...(event.commands ?? [])];
  return commands.find((command): command is Extract<Command, { kind: "shop" }> => command.kind === "shop");
}

describe("JRPG 장비 상점 계약", () => {
  it("make_villager shop.stock 은 장비 id 를 받는다", () => {
    const ctx = { project: createBlankProject() };
    const mapId = ctx.project.startMapId;
    const weapon = ctx.project.database.equipment.find((record) => record.slot === "weapon")!;
    const result = runTool(ctx, "make_villager", {
      mapId, id: "ev_weapon_shop", name: "무기 상인", home: { x: 2, y: 2 },
      dialogue: [{ text: "어서 오게." }],
      shop: { stock: [{ itemId: weapon.id }, { itemId: "item_potion" }] },
    }, { dryRun: false });
    expect(result.ok, result.summary).toBe(true);
    expect(shopCommand(ctx.project, mapId, "ev_weapon_shop")?.stock?.map((entry) => entry.itemId)).toEqual([weapon.id, "item_potion"]);
  });

  it("set_shop_stock 은 장비 id 를 받고, 없는 id 는 아이템·장비 후보를 함께 알린다", () => {
    const ctx = { project: createBlankProject() };
    const mapId = ctx.project.startMapId;
    const armor = ctx.project.database.equipment.find((record) => record.slot === "armor")!;
    expect(runTool(ctx, "make_villager", { mapId, id: "ev_armor_shop", name: "방어구 상인", home: { x: 3, y: 3 }, dialogue: [{ text: "튼튼하지." }] }, { dryRun: false }).ok).toBe(true);
    const ok = runTool(ctx, "set_shop_stock", { mapId, eventId: "ev_armor_shop", stock: [{ itemId: armor.id }] }, { dryRun: false });
    expect(ok.ok, ok.summary).toBe(true);
    expect(shopCommand(ctx.project, mapId, "ev_armor_shop")?.stock?.[0]?.itemId).toBe(armor.id);
    const missing = runTool(ctx, "set_shop_stock", { mapId, eventId: "ev_armor_shop", stock: [{ itemId: "equip_nope" }] }, { dryRun: false });
    expect(missing.ok).toBe(false);
    expect(missing.summary).toContain("장비");
  });

  it("changeItem 으로 장비를 건네는 이벤트가 참조 검증을 통과한다", () => {
    const ctx = { project: createBlankProject() };
    const mapId = ctx.project.startMapId;
    const weapon = ctx.project.database.equipment.find((record) => record.slot === "weapon")!;
    const result = runTool(ctx, "place_npc", {
      mapId, id: "ev_gift", name: "대장장이", x: 4, y: 4,
      pages: [{ name: "선물", lines: ["이 검을 가져가게."], commands: [{ kind: "changeItem", itemId: weapon.id, op: "+=", amount: 1 }] }],
    }, { dryRun: false });
    expect(result.ok, result.summary).toBe(true);
  });

  it("upsert_item 의 방어구 종류는 슬롯을 옮겨 장비로 저장하고 능력치를 보존한다", () => {
    const ctx = { project: createBlankProject() };
    const result = runTool(ctx, "upsert_item", {
      item: { id: "item_mage_robe", name: "마법사 로브", type: "body", price: 200, description: "마력이 깃든 로브", equipmentProfile: { statBonuses: { defense: 10, mind: 18 } } },
    }, { dryRun: false });
    expect(result.ok, result.summary).toBe(true);
    const record = ctx.project.database.equipment.find((entry) => entry.id === "item_mage_robe")!;
    expect(record).toMatchObject({ slot: "armor", price: 200, name: "마법사 로브" });
    expect(record.statBonuses).toMatchObject({ defense: 10, mind: 18 });
  });
});
