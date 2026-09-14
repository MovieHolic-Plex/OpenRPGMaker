// @vitest-environment happy-dom
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { openTilesetTileBrowser } from "@/editor/panels/tilesetTileBrowser";
import { filterSpatialBrowserCards, renderSpatialAssetBrowser } from "@/editor/panels/spatialAssetBrowser";
import { renderSpatialSpacesCanvas } from "@/editor/panels/spatialSpaceCanvas";
import { bindSpatialAuthoringControllerFactory, visibleAuthoringProject, previewAuthoringDraft, applyAuthoringPreview } from "@/editor/panels/spatialAuthoringAccess";
import { createSpatialAuthoringController } from "@/editor/spatial/actions";
import { spaceChromeState } from "@/editor/panels/spatialSpaceChromeState";
import { resetSpacesAuthoringSession } from "@/editor/panels/spatialSpaceCommands";
import { spatialSession } from "@/editor/panels/spatialAuthoringSession";
import { store } from "@/project/store";
import { spaceCompilerFixture, spaceDesign, interiorAtlas } from "./support/spatialSpaceCompilerFixture";

const previous = store.getCurrent();
beforeEach(() => {
  const fixture = structuredClone(spaceCompilerFixture());
  fixture.spatialAuthoring!.library.spaces[spaceDesign] = { ...fixture.spatialAuthoring!.library.spaces[spaceDesign], objectSlots: [] };
  store.replace(fixture, { preserveEventDrafts: false });
  bindSpatialAuthoringControllerFactory(createSpatialAuthoringController);
  resetSpacesAuthoringSession();
});
afterEach(() => {
  document.querySelector<HTMLButtonElement>("[data-testid='tile-browser-cancel']")?.click();
  document.querySelector<HTMLButtonElement>("[data-testid='structure-kit-editor-close']")?.click();
  document.body.replaceChildren();
  bindSpatialAuthoringControllerFactory(null);
  store.replace(previous, { preserveEventDrafts: false });
});
it("combines tileset and name filters without leaking another tileset", () => {
  const cards = [
    { id: "a", name: "작은 침대", source: "own" as const, kind: "objects" as const, usage: 0, tilesetId: "inside" },
    { id: "b", name: "작은 침대", source: "own" as const, kind: "objects" as const, usage: 0, tilesetId: "outside" },
  ];
  expect(filterSpatialBrowserCards(cards, "작은 침대", "inside").map(card => card.id)).toEqual(["a"]);
  expect(filterSpatialBrowserCards(cards, "없는 이름", null)).toEqual([]);
});
it("tile browsing and cancel do not change the project or select a brush", () => {
  const before = store.getCurrent();
  const pick = vi.fn();
  openTilesetTileBrowser(before.tilesets[interiorAtlas], 0, pick);
  document.querySelector<HTMLButtonElement>("[data-testid='tile-browser-tile-54']")!.click();
  expect(pick).not.toHaveBeenCalled();
  document.querySelector<HTMLButtonElement>("[data-testid='tile-browser-cancel']")!.click();
  expect(pick).not.toHaveBeenCalled();
  expect(store.getCurrent()).toBe(before);
});
it("confirms the selected tile once and preserves search focus while filtering", () => {
  const pick = vi.fn();
  openTilesetTileBrowser(store.getCurrent().tilesets[interiorAtlas], 0, pick);
  const input = document.querySelector<HTMLInputElement>("[data-testid='tile-browser-search']")!;
  input.focus(); input.value = "54"; input.dispatchEvent(new Event("input", { bubbles: true }));
  expect(document.activeElement).toBe(input);
  document.querySelector<HTMLButtonElement>("[data-testid='tile-browser-tile-54']")!.click();
  document.querySelector<HTMLButtonElement>("[data-testid='tile-browser-use']")!.click();
  expect(pick).toHaveBeenCalledExactlyOnceWith(54);
  expect(document.querySelector("[data-testid='tileset-tile-browser']")).toBeNull();
});
it("places an object in a source space by selection and click, then preview/applies it", () => {
  const card = { id: `library-space/library/${spaceDesign}`, localId: spaceDesign, name: "Room", source: "own" as const, kind: "spaces" as const, usage: 0 };
  const canvas = renderSpatialSpacesCanvas(spatialSession(), card, () => {}, { objectBrowser: true });
  document.body.append(canvas);
  canvas.querySelector<HTMLButtonElement>("[data-testid='spatial-object-bed-design']")!.click();
  expect(spaceChromeState.selectedObjectId).toBe("bed-design");
  const board = canvas.querySelector<HTMLElement>("[data-testid='spatial-space-board']")!;
  board.dispatchEvent(new MouseEvent("click", { bubbles: true, clientX: 4 * 24 + 10, clientY: 3 * 24 + 10 }));
  expect(store.getCurrent().spatialAuthoring!.library.spaces[spaceDesign].objectSlots).toHaveLength(0);
  const slots = visibleAuthoringProject().spatialAuthoring!.library.spaces[spaceDesign].objectSlots;
  expect(slots).toHaveLength(1);
  expect(slots[0].objectDesignId).toBe("bed-design");
  const refreshed = renderSpatialSpacesCanvas(spatialSession(), card, () => {}, { objectBrowser: true });
  expect(refreshed.querySelector(".spatial-space-slot-art canvas")).not.toBeNull();
  expect(slots[0].placement).toMatchObject({ mode: "fixed", x: 4, y: 3 });
  expect(previewAuthoringDraft().kind).toBe("ok");
  expect(applyAuthoringPreview().kind).toBe("ok");
  expect(store.getCurrent().spatialAuthoring!.library.spaces[spaceDesign].objectSlots).toHaveLength(1);
});

it("creates a new object in the tileset selected in the browser", () => {
  const project = structuredClone(store.getCurrent());
  project.tilesets["custom-atlas"] = { ...project.tilesets[interiorAtlas], id: "custom-atlas", name: "커스텀", structureKits: [] };
  store.replace(project, { preserveEventDrafts: false });
  const browser = renderSpatialAssetBrowser({ ...spatialSession(), tab: "objects", source: "all", mode: "design" }, undefined, () => {});
  document.body.append(browser);
  browser.querySelector<HTMLButtonElement>("[data-tileset-id='custom-atlas']")!.click();
  browser.querySelector<HTMLButtonElement>("[data-testid='spatial-add']")!.click();
  expect(Object.values(visibleAuthoringProject().spatialAuthoring!.library.objects).some(object => object.graphic.tilesetId === "custom-atlas")).toBe(true);
  expect(store.getCurrent().tilesets["custom-atlas"].structureKits).toHaveLength(0);
});
