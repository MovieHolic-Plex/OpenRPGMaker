import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { parseArgs } from "node:util";
import { createSpatialAuthoringController } from "../../src/editor/spatial/actions";
import { getMapEditHistoryEntries, resetMapEditHistory } from "../../src/editor/mapEditHistory";
import { store } from "../../src/project/store";
import { sha256HexTextSync } from "../../src/util/sha256";
import { authoringValue } from "../../test/support/spatialAuthoringFixture";
import { objectStampFixture, spaceCompilerFixture, spaceRoot } from "../../test/support/spatialSpaceCompilerFixture";
import { placeCompilerFixture, placeRoot } from "../../test/support/spatialPlaceCompilerFixture";

const { values } = parseArgs({ options: { scenario: { type: "string" }, evidence: { type: "string" } }, strict: true });
assert.equal(values.scenario, "preview-history");
assert.ok(values.evidence, "A run-owned evidence directory is required");
const directory = values.evidence;
await mkdir(directory, { recursive: true });
// This driver never loads a remote project or enables autosave/publication.
store._setPersistenceStateForTest({ loaded: false, remotePersistenceEnabled: false, disabledReason: null });
const object = objectStampFixture();
const scenarios = [
  { kind: "object", input: object.project, compile: { occurrenceId: object.occurrenceId, target: object.target } },
  { kind: "space", input: spaceCompilerFixture(), compile: { occurrenceId: spaceRoot } },
  { kind: "place", input: placeCompilerFixture(), compile: { occurrenceId: placeRoot } },
];
const receipts = [];
for (const scenario of scenarios) {
  // Given real engine data and the actual singleton store/history surface.
  store.replace(scenario.input);
  resetMapEditHistory();
  const before = structuredClone(store.getCurrent());
  const controller = createSpatialAuthoringController();
  // When an explicit compilation is previewed, accepted, undone and redone.
  const preview = authoringValue(controller.preview(authoringValue(controller.createDraft()), { operation: { kind: "edit" }, compile: scenario.compile }));
  assert.deepEqual(store.getCurrent(), before);
  assert.equal(getMapEditHistoryEntries().length, 0);
  assert.equal(authoringValue(controller.apply(preview)).changed, true);
  const accepted = structuredClone(store.getCurrent());
  assert.deepEqual(accepted, preview.project);
  assert.equal(getMapEditHistoryEntries().length, 1);
  assert.equal(controller.undo(), true);
  assert.deepEqual(store.getCurrent(), before);
  assert.equal(controller.redo(), true);
  assert.deepEqual(store.getCurrent(), accepted);
  // Then exact snapshots and the disclosed impact are retained as machine-readable evidence.
  receipts.push({ kind: scenario.kind, beforeSHA256: sha256HexTextSync(JSON.stringify(before)),
    acceptedSHA256: sha256HexTextSync(JSON.stringify(accepted)), exactUndo: true, exactRedo: true,
    historyEntries: getMapEditHistoryEntries().length, impact: preview.impact });
}
// Given a detached proposal followed by a separate human mutation.
const controller = createSpatialAuthoringController();
const preview = authoringValue(controller.preview(authoringValue(controller.createDraft()), { operation: { kind: "edit" } }));
store.update(project => { project.meta.title = "Independent human edit"; });
const beforeRejection = structuredClone(store.getCurrent());
const historyBeforeRejection = getMapEditHistoryEntries();
// When the stale proposal is accepted through the same public action.
const rejected = controller.apply(preview);
// Then the actual store and history remain exactly at the human edit.
assert.equal(rejected.kind, "error");
assert.equal(rejected.error.code, "stale");
assert.deepEqual(store.getCurrent(), beforeRejection);
assert.deepEqual(getMapEditHistoryEntries(), historyBeforeRejection);
const sourceFiles = ["src/editor/spatial/authoringTypes.ts", "src/editor/spatial/actions.ts", "src/editor/spatial/preview.ts",
  "src/editor/spatial/authoringOperations.ts", "src/editor/spatial/authoringRefresh.ts", "src/editor/spatial/authoringOverview.ts",
  "src/editor/spatial/authoringConnections.ts", "src/project/spatial/overviewPairs.ts",
  "src/editor/mapEditHistory.ts", "src/project/store.ts"];
const source = Object.fromEntries(await Promise.all(sourceFiles.map(async path => [path, sha256HexTextSync(await readFile(path, "utf8"))])));
const report = { scenario: values.scenario, source, receipts, staleApply: rejected.error.code,
  remoteWrites: 0, geographyCompilerIntegrated: false, uiAcceptance: "pending-parent-integration" };
await writeFile(`${directory}/transaction-hashes.json`, `${JSON.stringify(report, null, 2)}\n`);
resetMapEditHistory();
console.log(JSON.stringify(report, null, 2));
