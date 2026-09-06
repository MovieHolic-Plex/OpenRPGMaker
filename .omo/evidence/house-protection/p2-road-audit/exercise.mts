import assert from "node:assert/strict";
import { createEmptyToolProject } from "../../../../src/editor/tools/emptyProject";
import { runTool } from "../../../../src/editor/tools/toolRunner";
import { runAuthorVillage } from "../../../../src/editor/tools/authorVillageTool";
import { buildVillageDomain, inspectVillageBuild } from "../../../../src/editor/tools/village/builder";
import { roadComponentNotes } from "../../../../src/editor/tools/village/audit";
import { assertHouseProtection, captureHouseProtection } from "../../../../src/editor/tools/houseProtection";
import { deserialize, serialize } from "../../../../src/project/io";

for (const humanEdit of [false, true]) {
  const ctx = { project: createEmptyToolProject("Road ownership surface exercise") };
  assert.equal(runTool(ctx, "create_map", { id: "town", name: "Town", width: 50, height: 50 }).ok, true);
  const authored = runTool(ctx, "author_house", { kind: "single", mapId: "town", kitId: "blue-stone",
    wings: [{ x: 3, y: 3, w: 7, h: 8 }], roofDeck: true, interior: "linked-interior", yard: [] });
  assert.equal(authored.ok, true, JSON.stringify(authored.issues));
  assert.equal(ctx.project.maps.town.upperTiles[4 * 50 + 5], 199);
  if (humanEdit) ctx.project.maps.town.lowerTiles[4 * 50 + 5] = 424;
  ctx.project = deserialize(serialize(ctx.project));
  const accepted = captureHouseProtection(ctx.project);
  const domain = structuredClone(ctx.project);
  const built = buildVillageDomain(domain, { mapId: "town", houses: 4, seed: 7, interior: false });
  const inspection = inspectVillageBuild(domain, built);
  assertHouseProtection(accepted, domain, []);
  assert.equal(inspection.structuralQa.ok, true);
  assert.equal(inspection.structuralQa.roadComponents, 1);
  const result = runAuthorVillage(ctx, { target: { kind: "existing", mapId: "town" }, fullMap: true,
    houseCount: 4, countPolicy: "exact", seed: 7, interior: false });
  assert.equal(result.ok, true, JSON.stringify(result.issues));
  assertHouseProtection(accepted, ctx.project, []);
  assert.equal(result.data.village.actualHouseCount, 4);
  assert.equal(result.data.village.structuralQa.critiqueOk, true);
  assert.equal(result.data.village.structuralQa.roadComponents, 1);
  if (humanEdit) assert.equal(ctx.project.maps.town.lowerTiles[4 * 50 + 5], 424);
  assert.equal(ctx.project.maps.town.upperTiles[4 * 50 + 5], 199);
  console.log(JSON.stringify({ humanEdit, protectedCells: accepted.reduce((n, h) => n + h.cells.length, 0),
    oldExact: true, domain: inspection.structuralQa, facade: result.data.village,
    notes: roadComponentNotes(ctx.project.maps.town, { x: 0, y: 0, w: 50, h: 50 }) }));
}
