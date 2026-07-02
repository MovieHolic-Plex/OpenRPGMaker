import { describe, expect, it } from "vitest";
import { RESOURCE_SLICING } from "@/assets/resourceSlicing";
import { RESOURCE_PROFILE_SPECS, validateResourceDimensions } from "@/project/resourceProfiles";

describe("RM2K3 resource profiles", () => {
  it("records slicing ontology for every resource profile kind", () => {
    for (const spec of RESOURCE_PROFILE_SPECS) {
      expect(spec.slicing).toBe(RESOURCE_SLICING[spec.kind]);
      if (spec.slicing.kind === "grid") {
        expect(spec.tileWidth).toBe(spec.slicing.cellWidth);
        expect(spec.tileHeight).toBe(spec.slicing.cellHeight);
      }
    }
  });

  it("records fixed pixel split units for grid-sliced RPG resources", () => {
    expect(RESOURCE_SLICING.chipset).toMatchObject({
      kind: "grid",
      unit: "tile",
      cellWidth: 16,
      cellHeight: 16,
      columns: 30,
      rows: 16,
      count: 480,
      sheetWidth: 480,
      sheetHeight: 256,
      subcell: { unit: "quarter-tile", cellWidth: 8, cellHeight: 8 },
    });
    expect(RESOURCE_SLICING.charset).toMatchObject({
      kind: "grid",
      unit: "charset-frame",
      cellWidth: 24,
      cellHeight: 32,
      columns: 12,
      rows: 8,
      count: 96,
    });
    expect(RESOURCE_SLICING.faceset).toMatchObject({
      kind: "grid",
      unit: "face",
      cellWidth: 48,
      cellHeight: 48,
      columns: 4,
      rows: 4,
      count: 16,
      sheetWidth: 192,
      sheetHeight: 192,
    });
    expect(RESOURCE_SLICING.battleWeapon).toMatchObject({
      kind: "grid",
      unit: "battle-weapon",
      cellWidth: 64,
      cellHeight: 64,
      columns: 3,
      rows: 8,
      count: 24,
      sheetWidth: 192,
      sheetHeight: 512,
    });
  });

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

  it("rejects a faceset that is not the ontology 192x192 sheet", () => {
    const result = validateResourceDimensions("faceset", 96, 96);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toBe("얼굴 그래픽: 192x192 크기가 필요합니다. 현재 96x96입니다.");
  });
});
