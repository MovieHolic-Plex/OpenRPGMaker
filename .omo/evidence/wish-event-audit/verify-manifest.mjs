// Audit inventory validator, not a product behavior test. Run from repository root.
import assert from "node:assert/strict";
import fs from "node:fs";
import crypto from "node:crypto";
import { build } from "esbuild";

const base = ".omo/evidence/wish-event-audit";
const manifest = JSON.parse(fs.readFileSync(`${base}/manifest.json`, "utf8"));
const result = await build({
  stdin: {
    contents: `export { COMMAND_KINDS } from './src/project/commandKindRegistry';
      export { M2_COMMAND_CATALOG, isM2CatalogEntrySelectableInMap } from './src/project/eventCommands/m2Catalog';
      export { COMMAND_PRESENTATION_DESCRIPTORS } from './src/editor/eventCommands/commandPresentation';`,
    resolveDir: process.cwd(),
  },
  bundle: true, platform: "node", format: "esm", write: false,
});
const authoritative = await import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString("base64")}`);
const directory = "src/editor/panels/eventEditor";
const files = fs.readdirSync(directory, { recursive: true })
  .map(name => `${directory}/${name}`).filter(name => fs.statSync(name).isFile());
function compare(label, actual, expected) {
  assert.equal(new Set(actual).size, actual.length, `${label}: duplicate manifest keys`);
  assert.equal(new Set(expected).size, expected.length, `${label}: duplicate authoritative keys`);
  assert.deepEqual([...actual].sort(), [...expected].sort(), `${label}: missing or extra keys`);
  console.log(`${label}: ${actual.length} entries, missing=0 extra=0 duplicates=0`);
}
compare("nativeKinds", manifest.nativeCommands.map(row => row.kind), authoritative.COMMAND_KINDS);
compare("catalogIds", manifest.m2Catalog.map(row => row.id), authoritative.M2_COMMAND_CATALOG.map(row => row.id));
compare("eventEditorFiles", manifest.files.map(row => row.path), files);
// Reconcile the combined visible tab inventory, not insertion behavior.
// commandPicker.ts uses native descriptor visibility for aliases and native-only
// rows, catalog map selection for raw-M2 rows, and skips deprecated rows.
const descriptors = new Map(authoritative.COMMAND_PRESENTATION_DESCRIPTORS.map(row => [row.kind, row]));
const canonical = new Map();
for (const row of authoritative.M2_COMMAND_CATALOG) {
  if (row.existingKind && !canonical.has(row.existingKind)) canonical.set(row.existingKind, row.id);
}
const expectedPicker = authoritative.M2_COMMAND_CATALOG
  .filter(row => !row.deprecated && (row.existingKind
    ? descriptors.get(row.existingKind).selectable
    : authoritative.isM2CatalogEntrySelectableInMap(row)))
  .map(row => ({
    id: row.id, page: row.pickerPage,
    testId: `command-picker-add-${row.existingKind && canonical.get(row.existingKind) === row.id ? row.existingKind : row.id}`,
  }));
for (const row of descriptors.values()) {
  if (row.kind !== "m2Command" && row.selectable && !canonical.has(row.kind)) {
    expectedPicker.push({ id: row.kind, page: row.page, testId: `command-picker-add-${row.kind}` });
  }
}
compare("combinedPickerEntries", manifest.combinedPickerEntries.map(row => row.id), expectedPicker.map(row => row.id));
compare("combinedPickerTestIds", manifest.combinedPickerEntries.map(row => row.testId), expectedPicker.map(row => row.testId));
for (const row of manifest.combinedPickerEntries) {
  const expected = expectedPicker.find(entry => entry.id === row.id);
  assert.equal(row.page, expected.page, `picker page ${row.id}`);
  assert.equal(row.testId, expected.testId, `picker test ID ${row.id}`);
}
for (const tab of manifest.pickerCensus.tabs) {
  const count = expectedPicker.filter(row => row.page === tab.page).length;
  assert.equal(tab.sourceDerivedEntries, count);
  assert.equal(tab.reportedRenderedIds, count, `source count differs from supervisor census on page ${tab.page}`);
}
assert.equal(manifest.pickerCensus.distinctRenderedIds, expectedPicker.length);
console.log("Supervisor census counts match source: 37/21/44/26. Exact browser ID-set equality and insertion remain unverified.");
assert.deepEqual(manifest.counts, {
  nativeKinds: authoritative.COMMAND_KINDS.length,
  catalogIds: authoritative.M2_COMMAND_CATALOG.length,
  eventEditorFiles: files.length,
  featureSurfaces: manifest.featureSurfaces.length,
  combinedPickerEntries: expectedPicker.length,
});
const evidence = new Set(manifest.evidence.map(row => row.id));
const findings = new Set(manifest.findings.map(row => row.id));
const surfaces = new Set(manifest.featureSurfaces.map(row => row.id));
assert.equal(surfaces.size, manifest.featureSurfaces.length, "duplicate feature surfaces");
for (const row of [...manifest.nativeCommands, ...manifest.m2Catalog, ...manifest.files, ...manifest.featureSurfaces, ...manifest.findings, ...manifest.combinedPickerEntries]) {
  assert.ok(row.initial && row.final, "missing initial/final classification");
  for (const id of row.evidence ?? []) assert.ok(evidence.has(id), `unknown evidence ${id}`);
  for (const id of row.findingIds ?? []) assert.ok(findings.has(id), `unknown finding ${id}`);
}
for (const row of manifest.files) {
  assert.ok(surfaces.has(row.surfaceId), `unknown surface ${row.path}`);
  assert.equal(crypto.createHash("sha256").update(fs.readFileSync(row.path)).digest("hex"), row.sha256, `changed source ${row.path}`);
}
for (const row of manifest.nativeCommands) {
  assert.ok(row.factory && row.form && row.handler, `missing command mapping ${row.kind}`);
  compareAliases(row);
}
function compareAliases(row) {
  assert.deepEqual([...row.catalogIds].sort(), authoritative.M2_COMMAND_CATALOG.filter(entry => entry.existingKind === row.kind).map(entry => entry.id).sort());
}
for (const row of manifest.m2Catalog) {
  const entry = authoritative.M2_COMMAND_CATALOG.find(entry => entry.id === row.id);
  assert.equal(row.existingKind, entry.existingKind ?? null, `native conversion ${row.id}`);
  assert.deepEqual(row.deprecated, entry.deprecated ?? null, `deprecation ${row.id}`);
}
console.log(`source hashes: ${manifest.files.length} matched; mappings, aliases, evidence links and initial/final columns valid`);
console.log("Inventory verification passed. This is not a runtime, UI or repair PASS.");
