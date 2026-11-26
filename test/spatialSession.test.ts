// @vitest-environment happy-dom

import { beforeEach, describe, expect, it, afterEach, vi, beforeAll } from "vitest";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import { renderSpatialAuthoringShell } from "@/editor/panels/spatialShell";
import { flushSpatialCardThumbs, resetSpatialCardThumbs } from "@/editor/panels/spatialCardThumbs";
import { resetSpatialAuthoringSessions, spatialSession, patchSpatialSession, popSpatialBreadcrumb, pushSpatialBreadcrumb, selectSpatialDesign, setSpatialCamera, setSpatialTab, spatialProjectKey, type SpatialAuthoringSession } from "@/editor/panels/spatialAuthoringSession";
import { getMapEditHistoryEntries, getMapEditHistoryState } from "@/editor/mapEditHistory";
import { visibleAuthoringProject, bindSpatialAuthoringControllerFactory } from "@/editor/panels/spatialAuthoringAccess";
import { renderSpatialPlacesInspector, resetSpatialPlacesTabChrome, spatialPlacesChrome, visiblePlaceSelection } from "@/editor/panels/spatialPlacesTab";
import { deserialize, serialize } from "@/project/io";
import { setupCombinedAuthoring } from "./support/combinedAuthoringFixture";
import { installManualProject } from "./support/spatialManualBuildFixture";
import { placeCompilerFixture } from "./support/spatialPlaceCompilerFixture";
import { fixtureDocument, spaceCompilerFixture, spaceDesign, spaceRoot } from "./support/spatialSpaceCompilerFixture";
import * as kitRender from "@/editor/harnessSuggestion/kitRender";
import { SPACE_TILE_PX, renderSpatialSpacesCanvas } from "@/editor/panels/spatialSpaceCanvas";
import { workingProject } from "@/editor/panels/spatialSpaceCommands";
import { spaceDraftTarget } from "@/editor/panels/spatialSpaceDraft";
import { renderSpatialSpacesInspector, resetSpatialSpacesTabChrome, spatialSpacesChrome } from "@/editor/panels/spatialSpacesTab";
import { createSpatialAuthoringController } from "@/editor/spatial/actions";
import { spaceLayout } from "@/editor/spatial/spaceLayout";
import { findOccurrenceChildId, own, spatialId } from "@/project/spatial/domain";
import { placedSpaceFixture, repeatedSlot } from "./support/placedSpaceFixture";
import { isolateTimers } from "./mergedTeardown";

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
