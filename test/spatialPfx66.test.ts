// @vitest-environment happy-dom

import { afterEach, beforeEach, expect, it, vi, describe, beforeAll } from "vitest";
import { createSpatialAuthoringController } from "../src/editor/spatial/actions";
import { getMapEditHistoryEntries, resetMapEditHistory, undoMapEdit, getMapEditHistoryState } from "../src/editor/mapEditHistory";
import { store } from "../src/project/store";
import { assertNever, own, spatialId, findOccurrenceChildId } from "../src/project/spatial/domain";
import { authoringFixture, authoringValue } from "./support/spatialAuthoringFixture";
import { fixtureDocument, spaceCompilerFixture, spaceDesign, spaceRoot } from "./support/spatialSpaceCompilerFixture";
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
import { type SpatialGalleryCard, listSpatialGalleryCards, spatialCardById, spatialPresentationId } from "@/editor/panels/spatialCatalog";
import { withRetiredEasyRpgTilesets } from "./support/retiredEasyRpgTilesets";
import { isolateTimers } from "./mergedTeardown";
import { visibleSpatialSelection } from "@/editor/panels/spatialStage";
import { resetSpatialAuthoringSessions, selectSpatialDesign, selectSpatialOccurrence, setSpatialTab, spatialSession, type SpatialAuthoringSession, patchSpatialSession, popSpatialBreadcrumb, pushSpatialBreadcrumb, setSpatialCamera, spatialProjectKey } from "@/editor/panels/spatialAuthoringSession";
import { spatialFixture, spatialWire } from "./support/spatialSchemaFixture";
import { renderSpatialAuthoringShell } from "@/editor/panels/spatialShell";
import { flushSpatialCardThumbs, resetSpatialCardThumbs } from "@/editor/panels/spatialCardThumbs";
import { editorState } from "@/editor/editorState";
import { getDatabaseActiveTab, renderDatabasePanel, setDatabaseActiveTab } from "@/editor/panels/database";
import { resetSpatialRegionsTabChrome } from "@/editor/panels/spatialRegionsTab";
import { resetSpatialWorldsTabChrome } from "@/editor/panels/spatialWorldsTab";
import { libraryRegionCardId, libraryWorldCardId } from "@/editor/panels/spatialGeographyQuery";
import { geographyRecipeFixture } from "./support/spatialGeographyRecipes";
import { geographyRoot } from "./support/spatialGeographyFixture";
import { renderSpatialPlacesInspector, resetSpatialPlacesTabChrome, spatialPlacesChrome, visiblePlaceSelection } from "@/editor/panels/spatialPlacesTab";
import { placeCompilerFixture } from "./support/spatialPlaceCompilerFixture";
import * as kitRender from "@/editor/harnessSuggestion/kitRender";
import { SPACE_TILE_PX, renderSpatialSpacesCanvas } from "@/editor/panels/spatialSpaceCanvas";
import { workingProject } from "@/editor/panels/spatialSpaceCommands";
import { spaceDraftTarget } from "@/editor/panels/spatialSpaceDraft";
import { resetSpatialSpacesTabChrome, spatialSpacesChrome } from "@/editor/panels/spatialSpacesTab";
import { spaceLayout } from "@/editor/spatial/spaceLayout";
import { placedSpaceFixture, repeatedSlot } from "./support/placedSpaceFixture";

describe("spatialAuthoringAccess", () => {
  isolateTimers();
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
});

