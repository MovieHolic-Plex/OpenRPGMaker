import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { shopBody } from "@/editor/panels/eventEditor/commandBodyCommerce";
import { renderCommandPreview } from "@/editor/panels/eventEditor/commandPreview";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import type { Command } from "@/project/types";
import type { CommandEditContext } from "@/editor/panels/eventEditor/types";
import { FakeElement, type FakeNode, findByTestId, installFakeDom, renderWithFakeDom } from "./fakeDom";

type Shop = Extract<Command, { kind: "shop" }>;
const emptyShop: Shop = { kind: "shop", itemIds: [], quantityMode: "single", shopType: "normal", messageType: "welcome", merchantGold: 100 };
function mount(command: Shop = emptyShop) {
  const replaceCommand = vi.fn();
  const context: CommandEditContext = { path: [0], actions: { addCommand: vi.fn(), insertCommand: vi.fn(), replaceCommand, deleteCommand: vi.fn(), moveCommand: vi.fn(), moveCommandTo: vi.fn() } };
  const body = renderWithFakeDom(() => shopBody(context, command));
  document.body.append(body as unknown as HTMLElement);
  const latest = () => (replaceCommand.mock.calls.at(-1)?.[1] ?? command) as Shop;
  return { body, replaceCommand, latest };
}
const root = () => document.body as unknown as FakeNode;
function node(id: string, scope: FakeNode = root()): FakeElement {
  const found = findByTestId(scope, id);
  expect(found, id).not.toBeNull();
  return found!;
}
function check(id: string, value = true) { const input = node(id); input.checked = value; input.dispatchEvent(new Event("change")); }
function change(id: string, value: string) { const input = node(id); input.value = value; input.dispatchEvent(new Event("change")); }

describe("shop goods authoring", () => {
  let restoreDom: () => void;
  beforeEach(() => { restoreDom = installFakeDom(); store.replace(createBlankProject()); });
  afterEach(() => restoreDom());

  it("opens with listed goods only and separates selection from removing goods", () => {
    const { body, replaceCommand } = mount({ ...emptyShop, itemIds: ["item_potion"] });
    expect(node("shop-sale-list").textContent).toContain("회복약");
    expect(findByTestId(body, "shop-stock-pool")).toBeNull();
    expect(findByTestId(body, "shop-item-check-item_potion")).toBeNull();
    node("shop-item-row-item_potion").click();
    expect(replaceCommand).not.toHaveBeenCalled();
    node("shop-remove-goods").click();
    expect(replaceCommand.mock.calls.at(-1)?.[1].itemIds).toEqual([]);
    expect(node("shop-sale-list").textContent).toContain("아직 진열한 상품이 없습니다");
  });

  it("keeps catalog selections pending until one batch add and lets cancel discard them", () => {
    const { latest, replaceCommand } = mount();
    node("shop-add-goods").click();
    check("shop-item-check-item_potion");
    check("shop-item-check-item_ether");
    expect(replaceCommand).not.toHaveBeenCalled();
    node("shop-catalog-cancel").click();
    expect(replaceCommand).not.toHaveBeenCalled();
    node("shop-add-goods").click();
    check("shop-item-check-item_potion"); check("shop-item-check-item_ether");
    node("shop-catalog-add").click();
    expect(replaceCommand).toHaveBeenCalledTimes(1);
    expect(latest().itemIds).toEqual(["item_potion", "item_ether"]);
    expect(findByTestId(root(), "shop-catalog-dialog")).toBeNull();
    expect(node("shop-item-row-item_ether")).toBeTruthy();
    node("shop-add-goods").click();
    expect(node("shop-item-check-item_potion").disabled).toBe(true);
  });

  it("quick selection adds missing preset goods without replacing stock or shop rules", () => {
    const original: Shop = { ...emptyShop, itemIds: ["item_antidote"], shopType: "sellOnly", stock: [{ itemId: "item_antidote", priceOverride: 40 }] };
    const { latest, replaceCommand } = mount(original);
    node("shop-add-goods").click(); node("shop-preset-general").click();
    expect(replaceCommand).not.toHaveBeenCalled();
    node("shop-catalog-add").click();
    expect(latest().itemIds).toEqual(["item_antidote", "item_potion", "item_ether"]);
    expect(latest().stock).toEqual(original.stock);
    expect(latest().shopType).toBe("sellOnly");
  });

  it("accumulates price and seasons across items, preserving seasonal prices and unrelated settings", () => {
    const original: Shop = { ...emptyShop, itemIds: ["item_potion", "item_ether"], stock: [{ itemId: "item_potion", priceBySeason: { winter: 88 } }], economy: { haggleEnabled: true } };
    const { latest } = mount(original);
    check("shop-stock-price-custom"); change("shop-stock-price-override", "75");
    node("shop-stock-season-spring").click();
    node("shop-item-row-item_ether").click();
    node("shop-stock-season-summer").click();
    node("shop-item-row-item_potion").click();
    expect(node("shop-stock-price-override").value).toBe("75");
    expect(latest().stock).toEqual([
      { itemId: "item_potion", priceBySeason: { winter: 88 }, priceOverride: 75, seasons: ["spring"] },
      { itemId: "item_ether", seasons: ["summer"] },
    ]);
    check("shop-stock-price-base");
    expect(latest().stock?.[0]).toMatchObject({ priceBySeason: { winter: 88 }, seasons: ["spring"] });
    expect(latest().stock?.[0]?.priceOverride).toBeUndefined();
    expect(latest().economy).toEqual(original.economy);
    expect(original.stock).toEqual([{ itemId: "item_potion", priceBySeason: { winter: 88 } }]);
  });

  it("keeps selected goods and overlays when reordering and removes only the removed overlay", () => {
    const { latest } = mount({ ...emptyShop, itemIds: ["item_potion", "item_ether"], stock: [{ itemId: "item_potion", priceOverride: 70 }, { itemId: "item_ether", seasons: ["fall"] }] });
    node("shop-move-down-item_potion").click();
    expect(latest().itemIds).toEqual(["item_ether", "item_potion"]);
    expect(node("shop-item-row-item_potion").getAttribute("aria-pressed")).toBe("true");
    expect(latest().stock?.map(row => row.itemId)).toEqual(latest().itemIds);
    node("shop-remove-goods").click();
    expect(latest().stock).toEqual([{ itemId: "item_ether", seasons: ["fall"] }]);
  });

  it("only mounts enabled haggling controls and preserves disabled configuration", () => {
    const { latest } = mount({ ...emptyShop, economy: { haggle: { patience: 4, insultRatio: 0.7, maxDiscount: 0.3 } } });
    node("shop-tab-rules").click();
    expect(findByTestId(root(), "shop-haggle-patience")).toBeNull();
    check("shop-economy-haggle");
    expect(node("shop-haggle-insult").value).toBe("70");
    change("shop-haggle-discount", "35");
    expect(latest().economy?.haggle?.maxDiscount).toBe(0.35);
    check("shop-economy-haggle", false);
    expect(findByTestId(root(), "shop-haggle-patience")).toBeNull();
    expect(latest().economy?.haggle?.maxDiscount).toBe(0.35);
    node("shop-tab-goods").click(); node("shop-tab-rules").click();
    expect(latest().economy?.haggleEnabled).toBeUndefined();
    expect(findByTestId(root(), "shop-haggle-patience")).toBeNull();
  });

  it("preview warns when shop has zero items", () => {
    const preview = renderWithFakeDom(() => renderCommandPreview(emptyShop));
    expect(findByTestId(preview, "ecp-shop-empty-warn")).not.toBeNull();
  });
});
