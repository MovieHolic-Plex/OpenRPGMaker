import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { installFakeDom } from "./fakeDom";
import { attachCursorMenu } from "@/player/runtimeCursorMenu";

// fakeDom 은 KeyboardEvent 클래스가 없으므로 dispatchEvent 가 읽는 필드만 갖춘 가짜 이벤트를 만든다.
function keydown(key: string): KeyboardEvent {
  return {
    type: "keydown",
    key,
    bubbles: true,
    defaultPrevented: false,
    target: null,
    isComposing: false,
    repeat: false,
    preventDefault(): void {
      (this as { defaultPrevented: boolean }).defaultPrevented = true;
    },
    stopPropagation(): void {},
  } as unknown as KeyboardEvent;
}

describe("attachCursorMenu (DOM)", () => {
  let restore: () => void;
  beforeEach(() => {
    restore = installFakeDom();
  });
  afterEach(() => {
    restore();
  });

  function build(count: number): { root: HTMLElement; items: HTMLElement[]; clicks: number[] } {
    const root = document.createElement("div");
    const items: HTMLElement[] = [];
    const clicks: number[] = [];
    for (let i = 0; i < count; i += 1) {
      const button = document.createElement("button");
      button.dataset.testid = `item-${i}`;
      button.addEventListener("click", () => clicks.push(i));
      root.append(button);
      items.push(button);
    }
    document.body.append(root);
    return { root, items, clicks };
  }

  it("selects the first item and moves with wrapping arrows", () => {
    const { root, items } = build(3);
    attachCursorMenu(root, { items });
    expect(items[0].classList.contains("selected")).toBe(true);

    root.dispatchEvent(keydown("ArrowDown"));
    expect(items[1].classList.contains("selected")).toBe(true);
    expect(items[0].classList.contains("selected")).toBe(false);
    expect(items[1].getAttribute("aria-current")).toBe("true");

    root.dispatchEvent(keydown("ArrowUp"));
    root.dispatchEvent(keydown("ArrowUp"));
    expect(items[2].classList.contains("selected")).toBe(true);
  });

  it("confirm key (Z / Enter) clicks the selected item", () => {
    const { root, items, clicks } = build(3);
    attachCursorMenu(root, { items });
    root.dispatchEvent(keydown("ArrowDown"));
    root.dispatchEvent(keydown("z"));
    expect(clicks).toEqual([1]);
    root.dispatchEvent(keydown("Enter"));
    expect(clicks).toEqual([1, 1]);
    void items;
  });

  it("cancel key (X / Esc) clicks the cancel element", () => {
    const { root, items } = build(2);
    const cancel = document.createElement("button");
    let cancelled = 0;
    cancel.addEventListener("click", () => {
      cancelled += 1;
    });
    root.append(cancel);
    attachCursorMenu(root, { items, cancelEl: cancel });
    root.dispatchEvent(keydown("x"));
    expect(cancelled).toBe(1);
    root.dispatchEvent(keydown("Escape"));
    expect(cancelled).toBe(2);
  });

  it("onHorizontal consumes ←→ without moving the cursor", () => {
    const { root, items } = build(3);
    const dirs: number[] = [];
    attachCursorMenu(root, {
      items,
      onHorizontal: (dir) => {
        dirs.push(dir);
        return true;
      },
    });
    root.dispatchEvent(keydown("ArrowRight"));
    root.dispatchEvent(keydown("ArrowLeft"));
    expect(dirs).toEqual([1, -1]);
    expect(items[0].classList.contains("selected")).toBe(true);
  });

  it("stops handling and clears selection after detach", () => {
    const { root, items, clicks } = build(3);
    const detach = attachCursorMenu(root, { items });
    detach();
    root.dispatchEvent(keydown("ArrowDown"));
    root.dispatchEvent(keydown("z"));
    expect(clicks).toEqual([]);
    expect(items[0].classList.contains("selected")).toBe(false);
    expect(items[0].classList.contains("rm-nav-item")).toBe(false);
  });

  it("skips disabled items", () => {
    const { root, items } = build(3);
    (items[1] as unknown as { disabled: boolean }).disabled = true;
    attachCursorMenu(root, { items });
    root.dispatchEvent(keydown("ArrowDown"));
    expect(items[2].classList.contains("selected")).toBe(true);
    expect(items[1].classList.contains("selected")).toBe(false);
  });
});