describe("spatialAuthoringSession", () => {
  isolateTimers();
  describe("spatialCardByIdMode", () => {
    isolateTimers();
    const previous = store.getCurrent();
    function sessionFor(patch: Partial<SpatialAuthoringSession>): SpatialAuthoringSession {
      return { ...spatialSession(), ...patch };
    }
    function collidingSpaceProject(): {
      readonly presentationId: string;
      readonly sourceId: string;
    } {
      const { project, document } = spatialFixture();
      const source = document.library.spaces.room;
      if (!source) throw new Error("fixture space missing");
      const presentationId = spatialPresentationId("library-space", "library", source.id);
      const first = document.occurrences["occ-a"];
      const second = document.occurrences["occ-b"];
      if (!first || !second) throw new Error("fixture occurrences missing");
      const colliding = { ...first, id: presentationId };
      const loaded = deserialize(spatialWire(project, {
        ...document,
        occurrences: { [presentationId]: colliding, "occ-b": second },
        rootOccurrenceIds: [presentationId, "occ-b"],
        connections: document.connections.map((link) => (
          link.from.occurrenceId === "occ-a"
            ? { ...link, from: { ...link.from, occurrenceId: presentationId } }
            : link
        )),
      }));
      store.replace(loaded, { preserveEventDrafts: false });
      return { presentationId, sourceId: source.id };
    }
    function deleteOccurrence(occurrenceId: string): void {
      store.update((draft) => {
        const document = draft.spatialAuthoring;
        if (!document) throw new Error("missing spatialAuthoring");
        const { [occurrenceId]: _removed, ...rest } = document.occurrences;
        draft.spatialAuthoring = {
          ...document,
          occurrences: rest,
          rootOccurrenceIds: document.rootOccurrenceIds.filter((id) => id !== occurrenceId),
          connections: document.connections.filter(
            (link) => link.from.occurrenceId !== occurrenceId && link.to.occurrenceId !== occurrenceId,
          ),
        };
      });
    }
    beforeEach(() => {
      resetSpatialAuthoringSessions();
      store.replace(createBlankProject(), { preserveEventDrafts: false });
    });
    afterEach(() => {
      resetSpatialAuthoringSessions();
      store.replace(previous, { preserveEventDrafts: false });
    });
    describe("spatialCardById mode-local resolution", () => {
      it("does not resolve a deleted occurrence to the live design that shares its opaque id", () => {
        // Given: valid live source and occurrence share only the opaque presentation ID.
        const { presentationId, sourceId } = collidingSpaceProject();
        const beforeDocument = deserialize(serialize(store.getCurrent())).spatialAuthoring;
        expect(beforeDocument).toEqual(store.getCurrent().spatialAuthoring);
        expect(beforeDocument?.occurrences[presentationId]?.id).toBe(presentationId);
        expect(beforeDocument?.library.spaces[sourceId]?.id).toBe(sourceId);
        expect(presentationId).not.toBe(sourceId);
        setSpatialTab("spaces");
        selectSpatialOccurrence(presentationId);
        const before = spatialCardById(sessionFor({
          tab: "spaces",
          mode: "instances",
          source: "all",
          occurrenceId: presentationId,
        }), presentationId);
        expect(before?.id).toBe(presentationId);
        expect(before?.source).toBe("placed");

        const identity = store.getProjectIdentity();
        // When: delete the occurrence in the current project, including its live links.
        deleteOccurrence(presentationId);

        // Then: IO accepts the deletion without crossing modes or changing identity.
        const afterDocument = deserialize(serialize(store.getCurrent())).spatialAuthoring;
        expect(afterDocument).toEqual(store.getCurrent().spatialAuthoring);
        expect(afterDocument?.occurrences["occ-b"]).toEqual(beforeDocument?.occurrences["occ-b"]);
        expect(store.getProjectIdentity()).toEqual(identity);
        expect(store.getCurrent().spatialAuthoring?.occurrences[presentationId]).toBeUndefined();
        expect(store.getCurrent().spatialAuthoring?.library.spaces[sourceId]).toBeDefined();

        const session = sessionFor({
          tab: "spaces",
          mode: "instances",
          source: "all",
          occurrenceId: presentationId,
        });
        const resolved = spatialCardById(session, presentationId);
        const visible = visibleSpatialSelection(session);

        expect(session.mode).toBe("instances");
        expect(resolved?.source).not.toBe("own");
        expect(resolved).toBeUndefined();
        expect(visible?.id).not.toBe(presentationId);
        expect(visible?.source).not.toBe("own");
      });

      it("does not resolve a missing design to a placed occurrence that reused the presentation id", () => {
        // Given: the valid source has live place references and frozen occurrence copies.
        const { presentationId, sourceId } = collidingSpaceProject();
        const beforeDocument = deserialize(serialize(store.getCurrent())).spatialAuthoring;
        expect(beforeDocument).toEqual(store.getCurrent().spatialAuthoring);
        expect(beforeDocument?.library.spaces[sourceId]?.id).toBe(sourceId);
        expect(beforeDocument?.library.places.inn?.children.map((child) => child.source.id)).toEqual([sourceId, sourceId]);
        expect(beforeDocument?.occurrences[presentationId]?.snapshot.library.spaces[sourceId]?.id).toBe(sourceId);
        setSpatialTab("spaces");
        selectSpatialDesign(presentationId);
        const session = sessionFor({
          tab: "spaces",
          mode: "design",
          source: "all",
          designId: presentationId,
        });
        expect(spatialCardById(session, presentationId)?.source).toBe("own");
        const identity = store.getProjectIdentity();

        // When: remove the live strong references and their source in one store operation.
        // Spatial-library deletion has no dedicated domain command in this revision.
        store.update((draft) => {
          const document = draft.spatialAuthoring;
          if (!document) throw new Error("missing spatialAuthoring");
          const inn = document.library.places.inn;
          if (!inn) throw new Error("fixture place missing");
          const places = {
            ...document.library.places,
            inn: { ...inn, children: inn.children.filter((child) => child.source.id !== sourceId) },
          };
          const { [sourceId]: _removed, ...spaces } = document.library.spaces;
          draft.spatialAuthoring = {
            ...document,
            library: { ...document.library, places, spaces },
          };
        });

        // Then: IO accepts the missing live source while all historical occurrences survive.
        const afterDocument = deserialize(serialize(store.getCurrent())).spatialAuthoring;
        expect(afterDocument).toEqual(store.getCurrent().spatialAuthoring);
        expect(store.getProjectIdentity()).toEqual(identity);
        expect(afterDocument?.library.places.inn?.children).toEqual([]);
        expect(afterDocument?.library.spaces[sourceId]).toBeUndefined();
        expect(afterDocument?.occurrences[presentationId]?.id).toBe(presentationId);
        expect(afterDocument?.occurrences).toEqual(beforeDocument?.occurrences);
        const resolved = spatialCardById(session, presentationId);
        expect(session.mode).toBe("design");
        expect(resolved?.source).not.toBe("placed");
        expect(resolved).toBeUndefined();
        expect(spatialCardById(sessionFor({ ...session, mode: "instances" }), presentationId)?.source).toBe("placed");
      });

      it("still resolves a design hidden by the source filter within the same mode", () => {
        // Given: an existing design is hidden by the active source filter.
        setSpatialTab("objects");
        selectSpatialDesign("bed_v");
        const session = sessionFor({ tab: "objects", mode: "design", source: "own", designId: "bed_v" });
        expect(listSpatialGalleryCards(session).some((card) => card.id === "bed_v")).toBe(false);
        // When: resolve that design within the same mode.
        const resolved = spatialCardById(session, "bed_v");
        // Then: the hidden design still resolves without changing its source.
        expect(resolved?.id).toBe("bed_v");
        expect(resolved?.source).toBe("default");
      });
    });
  });
  describe("spatialGalleryLazyThumbs", () => {
    isolateTimers();
    const previous = store.getCurrent();
    function mountPlaces(): HTMLElement {
      const host = document.createElement("div");
      renderSpatialAuthoringShell(host, "places", () => {});
      return host;
    }
    function slots(host: HTMLElement, state: "pending" | "ready"): HTMLElement[] {
      return [...host.querySelectorAll<HTMLElement>(`[data-thumb='${state}']`)];
    }
    beforeEach(() => {
      resetSpatialAuthoringSessions();
      resetSpatialCardThumbs();
      store.replace(createBlankProject(), { preserveEventDrafts: false });
    });
    describe("데이터베이스 장소·오브젝트·지역 탭 갤러리 썸네일", () => {
      it("탭을 여는 렌더에서는 카드 썸네일을 굽지 않는다", () => {
        // Given/When: 장소 탭이 마운트된다.
        const host = mountPlaces();

        // Then: 카드는 전부 자리표시자다 — 마운트가 N장의 맵 컴파일을 떠안지 않는다.
        expect(slots(host, "pending").length).toBeGreaterThan(0);
        expect(slots(host, "ready")).toHaveLength(0);
      });

      it("보이게 되면 굽고, 다시 렌더해도 같은 그림을 재사용한다", () => {
        // Given: 한 번 구워 둔 갤러리.
        const first = mountPlaces();
        flushSpatialCardThumbs();
        const ready = slots(first, "ready");
        expect(ready.length).toBeGreaterThan(0);
        const art = ready[0]!.firstElementChild;
        expect(art).not.toBeNull();

        // When: 카드를 고르는 등으로 셸이 통째로 다시 렌더된다.
        const second = mountPlaces();

        // Then: 구운 그림이 그대로 붙는다 — 재렌더가 컴파일을 다시 지불하지 않는다.
        const reused = slots(second, "ready");
        expect(reused.length).toBe(ready.length);
        expect(reused[0]!.firstElementChild).toBe(art);
      });

      it("프로젝트가 바뀌면 구워 둔 그림을 버린다", () => {
        // Given: 구워 둔 갤러리.
        const first = mountPlaces();
        flushSpatialCardThumbs();
        const art = slots(first, "ready")[0]?.firstElementChild;
        expect(art).not.toBeNull();

        // When: 프로젝트 내용이 바뀐다.
        store.update((draft) => {
          draft.name = `${draft.name}-edited`;
        });

        // Then: 다음 렌더는 다시 자리표시자로 시작한다(낡은 그림을 내보내지 않는다).
        const second = mountPlaces();
        expect(slots(second, "ready")).toHaveLength(0);
        expect(slots(second, "pending").length).toBeGreaterThan(0);
        flushSpatialCardThumbs();
        expect(slots(second, "ready")[0]?.firstElementChild).not.toBe(art);
      });
    });
    beforeAll(() => {
      store.replace(previous, { preserveEventDrafts: false });
    });
  });
  describe("spatialGeographyDatabaseMount", () => {
    isolateTimers();
    const previous = store.getCurrent();
    const previousEditor = editorState.get();
    let host: HTMLDivElement;
    function paint(): void {
      renderDatabasePanel(host);
    }
    function openDetail(): void {
      host.querySelector<HTMLButtonElement>("[data-testid='spatial-inspector-toggle']")?.click();
    }
    beforeEach(() => {
      bindSpatialAuthoringControllerFactory(createSpatialAuthoringController);
      resetSpatialAuthoringSessions();
      resetSpatialRegionsTabChrome();
      resetSpatialWorldsTabChrome();
      host = document.createElement("div");
      host.className = "database-modal-body";
      document.body.append(host);
    });
    afterEach(() => {
      host.remove();
      bindSpatialAuthoringControllerFactory(null);
      resetSpatialAuthoringSessions();
      resetSpatialRegionsTabChrome();
      resetSpatialWorldsTabChrome();
      store.replace(previous, { preserveEventDrafts: false });
      editorState.set(previousEditor);
      setDatabaseActiveTab("overview");
    });
    describe("spatial Database geography mount", () => {
      it("mounts a real geography raster and child control on the shared spatial-canvas", () => {
        store.replace(geographyRecipeFixture("lake-country", 7), { preserveEventDrafts: false });
        editorState.set({ currentMapId: store.getCurrent().startMapId });
        setDatabaseActiveTab("spatialRegions");
        setSpatialTab("regions");
        selectSpatialDesign(libraryRegionCardId(spatialId("lake-country")));
        paint();
        openDetail();
        const canvas = host.querySelector("[data-testid='spatial-canvas']");
        expect(canvas).not.toBeNull();
        expect(canvas?.classList.contains("spatial-geography-canvas")).toBe(true);
        expect(host.querySelector("[data-testid='spatial-geography-raster']")).not.toBeNull();
        expect(host.querySelector("[data-testid='spatial-geography-board']")?.getAttribute("data-kind")).toBe("region");
        expect(host.querySelector("[data-testid='spatial-geography-child-lake-village']")).not.toBeNull();
        // 초안이 없는 읽기 전용 선택에서는 미리보기가 비활성이어야 한다 — enabled 였을 때
        // 클릭하면 authoring-draft-missing 내부 토큰이 화면에 새던 회귀의 방지선.
        const preview = host.querySelector<HTMLButtonElement>("[data-testid='spatial-preview']");
        expect(preview).not.toBeNull();
        expect(preview?.disabled).toBe(true);
      });

      it("mounts a world source canvas with region children and atlas raster", () => {
        store.replace(geographyRecipeFixture("lake-kingdom", 7), { preserveEventDrafts: false });
        editorState.set({ currentMapId: store.getCurrent().startMapId });
        setDatabaseActiveTab("spatialWorlds");
        setSpatialTab("worlds");
        selectSpatialDesign(libraryWorldCardId(spatialId("lake-kingdom")));
        paint();
        openDetail();
        expect(host.querySelector("[data-testid='spatial-canvas']")?.classList.contains("spatial-geography-canvas")).toBe(true);
        expect(host.querySelector("[data-testid='spatial-geography-raster']")).not.toBeNull();
        expect(host.querySelector("[data-testid='spatial-geography-board']")?.getAttribute("data-kind")).toBe("world");
        expect(host.querySelector("[data-testid='spatial-geography-child-lake-country']")).not.toBeNull();
      });

      it("mounts a world occurrence board in instances mode from a world-rooted fixture", () => {
        store.replace(geographyRecipeFixture("lake-kingdom", 7), { preserveEventDrafts: false });
        editorState.set({ currentMapId: store.getCurrent().startMapId });
        const occurrence = store.getCurrent().spatialAuthoring?.occurrences[geographyRoot];
        expect(occurrence?.kind).toBe("world");
        setDatabaseActiveTab("spatialWorlds");
        setSpatialTab("worlds");
        host.querySelector<HTMLButtonElement>("[data-testid='spatial-mode-instances']");
        paint();
        host.querySelector<HTMLButtonElement>("[data-testid='spatial-mode-instances']")?.click();
        selectSpatialOccurrence(geographyRoot);
        paint();
        expect(spatialSession().mode).toBe("instances");
        expect(host.querySelector("[data-testid='spatial-canvas']")?.classList.contains("spatial-geography-canvas")).toBe(true);
        expect(host.querySelector("[data-testid='spatial-geography-raster']")).not.toBeNull();
        expect(host.querySelector("[data-testid='spatial-geography-board']")?.getAttribute("data-kind")).toBe("world");
        expect(host.querySelector(`[data-testid='spatial-card-${geographyRoot}']`)).not.toBeNull();
      });

      it("opens a region child onto Places and restores the region canvas on Back", () => {
        store.replace(geographyRecipeFixture("lake-country", 7), { preserveEventDrafts: false });
        editorState.set({ currentMapId: store.getCurrent().startMapId });
        setDatabaseActiveTab("spatialRegions");
        setSpatialTab("regions");
        selectSpatialDesign(libraryRegionCardId(spatialId("lake-country")));
        paint();
        openDetail();
        host.querySelector<HTMLButtonElement>("[data-testid='spatial-geography-child-lake-village']")
          ?.dispatchEvent(new Event("pointerdown", { bubbles: true }));
        const board = host.querySelector<HTMLElement>("[data-testid='spatial-geography-board']");
        board?.focus();
        board?.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
        expect(getDatabaseActiveTab()).toBe("spatialPlaces");
        expect(spatialSession().tab).toBe("places");
        expect(spatialSession().breadcrumb.length).toBeGreaterThan(0);
        host.querySelector<HTMLButtonElement>("[data-testid='spatial-back']")?.click();
        expect(getDatabaseActiveTab()).toBe("spatialRegions");
        expect(spatialSession().tab).toBe("regions");
        expect(host.querySelector("[data-testid='spatial-geography-board']")?.getAttribute("data-kind")).toBe("region");
      });
    });
  });
});

