// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { SpatialAuthoringDraft } from "@/editor/spatial/authoringTypes";
import { createSpatialAuthoringController } from "@/editor/spatial/actions";
import { getMapEditHistoryEntries, resetMapEditHistory } from "@/editor/mapEditHistory";
import { serialize } from "@/project/io";
import type { SpatialAuthoringSession } from "@/editor/panels/spatialAuthoringSession";
import { getDatabaseActiveTab, setDatabaseActiveTab } from "@/editor/panels/database";
import {
  patchSpatialSession,
  resetSpatialAuthoringSessions,
  spatialSession,
} from "@/editor/panels/spatialAuthoringSession";
import {
  bindSpatialAuthoringControllerFactory,
  renderSpatialRegionsCanvas,
  renderSpatialRegionsInspector,
  resetSpatialRegionsTabChrome,
  spatialRegionsChrome,
} from "@/editor/panels/spatialRegionsTab";
import {
  renderSpatialWorldsCanvas,
  resetSpatialWorldsTabChrome,
} from "@/editor/panels/spatialWorldsTab";
import {
  hasAuthoringPreview,
  spatialAuthoringController,
  visibleAuthoringProject,
} from "@/editor/panels/spatialAuthoringAccess";
import { geographyChromeState } from "@/editor/panels/spatialGeographyChromeState";
import { restoreGeographyParent } from "@/editor/panels/spatialGeographyNavigate";
import { commitWorkingGeography } from "@/editor/panels/spatialGeographyCommands";
import { commitGeographyEdit, geographyDraftTarget, geographyFromProject } from "@/editor/panels/spatialGeographyDraft";
import {
  moveGeographyChild,
  setRegionRoute,
  setTerrainFloor,
  worldCrossingPoints,
} from "@/editor/panels/spatialGeographyGeometry";
import { childOccurrenceId, libraryPlaceCardId, libraryRegionCardId, libraryWorldCardId } from "@/editor/panels/spatialGeographyQuery";
import { GEOGRAPHY_TILE_PX, geographyPreviewMap, geographyRasterTile } from "@/editor/panels/spatialGeographyRaster";
import { spatialId } from "@/project/spatial/domain";
import { createBlankProject } from "@/project/defaults/defaultProject";
import { store } from "@/project/store";
import type { RegionDesign } from "@/project/spatial/types";
import { authoringValue } from "./support/spatialAuthoringFixture";
import { geographyRecipeFixture, regionRecipes } from "./support/spatialGeographyRecipes";
import { geographyFixture, geographyRegion, geographyRoot } from "./support/spatialGeographyFixture";

const previous = store.getCurrent();

function regionCard(id: string, source: "own" | "placed" = "own") {
  return {
    id: source === "placed" ? geographyRoot : libraryRegionCardId(spatialId(id)),
    localId: id,
    name: id,
    source,
    kind: "regions" as const,
    usage: 0,
  };
}

function worldCard(id: string) {
  return {
    id: libraryWorldCardId(spatialId(id)),
    localId: id,
    name: id,
    source: "own" as const,
    kind: "worlds" as const,
    usage: 0,
  };
}

function regionSession(id: string, mode: SpatialAuthoringSession["mode"] = "design"): SpatialAuthoringSession {
  return {
    tab: "regions",
    mode,
    source: "own",
    designId: libraryRegionCardId(spatialId(id)),
    occurrenceId: mode === "instances" ? geographyRoot : null,
    camera: { x: 0, y: 0, zoom: 1 },
    breadcrumb: [],
    legacyOrigin: null,
    placeKindFilter: null,
    regionKindFilter: null,
    inspectorOpen: true,
  };
}

function worldSession(id: string): SpatialAuthoringSession {
  return {
    tab: "worlds",
    mode: "design",
    source: "own",
    designId: libraryWorldCardId(spatialId(id)),
    occurrenceId: null,
    camera: { x: 0, y: 0, zoom: 1 },
    breadcrumb: [],
    legacyOrigin: null,
    placeKindFilter: null,
    regionKindFilter: null,
    inspectorOpen: true,
  };
}

