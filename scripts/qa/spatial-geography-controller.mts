import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { parseArgs } from "node:util";
import { createSpatialAuthoringController } from "../../src/editor/spatial/actions";
import { getMapEditHistoryEntries, resetMapEditHistory } from "../../src/editor/mapEditHistory";
import { serialize } from "../../src/project/io";
import { store } from "../../src/project/store";
import { sha256HexTextSync } from "../../src/util/sha256";
import { authoringValue } from "../../test/support/spatialAuthoringFixture";
import { geographyRoot } from "../../test/support/spatialGeographyFixture";
import { geographyControllerInput, geographyControllerFault } from "../../test/support/spatialGeographyControllerFixture";
import { inspectGeographyTraversal } from "../../test/support/spatialGeographyTraversal";
import { fixtureDocument } from "../../test/support/spatialSpaceCompilerFixture";

const { values } = parseArgs({ options: { evidence: { type: "string" } }, strict: true });
assert.ok(values.evidence, "A run-owned evidence directory is required");
const directory = values.evidence;
await mkdir(directory, { recursive: true });
store._setPersistenceStateForTest({ loaded: false, remotePersistenceEnabled: false, disabledReason: null });
const receipts = [];
for (const kind of ["region", "world"] as const) {
  // Given source-only fixtures and the real controller/store/history surface.
  store.replace(geographyControllerInput(kind));
  resetMapEditHistory();
  const before = serialize(store.getCurrent());
  const controller = createSpatialAuthoringController();
  // When actual geography is compiled, accepted and traversed through one undo/redo step.
  const preview = authoringValue(controller.preview(authoringValue(controller.createDraft()), { operation: { kind: "edit" }, compile: { occurrenceId: geographyRoot } }));
  assert.equal(serialize(store.getCurrent()), before);
  assert.equal(getMapEditHistoryEntries().length, 0);
  assert.equal(authoringValue(controller.apply(preview)).changed, true);
  assert.equal(getMapEditHistoryEntries().length, 1);
  const accepted = serialize(store.getCurrent());
  assert.equal(accepted, serialize(preview.project));
  const traversal = inspectGeographyTraversal(store.getCurrent());
  assert.equal(traversal.overviews.length, kind === "region" ? 1 : 4);
  assert.ok(traversal.routes.length > 0);
  assert.equal(controller.undo(), true);
  assert.equal(serialize(store.getCurrent()), before);
  assert.equal(controller.redo(), true);
  assert.equal(serialize(store.getCurrent()), accepted);
  // Then retain actual walking/interpreter routes and exact transaction hashes, not fabricated maps.
  await writeFile(`${directory}/${kind}-routes.json`, `${JSON.stringify(traversal, null, 2)}\n`);
  receipts.push({ kind, inputSHA256: sha256HexTextSync(before), acceptedSHA256: sha256HexTextSync(accepted),
    overviews: traversal.overviews.length, interpretedTransfers: traversal.routes.length,
    exactUndo: true, exactRedo: true, historyEntries: 1, impact: preview.impact });
}
// Given a preview followed by a valid logical-only change on the generated shared world.
const controller = createSpatialAuthoringController();
const preview = authoringValue(controller.preview(authoringValue(controller.createDraft()), { operation: { kind: "edit" } }));
store.update(project => {
  const doc = fixtureDocument(project);
  project.spatialAuthoring = { ...doc, connections: [...doc.connections].reverse() };
});
const changed = serialize(store.getCurrent());
// When the old full logical baseline is applied.
const stale = controller.apply(preview);
// Then its stale rejection preserves the exact competing edit.
assert.equal(stale.kind, "error");
assert.equal(stale.error.code, "stale");
assert.equal(serialize(store.getCurrent()), changed);
const rejections = [];
for (const fault of ["narrow-mountain", "mountain-overflow", "shared-atlas", "blocked-route"] as const) {
  store.replace(geographyControllerFault(fault));
  resetMapEditHistory();
  const original = serialize(store.getCurrent());
  const boundary = createSpatialAuthoringController();
  const rejected = boundary.preview(authoringValue(boundary.createDraft()), { operation: { kind: "edit" }, compile: { occurrenceId: geographyRoot } });
  assert.equal(rejected.kind, "error");
  assert.equal(rejected.error.code, "invalid");
  assert.equal(serialize(store.getCurrent()), original);
  assert.equal(getMapEditHistoryEntries().length, 0);
  rejections.push({ fault, ...rejected.error, inputSHA256: sha256HexTextSync(original), callerUnchanged: true });
}
const files = ["src/editor/spatial/actions.ts", "src/editor/spatial/preview.ts", "src/editor/spatial/authoringRefresh.ts",
  "src/editor/spatial/authoringOverview.ts", "src/editor/spatial/compileSpatialOccurrence.ts", "src/editor/spatial/compileGeography.ts",
  "src/editor/spatial/compileRegions.ts", "src/editor/spatial/compileWorlds.ts", "src/editor/spatial/geographyTerrain.ts",
  "src/editor/spatial/geographyStructures.ts", "src/editor/spatial/geographyEntries.ts", "src/editor/tools/types.ts",
  "test/support/spatialGeographyControllerFixture.ts", "test/support/spatialGeographyTraversal.ts", "test/support/spatialPlaceTraversal.ts"];
const sourceFiles = Object.fromEntries(await Promise.all(files.map(async path => [path, sha256HexTextSync(await readFile(path, "utf8"))])));
const report = { scenario: "geography-controller", sourceFiles, receipts, staleCode: stale.error.code, rejections,
  geographyCompilerIntegrated: true, contractFixturesOnly: true, remoteWrites: 0,
  combinedFixesAccepted: false, uiAcceptance: "pending" };
await writeFile(`${directory}/controller-geography.json`, `${JSON.stringify(report, null, 2)}\n`);
resetMapEditHistory();
console.log(JSON.stringify(report, null, 2));
