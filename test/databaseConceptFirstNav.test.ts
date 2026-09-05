import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  databaseTabGroupLabel, getDatabaseActiveTab, renderDatabasePanel,
  setDatabaseActiveTab, switchDatabaseActiveTab, TAB_GROUPS, type DatabaseTab,
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
  it("mounts only two Map primary entries and moves common events to System, without a folder", () => {
    const host = renderHost();
    expect(TAB_GROUPS.find((group) => group.slug === "world")?.tabs).toEqual(["scratchConcepts", "tilesets"]);
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
    ["structureKits", "scratchConcepts", "structure-kit-heading"],
    ["tilesetSpaces", "scratchConcepts", "tileset-spaces-workspace"],
    ["villages", "scratchConcepts", "db-context-worldGen"],
    ["worldGen", "villages", "db-context-back"],
    ["terrain", "tilesets", "db-terrain-inspector"],
  ] as const)("opens %s from its contextual parent and returns with shared selection", (child, parent, surface) => {
    const host = renderHost();
    jump(host, parent);
    pick(host, `db-context-${child}`).click();
    expect(getDatabaseActiveTab()).toBe(child);
    expect(pick(host, surface)).toBeTruthy();
    expect(pick(host, child === "terrain" ? "db-tab-tilesets" : "db-tab-scratch-concepts").classList.contains("active")).toBe(true);
    expect(databaseTabGroupLabel(child)).toBe(databaseTabGroupLabel("scratchConcepts"));
    pick(host, "db-context-back").click();
    expect(getDatabaseActiveTab()).toBe(parent);
    expect(getSelectedTilesetId()).toBe(INTERIOR_ROOM_TILESET_ID);
  });

  it("keeps concept selection and contextual links through local redraw and child return", () => {
    const host = renderHost();
    pick(host, "scratch-concept-place-corridor").click();
    pick(host, "scratch-concept-thing-stairs").click();
    pick(host, "db-context-structureKits").click();
    expect(pick(host, `structure-kit-tileset-${INTERIOR_ROOM_TILESET_ID}`).classList.contains("active")).toBe(true);
    pick(host, "db-context-back").click();
    expect(pick(host, "scratch-concept-place-corridor").classList.contains("active")).toBe(true);
    expect(pick(host, "scratch-concept-thing-stairs").classList.contains("active")).toBe(true);
    pick(host, "db-context-tilesetSpaces").click();
    expect(host.querySelector("[data-testid='structure-kit-new']")).toBeNull();
    expect(host.querySelector("[data-testid='structure-kit-source-all']")).toBeNull();
  });

  it.each(LEGACY_DESTINATIONS)("keeps legacy destination %s searchable and programmatically routable", (tab) => {
    const host = renderHost();
    search(host, tab);
    const matches = host.querySelectorAll(".db-tab").filter((node) => !node.hidden && node.dataset.tab === tab);
    expect(matches).toHaveLength(1);
    matches[0]!.click();
    expect(getDatabaseActiveTab()).toBe(tab);
    jump(host, tab);
    expect(getDatabaseActiveTab()).toBe(tab);
    search(host, "");
    expect(host.querySelector("[data-search-secondary]")).toBeNull();
  });

  it("finds retired Korean names and clears the empty-search notice", () => {
    const host = renderHost();
    search(host, "구조물");
    pick(host, "db-tab-structure-kits").click();
    expect(getDatabaseActiveTab()).toBe("structureKits");
    search(host, "no-such-destination");
    expect(pick(host, "db-tab-search-empty")).toBeTruthy();
    search(host, "");
    expect(host.querySelector("[data-testid='db-tab-search-empty']")).toBeNull();
  });

  it("honors legacy modes and never restores stale tileset DOM on return", () => {
    const host = renderHost();
    jump(host, "tilesetAutotile");
    expect(getTilesetMetadataEditMode()).toBe("autotile");
    expect(pick(host, "db-tab-tilesets").classList.contains("active")).toBe(true);
    jump(host, "tilesetUnlabeled");
    expect(getTilesetMetadataEditMode()).toBe("ai");
    expect(getUnlabeledOnlyFilter()).toBe(true);
    pick(host, "tileset-section-tab-rules").click();
    pick(host, "tileset-edit-mode-terrain").click();
    pick(host, "db-context-terrain").click();
    pick(host, "db-context-back").click();
    expect(getDatabaseActiveTab()).toBe("tilesets");
    expect(getTilesetMetadataEditMode()).toBe("terrain");
    expect(pick(host, "tileset-edit-mode-terrain").getAttribute("aria-selected")).toBe("true");
    jump(host, "tilesetAutotile");
    expect(getTilesetMetadataEditMode()).toBe("autotile");
    pick(host, "db-tab-tilesets").click();
    expect(getTilesetMetadataEditMode()).toBe("autotile");
    expect(pick(host, "tileset-section-tab-compose").getAttribute("aria-selected")).toBe("true");
  });
});
