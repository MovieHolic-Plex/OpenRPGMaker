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

  it("shows intent, presets, and an in-list empty notice for empty shops", () => {
    const body = renderWithFakeDom(() => shopBody(ctx(), emptyShop));
    expect(findByTestId(body, "shop-intent-card")).not.toBeNull();
    expect(findByTestId(body, "shop-presets")).not.toBeNull();
    expect(findByTestId(body, "shop-preset-general")).not.toBeNull();
    expect(body.className).toContain("shop-processing-v2");
    // 빈 상점 안내는 별도 배너가 아니라 판매 중 그룹 안에 한 번만 있다. 예전 전폭 배너는
    // 눌려서 화면에 보이지 않았고 판매목록에 덮였다.
    expect(findByTestId(body, "shop-empty-banner")).toBeNull();
    const saleList = findByTestId(body, "shop-sale-list");
    expect(saleList).not.toBeNull();
    expect(saleList?.textContent).toContain("아직 담은 물건이 없습니다.");
  });

  it("splits goods into one scroller with 판매 중 / 안 담음 groups", () => {
    const command = { ...emptyShop, itemIds: ["item_potion"] } satisfies Command;
    const body = renderWithFakeDom(() => shopBody(ctx(), command));
    const goods = findByTestId(body, "shop-item-catalog");
    expect(goods).not.toBeNull();
    expect(findByTestId(body, "shop-sale-list")).not.toBeNull();
    expect(findByTestId(body, "shop-stock-pool")).not.toBeNull();
    // 담긴 아이템은 판매 중 그룹에, 체크된 체크박스와 순서 버튼을 갖는다.
    const row = findByTestId(findByTestId(body, "shop-sale-list")!, "shop-item-row-item_potion");
    expect(row).not.toBeNull();
    expect(findByTestId(body, "shop-move-up-item_potion")).not.toBeNull();
    // 접이식 자료집과 aria-hidden e2e 트레이는 사라졌다.
    expect(findByTestId(body, "shop-item-catalog-fold")).toBeNull();
    expect(findByTestId(body, "shop-available-items")).toBeNull();
    expect(findByTestId(body, "shop-selected-items")).toBeNull();
  });

  it("toggling a pool checkbox adds the item to itemIds", () => {
    const replaceCommand = vi.fn();
    const body = renderWithFakeDom(() => shopBody(ctx(replaceCommand), emptyShop));
    const check = findByTestId(body, "shop-item-check-item_potion") as FakeElement | null;
    expect(check).not.toBeNull();
    check!.checked = true;
    check?.dispatchEvent(new Event("change"));
    expect(replaceCommand).toHaveBeenCalled();
    const next = replaceCommand.mock.calls.at(-1)?.[1] as Extract<Command, { kind: "shop" }>;
    expect(next.itemIds).toContain("item_potion");
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
