// @vitest-environment happy-dom

import { afterEach, beforeEach, expect, it, vi, describe, beforeAll } from "vitest";
import { createSpatialAuthoringController } from "../src/editor/spatial/actions";
import { getMapEditHistoryEntries, resetMapEditHistory, undoMapEdit } from "../src/editor/mapEditHistory";
import { store } from "../src/project/store";
import { assertNever, own } from "../src/project/spatial/domain";
import { authoringFixture, authoringValue } from "./support/spatialAuthoringFixture";
import { fixtureDocument } from "./support/spatialSpaceCompilerFixture";
import { bindSpatialAuthoringControllerFactory, editAuthoringDraft, previewAuthoringDraft, retainAuthoringPreview, visibleAuthoringProject, hasAuthoringDraft } from "../src/editor/panels/spatialAuthoringAccess";
import { spatialAuthoringCompileScope } from "../src/editor/spatial/authoringScope";
import { expectAcceptedTransaction, setupCombinedAuthoring, sharedController } from "./support/combinedAuthoringFixture";
import { installManualProject } from "./support/spatialManualBuildFixture";
import { changeOwnedObjectSource, ownedObjectRefreshFixture, refreshTarget, replacementKit, selectedObject, siblingObject } from "./support/spatialOwnedObjectRefreshFixture";
import { createBlankProject } from "@/project/defaults";
import { commitLiveOrDraft } from "@/editor/panels/spatialObjectMutations";
import { renameOwnedKit } from "@/editor/panels/spatialObjectDraft";
import { renderSpatialSpacesInspector } from "@/editor/panels/spatialSpaceInspector";
import { roomKindOf } from "@/editor/panels/spatialGallery";
import { BUILTIN_INTERIOR_ROOM_KINDS } from "@/project/defaults/interiorRoomKinds";
import { INTERIOR_ROOM_TILESET_ID } from "@/editor/interiorRoomPipeline";
import { deserialize, serialize } from "@/project/io";
import type { SpatialGalleryCard } from "@/editor/panels/spatialCatalog";
import { withRetiredEasyRpgTilesets } from "./support/retiredEasyRpgTilesets";
import { isolateTimers } from "./mergedTeardown";

describe("spatialAuthoringContinuationSafety", () => {
  isolateTimers();
  beforeEach(() => vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "setInterval", "clearInterval"] }));
  afterEach(() => {
    bindSpatialAuthoringControllerFactory(null);
    resetMapEditHistory(); vi.clearAllTimers(); vi.useRealTimers();
  });
  it.each(["maps", "bindings"] as const)("rejects forged %s when editing a compiled preview", field => {
    // Given a genuine generated preview followed by a manual attempt to change protected output.
    const f = authoringFixture();
    const before = structuredClone(store.getCurrent());
    bindSpatialAuthoringControllerFactory(createSpatialAuthoringController);
    authoringValue(editAuthoringDraft(project => project, { operation: { kind: "edit" }, compile: f.compile }));
    authoringValue(previewAuthoringDraft());
    authoringValue(editAuthoringDraft(project => {
      switch (field) {
        case "maps": own(project.maps, f.target.mapId).lowerTiles[0] = 42; return project;
        case "bindings": {
          const doc = fixtureDocument(project);
          const occurrence = own(doc.occurrences, f.occurrenceId);
          return { ...project, spatialAuthoring: { ...doc, occurrences: { ...doc.occurrences,
            [occurrence.id]: { ...occurrence, bindings: [] },
          } } };
        }
        default: return assertNever(field);
      }
    }));
    // When previewing the manually altered continuation.
    const result = previewAuthoringDraft();
    // Then continuation provenance does not authorize new raster or binding edits.
    expect(result).toMatchObject({ kind: "error", error: { code: "ownership" } });
    expect(store.getCurrent()).toEqual(before);
    expect(getMapEditHistoryEntries()).toHaveLength(0);
  });
  it("rejects copied generated output when it is supplied through a fresh raw draft", () => {
    // Given valid generated output but no continuation authority on a fresh issued draft.
    const f = authoringFixture();
    const preview = authoringValue(f.controller.preview(f.draft, { operation: { kind: "edit" }, compile: f.compile }));
    const raw = authoringValue(f.controller.createDraft());
    Object.assign(raw.project, structuredClone(preview.project));
    const before = structuredClone(store.getCurrent());
    // When asking the original issuing controller to treat the copy as an authored edit.
    const result = f.controller.preview(raw, { operation: { kind: "edit" } });
    // Then exact copied compiler output is not a substitute for an issued continuation handle.
    expect(result).toMatchObject({ kind: "error", error: { code: "ownership" } });
    expect(store.getCurrent()).toEqual(before);
    expect(getMapEditHistoryEntries()).toHaveLength(0);
  });
  it("rejects a continued proposal when live state changes after the displayed preview", () => {
    // Given a displayed preview and a direct live mutation that bypasses store notifications.
    authoringFixture();
    bindSpatialAuthoringControllerFactory(createSpatialAuthoringController);
    authoringValue(editAuthoringDraft(project => ({ ...project, meta: { ...project.meta, title: "Draft title" } })));
    authoringValue(previewAuthoringDraft());
    store.getCurrent().meta.title = "Independent live mutation";
    const before = structuredClone(store.getCurrent());
    // When continuing the old proposal; either continuation or preview may reject stale authority.
    const edited = editAuthoringDraft(project => ({ ...project, meta: { ...project.meta, title: "Continued title" } }));
    const result = (() => {
      switch (edited.kind) {
        case "ok": return previewAuthoringDraft();
        case "error": return edited;
        default: return assertNever(edited);
      }
    })();
    // Then no new baseline can launder the independent mutation into the old proposal.
    expect(result).toMatchObject({ kind: "error", error: { code: "stale" } });
    expect(store.getCurrent()).toEqual(before);
    expect(getMapEditHistoryEntries()).toHaveLength(0);
  });
});

