import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { parseArgs } from "node:util";
import { deserialize, ProjectFormatError, serialize, serializePretty } from "../../src/project/io";
import { validateSpatialAuthoring } from "../../src/project/spatial/guards";
import { invalidAssociations, spatialAssociationsFixture } from "../../test/support/spatialAssociationsFixture";
import { emptySpatialDocument, spatialFixture, spatialWire } from "../../test/support/spatialSchemaFixture";

const { values } = parseArgs({ options: { scenario: { type: "string" }, evidence: { type: "string" } } });
assert.equal(values.scenario, "associations");
assert.ok(values.evidence);
const evidence = resolve(values.evidence);
await mkdir(evidence, { recursive: true });
const sha256 = (value: string) => createHash("sha256").update(value).digest("hex");
const formats = [["compact", serialize], ["pretty", serializePretty]] as const;
const reports = [];
for (const [format, write] of formats) {
  for (const completeness of ["complete", "incomplete", "historical"] as const) {
    // Given: base schema fixtures only, not instantiate/duplicate or another task7 implementation.
    const fixture = completeness === "incomplete" ? spatialFixture() : spatialAssociationsFixture();
    const { project } = fixture;
    if (completeness === "historical") for (const tileset of Object.values(project.tilesets)) tileset.structureKits = [];
    const document = completeness === "historical" ? { ...fixture.document, library: emptySpatialDocument().library } : fixture.document;
    const before = spatialWire(project, document);
    const path = resolve(evidence, `${completeness}-${format}.json`);
    // When: write the real serializer's bytes to disk, read those exact bytes, then use actual project IO.
    const wire = write({ ...project, spatialAuthoring: validateSpatialAuthoring(document) });
    await writeFile(path, wire);
    const persisted = await readFile(path, "utf8");
    const loaded = deserialize(persisted);
    // Then
    assert.equal(persisted, wire);
    assert.deepEqual(loaded.spatialAuthoring, document);
    assert.equal(loaded.version, 4);
    assert.equal(spatialWire(project, document), before);
    assert.ok(loaded.spatialAuthoring);
    const associations = Object.values(loaded.spatialAuthoring.occurrences).map(occurrence => ({
      id: occurrence.id, parentId: occurrence.parentId,
      ...(Object.hasOwn(occurrence, "parentSlot") ? { parentSlot: occurrence.parentSlot } : {}),
      ports: occurrence.snapshot.ports,
    }));
    if (completeness !== "incomplete") {
      const children = associations.filter(child => child.parentId === "opaque-room");
      assert.deepEqual(children.map(child => child.parentSlot?.index), [2, 0]);
      const room = associations.find(child => child.id === "opaque-room");
      assert.ok(room);
      assert.deepEqual(room.ports.map(port => ({ id: port.id, localPortId: Reflect.get(port, "localPortId") })), [
        { id: "opaque-port-B", localPortId: "terrainTemplates" },
        { id: "opaque-port-A", localPortId: "room-door" },
      ]);
    }
    reports.push({ format, completeness, file: path, wireSha256: sha256(persisted), fixtureSha256: sha256(JSON.stringify(document)),
      archiveSha256: sha256(loaded.spatialAuthoring.legacyImport.backup.json), associations, exactRoundtrip: true, sourceUnchanged: true });
  }
}
const invalid = invalidAssociations.map(({ name, field, change }) => {
  // Given
  const fixture = spatialAssociationsFixture();
  change(fixture);
  const wire = spatialWire(fixture.project, fixture.document);
  const path = `spatialAuthoring.${field.startsWith("library.") ? "" : "occurrences."}${field}`;
  // When / Then: failure must be the owning field, not a generic envelope error.
  let message = "";
  assert.throws(() => deserialize(wire), error => {
    assert.ok(error instanceof ProjectFormatError);
    assert.ok(error.message.startsWith(path), error.message);
    message = error.message;
    return true;
  });
  return { name, path, message, rejected: true };
});
const report = {
  scenario: values.scenario, verdict: "PASS", sha: execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(),
  dirty: execFileSync("git", ["status", "--porcelain"], { encoding: "utf8" }).trim().length > 0,
  base: "74d2cfda0730557b3f7bbd84623e80a89898b8d0", projectVersion: 4, spatialVersion: 1, reports, invalid,
};
await writeFile(resolve(evidence, "associations.json"), `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify({ verdict: report.verdict, sha: report.sha, dirty: report.dirty, roundtrips: reports.length, invalid: invalid.length, evidence }, null, 2));
