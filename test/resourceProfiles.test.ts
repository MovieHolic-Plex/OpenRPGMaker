import { describe, expect, it } from "vitest";
import { FACE_IMAGE_SIZE, RESOURCE_SLICING } from "@/assets/resourceSlicing";
import { RESOURCE_PROFILE_SPECS, validateResourceDimensions } from "@/project/resourceProfiles";
import { RESOURCE_SLICING as CATALOG_RESOURCE_SLICING } from "../scripts/supabase-resource-root/catalog.mjs";

describe("RM2K3 resource profiles", () => {
  it("keeps the supabase catalog slicing mirror byte-identical to the source of truth", () => {
    // scripts/supabase-resource-root/catalog.mjs hand-copies RESOURCE_SLICING because it runs
    // as a standalone .mjs with no TS build. Nothing enforced the copy, so battleCharset gained
    // columns/rows/count on the TS side while the mirror kept only cellWidth/cellHeight.
    expect(CATALOG_RESOURCE_SLICING).toEqual(RESOURCE_SLICING);
  });

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
    // battleWeapon 과 같은 3x8 이다. 이 선언이 없으면 imageSpec 이 expectedWidth/Height 를
    // 못 만들고, 런타임이 144x384 를 전제하는데도 아무 48 배수 시트가 import 를 통과한다.
    expect(RESOURCE_SLICING.battleCharset).toMatchObject({
      kind: "grid",
      unit: "battle-character",
      cellWidth: 48,
      cellHeight: 48,
      columns: 3,
      rows: 8,
      count: 24,
      sheetWidth: 144,
      sheetHeight: 384,
    });
  });

  it("accepts a 144x384 battle charset as 48x48 frames", () => {
    const result = validateResourceDimensions("battleCharset", 144, 384);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.tilesPerRow).toBe(3);
      expect(result.tileCount).toBe(24);
    }
  });

  it("rejects a battle charset that is not 144x384", () => {
    // Break caught: battleCharset was the only grid resource without a declared sheet size,
    // so a 144x192 sheet imported cleanly and then rendered wrong — battleFieldDom sizes the
    // background as (frame*3)x(frame*8) and cannot adapt. chipset/charset/battleWeapon all
    // already pin their sheet size; this closes the gap.
    const result = validateResourceDimensions("battleCharset", 144, 192);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toBe("전투 캐릭터셋: 144x384 크기가 필요합니다. 현재 144x192입니다.");
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

  it("treats a faceset as one whole 48x48 image", () => {
    expect(RESOURCE_SLICING.faceset).toEqual({ kind: "whole-image", unit: "image" });
    expect(FACE_IMAGE_SIZE).toBe(48);

    const result = validateResourceDimensions("faceset", FACE_IMAGE_SIZE, FACE_IMAGE_SIZE);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.tileCount).toBe(1);
      expect(result.tilesPerRow).toBe(1);
    }
  });

  it("still accepts the legacy 48-multiple square sheets left on disk", () => {
    const sheet = validateResourceDimensions("faceset", 192, 192);
    expect(sheet.ok).toBe(true);
    if (sheet.ok) {
      expect(sheet.tilesPerRow).toBe(4);
      expect(sheet.tileCount).toBe(16);
    }
  });

  it("rejects a faceset that is neither a 48x48 face nor a 48-multiple square", () => {
    const result = validateResourceDimensions("faceset", 96, 48);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toBe("얼굴 그래픽: 48x48 얼굴 한 장이 필요합니다. 현재 96x48입니다.");
  });
});
