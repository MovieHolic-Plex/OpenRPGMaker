import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { compileSpatialOccurrence, SpatialCompileError } from "../../src/editor/spatial/compileSpatialOccurrence";
import { deserialize, serialize } from "../../src/project/io";
import { own, requireOccurrenceAssociations } from "../../src/project/spatial/domain";
import type { Project } from "../../src/project/types";
import { sha256HexTextSync } from "../../src/util/sha256";
import { fixtureDocument, replaceOccurrence } from "../../test/support/spatialSpaceCompilerFixture";
import { placeCompilerFixture, placeRoot, stairFloors, withStairConnections } from "../../test/support/spatialConnectionSceneFixture";
import { inspectNestedTraversal } from "../../test/support/spatialPlaceTraversal";

/** Real public compiler -> serializer -> walking engine -> command interpreter receipt. */
export async function runNestedPlaces(seeds: readonly number[], directory: string, fault?: string) {
  assert.ok(fault === undefined || fault === "blocked-port");
  await mkdir(`${directory}/maps`, { recursive: true });
  const sourceSHA = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
  const sourceDiffSHA256 = sha256HexTextSync(execFileSync("git", ["diff", "HEAD", "--", "src/editor/spatial", "scripts/qa", "test/spatialPlace*", "test/support/spatialPlace*"], { encoding: "utf8" }));
  const receipts = [];
  for (const seed of seeds) {
    const fixture = withStairConnections(placeCompilerFixture(seed));
    const floor = stairFloors(fixture)[0];
    assert.ok(floor);
    const stair = requireOccurrenceAssociations(own(fixtureDocument(fixture).occurrences, floor.stairId));
    const input: Project = fault === "blocked-port" ? replaceOccurrence(fixture, { ...stair, snapshot: { ...stair.snapshot,
      ports: stair.snapshot.ports.map(port => ({ ...port, x: -7, y: -7 })) } }) : fixture;
    const before = serialize(input);
    try {
      const proposal = compileSpatialOccurrence(input, { occurrenceId: placeRoot });
      assert.equal(serialize(input), before);
      assert.equal(fault, undefined, "Requested failure was accepted");
      const loaded = deserialize(serialize(proposal));
      const repeated = compileSpatialOccurrence(loaded, { occurrenceId: placeRoot });
      assert.deepEqual(repeated, loaded);
      const traversal = inspectNestedTraversal(loaded);
      assert.equal(traversal.routes.length, 4);
      const mapFiles = [];
      for (const [index, map] of Object.values(loaded.maps).filter(map => !Object.hasOwn(input.maps, map.id)).entries()) {
        const file = `maps/seed-${seed}-${index}.json`;
        await writeFile(`${directory}/${file}`, `${JSON.stringify(map, null, 2)}\n`);
        mapFiles.push({ mapId: map.id, file, sha256: sha256HexTextSync(JSON.stringify(map)) });
      }
      await writeFile(`${directory}/input-${seed}.json`, before);
      await writeFile(`${directory}/proposal-${seed}.json`, serialize(loaded));
      receipts.push({ seed, inputSHA256: sha256HexTextSync(before), ...traversal, mapFiles,
        repeatedIdentically: true, callerUnchanged: true });
    } catch (error) {
      if (!(error instanceof SpatialCompileError)) throw error;
      assert.equal(serialize(input), before);
      await writeFile(`${directory}/rejection.json`, `${JSON.stringify({ seed, sourceSHA, code: error.code, path: error.path,
        callerUnchanged: true, partialProposal: false, inputSHA256: sha256HexTextSync(before) }, null, 2)}\n`);
      throw error;
    }
  }
  const report = { scenario: "nested-places", compilerImplemented: true, sourceSHA, sourceDiffSHA256, seeds,
    remoteWrites: 0, storeMutations: 0, visualApproved: false, receipts };
  await writeFile(`${directory}/routes.json`, `${JSON.stringify(report, null, 2)}\n`);
  await writeFile(`${directory}/ports.json`, `${JSON.stringify(receipts.map(receipt => ({ seed: receipt.seed, ports: receipt.ports })), null, 2)}\n`);
  console.log(JSON.stringify(report, null, 2));
}
