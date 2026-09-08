import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { parseArgs } from "node:util";
import { compileSpatialOccurrence, SpatialCompileError } from "../../src/editor/spatial/compileSpatialOccurrence";
import { assertNever, own, findOccurrenceChildId, spatialId } from "../../src/project/spatial/domain";
import { deleteSpatialOccurrence } from "../../src/project/spatial/ownership";
import type { GameMap } from "../../src/project/types";
import { sha256HexTextSync } from "../../src/util/sha256";
import { inspectCompiledSpace } from "../../test/support/spatialCompilerAssertions";
import { fixtureDocument, spaceCompilerFixture, objectStampFixture, reinstantiateSpace, spaceRoot } from "../../test/support/spatialSpaceCompilerFixture";
import { outdoorShapeFixture } from "../../test/support/spatialOutdoorShapeFixture";
import { inspectOutdoorShape } from "../../test/support/spatialOutdoorAssertions";

const { values } = parseArgs({ options: { scenario: { type: "string" }, seeds: { type: "string" }, evidence: { type: "string" }, fault: { type: "string" } }, strict: true });
assert.ok(values.scenario === "spaces" || values.scenario === "nested-places" || values.scenario === "geography");
assert.ok(typeof values.seeds === "string" && /^\d+(,\d+)*$/.test(values.seeds));
const seeds = values.seeds.split(",").map(value => {
  const seed = Number(value);
  assert.ok(Number.isSafeInteger(seed) && seed >= 0 && seed <= 2147483647);
  return seed;
});
const directories = { spaces: "output/evidence/tile-to-world/task-8/backend-v3", "nested-places": "output/evidence/tile-to-world/task-9/backend-v2",
  geography: "output/evidence/tile-to-world/task-10/backend-v2" } as const;
