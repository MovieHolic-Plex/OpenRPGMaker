import { describe, expect, it } from "vitest";
import { PLAY_TOOLS } from "@/editor/tools/playTools";
import { functionalFixture } from "./fixtures/functionalAcceptance";

function purchase(options: { seller?: string; itemId?: string; count?: number; unitPrice?: number; gold?: number; blocked?: boolean; single?: boolean } = {}) {
  const fixture = functionalFixture();
  const { project, seller, origin } = fixture;
  if (options.gold !== undefined) project.session.gold = options.gold;
  const shop = seller.pages?.[0]?.commands[0];
  if (options.single && shop?.kind === "shop") shop.quantityMode = "single";
  if (options.blocked) origin.events.unshift({ ...structuredClone(seller), id: "wrong_seller" });
  const tool = PLAY_TOOLS.find(tool => tool.name === "run_scene_test");
  if (!tool) throw new Error("Missing public scene tool");
  const before = structuredClone(project);
  const output = tool.run(project, { mapId: project.startMapId, start: project.startPos, steps: [
    { kind: "walk", to: { x: seller.x, y: seller.y }, adjacent: true },
    { kind: "snapshotRewards" },
    { kind: "interact", eventId: seller.id },
    { kind: "purchase", eventId: options.seller ?? seller.id, itemId: options.itemId ?? "item_potion", count: options.count ?? 2, unitPrice: options.unitPrice ?? 10 },
    { kind: "expect", goldDelta: -20, inventoryDelta: { item_potion: 2 }, interactionComplete: true },
  ] });
  expect(project).toEqual(before);
  return output;
}

describe("public scene purchase transaction", () => {
  it("walks to the seller and buys exact stock with real gold and inventory deltas", () => {
    const output = purchase();
    expect(output.data, JSON.stringify(output.data)).toMatchObject({ ok: true, finalState: { inventory: { item_potion: 2 }, gold: 80 } });
  });
  it("buys the requested total through repeated production transactions in a single-quantity shop", () => {
    expect(purchase({ single: true }).data).toMatchObject({ ok: true, finalState: { gold: 80, inventory: { item_potion: 2 } } });
  });
  it.each([
    { seller: "wrong_seller" }, { itemId: "item_capture_orb" }, { unitPrice: 9 }, { count: 1 }, { gold: 19 }, { blocked: true },
  ])("rejects wrong target, stock, price/count or funds: %j", options => {
    expect(purchase(options).data).toMatchObject({ ok: false });
  });
  it("does not treat opening an untransacted shop as a completed interaction", () => {
    const { project, seller } = functionalFixture();
    const tool = PLAY_TOOLS.find(tool => tool.name === "run_scene_test");
    if (!tool) throw new Error("Missing public scene tool");
    expect(tool.run(project, { mapId: project.startMapId, start: project.startPos, steps: [
      { kind: "walk", to: { x: seller.x, y: seller.y }, adjacent: true }, { kind: "interact", eventId: seller.id },
      { kind: "expect", interactionComplete: true },
    ] }).data).toMatchObject({ ok: false });
  });
});
