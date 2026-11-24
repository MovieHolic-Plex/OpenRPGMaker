// @vitest-environment happy-dom

import { beforeEach, describe, expect, it, afterEach, beforeAll } from "vitest";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import { renderSpatialAuthoringShell } from "@/editor/panels/spatialShell";
import { flushSpatialCardThumbs, resetSpatialCardThumbs } from "@/editor/panels/spatialCardThumbs";
import { resetSpatialAuthoringSessions, spatialSession, patchSpatialSession, popSpatialBreadcrumb, pushSpatialBreadcrumb, selectSpatialDesign, setSpatialCamera, setSpatialTab, spatialProjectKey } from "@/editor/panels/spatialAuthoringSession";
import { getMapEditHistoryEntries, getMapEditHistoryState } from "@/editor/mapEditHistory";
import { visibleAuthoringProject } from "@/editor/panels/spatialAuthoringAccess";
import { renderSpatialPlacesInspector, resetSpatialPlacesTabChrome, spatialPlacesChrome, visiblePlaceSelection } from "@/editor/panels/spatialPlacesTab";
import { deserialize, serialize } from "@/project/io";
import { setupCombinedAuthoring } from "./support/combinedAuthoringFixture";
import { installManualProject } from "./support/spatialManualBuildFixture";
import { placeCompilerFixture } from "./support/spatialPlaceCompilerFixture";
import { fixtureDocument } from "./support/spatialSpaceCompilerFixture";
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
