/** @vitest-environment happy-dom */
import { expect, it } from "vitest";
import { getMapEditHistoryEntries } from "../src/editor/mapEditHistory";
import { editAuthoringDraft, retainAuthoringPreview, visibleAuthoringProject } from "../src/editor/panels/spatialAuthoringAccess";
import { spatialAuthoringCompileScope } from "../src/editor/spatial/authoringScope";
import { own } from "../src/project/spatial/domain";
import { store } from "../src/project/store";
import { expectAcceptedTransaction, setupCombinedAuthoring, sharedController } from "./support/combinedAuthoringFixture";
import { authoringValue } from "./support/spatialAuthoringFixture";
import { installManualProject } from "./support/spatialManualBuildFixture";
import { changeOwnedObjectSource, ownedObjectRefreshFixture, refreshTarget, replacementKit,
  selectedObject, siblingObject } from "./support/spatialOwnedObjectRefreshFixture";
import { fixtureDocument } from "./support/spatialSpaceCompilerFixture";

setupCombinedAuthoring();

it("uses the retained protected checkpoint when shared edits refresh a standalone graphic twice before acceptance", () => {
  // Given: two independently owned graphics and unmanaged cells/events inside the selected reservation.
  installManualProject(ownedObjectRefreshFixture());
  const before = structuredClone(store.getCurrent());
  const draft = authoringValue(editAuthoringDraft(project => { changeOwnedObjectSource(project); return project; }));
  const compile = spatialAuthoringCompileScope(fixtureDocument(draft.project), selectedObject, refreshTarget);
  const request = { operation: { kind: "refresh", request: { occurrenceId: selectedObject, externalConnections: "reject" } }, compile } as const;
  const first = authoringValue(sharedController().preview(draft, request));
  authoringValue(retainAuthoringPreview(first));
  const continued = authoringValue(editAuthoringDraft(project => {
    changeOwnedObjectSource(project, { ...replacementKit, rows: replacementKit.rows.map((row, y) =>
      y === 0 ? { ...row, tiles: [404, 403, -1] } : row) });
    return project;
  }));
  // When: refresh compiles against the shared handoff's checkpoint rather than original live pixels.
  const final = authoringValue(sharedController().preview(continued, request));
  authoringValue(retainAuthoringPreview(final));
  // Then: source-derived replacement, frozen identities and unmanaged content survive one whole transaction.
  const map = own(final.project.maps, refreshTarget.mapId);
  expect(own(first.project.maps, refreshTarget.mapId).lowerTiles.slice(51, 54)).toEqual([403, 402, -1]);
  expect(map.lowerTiles.slice(51, 54)).toEqual([404, 403, -1]);
  expect(map.upperTiles[70]).toBe(124);
  expect(map.lowerTileStacks).toEqual(own(before.maps, refreshTarget.mapId).lowerTileStacks);
  expect(map.upperTileStacks).toEqual(own(before.maps, refreshTarget.mapId).upperTileStacks);
  // Compilation may reorder events; every actual ID and complete event value must survive.
  expect(new Map(map.events.map(event => [event.id, event])))
    .toEqual(new Map(own(before.maps, refreshTarget.mapId).events.map(event => [event.id, event])));
  const document = fixtureDocument(final.project);
  expect(own(document.occurrences, selectedObject).snapshot.ports).toEqual(own(fixtureDocument(before).occurrences, selectedObject).snapshot.ports);
  expect(own(document.occurrences, siblingObject)).toEqual(own(fixtureDocument(before).occurrences, siblingObject));
  expect(final.impact.occurrenceIds).toEqual([selectedObject]);
  expect(visibleAuthoringProject()).toBe(final.project);
  expectAcceptedTransaction(before, final);
});

it("rejects editable raster adoption when a shared continuation follows a retained graphic refresh", () => {
  // Given: a legitimate refreshed checkpoint retained through shared access, still unapplied.
  installManualProject(ownedObjectRefreshFixture());
  const before = structuredClone(store.getCurrent());
  const draft = authoringValue(editAuthoringDraft(project => { changeOwnedObjectSource(project); return project; }));
  const compile = spatialAuthoringCompileScope(fixtureDocument(draft.project), selectedObject, refreshTarget);
  const request = { operation: { kind: "refresh", request: { occurrenceId: selectedObject, externalConnections: "reject" } }, compile } as const;
  const issued = authoringValue(sharedController().preview(draft, request));
  authoringValue(retainAuthoringPreview(issued));
  const edited = authoringValue(editAuthoringDraft(project => {
    own(project.maps, refreshTarget.mapId).lowerTiles[51] = 124;
    return project;
  }));
  // When: a new refresh attempts to treat arbitrary draft pixels as authorized generated output.
  const rejected = sharedController().preview(edited, request);
  // Then: the protected checkpoint rejects the write; no ownership, live state or history is adopted.
  expect(rejected).toMatchObject({ kind: "error", error: { code: "ownership" } });
  expect(visibleAuthoringProject()).toBe(edited.project);
  expect(own(issued.project.maps, refreshTarget.mapId).lowerTiles[51]).toBe(403);
  expect(store.getCurrent()).toEqual(before);
  expect(getMapEditHistoryEntries()).toHaveLength(0);
});
