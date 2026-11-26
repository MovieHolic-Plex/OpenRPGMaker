import { describe, expect, it, afterEach, beforeEach } from "vitest";
import { buildSystemPrompt, DEFAULT_BUDGET_CHARS } from "@/ai/contextBuilder";
import { lintTilesetPalettes } from "@/editor/lint/tilesetPaletteLint";
import { proposalSummaryLines } from "@/editor/panels/aiChatPanel";
import { proposalHumanSummaryLine } from "@/editor/panels/aiProposalSummary";
import { runTool } from "@/editor/tools/toolRunner";
import type { ToolContext, ToolResult } from "@/editor/tools/types";
import { createBlankProject } from "@/project/defaults";
import { COMBINED_TOWN_TILESET_ID, TILE } from "@/project/defaults/constants";
import { deserialize, serialize } from "@/project/io";
import { confidenceScore, confirmUserTileMetadata, tileMetaConfidence, tileMetaLocked, tileMetaOrigin } from "@/project/tilesetPalette";
import type { GameMap, PalettePreset, Project, TileAiMetadata, TilesetDef } from "@/project/types";
import { withRetiredEasyRpgTilesets } from "./support/retiredEasyRpgTilesets";
import { passageGlyph, setChipsetGridEditing } from "@/editor/panels/tilesetChipsetPreview";
import { renderTilesetEditor } from "@/editor/panels/tilesetSettingsDetails";
import { getTilesetPassagePaint, getTilesetSectionTab, setTilesetMetadataEditMode, setTilesetPassagePaint, setTilesetSectionTab } from "@/editor/panels/tilesetMetadataEditor";
import { createEditorModalDirtyCloseController } from "@/editor/panels/editorModalDirtyState";
import { closeTilesetMeaningDialog, closeTilesetTileContextMenu, openTilesetTileContextMenu } from "@/editor/panels/tilesetTileContextMenu";
import { setTileLayerOverride, userTileLayerOverride } from "@/editor/runtimeTileMetadata";
import { tileLayerHome, tileVisibleOnLayer } from "@/editor/tileLayerClassification";
import { combinedTownTileset as defaultTileset } from "@/project/defaults/defaultAssets";
import { applyCombinedTownHarness } from "@/project/tilesetHarness";
import { passageMarkForTile, setPassageMark } from "@/project/tilesetPassage";
import { store } from "@/project/store";
import { findByTestId, installFakeDom, type FakeElement } from "./fakeDom";
import { selectEyedropperTool, selectTileTool, setTileBrushSize } from "@/editor/panels/tileToolbar";
import { editorState } from "@/editor/editorState";
import { visibleItemCount } from "@/editor/panels/toolbarOverflow";
import { isolateTimers } from "./mergedTeardown";

