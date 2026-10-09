import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { parseArgs } from "node:util";
import { deserialize, ProjectFormatError, serialize, serializePretty } from "../../src/project/io";
import { isPassableLanding } from "../../src/project/collision";
import { computeReachableCells } from "../../src/project/lint/reachability";
import { isOwnedSpatialBinding } from "../../src/project/spatial/bindings";
import { own } from "../../src/project/spatial/domain";
import { deleteSpatialOccurrence, inspectSpatialOccurrenceDeletion } from "../../src/project/spatial/ownership";
import { sha256HexTextSync } from "../../src/util/sha256";
import { fixtureDocument } from "../../test/support/spatialSpaceCompilerFixture";
import { projectedStairOutput } from "../../test/support/spatialConnectionOutputFixture";
import { connectionRejections } from "../../test/support/spatialConnectionOwnershipFixture";

// Local numeric IO/consumer witness. No nested compiler, renderer, interpreter or DB.
const { values } = parseArgs({ options: {
  evidence: { type: "string" }, "parent-evidence": { type: "string" }, input: { type: "string" },
}, strict: true });
const directory = resolve(values.evidence ?? "output/evidence/tile-to-world/task-33");
await mkdir(directory, { recursive: true });
const sourceSHA = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
const errors: { readonly scenario: string; readonly error: string; readonly expected: boolean }[] = [];
const connections = [];
const ports = [];
const consumers = [];
const parents = [];
if (values.input) {
  try {
    const project = deserialize(await readFile(values.input, "utf8"));
    const document = fixtureDocument(project);
    connections.push(...document.connections);
    ports.push(...Object.values(document.occurrences).flatMap(occurrence => occurrence.bindings.map(binding => ({ occurrenceId: occurrence.id, ...binding }))));
  } catch (error) {
    if (!(error instanceof ProjectFormatError)) throw error;
    errors.push({ scenario: "input", error: error.message, expected: false });
    process.exitCode = 1;
  }
} else {
  for (const seed of [7, 19, 31]) {
    // Given: the same complete proposal as the parent's failing diagnostic witness.
    const witness = projectedStairOutput(seed);
    const { proposal, control, routes } = witness;
    const proposalWire = JSON.stringify(proposal);
    const controlWire = JSON.stringify(control);
    // Exact raw structural control: ONLY connectionIds differ, before normalization.
    assert.deepEqual(JSON.parse(JSON.stringify(proposal, (key, value: unknown) => key === "connectionIds" ? [] : value)), JSON.parse(controlWire));
    // When: actual project IO, both serialization forms, and actual ownership consumer.
    const loaded = deserialize(proposalWire);
    for (const encode of [serialize, serializePretty]) assert.deepEqual(deserialize(encode(loaded)), loaded);
    const document = fixtureDocument(loaded);
    const loadedControl = deserialize(controlWire);
    assert.deepEqual(loaded.maps, loadedControl.maps);
    assert.deepEqual(loaded.mapConnections, loadedControl.mapConnections);
    if (values["parent-evidence"]) {
      const parentWire = await readFile(resolve(values["parent-evidence"], `proposed-${seed}.json`), "utf8");
      const parentControlWire = await readFile(resolve(values["parent-evidence"], `control-${seed}.json`), "utf8");
      assert.deepEqual(JSON.parse(JSON.stringify(JSON.parse(parentWire), (key, value: unknown) => key === "connectionIds" ? [] : value)), JSON.parse(parentControlWire));
      const parent = deserialize(parentWire);
      assert.deepEqual(parent.spatialAuthoring, document);
      for (const mapId of new Set(witness.ports.map(port => port.mapId))) assert.deepEqual(parent.maps[mapId], loaded.maps[mapId]);
      parents.push({ seed, proposalSHA256: sha256HexTextSync(parentWire), controlSHA256: sha256HexTextSync(parentControlWire), accepted: true, exactControl: true });
    }
    const first = routes[0];
    assert.ok(first);
    const impact = inspectSpatialOccurrenceDeletion(document, loaded, first.from.occurrenceId);
    assert.deepEqual(impact.connections.map(link => link.id), [first.connectionId]);
    assert.deepEqual(impact.artifacts, []);
    const remaining = deleteSpatialOccurrence(document, loaded, { occurrenceId: first.from.occurrenceId, externalConnections: "remove" });
    const removedReload = deserialize(serializePretty({ ...loaded, spatialAuthoring: remaining }));
    assert.deepEqual(removedReload.maps, loaded.maps);
    assert.deepEqual(removedReload.mapConnections, loaded.mapConnections);
    assert.deepEqual(remaining.connections, document.connections.filter(link => link.id !== first.connectionId));
    for (const occurrence of Object.values(document.occurrences).filter(value => value.id !== first.from.occurrenceId)) {
      assert.deepEqual(remaining.occurrences[occurrence.id], { ...occurrence, bindings: occurrence.bindings.map(binding => isOwnedSpatialBinding(binding)
        ? { ...binding, connectionIds: binding.connectionIds.filter(id => id !== first.connectionId) } : binding) });
    }
    consumers.push({ seed, impact, remainingConnectionIds: remaining.connections.map(link => link.id), mapsAndEventsUnchanged: true,
      bindings: Object.values(remaining.occurrences).flatMap(occurrence => occurrence.bindings.filter(isOwnedSpatialBinding).map(binding => ({ occurrenceId: occurrence.id, connectionIds: binding.connectionIds }))) });
    for (const route of routes) {
      const map = own(loaded.maps, route.from.mapId);
      const target = own(loaded.maps, route.to.mapId);
      const owner = own(document.occurrences, route.from.ownerId ?? "");
      const entry = owner.bindings.flatMap(binding => binding.ports)[0];
      assert.ok(entry);
      assert.ok(computeReachableCells(loaded, map, entry.x, entry.y).has(`${route.from.x},${route.from.y}`));
      assert.ok(isPassableLanding(loaded, target, route.to.x, route.to.y));
      assert.deepEqual(route.commands, [{ kind: "transfer", mapId: target.id, x: route.to.x, y: route.to.y, fade: "black" }]);
      connections.push({ seed, ...route, sourceReachable: true, landingPassable: true });
    }
    ports.push({ seed, ports: witness.ports });
    await writeFile(`${directory}/proposed-${seed}.json`, `${proposalWire}\n`);
    await writeFile(`${directory}/control-${seed}.json`, `${controlWire}\n`);
  }
  for (const candidate of connectionRejections()) {
    try {
      deserialize(JSON.stringify(candidate.input));
      assert.fail(`Invalid input accepted: ${candidate.name}`);
    } catch (error) {
      if (!(error instanceof ProjectFormatError)) throw error;
      errors.push({ scenario: candidate.name, error: error.message, expected: true });
    }
  }
}
const result = { sourceSHA, nestedCompilerImplemented: false, interpreterExecuted: false, imagesGenerated: false,
  liveDBAccessed: false, parents, connections, ports, consumers, errors, exitCode: process.exitCode ?? 0 };
await writeFile(`${directory}/connections.json`, `${JSON.stringify(result, null, 2)}\n`);
await writeFile(`${directory}/ports.json`, `${JSON.stringify(ports, null, 2)}\n`);
await writeFile(`${directory}/errors.json`, `${JSON.stringify(errors, null, 2)}\n`);
process.stdout.write(`${JSON.stringify(result)}\n`);