const directory = resolve(values.evidence ?? directories[values.scenario]);
switch (values.scenario) {
case "geography": {
  const { runGeography } = await import("./spatial-geography.mts");
  await runGeography(seeds, directory, values.fault);
  break;
}
case "nested-places": {
  const { runNestedPlaces } = await import("./spatial-nested-places.mts");
  await runNestedPlaces(seeds, directory, values.fault);
  break;
}
case "spaces": {
assert.equal(values.fault, undefined);
await mkdir(`${directory}/maps`, { recursive: true });
await mkdir(`${directory}/contract`, { recursive: true });
const sha = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
const receipts = [];
const rejections: { readonly seed: number; readonly code: SpatialCompileError["code"]; readonly path: string;
  readonly partialMap: false; readonly callerUnchanged: true }[] = [];
for (const seed of seeds) {
  const scenarios = (["rect", "l", "alcove"] as const).flatMap(shape => [
    { key: shape, input: spaceCompilerFixture(seed, shape), outdoor: false },
    { key: `outdoor-${shape}`, input: outdoorShapeFixture(seed, shape), outdoor: true },
    { key: `outdoor-empty-${shape}`, input: reinstantiateSpace(outdoorShapeFixture(seed, shape), space => ({ ...space, objectSlots: [] })), outdoor: true },
  ]);
  for (const scenario of scenarios) {
    // Given: fresh immutable-input fingerprint, real tilesets and actual stored occurrences.
    const input = scenario.input;
    const before = JSON.stringify(input);
    // When: public compiler seam, followed by ordinary project IO in the independent oracle.
    const proposal = compileSpatialOccurrence(input, { occurrenceId: spaceRoot });
    // Then: actual raster cells, all ports, required access, identity and caller preservation.
    const receipt = inspectCompiledSpace(input, proposal);
    assert.equal(JSON.stringify(input), before);
    const repeated = compileSpatialOccurrence(proposal, { occurrenceId: spaceRoot });
    assert.deepEqual(repeated, proposal);
    const map = own<GameMap>(proposal.maps, receipt.mapId);
    const footprint = scenario.outdoor ? inspectOutdoorShape(proposal) : undefined;
    const mapFile = `maps/${scenario.key}-${seed}.json`;
    await writeFile(`${directory}/${mapFile}`, `${JSON.stringify(map, null, 2)}\n`);
    if (scenario.key === "rect") {
      await writeFile(`${directory}/contract/space-${seed}.json`, `${JSON.stringify({
        inputSHA256: sha256HexTextSync(before), spatialAuthoring: proposal.spatialAuthoring,
        tileset: own(proposal.tilesets, map.tilesetId),
      })}\n`);
    }
    receipts.push({ ...receipt, footprint, inputSHA256: sha256HexTextSync(before), mapFile, repeatedIdentically: true, callerUnchanged: true });
  }
  for (const shape of ["l", "alcove"] as const) for (const failure of ["entry", "port", "clipped"] as const) {
    const input = reinstantiateSpace(outdoorShapeFixture(seed, shape), space => {
      const corner = { id: spatialId("corner"), name: "Corner", x: 21, y: 0 };
      switch (failure) {
        case "entry": return { ...space, ports: [corner] };
        case "port": return { ...space, ports: [...space.ports, corner] };
        case "clipped": return { ...space, objectSlots: space.objectSlots.map(slot => slot.id === "tree-slot"
          ? { ...slot, placement: { mode: "fixed", x: 15, y: 1 } } : slot) };
        default: failure satisfies never; throw new TypeError("Unreachable failure variant");
      }
    });
    const before = JSON.stringify(input);
    assert.throws(() => compileSpatialOccurrence(input, { occurrenceId: spaceRoot }), error => {
      assert.ok(error instanceof SpatialCompileError);
      assert.equal(error.code, failure);
      rejections.push({ seed, code: error.code, path: error.path, partialMap: false, callerUnchanged: true });
      return true;
    });
    assert.equal(JSON.stringify(input), before);
  }
  // Deletion is an authored occurrence change, not permission to expand a missing repetition.
  const gap = spaceCompilerFixture(seed);
  const document = fixtureDocument(gap);
  const firstBed = findOccurrenceChildId(document, spaceRoot, { slotId: spatialId("beds"), index: 0 });
  assert.ok(firstBed);
  gap.spatialAuthoring = deleteSpatialOccurrence(document, gap, { occurrenceId: firstBed, externalConnections: "reject" });
  const gapOutput = compileSpatialOccurrence(gap, { occurrenceId: spaceRoot });
  const gapReceipt = inspectCompiledSpace(gap, gapOutput);
  assert.equal(gapReceipt.objects.length, 3);
  assert.equal(fixtureDocument(gapOutput).occurrences[firstBed], undefined);
  await writeFile(`${directory}/maps/deleted-repetition-${seed}.json`, `${JSON.stringify(own(gapOutput.maps, gapReceipt.mapId), null, 2)}\n`);
  receipts.push({ ...gapReceipt, deletedOccurrenceId: firstBed, mapFile: `maps/deleted-repetition-${seed}.json` });

  for (const failure of ["port", "atlas", "required"] as const) {
    const input = reinstantiateSpace(spaceCompilerFixture(seed), space => {
      switch (failure) {
        case "port": return { ...space, ports: [...space.ports, { id: spatialId("blocked"), name: "Blocked", x: 1, y: 4 }] };
        case "atlas": return { ...space, tilesetId: "easyrpg_chipset_combined_town" };
        case "required": return { ...space, objectSlots: space.objectSlots.map(slot => slot.id === "beds" ? { ...slot, quantity: 80 } : slot) };
        default: failure satisfies never; throw new TypeError("Unreachable failure variant");
      }
    });
    const before = JSON.stringify(input);
    assert.throws(() => compileSpatialOccurrence(input, { occurrenceId: spaceRoot }), error => {
      assert.ok(error instanceof SpatialCompileError);
      assert.equal(error.code, failure);
      rejections.push({ seed, code: error.code, path: error.path, partialMap: false, callerUnchanged: true });
      return true;
    });
    assert.equal(JSON.stringify(input), before);
  }
  const { project, ...stamp } = objectStampFixture();
  const stamped = compileSpatialOccurrence(project, stamp);
  const stampedMap = own<GameMap>(stamped.maps, stamp.target.mapId);
  assert.equal(stampedMap.lowerTiles[3 * stampedMap.width + 3], 402);
  assert.equal(stampedMap.upperTiles[5 * stampedMap.width + 4], 124);
  await writeFile(`${directory}/maps/object-${seed}.json`, `${JSON.stringify(stampedMap, null, 2)}\n`);
  const beforeStamp = JSON.stringify(project);
  assert.throws(() => compileSpatialOccurrence(project, { ...stamp, target: { ...stamp.target, rect: { ...stamp.target.rect, width: 2 } } }), error => {
    assert.ok(error instanceof SpatialCompileError);
    assert.equal(error.code, "clipped");
    rejections.push({ seed, code: error.code, path: error.path, partialMap: false, callerUnchanged: true });
    return true;
  });
  assert.equal(JSON.stringify(project), beforeStamp);
}
const report = { scenario: values.scenario, sourceSHA: sha, compilerImplemented: true, visualApproved: false,
  renderer: { requiredModel: "xai/grok-4.6", status: "separate approval outstanding" }, seeds, receipts, rejections };
await writeFile(`${directory}/accessibility.json`, `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report, null, 2));
break;
}
default: assertNever(values.scenario);
}
