// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  patchSpatialSession,
  popSpatialBreadcrumb,
  pushSpatialBreadcrumb,
  resetSpatialAuthoringSessions,
  selectSpatialDesign,
  setSpatialCamera,
  setSpatialTab,
  spatialProjectKey,
  spatialSession,
} from "@/editor/panels/spatialAuthoringSession";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";

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
