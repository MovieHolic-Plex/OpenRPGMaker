import { describe, expect, it } from "vitest";
import { createBlankProject, COMBINED_TOWN_TILESET_ID, TILE } from "@/project/defaults";
import { tileLayerHome } from "@/editor/tileLayerClassification";
import { CHIPSET_TILE_GROUPS } from "@/project/defaults/chipsetMapping";
import { deserialize, serialize } from "@/project/io";
import { passageMarkForTile } from "@/project/tilesetPassage";
import { applyCombinedTownHarness, applyEasyRpgThemeMetadataPacks, COMBINED_TOWN_HARNESS_GROUPS, DUNGEON_HARNESS_PREFIX, harnessLayerForTile, INTERIOR_HARNESS_PREFIX, isHarnessStackableTile } from "@/project/tilesetHarness";
import type { TilesetDef } from "@/project/types";
import { withRetiredEasyRpgTilesets, retiredEasyRpgTileset } from "./support/retiredEasyRpgTilesets";
import { createNewProjectSeed } from "@/editor/genrePacks";
import { newProjectChoiceById } from "@/editor/newProjectChoices";
import { runTool } from "@/editor/tools/toolRunner";
import { eligibleEncounterEntries } from "@/player/encounters";
import { canMove } from "@/project/collision";
import { startSession } from "@/project/session";
import { defaultTilesets, ensureBundledTilesets } from "@/project/defaults/defaultAssets";
import { worldTileDescription } from "@/project/defaults/worldTileDescriptions";
import { CHIPSET_LABEL_CORRECTIONS } from "@/project/defaults/chipsetLabelCorrections";
import { resolveMaterialByLabel } from "@/project/tileVocabulary";
import { isolateTimers } from "./mergedTeardown";

