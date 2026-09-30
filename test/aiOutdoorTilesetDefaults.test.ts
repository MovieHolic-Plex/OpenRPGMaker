import { countBroadleaf2x2 } from "@/editor/tools/villageEvaluate";
import { describe, expect, it } from "vitest";
import { createEmptyToolProject } from "@/editor/tools/emptyProject";
import { runTool } from "@/editor/tools/toolRunner";
import { runAuthorVillage } from "@/editor/tools/authorVillageTool";
import { treeKitForTileset, stampTree } from "@/editor/tools/village/treeKit";
import { COMBINED_TOWN_TILESET_ID, TILE } from "@/project/defaults/constants";
import { FOREST_HARMONY_ID } from "@/project/defaults/forestHarmony";
import { deserialize, serialize } from "@/project/io";

const newTarget = { kind: "new", mapId: "village", name: "Village", width: 50, height: 50 };
const villageArgs = { houseCount: 2, countPolicy: "exact", interior: false, seed: 7 };

describe("AI outdoor chipset defaults", () => {
  it("creates grass on forest harmony, preserves explicit atlases and existing maps", () => {
    const ctx = { project: createEmptyToolProject() };
    expect(runTool(ctx, "create_map", { id: "legacy", tilesetId: COMBINED_TOWN_TILESET_ID, width: 20, height: 15 }).ok).toBe(true);
    const existing = structuredClone(ctx.project.maps.legacy);
    expect(runTool(ctx, "create_map", { id: "new", width: 20, height: 15 }).ok).toBe(true);
    expect(ctx.project.maps.new!.tilesetId).toBe(FOREST_HARMONY_ID);
    expect(ctx.project.maps.new!.lowerTiles.every(tile => tile === TILE.GRASS)).toBe(true);
    expect(ctx.project.maps.legacy).toEqual(existing);
    expect(runTool(ctx, "create_map", { id: "inside", tilesetId: "easyrpg_chipset_interior", width: 20, height: 15 }).ok).toBe(true);
    expect(ctx.project.maps.inside!.tilesetId).toBe("easyrpg_chipset_interior");
  });

  it.each(["forest", "village", "cave"])("selects a purpose-specific default for %s", theme => {
    const ctx = { project: createEmptyToolProject() };
    const result = runTool(ctx, "generate_map", { id: "generated", theme, width: 20, height: 18,
      entrance: { x: 1, y: 9 }, pois: [{ x: 18, y: 9 }], seed: 7 });
    expect(result.ok, result.summary).toBe(true);
    expect(ctx.project.maps.generated!.tilesetId).toBe(theme === "cave" ? "easyrpg_chipset_dungeon" : FOREST_HARMONY_ID);
  });

  it.each([undefined, COMBINED_TOWN_TILESET_ID])("builds and reloads the selected new village (%s)", tilesetId => {
    const ctx = { project: createEmptyToolProject() };
    const result = runAuthorVillage(ctx, { ...villageArgs, target: { ...newTarget, ...(tilesetId ? { tilesetId } : {}) } });
    expect(result.ok, result.summary).toBe(true);
    const map = ctx.project.maps.village!;
    expect(map.tilesetId).toBe(tilesetId ?? FOREST_HARMONY_ID);
    expect(result.data.village.structuralQa.ok).toBe(true);
    expect(result.data.village.actualHouseCount).toBe(2);
    const fresh = deserialize(serialize(ctx.project));
    expect(fresh.maps.village).toEqual(map);
    expect(fresh.tilesets[map.tilesetId]).toEqual(ctx.project.tilesets[map.tilesetId]);
  });

  it("rejects an unsupported new village atlas before mutating the project", () => {
    const ctx = { project: createEmptyToolProject() };
    const before = structuredClone(ctx.project);
    const result = runAuthorVillage(ctx, { ...villageArgs, target: { ...newTarget, tilesetId: "easyrpg_chipset_interior" } });
    expect(result.ok).toBe(false);
    expect(result.issues?.some(issue => issue.code === "village-tileset-mismatch")).toBe(true);
    expect(ctx.project).toEqual(before);
  });

  it("uses authored forest assemblies and never revives the obsolete dark-tree rectangle", () => {
    const project = createEmptyToolProject();
    const tileset = project.tilesets[FOREST_HARMONY_ID]!;
    const preview = tileset.tileGroups!.find(group => group.id === "forest-trees:tree")!.previewMap!;
    const kit = treeKitForTileset(tileset);
    expect(kit.id).toBe("forest-harmony");
    expect([kit.medium.w, kit.medium.h]).toEqual([preview.width, preview.height]);
    expect(kit.medium.cells[0]).toEqual({ layer: "upper", tile: preview.upperTiles[0] });
    expect(kit.medium.cells[6]).toEqual({ layer: "lower", tile: preview.lowerTiles[6] });
    expect(kit.small.id).toBe("forest-trees:tree");
    expect(kit.forest).toEqual([]);
    const ctx = { project };
    expect(runTool(ctx, "create_map", { id: "trees", width: 20, height: 15 }).ok).toBe(true);
    const map = ctx.project.maps.trees!;
    stampTree(map, kit.medium, 2, 2);
    expect(countBroadleaf2x2(map)).toBe(1);
    map.lowerTiles[5 * map.width + 3] = TILE.GRASS;
    expect(countBroadleaf2x2(map)).toBe(0);
  });
});
