// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { editorState } from "@/editor/editorState";
import {
  getDatabaseActiveTab,
  renderDatabasePanel,
  setDatabaseActiveTab,
} from "@/editor/panels/database";
import { bindSpatialAuthoringControllerFactory } from "@/editor/panels/spatialAuthoringAccess";
import {
  resetSpatialAuthoringSessions,
  selectSpatialDesign,
  selectSpatialOccurrence,
  setSpatialTab,
  spatialSession,
} from "@/editor/panels/spatialAuthoringSession";
import { resetSpatialRegionsTabChrome } from "@/editor/panels/spatialRegionsTab";
import { resetSpatialWorldsTabChrome } from "@/editor/panels/spatialWorldsTab";
import { libraryRegionCardId, libraryWorldCardId } from "@/editor/panels/spatialGeographyQuery";
import { createSpatialAuthoringController } from "@/editor/spatial/actions";
import { spatialId } from "@/project/spatial/domain";
import { store } from "@/project/store";
import { geographyRecipeFixture } from "./support/spatialGeographyRecipes";
import { geographyRoot } from "./support/spatialGeographyFixture";

const previous = store.getCurrent();
const previousEditor = editorState.get();
let host: HTMLDivElement;

function paint(): void {
  renderDatabasePanel(host);
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
    const canvas = host.querySelector("[data-testid='spatial-canvas']");
    expect(canvas).not.toBeNull();
    expect(canvas?.classList.contains("spatial-geography-canvas")).toBe(true);
    expect(host.querySelector("[data-testid='spatial-geography-raster']")).not.toBeNull();
    expect(host.querySelector("[data-testid='spatial-geography-board']")?.getAttribute("data-kind")).toBe("region");
    expect(host.querySelector("[data-testid='spatial-geography-child-lake-village']")).not.toBeNull();
    const preview = host.querySelector<HTMLButtonElement>("[data-testid='spatial-preview']");
    expect(preview).not.toBeNull();
    expect(preview?.disabled).toBe(false);
  });

  it("mounts a world source canvas with region children and atlas raster", () => {
    store.replace(geographyRecipeFixture("lake-kingdom", 7), { preserveEventDrafts: false });
    editorState.set({ currentMapId: store.getCurrent().startMapId });
    setDatabaseActiveTab("spatialWorlds");
    setSpatialTab("worlds");
    selectSpatialDesign(libraryWorldCardId(spatialId("lake-kingdom")));
    paint();
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
