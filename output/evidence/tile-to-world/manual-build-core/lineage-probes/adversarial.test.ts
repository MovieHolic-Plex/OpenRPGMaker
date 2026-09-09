import { writeFileSync } from "node:fs";
import { afterEach, expect, it } from "vitest";
import { getMapEditHistoryEntries } from "@/editor/mapEditHistory";
import { applyAuthoringPreview, bindSpatialAuthoringControllerFactory, editAuthoringDraft, hasAuthoringDraft, hasAuthoringPreview, previewAuthoringDraft, retainAuthoringPreview, spatialAuthoringController, visibleAuthoringProject } from "@/editor/panels/spatialAuthoringAccess";
import { patchSpatialSession, spatialSession } from "@/editor/panels/spatialAuthoringSession";
import { previewSpatialSourceBuild, spatialBuildProposal, type SpatialSourceBuildInput } from "@/editor/panels/spatialBuildActions";
import { createSpatialAuthoringController } from "@/editor/spatial/actions";
import { spatialAuthoringCompileScope } from "@/editor/spatial/authoringScope";
import { own, spatialId } from "@/project/spatial/domain";
import type { SpaceDesign, SpatialId } from "@/project/spatial/types";
import { store } from "@/project/store";
import type { Project } from "@/project/types";
import { authoringValue } from "../../../../../test/support/spatialAuthoringFixture";
import { geographyFixture, geographyRoot } from "../../../../../test/support/spatialGeographyFixture";
import { manualBuildFixture } from "../../../../../test/support/spatialManualBuildFixture";
import { fixtureDocument, objectStampFixture, spaceDesign } from "../../../../../test/support/spatialSpaceCompilerFixture";

afterEach(() => bindSpatialAuthoringControllerFactory(null));

function sharedController() {
  const controller = spatialAuthoringController();
  if (!controller) throw new TypeError("Missing shared controller");
  return controller;
}
function spaceInput(root: string) {
  return { source: { kind: "space", id: spaceDesign }, rootId: spatialId(root), seed: 19,
    destination: { kind: "new-maps" } } as const;
}
function sourceRevision(project: Project, revision: number): Project {
  const doc = fixtureDocument(project);
  return { ...project, spatialAuthoring: { ...doc, library: { ...doc.library, spaces: {
    ...doc.library.spaces, [spaceDesign]: { ...own(doc.library.spaces, spaceDesign), revision },
  } } } };
}
function patchSnapshot(project: Project, id: SpatialId, patch: (space: SpaceDesign) => SpaceDesign): Project {
  const doc = fixtureDocument(project);
  const root = own(doc.occurrences, id);
  return { ...project, spatialAuthoring: { ...doc, occurrences: { ...doc.occurrences, [id]: {
    ...root, snapshot: { ...root.snapshot, library: { ...root.snapshot.library, spaces: {
      ...root.snapshot.library.spaces, [spaceDesign]: patch(own(root.snapshot.library.spaces, spaceDesign)),
    } } },
  } } } };
}

