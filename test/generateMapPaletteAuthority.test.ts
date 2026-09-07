import { describe, expect, it } from "vitest";
import { createEmptyToolProject } from "@/editor/tools/emptyProject";
import { runTool } from "@/editor/tools/toolRunner";
import { MAP_GEN_TOOLS } from "@/editor/tools/generateMapTool";
import { MAP_GENERATION_PROFILES } from "@/editor/tools/mapGenerationProfiles";
import { markUserTileRuntimeMetadata, setTileLayerOverride } from "@/editor/runtimeTileMetadata";
import { ensureBundledTilesets } from "@/project/defaults/defaultAssets";
import { DEFAULT_TILESET_ID } from "@/project/defaults/constants";
import { deserialize, serialize, serializeForComparison } from "@/project/io";
import { blockedFlag, passableFlag } from "@/project/tilesetPassage";
import { checkReachability } from "@/project/lint/reachability";
import { isPassable } from "@/project/collision";
import type { Project, TilesetDef } from "@/project/types";

// Round10 terminal-harness.audit[192], copied as a minimal offline regression input.
const capturedArgs = { name: "지하실", theme: "cave", id: "map_cellar",
  entrance: { y: 8, x: 1 }, pois: [{ x: 9, y: 2 }], border: "wall", height: 10, width: 12 };
const capturedLower = [
  306,306,306,306,306,306,306,306,306,306,306,306,
  306,423,306,423,423,423,423,423,423,423,423,306,
  306,423,423,423,423,423,423,423,423,360,423,306,
  306,423,306,423,423,423,423,306,423,360,423,306,
  306,423,423,423,423,423,423,423,423,360,423,306,
  306,423,423,423,423,423,423,423,423,360,423,306,
  306,423,423,306,423,423,423,423,423,360,423,306,
  306,423,423,423,423,423,423,423,423,360,306,306,
  306,360,360,360,360,360,360,360,360,360,423,306,
  306,306,306,306,306,306,306,306,306,306,306,306,
];

function project(): Project {
  const p = createEmptyToolProject();
  ensureBundledTilesets(p);
  return p;
}

function authored(ts: TilesetDef, tile: number, layer: "lower" | "upper", solid: boolean): void {
  setTileLayerOverride(ts, tile, layer);
  ts.passability[tile] = solid ? blockedFlag() : passableFlag();
  markUserTileRuntimeMetadata(ts, tile, { passage: solid ? "solid" : "passable" });
}

function expectStableReload(p: Project): void {
  const fresh = deserialize(serialize(p));
  ensureBundledTilesets(fresh);
  expect(fresh.tilesets).toEqual(deserialize(serialize(p)).tilesets);
  expect(serializeForComparison(fresh)).toBe(serializeForComparison(p));
  const second = deserialize(serialize(fresh));
  ensureBundledTilesets(second);
  expect(serializeForComparison(second)).toBe(serializeForComparison(fresh));
}