function regionOf(id: string): RegionDesign {
  const region = visibleAuthoringProject().spatialAuthoring?.library.regions[id];
  if (!region) throw new Error(`missing region ${id}`);
  return region;
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

describe("spatial geography actions", () => {
  it.each(regionRecipes)("renders $id terrain, overview children and authored polyline", (recipe) => {
    store.replace(geographyRecipeFixture(recipe.id));
    const host = document.createElement("div");
    host.append(renderSpatialRegionsCanvas(regionSession(recipe.id), regionCard(recipe.id), () => undefined));
    const raster = host.querySelector<HTMLCanvasElement>("[data-testid='spatial-geography-raster']");
    expect(raster?.dataset.width).toBe("128");
    expect(raster?.dataset.height).toBe("96");
    expect(raster?.dataset.tileset === "easyrpg_chipset_world" || raster?.dataset.tileset?.startsWith("world_structures_")).toBe(true);
    const liveMaps = Object.keys(store.getCurrent().maps);
    const preview = geographyPreviewMap(store.getCurrent(), regionOf(recipe.id));
    expect(preview.error).toBeUndefined();
    if (!preview.map) throw new TypeError("expected terrain");
    expect(Object.keys(store.getCurrent().maps)).toEqual(liveMaps);
    expect(geographyRasterTile(preview.map, 0, 0)).toBeGreaterThanOrEqual(0);
    if (recipe.id === "lake-country") {
      expect(geographyRasterTile(preview.map, 55, 0)).not.toBe(geographyRasterTile(preview.map, 0, 0));
      expect(geographyRasterTile(preview.map, 50, 40)).not.toBe(geographyRasterTile(preview.map, 55, 0));
    }
    for (const [index, place] of recipe.places.entries()) {
      const token = host.querySelector<HTMLElement>(`[data-testid='spatial-geography-child-${place}']`);
      const marker = recipe.markers[index];
      expect(token).not.toBeNull();
      expect(token?.dataset.frame).toBe("overview");
      expect(token?.style.left).toBe(`${(marker?.x ?? 0) * GEOGRAPHY_TILE_PX}px`);
      expect(token?.style.top).toBe(`${(marker?.y ?? 0) * GEOGRAPHY_TILE_PX}px`);
    }
    const route = host.querySelector<HTMLElement>("[data-testid='spatial-geography-route-authored-road']");
    expect(route?.dataset.points).toBe(recipe.points.map((point) => `${point.x},${point.y}`).join(" "));
    expect(host.querySelector("[data-testid='spatial-geography-rotate']")).toBeNull();
  });

  it("keeps overview child coordinates distinct from child-local ports", () => {
    const region = regionOf("lake-country");
    const village = region.places[0];
    const place = store.getCurrent().spatialAuthoring?.library.places[village?.source.id ?? ""];
    expect(village).toEqual(expect.objectContaining({ x: 20, y: 40 }));
    expect(place?.ports.some((port) => port.x === 20 && port.y === 40)).toBe(false);
  });

  it("rejects a diagonal or endpoint-mismatched route without rewriting points", () => {
    const region = regionOf("lake-country");
    const before = region.routes[0]?.points;
    expect(setRegionRoute(region, spatialId("authored-road"), [{ x: 20, y: 40 }, { x: 80, y: 50 }])).toEqual({
      kind: "rejected",
      code: "diagonal",
      design: region,
    });
    expect(setRegionRoute(region, spatialId("authored-road"), [{ x: 0, y: 40 }, { x: 100, y: 40 }])).toEqual({
      kind: "rejected",
      code: "endpoint",
      design: region,
    });
    expect(region.routes[0]?.points).toEqual(before);
  });

  it("rejects an out-of-bounds child move before apply", () => {
    const region = regionOf("lake-country");
    const live = store.getCurrent();
    const host = document.createElement("div");
    const paint = (): void => {
      host.replaceChildren(renderSpatialRegionsInspector(regionSession("lake-country"), regionCard("lake-country"), paint));
    };
    paint();
    const result = moveGeographyChild(region, spatialId("lake-village"), 200, 8);
    expect(result.kind).toBe("rejected");
    expect(result).toMatchObject({ code: "clipped" });
    spatialRegionsChrome(regionCard("lake-country"), () => undefined);
    expect(store.getCurrent()).toBe(live);
    expect(regionOf("lake-country").places[0]).toEqual(expect.objectContaining({ x: 20, y: 40 }));
  });

  it("keeps source edits off the live store until apply", () => {
    const live = store.getCurrent();
    const host = document.createElement("div");
    const paint = (): void => {
      host.replaceChildren(renderSpatialRegionsInspector(regionSession("lake-country"), regionCard("lake-country"), paint));
    };
    paint();
    const name = host.querySelector<HTMLInputElement>("[data-testid='spatial-name']");
    expect(name).not.toBeNull();
    name!.value = "호수 지방";
    name!.dispatchEvent(new Event("change"));
    expect(store.getCurrent()).toBe(live);
    expect(visibleAuthoringProject().spatialAuthoring?.library.regions["lake-country"]?.name).toBe("호수 지방");
    spatialRegionsChrome(regionCard("lake-country"), () => undefined).preview?.();
    spatialRegionsChrome(regionCard("lake-country"), () => undefined).apply?.();
    expect(store.getCurrent().spatialAuthoring?.library.regions["lake-country"]?.name).toBe("호수 지방");
  });

  it("does not rewrite a placed snapshot when the live source changes", () => {
    const target = geographyDraftTarget(regionCard("lake-country"), "region");
    const source = geographyFromProject(store.getCurrent(), target);
    expect(source?.name).toBe("lake-country");
    const placed = geographyFromProject(store.getCurrent(), geographyDraftTarget(regionCard("lake-country", "placed"), "region"));
    expect(placed?.name).toBe("lake-country");
    const host = document.createElement("div");
    const paint = (): void => {
      host.replaceChildren(renderSpatialRegionsInspector(regionSession("lake-country"), regionCard("lake-country"), paint));
    };
    paint();
    const name = host.querySelector<HTMLInputElement>("[data-testid='spatial-name']");
    name!.value = "edited-source";
    name!.dispatchEvent(new Event("change"));
    const draft = visibleAuthoringProject();
    expect(draft.spatialAuthoring?.library.regions["lake-country"]?.name).toBe("edited-source");
    const snapshot = draft.spatialAuthoring?.occurrences[geographyRoot];
    expect(snapshot?.kind === "region" ? snapshot.snapshot.library.regions[snapshot.source.id]?.name : undefined).toBe("lake-country");
  });

  it("draws world crossings as horizontal-then-vertical without invented path fields", () => {
    store.replace(geographyRecipeFixture("lake-kingdom"));
    const world = visibleAuthoringProject().spatialAuthoring?.library.worlds["lake-kingdom"];
    if (!world) throw new Error("missing world");
    const firstLink = world.connections[0];
    if (!firstLink) throw new Error("missing crossing");
    expect("points" in firstLink).toBe(false);
    expect(worldCrossingPoints({ x: 16, y: 24 }, { x: 46, y: 40 })).toEqual([
      { x: 16, y: 24 },
      { x: 46, y: 24 },
      { x: 46, y: 40 },
    ]);
    const host = document.createElement("div");
    host.append(renderSpatialWorldsCanvas(worldSession("lake-kingdom"), worldCard("lake-kingdom"), () => undefined));
    const crossing = host.querySelector<HTMLElement>("[data-testid='spatial-geography-crossing-crossing:0']");
    const from = world.regions[0];
    const to = world.regions[1];
    if (!from || !to) throw new Error("missing world children");
    expect(crossing?.dataset.points).toBe(worldCrossingPoints(from, to).map((point) => `${point.x},${point.y}`).join(" "));
    expect(host.querySelector("[data-testid='spatial-geography-tool-route']")).toBeNull();
    expect(host.querySelector("[data-testid='spatial-geography-tool-entry']")).not.toBeNull();
  });

  it("rejects a reconstructed draft handle on preview", () => {
    const controller = spatialAuthoringController();
    const created = controller?.createDraft();
    expect(created?.kind).toBe("ok");
    const foreign: SpatialAuthoringDraft = { project: structuredClone(store.getCurrent()) };
    const result = controller?.preview(foreign, { operation: { kind: "edit" } });
    expect(result?.kind).toBe("error");
    if (result?.kind === "error") expect(result.error.code).toBe("foreign-draft");
  });

  it("records gesture child identity and cancels on Escape", () => {
    const host = document.createElement("div");
    document.body.append(host);
    const paint = (): void => {
      host.replaceChildren(renderSpatialRegionsCanvas(regionSession("lake-country"), regionCard("lake-country"), paint));
    };
    paint();
    const token = host.querySelector<HTMLButtonElement>("[data-testid='spatial-geography-child-lake-village']");
    token?.dispatchEvent(new Event("pointerdown", { bubbles: true }));
    expect(geographyChromeState.gesture?.childId).toBe("lake-village");
    const board = host.querySelector<HTMLElement>("[data-testid='spatial-geography-board']");
    board?.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    expect(geographyChromeState.gesture).toBeNull();
    host.remove();
  });

  it("opens a child from overview selection and restores tab, domain and canvas on back", () => {
    setDatabaseActiveTab("spatialRegions");
    patchSpatialSession({ tab: "regions", mode: "design", designId: libraryRegionCardId(spatialId("lake-country")) });
    const host = document.createElement("div");
    document.body.append(host);
    const paint = (): void => {
      const session = spatialSession();
      if (session.tab === "regions") {
        host.replaceChildren(renderSpatialRegionsCanvas({
          ...regionSession("lake-country"),
          ...session,
        }, regionCard("lake-country"), paint));
        return;
      }
      host.replaceChildren();
    };
    paint();
    expect(host.querySelector("[data-testid='spatial-geography-board']")?.getAttribute("data-kind")).toBe("region");
    const token = host.querySelector<HTMLButtonElement>("[data-testid='spatial-geography-child-lake-village']");
    token?.dispatchEvent(new Event("pointerdown", { bubbles: true }));
    const board = host.querySelector<HTMLElement>("[data-testid='spatial-geography-board']");
    board?.focus();
    board?.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    expect(getDatabaseActiveTab()).toBe("spatialPlaces");
    expect(spatialSession().tab).toBe("places");
    expect(spatialSession().designId).toBe(libraryPlaceCardId(spatialId("contract-place:lake-village")));
    expect(host.querySelector("[data-testid='spatial-geography-board']")).toBeNull();
    expect(host.querySelector("[data-testid='spatial-places-canvas']")).toBeNull();
    restoreGeographyParent(paint);
    expect(getDatabaseActiveTab()).toBe("spatialRegions");
    expect(spatialSession().tab).toBe("regions");
    expect(spatialSession().designId).toBe(libraryRegionCardId(spatialId("lake-country")));
    expect(host.querySelector("[data-testid='spatial-geography-board']")?.getAttribute("data-kind")).toBe("region");
    host.remove();
  });

  it("opens a world child onto the region canvas and restores the world on back", () => {
    store.replace(geographyRecipeFixture("lake-kingdom"));
    setDatabaseActiveTab("spatialWorlds");
    patchSpatialSession({ tab: "worlds", mode: "design", designId: libraryWorldCardId(spatialId("lake-kingdom")) });
    const host = document.createElement("div");
    document.body.append(host);
    const paint = (): void => {
      const session = spatialSession();
      if (session.tab === "worlds") {
        host.replaceChildren(renderSpatialWorldsCanvas({
          ...worldSession("lake-kingdom"),
          ...session,
        }, worldCard("lake-kingdom"), paint));
        return;
      }
      if (session.tab === "regions") {
        host.replaceChildren(renderSpatialRegionsCanvas({
          ...regionSession("lake-country"),
          ...session,
        }, regionCard("lake-country"), paint));
        return;
      }
      host.replaceChildren();
    };
    paint();
    expect(host.querySelector("[data-testid='spatial-geography-board']")?.getAttribute("data-kind")).toBe("world");
    const token = host.querySelector<HTMLButtonElement>("[data-testid='spatial-geography-child-lake-country']");
    token?.dispatchEvent(new Event("pointerdown", { bubbles: true }));
    const board = host.querySelector<HTMLElement>("[data-testid='spatial-geography-board']");
    board?.focus();
    board?.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    expect(getDatabaseActiveTab()).toBe("spatialRegions");
    expect(spatialSession().tab).toBe("regions");
    expect(spatialSession().designId).toBe(libraryRegionCardId(spatialId("lake-country")));
    expect(host.querySelector("[data-testid='spatial-geography-board']")?.getAttribute("data-kind")).toBe("region");
    restoreGeographyParent(paint);
    expect(getDatabaseActiveTab()).toBe("spatialWorlds");
    expect(spatialSession().tab).toBe("worlds");
    expect(spatialSession().designId).toBe(libraryWorldCardId(spatialId("lake-kingdom")));
    expect(host.querySelector("[data-testid='spatial-geography-board']")?.getAttribute("data-kind")).toBe("world");
    host.remove();
  });

  it("compiles a blocked forest shortcut as a visible rejection without applying", () => {
    store.replace(geographyRecipeFixture("deep-forest"));
    resetSpatialRegionsTabChrome();
    bindSpatialAuthoringControllerFactory(createSpatialAuthoringController);
    const region = regionOf("deep-forest");
    const straight = setRegionRoute(region, spatialId("authored-road"), [{ x: 20, y: 40 }, { x: 100, y: 40 }]);
    expect(straight.kind).toBe("ok");
    const live = store.getCurrent();
    if (straight.kind !== "ok") throw new Error("expected route");
    const accepted = commitWorkingGeography(geographyDraftTarget(regionCard("deep-forest", "placed"), "region"), straight);
    expect(accepted).toBe(true);
    // 미리보기는 초안이 있을 때만 열린다 — 실제 UI 도 편집 후 다시 렌더해 새 chrome 을 만든다.
    const chrome = spatialRegionsChrome(regionCard("deep-forest", "placed"), () => undefined);
    chrome.preview?.();
    expect(store.getCurrent()).toBe(live);
    expect(hasAuthoringPreview()).toBe(false);
    expect(geographyChromeState.previewError).toMatch(/blocked|connection|clipped/);
    expect(live.spatialAuthoring?.library.regions["deep-forest"]?.routes[0]?.points).toEqual(region.routes[0]?.points);
  });

  it("moves a placed lake-village marker, compiles matching route cells, and undoes", () => {
    const live = store.getCurrent();
    const villageId = childOccurrenceId(live, geographyRoot, spatialId("lake-village"));
    const mineId = childOccurrenceId(live, geographyRoot, spatialId("working-mine"));
    if (!villageId || !mineId) throw new Error("missing child occurrences");
    const villageSource = live.spatialAuthoring?.occurrences[villageId]?.source;
    const siblingIds = Object.keys(live.spatialAuthoring?.occurrences ?? {}).sort();
    const target = geographyDraftTarget(regionCard("lake-country", "placed"), "region");
    const controller = createSpatialAuthoringController();
    const draft = authoringValue(controller.createDraft());
    const region = geographyFromProject(draft.project, target);
    if (!region || !("places" in region)) throw new Error("missing placed region");
    const moved = moveGeographyChild(region, spatialId("lake-village"), 21, 40);
    expect(moved.kind).toBe("ok");
    if (moved.kind !== "ok") throw new Error("expected move");
    Object.assign(draft.project, commitGeographyEdit(draft.project, target, moved));
    expect(draft.project.spatialAuthoring?.occurrences[villageId]?.x).toBe(21);
    const preview = authoringValue(controller.preview(draft, {
      operation: { kind: "edit" },
      compile: { occurrenceId: geographyRoot },
    }));
    expect(serialize(store.getCurrent())).toBe(serialize(live));
    expect(preview.project.spatialAuthoring?.occurrences[villageId]?.x).toBe(21);
    expect(preview.project.spatialAuthoring?.occurrences[villageId]?.y).toBe(40);
    expect(preview.project.spatialAuthoring?.occurrences[villageId]?.source).toEqual(villageSource);
    expect(Object.keys(preview.project.spatialAuthoring?.occurrences ?? {}).sort()).toEqual(siblingIds);
    expect(preview.project.spatialAuthoring?.occurrences[mineId]?.x).toBe(100);
    const overview = preview.project.maps[`spatial-geography:${geographyRoot.length}:${geographyRoot}`];
    if (!overview) throw new Error("missing compiled overview");
    const start = overview.lowerTiles[40 * overview.width + 21] ?? -1;
    const mid = overview.lowerTiles[40 * overview.width + 50] ?? -1;
    const water = overview.lowerTiles[55] ?? -1;
    expect(start).toBeGreaterThanOrEqual(0);
    expect(start).toBe(mid);
    expect(start).not.toBe(water);
    const applied = authoringValue(controller.apply(preview));
    expect(applied.changed).toBe(true);
    expect(getMapEditHistoryEntries()).toHaveLength(1);
    expect(store.getCurrent().spatialAuthoring?.occurrences[villageId]?.x).toBe(21);
    expect(controller.undo()).toBe(true);
    expect(store.getCurrent().spatialAuthoring?.occurrences[villageId]?.x).toBe(20);
    expect(store.getCurrent().spatialAuthoring?.occurrences[villageId]?.y).toBe(40);
    expect(controller.redo()).toBe(true);
    expect(store.getCurrent().spatialAuthoring?.occurrences[villageId]?.x).toBe(21);
  });

  it("moves only the associated sibling when two slots share one source", () => {
    store.replace(geographyFixture("region"));
    resetSpatialRegionsTabChrome();
    bindSpatialAuthoringControllerFactory(createSpatialAuthoringController);
    const westId = childOccurrenceId(store.getCurrent(), geographyRoot, spatialId("west"));
    const eastId = childOccurrenceId(store.getCurrent(), geographyRoot, spatialId("east"));
    if (!westId || !eastId) throw new Error("missing shared-source children");
    expect(westId).not.toBe(eastId);
    const westSource = store.getCurrent().spatialAuthoring?.occurrences[westId]?.source;
    const eastSource = store.getCurrent().spatialAuthoring?.occurrences[eastId]?.source;
    expect(westSource).toEqual(eastSource);
    const placed = {
      id: geographyRoot,
      localId: geographyRegion,
      name: "Contract region",
      source: "placed" as const,
      kind: "regions" as const,
      usage: 0,
    };
    const region = geographyFromProject(store.getCurrent(), geographyDraftTarget(placed, "region"));
    if (!region || !("places" in region)) throw new Error("missing placed region");
    const moved = moveGeographyChild(region, spatialId("east"), 26, 8);
    expect(moved.kind).toBe("ok");
    if (moved.kind !== "ok") throw new Error("expected move");
    expect(commitWorkingGeography(geographyDraftTarget(placed, "region"), moved)).toBe(true);
    const draft = visibleAuthoringProject().spatialAuthoring;
    expect(draft?.occurrences[eastId]?.x).toBe(26);
    expect(draft?.occurrences[eastId]?.y).toBe(8);
    expect(draft?.occurrences[westId]?.x).toBe(5);
    expect(draft?.occurrences[westId]?.y).toBe(8);
  });

  it("rejects unsupported terrain instead of substituting a tile", () => {
    const region = regionOf("lake-country");
    expect(setTerrainFloor(region, "lava")).toEqual({ kind: "rejected", code: "material", design: region });
    expect(region.terrain.floor).toBe("ground");
  });

  it("leaves clone and refresh on a proposal until apply", () => {
    const live = store.getCurrent();
    spatialRegionsChrome(regionCard("lake-country"), () => undefined).duplicate?.();
    expect(store.getCurrent()).toBe(live);
    expect(hasAuthoringPreview()).toBe(true);
    expect(getMapEditHistoryEntries()).toEqual([]);
    resetSpatialRegionsTabChrome();
    bindSpatialAuthoringControllerFactory(createSpatialAuthoringController);
    spatialRegionsChrome(regionCard("lake-country", "placed"), () => undefined).refresh?.();
    expect(store.getCurrent()).toBe(live);
    expect(getMapEditHistoryEntries()).toEqual([]);
  });

  it("arms a remove-external retry when delete is blocked by incoming links", () => {
    // Given — a region child inside a compiled world is crossed by world connections.
    store.replace(geographyRecipeFixture("lake-kingdom"));
    const document = store.getCurrent().spatialAuthoring;
    if (!document) throw new TypeError("Missing spatial document");
    const child = Object.values(document.occurrences).find(entry => entry.kind === "region" && entry.parentId !== null);
    if (!child) throw new TypeError("Missing nested region");
    const card = { id: child.id, localId: child.source.id, name: "child", source: "placed" as const, kind: "regions" as const, usage: 0 };
    // When — delete → confirm: reject policy fails on the crossing link.
    spatialRegionsChrome(card, () => undefined).delete?.();
    expect(geographyChromeState.deleteOpen).toBe(true);
    spatialRegionsChrome(card, () => undefined).onDeleteConfirm?.();
    // Then — the failure is armed, not dead-ended.
    expect(geographyChromeState.previewError).toContain("외부 연결");
    expect(geographyChromeState.pendingExternal).not.toBeNull();
    // When — 「확인」 again retries once with externalConnections: "remove".
    spatialRegionsChrome(card, () => undefined).onDeleteConfirm?.();
    // Then
    expect(geographyChromeState.pendingExternal).toBeNull();
    expect(hasAuthoringPreview()).toBe(true);
    expect(visibleAuthoringProject().spatialAuthoring?.occurrences[child.id]).toBeUndefined();
  });

  it("exposes the activation action only while the canonical document is missing", async () => {
    // Canonical fixture: activation is already done, no surface.
    expect(spatialRegionsChrome(regionCard("lake-country"), () => undefined).activate).toBeUndefined();
    // Legacy project: the stage toolbar must surface the single activation path.
    store.replace(createBlankProject());
    const chrome = spatialRegionsChrome(regionCard("lake-country"), () => undefined);
    expect(chrome.activate).toBeDefined();
    chrome.activate?.();
    expect(geographyChromeState.activating).toBe(true);
    // Without remote persistence the store rejects; the error stays visible, not silent.
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(geographyChromeState.activating).toBe(false);
    expect(geographyChromeState.previewError).toContain("공간 설계 활성화 실패");
  });
});
