// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { editorState } from "@/editor/editorState";
import { renderDatabasePanel, setDatabaseActiveTab } from "@/editor/panels/database";
import { resetScratchConceptTabSession } from "@/editor/panels/scratchConceptTab";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import { patchSpatialSession, popSpatialBreadcrumb, pushSpatialBreadcrumb, resetSpatialAuthoringSessions, selectSpatialDesign, setSpatialCamera, setSpatialTab, spatialProjectKey, spatialSession } from "@/editor/panels/spatialAuthoringSession";
import { resetMapEditHistory } from "@/editor/mapEditHistory";
import { bindSpatialAuthoringControllerFactory, hasAuthoringPreview } from "@/editor/panels/spatialAuthoringAccess";
import { spatialBuildProposal } from "@/editor/panels/spatialBuildActions";
import { resetSpatialObjectsTabChrome } from "@/editor/panels/spatialObjectChromeState";
import { libraryObjectCardId } from "@/editor/panels/spatialObjectDraft";
import { resetSpatialPlacesTabChrome } from "@/editor/panels/spatialPlaceChromeState";
import { librarySpaceCardId } from "@/editor/panels/spatialSpaceDraft";
import { resetSpatialSpacesTabChrome } from "@/editor/panels/spatialSpacesTab";
import { createSpatialAuthoringController } from "@/editor/spatial/actions";
import { manualBuildFixture } from "./support/spatialManualBuildFixture";
import { spaceDesign } from "./support/spatialSpaceCompilerFixture";
import { isolateTimers } from "./mergedTeardown";

