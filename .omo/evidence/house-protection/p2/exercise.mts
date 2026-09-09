import assert from "node:assert/strict";
import { createEmptyToolProject } from "@/editor/tools/emptyProject";
import { runTool } from "@/editor/tools/toolRunner";
import { assertHouseProtection, captureHouseProtection } from "@/editor/tools/houseProtection";
import { serialize, deserialize } from "@/project/io";
import { isPassable } from "@/project/collision";

for (const size of [50, 100]) {
  const ctx = { project: createEmptyToolProject("Phase2 ephemeral exercise") };
  const create = runTool(ctx, "create_map", { id: "town", name: "Town", width: size, height: size });
  assert.equal(create.ok, true, JSON.stringify(create.issues));
  const author = runTool(ctx, "author_house", { kind: "single", mapId: "town", kitId: "blue-stone",
    wings: [{ x: 3, y: 3, w: 7, h: 8 }], roofDeck: true, interior: "linked-interior", yard: [] });
  assert.equal(author.ok, true, JSON.stringify(author.issues));
  const map = ctx.project.maps.town!;
  const stamp = { x: size - 8, y: size - 8, w: 3, h: 3 };
  map.structurePlacements = [{ id: "human", kitId: "removed-kit", ...stamp,
    before: { lower: Array(9).fill(240), upper: Array(9).fill(-1) }, afterHash: "accepted" }];
  const index = stamp.y * size + stamp.x;
  map.lowerTileStacks = { [index]: [] };
  map.upperTileStacks = { [index]: [199, 200] };
  ctx.project = deserialize(serialize(ctx.project));
  const old = captureHouseProtection(ctx.project);
  assert.equal(old.length, 2);
  const count = size === 50 ? 4 : 20;
  const village = runTool(ctx, "author_village", { target: { kind: "existing", mapId: "town" }, fullMap: true,
    houseCount: count, countPolicy: "exact", npcCount: size === 100 ? 50 : 6,
    groundTheme: "snow", settlementLayout: "street-grid", interior: false, seed: size === 100 ? 41 : 7 });
  assert.equal(village.ok, true, JSON.stringify(village.issues));
  assertHouseProtection(old, ctx.project, []);
  const completed = captureHouseProtection(ctx.project);
  assert.equal(completed.length, count + 2);
  const regions = ctx.project.maps.town!.layoutPlan!.regions;
  assert.equal(new Set(regions.map(r => r.id)).size, regions.length);
  for (const region of regions.filter(r => r.role === "house")) {
    assert.equal(isPassable(ctx.project, ctx.project.maps.town!, region.front!.x, region.front!.y), true);
  }
  ctx.project = deserialize(serialize(ctx.project));
  assert.deepEqual(captureHouseProtection(ctx.project), completed);
  const fill = runTool(ctx, "fill_region", { mapId: "town", material: "모래", clearUpper: false,
    rect: { x: 2, y: 2, w: 9, h: 10 } });
  assert.equal(fill.ok, true, JSON.stringify(fill.issues));
  assert(Number((fill.data as { mutatedCells: number }).mutatedCells) > 0);
  const forest = runTool(ctx, "place_props", { mapId: "town", material: "침엽수", density: "dense", seed: 7,
    area: { x: 0, y: 0, w: size, h: size } });
  assert.equal(forest.ok, true, JSON.stringify(forest.issues));
  assert(Number((forest.data as { placed: number }).placed) > 0);
  assert.deepEqual(captureHouseProtection(ctx.project), completed);
  const beforeRejected = serialize(ctx.project);
  const rejected = runTool(ctx, "tile_erase", { mapId: "town", layer: "upper", rect: { x: 3, y: 3, w: 7, h: 8 } });
  assert.equal(rejected.ok, false);
  assert.equal(rejected.issues?.[0]?.code, "protected-house-write");
  assert.equal(serialize(ctx.project), beforeRejected);
  console.log(JSON.stringify({ size, newHouses: count, protectedOwners: completed.length,
    protectedCells: completed.reduce((n, h) => n + h.cells.length, 0), village: village.data,
    fill: fill.data, forestPlaced: (forest.data as { placed: number }).placed, rejected: rejected.issues?.[0]?.code }));
}