describe("spatialCombinedRefresh", () => {
  isolateTimers();
  beforeAll(() => {
    // createBlankProject() 는 호출마다 약 80MB 를 새로 만든다(test/support/blankProject.ts 머리말) — 이 파일의 느린 케이스는 한 케이스에 그것을 여러 번 부르거나 부르는 제품 함수를 돌려
    // CI(4코어 호스티드 러너)에서 11~15초가 걸려 기본 15초 제한에 걸리거나 닿을 듯하다. 판정은 그대로 두고 제한만 이 파일의 다른 무거운 시험과 같이 넓힌다.
    vi.setConfig({ testTimeout: 120_000 });
    setupCombinedAuthoring();
  });
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
});

describe("spatialLegacyEditing", () => {
  isolateTimers();
  const previous = store.getCurrent();
  const tilesetId = INTERIOR_ROOM_TILESET_ID;
  beforeEach(() => {
    store.replace(withRetiredEasyRpgTilesets(createBlankProject()), { preserveEventDrafts: false });
    bindSpatialAuthoringControllerFactory(createSpatialAuthoringController);
    resetMapEditHistory();
  });
  afterEach(() => {
    bindSpatialAuthoringControllerFactory(null);
    store.replace(previous, { preserveEventDrafts: false });
    document.body.replaceChildren();
  });
  it("saves legacy object edits with the production controller bound, survives IO, and undoes", () => {
    store.update(project => { project.tilesets[tilesetId].structureKits = [{ id: "test-kit", name: "Before", kind: "section", width: 1, height: 1, rows: [{ tiles: [1] }] }]; });
    commitLiveOrDraft(() => {}, project => renameOwnedKit(project, tilesetId, "test-kit", "After"));
    expect(hasAuthoringDraft()).toBe(false);
    expect(deserialize(serialize(store.getCurrent())).tilesets[tilesetId].structureKits?.[0].name).toBe("After");
    undoMapEdit();
    expect(store.getCurrent().tilesets[tilesetId].structureKits?.[0].name).toBe("Before");
  });
  it("edits authored room rules even when their id matches the builtin catalog", () => {
    const kind = BUILTIN_INTERIOR_ROOM_KINDS[0];
    store.update(project => { project.tilesets[tilesetId].interiorRoomKinds = [{ ...kind, label: "Authored" }]; });
    const card: SpatialGalleryCard = { id: "test-room", localId: kind.id, name: "Authored", kind: "spaces", source: "own", usage: 0, tilesetId, compatibility: "room-rule" };
    expect(roomKindOf(card)?.label).toBe("Authored");
    const inspector = renderSpatialSpacesInspector(card, true, () => {});
    document.body.append(inspector);
    const input = inspector.querySelector<HTMLInputElement>(`[data-testid='tileset-spaces-kind-label-${kind.id}']`)!;
    expect(input).not.toBeNull();
    input.value = "Renamed";
    input.dispatchEvent(new Event("change", { bubbles: true }));
    expect(roomKindOf(card)?.label).toBe("Renamed");
    expect(deserialize(serialize(store.getCurrent())).tilesets[tilesetId].interiorRoomKinds?.[0].label).toBe("Renamed");
    undoMapEdit();
    expect(roomKindOf(card)?.label).toBe("Authored");
  });
  it("copies a builtin room without overwriting an existing authored rule with the same id", () => {
    const kind = BUILTIN_INTERIOR_ROOM_KINDS[0];
    store.update(project => { project.tilesets[tilesetId].interiorRoomKinds = [{ ...kind, label: "Keep me" }]; });
    const card: SpatialGalleryCard = { id: kind.id, localId: kind.id, name: kind.label, kind: "spaces", source: "default", usage: 0, tilesetId };
    const inspector = renderSpatialSpacesInspector(card, true, () => {});
    inspector.querySelector<HTMLButtonElement>("[data-testid='spatial-space-copy']")!.click();
    const records = store.getCurrent().tilesets[tilesetId].interiorRoomKinds!;
    expect(records).toHaveLength(2);
    expect(records[0].label).toBe("Keep me");
    expect(records[1].id).not.toBe(kind.id);
  });
});
