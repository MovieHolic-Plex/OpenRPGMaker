// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { editorState } from "@/editor/editorState";
import {
  getDatabaseActiveTab,
  renderDatabasePanel,
  resolveCanonicalDatabaseTab,
  setDatabaseActiveTab,
  switchDatabaseActiveTab,
} from "@/editor/panels/database";
import { resetSpatialAuthoringSessions, spatialSession } from "@/editor/panels/spatialAuthoringSession";
import { resetScratchConceptTabSession } from "@/editor/panels/scratchConceptTab";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";

let host: HTMLDivElement;
const previousProject = store.getCurrent();
const previousEditor = editorState.get();

beforeEach(() => {
  const project = createBlankProject();
  for (const tileset of Object.values(project.tilesets)) delete tileset.scratchConceptBundles;
  store.replace(project);
  editorState.set({ currentMapId: project.startMapId });
  resetScratchConceptTabSession();
  resetSpatialAuthoringSessions();
  setDatabaseActiveTab("scratchConcepts");
  host = document.createElement("div");
  host.className = "database-modal-body";
  document.body.append(host);
});

afterEach(() => {
  host.remove();
  resetScratchConceptTabSession();
  resetSpatialAuthoringSessions();
  store.replace(previousProject);
  editorState.set(previousEditor);
  setDatabaseActiveTab("overview");
});

describe("legacy spatial route replacement", () => {
  it.each([
    ["tilesets", "spatialTiles"],
    ["structureKits", "spatialObjects"],
    ["tilesetSpaces", "spatialSpaces"],
    ["scratchConcepts", "spatialPlaces"],
    ["villages", "spatialRegions"],
    ["worldGen", "spatialRegions"],
  ] as const)("maps %s to %s without seeding catalogs", (legacy, canonical) => {
    expect(resolveCanonicalDatabaseTab(legacy)).toBe(canonical);
    const before = structuredClone(store.getCurrent());
    renderDatabasePanel(host);
    switchDatabaseActiveTab(legacy, host);
    expect(getDatabaseActiveTab()).toBe(canonical);
    expect(host.querySelector("[data-testid='spatial-gallery']")).not.toBeNull();
    expect(store.getCurrent()).toEqual(before);
  });

  it("keeps default and owned cards in separate source chips", () => {
    renderDatabasePanel(host);
    const inn = host.querySelector("[data-testid='spatial-card-inn']");
    expect(inn).not.toBeNull();
    expect(inn?.getAttribute("data-source")).toBe("default");
    host.querySelector<HTMLButtonElement>("[data-testid='spatial-source-own']")?.click();
    expect(host.querySelector("[data-testid='spatial-card-inn']")).toBeNull();
    expect(store.getCurrent().tilesets[Object.keys(store.getCurrent().tilesets)[0]!]?.scratchConceptBundles).toBeUndefined();
  });

  it("clears villages compatibility when the canonical Regions rail is clicked again", () => {
    renderDatabasePanel(host);
    switchDatabaseActiveTab("villages", host);
    expect(spatialSession().legacyOrigin).toBe("villages");
    expect(spatialSession().tab).toBe("regions");
    expect(spatialSession().regionKindFilter).toBe("settlement");
    const regions = host.querySelector<HTMLButtonElement>("[data-testid='db-tab-spatial-regions']");
    expect(regions).not.toBeNull();
    regions?.click();
    expect(getDatabaseActiveTab()).toBe("spatialRegions");
    expect(spatialSession().legacyOrigin).toBeNull();
    expect(spatialSession().regionKindFilter).toBeNull();
    expect(host.querySelector(".spatial-legacy-host")).toBeNull();
  });
});
