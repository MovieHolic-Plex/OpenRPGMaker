import { describe, expect, it } from "vitest";
import { buildSystemPrompt } from "@/ai/contextBuilder";
import { lintTilesetPalettes } from "@/editor/lint/tilesetPaletteLint";
import { proposalSummaryLines } from "@/editor/panels/aiChatPanel";
import { runTool } from "@/editor/tools/toolRunner";
import type { ToolContext, ToolResult } from "@/editor/tools/types";
import { createBlankProject } from "@/project/defaults";
import { TILE } from "@/project/defaults/constants";
import { deserialize, serialize } from "@/project/io";
import type { GameMap, PalettePreset, Project, TileAiMetadata, TilesetDef } from "@/project/types";

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

function contextWithMap(width = 18, height = 18): { readonly ctx: ToolContext; readonly mapId: string; readonly tileset: TilesetDef } {
  const ctx: ToolContext = { project: createBlankProject() };
  const created = runTool(ctx, "create_map", { id: "map_palette_t1a", name: "Palette T1a", width, height });
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
  it("contextBuilder includes tile vocabulary digest with slot counts and low confidence count", () => {
    const project = projectWithGrid(1, 1, [1]);
    const tileset = startTileset(project);
    tileset.palettePresets = [preset({ name: "Cave", slots: [{ role: "ground", tileIds: [1, 2] }, { role: "wall", tileIds: [3] }] })];
    ensureMeta(tileset)[3] = { label: "Maybe wall", description: "", confidence: 0.4 };

    const prompt = buildSystemPrompt(project, { budgetChars: 20000 });

    expect(prompt).toContain("## 타일 어휘 다이제스트");
    expect(prompt).toContain("Cave");
    expect(prompt).toContain("ground:2");
    expect(prompt).toContain("낮은 신뢰(confidence<0.5) 타일 1개");
  });

  it("contextBuilder omits tile vocabulary digest when presets and approved groups are both absent", () => {
    const project = createBlankProject();
    // 번들 하네스 그룹은 source:bundled-default로 시드 승인되므로(2026-07-11), 다이제스트가
    // 진짜로 "보여줄 것이 없을 때" 생략되는지 검증하려면 그룹도 함께 비워야 한다.
    startTileset(project).tileGroups = [];

    const prompt = buildSystemPrompt(project, { budgetChars: 20000 });

    expect(prompt).not.toContain("## 타일 어휘 다이제스트");
  });

  it("contextBuilder includes tile vocabulary digest with approved group ids by role even without presets", () => {
    const project = createBlankProject();

    const prompt = buildSystemPrompt(project, { budgetChars: 20000 });

    expect(prompt).toContain("## 타일 어휘 다이제스트");
    expect(prompt).toMatch(/wall:/);
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

    const lines = proposalSummaryLines([{ name: "upsert_palette_preset", args: {}, summary: result.summary, result, destructive: false }]);

    expect(lines[0]).toContain("프리셋 1건");
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
    const first = contextWithMap(24, 24);
    const second = contextWithMap(24, 24);
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

  it("stamp_structure applies preset role tiles and replays with the same seed", () => {
    const first = contextWithMap(24, 24);
    const second = contextWithMap(24, 24);
    first.tileset.priority[61] = "upper";
    second.tileset.priority[61] = "upper";
    addToolPreset(first.tileset, [{ role: "roof", tileIds: [61] }]);
    addToolPreset(second.tileset, [{ role: "roof", tileIds: [61] }]);
    const args = { template: "plaster", origin: { x: 2, y: 2 }, presetId: "pp_tools", paletteRole: "roof", seed: 13 };

    const a = runTool(first.ctx, "stamp_structure", { mapId: first.mapId, ...args });
    const b = runTool(second.ctx, "stamp_structure", { mapId: second.mapId, ...args });

    expectOk(a);
    expectOk(b);
    expect(dataRecord<{ paletteTiles: number }>(a).paletteTiles).toBeGreaterThan(0);
    expect(mapOf(first.ctx, first.mapId).upperTiles).toEqual(mapOf(second.ctx, second.mapId).upperTiles);
    expect(mapOf(first.ctx, first.mapId).upperTiles).toContain(61);
  });
});
