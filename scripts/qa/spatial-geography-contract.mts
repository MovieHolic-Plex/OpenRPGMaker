import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { parseArgs } from "node:util";
import { deserialize, serialize, serializePretty } from "../../src/project/io";
import { own, spatialId } from "../../src/project/spatial/domain";
import { isOwnedSpatialBinding } from "../../src/project/spatial/bindings";
import { resolveCompiledPort } from "../../src/editor/spatial/compileConnections";
import { resolveOverviewEntry, validateOverviewAccess } from "../../src/editor/spatial/overviewEntries";
import { spatialRasterDigest } from "../../src/editor/spatial/compilerValidation";
import { sha256HexTextSync } from "../../src/util/sha256";
import type { Project } from "../../src/project/types";
import { geographyOutputContract } from "../../test/support/spatialGeographyOutputContract";
import { geographyRoot } from "../../test/support/spatialGeographyFixture";
import { associateIndependentWitness } from "../../test/support/spatialOverviewArchived";
import { inspectNestedTraversal } from "../../test/support/spatialPlaceTraversal";
import { fixtureDocument } from "../../test/support/spatialSpaceCompilerFixture";

const { values } = parseArgs({ options: { evidence: { type: "string" }, seeds: { type: "string", default: "109" },
  independent: { type: "string" }, "require-complete": { type: "boolean", default: false },
  "incomplete-input": { type: "boolean", default: false } }, strict: true });
assert.match(values.seeds, /^\d+(,\d+)*$/);
const seeds = values.seeds.split(",").map(Number);
assert.ok(seeds.every(seed => Number.isSafeInteger(seed) && seed >= 0 && seed <= 2147483647));
const directory = values.evidence ?? "output/evidence/tile-to-world/task-34/witness";
await mkdir(directory, { recursive: true });
const sourceSHA = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();

function inspect(project: Project, ownerId: ReturnType<typeof spatialId>) {
  const loaded = deserialize(serialize(project));
  assert.deepEqual(deserialize(serializePretty(loaded)).spatialAuthoring, loaded.spatialAuthoring);
  const document = fixtureDocument(loaded);
  const owner = own(document.occurrences, ownerId);
  const binding = owner.bindings.find(isOwnedSpatialBinding);
  assert.ok(binding);
  const start = binding.ports[0];
  assert.ok(start);
  validateOverviewAccess(loaded, ownerId, { mapId: binding.mapId, x: start.x, y: start.y });
  const markers = (binding.overviewEntries ?? []).map(entry => {
    const source = resolveOverviewEntry(document, ownerId, entry.target);
    const landing = resolveCompiledPort({ project: loaded, occurrences: document.occurrences }, entry.target);
    assert.notDeepEqual({ x: source.x, y: source.y }, { x: landing.x, y: landing.y });
    return { source, landing };
  });
  assert.equal(markers.length, 2);
  assert.equal(binding.connectionIds.length, 1);
  assert.equal(document.connections.filter(link => link.overviewRoute?.occurrenceId === ownerId).length, 1);
  assert.equal(spatialRasterDigest(own(loaded.maps, binding.mapId), binding), binding.contentDigest);
  const traversal = inspectNestedTraversal(loaded);
  assert.equal(traversal.routes.length, 4);
  return { project: loaded, receipt: { markers, declaredEntry: start, connectionIds: binding.connectionIds,
    overviewRoute: document.connections.map(link => link.overviewRoute), traversal, rasterDigest: binding.contentDigest,
    completeBookkeepingAccepted: true, geographyCompilerImplemented: false } };
}
const receipts = [];
for (const seed of seeds) {
  const witness = geographyOutputContract(seed);
  assert.equal(serialize(witness.input), witness.before);
  assert.deepEqual(witness.complete.maps, witness.incompleteControl.maps);
  assert.deepEqual(witness.complete.mapConnections, witness.incompleteControl.mapConnections);
  assert.throws(() => deserialize(JSON.stringify(witness.incompleteControl)), /connectionIds/);
  assert.throws(() => deserialize(JSON.stringify(witness.duplicatedPorts)), /ports/);
  if (values["incomplete-input"]) deserialize(JSON.stringify(witness.incompleteControl));
  const accepted = inspect(witness.complete, geographyRoot);
  await writeFile(`${directory}/complete-${seed}.json`, serialize(accepted.project));
  receipts.push({ seed, source: "submitted-task10-witness", inputSHA256: sha256HexTextSync(witness.before), ...accepted.receipt });
}
if (values.independent !== undefined) for (const seed of [43, 271]) {
  const path = `${values.independent}/complete-${seed}.json`;
  const raw = await readFile(path, "utf8");
  let originalError = "";
  assert.throws(() => deserialize(raw), error => {
    assert.ok(error instanceof Error);
    originalError = error.message;
    return error.message.includes("connectionIds");
  });
  const accepted = inspect(associateIndependentWitness(JSON.parse(raw)), spatialId("Q:96f4|opaque"));
  // The reviewed explicit association proposal changes metadata only, not numeric output.
  const original: unknown = JSON.parse(raw);
  assert.ok(original !== null && typeof original === "object");
  assert.deepEqual(accepted.project.maps, Reflect.get(original, "maps"));
  assert.deepEqual(accepted.project.mapConnections, Reflect.get(original, "mapConnections"));
  await writeFile(`${directory}/independent-complete-${seed}.json`, serialize(accepted.project));
  receipts.push({ seed, source: path, inputSHA256: sha256HexTextSync(raw), originalError, ...accepted.receipt });
}
const report = { sourceSHA, scenario: "overview-route-entry-associations", requiredComplete: values["require-complete"],
  receipts, geographyCompilerImplemented: false, task11TransactionsImplemented: false, remoteWrites: 0 };
await writeFile(`${directory}/green.json`, JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
