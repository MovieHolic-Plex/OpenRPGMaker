import { describe, expect, it } from "vitest";
import { createBlankProject, DEFAULT_TILESET_ID, TILE } from "@/project/defaults";
import { applyCombinedTownHarness, COMBINED_TOWN_HARNESS_GROUPS, harnessLayerForTile, isHarnessStackableTile } from "@/project/tilesetHarness";
import type { TilesetDef } from "@/project/types";

describe("EasyRPG Combined Town tileset harness", () => {
  it("seeds the default Combined Town tileset with grouped metadata and grammars", () => {
    const tileset = createBlankProject().tilesets[DEFAULT_TILESET_ID];
    const roadGroup = tileset.tileGroups?.find((group) => group.id.endsWith("dirt-road-autotile"));
    const waterGroup = tileset.tileGroups?.find((group) => group.id.endsWith("lake-water-autotile"));

    expect(roadGroup).toMatchObject({
      defaultLayer: "lower",
      patternGrammar: { kind: "autotile_3x3" },
      source: "bundled-default",
    });
    expect(waterGroup).toMatchObject({
      role: "water",
      patternGrammar: { kind: "animated_terrain" },
    });
    expect(tileset.tileMeta?.[360]).toMatchObject({
      label: "흙길 중앙",
      repeatability: "auto",
      source: "bundled-default",
    });
  });

  it("locks the Combined Town layer contract to lower building parts and upper roof overlays", () => {
    const tileset = createBlankProject().tilesets[DEFAULT_TILESET_ID];

    expect(harnessLayerForTile(tileset, 85)).toBe("lower");
    expect(harnessLayerForTile(tileset, 378)).toBe("lower");
    expect(harnessLayerForTile(tileset, 116)).toBe("lower");
    expect(harnessLayerForTile(tileset, 404)).toBe("lower");
    expect(harnessLayerForTile(tileset, 374)).toBe("upper");
    expect(tileset.priority[85]).toBe("lower");
    expect(tileset.priority[378]).toBe("lower");
    expect(tileset.priority[374]).toBe("upper");
    expect(tileset.passability[374]).toEqual({ up: true, down: true, left: true, right: true });
  });

  it("keeps uploaded or unknown tilesets from inheriting Combined Town number meaning", () => {
    const base = createBlankProject().tilesets[DEFAULT_TILESET_ID];
    const uploaded: TilesetDef = {
      ...structuredClone(base),
      id: "uploaded-town",
      image: { type: "uploaded", id: "custom-town" },
      tileMeta: undefined,
      tileGroups: undefined,
    };

    expect(applyCombinedTownHarness(uploaded)).toBe(false);
    expect(uploaded.tileMeta).toBeUndefined();
    expect(uploaded.tileGroups).toBeUndefined();
  });

  it("preserves user-locked values when re-seeding the harness", () => {
    const tileset = createBlankProject().tilesets[DEFAULT_TILESET_ID];
    tileset.tileMeta![85] = {
      label: "사용자 창문",
      description: "내가 확정한 창문",
      source: "user",
      userLocked: true,
    };

    applyCombinedTownHarness(tileset);
    expect(tileset.tileMeta?.[85]).toMatchObject({
      label: "사용자 창문",
      source: "user",
      userLocked: true,
    });
  });

  it("marks transparent object groups as stackable without forcing mixed props to one layer", () => {
    const tileset = createBlankProject().tilesets[DEFAULT_TILESET_ID];
    const harnessTileCount = new Set(COMBINED_TOWN_HARNESS_GROUPS.flatMap((group) => [...group.tileIds])).size;

    expect(harnessTileCount).toBeGreaterThan(40);
    expect(isHarnessStackableTile(tileset, 85)).toBe(true);
    expect(isHarnessStackableTile(tileset, 378)).toBe(true);
    expect(isHarnessStackableTile(tileset, TILE.TREE)).toBe(true);
    expect(harnessLayerForTile(tileset, TILE.TREE)).toBeNull();
  });
});