it("continues a pending build through failed then corrected external compilation and adopts the exact retained handle", () => {
  const { project } = manualBuildFixture();
  const input = spaceInput("independent-valid-pending");
  authoringValue(editAuthoringDraft(project => sourceRevision(project, 2)));
  const built = authoringValue(previewSpatialSourceBuild(input));
  const disclosed = spatialBuildProposal()?.input;
  const controller = sharedController();
  patchSpatialSession({ tab: "objects", mode: "design", designId: "unrelated-visible-control", occurrenceId: null });
  const selection = spatialSession();
  const broken = authoringValue(editAuthoringDraft(project => patchSnapshot(sourceRevision(project, 3), input.rootId,
    space => ({ ...space, ports: space.ports.map(port => ({ ...port, x: 255 })) }))));
  const compile = spatialAuthoringCompileScope(fixtureDocument(broken.project), input.rootId);
  expect(controller.preview(broken, { operation: { kind: "edit" }, compile }).kind).toBe("error");
  expect(spatialBuildProposal()?.input).toBe(disclosed);
  expect(spatialBuildProposal()?.preview).toBeNull();
  expect(visibleAuthoringProject()).toBe(broken.project);
  expect(spatialSession()).toEqual(selection);
  expect(store.getCurrent()).toEqual(project);
  expect(getMapEditHistoryEntries()).toHaveLength(0);
  const corrected = authoringValue(editAuthoringDraft(project => patchSnapshot(project, input.rootId,
    space => ({ ...space, width: 18, ports: space.ports.map(port => ({ ...port, x: 8 })) }))));
  const issued = authoringValue(controller.preview(corrected, { operation: { kind: "edit" }, compile }));
  expect(authoringValue(retainAuthoringPreview(issued))).toBe(issued);
  expect(spatialBuildProposal()?.input).toBe(disclosed);
  expect(spatialBuildProposal()?.preview).toBe(issued);
  expect(visibleAuthoringProject()).toBe(issued.project);
  const doc = fixtureDocument(issued.project);
  const root = own(doc.occurrences, input.rootId);
  expect(root).toMatchObject({ seed: 19, x: 0, y: 0, level: 0, parentId: null, source: { revision: 2 } });
  expect(own(doc.library.spaces, spaceDesign).revision).toBe(3);
  expect(root.bindings[0]?.rect.width).toBe(22);
  expect(issued.project).not.toEqual(built.project);
  expect(previewSpatialSourceBuild({ ...input, seed: 20 })).toMatchObject({ kind: "error", error: { message: "build-proposal-pending" } });
  expect(spatialBuildProposal()?.preview).toBe(issued);
  authoringValue(applyAuthoringPreview());
  expect(store.getCurrent()).toEqual(issued.project);
  expect(getMapEditHistoryEntries()).toHaveLength(1);
  expect(spatialSession()).toMatchObject({ tab: "spaces", mode: "instances", occurrenceId: input.rootId, designId: null });
  expect(spatialBuildProposal()).toBeNull();
  expect(hasAuthoringDraft()).toBe(false);
});

it("rejects cloned foreign consumed and live-stale handles without changing pending draft/proposal/selection/history", () => {
  manualBuildFixture();
  const controller = sharedController();
  const consumed = authoringValue(controller.preview(authoringValue(controller.createDraft()), { operation: { kind: "edit" } }));
  expect(authoringValue(controller.apply(consumed)).changed).toBe(false);
  const input = spaceInput("independent-authority-pending");
  const built = authoringValue(previewSpatialSourceBuild(input));
  const draft = authoringValue(editAuthoringDraft(project => sourceRevision(project, 4)));
  const foreign = createSpatialAuthoringController();
  const foreignPreview = authoringValue(foreign.preview(authoringValue(foreign.createDraft()), { operation: { kind: "edit" } }));
  const selection = spatialSession();
  const history = getMapEditHistoryEntries();
  const live = structuredClone(store.getCurrent());
  const disclosure = spatialBuildProposal()?.input;
  for (const [preview, code] of [[structuredClone(built), "foreign-preview"], [foreignPreview, "foreign-preview"], [consumed, "already-applied"]] as const) {
    expect(retainAuthoringPreview(preview)).toMatchObject({ kind: "error", error: { code } });
    expect(visibleAuthoringProject()).toBe(draft.project);
    expect(spatialBuildProposal()).toEqual({ input: disclosure, preview: null });
    expect(hasAuthoringDraft()).toBe(true);
    expect(hasAuthoringPreview()).toBe(false);
    expect(spatialSession()).toEqual(selection);
    expect(getMapEditHistoryEntries()).toEqual(history);
    expect(store.getCurrent()).toEqual(live);
  }
  const issued = authoringValue(controller.preview(draft, { operation: { kind: "edit" }, compile: { occurrenceId: input.rootId } }));
  authoringValue(retainAuthoringPreview(issued));
  store.update(project => { project.meta.title = "independent-live-baseline-change"; });
  const changedLive = structuredClone(store.getCurrent());
  expect(retainAuthoringPreview(issued)).toMatchObject({ kind: "error", error: { code: "stale" } });
  expect(applyAuthoringPreview()).toMatchObject({ kind: "error", error: { code: "stale" } });
  expect(visibleAuthoringProject()).toBe(issued.project);
  expect(spatialBuildProposal()?.input).toBe(disclosure);
  expect(spatialBuildProposal()?.preview).toBe(issued);
  expect(store.getCurrent()).toEqual(changedLive);
  expect(getMapEditHistoryEntries()).toEqual(history);
  expect(spatialSession()).toEqual(selection);
});

