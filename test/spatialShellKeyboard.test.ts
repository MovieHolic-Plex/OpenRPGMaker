// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { editorState } from "@/editor/editorState";
import { renderDatabasePanel, setDatabaseActiveTab } from "@/editor/panels/database";
import { spatialCardDomSelector } from "@/editor/panels/spatialCatalog";
import {
  resetSpatialAuthoringSessions,
  spatialSession,
} from "@/editor/panels/spatialAuthoringSession";
import { resetScratchConceptTabSession } from "@/editor/panels/scratchConceptTab";
import {
  clearSelectedTileset,
  getSelectedTilesetId,
  setSelectedTileset,
} from "@/editor/panels/tilesetSettingsPanel";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";

let host: HTMLDivElement;
const previousProject = store.getCurrent();
const previousEditor = editorState.get();

function activateWithEnter(button: HTMLButtonElement): boolean {
  const event = new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true });
  button.dispatchEvent(event);
  if (!event.defaultPrevented) button.click();
  return event.defaultPrevented;
}

beforeEach(() => {
  const project = createBlankProject();
  for (const tileset of Object.values(project.tilesets)) delete tileset.scratchConceptBundles;
  store.replace(project);
  editorState.set({ currentMapId: project.startMapId });
  resetScratchConceptTabSession();
  resetSpatialAuthoringSessions();
  clearSelectedTileset();
  setDatabaseActiveTab("spatialTiles");
  host = document.createElement("div");
  host.className = "database-modal-body";
  document.body.append(host);
});

afterEach(() => {
  host.remove();
  resetScratchConceptTabSession();
  resetSpatialAuthoringSessions();
  clearSelectedTileset();
  store.replace(previousProject);
  editorState.set(previousEditor);
  setDatabaseActiveTab("overview");
});

describe("spatial shell keyboard and tiles instance selection", () => {
  it("activates 배치된 곳 when Enter is pressed on the focused mode chip", () => {
    renderDatabasePanel(host);
    const instances = host.querySelector<HTMLButtonElement>("[data-testid='spatial-mode-instances']");
    expect(instances, "instances mode chip").not.toBeNull();
    if (!instances) throw new Error("missing instances chip");
    instances.focus();
    const swallowed = activateWithEnter(instances);
    expect(swallowed, "handleShellKey must not preventDefault Enter on a focused button").toBe(false);
    expect(spatialSession().mode).toBe("instances");
    expect(host.querySelector("[data-testid='spatial-mode-instances']")?.getAttribute("aria-pressed")).toBe("true");
  });

  it("selects an unselected gallery card when Enter is pressed on it", () => {
    renderDatabasePanel(host);
    const cards = Array.from(host.querySelectorAll<HTMLButtonElement>("[data-testid^='spatial-card-']"));
    expect(cards.length).toBeGreaterThan(1);
    const unselected = cards.find((card) => !card.classList.contains("is-selected"));
    expect(unselected, "unselected gallery card").toBeDefined();
    if (!unselected) throw new Error("missing unselected card");
    const cardId = unselected.getAttribute("data-card-id");
    if (!cardId) throw new Error("missing card id");
    unselected.focus();
    const swallowed = activateWithEnter(unselected);
    expect(swallowed).toBe(false);
    expect(spatialSession().designId).toBe(cardId);
    expect(host.querySelector(`${spatialCardDomSelector(cardId)}.is-selected`)).not.toBeNull();
  });

  it("keeps a real tileset id after clicking a tiles 맵 사용 instance card", () => {
    const project = store.getCurrent();
    const map = project.maps[project.startMapId];
    expect(map, "blank project start map").toBeDefined();
    if (!map) throw new Error("missing start map");
    expect(map.tilesetId.length).toBeGreaterThan(0);
    setSelectedTileset(map.tilesetId);
    renderDatabasePanel(host);
    host.querySelector<HTMLButtonElement>("[data-testid='spatial-mode-instances']")?.click();
    expect(spatialSession().mode).toBe("instances");
    const usageId = `map:${map.id}`;
    const usageCard = host.querySelector<HTMLButtonElement>(spatialCardDomSelector(usageId));
    expect(usageCard, "map usage card").not.toBeNull();
    expect(usageCard?.getAttribute("data-source")).toBe("placed");
    expect(usageCard?.getAttribute("data-card-id")).toBe(usageId);
    usageCard?.click();
    expect(spatialSession().occurrenceId).toBe(usageId);
    expect(getSelectedTilesetId()).toBe(map.tilesetId);
    expect(window.localStorage.getItem("oprn:database.selectedTilesetId")).toBe(map.tilesetId);
    expect(getSelectedTilesetId()?.startsWith("map:")).toBe(false);
  });
});
