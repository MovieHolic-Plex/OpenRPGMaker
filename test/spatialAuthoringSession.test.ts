// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, beforeAll } from "vitest";
import { listSpatialGalleryCards, spatialCardById, spatialPresentationId } from "@/editor/panels/spatialCatalog";
import { visibleSpatialSelection } from "@/editor/panels/spatialStage";
import { resetSpatialAuthoringSessions, selectSpatialDesign, selectSpatialOccurrence, setSpatialTab, spatialSession, type SpatialAuthoringSession } from "@/editor/panels/spatialAuthoringSession";
import { createBlankProject } from "@/project/defaults";
import { deserialize, serialize } from "@/project/io";
import { store } from "@/project/store";
import { spatialFixture, spatialWire } from "./support/spatialSchemaFixture";
import { renderSpatialAuthoringShell } from "@/editor/panels/spatialShell";
import { flushSpatialCardThumbs, resetSpatialCardThumbs } from "@/editor/panels/spatialCardThumbs";
import { editorState } from "@/editor/editorState";
import { getDatabaseActiveTab, renderDatabasePanel, setDatabaseActiveTab } from "@/editor/panels/database";
import { bindSpatialAuthoringControllerFactory } from "@/editor/panels/spatialAuthoringAccess";
import { resetSpatialRegionsTabChrome } from "@/editor/panels/spatialRegionsTab";
import { resetSpatialWorldsTabChrome } from "@/editor/panels/spatialWorldsTab";
import { libraryRegionCardId, libraryWorldCardId } from "@/editor/panels/spatialGeographyQuery";
import { createSpatialAuthoringController } from "@/editor/spatial/actions";
import { spatialId } from "@/project/spatial/domain";
import { geographyRecipeFixture } from "./support/spatialGeographyRecipes";
import { geographyRoot } from "./support/spatialGeographyFixture";
import { isolateTimers } from "./mergedTeardown";

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
