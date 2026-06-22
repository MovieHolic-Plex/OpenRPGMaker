import { describe, expect, it } from "vitest";
import { validateResourceDimensions } from "@/project/resourceProfiles";

describe("RM2K3 resource profiles", () => {
  it("accepts a 480x256 chipset as 16x16 tiles", () => {
    const result = validateResourceDimensions("chipset", 480, 256);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.tilesPerRow).toBe(30);
      expect(result.tileCount).toBe(480);
    }
  });

  it("accepts a 288x256 charset as 24x32 frames", () => {
    const result = validateResourceDimensions("charset", 288, 256);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.tilesPerRow).toBe(12);
      expect(result.tileCount).toBe(96);
    }
  });

  it("rejects a 320x240 chipset with an actionable message", () => {
    const result = validateResourceDimensions("chipset", 320, 240);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toBe("칩셋: 480x256 크기가 필요합니다. 현재 320x240입니다.");
  });
});