describe("tilesetHarness", () => {
  isolateTimers();
  describe("EasyRPG Combined Town tileset harness", () => {
    it("seeds the default Combined Town tileset with grouped metadata and grammars", () => {
      const tileset = withRetiredEasyRpgTilesets(createBlankProject()).tilesets[COMBINED_TOWN_TILESET_ID];
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
      const tileset = withRetiredEasyRpgTilesets(createBlankProject()).tilesets[COMBINED_TOWN_TILESET_ID];
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
      const tileset = withRetiredEasyRpgTilesets(createBlankProject()).tilesets[COMBINED_TOWN_TILESET_ID];
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
      const tileset = withRetiredEasyRpgTilesets(createBlankProject()).tilesets[COMBINED_TOWN_TILESET_ID];
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
      const tileset = withRetiredEasyRpgTilesets(createBlankProject()).tilesets[COMBINED_TOWN_TILESET_ID];
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
      const project = withRetiredEasyRpgTilesets(createBlankProject());
      const tileset = project.tilesets[COMBINED_TOWN_TILESET_ID];
      const groupId = COMBINED_TOWN_HARNESS_GROUPS[0]?.id;
      if (!groupId) throw new Error("missing harness group");
      tileset.tileGroups = tileset.tileGroups?.filter((group) => group.id !== groupId);
      tileset.suppressedHarnessGroupIds = [groupId];

      const restored = deserialize(serialize(project));
      applyCombinedTownHarness(restored.tilesets[COMBINED_TOWN_TILESET_ID]);

      expect(restored.tilesets[COMBINED_TOWN_TILESET_ID].tileGroups?.some((group) => group.id === groupId)).toBe(false);
      expect(restored.tilesets[COMBINED_TOWN_TILESET_ID].suppressedHarnessGroupIds).toEqual([groupId]);
    });

    it("locks the Combined Town layer contract: roof body 374–377 lower, transparent caps 384–387 upper", () => {
      const tileset = withRetiredEasyRpgTilesets(createBlankProject()).tilesets[COMBINED_TOWN_TILESET_ID];

      expect(harnessLayerForTile(tileset, 85)).toBe("lower");
      expect(harnessLayerForTile(tileset, 378)).toBe("lower");
      expect(harnessLayerForTile(tileset, 116)).toBe("lower");
      expect(harnessLayerForTile(tileset, 404)).toBe("lower");
      // 사선 지붕 몸체는 불투명 지붕 본체 — 하위(houseKit 2026-07-17 교정 정본).
      // 예전엔 roof-overlays 그룹이 전부 상위로 묶었다.
      for (const tile of [374, 375, 376, 377]) {
        expect(harnessLayerForTile(tileset, tile), `harness ${tile}`).toBe("lower");
        expect(tileset.priority[tile], `priority ${tile}`).toBe("lower");
        expect(tileLayerHome(tileset, tile), `home ${tile}`).toBe("lower");
      }
      // 투명 마감 캡만 상위 오버레이.
      for (const tile of [384, 385, 386, 387]) {
        expect(harnessLayerForTile(tileset, tile), `harness ${tile}`).toBe("upper");
        expect(tileset.priority[tile], `priority ${tile}`).toBe("upper");
        expect(tileLayerHome(tileset, tile), `home ${tile}`).toBe("upper");
      }
      const body = tileset.tileGroups?.find((group) => group.id.endsWith("roof-body"));
      expect(body).toMatchObject({ role: "roof", defaultLayer: "lower" });
      expect(body?.tileIds).toEqual([374, 375, 376, 377]);
      const caps = tileset.tileGroups?.find((group) => group.id.endsWith("roof-overlays"));
      expect(caps?.tileIds).toEqual([384, 385, 386, 387]);
      // 창문(85)/울타리(378)는 그룹 계약이 lower여도 투명 칩이라 런타임 priority는 upper로 승격된다.
      expect(tileset.priority[85]).toBe("upper");
      expect(tileset.priority[378]).toBe("upper");
      expect(tileset.passability[374]).toEqual({ up: false, down: false, left: false, right: false });
    });

    it("keeps uploaded or unknown tilesets from inheriting Combined Town number meaning", () => {
      const base = withRetiredEasyRpgTilesets(createBlankProject()).tilesets[COMBINED_TOWN_TILESET_ID];
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
      const base = withRetiredEasyRpgTilesets(createBlankProject()).tilesets[COMBINED_TOWN_TILESET_ID];
      const uploaded: TilesetDef = {
        ...structuredClone(base),
        id: COMBINED_TOWN_TILESET_ID,
        image: { type: "uploaded", id: "custom-town" },
        tileMeta: undefined,
        tileGroups: undefined,
      };

      expect(applyCombinedTownHarness(uploaded)).toBe(false);
      expect(uploaded.tileMeta).toBeUndefined();
      expect(uploaded.tileGroups).toBeUndefined();
    });

    it("preserves user-locked values when re-seeding the harness", () => {
      const tileset = withRetiredEasyRpgTilesets(createBlankProject()).tilesets[COMBINED_TOWN_TILESET_ID];
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
      const tileset = withRetiredEasyRpgTilesets(createBlankProject()).tilesets[COMBINED_TOWN_TILESET_ID];
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
      const tileset = withRetiredEasyRpgTilesets(createBlankProject()).tilesets[COMBINED_TOWN_TILESET_ID];
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
      const project = withRetiredEasyRpgTilesets(createBlankProject());
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
      const interior = withRetiredEasyRpgTilesets(createBlankProject()).tilesets.easyrpg_chipset_interior;

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
      const base = withRetiredEasyRpgTilesets(createBlankProject()).tilesets.easyrpg_chipset_dungeon;
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

    it("preserves existing group records and IDs, including ambiguous bundled prefix records", () => {
      const tileset = withRetiredEasyRpgTilesets(createBlankProject()).tilesets.easyrpg_chipset_dungeon;
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
      expect(tileset.tileGroups?.some((group) => group.id === `${DUNGEON_HARNESS_PREFIX}old`)).toBe(true);
      expect(tileset.tileGroups?.some((group) => group.id === `${DUNGEON_HARNESS_PREFIX}floor`)).toBe(true);
      expect(tileset.tileGroups?.some((group) => group.id === `${DUNGEON_HARNESS_PREFIX}user-collision`)).toBe(true);
      expect(tileset.tileGroups?.some((group) => group.name === "User Floor Collision")).toBe(true);
      expect(tileset.tileGroups?.some((group) => group.name === "Existing Preserved Collision")).toBe(true);
      expect(new Set(tileset.tileGroups?.map((group) => group.id)).size).toBe(tileset.tileGroups?.length);
    });

    it("preserves source:user and userLocked tile metadata while applying runtime contracts", () => {
      const tileset = withRetiredEasyRpgTilesets(createBlankProject()).tilesets.easyrpg_chipset_interior;
      tileset.tileMeta![270] = { label: "내 바닥", description: "사용자 확정", source: "user", confidence: "high", passage: "passable" };
      tileset.tileMeta![1] = { label: "잠근 벽", description: "잠금", source: "bundled-default", confidence: "high", userLocked: true, passage: "solid" };

      applyEasyRpgThemeMetadataPacks(tileset);

      expect(tileset.tileMeta?.[270]).toMatchObject({ label: "내 바닥", source: "user" });
      expect(tileset.tileMeta?.[1]).toMatchObject({ label: "잠근 벽", userLocked: true });
      expect(tileset.passability[270]).toEqual({ up: true, down: true, left: true, right: true });
      expect(tileset.passability[1]).toEqual({ up: false, down: false, left: false, right: false });
    });
  });
});

describe("wildRouteTool", () => {
  isolateTimers();
  function monsterProject() {
    const choice = newProjectChoiceById("monster-collect")!;
    const project = createNewProjectSeed(choice.packId, "도로 시험");
    const troopId = project.database.troops[0]!.id;
    return { context: { project }, troopId };
  }
  describe("author_wild_route", () => {
    it("lays a road, forest and tall-grass patches whose encounters only fire inside the grass", () => {
      const { context, troopId } = monsterProject();
      const created = runTool(context, "create_map", { id: "map_route_1", name: "1번 도로", width: 28, height: 22 });
      expect(created.ok, created.summary).toBe(true);
      const result = runTool(context, "author_wild_route", {
        mapId: "map_route_1", exits: [{ x: 14, y: 21 }, { x: 14, y: 0 }], grassPatches: 3, encounters: [{ troopId, weight: 5 }],
      });
      expect(result.ok, result.summary).toBe(true);
      const map = context.project.maps.map_route_1!;
      const data = result.data as { grassPatches: { id: string; x: number; y: number; w: number; h: number }[]; trainerSpots: unknown[] };
      expect(data.grassPatches.length).toBeGreaterThanOrEqual(2);
      expect(result.warnings ?? []).not.toContainEqual(expect.stringContaining("이어지지 않습니다"));
      expect(map.lowerTiles.filter(tile => tile !== TILE.GRASS).length).toBeGreaterThan(40);
      expect(map.upperTiles.some(tile => tile !== TILE.EMPTY)).toBe(true);
      expect(map.encounterTable?.every(entry => entry.conditions?.locationId?.startsWith("loc_wild_grass_"))).toBe(true);
      const session = startSession(context.project);
      const patch = data.grassPatches[0]!;
      expect(eligibleEncounterEntries(map, session, { x: patch.x, y: patch.y })).not.toHaveLength(0);
      expect(eligibleEncounterEntries(map, session, { x: 14, y: 21 })).toHaveLength(0);
    });

    it("refuses to repaint an authored map without replace", () => {
      const { context } = monsterProject();
      // 몬스터 프로젝트의 시작 맵은 monster_overworld(#2232)라 도로 시공 대상이 아니다 — 시공 가능한 새 맵에서 본다.
      expect(runTool(context, "create_map", { id: "map_route_1", name: "1번 도로", width: 28, height: 22 }).ok).toBe(true);
      const map = context.project.maps.map_route_1!;
      map.upperTiles[0] = 5;
      const result = runTool(context, "author_wild_route", { mapId: "map_route_1", exits: [{ x: 0, y: 1 }, { x: map.width - 1, y: 1 }] });
      expect(result.ok).toBe(false);
      expect(result.summary).toContain("replace:true");
    });

    // 2026-09-24 포켓몬풍 r3: 동굴 파이프라인이 먼저 만든 링크 문(1,1)이 author_wild_route(replace)의
    // 숲 우물에 갇혀 autoplay 가 1번 도로 → 동굴 문으로 못 넘어갔다(check.txt 막힘). 시공은 기존
    // transfer 문까지 흙길로 이어야 한다.
    it("keeps a pre-existing transfer door walk-connected when repainting", () => {
      const { context, troopId } = monsterProject();
      const created = runTool(context, "create_map", { id: "map_route_1", name: "1번 도로", width: 28, height: 22 });
      expect(created.ok, created.summary).toBe(true);
      const targetMap = context.project.startMapId;
      const door = runTool(context, "upsert_event", {
        mapId: "map_route_1",
        event: {
          id: "ev_map_route_1_link", x: 1, y: 1,
          pages: [{ trigger: { kind: "playerTouch" }, conditions: [], priority: "below", overlapForbidden: false, commands: [{ kind: "transfer", mapId: targetMap, x: 1, y: 1 }] }],
        },
      });
      expect(door.ok, door.summary).toBe(true);
      const result = runTool(context, "author_wild_route", {
        mapId: "map_route_1", exits: [{ x: 14, y: 21 }, { x: 14, y: 0 }], grassPatches: 3, encounters: [{ troopId, weight: 5 }],
      });
      expect(result.ok, result.summary).toBe(true);
      expect(result.warnings ?? []).not.toContainEqual(expect.stringContaining("이어지지 않습니다"));

      // 남쪽 출구 (14,21) 에서 문 (1,1) 까지 실제로 걸어 닿는지 BFS 로 확인한다.
      const map = context.project.maps.map_route_1!;
      const seen = new Set<number>([21 * map.width + 14]);
      const queue: Array<{ x: number; y: number }> = [{ x: 14, y: 21 }];
      for (let i = 0; i < queue.length; i++) {
        const p = queue[i]!;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
          const nx = p.x + dx, ny = p.y + dy, key = ny * map.width + nx;
          if (nx < 0 || ny < 0 || nx >= map.width || ny >= map.height || seen.has(key)) continue;
          if (!canMove(context.project, map, p.x, p.y, nx, ny)) continue;
          seen.add(key); queue.push({ x: nx, y: ny });
        }
      }
      expect(seen.has(1 * map.width + 1)).toBe(true);
    });
  });
  describe("monster-collect brief prompt", () => {
    // #2232: 새 수집 게임은 build_monster_game(mode:create)이 검토된 캠페인 전체(도로 풀숲·트레이너 포함)를 짓는다.
    it("names the campaign builder so its schema is exposed on the first turn", async () => {
      const { buildWelcomeGenrePresetPrompt, welcomeGenrePresetById } = await import("@/editor/welcomeGenrePresets");
      const preset = welcomeGenrePresetById("monster-collect")!;
      const prompt = buildWelcomeGenrePresetPrompt(preset, {
        version: 1, presetId: "monster-collect", summary: "첫 체육관까지",
        answers: { scope: { question: "범위", label: "첫 제작 범위", text: "첫 도전장", source: "user" } },
      } as never);
      expect(prompt).toContain("build_monster_game");
    });
  });
});

describe("worldTileDescriptions", () => {
  isolateTimers();
  const WORLD_ID = "easyrpg_chipset_world";
  const WORLD_TEXTURE = "tex_easyrpg_chipset_world";
  const BLANK_SLOTS = [233, 258];
  const tileset = () => retiredEasyRpgTileset(WORLD_ID);
  const descriptions = (ts: TilesetDef) => ts.tileMeta!.map(meta => meta.description);
  function clearDescriptions(ts: TilesetDef): void {
    for (const meta of ts.tileMeta!) meta.description = "";
  }
  function withoutDescriptions(ts: TilesetDef): TilesetDef {
    const result = structuredClone(ts);
    clearDescriptions(result);
    return result;
  }
  describe("World tile descriptions", () => {
    it("documents every one of the 478 drawn slots and leaves the two blank slots empty", () => {
      const described: number[] = [];
      const empty: number[] = [];
      for (let tile = 0; tile < 480; tile++) {
        const description = worldTileDescription(tile);
        if (description.trim()) {
          described.push(tile);
          expect(description, `tile ${tile}`).toMatch(/[가-힣]/);
        } else {
          empty.push(tile);
        }
      }
      expect(described).toHaveLength(478);
      expect(empty).toEqual(BLANK_SLOTS);
      for (const tile of [-1, 480, 900]) expect(worldTileDescription(tile)).toBe("");
    });

    it("fills legacy World descriptions without changing any other metadata or runtime flag", () => {
      const ts = tileset();
      clearDescriptions(ts);
      const before = withoutDescriptions(ts);
      expect(applyEasyRpgThemeMetadataPacks(ts)).toBe(true);
      const corrected = new Map(CHIPSET_LABEL_CORRECTIONS
        .filter(entry => entry.textureKey === WORLD_TEXTURE)
        .map(entry => [entry.index, entry.description]));
      expect(descriptions(ts)).toEqual(Array.from({ length: 480 }, (_, tile) => corrected.get(tile) ?? worldTileDescription(tile)));
      expect(withoutDescriptions(ts)).toEqual(before);
      expect(applyEasyRpgThemeMetadataPacks(ts)).toBe(false);
    });

    it.each([
      { name: "피아노", tiles: [417, 418, 419], layout: "[417,418,419]" },
      { name: "파이프오르간", tiles: [444, 445, 474, 475], layout: "[444,445] / [474,475]" },
      { name: "큰 붉은 왕좌", tiles: [447, 448, 449, 477, 478, 479], layout: "[447,448,449] / [477,478,479]" },
    ])("describes the complete $name assembly without rewriting older semantic labels", ({ name, tiles, layout }) => {
      const ts = tileset();
      const labels = tiles.map(tile => ts.tileMeta![tile]!.label);
      for (const tile of tiles) ts.tileMeta![tile]!.description = "";
      applyEasyRpgThemeMetadataPacks(ts);
      for (const tile of tiles) {
        expect(ts.tileMeta![tile]!.description, `tile ${tile}`).toContain(name);
        expect(ts.tileMeta![tile]!.description, `tile ${tile}`).toContain(layout);
      }
      expect(tiles.map(tile => ts.tileMeta![tile]!.label)).toEqual(labels);
    });

    it("preserves existing nonempty World prose even when metadata is not user locked", () => {
      const ts = tileset();
      ts.tileMeta![67]!.description = "  마을 입구에서만 쓰는 흙길입니다.  ";
      ts.tileMeta![262] = { ...ts.tileMeta![262]!, source: "ai", description: "여울 마을의 작은 여관입니다." };
      const expected = [67, 262].map(tile => ts.tileMeta![tile]!.description);
      applyEasyRpgThemeMetadataPacks(ts);
      expect([67, 262].map(tile => ts.tileMeta![tile]!.description)).toEqual(expected);
      expect(applyEasyRpgThemeMetadataPacks(ts)).toBe(false);
    });

    it("preserves complete user-authored and locked metadata, including deliberately empty descriptions", () => {
      const ts = tileset();
      ts.tileMeta![67] = {
        label: "사용자가 정한 길", description: "", source: "user", tags: ["개인 지도"],
        role: "prop", defaultLayer: "upper", passage: "star", confidence: "low",
      };
      ts.tileMeta![120] = {
        label: "잠근 바다", description: "수정하지 않는 바다 설명", source: "ai", userLocked: true,
        tags: ["잠금"], role: "prop", defaultLayer: "upper", passage: "passable", repeatability: "fixed",
      };
      for (const tile of [67, 120]) {
        ts.priority[tile] = "upper";
        ts.passability[tile] = { up: true, down: false, left: true, right: false };
      }
      const authored = () => [67, 120].map(tile => ({
        meta: ts.tileMeta![tile], priority: ts.priority[tile], passability: ts.passability[tile],
      }));
      const before = structuredClone(authored());
      applyEasyRpgThemeMetadataPacks(ts);
      expect(authored()).toEqual(before);
      expect(applyEasyRpgThemeMetadataPacks(ts)).toBe(false);
    });

    it("does not attach original artwork descriptions to grafted slots and preserves their existing prose", () => {
      const ts = tileset();
      ts.tileMeta![67]!.description = "";
      ts.tileMeta![262]!.description = "";
      ts.tileMeta![120]!.description = "바다 자리에 이식한 집 그림입니다.";
      ts.tileGrafts = [67, 120, 262].map(targetTile => ({ targetTile, sourceChipset: WORLD_TEXTURE, sourceTile: 292 }));
      const before = withoutDescriptions(ts);
      applyEasyRpgThemeMetadataPacks(ts);
      expect([67, 120, 262].map(tile => ts.tileMeta![tile]!.description)).toEqual(["", "바다 자리에 이식한 집 그림입니다.", ""]);
      expect(withoutDescriptions(ts)).toEqual(before);
      expect(applyEasyRpgThemeMetadataPacks(ts)).toBe(false);
      delete ts.tileGrafts;
      expect(applyEasyRpgThemeMetadataPacks(ts)).toBe(true);
      expect(ts.tileMeta![67]!.description).toBe(worldTileDescription(67));
      expect(ts.tileMeta![262]!.description).toBe(worldTileDescription(262));
      expect(ts.tileMeta![120]!.description).toBe("바다 자리에 이식한 집 그림입니다.");
    });

    it("does not introduce World prose into other bundled chipsets or an uploaded atlas with the same ID", () => {
      for (const ts of Object.values(defaultTilesets())) {
        if (ts.id === WORLD_ID) continue;
        const before = structuredClone(ts);
        applyEasyRpgThemeMetadataPacks(ts);
        expect(ts, ts.id).toEqual(before);
      }
      const uploaded = tileset();
      uploaded.image = { type: "uploaded", id: WORLD_TEXTURE };
      clearDescriptions(uploaded);
      const before = structuredClone(uploaded);
      expect(applyEasyRpgThemeMetadataPacks(uploaded)).toBe(false);
      expect(uploaded).toEqual(before);
    });

    it("fills legacy prose during load-time ensure and preserves it through later save/load cycles", () => {
      const project = withRetiredEasyRpgTilesets(createBlankProject());
      const ts = project.tilesets[WORLD_ID]!;
      clearDescriptions(ts);
      ts.tileMeta![262]!.description = "저장한 여울 마을 설명";
      ts.tileMeta![67] = { ...ts.tileMeta![67]!, source: "user", description: "" };
      ts.tileMeta![120] = { ...ts.tileMeta![120]!, userLocked: true, description: "잠근 바다 설명" };
      ts.tileGrafts = [{ targetTile: 292, sourceChipset: WORLD_TEXTURE, sourceTile: 262 }];
      const loaded = deserialize(serialize(project));
      // ProjectStore runs this after deserialization; parsing alone does not seed defaults.
      ensureBundledTilesets(loaded);
      const loadedTs = loaded.tilesets[WORLD_ID]!;
      expect(loadedTs.tileMeta![0]!.description).toBe(worldTileDescription(0));
      expect([67, 120, 262, 292].map(tile => loadedTs.tileMeta![tile]!.description))
        .toEqual(["", "잠근 바다 설명", "저장한 여울 마을 설명", ""]);
      expect(loadedTs.tileGrafts).toEqual(ts.tileGrafts);
      const before = structuredClone(loadedTs);
      ensureBundledTilesets(loaded);
      expect(loadedTs).toEqual(before);
      expect(applyEasyRpgThemeMetadataPacks(loadedTs)).toBe(false);
      const reloaded = deserialize(serialize(loaded));
      ensureBundledTilesets(reloaded);
      const reloadedTs = reloaded.tilesets[WORLD_ID]!;
      expect(reloadedTs.tileMeta).toEqual(loadedTs.tileMeta);
      expect(reloadedTs.tileGrafts).toEqual(loadedTs.tileGrafts);
      expect(applyEasyRpgThemeMetadataPacks(reloadedTs)).toBe(false);
    });

    it("resolves a World material by its seeded description without a label or tag match", () => {
      const ts = tileset();
      const description = ts.tileMeta![417]!.description;
      expect(description).not.toBe("");
      ts.tileMeta![417]!.label = "";
      ts.tileMeta![417]!.tags = [];
      const result = resolveMaterialByLabel(ts, description, { preferGroup: false });
      expect(result).toMatchObject({ kind: "tile", tileId: 417, matchedLabel: "", matchedDescription: description });
      expect(result.status).not.toBe("missing");
      ts.tileMeta![417]!.description = "";
      expect(resolveMaterialByLabel(ts, description, { preferGroup: false })).not.toMatchObject({ kind: "tile", tileId: 417 });
    });
  });
});
