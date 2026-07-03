import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { renderTilePalette } from "@/editor/panels/tilePalette";
import { FakeElement, installFakeDom } from "./fakeDom";

describe("renderTilePalette", () => {
  let restoreDom: () => void;
  let previousWindow: typeof globalThis.window | undefined;

  beforeEach(() => {
    restoreDom = installFakeDom();
    Object.assign(globalThis.document, {
      createElementNS: (_namespace: string, tagName: string) => new FakeElement(tagName),
    });
    previousWindow = globalThis.window;
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: {
        requestAnimationFrame: (callback: FrameRequestCallback) => {
          callback(0);
          return 0;
        },
      },
    });
  });

  afterEach(() => {
    restoreDom();
    if (previousWindow === undefined) {
      Reflect.deleteProperty(globalThis, "window");
      return;
    }
    Object.defineProperty(globalThis, "window", { configurable: true, value: previousWindow });
  });

  it("renders tile palette cells with clipped image previews", () => {
    const root = document.createElement("div");

    renderTilePalette(root);

    const tile = root.querySelector("[data-testid=\"chipset-tile-240\"]");
    const preview = tile?.querySelector(".chipset-tile-preview");
    const image = preview?.querySelector("img") as FakeElement | null | undefined;
    expect(preview).not.toBeNull();
    expect(image?.attrs.src).toBe("/assets/easyrpg-chipset-combined-town-transparent.png");
    expect(image?.attrs.style).toContain("transform:translate(");
  });
});
