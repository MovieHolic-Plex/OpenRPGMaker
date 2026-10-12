import { describe, expect, it } from "vitest";
import {
  autotilePaintTile,
  classifyTerrainChip,
  paletteCatalogFor,
  paletteHasSmartCatalog,
  prefabChips,
  prefabThumbTiles,
  searchPaletteCatalog,
} from "@/editor/panels/tilePaletteCatalog";
import { createBeodeulCityTileset } from "@/project/defaults/beodeulCity";
import { createJoseonBaramTileset } from "@/project/defaults/joseonBaram";
import type { AutotileGroup, SectionStructureKitDef, TilesetDef } from "@/project/types";

function pass(count: number) {
  return Array.from({ length: count }, () => ({ up: true, down: true, left: true, right: true }));
}

function kit(partial: Pick<SectionStructureKitDef, "id" | "name" | "width" | "height" | "rows"> & {
  role?: "building" | "prop";
  themes?: string[];
  tags?: string[];
}): SectionStructureKitDef {
  return {
    id: partial.id,
    name: partial.name,
    kind: "section",
    width: partial.width,
    height: partial.height,
    rows: partial.rows,
    learnedFrom: "user-paint",
    ai: {
      description: partial.name ?? partial.id,
      placementRules: "",
      role: partial.role,
      themes: partial.themes,
      tags: partial.tags,
    },
  };
}

function roadGroup(): AutotileGroup {
  return {
    id: "dirt-road",
    name: "조선 흙길",
    memberTileIds: [1, 8],
    variantMap: { "0": 1, "255": 8 },
    layer: "lower",
  };
}

function fixture(): TilesetDef {
  const count = 16;
  return {
    id: "catalog-fixture",
    name: "합성",
    kind: "custom",
    image: { type: "bundled", id: "catalog-sheet" },
    tileSize: 16,
    count,
    tilesPerRow: 8,
    passability: pass(count),
    priority: Array.from({ length: count }, () => "lower"),
    terrain: Array(count).fill(0),
    tileMeta: [
      undefined,
      { label: "흙길 외곽" },
      undefined,
      { label: "연못" },
      { label: "기와 조각", tags: ["기와"] },
    ],
    autotileGroups: [roadGroup()],
    tileGroups: [
      {
        id: "pond",
        name: "연못",
        role: "water",
        defaultLayer: "lower",
        tileIds: [3],
        description: "",
        placementRules: "",
      },
      {
        id: "road-dup",
        name: "조선 흙길 (오토타일)",
        role: "terrain",
        defaultLayer: "lower",
        tileIds: [1, 8],
        description: "",
        placementRules: "",
      },
      {
        id: "house-group",
        name: "기와 묶음",
        role: "building",
        defaultLayer: "lower",
        tileIds: [4],
        description: "",
        placementRules: "",
      },
    ],
    structureKits: [
      kit({
        id: "giwa-house",
        name: "조선 기와집",
        width: 2,
        height: 2,
        rows: [{ tiles: [4, 5] }, { tiles: [4, 5] }],
        role: "building",
        themes: ["village", "마을"],
        tags: ["기와"],
      }),
    ],
  };
}

describe("tile palette catalog", () => {
  it("paints an autotile from the filled neighbor and files a dirt road under 길", () => {
    const group = roadGroup();
    expect(autotilePaintTile(group)).toBe(8);
    expect(classifyTerrainChip("조선 흙길", "dirt-road", "", [])).toBe("road");
    const road = paletteCatalogFor(fixture()).terrain.find((card) => card.autotileGroupId === "dirt-road");
    expect(road).toMatchObject({ kind: "autotile", chip: "road", paintTile: 8, name: "조선 흙길" });
  });

  it("drops a tile group that is already an autotile and keeps water and buildings searchable", () => {
    const catalog = paletteCatalogFor(fixture());
    expect(catalog.terrain.map((card) => card.name)).not.toContain("조선 흙길 (오토타일)");
    expect(catalog.terrain.map((card) => card.chip)).toContain("water");
    expect(catalog.otherGroups.map((card) => card.name)).toEqual(["기와 묶음"]);
  });

  it("ranks prefabs ahead of individual tiles and prefers Hangul theme chips", () => {
    const tileset = fixture();
    const found = searchPaletteCatalog(tileset, "기와");
    expect(found.prefabs.map((hit) => hit.kind === "prefab" ? hit.card.name : "")).toContain("조선 기와집");
    expect(found.tiles.map((hit) => hit.kind === "tile" ? hit.label : "")).toContain("기와 조각");
    expect(found.prefabTotal).toBeGreaterThan(0);
    expect(found.tileTotal).toBeGreaterThan(0);
    const chips = prefabChips(paletteCatalogFor(tileset).prefabs);
    expect(chips.map((chip) => chip.label)).toContain("마을");
    expect(chips.map((chip) => chip.label)).not.toContain("village");
  });

  it("samples a prefab mosaic in the kit's own column count", () => {
    const house = fixture().structureKits![0]!;
    expect(prefabThumbTiles(house, 16)).toEqual({ columns: 2, tiles: [4, 5, 4, 5] });
  });

  it("has no smart catalog when the tileset has no groups or kits", () => {
    const bare = fixture();
    bare.autotileGroups = [];
    bare.tileGroups = [];
    bare.structureKits = [];
    expect(paletteHasSmartCatalog(bare)).toBe(false);
  });

  it("builds joseon terrain from the real autotile body and skips the duplicate road group", () => {
    const tileset = createJoseonBaramTileset();
    const started = performance.now();
    const catalog = paletteCatalogFor(tileset);
    expect(performance.now() - started).toBeLessThan(1000);
    const road = tileset.autotileGroups?.find((group) => group.name === "조선 흙길");
    expect(road?.variantMap["255"]).toEqual(expect.any(Number));
    const card = catalog.terrain.find((item) => item.autotileGroupId === road?.id);
    expect(card).toMatchObject({ name: "조선 흙길", kind: "autotile", paintTile: road?.variantMap["255"] });
    expect(catalog.terrain.some((item) => item.name === "조선 흙길 (오토타일)")).toBe(false);
    const found = searchPaletteCatalog(tileset, "기와집");
    expect(found.prefabs.some((hit) => hit.kind === "prefab" && hit.card.name.includes("기와집"))).toBe(true);
  });

  it("builds beodeul prefabs and a named road card", () => {
    const catalog = paletteCatalogFor(createBeodeulCityTileset());
    expect(catalog.prefabs.length).toBeGreaterThan(100);
    expect(catalog.terrain.some((card) => card.name.includes("버들항 길"))).toBe(true);
  });
});
