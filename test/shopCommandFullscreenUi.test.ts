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

describe("shop settings are grouped by task", () => {
  let restoreDom: (() => void) | undefined;
  beforeEach(() => { restoreDom = installFakeDom(); store.replace(createBlankProject()); });
  afterEach(() => restoreDom?.());
  it("mounts only the selected task and keeps all existing settings reachable", () => {
    const body = renderWithFakeDom(() => shopBody(ctx(), shopCommand));
    expect(findByTestId(body, "shop-type-select")).toBeNull();
    findByTestId(body, "shop-tab-rules")!.click();
    for (const id of ["shop-type-select", "shop-quantity-mode", "shop-merchant-gold", "shop-serviceKind", "shop-investmentLevel", "shop-mileageRate", "shop-economy-haggle", "shop-economy-dynamic", "shop-economy-shopkeeper", "shop-economy-restock"])
      expect(findByTestId(body, id), id).not.toBeNull();
    findByTestId(body, "shop-tab-messages")!.click();
    expect(findByTestId(body, "shop-type-select")).toBeNull();
    expect(findByTestId(body, "shop-message-type")).not.toBeNull();
    findByTestId(body, "shop-tab-branches")!.click();
    expect(findByTestId(body, "shop-branch-on-transaction")).not.toBeNull();
    expect(findByTestId(body, "shop-branch-on-failed-transaction")).not.toBeNull();
  });
});
