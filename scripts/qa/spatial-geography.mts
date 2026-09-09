import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { compileSpatialOccurrence } from "../../src/editor/spatial/compileSpatialOccurrence";
import { deserialize, serialize } from "../../src/project/io";
import { sha256HexTextSync } from "../../src/util/sha256";
import { geographyRoot } from "../../test/support/spatialGeographyFixture";
import { editedRegion } from "../../test/support/spatialGeographyEdits";
import { geographyRecipeFixture, regionRecipes, worldRecipes } from "../../test/support/spatialGeographyRecipes";
import { inspectGeographyTraversal } from "../../test/support/spatialGeographyTraversal";
import { fixtureDocument } from "../../test/support/spatialSpaceCompilerFixture";

/** Real compiler/IO/production walking/interpreter path. No diagnostics manufacture output. */
export async function runGeography(seeds: readonly number[], directory: string, fault?: string) {
  assert.ok(fault === undefined || fault === "blocked-route");
  await mkdir(`${directory}/maps`, { recursive: true });
  const sourceSHA = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
  const files = execFileSync("git", ["ls-files", "--cached", "--others", "--exclude-standard", "src/editor/spatial", "scripts/qa/spatial-compile.mts",
    "scripts/qa/spatial-geography.mts", "test/spatialGeography*", "test/support/spatialGeography*", "test/support/spatialPlace*", "test/support/spatialConnectionSceneFixture.ts"], { encoding: "utf8" }).trim().split("\n");
  const sourceFiles = Object.fromEntries(await Promise.all([...new Set(files)].map(async file => [file, sha256HexTextSync(await readFile(file, "utf8"))])));
  const receipts = [];
  for (const seed of seeds) for (const recipe of [...regionRecipes.map(recipe => recipe.id), ...worldRecipes]) {
    const input = fault === "blocked-route" ? editedRegion(region => ({ ...region, terrain: { ...region.terrain,
      areas: [{ kind: "rect", x: 12, y: 7, width: 3, height: 3, material: "forest" }] } })) : geographyRecipeFixture(recipe, seed);
    const before = serialize(input);
    const declared = fixtureDocument(input).connections;
    const proposal = compileSpatialOccurrence(input, { occurrenceId: geographyRoot });
    assert.equal(fault, undefined, "Requested compiler fault was accepted");
    const loaded = deserialize(serialize(proposal));
    assert.equal(serialize(input), before);
    assert.deepEqual(fixtureDocument(loaded).connections, declared);
    const repeated = compileSpatialOccurrence(loaded, { occurrenceId: geographyRoot });
    assert.deepEqual(repeated, loaded);
    const traversal = inspectGeographyTraversal(loaded);
    // Child fixtures must actually enter a facility and its floors, not just compile unused maps.
    const internalTransfers = traversal.routes.filter(route => route.eventId.startsWith("spatial-transfer:"));
    assert.ok(internalTransfers.length >= 16);
    const prefix = `${recipe}-${seed}`;
    const mapFiles = [];
    for (const [index, map] of Object.values(loaded.maps).filter(map => !Object.hasOwn(input.maps, map.id)).entries()) {
      const file = `maps/${prefix}-${index}.json`;
      await writeFile(`${directory}/${file}`, `${JSON.stringify(map)}\n`);
      mapFiles.push({ mapId: map.id, file, sha256: sha256HexTextSync(JSON.stringify(map)) });
    }
    const projectFile = `${prefix}.json`;
    await writeFile(`${directory}/${projectFile}`, serialize(loaded));
    const receiptFile = `${prefix}-routes.json`;
    await writeFile(`${directory}/${receiptFile}`, `${JSON.stringify({ ...traversal, mapFiles }, null, 2)}\n`);
    receipts.push({ seed, recipe, inputSHA256: sha256HexTextSync(before), projectFile, projectSHA256: sha256HexTextSync(serialize(loaded)),
      receiptFile, maps: mapFiles.length, overviews: traversal.overviews.length, transfers: traversal.routes.length,
      internalTransfers: internalTransfers.length, repeatedIdentically: true, callerUnchanged: true });
  }
  const rejected = editedRegion(region => ({ ...region, terrain: { ...region.terrain,
    areas: [{ kind: "rect", x: 12, y: 7, width: 3, height: 3, material: "forest" }] } }));
  const rejectedBefore = serialize(rejected);
  assert.throws(() => compileSpatialOccurrence(rejected, { occurrenceId: geographyRoot }), { code: "blocked" });
  assert.equal(serialize(rejected), rejectedBefore);
  const report = { scenario: "geography", sourceSHA, sourceFiles, seeds, receipts,
    errorPath: { code: "blocked", callerUnchanged: true }, compilerImplemented: true, fixturesOnly: true,
    publishedSamples: false, remoteWrites: 0, storeMutations: 0, visualApproved: false };
  await writeFile(`${directory}/routes.json`, `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify(report, null, 2));
}
