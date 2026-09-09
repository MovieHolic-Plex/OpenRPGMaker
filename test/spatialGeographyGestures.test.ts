// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createSpatialAuthoringController } from "@/editor/spatial/actions";
import { resetMapEditHistory } from "@/editor/mapEditHistory";
import {
  bindSpatialAuthoringControllerFactory,
  visibleAuthoringProject,
} from "@/editor/panels/spatialAuthoringAccess";
import type { SpatialAuthoringSession } from "@/editor/panels/spatialAuthoringSession";
import { resetSpatialAuthoringSessions } from "@/editor/panels/spatialAuthoringSession";
import { geographyChromeState } from "@/editor/panels/spatialGeographyChromeState";
import { childOccurrenceId, libraryRegionCardId, libraryWorldCardId } from "@/editor/panels/spatialGeographyQuery";
import { GEOGRAPHY_TILE_PX } from "@/editor/panels/spatialGeographyRaster";
import {
  renderSpatialRegionsCanvas,
  resetSpatialRegionsTabChrome,
} from "@/editor/panels/spatialRegionsTab";
import {
  renderSpatialWorldsCanvas,
  renderSpatialWorldsInspector,
  resetSpatialWorldsTabChrome,
} from "@/editor/panels/spatialWorldsTab";
import { spatialId } from "@/project/spatial/domain";
import { store } from "@/project/store";
import { geographyRecipeFixture } from "./support/spatialGeographyRecipes";
import { geographyRoot } from "./support/spatialGeographyFixture";

const previous = store.getCurrent();

function regionCard() {
  return {
    id: libraryRegionCardId(spatialId("lake-country")),
    localId: "lake-country",
    name: "lake-country",
    source: "own" as const,
    kind: "regions" as const,
    usage: 0,
  };
}

function worldCard(source: "own" | "placed" = "own") {
  return {
    id: source === "placed" ? geographyRoot : libraryWorldCardId(spatialId("lake-kingdom")),
    localId: "lake-kingdom",
    name: "lake-kingdom",
    source,
    kind: "worlds" as const,
    usage: 0,
  };
}

function regionSession(): SpatialAuthoringSession {
  return {
    tab: "regions",
    mode: "design",
    source: "own",
    designId: libraryRegionCardId(spatialId("lake-country")),
    occurrenceId: null,
    camera: { x: 0, y: 0, zoom: 1 },
    breadcrumb: [],
    legacyOrigin: null,
    placeKindFilter: null,
    inspectorOpen: true,
  };
}

function worldSession(mode: SpatialAuthoringSession["mode"] = "design"): SpatialAuthoringSession {
  return {
    tab: "worlds",
    mode,
    source: "own",
    designId: libraryWorldCardId(spatialId("lake-kingdom")),
    occurrenceId: mode === "instances" ? geographyRoot : null,
    camera: { x: 0, y: 0, zoom: 1 },
    breadcrumb: [],
    legacyOrigin: null,
    placeKindFilter: null,
    inspectorOpen: true,
  };
}

function pointer(type: "pointerdown" | "pointerup", x: number, y: number): PointerEvent {
  return new PointerEvent(type, {
    bubbles: true,
    cancelable: true,
    clientX: x,
    clientY: y,
    pointerId: 1,
  });
}

function mockBoardRect(board: HTMLElement): void {
  board.getBoundingClientRect = () => ({
    x: 0,
    y: 0,
    left: 0,
    top: 0,
    right: 1024,
    bottom: 768,
    width: 1024,
    height: 768,
    toJSON() {
      return {};
    },
  });
}

function requireElement<T extends Element>(node: T | null, label: string): T {
  if (!node) throw new Error(`missing ${label}`);
  return node;
}

beforeEach(() => {
  store._setPersistenceStateForTest({ loaded: false, remotePersistenceEnabled: false, disabledReason: null });
  resetMapEditHistory();
  store.replace(geographyRecipeFixture("lake-country"));
  resetSpatialAuthoringSessions();
  resetSpatialRegionsTabChrome();
  resetSpatialWorldsTabChrome();
  bindSpatialAuthoringControllerFactory(createSpatialAuthoringController);
});

afterEach(() => {
  bindSpatialAuthoringControllerFactory(null);
  resetSpatialRegionsTabChrome();
  resetSpatialWorldsTabChrome();
  resetSpatialAuthoringSessions();
  resetMapEditHistory();
  store.replace(previous);
});

