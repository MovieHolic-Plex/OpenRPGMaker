import { describe, expect, it } from "vitest";
import { installPlayPointerBlocker, shouldBlockPlayPointerEvent } from "@/player/playInputBlocker";

describe("play pointer blocker", () => {
  it("blocks trusted mouse-style clicks while allowing keyboard-synthetic button clicks", () => {
    expect(shouldBlockPlayPointerEvent({ type: "pointerdown" })).toBe(true);
    expect(shouldBlockPlayPointerEvent({ type: "click", detail: 1 })).toBe(true);
    expect(shouldBlockPlayPointerEvent({ type: "click", detail: 0 })).toBe(false);
    expect(shouldBlockPlayPointerEvent({ type: "click" })).toBe(false);
  });

  it("prevents dispatched mouse clicks from changing state but allows keyboard-synthetic clicks", () => {
    const root = new EventTarget() as HTMLElement;
    const cleanup = installPlayPointerBlocker(root);
    let activations = 0;
    root.addEventListener("click", () => {
      activations += 1;
    });

    const mouseClick = detailedClick(1);
    root.dispatchEvent(mouseClick);
    expect(mouseClick.defaultPrevented).toBe(true);
    expect(activations).toBe(0);

    const keyboardClick = detailedClick(0);
    root.dispatchEvent(keyboardClick);
    expect(keyboardClick.defaultPrevented).toBe(false);
    expect(activations).toBe(1);
    cleanup();
  });
});

function detailedClick(detail: number): Event {
  const event = new Event("click", { bubbles: true, cancelable: true });
  Object.defineProperty(event, "detail", { configurable: true, value: detail });
  return event;
}
