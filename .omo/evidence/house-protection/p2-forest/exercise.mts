import assert from "node:assert/strict";
import { createBlankProject } from "@/project/defaults";
import { runTool } from "@/editor/tools/toolRunner";
import { captureHouseProtection, assertHouseProtection } from "@/editor/tools/houseProtection";
import { serialize, deserialize } from "@/project/io";

for (const size of [50, 100]) {
  const ctx = { project: createBlankProject() };
  const created = runTool(ctx, "create_map", { name: "Forest protection exercise", width: size, height: size });
  assert.equal(created.ok, true, JSON.stringify(created.issues));
  const mapId = (created.data as { mapId: string }).mapId;
  const built = runTool(ctx, "author_house", {
    kind: "single", mapId, kitId: size === 50 ? "blue-stone" : "bright-plaster",
    wings: size === 50
      ? [{ x: 6, y: 6, w: 6, h: 8 }, { x: 12, y: 10, w: 4, h: 4 }]
      : [{ x: 6, y: 6, w: 7, h: 8 }],
    roofDeck: size === 100, interior: "linked-interior", yard: [],
  });
  assert.equal(built.ok, true, JSON.stringify(built.issues));
  const map = ctx.project.maps[mapId]!;
  map.structurePlacements = [{ id: "human", kitId: "deleted-kit", x: 20, y: 20, w: 2, h: 2,
    before: { lower: [240, 240, 240, 240], upper: [-1, -1, -1, -1] }, afterHash: "human-accepted" }];
  ctx.project = deserialize(serialize(ctx.project));
  const before = captureHouseProtection(ctx.project);
  const density = size === 50 ? "dense" : "impassable";
  const result = runTool(ctx, "place_props", { mapId, area: { x: 2, y: 2, w: size - 4, h: size - 4 }, material: "침엽수", density, seed: 7 });
  assert.equal(result.ok, true, JSON.stringify(result.issues));
  assertHouseProtection(before, ctx.project, []);
  assert.deepEqual(captureHouseProtection(ctx.project), before);
  assert.ok((result.data as { placed: number }).placed > 0);
  ctx.project = deserialize(serialize(ctx.project));
  assertHouseProtection(before, ctx.project, []);
  const accepted = serialize(ctx.project);
  const rejected = runTool(ctx, "tile_erase", { mapId, rect: { x: 6, y: 6, w: 1, h: 1 } });
  assert.equal(rejected.ok, false);
  assert.equal(rejected.issues?.[0]?.code, "protected-house-write");
  assert.equal(serialize(ctx.project), accepted);
  console.log(JSON.stringify({ size, density, kitId: size === 50 ? "blue-stone" : "bright-plaster", multiwing: size === 50,
    roofDeck: size === 100, linkedInterior: true, humanStamp: true, houseCells: before.reduce((n, house) => n + house.cells.length, 0),
    forest: result.data, preserved: true, reloadPreserved: true, eraseRejected: true }));
}