describe("spatialNavigation", () => {
  isolateTimers();
  const tabs = ["tiles", "objects", "places", "regions", "worlds"] as const;
  let host: HTMLDivElement;
  const previousProject = store.getCurrent();
  const previousEditor = editorState.get();
  beforeEach(() => {
    const project = createBlankProject();
    // Missing libraries exercise the read-only contract, not an already-seeded fallback.
    for (const tileset of Object.values(project.tilesets)) delete tileset.scratchConceptBundles;
    store.replace(project);
    editorState.set({ currentMapId: project.startMapId });
    resetScratchConceptTabSession();
    setDatabaseActiveTab("scratchConcepts");
    host = document.createElement("div");
    host.className = "database-modal-body";
    document.body.append(host);
  });
  afterEach(() => {
    host.remove();
    resetScratchConceptTabSession();
    store.replace(previousProject);
    editorState.set(previousEditor);
    setDatabaseActiveTab("overview");
  });
  describe("spatial navigation acceptance (task 12 owns GREEN)", () => {
    it("renders the five ordered spatial destinations when the legacy concept route opens", () => {
      // Given: real database host and current outdoor map from beforeEach.
      // When
      renderDatabasePanel(host);
      // Then: renderer output, not a registry-only assertion.
      expect(Array.from(host.querySelectorAll<HTMLElement>('.db-tabs [data-testid^="db-tab-spatial-"]'), node => node.dataset.testid))
        .toEqual(tabs.map(tab => `db-tab-spatial-${tab}`));
    });

    it("leaves the whole project unchanged when opening a legacy authoring route to browse", () => {
      // Given
      const before = structuredClone(store.getCurrent());
      // When
      renderDatabasePanel(host);
      // Then: opening the route must not seed the missing interior catalog.
      expect(store.getCurrent()).toEqual(before);
    });

    it.each(tabs)("keeps browsing %s read-only through the rendered navigation control", tab => {
      // Given
      renderDatabasePanel(host);
      const before = structuredClone(store.getCurrent());
      const control = host.querySelector<HTMLButtonElement>(`[data-testid="db-tab-spatial-${tab}"]`);
      expect(control, `Missing rendered spatial route: ${tab}`).not.toBeNull();
      if (!control) throw new Error(`Missing rendered spatial route: ${tab}`);
      // When
      control.click();
      // Then
      expect(control.classList.contains("active")).toBe(true);
      expect(store.getCurrent()).toEqual(before);
    });
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

describe("spatialSourceBuildUiBoundary", () => {
  isolateTimers();
  const previous = store.getCurrent();
  const previousEditor = editorState.get();
  let host: HTMLDivElement;
  let target: ReturnType<typeof manualBuildFixture>["target"];
  function paint(): void {
    renderDatabasePanel(host);
  }
  function control<T extends Element>(testid: string): T {
    const node = host.querySelector<T>(`[data-testid=${JSON.stringify(testid)}]`);
    if (!node) throw new Error(`missing ${testid}`);
    return node;
  }
  function fill(testid: string, value: string): void {
    const input = control<HTMLInputElement>(testid);
    input.value = value;
    input.dispatchEvent(new Event("change"));
  }
  function click(testid: string): void {
    const picker = host.querySelector<HTMLSelectElement>("[data-testid='composition-design']");
    if (testid.startsWith("spatial-card-") && picker) {
      picker.value = testid.slice("spatial-card-".length); picker.dispatchEvent(new Event("change")); return;
    }
    control<HTMLButtonElement>(testid).click();
  }
  function selectObject(): void {
    setDatabaseActiveTab("spatialObjects");
    paint();
    click(`spatial-card-${libraryObjectCardId("hearth-design")}`);
  }
  function selectSpace(): void {
    setDatabaseActiveTab("spatialSpaces");
    paint();
    click(`spatial-card-${librarySpaceCardId(spaceDesign)}`);
  }
  function fillTarget(): void {
    fill("spatial-build-map", target.mapId);
    fill("spatial-build-rect-x", String(target.rect.x));
    fill("spatial-build-rect-y", String(target.rect.y));
    fill("spatial-build-rect-width", String(target.rect.width));
    fill("spatial-build-rect-height", String(target.rect.height));
    fill("spatial-build-entry-x", String(target.entry.x));
    fill("spatial-build-entry-y", String(target.entry.y));
  }
  beforeEach(() => {
    bindSpatialAuthoringControllerFactory(createSpatialAuthoringController);
    resetSpatialAuthoringSessions();
    resetSpatialPlacesTabChrome();
    resetSpatialSpacesTabChrome();
    resetSpatialObjectsTabChrome();
    resetMapEditHistory();
    target = manualBuildFixture().target;
    editorState.set({ currentMapId: store.getCurrent().startMapId, selection: null, activePaletteStamp: null });
    host = document.createElement("div");
    host.className = "database-modal-body";
    document.body.append(host);
  });
  afterEach(() => {
    host.remove();
    bindSpatialAuthoringControllerFactory(null);
    resetSpatialAuthoringSessions();
    resetSpatialPlacesTabChrome();
    resetSpatialSpacesTabChrome();
    resetSpatialObjectsTabChrome();
    store.replace(previous, { preserveEventDrafts: false });
    editorState.set(previousEditor);
    setDatabaseActiveTab("overview");
  });
  describe("source build input lifecycle", () => {
    it("requires fresh object target consent after store.replaceProject with a coincident map id", () => {
      // Given
      selectObject();
      fillTarget();
      fill("spatial-build-seed", "19");
      click("spatial-build");
      expect(hasAuthoringPreview()).toBe(true);
      const other = structuredClone(store.getCurrent());
      const otherMap = other.maps[target.mapId];
      if (!otherMap) throw new Error("missing coincident map");
      otherMap.name = "Project B coincident map";
      const keyA = spatialProjectKey();
      store.replaceProject(other);
      expect(spatialProjectKey()).not.toBe(keyA);
      paint();
      selectObject();
      expect(spatialBuildProposal()).toBeNull();
      const beforeB = structuredClone(store.getCurrent());
      // When
      click("spatial-build");
      const previewIssued = hasAuthoringPreview();
      click("spatial-apply");
      // Then
      expect(previewIssued).toBe(false);
      expect(spatialBuildProposal()).toBeNull();
      expect(store.getCurrent()).toEqual(beforeB);
    });

    it.each(["", "1.5", "9007199254740992"] as const)("rejects empty or non-integer seed %j without issuing a proposal", (value) => {
      // Given
      selectSpace();
      fill("spatial-build-seed", value);
      const live = structuredClone(store.getCurrent());
      // When
      click("spatial-build");
      // Then
      expect(hasAuthoringPreview()).toBe(false);
      expect(spatialBuildProposal()).toBeNull();
      expect(store.getCurrent()).toEqual(live);
      expect(control<HTMLInputElement>("spatial-build-seed").value).toBe(value);
    });

    it("keeps an explicit zero seed as zero", () => {
      // Given
      selectSpace();
      fill("spatial-build-seed", "0");
      // When
      click("spatial-build");
      // Then
      expect(spatialBuildProposal()?.input.seed).toBe(0);
      expect(hasAuthoringPreview()).toBe(true);
    });

    it("rejects a negative object entry without pinning, then builds after correction", () => {
      // Given
      selectObject();
      fillTarget();
      fill("spatial-build-seed", "19");
      fill("spatial-build-entry-x", "-1");
      click("spatial-build");
      expect(hasAuthoringPreview()).toBe(false);
      expect(spatialBuildProposal()).toBeNull();
      expect(control<HTMLElement>("spatial-preview-error").textContent).not.toBe("");
      expect(control<HTMLInputElement>("spatial-build-entry-x").value).toBe("-1");
      const live = structuredClone(store.getCurrent());
      // When
      fill("spatial-build-entry-x", String(target.entry.x));
      click("spatial-build");
      // Then
      expect(store.getCurrent()).toEqual(live);
      expect(hasAuthoringPreview()).toBe(true);
      expect(spatialBuildProposal()?.input.destination).toMatchObject({
        kind: "map",
        currentMapId: target.mapId,
        entry: target.entry,
      });
      expect(control<HTMLElement>("spatial-preview-error").textContent).toBe("");
    });
  });
});