describe("tilesetPaletteT1a", () => {
  isolateTimers();
  const EMPTY = TILE.EMPTY;
  function roundTrip(project: Project): Project {
    return deserialize(serialize(project));
  }
  function projectWithGrid(width: number, height: number, lower: readonly number[]): Project {
    const project = createBlankProject();
    const map = project.maps[project.startMapId];
    if (!map) throw new Error("missing start map");
    map.width = width;
    map.height = height;
    map.lowerTiles = [...lower];
    map.upperTiles = new Array(width * height).fill(EMPTY);
    project.startPos = { x: 0, y: 0 };
    const tileset = project.tilesets[map.tilesetId];
    if (!tileset) throw new Error("missing tileset");
    ensureMeta(tileset);
    setPassable(tileset, lower[0] ?? 0, true);
    return project;
  }
  function ensureMeta(tileset: TilesetDef): TileAiMetadata[] {
    tileset.tileMeta = Array.from({ length: tileset.count }, (_, tile) => tileset.tileMeta?.[tile] ?? { label: "", description: "" });
    return tileset.tileMeta;
  }
  function startTileset(project: Project): TilesetDef {
    const map = project.maps[project.startMapId];
    if (!map) throw new Error("missing start map");
    const tileset = project.tilesets[map.tilesetId];
    if (!tileset) throw new Error("missing tileset");
    return tileset;
  }
  function setPassable(tileset: TilesetDef, tile: number, passable: boolean): void {
    tileset.passability[tile] = { up: passable, down: passable, left: passable, right: passable };
    tileset.priority[tile] = "lower";
  }
  function preset(patch: Partial<PalettePreset> = {}): PalettePreset {
    return {
      id: "pp_village",
      name: "Forest Village",
      origin: "ai",
      slots: [
        { role: "ground", tileIds: [1, 2] },
        { role: "path", tileIds: [3] },
        { role: "wall", tileIds: [4] },
      ],
      ...patch,
    };
  }
  function contextWithMap(width = 18, height = 18, onRetiredCombinedTown = false): { readonly ctx: ToolContext; readonly mapId: string; readonly tileset: TilesetDef } {
    const ctx: ToolContext = { project: onRetiredCombinedTown ? withRetiredEasyRpgTilesets(createBlankProject()) : createBlankProject() };
    const created = runTool(ctx, "create_map", {
      id: "map_palette_t1a", name: "Palette T1a", width, height,
      ...(onRetiredCombinedTown ? { tilesetId: COMBINED_TOWN_TILESET_ID } : {}),
    });
    expect(created.ok, created.summary).toBe(true);
    const map = ctx.project.maps.map_palette_t1a;
    if (!map) throw new Error("missing test map");
    const tileset = ctx.project.tilesets[map.tilesetId];
    if (!tileset) throw new Error("missing tileset");
    ensureMeta(tileset);
    return { ctx, mapId: map.id, tileset };
  }
  function mapOf(ctx: ToolContext, mapId: string): GameMap {
    const map = ctx.project.maps[mapId];
    if (!map) throw new Error(`missing map ${mapId}`);
    return map;
  }
  function expectOk(result: ToolResult): void {
    expect(result.ok, result.summary).toBe(true);
  }
  function dataRecord<T>(result: ToolResult): T {
    if (!result.data || typeof result.data !== "object") throw new Error(`missing data: ${result.summary}`);
    return result.data as T;
  }
  function addToolPreset(tileset: TilesetDef, slots: PalettePreset["slots"]): void {
    tileset.palettePresets = [{ id: "pp_tools", name: "Tool Preset", origin: "ai", slots }];
  }
  describe("tileset palette T1a data model and guards", () => {
    it("normalizes confidence and compatibility provenance without changing legacy semantics", () => {
      expect(confidenceScore(0.42)).toBe(0.42);
      expect(confidenceScore("high")).toBe(1);
      expect(confidenceScore("medium")).toBe(0.65);
      expect(confidenceScore("low")).toBe(0.25);
      expect(tileMetaOrigin({ label: "", description: "", origin: "ai", source: "user" })).toBe("ai");
      expect(tileMetaOrigin({ label: "", description: "", source: "user" })).toBe("user");
      expect(tileMetaLocked({ label: "", description: "", locked: true })).toBe(true);
      expect(tileMetaLocked({ label: "", description: "", userLocked: true })).toBe(true);
    });

    it("distinguishes absent metadata from present unconfirmed metadata", () => {
      expect(tileMetaConfidence(undefined)).toBeNull();
      expect(tileMetaConfidence({ label: "", description: "" })).toBe(0.5);
      expect(tileMetaConfidence({ label: "", description: "", source: "user" })).toBe(1);
      expect(tileMetaConfidence({ label: "", description: "", confidence: 0.2, origin: "user" })).toBe(0.2);
    });

    it("marks user-confirmed metadata with canonical and compatibility fields", () => {
      const confirmed = confirmUserTileMetadata(
        { label: "Old", description: "description", role: "decor", source: "ai" },
        { label: "Confirmed" }
      );

      expect(confirmed).toEqual({
        label: "Confirmed",
        description: "description",
        role: "decor",
        confidence: 1,
        origin: "user",
        locked: true,
        source: "user",
        userLocked: true,
      });
    });

    it("legacy projects without palettePresets remain absent after roundtrip", () => {
      const project = createBlankProject();
      const before = startTileset(project).palettePresets;

      const restored = roundTrip(project);

      expect(before).toBeUndefined();
      expect(startTileset(restored).palettePresets).toBeUndefined();
    });

    it("palettePresets and numeric TileAiMetadata fields survive roundtrip", () => {
      const project = projectWithGrid(2, 1, [1, 2]);
      const tileset = startTileset(project);
      tileset.palettePresets = [preset({ slots: [{ role: "water", tileIds: [2], weight: 2 }] })];
      ensureMeta(tileset)[2] = { label: "Water", description: "lake", role: "water", confidence: 0.42, origin: "ai", locked: true };

      const restored = roundTrip(project);
      const restoredTileset = startTileset(restored);

      expect(restoredTileset.palettePresets).toEqual(tileset.palettePresets);
      expect(restoredTileset.tileMeta?.[2]).toMatchObject({ confidence: 0.42, origin: "ai", locked: true });
    });

    it("palette preset ids are normalized to pp_ during deserialize", () => {
      const project = projectWithGrid(1, 1, [1]);
      startTileset(project).palettePresets = [preset({ id: "forest", slots: [{ role: "ground", tileIds: [1] }] })];

      const restored = roundTrip(project);

      expect(startTileset(restored).palettePresets?.[0]?.id).toBe("pp_forest");
    });

    it("shape guard rejects invalid palette slot roles", () => {
      const project = projectWithGrid(1, 1, [1]);
      startTileset(project).palettePresets = [preset({ slots: [{ role: "bogus" as never, tileIds: [1] }] })];

      expect(() => roundTrip(project)).toThrow(/role invalid/);
    });

    it("shape guard rejects numeric confidence outside 0~1", () => {
      const project = projectWithGrid(1, 1, [1]);
      ensureMeta(startTileset(project))[1] = { label: "Bad", description: "", confidence: 1.5 };

      expect(() => roundTrip(project)).toThrow(/confidence/);
    });
  });
  describe("tileset palette lint T1a", () => {
    it("reports tile diversity and preset slot coverage", () => {
      const project = projectWithGrid(3, 1, [1, 2, 3]);
      startTileset(project).palettePresets = [preset({ slots: [{ role: "ground", tileIds: [1] }, { role: "path", tileIds: [9] }] })];

      const issues = lintTilesetPalettes(project);

      expect(issues).toContainEqual(expect.objectContaining({ code: "tileset-palette-diversity", severity: "info" }));
      expect(issues.find((issue) => issue.code === "tileset-palette-diversity")?.message).toContain("1/2");
    });

    it("does not report diversity when no presets exist", () => {
      const project = projectWithGrid(2, 1, [1, 2]);
      delete startTileset(project).palettePresets;

      expect(lintTilesetPalettes(project).some((issue) => issue.code === "tileset-palette-diversity")).toBe(false);
    });

    it("warns on incompatible water and furniture boundaries", () => {
      const project = projectWithGrid(2, 1, [5, 6]);
      const meta = ensureMeta(startTileset(project));
      meta[5] = { label: "Water", description: "", role: "water" };
      meta[6] = { label: "Chair", description: "", role: "furniture" };

      const issues = lintTilesetPalettes(project);

      expect(issues).toContainEqual(expect.objectContaining({ code: "tileset-palette-boundary", severity: "warning" }));
    });

    it("keeps compatible ground and path boundaries quiet", () => {
      const project = projectWithGrid(2, 1, [5, 6]);
      const meta = ensureMeta(startTileset(project));
      meta[5] = { label: "Grass", description: "", role: "ground" };
      meta[6] = { label: "Road", description: "", role: "path" };

      expect(lintTilesetPalettes(project).some((issue) => issue.code === "tileset-palette-boundary")).toBe(false);
    });

    it("keeps boundary lint quiet when metadata is missing", () => {
      const project = projectWithGrid(2, 1, [5, 6]);
      delete startTileset(project).tileMeta;

      expect(lintTilesetPalettes(project).some((issue) => issue.code === "tileset-palette-boundary")).toBe(false);
    });

    it("warns when a path role tile is blocked", () => {
      const project = projectWithGrid(1, 1, [7]);
      const tileset = startTileset(project);
      ensureMeta(tileset)[7] = { label: "Road", description: "", role: "path" };
      setPassable(tileset, 7, false);

      expect(lintTilesetPalettes(project)).toContainEqual(expect.objectContaining({ code: "tileset-palette-passage", severity: "warning" }));
    });

    it("does not warn when a path role tile is passable", () => {
      const project = projectWithGrid(1, 1, [7]);
      const tileset = startTileset(project);
      ensureMeta(tileset)[7] = { label: "Road", description: "", role: "path" };
      setPassable(tileset, 7, true);

      expect(lintTilesetPalettes(project).some((issue) => issue.code === "tileset-palette-passage")).toBe(false);
    });

    it("warns when a wall role tile is passable", () => {
      const project = projectWithGrid(1, 1, [8]);
      const tileset = startTileset(project);
      ensureMeta(tileset)[8] = { label: "Wall", description: "", role: "wall" };
      setPassable(tileset, 8, true);

      expect(lintTilesetPalettes(project)).toContainEqual(expect.objectContaining({ code: "tileset-palette-passage", severity: "warning" }));
    });

    it("does not warn when a wall role tile is blocked", () => {
      const project = projectWithGrid(1, 1, [8]);
      const tileset = startTileset(project);
      ensureMeta(tileset)[8] = { label: "Wall", description: "", role: "wall" };
      setPassable(tileset, 8, false);

      expect(lintTilesetPalettes(project).some((issue) => issue.code === "tileset-palette-passage")).toBe(false);
    });

    it("run_lint includes tileset palette lint issues", () => {
      const ctx: ToolContext = { project: projectWithGrid(1, 1, [7]) };
      const tileset = startTileset(ctx.project);
      ensureMeta(tileset)[7] = { label: "Road", description: "", role: "path" };
      setPassable(tileset, 7, false);

      const result = runTool(ctx, "run_lint", {});
      const data = result.data as { issues: Array<{ code: string }> };

      expectOk(result);
      expect(data.issues).toContainEqual(expect.objectContaining({ code: "tileset-palette-passage" }));
    });
  });
  describe("tileset palette AX tools T1a", () => {
    it("contextBuilder includes preset slot counts and query_tiles retains low confidence metadata", () => {
      const project = projectWithGrid(1, 1, [1]);
      const tileset = startTileset(project);
      tileset.palettePresets = [preset({ name: "Cave", slots: [{ role: "ground", tileIds: [1, 2] }, { role: "wall", tileIds: [3] }] })];
      ensureMeta(tileset)[3] = { label: "Maybe wall", description: "", confidence: 0.4 };

      // A 20,000-char budget no longer reaches the digest: the in-budget sections before it are longer now (digest appears from ~30,000).
      const prompt = buildSystemPrompt(project, { budgetChars: DEFAULT_BUDGET_CHARS });

      expect(prompt).toContain("## 타일 어휘 다이제스트");
      expect(prompt).toContain("Cave");
      expect(prompt).toContain("ground:2");
      const queried = runTool({ project }, "query_tiles", { presetId: "pp_village", role: "wall" });
      expectOk(queried);
      expect(queried.data).toMatchObject({ tiles: [expect.objectContaining({ tile: 3, confidenceScore: 0.4 })] });
    });

    it("contextBuilder omits tile vocabulary digest when presets and approved groups are both absent", () => {
      const project = createBlankProject();
      // 번들 하네스 그룹은 source:bundled-default로 시드 승인되므로(2026-07-11), 다이제스트가
      // 진짜로 "보여줄 것이 없을 때" 생략되는지 검증하려면 그룹도 함께 비워야 한다.
      startTileset(project).tileGroups = [];

      // Same budget as the positive cases, so an omission means "nothing to show", not "cut by the budget".
      const prompt = buildSystemPrompt(project, { budgetChars: DEFAULT_BUDGET_CHARS });

      expect(prompt).not.toContain("## 타일 어휘 다이제스트");
    });

    it("contextBuilder includes tile vocabulary digest with approved group ids by role even without presets", () => {
      const project = createBlankProject();

      const prompt = buildSystemPrompt(project, { budgetChars: DEFAULT_BUDGET_CHARS });

      expect(prompt).toContain("## 타일 어휘 다이제스트");
      // The default start tileset is beodeul_city now; its approved groups are listed by role (path/ground/water, no wall group).
      expect(prompt).toMatch(/^- ground: /m);
    });

    it("query_tiles filters by preset and role and returns tile details", () => {
      const ctx: ToolContext = { project: projectWithGrid(1, 1, [1]) };
      const tileset = startTileset(ctx.project);
      tileset.palettePresets = [preset({ slots: [{ role: "path", tileIds: [11] }] })];
      ensureMeta(tileset)[11] = { label: "Packed dirt", description: "road", role: "path", confidence: 0.8, origin: "ai" };
      setPassable(tileset, 11, true);

      const result = runTool(ctx, "query_tiles", { presetId: "village", role: "path" });
      const data = result.data as { tiles: Array<{ tile: number; label: string; passable: boolean; confidenceScore: number }> };

      expectOk(result);
      expect(data.tiles).toEqual([expect.objectContaining({ tile: 11, label: "Packed dirt", passable: true, confidenceScore: 0.8 })]);
    });

    it("query_tiles filters by metadata category", () => {
      const ctx: ToolContext = { project: projectWithGrid(1, 1, [1]) };
      const meta = ensureMeta(startTileset(ctx.project));
      meta[12] = { label: "Bed", description: "sleep" };
      (meta[12] as unknown as Record<string, unknown>).category = "indoor";

      const result = runTool(ctx, "query_tiles", { category: "indoor" });
      const data = result.data as { tiles: Array<{ tile: number; categories: string[] }> };

      expectOk(result);
      expect(data.tiles).toEqual([expect.objectContaining({ tile: 12, categories: expect.arrayContaining(["indoor"]) })]);
    });

    it("upsert_palette_preset creates pp_ ids and counts additions", () => {
      const ctx: ToolContext = { project: createBlankProject() };

      const result = runTool(ctx, "upsert_palette_preset", {
        preset: { name: "Forest", slots: [{ role: "ground", tileIds: [1, 2] }] },
      });

      expectOk(result);
      const saved = startTileset(ctx.project).palettePresets?.[0];
      expect(saved?.id.startsWith("pp_")).toBe(true);
      expect(saved?.origin).toBe("ai");
      expect(result.diff?.palettePresetsAdded).toBe(1);
    });

    it("upsert_palette_preset modifies existing presets and counts modifications", () => {
      const ctx: ToolContext = { project: createBlankProject() };
      startTileset(ctx.project).palettePresets = [preset({ id: "pp_keep", name: "Old", slots: [{ role: "ground", tileIds: [1] }] })];

      const result = runTool(ctx, "upsert_palette_preset", {
        preset: { id: "keep", name: "New" },
      });

      expectOk(result);
      expect(startTileset(ctx.project).palettePresets?.[0]?.name).toBe("New");
      expect(result.diff?.palettePresetsModified).toBe(1);
    });

    it("upsert_palette_preset rejects locked presets without mutation", () => {
      const ctx: ToolContext = { project: createBlankProject() };
      startTileset(ctx.project).palettePresets = [preset({ id: "pp_locked", locked: true, name: "Locked" })];
      const before = serialize(ctx.project);

      const result = runTool(ctx, "upsert_palette_preset", {
        preset: { id: "locked", name: "Changed" },
      });

      expect(result.ok).toBe(false);
      expect(result.issues?.[0]?.code).toBe("palette-preset-locked");
      expect(serialize(ctx.project)).toBe(before);
    });

    it("proposal summaries include palette preset counts", () => {
      const ctx: ToolContext = { project: createBlankProject() };
      const result = runTool(ctx, "upsert_palette_preset", {
        preset: { name: "Forest", slots: [{ role: "ground", tileIds: [1] }] },
      });

      const calls = [{ name: "upsert_palette_preset", args: {}, summary: result.summary, result, destructive: false }];
      const lines = proposalSummaryLines(calls);

      expect(result.diff?.palettePresetsAdded).toBe(1);
      expect(lines[0]).toBe(proposalHumanSummaryLine(calls));
    });
  });
  describe("tileset palette placement parameters T1a", () => {
    it("paint_road uses preset tiles deterministically", () => {
      const first = contextWithMap(12, 12);
      const second = contextWithMap(12, 12);
      addToolPreset(first.tileset, [{ role: "path", tileIds: [31, 32], weight: 1 }]);
      addToolPreset(second.tileset, [{ role: "path", tileIds: [31, 32], weight: 1 }]);

      const args = { points: [{ x: 1, y: 4 }, { x: 9, y: 4 }], presetId: "pp_tools", paletteRole: "path", naturalness: 0, seed: 99 };
      expectOk(runTool(first.ctx, "paint_road", { mapId: first.mapId, ...args }));
      expectOk(runTool(second.ctx, "paint_road", { mapId: second.mapId, ...args }));

      expect(mapOf(first.ctx, first.mapId).lowerTiles).toEqual(mapOf(second.ctx, second.mapId).lowerTiles);
      expect(mapOf(first.ctx, first.mapId).lowerTiles).toContain(31);
    });

    it("paint_road rejects missing preset slots", () => {
      const { ctx, mapId, tileset } = contextWithMap();
      addToolPreset(tileset, [{ role: "ground", tileIds: [1] }]);

      const result = runTool(ctx, "paint_road", {
        mapId,
        points: [{ x: 1, y: 1 }],
        presetId: "pp_tools",
        paletteRole: "path",
      });

      expect(result.ok).toBe(false);
      expect(result.issues?.[0]?.code).toBe("palette-slot-empty");
    });

    it("scatter_object uses preset tiles deterministically", () => {
      const first = contextWithMap(14, 14);
      const second = contextWithMap(14, 14);
      first.tileset.priority[41] = "upper";
      second.tileset.priority[41] = "upper";
      addToolPreset(first.tileset, [{ role: "decor", tileIds: [41] }]);
      addToolPreset(second.tileset, [{ role: "decor", tileIds: [41] }]);
      const args = { area: { x: 2, y: 2, w: 8, h: 8 }, count: 5, presetId: "pp_tools", paletteRole: "decor", seed: 7, avoidProtected: false };

      expectOk(runTool(first.ctx, "scatter_object", { mapId: first.mapId, ...args }));
      expectOk(runTool(second.ctx, "scatter_object", { mapId: second.mapId, ...args }));

      expect(mapOf(first.ctx, first.mapId).upperTiles).toEqual(mapOf(second.ctx, second.mapId).upperTiles);
      expect(mapOf(first.ctx, first.mapId).upperTiles.filter((tile) => tile === 41)).toHaveLength(5);
    });

    it("build_house applies preset role tiles and replays with the same seed", () => {
      // build_house stamps the combined-town house kit; on beodeul_city the preset wall tile lands elsewhere. Run on the retired sheet.
      const first = contextWithMap(24, 24, true);
      const second = contextWithMap(24, 24, true);
      addToolPreset(first.tileset, [{ role: "wall", tileIds: [51] }]);
      addToolPreset(second.tileset, [{ role: "wall", tileIds: [51] }]);
      const args = { origin: { x: 2, y: 2 }, width: 8, height: 8, material: "plaster", presetId: "pp_tools", paletteRole: "wall", seed: 11 };

      const a = runTool(first.ctx, "build_house", { mapId: first.mapId, ...args });
      const b = runTool(second.ctx, "build_house", { mapId: second.mapId, ...args });

      expectOk(a);
      expectOk(b);
      expect(dataRecord<{ paletteTiles: number }>(a).paletteTiles).toBeGreaterThan(0);
      expect(mapOf(first.ctx, first.mapId).lowerTiles).toEqual(mapOf(second.ctx, second.mapId).lowerTiles);
      expect(mapOf(first.ctx, first.mapId).lowerTiles).toContain(51);
    });

    // Removed it "stamp_structure applies preset role tiles": stamp_structure was removed from the tool registry on purpose.
  });
});

