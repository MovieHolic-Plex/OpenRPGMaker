import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parseArgs } from "node:util";
import { canMove, isPassableLanding } from "../../src/project/collision";
import { deserialize, ProjectFormatError, serialize, serializePretty } from "../../src/project/io";
import { computeReachableCells } from "../../src/project/lint/reachability";
import { own, spatialId } from "../../src/project/spatial/domain";
import { duplicateSpatialOccurrence } from "../../src/project/spatial/duplicate";
import { deleteSpatialOccurrence, detachSpatialOccurrence, inspectSpatialOccurrenceDeletion, occurrenceSubtree } from "../../src/project/spatial/ownership";
import type { SpatialAuthoringDocument } from "../../src/project/spatial/types";
import provenance from "../../test/fixtures/spatial-projections/provenance.json";
import { projectionFixture, savedProjectionInput } from "../../test/support/spatialProjectionFixture";

const { values } = parseArgs({ options: { output: { type: "string" } }, strict: true });
const directory = values.output ?? await mkdtemp(join(tmpdir(), "spatial-projections-"));
await mkdir(directory, { recursive: true });
const sha = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
const digest = (value: unknown): string => createHash("sha256").update(JSON.stringify(value)).digest("hex");
const receipts = [];
for (const seed of [7, 19, 31] as const) {
  // Given: saved passable stair output from the independently reproduced task8 probe.
  const { project, document, root, child, map, owned, projection, parentPort, childPort } = savedProjectionInput(seed);
  const before = JSON.stringify(project);
  const sourceReceipt = provenance.receipts.find(receipt => receipt.seed === seed);
  assert.ok(sourceReceipt);
  assert.equal(digest(map), sourceReceipt.mapDigest);
  const ownedChild = { ...owned, rect: projection.rect, ports: projection.ports };
  const overlapping: SpatialAuthoringDocument = { ...document, occurrences: { ...document.occurrences,
    [root.id]: { ...root, bindings: [{ ...owned, rect: projection.rect }] }, [child.id]: { ...child, bindings: [ownedChild] },
  } };
  let ownedRejection = "";
  assert.throws(() => deserialize(JSON.stringify({ ...project, spatialAuthoring: overlapping })), (error: unknown) => {
    assert.ok(error instanceof ProjectFormatError);
    ownedRejection = error.message;
    return error.message === `spatialAuthoring.occurrences.${child.id}.bindings[0].rect: overlapping ownership`;
  });
  const candidate: SpatialAuthoringDocument = { ...document, occurrences: { ...document.occurrences,
    [root.id]: { ...root, bindings: [owned] }, [child.id]: { ...child, bindings: [projection] },
  } };
  const input = { ...project, spatialAuthoring: candidate };
  // When: persist both actual IO encodings to disk, then reload through the project boundary.
  const encodings = [{ name: "compact", encode: serialize }, { name: "pretty", encode: serializePretty }] as const;
  const reloads = [];
  for (const { name, encode } of encodings) {
    const path = join(directory, `seed-${seed}-${name}.json`);
    const wire = encode(input);
    await writeFile(path, wire);
    const loaded = deserialize(await readFile(path, "utf8"));
    // Then: ports stay at authored coordinates; the saved map remains exact and traversable.
    assert.deepEqual(loaded.spatialAuthoring, candidate);
    const loadedMap = own(loaded.maps, map.id);
    assert.deepEqual(loadedMap, map);
    assert.equal(isPassableLanding(loaded, loadedMap, 7, 11), true);
    assert.equal(canMove(loaded, loadedMap, 7, 10, 7, 11), true);
    assert.equal(canMove(loaded, loadedMap, 7, 11, 7, 10), true);
    const reachable = computeReachableCells(loaded, loadedMap, 7, 10);
    assert.equal(reachable.has("7,11"), true);
    const bound = loaded.spatialAuthoring;
    assert.ok(bound);
    assert.deepEqual(own(bound.occurrences, root.id).bindings[0]?.ports, [parentPort]);
    assert.deepEqual(own(bound.occurrences, child.id).bindings[0]?.ports, [childPort]);
    const space = own(root.snapshot.library.spaces, root.source.id);
    const requiredObjects = space.objectSlots.filter(slot => slot.required).reduce((count, slot) => count + slot.quantity, 0);
    const accessibleRequiredObjects = [...Object.values(bound.occurrences)].filter(occurrence => occurrence.parentId === root.id
      && space.objectSlots.some(slot => slot.required && slot.id === occurrence.parentSlot?.slotId)
      && occurrence.bindings.some(binding => binding.ports.some(port => reachable.has(`${port.x},${port.y}`)))).length;
    assert.equal(accessibleRequiredObjects, requiredObjects);
    reloads.push({ encoding: name, bytes: Buffer.byteLength(wire), mapDigest: digest(loadedMap), reachableCells: reachable.size,
      requiredObjects, accessibleRequiredObjects, parentPort, childPort,
      lowerAtEntry: loadedMap.lowerTiles[11 * loadedMap.width + 7], upperAtEntry: loadedMap.upperTiles[11 * loadedMap.width + 7] });
  }
  assert.equal(JSON.stringify(project), before);
  receipts.push({ seed, mapId: map.id, width: map.width, height: map.height, ownedRejection, jointlyValidBindings: 2, reloads });
}

