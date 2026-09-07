import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { parseArgs } from "node:util";
import { resolve } from "node:path";
import { createHash } from "node:crypto";
import { deserialize, ProjectFormatError, serialize, serializePretty } from "../../src/project/io";
import { validateProjectV4 } from "../../src/project/io/shape";
import { emptySpatialDocument, placeDesign, spatialBindingFixture, spatialFixture, spatialHierarchyFixture, spatialOpaqueIdFixtures, spatialProject, spatialWire } from "../../test/support/spatialSchemaFixture";

const { values } = parseArgs({ options: { scenario: { type: "string" }, evidence: { type: "string", default: "output/evidence/tile-to-world/task-3" } } });
assert.equal(values.scenario, "schema", "Supported scenario: --scenario schema");
const output = resolve(values.evidence);
const results: { readonly scenario: string; readonly accepted: boolean; readonly diagnostic?: string }[] = [];
function accept(scenario: string, document: unknown): void {
  const { project } = spatialProject();
  const loaded = deserialize(spatialWire(project, document));
  assert.deepEqual(deserialize(serialize(loaded)).spatialAuthoring, document);
  assert.deepEqual(deserialize(serializePretty(loaded)).spatialAuthoring, document);
  assert.equal(loaded.version, 4);
  results.push({ scenario, accepted: true });
}
function reject(scenario: string, document: unknown, path: string): void {
  const { project } = spatialProject();
  assert.throws(() => deserialize(spatialWire(project, document)), (error: unknown) => {
    assert.ok(error instanceof ProjectFormatError);
    assert.ok(error.message.includes(path), `${scenario}: expected record path ${path}, got ${error.message}`);
    results.push({ scenario, accepted: false, diagnostic: error.message });
    return true;
  });
}
const { document, project } = spatialFixture();
accept("empty-canonical", emptySpatialDocument());
accept("repeated-designs-distinct-occurrences", document);
accept("complete-five-tier-library", spatialHierarchyFixture().document);
accept("disjoint-owned-map-bindings", spatialBindingFixture().document);
for (const fixture of spatialOpaqueIdFixtures()) accept(fixture.scenario, fixture.document);
const third = { ...structuredClone(document.occurrences["occ-b"]), id: "occ-c" };
third.snapshot.ports = [{ id: "port-c", name: "Door", x: 0, y: 2 }];
accept("navigation-three-cycle", {
  ...document, occurrences: { ...document.occurrences, "occ-c": third }, rootOccurrenceIds: ["occ-a", "occ-b", "occ-c"], connections: [
    ...document.connections,
    { id: "b-c", from: { occurrenceId: "occ-b", portId: "port-b" }, to: { occurrenceId: "occ-c", portId: "port-c" }, bidirectional: true },
    { id: "c-a", from: { occurrenceId: "occ-c", portId: "port-c" }, to: { occurrenceId: "occ-a", portId: "port-a" }, bidirectional: true },
  ],
});
reject("unsupported-version", { ...document, version: 2 }, "spatialAuthoring.version");
reject("design-three-cycle", { ...document, library: { ...document.library, places: {
  a: placeDesign("a", "b", "place"), b: placeDesign("b", "c", "place"), c: placeDesign("c", "a", "place"),
} } }, "children");
reject("illegal-kind-edge", { ...document, library: { ...document.library, places: { inn: placeDesign("inn", "desk", "object") } } }, "source.kind");
reject("multiple-parents", { ...document, occurrences: { ...document.occurrences, "occ-a": { ...document.occurrences["occ-a"], parentId: ["occ-b", "occ-c"] } } }, "parentId");
reject("fractional-coordinate", { ...document, occurrences: { ...document.occurrences, "occ-a": { ...document.occurrences["occ-a"], x: 0.5 } } }, "occurrences.occ-a.x");
reject("nan-wire-becomes-null", { ...document, occurrences: { ...document.occurrences, "occ-a": { ...document.occurrences["occ-a"], x: Number.NaN } } }, "occurrences.occ-a.x");
reject("missing-object", { ...document, library: { ...document.library, objects: {} } }, "objectDesignId");
reject("foreign-port", { ...document, connections: [{ ...document.connections[0], to: { occurrenceId: "occ-b", portId: "port-a" } }] }, "to.portId");
assert.throws(() => validateProjectV4({ ...project, spatialAuthoring: { ...document, occurrences: { ...document.occurrences, "occ-a": { ...document.occurrences["occ-a"], x: Number.NaN } } } }), ProjectFormatError);
results.push({ scenario: "nan-direct-io-boundary", accepted: false });
const loaded = deserialize(spatialWire(project, document));
assert.ok(loaded.spatialAuthoring);
assert.equal(loaded.spatialAuthoring.legacyImport.backup.json, document.legacyImport.backup.json);
assert.equal(loaded.spatialAuthoring.legacyImport.backup.sha256, createHash("sha256").update(document.legacyImport.backup.json).digest("hex"));
await mkdir(output, { recursive: true });
const evidence = { scenario: "schema", verdict: "passed", serializer: "src/project/io/serialize.ts", projectVersion: loaded.version, spatialVersion: loaded.spatialAuthoring.version, results, archive: { bytes: Buffer.byteLength(document.legacyImport.backup.json), actualSha256: createHash("sha256").update(document.legacyImport.backup.json).digest("hex"), storedSha256: loaded.spatialAuthoring.legacyImport.backup.sha256 }, remoteWrites: 0 };
await writeFile(resolve(output, "schema.json"), `${JSON.stringify(evidence, null, 2)}\n`);
console.log(JSON.stringify({ scenario: "schema", verdict: evidence.verdict, cases: results.length, evidence: resolve(output, "schema.json") }));
