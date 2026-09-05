import { beforeAll, expect, it } from "vitest";
import { createBlankProject } from "@/project/defaults";
import { runTool } from "@/editor/tools/toolRunner";
import { INTERIOR_OBJECT_CATALOG, interiorObjectById } from "@/editor/interiorObjectCatalog";
import { INTERIOR_TILE_SEMANTICS } from "@/project/defaults/tileSemanticsInterior";
import { applyEasyRpgThemeMetadataPacks, INTERIOR_HARNESS_GROUPS } from "@/project/tilesetHarness/themePacks";
import { isPassable } from "@/project/collision";
import type { Project } from "@/project/types";

let project: Project;
beforeAll(() => {
  const ctx = { project: createBlankProject() };
  const result = runTool(ctx, "place_concept", { query: "inn", mapId: "tile_review_inn", seed: 7 }, { dryRun: false });
  expect(result.ok, result.summary).toBe(true);
  project = ctx.project;
});

it("uses one complete 1x1 stair at each descent instead of pairing two variants", () => {
  const stair = interiorObjectById("stairs_down");
  expect(stair && [stair.width, stair.height, stair.cells.length]).toEqual([1, 1, 1]);
  for (const id of ["tile_review_inn_2f", "tile_review_inn_3f"]) {
    const map = project.maps[id];
    if (!map) throw new Error("Floor missing");
    expect(map.upperTiles.filter(tile => tile === 474 || tile === 475)).toHaveLength(1);
  }
});

it("marks the lower entrance with tile 176 while keeping it passable", () => {
  const map = project.maps.tile_review_inn;
  if (!map) throw new Error("Ground floor missing");
  const entry = map.events.find(event => event.id === `ev_entrance_${map.id}`);
  if (!entry) throw new Error("Entrance missing");
  expect(map.upperTiles[entry.y * map.width + entry.x]).toBe(176);
  expect(isPassable(project, map, entry.x, entry.y)).toBe(true);
});

it("removes rejected tiles from classification, groups and generated furniture", () => {
  const rejected = [408, 409, 410];
  const tileset = createBlankProject().tilesets.easyrpg_chipset_interior;
  if (!tileset) throw new Error("Tileset missing");
  for (const tile of rejected) {
    tileset.tileMeta![tile] = { label: "old-counter", description: "", source: "bundled-default", tags: ["counter"] };
  }
  applyEasyRpgThemeMetadataPacks(tileset);
  for (const tile of rejected) {
    expect(INTERIOR_TILE_SEMANTICS.some(entry => entry.index === tile)).toBe(false);
    expect(INTERIOR_HARNESS_GROUPS.some(group => group.tileIds.includes(tile))).toBe(false);
    expect(INTERIOR_OBJECT_CATALOG.some(object => object.cells.some(cell => cell.tile === tile))).toBe(false);
    expect(tileset.tileMeta?.[tile]?.source).toBe("unknown");
  }
  const map = project.maps.tile_review_inn;
  if (!map) throw new Error("Inn missing");
  expect([...map.lowerTiles, ...map.upperTiles].some(tile => rejected.includes(tile))).toBe(false);
});

it("classifies 209 and 239 as a vertical flue assembly", () => {
  for (const tile of [209, 239]) {
    const semantic = INTERIOR_TILE_SEMANTICS.find(entry => entry.index === tile);
    expect(semantic?.tags).toContain("flue");
    expect(semantic?.tags).not.toContain("boiler");
  }
  expect(interiorObjectById("flue")?.cells.map(cell => [cell.dx, cell.dy, cell.tile])).toEqual([[0, 0, 209], [0, 1, 239]]);
});
