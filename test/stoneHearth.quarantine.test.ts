import { expect, it } from "vitest";
import { createBlankProject } from "@/project/defaults";
import { deserialize, serialize } from "@/project/io";
import { runTool } from "@/editor/tools/toolRunner";
import { INTERIOR_OBJECT_CATALOG, interiorObjectById } from "@/editor/interiorObjectCatalog";
import { INTERIOR_TILE_SEMANTICS } from "@/project/defaults/tileSemanticsInterior";
import { INTERIOR_HARNESS_GROUPS } from "@/project/tilesetHarness/themePacks";
import { conceptVocabulary } from "@/editor/conceptPlan";
import { resolveInteriorRoomVocab, seedInteriorTilesetCatalog } from "@/editor/interiorRoomVocab";
import { isPassable } from "@/project/collision";

const grid = [[402,403,404],[432,433,434],[462,463,464]];

it("defines the nine hearth tiles as a single unlit 3x3 assembly", () => {
  const hearth = interiorObjectById("stone_hearth_unlit");
  expect(hearth && [hearth.width, hearth.height]).toEqual([3,3]);
  expect(hearth?.cells.map(cell => [cell.dx,cell.dy,cell.tile])).toEqual(
    grid.flatMap((row,dy) => row.map((tile,dx) => [dx,dy,tile])),
  );
  for (const tile of grid.flat()) {
    expect(INTERIOR_TILE_SEMANTICS.find(entry => entry.index === tile)?.role).toBe("furniture");
    expect(INTERIOR_HARNESS_GROUPS.some(group => group.role === "wall" && group.tileIds.includes(tile))).toBe(false);
  }
});

it("replaces only bottom-center tile 463 with the fire animation anchor", () => {
  const lit = interiorObjectById("stone_hearth_lit");
  expect(lit?.cells.map(cell => [cell.dx,cell.dy,cell.tile])).toEqual(
    grid.flatMap((row,dy) => row.map((tile,dx) => [dx,dy,tile === 463 ? 124 : tile])),
  );
});

it("exposes both hearth variants to the AI tool and preserves their authoring data", () => {
  const ctx = { project: createBlankProject() };
  const sourceTileset = ctx.project.tilesets.easyrpg_chipset_interior;
  if (!sourceTileset) throw new Error("Tileset missing");
  seedInteriorTilesetCatalog(sourceTileset, INTERIOR_OBJECT_CATALOG, []);
  const query = runTool(ctx, "get_concept_facility", { query: "inn" });
  expect(query.ok, query.summary).toBe(true);
  const data = query.data;
  if (!data || typeof data !== "object" || !("vocabulary" in data) || !Array.isArray(data.vocabulary)) {
    throw new Error("AI vocabulary missing");
  }
  expect(data.vocabulary.find(entry => entry.id === "stone_hearth_unlit")?.tileIds).toContain(463);
  expect(data.vocabulary.find(entry => entry.id === "stone_hearth_lit")?.tileIds).toContain(124);
  const project = deserialize(serialize(ctx.project));
  const tileset = project.tilesets.easyrpg_chipset_interior;
  const stored = tileset?.structureKits?.find(kit => kit.id === "stone_hearth_lit");
  const vocab = conceptVocabulary(resolveInteriorRoomVocab(tileset, [], []), []);
  expect(vocab.find(entry => entry.id === "stone_hearth_lit")?.description).toBe(stored?.ai?.description);
  expect(stored?.ai?.description).toBeTruthy();
});

for (const state of ["unlit", "lit"]) it(`builds a complete ${state} hearth through the real AI authoring tool`, () => {
  const ctx = { project: createBlankProject() };
  const result = runTool(ctx, "place_concept", {
    query: "화로 검증", mapId: `hearth_${state}`, seed: 7,
    plan: {
      places: [{ id: "hall", role: "entrance", size: "l" }],
      things: [{ id: "hearth", objectId: `stone_hearth_${state}`, placeIds: ["hall"], chips: ["block","event"], required: true }],
    },
  }, { dryRun: false });
  expect(result.ok, result.summary).toBe(true);
  expect([...(result.warnings ?? []), ...(result.diff?.warnings ?? [])]).toEqual([]);
  const loaded = deserialize(serialize(ctx.project));
  const map = loaded.maps[`hearth_${state}`];
  if (!map) throw new Error("Built map missing");
  const top = map.lowerTiles.indexOf(402);
  expect(top).toBeGreaterThanOrEqual(0);
  const x = top % map.width;
  const y = Math.floor(top / map.width);
  for (let dy=0; dy<3; dy++) for (let dx=0; dx<3; dx++) {
    const tile = grid[dy]?.[dx];
    expect(map.lowerTiles[(y+dy)*map.width+x+dx]).toBe(tile === 463 && state === "lit" ? 124 : tile);
    expect(isPassable(loaded,map,x+dx,y+dy)).toBe(false);
  }
});