// Given: two projections, owned events, unrelated ownership and no live source definitions.
const { project, document, root, child, peer, other, links, rootOwned, projection } = projectionFixture();
const before = JSON.stringify({ project, document });
// When / Then: exercise each real task7 consumer, including the error path.
const impact = inspectSpatialOccurrenceDeletion(document, project, root.id);
assert.deepEqual(impact.artifacts, [{ occurrenceId: root.id, binding: rootOwned }]);
assert.deepEqual(impact.projections, [{ occurrenceId: child.id, binding: projection }]);
const childImpact = inspectSpatialOccurrenceDeletion(document, project, child.id);
assert.equal(childImpact.artifacts.length, 0);
assert.equal(childImpact.projections.length, 1);
assert.throws(() => deleteSpatialOccurrence(document, project, { occurrenceId: child.id, externalConnections: "reject" }), { code: "external-connection" });
const deleted = deleteSpatialOccurrence(document, project, { occurrenceId: child.id, externalConnections: "remove" });
assert.deepEqual(deleted.connections, [links[1]]);
assert.deepEqual(own(deleted.occurrences, root.id).bindings, [{ ...rootOwned, connectionIds: [links[1]?.id] }]);
assert.deepEqual(deleted.occurrences[peer.id], document.occurrences[peer.id]);
assert.deepEqual(deleted.occurrences[other.id], document.occurrences[other.id]);
const detached = detachSpatialOccurrence(document, project, root.id);
assert.deepEqual(detached, { ...document, occurrences: { ...document.occurrences,
  [root.id]: { ...own(document.occurrences, root.id), bindings: [] }, [child.id]: { ...own(document.occurrences, child.id), bindings: [] },
} });
const copy = duplicateSpatialOccurrence(document, project, { occurrenceId: root.id, rootId: "qa-copy", externalConnections: "omit" });
const copiedIds = occurrenceSubtree(copy, spatialId("qa-copy"));
assert.equal(copiedIds.length, 2);
assert.deepEqual(copiedIds.flatMap(id => own(copy.occurrences, id).bindings), []);
for (const original of Object.values(document.occurrences)) assert.deepEqual(copy.occurrences[original.id], original);
assert.equal(copy.connections.length, document.connections.length + 1);
for (const result of [deleted, detached, copy]) {
  const loaded = deserialize(serialize({ ...project, spatialAuthoring: result }));
  assert.deepEqual(loaded.spatialAuthoring, result);
  assert.deepEqual(loaded.maps, project.maps);
}
assert.equal(JSON.stringify({ project, document }), before);
const report = { status: "PASS", sha, baseSha: provenance.baseSha, compilerImplemented: false, renderedApproval: false, receipts,
  lifecycle: { ownedArtifacts: impact.artifacts.length, projections: impact.projections.length, projectedChildOwnedArtifacts: childImpact.artifacts.length,
    retainedConnectionsAfterDelete: deleted.connections.length, copiedOccurrences: copiedIds.length, addedInternalConnections: copy.connections.length - document.connections.length,
    liveSourceDefinitions: Object.values(document.library).reduce((count, collection) => count + Object.keys(collection).length, 0), mapsAndOriginalsUnchanged: true } };
await writeFile(join(directory, "projection.json"), `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report, null, 2));