// 타일셋 섹션 3탭 재편 + 타일별 레이어 수동 지정 계약(2026-07-05).
// - DB 타일셋에서 레이어(자동/하위/상위)를 사용자 확정으로 지정할 수 있고, 로드 시 하네스가 덮지 않는다.
// - 통행/지형 편집도 user 메타로 기록되어 하네스 재적용에 살아남는다.
// - 지형 템플릿(교과서)은 구성 탭으로 이사했다.
describe("tilesetSectionTabs", () => {
  isolateTimers();
  const SLOPED_ROOF = 385;   // 투명 칩 — 자동 판정은 상위.
  const STRAIGHT_ROOF = 404;   // 불투명 — 자동 판정은 하위.

  // 아래 시험은 칸 DOM 격자(「칸 편집」)를 다룬다 — 기본 보기는 정적 시트다(qa1124-space PR6).
  beforeEach(() => setChipsetGridEditing(true));
  afterEach(() => setChipsetGridEditing(false));
  describe("타일 레이어 수동 지정(setTileLayerOverride)", () => {
    it("하위로 확정하면 userLocked 메타로 기록되고 하네스 재적용에도 유지된다", () => {
      const tileset = defaultTileset();
      expect(tileset.priority[SLOPED_ROOF]).toBe("upper"); // 자동 판정.

      setTileLayerOverride(tileset, SLOPED_ROOF, "lower");
      expect(tileset.priority[SLOPED_ROOF]).toBe("lower");
      expect(userTileLayerOverride(tileset, SLOPED_ROOF)).toBe("lower");
      expect(tileLayerHome(tileset, SLOPED_ROOF)).toBe("lower");
      expect(tileVisibleOnLayer(tileset, SLOPED_ROOF, "lower")).toBe(true);

      // 프로젝트 로드 시 돌아가는 하네스가 사용자 확정을 덮지 않는다.
      applyCombinedTownHarness(tileset);
      expect(tileset.priority[SLOPED_ROOF]).toBe("lower");
      expect(tileLayerHome(tileset, SLOPED_ROOF)).toBe("lower");
    });

    it("상위 확정은 하위 홈 타일(404)에도 적용된다", () => {
      const tileset = defaultTileset();
      setTileLayerOverride(tileset, STRAIGHT_ROOF, "upper");
      expect(tileLayerHome(tileset, STRAIGHT_ROOF)).toBe("upper");
      applyCombinedTownHarness(tileset);
      expect(tileset.priority[STRAIGHT_ROOF]).toBe("upper");
    });

    it("자동으로 되돌리면 하네스 판정(투명 칩=상위)으로 복귀한다", () => {
      const tileset = defaultTileset();
      if (!tileset.tileMeta) throw new Error("missing tile metadata");
      tileset.tileMeta[SLOPED_ROOF] = { label: "", description: "", source: "unknown" };
      setTileLayerOverride(tileset, SLOPED_ROOF, "lower");
      setTileLayerOverride(tileset, SLOPED_ROOF, "auto");
      expect(userTileLayerOverride(tileset, SLOPED_ROOF)).toBeNull();
      expect(tileset.tileMeta?.[SLOPED_ROOF]?.source).not.toBe("user");
      expect(tileset.tileMeta?.[SLOPED_ROOF]?.locked).toBeUndefined();
      expect(tileset.tileMeta?.[SLOPED_ROOF]?.origin).toBeUndefined();
      expect(tileset.tileMeta?.[SLOPED_ROOF]?.userLocked).toBeUndefined();
      expect(tileset.priority[SLOPED_ROOF]).toBe("upper");
      expect(tileLayerHome(tileset, SLOPED_ROOF)).toBe("upper");
    });

    it("자동 복귀 시 사용자 지식(라벨)은 지우지 않는다", () => {
      const tileset = defaultTileset();
      tileset.tileMeta![SLOPED_ROOF] = { label: "우리집 지붕", description: "", source: "user", userLocked: true };
      setTileLayerOverride(tileset, SLOPED_ROOF, "lower");
      setTileLayerOverride(tileset, SLOPED_ROOF, "auto");
      expect(tileset.tileMeta![SLOPED_ROOF].label).toBe("우리집 지붕");
      expect(tileset.tileMeta![SLOPED_ROOF].userLocked).toBe(true);
    });
  });
  describe("통행 편집의 레이어 보호", () => {
    it("번들 메타를 통행 편집으로 승격해도 defaultLayer가 사용자 확정으로 둔갑하지 않는다", async () => {
      const { markUserTileRuntimeMetadata } = await import("@/editor/runtimeTileMetadata");
      const tileset = defaultTileset();
      // roof-overlays 그룹 계약이 넣어둔 번들 defaultLayer:"upper"가 있는 상태에서 통행만 기록.
      expect(tileset.tileMeta![SLOPED_ROOF].defaultLayer).toBe("upper");
      markUserTileRuntimeMetadata(tileset, SLOPED_ROOF, { passage: "solid" });
      expect(tileset.tileMeta![SLOPED_ROOF].source).toBe("user");
      expect(tileset.tileMeta![SLOPED_ROOF].defaultLayer).toBeUndefined();
      expect(userTileLayerOverride(tileset, SLOPED_ROOF)).toBeNull(); // 레이어는 여전히 자동.
      // 이미 사용자 확정 레이어가 있으면 통행 편집이 그것을 지우지 않는다.
      setTileLayerOverride(tileset, SLOPED_ROOF, "lower");
      markUserTileRuntimeMetadata(tileset, SLOPED_ROOF, { passage: "passable" });
      expect(userTileLayerOverride(tileset, SLOPED_ROOF)).toBe("lower");
    });

    it("투명 칩에 O/X를 찍어도 priority는 상위를 유지한다", () => {
      const tileset = defaultTileset();
      setPassageMark(tileset, SLOPED_ROOF, "o");
      expect(tileset.priority[SLOPED_ROOF]).toBe("upper");
      setPassageMark(tileset, SLOPED_ROOF, "x");
      expect(tileset.priority[SLOPED_ROOF]).toBe("upper");
      // 불투명 타일은 기존대로 하위로 내려간다.
      setPassageMark(tileset, STRAIGHT_ROOF, "o");
      expect(tileset.priority[STRAIGHT_ROOF]).toBe("lower");
    });
  });
  describe("타일셋 섹션 UI", () => {
    let restoreDom: (() => void) | null = null;

    beforeEach(() => {
      store.replace(withRetiredEasyRpgTilesets(createBlankProject()));
      restoreDom = installFakeDom();
      setTilesetMetadataEditMode("passage", () => {}); // rules 탭으로 초기화.
    });

    afterEach(() => {
      restoreDom?.();
      restoreDom = null;
    });

    function renderEditor(): FakeElement {
      const tileset = store.getCurrent().tilesets[COMBINED_TOWN_TILESET_ID];
      return renderTilesetEditor(tileset, () => {}) as unknown as FakeElement;
    }

    it("참고문서와 설정을 포함한 5탭에서 규칙 탭에 레이어/통행 컨트롤이 있다", () => {
      const editor = renderEditor();
      expect(findByTestId(editor, "tileset-section-tab-references")).toBeTruthy();
      expect(findByTestId(editor, "tileset-section-tab-settings")).toBeTruthy();
      expect(findByTestId(editor, "tileset-section-tab-rules")).toBeTruthy();
      expect(findByTestId(editor, "tileset-section-tab-knowledge")).toBeTruthy();
      expect(findByTestId(editor, "tileset-section-tab-compose")).toBeTruthy();
      expect(findByTestId(editor, "tileset-rule-layer")).toBeTruthy();
      expect(findByTestId(editor, "tileset-rule-passage")).toBeTruthy();
      expect(findByTestId(editor, "tileset-passage-compass-details")?.getAttribute("open")).not.toBeNull();
      expect(findByTestId(editor, "tileset-tile-meaning-edit")).toBeNull();
      expect(findByTestId(editor, "tileset-field-ai-label")).toBeNull();
      expect(findByTestId(editor, "tileset-field-ai-description")).toBeNull();
      // 규칙 탭에는 AI 메타/그룹 모드 버튼이 노출되지 않는다 — 기능 분리.
      expect(findByTestId(editor, "tileset-edit-mode-ai")).toBeNull();
      expect(findByTestId(editor, "tileset-edit-mode-group")).toBeNull();
    });

    it("칩 우클릭 메뉴에서 의미 편집 대화상자를 연다", () => {
      openTilesetTileContextMenu({
        tilesetId: COMBINED_TOWN_TILESET_ID,
        tile: 350,
        clientX: 40,
        clientY: 40,
        rerender: () => {},
      });
      const menu = document.querySelector('[data-testid="tileset-tile-context-menu"]');
      expect(menu).toBeTruthy();
      const editBtn = document.querySelector('[data-testid="tileset-ctx-edit-meaning"]') as HTMLButtonElement | null;
      expect(editBtn).toBeTruthy();
      editBtn?.click();
      expect(document.querySelector('[data-testid="tileset-meaning-dialog"]')).toBeTruthy();
      expect(document.querySelector('[data-testid="tileset-meaning-dialog-label"]')).toBeTruthy();
      const label = document.querySelector('[data-testid="tileset-meaning-dialog-label"]') as HTMLInputElement;
      label.value = "우편함";
      label.dispatchEvent(new Event("input"));
      (document.querySelector('[data-testid="tileset-meaning-dialog-apply"]') as HTMLButtonElement)?.click();
      expect(store.getCurrent().tilesets[COMBINED_TOWN_TILESET_ID]?.tileMeta?.[350]?.label).toBe("우편함");
      expect(store.getCurrent().tilesets[COMBINED_TOWN_TILESET_ID]?.tileMeta?.[350]?.source).toBe("user");
      closeTilesetMeaningDialog();
      closeTilesetTileContextMenu();
    });

    it("Escape 는 타일 메뉴만 닫고 데이터베이스 모달은 닫지 않는다", () => {
      let closed = false;
      const controller = createEditorModalDirtyCloseController({
        isDirty: () => false,
        promptUnsavedChanges: () => "keep-editing" as const,
        save: () => {},
        discard: () => {},
        close: () => {
          closed = true;
        },
      });

      openTilesetTileContextMenu({
        tilesetId: COMBINED_TOWN_TILESET_ID,
        tile: 350,
        clientX: 20,
        clientY: 20,
        rerender: () => {},
      });
      expect(document.querySelector('[data-testid="tileset-tile-context-menu"]')).toBeTruthy();

      // 메뉴가 열려 있으면 DB 모달 close 금지 (nested 가드)
      controller.handleKeyDown({ key: "Escape", defaultPrevented: false } as Event);
      expect(closed).toBe(false);

      closeTilesetTileContextMenu();
      // 메뉴 닫힌 뒤에는 Escape 가 DB 를 닫을 수 있음
      controller.handleKeyDown({ key: "Escape", defaultPrevented: false } as Event);
      expect(closed).toBe(true);
    });

    it("기본 보기는 칸 DOM 없이 시트 그림·통행 덮개·선택 표시이고, 「칸 편집」 을 켜야 칸이 생긴다", () => {
      setChipsetGridEditing(false);
      const editor = renderEditor();
      expect(findByTestId(editor, "tileset-db-cell-0")).toBeNull();
      expect(findByTestId(editor, "tileset-passage-overlay")).toBeTruthy();
      expect(findByTestId(editor, "tileset-static-selection")).toBeTruthy();
      expect(findByTestId(editor, "tileset-grid-edit")).toBeTruthy();

      (findByTestId(editor, "tileset-grid-edit") as unknown as HTMLElement).click();
      expect(findByTestId(renderEditor(), "tileset-db-cell-0")).toBeTruthy();
    });

    it("칩셋 프리뷰에 레이어 필터·범례·셀 layer 속성이 있다", () => {
      const editor = renderEditor();
      expect(findByTestId(editor, "tileset-layer-filter")).toBeTruthy();
      expect(findByTestId(editor, "tileset-layer-filter-all")).toBeTruthy();
      expect(findByTestId(editor, "tileset-layer-filter-lower")).toBeTruthy();
      expect(findByTestId(editor, "tileset-layer-filter-upper")).toBeTruthy();
      expect(findByTestId(editor, "tileset-layer-legend")).toBeTruthy();
      expect(findByTestId(editor, "tileset-sheet-info")).toBeTruthy();
      expect(findByTestId(editor, "tileset-selected-layer-badge")).toBeTruthy();

      // 투명 칩 385 = 상위 홈. 셀 data-layer / class에 반영.
      const upperCell = findByTestId(editor, `tileset-db-cell-${SLOPED_ROOF}`) as unknown as {
        getAttribute?: (name: string) => string | null;
        className?: string;
      };
      expect(upperCell.getAttribute?.("data-layer") ?? (upperCell as { dataset?: { layer?: string } }).dataset?.layer).toBe("upper");
      const className = String(upperCell.className ?? "");
      expect(className).toContain("layer-upper");

      const lowerCell = findByTestId(editor, `tileset-db-cell-${STRAIGHT_ROOF}`) as unknown as {
        className?: string;
      };
      expect(String(lowerCell.className ?? "")).toContain("layer-lower");
    });

    it("레이어 버튼으로 하위 확정하면 store에 반영되고 투명 칩 경고가 뜬다", () => {
      let editor = renderEditor();
      // 칩셋 셀 클릭으로 385 선택(규칙 탭 클릭은 통행 토글도 겸한다).
      (findByTestId(editor, `tileset-db-cell-${SLOPED_ROOF}`) as unknown as HTMLElement).click();
      editor = renderEditor();
      (findByTestId(editor, "tileset-layer-lower") as unknown as HTMLElement).click();

      const tileset = store.getCurrent().tilesets[COMBINED_TOWN_TILESET_ID];
      expect(tileset.priority[SLOPED_ROOF]).toBe("lower");
      expect(userTileLayerOverride(tileset, SLOPED_ROOF)).toBe("lower");

      editor = renderEditor();
      expect(findByTestId(editor, "tileset-layer-warning")).toBeTruthy(); // 투명 칩 하위 경고.
    });

    it("지식 탭에서 설명 필드는 접힌 details 안에 있다", () => {
      setTilesetSectionTab("knowledge", () => {});
      const editor = renderEditor();
      expect(findByTestId(editor, "tileset-tile-meaning-details")).toBeTruthy();
      expect(findByTestId(editor, "tileset-field-ai-description")).toBeTruthy();
      expect(findByTestId(editor, "tileset-selected-usage")).toBeNull();
      setTilesetMetadataEditMode("passage", () => {});
    });

    // 통과 칸도 글리프를 가진다. 예전에는 통과가 "글자 없음"이라 어두운 칩 위에서
    // 「통과」와 「글리프가 안 보임」을 구별할 수 없었다.
    it("통행 붓은 클릭한 칸에 고른 규칙을 칠하고 통과 칸에도 표시가 남는다", () => {
      setTilesetPassagePaint("x");
      let editor = renderEditor();
      expect(getTilesetPassagePaint()).toBe("x");
      const open = findByTestId(editor, "tileset-passage-open") as unknown as HTMLElement;
      const blocked = findByTestId(editor, "tileset-passage-blocked") as unknown as HTMLElement;
      const star = findByTestId(editor, "tileset-passage-star") as unknown as HTMLElement;
      expect(open).toBeTruthy();
      expect(blocked).toBeTruthy();
      expect(star).toBeTruthy();

      const tilesetId = COMBINED_TOWN_TILESET_ID;
      expect(passageMarkForTile(store.getCurrent().tilesets[tilesetId]!, 0)).toBe("x");
      setTilesetPassagePaint("o");
      editor = renderEditor();
      (findByTestId(editor, "tileset-db-cell-0") as unknown as HTMLElement).click();
      expect(passageMarkForTile(store.getCurrent().tilesets[tilesetId]!, 0)).toBe("o");
      editor = renderEditor();
      const cell = findByTestId(editor, "tileset-db-cell-0") as unknown as { textContent?: string };
      expect(String(cell.textContent ?? "")).toBe(passageGlyph("o"));

      setTilesetPassagePaint("x");
      editor = renderEditor();
      (findByTestId(editor, "tileset-db-cell-0") as unknown as HTMLElement).click();
      expect(passageMarkForTile(store.getCurrent().tilesets[tilesetId]!, 0)).toBe("x");
      setTilesetPassagePaint("o");
    });

    it("구성 탭에는 오토타일 섹션만 렌더된다", () => {
      setTilesetSectionTab("compose", () => {});
      const editor = renderEditor();
      expect(getTilesetSectionTab()).toBe("compose");
      expect(findByTestId(editor, "tileset-autotile-editor")).toBeTruthy();
      expect(findByTestId(editor, "tileset-autotile-toolbar")).toBeTruthy();
      expect(findByTestId(editor, "tileset-autotile-layout-cells-9")).toBeTruthy();
      expect(findByTestId(editor, "tileset-autotile-layout-cells-11")).toBeTruthy();
      expect(findByTestId(editor, "tileset-autotile-layout-custom")).toBeTruthy();
      expect(findByTestId(editor, "tileset-autotile-hint")).toBeTruthy();
      expect(findByTestId(editor, "tileset-selected-tile-panel")).toBeNull();
      expect(findByTestId(editor, "terrain-template-section")).toBeNull();
      expect(findByTestId(editor, "tileset-side-pane-toggle")).toBeNull();
      setTilesetMetadataEditMode("passage", () => {}); // 다른 테스트를 위해 복귀.
    });
  });
});

