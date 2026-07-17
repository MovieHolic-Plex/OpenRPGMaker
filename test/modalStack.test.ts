import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  modalStackDepthForTest,
  registerModal,
  resetModalStackForTest,
  unregisterModal,
} from "@/editor/ui/modalStack";
import { installFakeDom } from "./fakeDom";

function dispatchEscape(): void {
  const event = new Event("keydown", { bubbles: true, cancelable: true }) as Event & { key: string };
  Object.defineProperty(event, "key", { configurable: true, value: "Escape" });
  document.dispatchEvent(event);
}

describe("modal stack Escape layering", () => {
  let restoreDom: (() => void) | undefined;

  beforeEach(() => {
    restoreDom = installFakeDom();
    resetModalStackForTest();
  });

  afterEach(() => {
    resetModalStackForTest();
    restoreDom?.();
  });

  it("closes only the topmost modal on Escape", () => {
    const bottom = document.createElement("div");
    const top = document.createElement("div");
    document.body.append(bottom, top);
    let bottomClosed = 0;
    let topClosed = 0;
    registerModal(bottom, () => {
      bottomClosed += 1;
      bottom.remove();
    });
    registerModal(top, () => {
      topClosed += 1;
      top.remove();
    });
    expect(modalStackDepthForTest()).toBe(2);

    dispatchEscape();
    expect(topClosed).toBe(1);
    expect(bottomClosed).toBe(0);
    expect(modalStackDepthForTest()).toBe(1);

    dispatchEscape();
    expect(topClosed).toBe(1);
    expect(bottomClosed).toBe(1);
    expect(modalStackDepthForTest()).toBe(0);
  });

  it("unregisterModal drops a layer without calling closeUi", () => {
    const el = document.createElement("div");
    document.body.append(el);
    let closed = 0;
    registerModal(el, () => {
      closed += 1;
    });
    unregisterModal(el);
    expect(modalStackDepthForTest()).toBe(0);
    dispatchEscape();
    expect(closed).toBe(0);
  });
});
