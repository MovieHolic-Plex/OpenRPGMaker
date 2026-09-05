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
      export { M2_COMMAND_CATALOG } from './src/project/eventCommands/m2Catalog';`,
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
assert.deepEqual(manifest.counts, {
  nativeKinds: authoritative.COMMAND_KINDS.length,
  catalogIds: authoritative.M2_COMMAND_CATALOG.length,
  eventEditorFiles: files.length,
  featureSurfaces: manifest.featureSurfaces.length,
});
const evidence = new Set(manifest.evidence.map(row => row.id));
const findings = new Set(manifest.findings.map(row => row.id));
const surfaces = new Set(manifest.featureSurfaces.map(row => row.id));
assert.equal(surfaces.size, manifest.featureSurfaces.length, "duplicate feature surfaces");
for (const row of [...manifest.nativeCommands, ...manifest.m2Catalog, ...manifest.files, ...manifest.featureSurfaces, ...manifest.findings]) {
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
