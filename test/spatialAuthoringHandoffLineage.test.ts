import { afterEach, expect, it } from "vitest";
import { getMapEditHistoryEntries } from "../src/editor/mapEditHistory";
import { applyAuthoringPreview, bindSpatialAuthoringControllerFactory, editAuthoringDraft, previewAuthoringDraft, retainAuthoringPreview, spatialAuthoringController, visibleAuthoringProject } from "../src/editor/panels/spatialAuthoringAccess";
import { spatialSession } from "../src/editor/panels/spatialAuthoringSession";
import { previewSpatialSourceBuild, spatialBuildProposal } from "../src/editor/panels/spatialBuildActions";
import { own, spatialId } from "../src/project/spatial/domain";
import { store } from "../src/project/store";
import type { Project } from "../src/project/types";
import { authoringValue } from "./support/spatialAuthoringFixture";
import { manualBuildFixture } from "./support/spatialManualBuildFixture";
import { fixtureDocument, spaceDesign } from "./support/spatialSpaceCompilerFixture";

afterEach(() => bindSpatialAuthoringControllerFactory(null));

function controller() {
  const value = spatialAuthoringController();
  if (!value) throw new TypeError("Missing shared controller");
  return value;
}
function revision(project: Project, value: number): Project {
  const doc = fixtureDocument(project);
  return { ...project, spatialAuthoring: { ...doc, library: { ...doc.library, spaces: { ...doc.library.spaces,
    [spaceDesign]: { ...own(doc.library.spaces, spaceDesign), revision: value } } } } };
}

it("preserves the entire pending build when an obsolete same-controller preview is handed off", () => {
  // Given: original MB-HANDOFF-SESSION-LINEAGE sequence.
  const { project } = manualBuildFixture();
  const shared = controller();
  const earlierDraft = authoringValue(editAuthoringDraft(project => revision(project, 2)));
  const earlier = authoringValue(shared.preview(earlierDraft, { operation: { kind: "edit" } }));
  authoringValue(editAuthoringDraft(project => revision(project, 3)));
  const input = { source: { kind: "space", id: spaceDesign }, rootId: spatialId("must-survive-handoff"), seed: 19,
    destination: { kind: "new-maps" } } as const;
  const pending = authoringValue(previewSpatialSourceBuild(input));
  const disclosure = spatialBuildProposal();
  const selection = spatialSession();
  // When
  const rejected = retainAuthoringPreview(earlier);
  // Then: rejection cannot replace the request, preview, disclosure or live state.
  expect(rejected).toMatchObject({ kind: "error", error: { code: "stale" } });
  expect(visibleAuthoringProject()).toBe(pending.project);
  expect(spatialBuildProposal()).toEqual(disclosure);
  expect(spatialSession()).toEqual(selection);
  expect(store.getCurrent()).toEqual(project);
  expect(getMapEditHistoryEntries()).toHaveLength(0);
  expect(authoringValue(previewAuthoringDraft()).project).toEqual(pending.project);
  authoringValue(applyAuthoringPreview());
  expect(store.getCurrent()).toEqual(pending.project);
  expect(getMapEditHistoryEntries()).toHaveLength(1);
});

it("rejects an earlier generation when shared edits return to identical source contents", () => {
  // Given: content equality and the original mutable draft identity cannot establish freshness.
  manualBuildFixture();
  const shared = controller();
  const original = authoringValue(editAuthoringDraft(project => revision(project, 2)));
  const preview = authoringValue(shared.preview(original, { operation: { kind: "edit" } }));
  authoringValue(editAuthoringDraft(project => revision(project, 3)));
  const active = authoringValue(editAuthoringDraft(project => revision(project, 2)));
  const before = visibleAuthoringProject();
  // When
  const rejected = retainAuthoringPreview(preview);
  // Then
  expect(rejected).toMatchObject({ kind: "error", error: { code: "stale" } });
  expect(visibleAuthoringProject()).toBe(before);
  expect(visibleAuthoringProject()).toBe(active.project);
  expect(getMapEditHistoryEntries()).toHaveLength(0);
});

it("retains exact final authority when a real multi-step adapter continues the active build", () => {
  // Given: actual instantiate/compile then a detached clone/compile continuation.
  manualBuildFixture();
  const shared = controller();
  const rootId = spatialId("adapter-root");
  authoringValue(previewSpatialSourceBuild({ source: { kind: "space", id: spaceDesign }, rootId, seed: 19,
    destination: { kind: "new-maps" } }));
  const draft = authoringValue(editAuthoringDraft(project => revision(project, 3)));
  const cloneId = spatialId("adapter-clone");
  const cloned = authoringValue(shared.preview(draft, { operation: { kind: "clone-occurrence", request: {
    occurrenceId: rootId, rootId: cloneId, externalConnections: "omit" } } }));
  const continued = authoringValue(shared.continueDraft(cloned));
  const final = authoringValue(shared.preview(continued, { operation: { kind: "edit" }, compile: { occurrenceId: cloneId } }));
  const disclosure = spatialBuildProposal()?.input;
  // When
  const retained = authoringValue(retainAuthoringPreview(final));
  // Then
  expect(retained).toBe(final);
  expect(visibleAuthoringProject()).toBe(final.project);
  expect(spatialBuildProposal()?.input).toBe(disclosure);
  authoringValue(applyAuthoringPreview());
  expect(store.getCurrent()).toEqual(final.project);
  expect(getMapEditHistoryEntries()).toHaveLength(1);
});

it("rejects an unrelated controller branch for retention without globally invalidating that branch", () => {
  // Given: independent draft on the same controller, same source baseline.
  manualBuildFixture();
  const shared = controller();
  const branch = authoringValue(shared.createDraft());
  const issued = authoringValue(shared.preview(branch, { operation: { kind: "edit" } }));
  const active = authoringValue(editAuthoringDraft(project => revision(project, 3)));
  // When
  const result = retainAuthoringPreview(issued);
  // Then
  expect(result).toMatchObject({ kind: "error", error: { code: "stale" } });
  expect(visibleAuthoringProject()).toBe(active.project);
  expect(shared.continueDraft(issued).kind).toBe("ok");
  expect(shared.apply(issued).kind).toBe("ok");
  expect(getMapEditHistoryEntries()).toHaveLength(0);
});