describe("spatialSession", () => {
  isolateTimers();
  describe("spatialPlaceDetailZoom", () => {
    isolateTimers();
    const previous = store.getCurrent();
    function mountPlaces(): HTMLElement {
      const body = document.createElement("div");
      body.className = "database-modal-body";
      document.body.append(body);
      const rerender = (): void => {
        body.replaceChildren();
        renderSpatialAuthoringShell(body, "places", rerender);
      };
      rerender();
      return body;
    }
    beforeEach(() => {
      document.body.replaceChildren();
      resetSpatialAuthoringSessions();
      resetSpatialCardThumbs();
      store.replace(createBlankProject(), { preserveEventDrafts: false });
    });
    describe("장소 카드 상세 보기 확대", () => {
      it("목록을 다시 그린 뒤에도 상세에 같은 그림이 커진다", () => {
        const body = mountPlaces();
        flushSpatialCardThumbs();
        const card = body.querySelector<HTMLButtonElement>(".spatial-card");
        expect(card).not.toBeNull();
        const listed = card!.querySelector("img");
        expect(listed?.getAttribute("src")).toBeTruthy();

        // 한 번 클릭은 선택만 한다. 상세는 선택한 칸의 액션 줄 「상세 보기」가 연다.
        card!.click();
        const detailButton = body.querySelector<HTMLButtonElement>("[data-testid='spatial-cell-detail']");
        expect(detailButton).not.toBeNull();
        detailButton!.click();

        const detail = document.body.querySelector("[data-testid='spatial-place-detail']");
        const stage = detail?.querySelector("[data-zoom='detail']");
        expect(detail, stage?.textContent ?? "no detail").not.toBeNull();
        const zoom = document.body.querySelector<HTMLImageElement>("[data-testid='spatial-place-detail'] .spatial-place-zoom-art");
        expect(zoom, stage?.textContent ?? "no zoom").not.toBeNull();
        expect(zoom!.src.endsWith(listed!.getAttribute("src") ?? "missing")).toBe(true);
        expect(zoom!.closest(".database-modal-body")).toBeNull();
      });
    });
    beforeAll(() => {
      store.replace(previous, { preserveEventDrafts: false });
    });
  });
  describe("spatialPlaceForkContract", () => {
    isolateTimers();
    beforeAll(() => {
      setupCombinedAuthoring();
    });
    afterEach(resetSpatialPlacesTabChrome);
    it("accepts the first named place in one undoable transaction when inspector edits fork a real controller draft", () => {
      // Given: a canonical empty live place library, retaining independent frozen occurrences.
      const fixture = placeCompilerFixture(7);
      const spatial = fixtureDocument(fixture);
      const canonical = deserialize(serialize({
        ...fixture,
        spatialAuthoring: { ...spatial, library: { ...spatial.library, places: {} } },
      }));
      installManualProject(canonical);
      resetSpatialPlacesTabChrome();
      const live = store.getCurrent();
      const frozenOccurrences = structuredClone(fixtureDocument(live).occurrences);
      expect(Object.keys(frozenOccurrences).length).toBeGreaterThan(0);
      const host = document.createElement("div");
      const paint = (): void => {
        host.replaceChildren(renderSpatialPlacesInspector(visiblePlaceSelection(undefined), true, paint));
      };
      const chrome = () => spatialPlacesChrome(visiblePlaceSelection(undefined), paint);
      const nameValue = "\uD638\uC22B\uAC00";

      // When: the public place actions add, rename, preview and accept through the real controller.
      chrome().add?.();
      const created = Object.values(fixtureDocument(visibleAuthoringProject()).library.places);
      expect(created).toHaveLength(1);
      const place = created[0];
      if (!place) throw new TypeError("Expected the created place");
      expect(place).toMatchObject({ children: [], ports: [], connections: [], tags: [] });
      expect(visiblePlaceSelection(undefined)?.localId).toBe(place.id);
      expect(spatialSession().designId).toBe(visiblePlaceSelection(undefined)?.id);
      const name = host.querySelector<HTMLInputElement>("[data-testid='spatial-place-name']");
      if (!name) throw new TypeError("Expected the place name input");
      name.value = nameValue;
      name.dispatchEvent(new Event("change"));
      expect(store.getCurrent()).toBe(live);
      expect(fixtureDocument(live).library.places).toEqual({});
      expect(fixtureDocument(visibleAuthoringProject()).library.places[place.id]?.name).toBe(nameValue);
      chrome().preview?.();
      expect(chrome().previewError).toBeNull();
      expect(chrome().apply).toBeTypeOf("function");
      expect(store.getCurrent()).toBe(live);
      expect(getMapEditHistoryEntries()).toHaveLength(0);
      chrome().apply?.();

      // Then: acceptance preserves the named design and frozen output, with exactly one undo/redo.
      expect(chrome().previewError).toBeNull();
      const accepted = structuredClone(store.getCurrent());
      expect(Object.keys(fixtureDocument(accepted).library.places)).toEqual([place.id]);
      expect(fixtureDocument(accepted).library.places[place.id]?.name).toBe(nameValue);
      expect(fixtureDocument(accepted).occurrences).toEqual(frozenOccurrences);
      expect(deserialize(serialize(accepted))).toEqual(accepted);
      expect(getMapEditHistoryEntries()).toHaveLength(1);
      chrome().undo?.();
      expect(store.getCurrent()).toEqual(live);
      expect(getMapEditHistoryState()).toEqual({ canUndo: false, canRedo: true });
      chrome().redo?.();
      expect(store.getCurrent()).toEqual(accepted);
      expect(getMapEditHistoryState()).toEqual({ canUndo: true, canRedo: false });
    });
  });
  describe("spatialSession", () => {
    isolateTimers();
    const previous = store.getCurrent();
    beforeEach(() => {
      resetSpatialAuthoringSessions();
      store.replace(createBlankProject(), { preserveEventDrafts: false });
    });
    afterEach(() => {
      resetSpatialAuthoringSessions();
      store.replace(previous, { preserveEventDrafts: false });
    });
    describe("spatial authoring session", () => {
      it("keeps selection and camera across real store.update and updateMap clones", () => {
        // Given: a live project session with a chosen design and camera
        selectSpatialDesign("inn");
        setSpatialCamera({ x: 9, y: 3, zoom: 2 });
        const key = spatialProjectKey();
        const mapId = store.getCurrent().startMapId;
        expect(store.getCurrent().maps[mapId]).toBeDefined();

        // When: ordinary same-project edits replace the project object
        store.update((draft) => {
          draft.meta = { ...draft.meta, title: "same-project edit" };
        });
        store.updateMap(mapId, (draft) => {
          draft.name = "renamed-map";
        });

        // Then: UI session is keyed by stable identity, not the cloned object
        expect(spatialProjectKey()).toBe(key);
        expect(store.getCurrent().meta.title).toBe("same-project edit");
        expect(store.getCurrent().maps[mapId]?.name).toBe("renamed-map");
        expect(spatialSession().designId).toBe("inn");
        expect(spatialSession().camera).toEqual({ x: 9, y: 3, zoom: 2 });
      });

      it("keeps selection across undo-style replace of the same project identity", () => {
        // Given
        selectSpatialDesign("inn");
        setSpatialCamera({ x: 4, y: 1, zoom: 1 });
        const snapshot = structuredClone(store.getCurrent());
        store.update((draft) => {
          draft.meta = { ...draft.meta, title: "dirty" };
        });

        // When: restore a cloned snapshot without switching project identity
        store.replace(snapshot, { preserveEventDrafts: false });

        // Then
        expect(spatialSession().designId).toBe("inn");
        expect(spatialSession().camera).toEqual({ x: 4, y: 1, zoom: 1 });
      });

      it("isolates sessions across real project switches", () => {
        // Given
        selectSpatialDesign("inn");
        setSpatialCamera({ x: 12, y: 4, zoom: 2 });
        const firstKey = spatialProjectKey();

        // When
        store.replaceProject(createBlankProject());

        // Then
        expect(spatialProjectKey()).not.toBe(firstKey);
        expect(spatialSession().designId).toBeNull();
        expect(spatialSession().camera).toEqual({ x: 0, y: 0, zoom: 1 });
      });

      it("clears stored UI sessions through the reset helper", () => {
        // Given
        selectSpatialDesign("inn");
        setSpatialCamera({ x: 2, y: 2, zoom: 3 });

        // When
        resetSpatialAuthoringSessions();

        // Then
        expect(spatialSession().designId).toBeNull();
        expect(spatialSession().camera).toEqual({ x: 0, y: 0, zoom: 1 });
      });

      it("does not silently change the selected design when the source filter changes", () => {
        selectSpatialDesign("inn");
        patchSpatialSession({ source: "own" });
        expect(spatialSession().designId).toBe("inn");
        patchSpatialSession({ source: "defaults" });
        expect(spatialSession().designId).toBe("inn");
      });

      it("restores camera and selection from the breadcrumb", () => {
        setSpatialTab("places");
        selectSpatialDesign("inn");
        setSpatialCamera({ x: 8, y: 2, zoom: 1 });
        pushSpatialBreadcrumb();
        patchSpatialSession({ tab: "spaces", designId: "bedroom", camera: { x: 0, y: 0, zoom: 1 } });
        popSpatialBreadcrumb();
        expect(spatialSession().tab).toBe("places");
        expect(spatialSession().designId).toBe("inn");
        expect(spatialSession().camera).toEqual({ x: 8, y: 2, zoom: 1 });
      });

      it("keeps a tab's own selection when switching destinations", () => {
        setSpatialTab("places");
        selectSpatialDesign("inn");
        setSpatialTab("objects");
        selectSpatialDesign("bed_v");
        setSpatialTab("places");
        expect(spatialSession().designId).toBe("inn");
        setSpatialTab("objects");
        expect(spatialSession().designId).toBe("bed_v");
      });
    });
  });
  describe("spatialSpaceMemberUi", () => {
    isolateTimers();
    const previous = store.getCurrent();
    function designSession(): SpatialAuthoringSession {
      return {
        tab: "spaces",
        mode: "design",
        source: "own",
        designId: `library-space/library/${spaceDesign}`,
        occurrenceId: null,
        camera: { x: 0, y: 0, zoom: 1 },
        breadcrumb: [],
        legacyOrigin: null,
        placeKindFilter: null,
        regionKindFilter: null,
        inspectorOpen: true,
      };
    }
    function placedSession(occurrenceId = spaceRoot): SpatialAuthoringSession {
      return {
        ...designSession(),
        mode: "instances",
        designId: null,
        occurrenceId,
      };
    }
    function placedCard(occurrenceId = spaceRoot) {
      return {
        id: occurrenceId,
        localId: spaceDesign,
        name: "Compiler room",
        source: "placed" as const,
        kind: "spaces" as const,
        usage: 0,
      };
    }
    function mockBoardRect(board: HTMLElement): void {
      board.getBoundingClientRect = () => ({
        x: 0, y: 0, left: 0, top: 0, right: 480, bottom: 288, width: 480, height: 288, toJSON: () => undefined,
      });
    }
    beforeEach(() => {
      store.replace(spaceCompilerFixture(7));
      resetSpatialSpacesTabChrome();
      resetSpatialAuthoringSessions();
      bindSpatialAuthoringControllerFactory(createSpatialAuthoringController);
    });
    afterEach(() => {
      vi.restoreAllMocks();
      bindSpatialAuthoringControllerFactory(null);
      resetSpatialSpacesTabChrome();
      resetSpatialAuthoringSessions();
      store.replace(previous);
    });
    describe("placed space member UI", () => {
      it("enumerates actual children including opaque ids, repetitions, and deleted gaps", () => {
        const fixture = placedSpaceFixture();
        bindSpatialAuthoringControllerFactory(() => fixture.controller);
        const host = document.createElement("div");
        host.append(renderSpatialSpacesCanvas(placedSession(), placedCard(), () => undefined));
        const tokens = [...host.querySelectorAll("[data-testid^='spatial-member-']")].map((node) => {
          const el = node as HTMLElement;
          return { testid: el.dataset.testid, slotId: el.dataset.slotId, index: el.dataset.index, occurrenceId: el.dataset.occurrenceId };
        });
        expect(tokens).toEqual(expect.arrayContaining([
          expect.objectContaining({
            testid: `spatial-member-${repeatedSlot}-0`,
            slotId: repeatedSlot,
            index: "0",
            occurrenceId: "opaque first member",
          }),
          expect.objectContaining({
            testid: `spatial-member-${repeatedSlot}-2`,
            slotId: repeatedSlot,
            index: "2",
            occurrenceId: "opaque selected member",
          }),
        ]));
        expect(tokens.some((token) => token.index === "1")).toBe(false);
        expect(host.querySelector("[data-testid='spatial-slot-repeated-hearth']")).toBeNull();
      });

      it("moves only the selected actual member and leaves sibling coordinates frozen until apply", () => {
        const fixture = placedSpaceFixture();
        bindSpatialAuthoringControllerFactory(() => fixture.controller);
        const live = store.getCurrent();
        const siblingBefore = structuredClone(own(fixtureDocument(live).occurrences, spatialId("sibling room")));
        const host = document.createElement("div");
        document.body.append(host);
        const paint = (): void => {
          host.replaceChildren(renderSpatialSpacesCanvas(placedSession(), placedCard(), paint));
        };
        paint();
        const board = host.querySelector("[data-testid='spatial-space-board']");
        const token = host.querySelector(`[data-testid='spatial-member-${repeatedSlot}-2']`);
        expect(board).toBeInstanceOf(HTMLElement);
        expect(token).toBeInstanceOf(HTMLElement);
        if (!(board instanceof HTMLElement) || !(token instanceof HTMLElement)) return;
        mockBoardRect(board);
        token.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, clientX: 12, clientY: 12 }));
        const liveBoard = host.querySelector("[data-testid='spatial-space-board']");
        expect(liveBoard).toBeInstanceOf(HTMLElement);
        if (!(liveBoard instanceof HTMLElement)) return;
        mockBoardRect(liveBoard);
        liveBoard.dispatchEvent(new PointerEvent("pointermove", { bubbles: true, clientX: 4 * SPACE_TILE_PX + 1, clientY: 5 * SPACE_TILE_PX + 1 }));
        liveBoard.dispatchEvent(new PointerEvent("pointerup", { bubbles: true, clientX: 4 * SPACE_TILE_PX + 1, clientY: 5 * SPACE_TILE_PX + 1 }));
        const working = fixtureDocument(workingProject());
        expect(own(working.occurrences, spatialId("opaque selected member")).x).toBe(4);
        expect(own(working.occurrences, spatialId("opaque selected member")).y).toBe(5);
        expect(own(working.occurrences, spatialId("opaque first member")).x).toBe(1);
        expect(own(working.occurrences, spatialId("opaque first member")).y).toBe(4);
        expect(store.getCurrent().spatialAuthoring).toEqual(live.spatialAuthoring);
        expect(own(fixtureDocument(store.getCurrent()).occurrences, spatialId("sibling room"))).toEqual(siblingBefore);
        host.remove();
      });

      it("adds with a fresh opaque slot id from drop and keyboard, not a template collision key", () => {
        const host = document.createElement("div");
        document.body.append(host);
        const paint = (): void => {
          host.replaceChildren(renderSpatialSpacesCanvas(placedSession(), placedCard(), paint));
        };
        paint();
        const board = host.querySelector("[data-testid='spatial-space-board']");
        const object = host.querySelector("[data-testid='spatial-object-bed-design']");
        expect(board).toBeInstanceOf(HTMLElement);
        expect(object).toBeInstanceOf(HTMLElement);
        if (!(board instanceof HTMLElement) || !(object instanceof HTMLElement)) return;
        object.click();
        const liveBoard = host.querySelector("[data-testid='spatial-space-board']");
        expect(liveBoard).toBeInstanceOf(HTMLElement);
        if (!(liveBoard instanceof HTMLElement)) return;
        mockBoardRect(liveBoard);
        const transfer = new DataTransfer();
        transfer.setData("text/spatial-object", "bed-design");
        liveBoard.dispatchEvent(new DragEvent("drop", {
          bubbles: true, cancelable: true, clientX: 3 * SPACE_TILE_PX + 1, clientY: 2 * SPACE_TILE_PX + 1, dataTransfer: transfer,
        }));
        const afterDrop = fixtureDocument(workingProject());
        const dropped = Object.values(afterDrop.occurrences).filter((child) => child.parentId === spaceRoot && child.source.id === "bed-design");
        const novel = dropped.filter((child) => child.parentSlot && !["beds", "hearth", "stairs"].includes(child.parentSlot.slotId));
        expect(novel).toHaveLength(1);
        expect(novel[0]?.parentSlot?.slotId.startsWith("slot-bed-design-")).toBe(false);
        const keyed = host.querySelector("[data-testid='spatial-space-board']");
        expect(keyed).toBeInstanceOf(HTMLElement);
        if (!(keyed instanceof HTMLElement)) return;
        keyed.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
        const afterKey = fixtureDocument(workingProject());
        const added = Object.values(afterKey.occurrences).filter((child) => child.parentId === spaceRoot && child.source.id === "bed-design"
          && child.parentSlot && !["beds", "hearth", "stairs"].includes(child.parentSlot.slotId));
        expect(added.length).toBeGreaterThanOrEqual(2);
        expect(new Set(added.map((child) => child.parentSlot?.slotId)).size).toBe(added.length);
        host.remove();
      });

      it("keeps required/quantity on the slot recipe and chips on the selected member", () => {
        const fixture = placedSpaceFixture();
        bindSpatialAuthoringControllerFactory(() => fixture.controller);
        const host = document.createElement("div");
        document.body.append(host);
        const paint = (): void => {
          host.replaceChildren(
            renderSpatialSpacesCanvas(placedSession(), placedCard(), paint),
            renderSpatialSpacesInspector(placedCard(), true, paint),
          );
        };
        paint();
        host.querySelector(`[data-testid='spatial-member-${repeatedSlot}-2']`)?.dispatchEvent(new Event("click", { bubbles: true }));
        paint();
        const quantity = host.querySelector("[data-testid='spatial-slot-quantity']");
        const required = host.querySelector("[data-testid='spatial-slot-required']");
        const chips = host.querySelector("[data-testid='spatial-slot-chips']");
        expect(quantity).toBeInstanceOf(HTMLInputElement);
        expect(required).toBeInstanceOf(HTMLInputElement);
        expect(chips).toBeInstanceOf(HTMLInputElement);
        if (!(quantity instanceof HTMLInputElement) || !(required instanceof HTMLInputElement) || !(chips instanceof HTMLInputElement)) return;
        expect(quantity.value).toBe("3");
        expect(required.checked).toBe(true);
        expect(chips.value).toBe("");
        chips.value = "lamp";
        chips.dispatchEvent(new Event("change", { bubbles: true }));
        const working = fixtureDocument(workingProject());
        const selected = own(working.occurrences, spatialId("opaque selected member"));
        const first = own(working.occurrences, spatialId("opaque first member"));
        expect(own(selected.snapshot.library.objects, selected.source.id).chips).toEqual(["lamp"]);
        expect(own(first.snapshot.library.objects, first.source.id).chips).toEqual(["event"]);
        const slot = own(working.occurrences, spaceRoot).snapshot.library.spaces[spaceDesign]?.objectSlots.find((entry) => entry.id === repeatedSlot);
        expect(slot?.quantity).toBe(3);
        host.remove();
      });

      it("clones a placed space onto the new occurrence without labeling a bare clone as compiled", () => {
        const beforeIds = new Set(Object.keys(store.getCurrent().spatialAuthoring?.occurrences ?? {}));
        const chrome = spatialSpacesChrome(placedCard(), () => undefined);
        chrome.duplicate?.();
        const session = spatialSession();
        expect(session.mode).toBe("instances");
        expect(session.occurrenceId).toBeTruthy();
        const clonedId = session.occurrenceId ?? "";
        expect(beforeIds.has(clonedId)).toBe(false);
        expect(workingProject().spatialAuthoring?.occurrences[clonedId]).toBeTruthy();
        expect(spatialSpacesChrome(placedCard(spatialId(clonedId || spaceRoot)), () => undefined).saveState).not.toBe("미리보기");
      });

      it("rejects a blocked required landing without changing live store or history length", () => {
        const past = getMapEditHistoryEntries().length;
        const before = structuredClone(store.getCurrent().spatialAuthoring);
        const host = document.createElement("div");
        document.body.append(host);
        const paint = (): void => {
          host.replaceChildren(renderSpatialSpacesCanvas(placedSession(), placedCard(), paint));
        };
        paint();
        const hearthId = findOccurrenceChildId(fixtureDocument(workingProject()), spaceRoot, { slotId: spatialId("hearth"), index: 0 });
        const board = host.querySelector("[data-testid='spatial-space-board']");
        const token = host.querySelector("[data-testid='spatial-member-hearth-0']");
        expect(board).toBeInstanceOf(HTMLElement);
        expect(token).toBeInstanceOf(HTMLElement);
        if (!(board instanceof HTMLElement) || !(token instanceof HTMLElement)) return;
        mockBoardRect(board);
        token.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, clientX: 12, clientY: 12 }));
        const liveBoard = host.querySelector("[data-testid='spatial-space-board']");
        expect(liveBoard).toBeInstanceOf(HTMLElement);
        if (!(liveBoard instanceof HTMLElement)) return;
        mockBoardRect(liveBoard);
        liveBoard.dispatchEvent(new PointerEvent("pointermove", { bubbles: true, clientX: 20 * SPACE_TILE_PX + 1, clientY: 20 * SPACE_TILE_PX + 1 }));
        liveBoard.dispatchEvent(new PointerEvent("pointerup", { bubbles: true, clientX: 20 * SPACE_TILE_PX + 1, clientY: 20 * SPACE_TILE_PX + 1 }));
        expect(store.getCurrent().spatialAuthoring).toEqual(before);
        expect(getMapEditHistoryEntries().length).toBe(past);
        if (hearthId) {
          expect(own(fixtureDocument(workingProject()).occurrences, hearthId).x).toBe(1);
          expect(own(fixtureDocument(workingProject()).occurrences, hearthId).y).toBe(4);
        }
        host.remove();
      });
    });
    describe("space canvas geometry", () => {
      it("paints handle-scale tiles and offsets interior art by the real layout origin", () => {
        const project = spaceCompilerFixture();
        store.replace(project);
        const space = own(fixtureDocument(project).library.spaces, spaceDesign);
        const layout = spaceLayout(project, space, { mapId: `spatial-canvas:${space.id}`, seed: 7 });
        const render = vi.spyOn(kitRender, "renderTileCellsToCanvas");
        const canvas = renderSpatialSpacesCanvas(designSession(), {
          id: `library-space/library/${spaceDesign}`, localId: spaceDesign, name: space.name,
          source: "own", kind: "spaces", usage: 0,
        }, () => undefined);
        const art = canvas.querySelector(".spatial-space-board-art");
        expect(render).toHaveBeenCalledWith(expect.objectContaining({
          scale: SPACE_TILE_PX / 16,
          widthTiles: layout.map.width,
          heightTiles: layout.map.height,
        }));
        expect(art).toBeInstanceOf(HTMLElement);
        if (!(art instanceof HTMLElement)) return;
        expect(art.style.left).toBe(`${-layout.room.x * SPACE_TILE_PX}px`);
        expect(art.style.top).toBe(`${-layout.room.y * SPACE_TILE_PX}px`);
        expect(spaceDraftTarget({
          id: "compat", localId: spaceDesign, name: "호환", source: "default", kind: "spaces", usage: 0, compatibility: "room-rule",
        }).libraryId).toBeUndefined();
      });
    });
  });
});
