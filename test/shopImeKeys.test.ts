// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from "vitest";

import { attachEmeraldShopInput } from "@/player/emeraldShopInput";
import { attachShopDecisionInput } from "@/player/shopDecisionInput";

function imeKey(code: string, init: KeyboardEventInit = {}): KeyboardEvent {
  return new KeyboardEvent("keydown", {
    key: "Process",
    code,
    bubbles: true,
    cancelable: true,
    ...init,
  });
}

describe("shop menus read physical keys while an IME is active", () => {
  afterEach(() => {
    document.body.replaceChildren();
  });

  it("moves the stock list, changes quantity, confirms, and cancels from Process keys", () => {
    const root = document.createElement("div");
    root.className = "runtime-shop-overlay";
    const rows = [0, 1].map((index) => {
      const button = document.createElement("button");
      button.className = "runtime-shop-item-row";
      button.textContent = `item ${index}`;
      return button;
    });
    const quantity = document.createElement("input");
    quantity.type = "number";
    quantity.dataset.testid = "shop-quantity-input";
    const cancel = document.createElement("button");
    cancel.dataset.testid = "shop-item-cancel";
    root.append(...rows, quantity, cancel);
    document.body.append(root);

    const quantities: number[] = [];
    let bought = 0;
    let cancelled = 0;
    rows[1]!.addEventListener("click", () => { bought += 1; });
    cancel.addEventListener("click", () => { cancelled += 1; });
    attachShopDecisionInput(root, {
      initialIndex: 0,
      onSelect: () => {},
      onQuantity: (direction) => quantities.push(direction),
    });

    root.dispatchEvent(imeKey("ArrowDown"));
    expect(rows[1]!.classList.contains("selected")).toBe(true);
    expect(document.activeElement).toBe(rows[1]);

    root.dispatchEvent(imeKey("ArrowLeft"));
    expect(quantities).toEqual([-1]);

    root.dispatchEvent(imeKey("KeyZ"));
    expect(bought).toBe(1);

    const syllable = new KeyboardEvent("keydown", {
      key: "가", code: "KeyR", isComposing: true, bubbles: true, cancelable: true,
    });
    root.dispatchEvent(syllable);
    expect(syllable.defaultPrevented).toBe(false);
    expect(bought).toBe(1);
    expect(rows[1]!.classList.contains("selected")).toBe(true);

    root.dispatchEvent(imeKey("Escape"));
    expect(cancelled).toBe(1);
  });

  it("drives the emerald shop, including detail scroll, from the same physical keys", () => {
    const root = document.createElement("div");
    document.body.append(root);
    const directions: string[] = [];
    const scrolls: string[] = [];
    let confirmed = 0;
    attachEmeraldShopInput(root, {
      onDirection: (direction) => directions.push(direction),
      onConfirm: () => { confirmed += 1; },
      onCancel: () => {},
      onScroll: (key) => scrolls.push(key),
    });

    window.dispatchEvent(imeKey("ArrowUp"));
    window.dispatchEvent(imeKey("KeyZ"));
    window.dispatchEvent(imeKey("PageDown"));
    const syllable = new KeyboardEvent("keydown", {
      key: "가", isComposing: true, bubbles: true, cancelable: true,
    });
    window.dispatchEvent(syllable);

    expect(directions).toEqual(["up"]);
    expect(confirmed).toBe(1);
    expect(scrolls).toEqual(["PageDown"]);
    expect(syllable.defaultPrevented).toBe(false);
  });
});