it("freezes every explicit object input and preserves its exact target during an external continuation", () => {
  const { project, target } = manualBuildFixture();
  const input: SpatialSourceBuildInput = { source: { kind: "object", id: spatialId("hearth-design") },
    rootId: spatialId("independent-explicit-stamp"), seed: 19, destination: { kind: "map", currentMapId: target.mapId,
      selection: { mapId: target.mapId, ...target.rect }, entry: { ...target.entry } } };
  const expected = structuredClone(input);
  const built = authoringValue(previewSpatialSourceBuild(input));
  const disclosure = spatialBuildProposal()?.input;
  Object.assign(input.source, { id: spatialId("bed-design") });
  Object.assign(input, { rootId: spatialId("caller-retarget"), seed: 31 });
  Object.assign(input.destination, { currentMapId: "caller-map" });
  Object.assign(input.destination.selection ?? {}, { mapId: "caller-map", x: 9, width: 1 });
  Object.assign(input.destination.entry ?? {}, { x: 999 });
  expect(spatialBuildProposal()?.input).toEqual(expected);
  expect(Object.isFrozen(disclosure)).toBe(true);
  expect(Object.isFrozen(disclosure?.source)).toBe(true);
  expect(Object.isFrozen(disclosure?.destination)).toBe(true);
  if (disclosure?.destination.kind !== "map") throw new TypeError("Expected map disclosure");
  expect(Object.isFrozen(disclosure.destination.selection)).toBe(true);
  expect(Object.isFrozen(disclosure.destination.entry)).toBe(true);
  expect(authoringValue(previewAuthoringDraft()).project).toEqual(built.project);
  const draft = authoringValue(editAuthoringDraft(project => sourceRevision(project, 5)));
  const compile = spatialAuthoringCompileScope(fixtureDocument(draft.project), expected.rootId, target);
  const issued = authoringValue(sharedController().preview(draft, { operation: { kind: "edit" }, compile }));
  authoringValue(retainAuthoringPreview(issued));
  expect(previewSpatialSourceBuild(input)).toMatchObject({ kind: "error", error: { message: "build-proposal-pending" } });
  expect(spatialBuildProposal()).toEqual({ input: expected, preview: issued });
  expect(own(fixtureDocument(issued.project).occurrences, expected.rootId)).toMatchObject({ seed: 19,
    source: expected.source, bindings: [{ mapId: target.mapId, rect: target.rect }] });
  expect(issued.project.maps).toEqual(built.project.maps);
  expect(store.getCurrent()).toEqual(project);
  authoringValue(applyAuthoringPreview());
  expect(store.getCurrent()).toEqual(issued.project);
  expect(spatialSession()).toMatchObject({ tab: "objects", mode: "instances", occurrenceId: expected.rootId, designId: null });
  expect(getMapEditHistoryEntries()).toHaveLength(1);
});

