/** @vitest-environment happy-dom */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { installPlayPointerBlocker, shouldBlockPlayPointerEvent } from "@/player/playInputBlocker";

const FORCE_BLOCK_GLOBAL = globalThis as { __oprnForcePointerBlock?: boolean };

describe("play pointer blocker", () => {
  beforeEach(() => {
    FORCE_BLOCK_GLOBAL.__oprnForcePointerBlock = true;
  });

  afterEach(() => {
    delete FORCE_BLOCK_GLOBAL.__oprnForcePointerBlock;
  });

  it("blocks trusted mouse-style clicks while allowing keyboard-synthetic button clicks", () => {
    expect(shouldBlockPlayPointerEvent({ type: "pointerdown" })).toBe(true);
    expect(shouldBlockPlayPointerEvent({ type: "click", detail: 1 })).toBe(true);
    expect(shouldBlockPlayPointerEvent({ type: "click", detail: 0 })).toBe(false);
    expect(shouldBlockPlayPointerEvent({ type: "click" })).toBe(false);
  });

  it("blocks title-control pointers with the rest of keyboard-only play", () => {
    const g = globalThis as { __oprnForcePointerBlock?: boolean };
    g.__oprnForcePointerBlock = true;
    try {
      const titleControls = document.createElement("section");
      titleControls.dataset.playInputOwner = "title-controls";
      const option = document.createElement("button");
      titleControls.append(option);
      expect(shouldBlockPlayPointerEvent({ type: "click", detail: 1, target: option })).toBe(true);
      expect(shouldBlockPlayPointerEvent({ type: "pointerdown", target: option })).toBe(true);
      // 필드 클릭은 여전히 차단
      expect(
        shouldBlockPlayPointerEvent({ type: "click", detail: 1, target: document.createElement("div") })
      ).toBe(true);
    } finally {
      delete g.__oprnForcePointerBlock;
    }
  });

  it("allows only explicitly owned touch and host-fullscreen descendants", () => {
    const touchOwner = document.createElement("div");
    touchOwner.dataset.playInputOwner = "touch-controls";
    const control = document.createElement("button");
    touchOwner.append(control);
    const fullscreen = document.createElement("button");
    fullscreen.dataset.playInputOwner = "host-fullscreen";
    const ordinaryStage = document.createElement("div");

    expect(shouldBlockPlayPointerEvent({ type: "pointerdown", target: control })).toBe(false);
    expect(shouldBlockPlayPointerEvent({ type: "pointerdown", target: fullscreen })).toBe(false);
    expect(shouldBlockPlayPointerEvent({ type: "pointerdown", target: ordinaryStage })).toBe(true);
  });

  it("prevents dispatched mouse clicks from changing state but allows keyboard-synthetic clicks", () => {
    const root = document.createElement("div");
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

  it("automation receives the same production pointer semantics", () => {
    const navigatorPrototype = Object.getPrototypeOf(navigator);
    const original = Object.getOwnPropertyDescriptor(navigatorPrototype, "webdriver");
    Object.defineProperty(navigator, "webdriver", { configurable: true, value: true });
    try {
      expect(shouldBlockPlayPointerEvent({ type: "click", detail: 1 })).toBe(true);
      expect(shouldBlockPlayPointerEvent({ type: "pointerdown" })).toBe(true);
    } finally {
      if (original) Object.defineProperty(navigatorPrototype, "webdriver", original);
      else Object.defineProperty(navigator, "webdriver", { configurable: true, value: undefined });
    }
  });
});

function detailedClick(detail: number): Event {
  const event = new Event("click", { bubbles: true, cancelable: true });
  Object.defineProperty(event, "detail", { configurable: true, value: detail });
  return event;
}
