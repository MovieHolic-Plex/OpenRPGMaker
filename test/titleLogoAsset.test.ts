import { describe, expect, it } from "vitest";
import { inspectPngBytes } from "@/assets/pngInspection";

type BinaryFsReader = {
  readonly existsSync: (path: URL) => boolean;
  readonly readFileSync: (path: URL) => Uint8Array;
};

const loadBinaryFs = async (): Promise<BinaryFsReader> => {
  const moduleName = "node:fs";
  return (await import(moduleName)) as BinaryFsReader;
};

describe("bundled title logo", () => {
  it("uses real alpha transparency so layered title backgrounds remain visible", async () => {
    const { existsSync, readFileSync } = await loadBinaryFs();
    const imageUrl = new URL("../public/assets/generated/title/title-logo-crest.png", import.meta.url);

    expect(existsSync(imageUrl), "title crest PNG is missing").toBe(true);
    const result = await inspectPngBytes(readFileSync(imageUrl));

    expect(result.ok, result.ok ? undefined : result.reason).toBe(true);
    if (!result.ok) return;
    expect(result.inspection.mode).toBe("rgba");
    expect(result.inspection.transparentPixels).toBeGreaterThan(
      result.inspection.width * result.inspection.height * 0.25,
    );
  });
});