it("routes parsed geography descendants to actual world ownership and rejects unretained or extraneous stamp targets", () => {
  const project = geographyFixture("world", 19);
  const doc = fixtureDocument(project);
  const reversed = { ...doc, occurrences: Object.fromEntries(Object.entries(doc.occurrences).reverse()) };
  const leaves = Object.values(reversed.occurrences).filter(occurrence => occurrence.kind === "object");
  expect(leaves.length).toBeGreaterThan(1);
  const fixture = objectStampFixture();
  for (const leaf of leaves) {
    expect(spatialAuthoringCompileScope(reversed, leaf.id)).toEqual({ occurrenceId: geographyRoot });
    expect(() => spatialAuthoringCompileScope(reversed, leaf.id, fixture.target)).toThrow(/target/);
  }
  const standalone = fixtureDocument(fixture.project);
  expect(() => spatialAuthoringCompileScope(standalone, fixture.occurrenceId)).toThrow(/target/);
  expect(spatialAuthoringCompileScope(standalone, fixture.occurrenceId, fixture.target))
    .toEqual({ occurrenceId: fixture.occurrenceId, target: fixture.target });
});

it("must not import a superseded shared-draft preview that drops pending build output and newer source edits", () => {
  manualBuildFixture();
  const controller = sharedController();
  const earlierDraft = authoringValue(editAuthoringDraft(project => sourceRevision(project, 2)));
  // A real adapter-issued handle from the shared draft, not a forged or foreign preview.
  const earlier = authoringValue(controller.preview(earlierDraft, { operation: { kind: "edit" } }));
  authoringValue(editAuthoringDraft(project => sourceRevision(project, 3)));
  const input = spaceInput("independent-must-survive-handoff");
  const pending = authoringValue(previewSpatialSourceBuild(input));
  patchSpatialSession({ tab: "objects", mode: "design", designId: "independent-current-selection", occurrenceId: null });
  const selection = spatialSession();
  const live = structuredClone(store.getCurrent());
  const history = getMapEditHistoryEntries();
  const retained = retainAuthoringPreview(earlier);
  const afterRetain = visibleAuthoringProject();
  const proposal = spatialBuildProposal();
  const preApplyHistory = getMapEditHistoryEntries();
  const preApplyLiveUnchanged = JSON.stringify(store.getCurrent()) === JSON.stringify(live);
  const applied = retained.kind === "ok" ? applyAuthoringPreview() : null;
  const observation = {
    retainedKind: retained.kind,
    exactOldHandleRetained: retained.kind === "ok" && retained.value === earlier,
    sourceRevisionBefore: own(fixtureDocument(pending.project).library.spaces, spaceDesign).revision,
    sourceRevisionAfterRetain: own(fixtureDocument(afterRetain).library.spaces, spaceDesign).revision,
    pendingRootBefore: Object.hasOwn(fixtureDocument(pending.project).occurrences, input.rootId),
    pendingRootAfterRetain: Object.hasOwn(fixtureDocument(afterRetain).occurrences, input.rootId),
    disclosedRootAfterRetain: proposal?.input.rootId,
    proposalPreviewIsOldHandle: proposal?.preview === earlier,
    preApplyLiveUnchanged,
    historyBefore: history.length,
    historyAfterRetain: preApplyHistory.length,
    applied,
    adoptedSourceRevision: own(fixtureDocument(store.getCurrent()).library.spaces, spaceDesign).revision,
    adoptedRootExists: Object.hasOwn(fixtureDocument(store.getCurrent()).occurrences, input.rootId),
    historyAfterApply: getMapEditHistoryEntries().length,
    selectionBefore: selection,
    selectionAfterApply: spatialSession(),
    proposalAfterApply: spatialBuildProposal(),
  };
  writeFileSync(new URL("./superseded-handoff-observation.json", import.meta.url), JSON.stringify(observation, null, 2) + "\n");
  expect(observation, "Reject obsolete handoff without silently replacing the pending proposal or source edits").toMatchObject({
    retainedKind: "error", sourceRevisionAfterRetain: 3, pendingRootAfterRetain: true,
    disclosedRootAfterRetain: input.rootId, historyAfterApply: 0,
  });
});