describe("generate_map palette authority", () => {
  it("replays the captured default cave/settlement map without changing any shared tile rules", () => {
    const ctx = { project: project() };
    const before = structuredClone(ctx.project.tilesets);
    expect(before[DEFAULT_TILESET_ID]!.priority[385]).toBe("upper");
    expect(before[DEFAULT_TILESET_ID]!.passability[385]).toEqual(blockedFlag());
    const result = runTool(ctx, "generate_map", capturedArgs);
    expect(result.ok, result.summary).toBe(true);
    expect(ctx.project.maps.map_cellar!.lowerTiles).toEqual(capturedLower);
    expect(ctx.project.maps.map_cellar!.upperTiles).toEqual(Array(120).fill(-1));
    expect(ctx.project.tilesets).toEqual(before);
    expect(result.diff?.tilesetsChanged).toBe(0);
    expectStableReload(ctx.project);
  });

  it.each(["lower", "upper"] as const)("retains an unused authored %s accent, including metadata", layer => {
    const ctx = { project: project() };
    authored(ctx.project.tilesets[DEFAULT_TILESET_ID]!, 385, layer, layer === "upper");
    const before = structuredClone(ctx.project.tilesets);
    const result = runTool(ctx, "generate_map", capturedArgs);
    expect(result.ok, result.summary).toBe(true);
    expect(ctx.project.tilesets).toEqual(before);
    expectStableReload(ctx.project);
  });

  it("keeps compatible authored lower/passable ground and upper/solid obstacles on their own layers", () => {
    const ctx = { project: project() };
    const ts = ctx.project.tilesets[DEFAULT_TILESET_ID]!;
    authored(ts, 423, "lower", false);
    authored(ts, 306, "upper", true);
    const before = structuredClone(ctx.project.tilesets);
    const result = runTool(ctx, "generate_map", capturedArgs);
    expect(result.ok, result.summary).toBe(true);
    const map = ctx.project.maps.map_cellar!;
    expect(map.lowerTiles[0]).toBe(423);
    expect(map.upperTiles[0]).toBe(306);
    expect(isPassable(ctx.project, map, 0, 0)).toBe(false);
    expect(checkReachability(ctx.project, map.id, capturedArgs.entrance, capturedArgs.pois).reachable).toBe(true);
    expect(ctx.project.tilesets).toEqual(before);
    expectStableReload(ctx.project);
  });

  it.each(["upper-ground", "blocked-path", "directional-path", "open-obstacle", "stale-runtime", "image", "columns", "tile-size", "count"])(
    "rejects incompatible %s before direct-module or runner project mutation", kind => {
      const p = project();
      const ts = p.tilesets[DEFAULT_TILESET_ID]!;
      if (kind === "upper-ground") authored(ts, 423, "upper", true);
      if (kind === "blocked-path") authored(ts, 360, "lower", true);
      if (kind === "directional-path") ts.passability[360] = { ...passableFlag(), right: false };
      if (kind === "open-obstacle") authored(ts, 306, "lower", false);
      if (kind === "stale-runtime") {
        authored(ts, 423, "upper", true);
        ts.priority[423] = "lower"; ts.passability[423] = passableFlag();
      }
      if (kind === "image") ts.image = { type: "bundled", id: "tex_easyrpg_chipset_world" };
      if (kind === "columns") ts.tilesPerRow = 16;
      if (kind === "tile-size") ts.tileSize = 32;
      if (kind === "count") ts.count = 400;
      const before = structuredClone(p);
      expect(() => MAP_GEN_TOOLS[0]!.run(p, capturedArgs)).toThrowError(expect.objectContaining({ code: "incompatible-generation-palette" }));
      expect(p).toEqual(before);
      const ctx = { project: p };
      const result = runTool(ctx, "generate_map", capturedArgs);
      expect(result.ok).toBe(false);
      expect(result.issues?.map(i => i.code)).toContain("incompatible-generation-palette");
      expect(ctx.project).toEqual(before);
    },
  );

  it("does not validate or change an obstacle when no algorithm placement consumes it", () => {
    const ctx = { project: project() };
    authored(ctx.project.tilesets[DEFAULT_TILESET_ID]!, 306, "upper", false);
    const before = structuredClone(ctx.project.tilesets);
    const result = runTool(ctx, "generate_map", { ...capturedArgs, border: "none", chokepoints: 0 });
    expect(result.ok, result.summary).toBe(true);
    expect(ctx.project.maps.map_cellar!.lowerTiles).not.toContain(306);
    expect(ctx.project.maps.map_cellar!.upperTiles).not.toContain(306);
    expect(ctx.project.tilesets).toEqual(before);
  });

  for (const profile of MAP_GENERATION_PROFILES.values()) {
    if (profile.layout === "rooms" || profile.layout === "city") continue;
    for (const theme of ["village", "forest", "cave"] as const) {
      it(`${profile.tilesetId}/${theme} uses native rules and reloads canonically`, () => {
        const ctx = { project: project() };
        const before = structuredClone(ctx.project.tilesets);
        const entrance = { x: 1, y: 8 }, pois = [{ x: 18, y: 2 }, { x: 18, y: 13 }];
        const result = runTool(ctx, "generate_map", { id: "native", theme, tilesetId: profile.tilesetId,
          width: 20, height: 16, seed: 7, border: "none", chokepoints: 25, entrance, pois });
        expect(result.ok, result.summary).toBe(true);
        expect(ctx.project.tilesets).toEqual(before);
        expect(checkReachability(ctx.project, "native", entrance, pois).reachable).toBe(true);
        const map = ctx.project.maps.native!;
        expect(new Set([...map.lowerTiles, ...map.upperTiles].filter(t => t >= 0)).size).toBeGreaterThanOrEqual(2);
        if (profile.layout === "world") {
          expect([...map.lowerTiles, ...map.upperTiles]).toContain(profile.palettes[theme].accent);
          expect(before[profile.tilesetId]!.passability[profile.palettes[theme].accent]).toEqual(blockedFlag());
        }
        expectStableReload(ctx.project);
      });
    }
  }

  it("rejects Modern's unconfigured passable obstacle rather than inventing a solid rule", () => {
    const ctx = { project: project() };
    const before = structuredClone(ctx.project);
    const result = runTool(ctx, "generate_map", { ...capturedArgs, tilesetId: "modern_exteriors_nocturne" });
    expect(result.ok).toBe(false);
    expect(result.issues?.map(i => i.code)).toContain("incompatible-generation-palette");
    expect(ctx.project).toEqual(before);
  });
});
