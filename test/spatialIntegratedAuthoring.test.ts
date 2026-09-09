// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { editorState } from "@/editor/editorState";
import { resetMapEditHistory, undoMapEdit } from "@/editor/mapEditHistory";
import {
  getDatabaseActiveTab,
  renderDatabasePanel,
  setDatabaseActiveTab,
} from "@/editor/panels/database";
import {
  bindSpatialAuthoringControllerFactory,
  visibleAuthoringProject,
} from "@/editor/panels/spatialAuthoringAccess";
import { libraryPlaceCardId } from "@/editor/panels/spatialPlaceQuery";
import { resetSpatialPlacesTabChrome } from "@/editor/panels/spatialPlaceChromeState";
import { resetSpatialSpacesTabChrome } from "@/editor/panels/spatialSpacesTab";
import { resetSpatialObjectsTabChrome } from "@/editor/panels/spatialObjectChromeState";
import {
  resetSpatialAuthoringSessions,
  selectSpatialDesign,
  setSpatialTab,
  spatialSession,
} from "@/editor/panels/spatialAuthoringSession";
import { createSpatialAuthoringController } from "@/editor/spatial/actions";
import { store } from "@/project/store";
import { librarySpaceCardId } from "@/editor/panels/spatialSpaceDraft";
import { spaceDesign } from "./support/spatialSpaceCompilerFixture";
import { placeCompilerFixture } from "./support/spatialPlaceCompilerFixture";

const previous = store.getCurrent();
const previousEditor = editorState.get();
let host: HTMLDivElement;

function paint(): void {
  renderDatabasePanel(host);
}

