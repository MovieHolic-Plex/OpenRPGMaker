import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  databaseTabGroupLabel, getDatabaseActiveTab, renderDatabasePanel,
  resolveCanonicalDatabaseTab, setDatabaseActiveTab, switchDatabaseActiveTab, TAB_GROUPS, type DatabaseTab,
} from "@/editor/panels/database";
import { INTERIOR_ROOM_TILESET_ID } from "@/editor/interiorRoomPipeline";
import { getTilesetMetadataEditMode, setTilesetMetadataEditMode } from "@/editor/panels/tilesetMetadataEditor";
import { getUnlabeledOnlyFilter } from "@/editor/panels/tilesetChipsetPreview";
import { resetScratchConceptTabSession } from "@/editor/panels/scratchConceptTab";
import { getSelectedTilesetId, setSelectedTileset } from "@/editor/panels/tilesetSettingsPanel";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import { FakeElement, installFakeDom } from "./fakeDom";

let restoreDom: (() => void) | undefined;
let previousWindow: typeof globalThis.window;
beforeEach(() => {
  restoreDom = installFakeDom();
  previousWindow = globalThis.window;
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: { location: { search: "" }, localStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {} } },
  });
  store.replace(createBlankProject());
  resetScratchConceptTabSession();
  setSelectedTileset(INTERIOR_ROOM_TILESET_ID);
  setTilesetMetadataEditMode("passage", () => {});
  setDatabaseActiveTab("scratchConcepts");
});
afterEach(() => {
  restoreDom?.();
  Object.defineProperty(globalThis, "window", { configurable: true, value: previousWindow });
});
function renderHost(): FakeElement {
  const host = document.createElement("div") as unknown as FakeElement;
  host.className = "database-modal-body";
  document.body.append(host as unknown as Node);
  renderDatabasePanel(host as unknown as HTMLElement);
  return host;
}
function pick(host: FakeElement, id: string): FakeElement {
  const node = host.querySelector(`[data-testid='${id}']`);
  if (!node) throw new Error(`Missing ${id}`);
  return node;
}
function jump(host: FakeElement, tab: DatabaseTab): void {
  switchDatabaseActiveTab(tab, host as unknown as HTMLElement);
}
function search(host: FakeElement, query: string): void {
  const input = pick(host, "db-tab-search");
  input.value = query;
  input.dispatchEvent(new Event("input"));
}

// Original database tab registry, not the icon registry (which also includes
// the record-only battleAnimations key that was never a navigation destination).
const LEGACY_DESTINATIONS: readonly DatabaseTab[] = [
  "overview", "elements", "terrain", "battleScreen", "battleCommands", "actors",
  "promotionTree", "skillTrees", "classes", "skills", "items", "crops", "characters",
  "lifeCrafting", "dailyWeather", "farmAnimals", "farmSpatial", "lifeCollections",
  "equipment", "enemies", "monsterSpecies", "troops", "factions", "states", "animations",
  "tilesets", "tilesetAutotile", "tilesetUnlabeled", "worldCanon", "worldCodex", "worldGen",
  "structureKits", "tilesetSpaces", "scratchConcepts", "villages", "commonEvents",
  "system", "terms", "switches", "variables",
];

