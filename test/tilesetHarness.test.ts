import { describe, expect, it } from "vitest";
import { createBlankProject, DEFAULT_TILESET_ID, TILE } from "@/project/defaults";
import { deserialize, serialize } from "@/project/io";
import { applyCombinedTownHarness, applyEasyRpgThemeMetadataPacks, COMBINED_TOWN_HARNESS_GROUPS, DUNGEON_HARNESS_PREFIX, harnessLayerForTile, INTERIOR_HARNESS_PREFIX, isHarnessStackableTile } from "@/project/tilesetHarness";
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

  it("seeds conifer, dry tree, broadleaf, flower, and bush cluster rules by default", () => {
    const tileset = createBlankProject().tilesets[DEFAULT_TILESET_ID];
    const group = (suffix: string) => tileset.tileGroups?.find((entry) => entry.id.endsWith(suffix));

    expect(group("conifer-tree")?.rules).toEqual([
      expect.objectContaining({ kind: "adjacency", params: { a: 260, b: 290, relation: "aAboveB" }, strength: "hard" }),
    ]);
    expect(group("dry-tree")?.rules).toEqual([
      expect.objectContaining({ kind: "adjacency", params: { a: 261, b: 291, relation: "aAboveB" }, strength: "hard" }),
    ]);
    expect(group("broadleaf-tree-2x2")?.rules).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ params: { a: 262, b: 292, relation: "aAboveB" }, strength: "hard" }),
        expect.objectContaining({ params: { a: 263, b: 293, relation: "aAboveB" }, strength: "hard" }),
        expect.objectContaining({ params: { a: 262, b: 263, relation: "aLeftOfB" }, strength: "hard" }),
        expect.objectContaining({ params: { a: 292, b: 293, relation: "aLeftOfB" }, strength: "hard" }),
      ])
    );
    expect(group("flower-props")?.rules).toEqual([
      expect.objectContaining({ kind: "spacing", params: { minGap: 2 }, strength: "medium" }),
    ]);
    expect(group("bush-props")?.rules).toEqual([
      expect.objectContaining({ kind: "spacing", params: { minGap: 2 }, strength: "soft" }),
    ]);
  });

  it("does not overwrite existing rules when the Combined Town harness is re-applied", () => {
    const tileset = createBlankProject().tilesets[DEFAULT_TILESET_ID];
    const conifer = tileset.tileGroups?.find((group) => group.id.endsWith("conifer-tree"));
    if (!conifer) throw new Error("missing conifer group");
    conifer.rules = [{ id: "user-rule", kind: "count", params: { max: 7 }, strength: "soft", message: "사용자 규칙" }];
    conifer.tileIds = [260];
    conifer.patternGrammar = { kind: "single", parts: [{ role: "center", tileIds: [260] }], preserveCaps: true, repeat: "source_order" };

    applyCombinedTownHarness(tileset);

    const reseeded = tileset.tileGroups?.find((group) => group.id === conifer.id);
    expect(reseeded?.rules).toEqual([{ id: "user-rule", kind: "count", params: { max: 7 }, strength: "soft", message: "사용자 규칙" }]);
    expect(reseeded?.tileIds).toEqual([260]);
    expect(reseeded?.patternGrammar).toEqual({ kind: "single", parts: [{ role: "center", tileIds: [260] }], preserveCaps: true, repeat: "source_order" });
  });

  it("seeds missing default rules without resetting user-edited group layout", () => {
    const tileset = createBlankProject().tilesets[DEFAULT_TILESET_ID];
    const conifer = tileset.tileGroups?.find((group) => group.id.endsWith("conifer-tree"));
    if (!conifer) throw new Error("missing conifer group");
    conifer.rules = undefined;
    conifer.tileIds = [260];
    conifer.patternGrammar = { kind: "single", parts: [{ role: "center", tileIds: [260] }], preserveCaps: true, repeat: "source_order" };

    applyCombinedTownHarness(tileset);

    const reseeded = tileset.tileGroups?.find((group) => group.id === conifer.id);
    expect(reseeded?.tileIds).toEqual([260]);
    expect(reseeded?.patternGrammar?.kind).toBe("single");
    expect(reseeded?.rules).toEqual([
      expect.objectContaining({ kind: "adjacency", params: { a: 260, b: 290, relation: "aAboveB" }, strength: "hard" }),
    ]);
  });

  it("keeps tombstoned Combined Town harness groups deleted across serialization and re-apply", () => {
    const project = createBlankProject();
    const tileset = project.tilesets[DEFAULT_TILESET_ID];
    const groupId = COMBINED_TOWN_HARNESS_GROUPS[0]?.id;
    if (!groupId) throw new Error("missing harness group");
    tileset.tileGroups = tileset.tileGroups?.filter((group) => group.id !== groupId);
    tileset.suppressedHarnessGroupIds = [groupId];

    const restored = deserialize(serialize(project));
    applyCombinedTownHarness(restored.tilesets[DEFAULT_TILESET_ID]);

    expect(restored.tilesets[DEFAULT_TILESET_ID].tileGroups?.some((group) => group.id === groupId)).toBe(false);
    expect(restored.tilesets[DEFAULT_TILESET_ID].suppressedHarnessGroupIds).toEqual([groupId]);
  });

  it("locks the Combined Town layer contract to lower building parts and upper roof overlays", () => {
    const tileset = createBlankProject().tilesets[DEFAULT_TILESET_ID];

    expect(harnessLayerForTile(tileset, 85)).toBe("lower");
    expect(harnessLayerForTile(tileset, 378)).toBe("lower");
    expect(harnessLayerForTile(tileset, 116)).toBe("lower");
    expect(harnessLayerForTile(tileset, 404)).toBe("lower");
    expect(harnessLayerForTile(tileset, 374)).toBe("upper");
    // 창문(85)/울타리(378)는 그룹 계약이 lower여도 투명 칩이라 런타임 priority는 upper로 승격된다.
    expect(tileset.priority[85]).toBe("upper");
    expect(tileset.priority[378]).toBe("upper");
    expect(tileset.priority[374]).toBe("upper");
    expect(tileset.passability[374]).toEqual({ up: false, down: false, left: false, right: false });
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

  it("rejects uploaded Combined Town id collisions", () => {
    const base = createBlankProject().tilesets[DEFAULT_TILESET_ID];
    const uploaded: TilesetDef = {
      ...structuredClone(base),
      id: DEFAULT_TILESET_ID,
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

  it("preserves user-edited runtime passage and terrain when re-seeding the harness", () => {
    const tileset = createBlankProject().tilesets[DEFAULT_TILESET_ID];
    tileset.passability[374] = { up: false, down: false, left: false, right: false };
    tileset.terrain[374] = 9;
    tileset.tileMeta![374] = {
      ...(tileset.tileMeta?.[374] ?? { label: "", description: "" }),
      passage: "solid",
      terrainTag: 9,
      source: "user",
      userLocked: true,
    };

    applyCombinedTownHarness(tileset);

    expect(tileset.passability[374]).toEqual({ up: false, down: false, left: false, right: false });
    expect(tileset.terrain[374]).toBe(9);
    expect(tileset.tileMeta?.[374]).toMatchObject({ passage: "solid", terrainTag: 9, source: "user", userLocked: true });
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

describe("EasyRPG theme metadata packs", () => {
  it("seeds exact-match dungeon and interior packs in default tilesets", () => {
    const project = createBlankProject();
    const dungeon = project.tilesets.easyrpg_chipset_dungeon;
    const interior = project.tilesets.easyrpg_chipset_interior;

    expect(dungeon.tileGroups?.some((group) => group.id.startsWith(DUNGEON_HARNESS_PREFIX))).toBe(true);
    expect(interior.tileGroups?.some((group) => group.id.startsWith(INTERIOR_HARNESS_PREFIX))).toBe(true);
    expect(dungeon.tileMeta?.[270]).toMatchObject({ source: "bundled-default", confidence: "high", passage: "passable" });
    expect(dungeon.tileMeta?.[1]).toMatchObject({ source: "bundled-default", confidence: "high", passage: "solid" });
    expect(interior.tileMeta?.[270]).toMatchObject({ source: "bundled-default", confidence: "high", passage: "passable" });
    expect(interior.tileMeta?.[1]).toMatchObject({ source: "bundled-default", confidence: "high", passage: "solid" });
  });

  it("routes transparent-background interior furniture to the upper layer", () => {
    const interior = createBlankProject().tilesets.easyrpg_chipset_interior;

    expect(harnessLayerForTile(interior, 115)).toBe("upper");
    expect(harnessLayerForTile(interior, 268)).toBe("upper");
    expect(interior.priority[115]).toBe("upper");
    expect(interior.priority[268]).toBe("upper");
    expect(interior.tileMeta?.[115]).toMatchObject({
      defaultLayer: "upper",
      role: "prop",
      source: "bundled-default",
    });
    expect(interior.tileMeta?.[268]).toMatchObject({
      defaultLayer: "upper",
      role: "prop",
      source: "bundled-default",
    });
  });

  it("applies packs only to exact bundled texture ids", () => {
    const base = createBlankProject().tilesets.easyrpg_chipset_dungeon;
    const uploaded: TilesetDef = {
      ...structuredClone(base),
      id: "uploaded-dungeon",
      image: { type: "uploaded", id: "tex_easyrpg_chipset_dungeon" },
      tileMeta: undefined,
      tileGroups: undefined,
    };

    expect(applyEasyRpgThemeMetadataPacks(uploaded)).toBe(false);
    expect(uploaded.tileMeta).toBeUndefined();
    expect(uploaded.tileGroups).toBeUndefined();
  });

  it("replaces only pack-owned groups and preserves unrelated groups", () => {
    const tileset = createBlankProject().tilesets.easyrpg_chipset_dungeon;
    tileset.tileGroups = [
      ...(tileset.tileGroups ?? []),
      { id: "user-custom-group", name: "User Group", role: "terrain", defaultLayer: "lower", tileIds: [12], description: "", placementRules: "", source: "user", confidence: "high" },
      { id: `${DUNGEON_HARNESS_PREFIX}old`, name: "Old Pack Group", role: "terrain", defaultLayer: "lower", tileIds: [13], description: "", placementRules: "", source: "bundled-default", confidence: "high" },
      { id: `${DUNGEON_HARNESS_PREFIX}user-collision`, name: "User Prefix Collision", role: "terrain", defaultLayer: "lower", tileIds: [14], description: "", placementRules: "", source: "user", confidence: "high" },
      { id: `${DUNGEON_HARNESS_PREFIX}floor`, name: "User Floor Collision", role: "terrain", defaultLayer: "lower", tileIds: [15], description: "", placementRules: "", source: "user", confidence: "high" },
      { id: `${DUNGEON_HARNESS_PREFIX}floor-user-preserved`, name: "Existing Preserved Collision", role: "terrain", defaultLayer: "lower", tileIds: [16], description: "", placementRules: "", source: "user", confidence: "high" },
    ];

    applyEasyRpgThemeMetadataPacks(tileset);

    expect(tileset.tileGroups?.some((group) => group.id === "user-custom-group")).toBe(true);
    expect(tileset.tileGroups?.some((group) => group.id === `${DUNGEON_HARNESS_PREFIX}old`)).toBe(false);
    expect(tileset.tileGroups?.some((group) => group.id === `${DUNGEON_HARNESS_PREFIX}floor`)).toBe(true);
    expect(tileset.tileGroups?.some((group) => group.id === `${DUNGEON_HARNESS_PREFIX}user-collision`)).toBe(true);
    expect(tileset.tileGroups?.some((group) => group.name === "User Floor Collision")).toBe(true);
    expect(tileset.tileGroups?.some((group) => group.name === "Existing Preserved Collision")).toBe(true);
    expect(new Set(tileset.tileGroups?.map((group) => group.id)).size).toBe(tileset.tileGroups?.length);
  });

  it("preserves source:user and userLocked tile metadata while applying runtime contracts", () => {
    const tileset = createBlankProject().tilesets.easyrpg_chipset_interior;
    tileset.tileMeta![270] = { label: "내 바닥", description: "사용자 확정", source: "user", confidence: "high", passage: "passable" };
    tileset.tileMeta![1] = { label: "잠근 벽", description: "잠금", source: "bundled-default", confidence: "high", userLocked: true, passage: "solid" };

    applyEasyRpgThemeMetadataPacks(tileset);

    expect(tileset.tileMeta?.[270]).toMatchObject({ label: "내 바닥", source: "user" });
    expect(tileset.tileMeta?.[1]).toMatchObject({ label: "잠근 벽", userLocked: true });
    expect(tileset.passability[270]).toEqual({ up: true, down: true, left: true, right: true });
    expect(tileset.passability[1]).toEqual({ up: false, down: false, left: false, right: false });
  });
});
