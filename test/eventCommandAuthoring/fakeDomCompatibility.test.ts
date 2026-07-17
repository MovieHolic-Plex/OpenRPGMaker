import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { flushFakeAnimationFrames, installFakeDom } from "../fakeDom";

describe("fake DOM browser compatibility", () => {
  let restore: (() => void) | undefined;

  beforeEach(() => {
    restore = installFakeDom({ animationFrames: "manual" });
  });

  afterEach(() => {
    restore?.();
  });

  it("exposes standard attribute names to transfer-picker DOM consumers", () => {
    const element = document.createElement("div");
    element.setAttribute("role", "dialog");
    element.setAttribute("aria-label", "장소 이동");

    expect(element.getAttributeNames()).toEqual(["role", "aria-label"]);
  });

  it("flushes nested animation frames deterministically", () => {
    const calls: string[] = [];
    requestAnimationFrame(() => {
      calls.push("first");
      requestAnimationFrame(() => calls.push("second"));
    });

    flushFakeAnimationFrames(16);

    expect(calls).toEqual(["first", "second"]);
  });

  it("cancels pending animation frames when the fake DOM is restored", () => {
    const callback = vi.fn();
    requestAnimationFrame(callback);
    restore?.();
    restore = undefined;

    flushFakeAnimationFrames(16);

    expect(callback).not.toHaveBeenCalled();
  });
});
