/** Read-only project input; writes local evidence, never loads credentials or saves a DB row. */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { completeVillageTrees } from "../src/editor/tools/village/treeCompletion";
import { protectedHouseCells } from "../src/editor/tools/houseProtection";
import { validateClusterRules } from "../src/project/lint/clusterRuleValidators";
import { isTreeCanopyTileId } from "../src/project/tilesetHarness";
import { TILE } from "../src/project/defaults/constants";
import type { Project } from "../src/project/types";

const source = process.argv[2];
assert(source, "Usage: npx tsx scripts/verify-village-tree-completion.mts <preview-project.json> [mapId] [output-dir]");
const mapId = process.argv[3] ?? "map_lakeside_market_village_20260912";
const output = process.argv[4] ?? "output/evidence/village-tree-completion";
const bytes = fs.readFileSync(source);
// Preserve the submitted raw tiles: deserialization/normalization is not a repair.
const project = JSON.parse(bytes.toString("utf8")) as Project;
const map = project.maps[mapId];
assert(map, `Missing ${mapId}`);
const before = structuredClone(project);
const counts = () => Object.fromEntries(validateClusterRules(project, mapId)
  .filter(issue => issue.rule.kind === "adjacency" && issue.groupId.includes("tree"))
  .reduce((result, issue) => result.set(issue.groupId, (result.get(issue.groupId) ?? 0) + issue.coords.length), new Map<string, number>()));
const beforeCounts = counts();
const completed = completeVillageTrees(project, map, { x: 0, y: 0, w: map.width, h: map.height });
const afterCounts = counts();
assert.deepEqual(afterCounts, {});
const protectedIndices = new Set(protectedHouseCells(map).map(({ x, y }) => y * map.width + x));
const changes = map.upperTiles.flatMap((tile, index) => {
  if (tile === before.maps[mapId]!.upperTiles[index]) return [];
  assert.equal(before.maps[mapId]!.upperTiles[index], TILE.EMPTY);
  assert(isTreeCanopyTileId(tile));
  assert(!protectedIndices.has(index));
  return [{ x: index % map.width, y: Math.floor(index / map.width), tile, lower: map.lowerTiles[index], layer: "upper" as const }];
});
assert.equal(changes.length, completed.canopiesPlaced);
const removals = map.lowerTiles.flatMap((tile, index) => {
  const old = before.maps[mapId]!.lowerTiles[index];
  if (tile === old) return [];
  assert(old === 290 || old === 291, "Only unattached 1×2 tree trunks may be removed");
  assert.equal(tile, TILE.GRASS);
  assert(!protectedIndices.has(index));
  return [{ x: index % map.width, y: Math.floor(index / map.width), tile, before: old, layer: "lower" as const }];
});
assert.equal(removals.length, completed.orphanTrunksRemoved);
const expected = structuredClone(before);
for (const { x, y, tile } of changes) expected.maps[mapId]!.upperTiles[y * map.width + x] = tile;
for (const { x, y, tile } of removals) expected.maps[mapId]!.lowerTiles[y * map.width + x] = tile;
assert.deepEqual(project, expected, "Only the recorded tree cells may change anywhere in the project");
assert.deepEqual(completeVillageTrees(project, map, { x: 0, y: 0, w: map.width, h: map.height }), { canopiesPlaced: 0, trunksPlaced: 0, orphanTrunksRemoved: 0 });
fs.mkdirSync(output, { recursive: true });
const proof = {
  source: path.resolve(source), sourceSha256: createHash("sha256").update(bytes).digest("hex"), mapId,
  before: beforeCounts, after: afterCounts, completed, changedCells: [...changes, ...removals],
  preserved: { allNonTreeCells: true, housesAndStacks: true, waterAndRoads: true, allOtherProjectData: true },
  idempotent: true, databaseWrites: 0,
};
fs.writeFileSync(path.join(output, "proof.json"), JSON.stringify(proof, null, 2));
fs.writeFileSync(path.join(output, "completed-project.json"), JSON.stringify(project));
console.log(JSON.stringify({ ...proof, changedCells: changes.length + removals.length }, null, 2));
