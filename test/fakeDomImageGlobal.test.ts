import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { FakeElement, installFakeDom } from "./fakeDom";
import { getAutoKeyedDataUrl } from "@/editor/panels/chromaKey";

describe("fake DOM Image global", () => {
  let preInstallImage: PropertyDescriptor | undefined;
  let restore: (() => void) | null = null;

  beforeEach(() => {
    preInstallImage = Object.getOwnPropertyDescriptor(globalThis, "Image");
    restore = installFakeDom();
  });

  afterEach(() => {
    restore?.();
    restore = null;
  });

  it("constructs an IMG-shaped FakeElement without throwing", () => {
    const image = new Image();
    expect(image).toBeInstanceOf(FakeElement);
    expect(image.tagName).toBe("IMG");
    expect(image.naturalWidth).toBe(0);
    expect(image.naturalHeight).toBe(0);
  });

  it("dispatches error exactly once when src is assigned", async () => {
    const image = new Image();
    let errorCount = 0;
    let loadCount = 0;
    const fired = new Promise<void>((resolve) => {
      image.addEventListener("error", () => {
        errorCount += 1;
        resolve();
      });
    });
    image.addEventListener("load", () => {
      loadCount += 1;
    });
    image.src = "https://example.invalid/sheet.png";
    expect(errorCount).toBe(0);
    await fired;
    expect(errorCount).toBe(1);
    expect(loadCount).toBe(0);
  });

  it("lets getAutoKeyedDataUrl resolve to the original url instead of rejecting", async () => {
    const url = "https://example.invalid/fake-dom-auto-key.png";
    await expect(getAutoKeyedDataUrl(url)).resolves.toBe(url);
  });

  it("restores the pre-install Image global on teardown", () => {
    expect(Object.getOwnPropertyDescriptor(globalThis, "Image")).toBeDefined();
    restore?.();
    restore = null;
    const after = Object.getOwnPropertyDescriptor(globalThis, "Image");
    expect(after?.value).toBe(preInstallImage?.value);
    expect("Image" in globalThis).toBe(preInstallImage !== undefined);
  });
});