describe("spatial geography board gestures", () => {
  it("sizes the region board to the atlas raster so offscreen children have scroll extent", () => {
    const host = document.createElement("div");
    host.append(renderSpatialRegionsCanvas(regionSession(), regionCard(), () => undefined));
    const board = host.querySelector<HTMLElement>("[data-testid='spatial-geography-board']");
    expect(board?.style.width).toBe(`${128 * GEOGRAPHY_TILE_PX}px`);
    expect(board?.style.height).toBe(`${96 * GEOGRAPHY_TILE_PX}px`);
    expect(host.querySelector("[data-testid='spatial-geography-child-working-mine']")?.getAttribute("data-x")).toBe("100");
  });

  it("keeps the active board, rejects an out-of-bounds drop with clipped, and does not mutate", () => {
    const host = document.createElement("div");
    document.body.append(host);
    const paint = (): void => {
      host.replaceChildren(renderSpatialRegionsCanvas(regionSession(), regionCard(), paint));
    };
    paint();
    const board = requireElement(host.querySelector<HTMLElement>("[data-testid='spatial-geography-board']"), "board");
    const token = requireElement(
      host.querySelector<HTMLButtonElement>("[data-testid='spatial-geography-child-lake-village']"),
      "village",
    );
    mockBoardRect(board);
    token.dispatchEvent(pointer("pointerdown", 20 * GEOGRAPHY_TILE_PX + 4, 40 * GEOGRAPHY_TILE_PX + 4));
    expect(board.isConnected).toBe(true);
    expect(geographyChromeState.gesture?.childId).toBe("lake-village");
    document.dispatchEvent(pointer("pointerup", 200 * GEOGRAPHY_TILE_PX + 4, 8 * GEOGRAPHY_TILE_PX + 4));
    expect(geographyChromeState.gesture).toBeNull();
    expect(geographyChromeState.previewError).toBe("clipped");
    expect(visibleAuthoringProject().spatialAuthoring?.library.regions["lake-country"]?.places[0]).toEqual(
      expect.objectContaining({ x: 20, y: 40 }),
    );
    host.remove();
  });

  it("moves an instance child from actual occurrence coordinates, not the frozen template slot", () => {
    store.replace(geographyRecipeFixture("lake-kingdom"));
    resetSpatialWorldsTabChrome();
    bindSpatialAuthoringControllerFactory(createSpatialAuthoringController);
    const live = store.getCurrent();
    const childId = childOccurrenceId(live, geographyRoot, spatialId("lake-country"));
    const siblingId = childOccurrenceId(live, geographyRoot, spatialId("deep-forest"));
    const authoring = live.spatialAuthoring;
    const moved = childId ? authoring?.occurrences[childId] : undefined;
    const siblingOcc = siblingId ? authoring?.occurrences[siblingId] : undefined;
    if (!childId || !siblingId || !authoring || !moved || !siblingOcc) throw new Error("missing world children");
    store.replace({
      ...live,
      spatialAuthoring: {
        ...authoring,
        occurrences: {
          ...authoring.occurrences,
          [childId]: { ...moved, x: 18, y: 24 },
          [siblingId]: { ...siblingOcc, x: 53, y: 24 },
        },
      },
    });
    const host = document.createElement("div");
    document.body.append(host);
    const paint = (): void => {
      host.replaceChildren(renderSpatialWorldsCanvas(worldSession("instances"), worldCard("placed"), paint));
    };
    paint();
    const token = requireElement(
      host.querySelector<HTMLButtonElement>("[data-testid='spatial-geography-child-lake-country']"),
      "lake-country",
    );
    const sibling = requireElement(
      host.querySelector<HTMLButtonElement>("[data-testid='spatial-geography-child-deep-forest']"),
      "deep-forest",
    );
    expect(token.dataset.x).toBe("18");
    expect(sibling.dataset.x).toBe("53");
    const board = requireElement(host.querySelector<HTMLElement>("[data-testid='spatial-geography-board']"), "board");
    mockBoardRect(board);
    token.dispatchEvent(pointer("pointerdown", 18 * GEOGRAPHY_TILE_PX + 4, 24 * GEOGRAPHY_TILE_PX + 4));
    expect(board.isConnected).toBe(true);
    board.dispatchEvent(pointer("pointerup", 22 * GEOGRAPHY_TILE_PX + 4, 24 * GEOGRAPHY_TILE_PX + 4));
    const draft = visibleAuthoringProject().spatialAuthoring;
    expect(draft?.occurrences[childId]?.x).toBe(22);
    expect(draft?.occurrences[siblingId]?.x).toBe(53);
    host.remove();
  });

  it("keeps one stable drop subscription so a rerendered drag does not poison a later board", () => {
    store.replace(geographyRecipeFixture("lake-kingdom"));
    resetSpatialRegionsTabChrome();
    resetSpatialWorldsTabChrome();
    bindSpatialAuthoringControllerFactory(createSpatialAuthoringController);
    const host = document.createElement("div");
    document.body.append(host);
    const paintRegion = (): void => {
      host.replaceChildren(renderSpatialRegionsCanvas(regionSession(), regionCard(), paintRegion));
    };
    paintRegion();
    const village = requireElement(
      host.querySelector<HTMLButtonElement>("[data-testid='spatial-geography-child-lake-village']"),
      "village",
    );
    mockBoardRect(requireElement(host.querySelector<HTMLElement>("[data-testid='spatial-geography-board']"), "board"));
    // Given a region drag whose board is rerendered before the pointer is released.
    village.dispatchEvent(pointer("pointerdown", 20 * GEOGRAPHY_TILE_PX + 4, 40 * GEOGRAPHY_TILE_PX + 4));
    expect(geographyChromeState.gesture?.childId).toBe("lake-village");
    paintRegion();
    mockBoardRect(requireElement(host.querySelector<HTMLElement>("[data-testid='spatial-geography-board']"), "board"));
    document.dispatchEvent(pointer("pointerup", 24 * GEOGRAPHY_TILE_PX + 4, 40 * GEOGRAPHY_TILE_PX + 4));
    expect(geographyChromeState.gesture).toBeNull();
    // When the operator moves to the placed world board and drops a child outside the atlas.
    geographyChromeState.previewError = null;
    geographyChromeState.selectedChildId = null;
    const paintWorld = (): void => {
      host.replaceChildren(renderSpatialWorldsCanvas(worldSession("instances"), worldCard("placed"), paintWorld));
    };
    paintWorld();
    const country = requireElement(
      host.querySelector<HTMLButtonElement>("[data-testid='spatial-geography-child-lake-country']"),
      "lake-country",
    );
    const board = requireElement(host.querySelector<HTMLElement>("[data-testid='spatial-geography-board']"), "board");
    mockBoardRect(board);
    country.dispatchEvent(pointer("pointerdown", 16 * GEOGRAPHY_TILE_PX + 4, 24 * GEOGRAPHY_TILE_PX + 4));
    document.dispatchEvent(pointer("pointerup", 200 * GEOGRAPHY_TILE_PX + 4, 8 * GEOGRAPHY_TILE_PX + 4));
    // Then the live board reports the out-of-bounds destination, not a retired board's unknown child.
    expect(geographyChromeState.previewError).toBe("clipped");
    host.remove();
  });

  it("sets world entry to the named port of the clicked child instead of keeping the previous child", () => {
    store.replace(geographyRecipeFixture("lake-kingdom"));
    resetSpatialWorldsTabChrome();
    bindSpatialAuthoringControllerFactory(createSpatialAuthoringController);
    const host = document.createElement("div");
    document.body.append(host);
    const session = worldSession();
    const card = worldCard();
    const paint = (): void => {
      host.replaceChildren(
        renderSpatialWorldsCanvas(session, card, paint),
        renderSpatialWorldsInspector(session, card, paint),
      );
    };
    paint();
    host.querySelector<HTMLButtonElement>("[data-testid='spatial-geography-tool-entry']")?.click();
    expect(geographyChromeState.tool).toBe("entry");
    const board = requireElement(host.querySelector<HTMLElement>("[data-testid='spatial-geography-board']"), "board");
    const forest = requireElement(
      host.querySelector<HTMLButtonElement>("[data-testid='spatial-geography-child-deep-forest']"),
      "deep-forest",
    );
    mockBoardRect(board);
    forest.dispatchEvent(pointer("pointerdown", 46 * GEOGRAPHY_TILE_PX + 4, 24 * GEOGRAPHY_TILE_PX + 4));
    expect(geographyChromeState.gesture).toBeNull();
    expect(board.isConnected).toBe(true);
    forest.dispatchEvent(pointer("pointerup", 46 * GEOGRAPHY_TILE_PX + 4, 24 * GEOGRAPHY_TILE_PX + 4));
    const world = visibleAuthoringProject().spatialAuthoring?.library.worlds["lake-kingdom"];
    expect(world?.entryPort).toEqual({ childId: "deep-forest", portId: "entry" });
    expect(host.querySelector("[data-testid='spatial-geography-entry']")?.textContent).toContain("deep-forest");
    host.remove();
  });
});
