import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { commandDialogWidth } from "@/editor/panels/eventEditor/commandEditDialog";
import { shopBody } from "@/editor/panels/eventEditor/commandBodyCommerce";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import type { Command } from "@/project/types";
import type { CommandEditContext } from "@/editor/panels/eventEditor/types";
import { findByTestId, installFakeDom, renderWithFakeDom } from "./fakeDom";

function ctx(): CommandEditContext {
  return {
    path: [0],
    actions: {
      addCommand: vi.fn(),
      insertCommand: vi.fn(),
      replaceCommand: vi.fn(),
      deleteCommand: vi.fn(),
      moveCommand: vi.fn(),
      moveCommandTo: vi.fn(),
    },
  };
}

const shopCommand = {
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

describe("shop command dialog is fullscreen", () => {
  it("resolves the fullscreen window width for shop commands", () => {
    expect(commandDialogWidth(shopCommand)).toBe("full");
  });

  it("keeps the wide window for ordinary commands", () => {
    expect(commandDialogWidth({ kind: "text", lines: ["안녕"] } as Command)).toBe("wide");
    expect(commandDialogWidth({ kind: "inn", price: 10 } as Command)).toBe("wide");
  });
});

describe("shop options live in one compact rail", () => {
  let restoreDom: (() => void) | undefined;

  beforeEach(() => {
    restoreDom = installFakeDom();
    store.replace(createBlankProject());
  });

  afterEach(() => {
    restoreDom?.();
  });

  it("puts every shop option inside the shop-options-rail container", () => {
    const body = renderWithFakeDom(() => shopBody(ctx(), shopCommand));
    const rail = findByTestId(body, "shop-options-rail");
    expect(rail).not.toBeNull();
    for (const testId of [
      "shop-type-select",
      "shop-quantity-mode",
      "shop-message-type",
      "shop-merchant-gold",
      "shop-branch-on-transaction",
      "shop-branch-on-failed-transaction",
      "shop-serviceKind",
      "shop-investmentLevel",
      "shop-mileageRate",
    ]) {
      expect(findByTestId(rail!, testId), `${testId} missing from options rail`).not.toBeNull();
    }
  });
});