describe("tileToolbar", () => {
  isolateTimers();
  describe("RPG Maker tile toolbar actions", () => {
    beforeEach(() => {
      const project = createBlankProject();
      store.replace(project);
      editorState.set({
        activePaletteStamp: null,
        currentMapId: project.startMapId,
        layer: "lower",
        paintShape: "pen",
        selection: null,
        tool: "paint",
      });
    });

    it("switches between pen, rectangle, round, fill, and erase painting modes", () => {
      selectTileTool("rect");
      expect(editorState.get().tool).toBe("paint");
      expect(editorState.get().paintShape).toBe("rect");

      selectTileTool("round");
      expect(editorState.get().tool).toBe("paint");
      expect(editorState.get().paintShape).toBe("round");

      selectTileTool("pen");
      expect(editorState.get().tool).toBe("paint");
      expect(editorState.get().paintShape).toBe("pen");

      selectTileTool("fill");
      expect(editorState.get().tool).toBe("fill");
      expect(editorState.get().paintShape).toBe("pen");

      selectTileTool("erase");
      expect(editorState.get().tool).toBe("erase");
      expect(editorState.get().paintShape).toBe("pen");
    });

    it("moves tile tools off the event layer", () => {
      editorState.set({
        layer: "event",
        tool: "event",
      });

      selectTileTool("rect");

      const state = editorState.get();
      expect(state.layer).toBe("lower");
      expect(state.tool).toBe("paint");
      expect(state.paintShape).toBe("rect");
    });

    it("keeps an existing region only while the select tool is active", () => {
      const project = store.getCurrent();
      const selection = { mapId: project.startMapId, x: 2, y: 3, width: 4, height: 5 };
      editorState.set({ selection });

      selectTileTool("select");
      expect(editorState.get().tool).toBe("select");
      expect(editorState.get().selection).toEqual(selection);

      selectTileTool("pen");
      expect(editorState.get().selection).toBeNull();
    });

    it("moves brush size into toolbar state", () => {
      setTileBrushSize(3);

      expect(editorState.get().brushSize).toBe(3);
    });

    it("selects eyedropper from the folded inspector options", () => {
      editorState.set({
        layer: "event",
        tool: "event",
      });

      selectEyedropperTool();

      const state = editorState.get();
      expect(state.layer).toBe("lower");
      expect(state.paintShape).toBe("pen");
      expect(state.selection).toBeNull();
      expect(state.tool).toBe("eyedropper");
    });
  });
});

describe("toolbarOverflow", () => {
  isolateTimers();
  describe("visibleItemCount", () => {
    it("전부 들어가면 전체 개수를 돌려준다", () => {
      expect(visibleItemCount(400, [50, 50, 50], 30, 4)).toBe(3);
    });

    it("넘치면 ⋯ 버튼 폭을 남기고 최대 개수", () => {
      // 50*4 + gap*3 = 212 > 150 → ⋯(30)+gap 확보 후 들어가는 만큼
      expect(visibleItemCount(150, [50, 50, 50, 50], 30, 4)).toBe(2);
    });

    it("아무것도 안 들어가면 0", () => {
      expect(visibleItemCount(20, [50, 50], 30, 4)).toBe(0);
    });
  });
});
