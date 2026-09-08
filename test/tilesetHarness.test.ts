import { describe, expect, it } from "vitest";
import { createBlankMap, createBlankProject, DEFAULT_TILESET_ID, TILE } from "@/project/defaults";
import { lintCastleGrammar, stampCastle } from "@/editor/castleKit";
import { CHIPSET_TILE_GROUPS } from "@/project/defaults/chipsetMapping";
import { deserialize, serialize } from "@/project/io";
import { passageMarkForTile } from "@/project/tilesetPassage";
import { applyCombinedTownHarness, applyEasyRpgThemeMetadataPacks, COMBINED_TOWN_HARNESS_GROUPS, DUNGEON_HARNESS_PREFIX, harnessLayerForTile, INTERIOR_HARNESS_PREFIX, isHarnessStackableTile } from "@/project/tilesetHarness";
import type { TilesetDef } from "@/project/types";

describe("EasyRPG Combined Town tileset harness", () => {
  it("seeds the default Combined Town tileset with grouped metadata and grammars", () => {
    const tileset = createBlankProject().tilesets[DEFAULT_TILESET_ID];
    const roadGroup = tileset.tileGroups?.find((group) => group.id.endsWith("dirt-road-autotile"));
    const sandGroup = tileset.tileGroups?.find((group) => group.id.endsWith("sand-autotile"));
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
    expect(sandGroup).toMatchObject({
      defaultLayer: "lower",
      id: "harness-combined-town-sand-autotile",
      layerHome: "lower",
      name: "모래",
      patternGrammar: { kind: "autotile_3x3" },
      role: "terrain",
      source: "bundled-default",
    });
    expect(sandGroup?.tileIds).toEqual(CHIPSET_TILE_GROUPS.sandGround);
    expect(tileset.tileMeta?.[360]).toMatchObject({
      label: "흙길 중앙",
      description: "",
      repeatability: "auto",
      source: "bundled-default",
    });
    expect(roadGroup?.description.length).toBeGreaterThan(0);
  });

  it("tree canopies are upper ★ and trunks are lower solid for forest stacking", () => {
    const tileset = createBlankProject().tilesets[DEFAULT_TILESET_ID];
    // 수관: upper + 통행 가능 → ★
    expect(tileset.priority[260]).toBe("upper");
    expect(passageMarkForTile(tileset, 260)).toBe("star");
    expect(tileset.priority[262]).toBe("upper");
    expect(passageMarkForTile(tileset, 262)).toBe("star");
    // 밑동: lower + solid → 수관이 같은 칸 upper 에 겹침 가능
    expect(tileset.priority[290]).toBe("lower");
    expect(passageMarkForTile(tileset, 290)).toBe("x");
    expect(tileset.priority[292]).toBe("lower");
    expect(passageMarkForTile(tileset, 292)).toBe("x");
  });

  it("seeds conifer, dry tree, broadleaf, flower, and bush cluster rules by default", () => {
    const tileset = createBlankProject().tilesets[DEFAULT_TILESET_ID];
    const group = (suffix: string) => tileset.tileGroups?.find((entry) => entry.id.endsWith(suffix));

    expect(group("conifer-tree")?.rules).toEqual([
      expect.objectContaining({ kind: "adjacency", params: { a: 260, b: 290, relation: "aAboveB" }, strength: "hard" }),
    ]);
    // bAlt = "a 옆에 b 대신 와도 되는 대체 타일"(clusterRuleValidators.ts:121).
    // 마른나무는 상단(261)을 세로로 이어 쌓을 수 있어야 하므로 261 이 대체로 허용된다 —
    // 출하 코드에 원래부터 있던 것이고, 이 단정이 그걸 반영하지 못해 실패하고 있었다.
    expect(group("dry-tree")?.rules).toEqual([
      expect.objectContaining({ kind: "adjacency", params: { a: 261, b: 291, bAlt: [261], relation: "aAboveB" }, strength: "hard" }),
    ]);
    // 활엽수 2×2 는 **대각 겹침**(원자를 (+1,+1) 로 밀어 수관을 맞물리게 하는 것)을 허용한다.
    // 그래서 앞 원자의 우하(293) 자리에 다음 원자의 좌상(262)이 와도 되도록 두 규칙에 bAlt 를 준다.
    // 262 는 자기 규칙(오른쪽 263, 아래 292)을 그대로 지켜야 하므로 조각난 나무는 여전히 error 다.
    expect(group("broadleaf-tree-2x2")?.rules).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ params: { a: 262, b: 292, relation: "aAboveB" }, strength: "hard" }),
        expect.objectContaining({ params: { a: 263, b: 293, bAlt: [262], relation: "aAboveB" }, strength: "hard" }),
        expect.objectContaining({ params: { a: 262, b: 263, relation: "aLeftOfB" }, strength: "hard" }),
        expect.objectContaining({ params: { a: 292, b: 293, bAlt: [262], relation: "aLeftOfB" }, strength: "hard" }),
      ])
    );
    expect(group("flower-props")?.rules).toEqual([
      expect.objectContaining({ kind: "spacing", params: { minGap: 2 }, strength: "medium" }),
    ]);
    expect(group("bush-props")?.rules).toEqual([
      expect.objectContaining({ kind: "spacing", params: { minGap: 2 }, strength: "soft" }),
    ]);
    expect(group("bench-vertical")?.tileIds).toEqual([358, 388]);
    expect(group("bench-vertical")?.patternGrammar?.kind).toBe("vertical_expandable");
    expect(group("house-yard-props")?.tileIds).toEqual([349, 350, 351, 352]);
    expect(group("cemetery-props")?.tileIds).toEqual([323, 353, 383]);
    expect(group("table-horizontal")?.tileIds).toEqual([234, 235, 236]);
    expect(group("table-vertical")?.tileIds).toEqual([144, 174, 204]);
    expect(group("wood-floor-deck")?.tileIds).toEqual(CHIPSET_TILE_GROUPS.woodFloorBody);
    expect(group("wood-floor-deck")).toMatchObject({
      role: "terrain",
      defaultLayer: "lower",
      source: "bundled-default",
    });
    expect(group("timber-post-rail")?.tileIds).toEqual([...CHIPSET_TILE_GROUPS.timberPostStructureObjects]);
    expect(group("timber-post-rail")?.defaultLayer).toBe("lower");
    expect(tileset.priority[222]).toBe("lower");
    expect(passageMarkForTile(tileset, 222)).not.toBe("x");
    expect(passageMarkForTile(tileset, 223)).toBe("x");
    expect(tileset.tileMeta?.[222]?.label).toBe("나무 바닥 바디");
    expect(tileset.tileMeta?.[223]?.label).toBe("목조 난간 바디");
    expect(group("market-rail-upper")?.tileIds).toEqual([468, 469, 470]);
    expect(group("market-rail-upper")?.patternGrammar?.kind).toBe("horizontal_expandable");
    expect(group("stone-step-slab")?.tileIds).toEqual([268]);
    expect(tileset.priority[468]).toBe("upper");
    expect(tileset.priority[268]).toBe("upper");
    expect(passageMarkForTile(tileset, 468)).toBe("x");
    expect(passageMarkForTile(tileset, 268)).toBe("x");
    expect(tileset.tileMeta?.[468]?.label).toBe("장터 레일 좌");
    expect(tileset.tileMeta?.[268]?.label).toBe("돌단/석판");
    expect(group("wood-door")?.tileIds).toEqual([116, 146]);
    expect(group("stone-stairs")?.tileIds).toEqual([111, 112, 113]);
    expect(group("wall-ladder")?.tileIds).toEqual([322]);
    expect(tileset.tileMeta?.[358]?.label).toBe("세로 의자 상");
    expect(tileset.tileMeta?.[383]?.label).toBe("해골");
    expect(tileset.tileMeta?.[322]?.passage).toBe("passable");
    expect(tileset.priority[322]).toBe("upper");
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

  it("uses the canonical castle kit instead of retired free-assembly castle groups", () => {
    const tileset = createBlankProject().tilesets[DEFAULT_TILESET_ID];
    const ids = new Set((tileset.tileGroups ?? []).map((group) => group.id));
    for (const suffix of ["castle-roof-deck", "castle-wall-face", "castle-round-tower"]) {
      expect(ids.has(`harness-combined-town-${suffix}`)).toBe(false);
    }
    const map = createBlankMap("Castle contract", 48, 40);
    const result = stampCastle(map, { area: { x: 0, y: 0, w: 48, h: 40 } });
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(result.reason);
    expect(result.stats.roofCells).toBeGreaterThan(50);
    expect(result.stats.wallCells).toBeGreaterThan(20);
    expect(result.towers).toHaveLength(2);
    const checks = lintCastleGrammar(map, { area: result.area, towers: result.towers, gates: result.gateRecords });
    expect(checks.length).toBeGreaterThan(0);
    for (const check of checks) expect(check.pass, check.key).toBe(true);
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
