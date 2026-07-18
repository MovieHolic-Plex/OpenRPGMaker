import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { shopBody } from "@/editor/panels/eventEditor/commandBodyCommerce";
import { renderCommandPreview } from "@/editor/panels/eventEditor/commandPreview";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import type { Command } from "@/project/types";
import type { CommandEditContext } from "@/editor/panels/eventEditor/types";
import { FakeElement, findByTestId, installFakeDom, renderWithFakeDom } from "./fakeDom";

function ctx(replaceCommand = vi.fn()): CommandEditContext {
  return {
    path: [0],
    actions: {
      addCommand: vi.fn(),
      insertCommand: vi.fn(),
      replaceCommand,
      deleteCommand: vi.fn(),
      moveCommand: vi.fn(),
      moveCommandTo: vi.fn(),
    },
  };
}

const emptyShop = {
  kind: "shop",
  itemIds: [],
  allowSell: true,
  quantityMode: "single",
  shopType: "normal",
  messageType: "welcome",
  merchantGold: 100,
  branchOnTransaction: false,
  transactionBranch: [],
} satisfies Command;

describe("shop command body UX (list-first)", () => {
  let restoreDom: (() => void) | undefined;

  beforeEach(() => {
    restoreDom = installFakeDom();
    store.replace(createBlankProject());
  });

  afterEach(() => {
    restoreDom?.();
  });

  it("shows intent, empty banner, and presets for empty shops", () => {
    const body = renderWithFakeDom(() => shopBody(ctx(), emptyShop));
    expect(findByTestId(body, "shop-intent-card")).not.toBeNull();
    expect(findByTestId(body, "shop-empty-banner")).not.toBeNull();
    expect(findByTestId(body, "shop-presets")).not.toBeNull();
    expect(findByTestId(body, "shop-preset-general")).not.toBeNull();
    expect(body.className).toContain("shop-processing-v2");
  });

  it("applies the general store preset into itemIds", () => {
    const replaceCommand = vi.fn();
    const body = renderWithFakeDom(() => shopBody(ctx(replaceCommand), emptyShop));
    const preset = findByTestId(body, "shop-preset-general") as FakeElement | null;
    expect(preset).not.toBeNull();
    preset?.dispatchEvent(new Event("click"));
    expect(replaceCommand).toHaveBeenCalled();
    const next = replaceCommand.mock.calls.at(-1)?.[1] as Extract<Command, { kind: "shop" }>;
    expect(next.kind).toBe("shop");
    expect(next.itemIds).toEqual(expect.arrayContaining(["item_potion", "item_ether", "item_antidote"]));
    expect(next.itemIds.length).toBe(3);
  });

  it("writes seasonal stock when editing a listed item detail", () => {
    const replaceCommand = vi.fn();
    const command = {
      ...emptyShop,
      itemIds: ["item_potion"],
    } satisfies Command;
    const body = renderWithFakeDom(() => shopBody(ctx(replaceCommand), command));
    expect(findByTestId(body, "shop-stock-editor")).not.toBeNull();
    const spring = findByTestId(body, "shop-stock-season-spring") as FakeElement | null;
    expect(spring).not.toBeNull();
    spring?.dispatchEvent(new Event("click"));
    expect(replaceCommand).toHaveBeenCalled();
    const next = replaceCommand.mock.calls.at(-1)?.[1] as Extract<Command, { kind: "shop" }>;
    expect(next.stock?.some((row) => row.itemId === "item_potion" && row.seasons?.includes("spring"))).toBe(true);
  });

  it("preview warns when shop has zero items", () => {
    const preview = renderWithFakeDom(() => renderCommandPreview(emptyShop));
    expect(findByTestId(preview, "ecp-shop-empty-warn")).not.toBeNull();
    expect(preview.textContent).toContain("상품 없음");
  });
});