describe("concept-first Map navigation", () => {
  it("mounts six Map primary entries and moves common events to System, without a folder", () => {
    const host = renderHost();
    expect(TAB_GROUPS.find((group) => group.slug === "world")?.tabs).toEqual([
      "spatialTiles", "spatialObjects", "spatialSpaces", "spatialPlaces", "spatialRegions", "spatialWorlds",
    ]);
    expect(TAB_GROUPS.find((group) => group.slug === "system")?.tabs).toContain("commonEvents");
    expect(databaseTabGroupLabel("commonEvents")).toBe(databaseTabGroupLabel("system"));
    expect(host.querySelector("[data-testid='db-tileset-folder']")).toBeNull();
    expect(host.querySelector("[data-folder-child]")).toBeNull();
    const rail = host.querySelector(".db-tabs")!;
    for (const id of ["world-gen", "tileset-autotile", "tileset-unlabeled", "structure-kits", "tileset-spaces", "villages", "terrain"]) {
      expect(rail.querySelector(`[data-testid='db-tab-${id}']`)).toBeNull();
    }
  });

  it.each([
    ["structureKits", "spatialObjects", "db-tab-spatial-objects", "spatial-gallery"],
    ["tilesetSpaces", "spatialSpaces", "db-tab-spatial-spaces", "spatial-gallery"],
    ["villages", "spatialPlaces", "db-tab-spatial-places", "spatial-gallery"],
    ["worldGen", "spatialRegions", "db-tab-spatial-regions", "spatial-gallery"],
    ["scratchConcepts", "spatialPlaces", "db-tab-spatial-places", "spatial-gallery"],
    ["tilesets", "spatialTiles", "db-tab-spatial-tiles", "spatial-gallery"],
  ] as const)("redirects legacy %s onto replacement %s", (legacy, canonical, rail, surface) => {
    const host = renderHost();
    jump(host, legacy);
    expect(getDatabaseActiveTab()).toBe(canonical);
    expect(pick(host, surface)).toBeTruthy();
    expect(pick(host, rail).classList.contains("active")).toBe(true);
    expect(databaseTabGroupLabel(legacy)).toBe(databaseTabGroupLabel("spatialPlaces"));
    expect(getSelectedTilesetId()).toBe(INTERIOR_ROOM_TILESET_ID);
  });

  it("opens terrain as a tiles facet and returns to the tiles destination", () => {
    const host = renderHost();
    jump(host, "spatialTiles");
    pick(host, "db-context-terrain").click();
    expect(getDatabaseActiveTab()).toBe("terrain");
    expect(pick(host, "db-terrain-inspector")).toBeTruthy();
    expect(pick(host, "db-tab-spatial-tiles").classList.contains("active")).toBe(true);
    pick(host, "db-context-back").click();
    expect(getDatabaseActiveTab()).toBe("spatialTiles");
    expect(getSelectedTilesetId()).toBe(INTERIOR_ROOM_TILESET_ID);
  });

  it("keeps a place card selected across a sibling tab visit", () => {
    const host = renderHost();
    const card = host.querySelector("[data-testid='spatial-card-inn']");
    expect(card).not.toBeNull();
    card!.click();
    expect(pick(host, "spatial-card-inn").classList.contains("is-selected")).toBe(true);
    jump(host, "spatialObjects");
    expect(getDatabaseActiveTab()).toBe("spatialObjects");
    jump(host, "spatialPlaces");
    expect(pick(host, "spatial-card-inn").classList.contains("is-selected")).toBe(true);
    expect(host.querySelector("[data-testid='structure-kit-new']")).toBeNull();
  });

  it.each(LEGACY_DESTINATIONS)("keeps legacy destination %s searchable and programmatically routable", (tab) => {
    const host = renderHost();
    search(host, tab);
    const requested = tab === "equipment" ? "items" : tab;
    const destination = resolveCanonicalDatabaseTab(requested);
    const matches = host.querySelectorAll(".db-tab").filter((node) => !node.hidden && (node.dataset.tab === requested || node.dataset.tab === destination));
    expect(matches.length).toBe(1);
    expect(matches[0]!.dataset.tab).toBe(destination);
    matches[0]!.click();
    expect(getDatabaseActiveTab()).toBe(destination);
    jump(host, tab);
    expect(getDatabaseActiveTab()).toBe(destination);
    if (tab === "equipment") expect(host.querySelector("[data-testid='db-tab-equipment']")).toBeNull();
    search(host, "");
    expect(host.querySelector("[data-search-secondary]")).toBeNull();
  });

  it("shows one visible destination for legacy alias queries", () => {
    const host = renderHost();
    search(host, "villages");
    const villageTabs = host.querySelectorAll(".db-tab").filter((node) => !node.hidden);
    expect(villageTabs.map((node) => node.dataset.tab)).toEqual(["spatialPlaces"]);
    search(host, "tilesets");
    const tilesetTabs = host.querySelectorAll(".db-tab").filter((node) => !node.hidden);
    expect(tilesetTabs.map((node) => node.dataset.tab)).toEqual(["spatialTiles"]);
    expect(tilesetTabs.some((node) => node.dataset.tab === "spatialSpaces")).toBe(false);
  });

  it.each([
    ["ani", "animations", "db-tab-animations"],
    ["act", "actors", "db-tab-actors"],
  ] as const)("exposes the existing %s route for English prefix %s", (query, tab, testid) => {
    const host = renderHost();
    search(host, query);
    const matches = host.querySelectorAll(".db-tab").filter((node) => !node.hidden);
    expect(host.querySelector("[data-testid='db-tab-search-empty']")).toBeNull();
    expect(matches.map((node) => node.dataset.tab)).toEqual([tab]);
    pick(host, testid).click();
    expect(getDatabaseActiveTab()).toBe(tab);
  });

  it("finds retired Korean names and clears the empty-search notice", () => {
    const host = renderHost();
    search(host, "구조물");
    pick(host, "db-tab-spatial-objects").click();
    expect(getDatabaseActiveTab()).toBe("spatialObjects");
    search(host, "no-such-destination");
    expect(pick(host, "db-tab-search-empty")).toBeTruthy();
    search(host, "");
    expect(host.querySelector("[data-testid='db-tab-search-empty']")).toBeNull();
  });

  it("honors legacy modes and never restores stale tileset DOM on return", () => {
    const host = renderHost();
    jump(host, "tilesetAutotile");
    expect(getTilesetMetadataEditMode()).toBe("autotile");
    expect(pick(host, "db-tab-spatial-tiles").classList.contains("active")).toBe(true);
    jump(host, "tilesetUnlabeled");
    expect(getTilesetMetadataEditMode()).toBe("ai");
    expect(getUnlabeledOnlyFilter()).toBe(true);
    pick(host, "tileset-section-tab-rules").click();
    pick(host, "tileset-edit-mode-terrain").click();
    pick(host, "db-context-terrain").click();
    pick(host, "db-context-back").click();
    expect(getDatabaseActiveTab()).toBe("spatialTiles");
    expect(getTilesetMetadataEditMode()).toBe("terrain");
    expect(pick(host, "tileset-edit-mode-terrain").getAttribute("aria-selected")).toBe("true");
    jump(host, "tilesetAutotile");
    expect(getTilesetMetadataEditMode()).toBe("autotile");
    pick(host, "db-tab-spatial-tiles").click();
    expect(getTilesetMetadataEditMode()).toBe("autotile");
    expect(pick(host, "tileset-section-tab-compose").getAttribute("aria-selected")).toBe("true");
  });
});