beforeEach(() => {
  bindSpatialAuthoringControllerFactory(createSpatialAuthoringController);
  resetSpatialAuthoringSessions();
  resetSpatialPlacesTabChrome();
  resetSpatialSpacesTabChrome();
  resetSpatialObjectsTabChrome();
  resetMapEditHistory();
  store.replace(placeCompilerFixture(7), { preserveEventDrafts: false });
  editorState.set({ currentMapId: store.getCurrent().startMapId });
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

function village() {
  const place = Object.values(store.getCurrent().spatialAuthoring?.library.places ?? {})
    .find((entry) => entry.kind === "settlement");
  if (!place) throw new Error("missing village");
  return place;
}

describe("spatial Database authoring integration", () => {
  it("binds spaces and places canvases on the real Database tabs", () => {
    setDatabaseActiveTab("spatialSpaces");
    setSpatialTab("spaces");
    selectSpatialDesign(librarySpaceCardId(spaceDesign));
    paint();
    expect(host.querySelector("[data-testid='spatial-space-board']")).not.toBeNull();
    expect(host.querySelector("[data-testid='spatial-canvas']")?.classList.contains("spatial-spaces-canvas")).toBe(true);

    setDatabaseActiveTab("spatialPlaces");
    selectSpatialDesign(libraryPlaceCardId(village().id));
    paint();
    expect(host.querySelector("[data-testid='spatial-places-board']")).not.toBeNull();
    expect(host.querySelector("[data-testid='spatial-place-floors']")).not.toBeNull();
  });

  it("changes the Database tab and canvas when drilling place into space, then restores on Back", () => {
    const selected = village();
    setDatabaseActiveTab("spatialPlaces");
    setSpatialTab("places");
    selectSpatialDesign(libraryPlaceCardId(selected.id));
    paint();
    host.querySelector<HTMLButtonElement>(`[data-testid='spatial-card-${libraryPlaceCardId(selected.id)}']`)?.click();
    const square = host.querySelector<HTMLButtonElement>("[data-testid='spatial-place-child-square']");
    expect(square, "square child").not.toBeNull();
    square?.dispatchEvent(new Event("pointerdown", { bubbles: true }));
    const board = host.querySelector<HTMLElement>("[data-testid='spatial-places-board']");
    board?.focus();
    board?.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));

    expect(getDatabaseActiveTab()).toBe("spatialSpaces");
    expect(spatialSession().tab).toBe("spaces");
    expect(spatialSession().breadcrumb).toHaveLength(1);
    expect(host.querySelector("[data-testid='spatial-space-board']")).not.toBeNull();
    expect(host.querySelector("[data-testid='spatial-places-board']")).toBeNull();
    expect(host.querySelector("[data-testid='db-tab-spatial-spaces']")?.classList.contains("active")).toBe(true);

    host.querySelector<HTMLButtonElement>("[data-testid='spatial-back']")?.click();
    expect(getDatabaseActiveTab()).toBe("spatialPlaces");
    expect(spatialSession().tab).toBe("places");
    expect(spatialSession().designId).toBe(libraryPlaceCardId(selected.id));
    expect(host.querySelector("[data-testid='spatial-places-board']")).not.toBeNull();
    expect(host.querySelector("[data-testid='spatial-space-board']")).toBeNull();
  });

  it("does not keep a created place selected after a later gallery click", () => {
    const selected = village();
    setDatabaseActiveTab("spatialPlaces");
    setSpatialTab("places");
    paint();
    const live = store.getCurrent();
    host.querySelector<HTMLButtonElement>("[data-testid='spatial-add']")?.click();
    expect(store.getCurrent()).toBe(live);
    const created = Object.values(visibleAuthoringProject().spatialAuthoring?.library.places ?? {})
      .find((place) => !Object.hasOwn(live.spatialAuthoring?.library.places ?? {}, place.id));
    expect(created).toBeDefined();
    host.querySelector<HTMLButtonElement>(`[data-testid='spatial-card-${libraryPlaceCardId(selected.id)}']`)?.click();
    expect(spatialSession().designId).toBe(libraryPlaceCardId(selected.id));
    expect(host.querySelector("[data-testid='spatial-place-name']")?.getAttribute("value")
      ?? host.querySelector<HTMLInputElement>("[data-testid='spatial-place-name']")?.value).toBe(selected.name);
  });

  it("applies a space size edit through the real controller and one undo", () => {
    setDatabaseActiveTab("spatialSpaces");
    setSpatialTab("spaces");
    selectSpatialDesign(librarySpaceCardId(spaceDesign));
    paint();
    host.querySelector<HTMLButtonElement>("[data-testid='spatial-inspector-toggle']")?.click();
    const width = host.querySelector<HTMLInputElement>("[data-testid='spatial-space-width']");
    expect(width).not.toBeNull();
    const before = store.getCurrent().spatialAuthoring?.library.spaces[spaceDesign]?.width;
    if (!width) throw new Error("missing space width control");
    // When: editing a source leaves Apply unavailable until a preview is issued.
    width.value = "14";
    width.dispatchEvent(new Event("change"));
    expect(store.getCurrent().spatialAuthoring?.library.spaces[spaceDesign]?.width).toBe(before);
    expect(visibleAuthoringProject().spatialAuthoring?.library.spaces[spaceDesign]?.width).toBe(14);
    // Then: readiness is reflected by the rendered control, not only its handler.
    expect(host.querySelector<HTMLButtonElement>("[data-testid='spatial-apply']")?.disabled).toBe(true);
    host.querySelector<HTMLButtonElement>("[data-testid='spatial-apply']")?.click();
    expect(store.getCurrent().spatialAuthoring?.library.spaces[spaceDesign]?.width).toBe(before);
    host.querySelector<HTMLButtonElement>("[data-testid='spatial-preview']")?.click();
    expect(host.querySelector<HTMLButtonElement>("[data-testid='spatial-apply']")?.disabled).toBe(false);
    host.querySelector<HTMLButtonElement>("[data-testid='spatial-apply']")?.click();
    expect(host.querySelector<HTMLButtonElement>("[data-testid='spatial-apply']")?.disabled).toBe(true);
    expect(store.getCurrent().spatialAuthoring?.library.spaces[spaceDesign]?.width).toBe(14);
    expect(undoMapEdit()).toBe(true);
    expect(store.getCurrent().spatialAuthoring?.library.spaces[spaceDesign]?.width).toBe(before);
  });
});
