// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { editorState } from "@/editor/editorState";
import { getMapEditHistoryEntries, redoMapEdit, resetMapEditHistory, undoMapEdit } from "@/editor/mapEditHistory";
import { renderDatabasePanel, setDatabaseActiveTab } from "@/editor/panels/database";
import {
  bindSpatialAuthoringControllerFactory,
  hasAuthoringPreview,
  visibleAuthoringProject,
} from "@/editor/panels/spatialAuthoringAccess";
import {
  resetSpatialAuthoringSessions,
  selectSpatialDesign,
  setSpatialTab,
  spatialSession,
} from "@/editor/panels/spatialAuthoringSession";
import { spatialBuildProposal } from "@/editor/panels/spatialBuildActions";
import { resetSpatialObjectsTabChrome } from "@/editor/panels/spatialObjectChromeState";
import { libraryObjectCardId } from "@/editor/panels/spatialObjectDraft";
import { resetSpatialPlacesTabChrome } from "@/editor/panels/spatialPlaceChromeState";
import { libraryPlaceCardId } from "@/editor/panels/spatialPlaceQuery";
import { librarySpaceCardId } from "@/editor/panels/spatialSpaceDraft";
import { resetSpatialSpacesTabChrome } from "@/editor/panels/spatialSpacesTab";
import { createSpatialAuthoringController } from "@/editor/spatial/actions";
import { own, spatialId } from "@/project/spatial/domain";
import { store } from "@/project/store";
import { installManualProject, manualBuildFixture } from "./support/spatialManualBuildFixture";
import { placeCompilerFixture, placeRoot } from "./support/spatialPlaceCompilerFixture";
import { fixtureDocument, interiorAtlas, spaceDesign } from "./support/spatialSpaceCompilerFixture";

const previous = store.getCurrent();
const previousEditor = editorState.get();
let host: HTMLDivElement;

function paint(): void {
  renderDatabasePanel(host);
}

function control<T extends Element>(testid: string): T {
  const node = host.querySelector<T>(`[data-testid=${JSON.stringify(testid)}]`);
  if (!node) throw new Error(`missing ${testid}`);
  return node;
}

function fill(testid: string, value: string): void {
  const input = control<HTMLInputElement>(testid);
  input.value = value;
  input.dispatchEvent(new Event("change"));
}

function click(testid: string): void {
  control<HTMLButtonElement>(testid).click();
}

beforeEach(() => {
  bindSpatialAuthoringControllerFactory(createSpatialAuthoringController);
  resetSpatialAuthoringSessions();
  resetSpatialPlacesTabChrome();
  resetSpatialSpacesTabChrome();
  resetSpatialObjectsTabChrome();
  resetMapEditHistory();
  manualBuildFixture();
  editorState.set({ currentMapId: store.getCurrent().startMapId, selection: null, activePaletteStamp: null });
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

describe("source build chrome on the real Database controller", () => {
  it("creates zero occurrences when source-save Preview runs on a canonical space", () => {
    // Given
    const live = store.getCurrent();
    setDatabaseActiveTab("spatialSpaces");
    setSpatialTab("spaces");
    selectSpatialDesign(librarySpaceCardId(spaceDesign));
    paint();
    fill("spatial-space-width", "14");
    // When
    click("spatial-preview");
    // Then
    expect(store.getCurrent()).toEqual(live);
    expect(fixtureDocument(visibleAuthoringProject()).occurrences).toEqual({});
    expect(spatialBuildProposal()).toBeNull();
    expect(control<HTMLElement>("spatial-build-input").dataset.seed).toBeUndefined();
    expect(getMapEditHistoryEntries()).toHaveLength(0);
  });

  it("issues a detached space Build at seed 19 whose Apply is one undo/redo", () => {
    // Given
    const live = store.getCurrent();
    setDatabaseActiveTab("spatialSpaces");
    setSpatialTab("spaces");
    selectSpatialDesign(librarySpaceCardId(spaceDesign));
    paint();
    fill("spatial-build-seed", "19");
    // When
    click("spatial-build");
    const first = spatialBuildProposal();
    const rootId = first?.input.rootId;
    // Then
    expect(store.getCurrent()).toEqual(live);
    expect(getMapEditHistoryEntries()).toHaveLength(0);
    expect(first?.input).toMatchObject({ source: { kind: "space", id: spaceDesign }, seed: 19, destination: { kind: "new-maps" } });
    expect(rootId).toEqual(expect.stringMatching(/\S/));
    expect(own(fixtureDocument(visibleAuthoringProject()).occurrences, spatialId(String(rootId))).seed).toBe(19);
    expect(control<HTMLButtonElement>("spatial-apply").disabled).toBe(false);
    expect(control<HTMLElement>("spatial-build-input").dataset).toMatchObject({
      seed: "19", sourceKind: "space", sourceId: spaceDesign, destKind: "new-maps",
    });
    click("spatial-build");
    expect(spatialBuildProposal()?.input.rootId).toBe(rootId);
    click("spatial-apply");
    expect(store.getCurrent()).toEqual(visibleAuthoringProject());
    expect(getMapEditHistoryEntries()).toHaveLength(1);
    expect(spatialSession()).toMatchObject({ tab: "spaces", mode: "instances", occurrenceId: rootId, designId: null });
    expect(undoMapEdit()).toBe(true);
    expect(store.getCurrent()).toEqual(live);
    expect(redoMapEdit()).toBe(true);
    expect(fixtureDocument(store.getCurrent()).rootOccurrenceIds).toEqual([rootId]);
  });

  it("keeps Apply from adopting a Build after a live target tile changes", () => {
    // Given
    const { target } = manualBuildFixture();
    setDatabaseActiveTab("spatialSpaces");
    setSpatialTab("spaces");
    selectSpatialDesign(librarySpaceCardId(spaceDesign));
    paint();
    fill("spatial-build-seed", "19");
    click("spatial-build");
    expect(hasAuthoringPreview()).toBe(true);
    store.updateMap(target.mapId, (map) => { map.lowerTiles[0] = 402; });
    const before = structuredClone(store.getCurrent());
    const history = getMapEditHistoryEntries();
    const selection = spatialSession();
    // When
    click("spatial-apply");
    // Then
    expect(control<HTMLElement>("spatial-preview-error").textContent).toBe("미리보기를 만든 뒤 프로젝트가 바뀌었습니다 — 미리보기를 다시 실행하세요");
    expect(store.getCurrent()).toEqual(before);
    expect(getMapEditHistoryEntries()).toEqual(history);
    expect(spatialSession()).toEqual(selection);
  });

  it("rejects a changed pending seed and keeps the original proposal plus source draft", () => {
    // Given
    setDatabaseActiveTab("spatialSpaces");
    setSpatialTab("spaces");
    selectSpatialDesign(librarySpaceCardId(spaceDesign));
    paint();
    fill("spatial-build-seed", "19");
    click("spatial-build");
    const original = spatialBuildProposal();
    fill("spatial-space-width", "14");
    fill("spatial-build-seed", "31");
    // When
    click("spatial-build");
    // Then
    expect(control<HTMLElement>("spatial-preview-error").textContent).toBe("적용되지 않은 시공 미리보기가 있습니다 — 먼저 적용하세요");
    expect(spatialBuildProposal()?.input).toEqual(original?.input);
    expect(visibleAuthoringProject().spatialAuthoring?.library.spaces[spaceDesign]?.width).toBe(14);
    expect(store.getCurrent().spatialAuthoring?.library.spaces[spaceDesign]?.width).not.toBe(14);
  });

  it("disables Build on a compatibility card whose localId collides with a library space", () => {
    // Given
    const tileset = store.getCurrent().tilesets[interiorAtlas];
    if (!tileset) throw new Error("missing interior atlas");
    tileset.interiorRoomKinds = [...(tileset.interiorRoomKinds ?? []), {
      id: spaceDesign, label: "Collision room", requiredRoles: [], suggestedModifiers: [],
    }];
    setDatabaseActiveTab("spatialSpaces");
    setSpatialTab("spaces");
    paint();
    click(`spatial-card-tileset-room/${encodeURIComponent(interiorAtlas)}/${encodeURIComponent(spaceDesign)}`);
    // When
    const build = control<HTMLButtonElement>("spatial-build");
    // Then
    expect(build.disabled).toBe(true);
    expect(spatialBuildProposal()).toBeNull();
    expect(getMapEditHistoryEntries()).toHaveLength(0);
    expect(editorState.get().activePaletteStamp).toBeNull();
  });

  it("keeps Build disabled on a compatibility card after a valid seed input event", () => {
    // Given
    const tileset = store.getCurrent().tilesets[interiorAtlas];
    if (!tileset) throw new Error("missing interior atlas");
    tileset.interiorRoomKinds = [...(tileset.interiorRoomKinds ?? []), {
      id: spaceDesign, label: "Collision room", requiredRoles: [], suggestedModifiers: [],
    }];
    setDatabaseActiveTab("spatialSpaces");
    setSpatialTab("spaces");
    paint();
    click(`spatial-card-tileset-room/${encodeURIComponent(interiorAtlas)}/${encodeURIComponent(spaceDesign)}`);
    expect(control<HTMLButtonElement>("spatial-build").disabled).toBe(true);
    const live = structuredClone(store.getCurrent());
    const seed = control<HTMLInputElement>("spatial-build-seed");
    seed.focus();
    seed.value = "19";
    // When
    seed.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText", data: "9" }));
    // Then
    expect(control<HTMLButtonElement>("spatial-build").disabled).toBe(true);
    expect(spatialBuildProposal()).toBeNull();
    expect(store.getCurrent()).toEqual(live);
  });

  it("builds a canonical place onto new maps from the Places tab", () => {
    // Given
    const fixture = placeCompilerFixture();
    const document = fixtureDocument(fixture);
    const source = own(document.occurrences, placeRoot).source;
    const project = { ...fixture, spatialAuthoring: { ...document, occurrences: {}, rootOccurrenceIds: [], connections: [] } };
    installManualProject(project);
    editorState.set({ currentMapId: project.startMapId });
    setDatabaseActiveTab("spatialPlaces");
    setSpatialTab("places");
    selectSpatialDesign(libraryPlaceCardId(source.id));
    paint();
    fill("spatial-build-seed", "19");
    const live = store.getCurrent();
    // When
    click("spatial-build");
    // Then
    expect(store.getCurrent()).toEqual(live);
    expect(spatialBuildProposal()?.input).toMatchObject({ source: { kind: "place", id: source.id }, seed: 19, destination: { kind: "new-maps" } });
    expect(Object.keys(visibleAuthoringProject().maps).length).toBeGreaterThan(Object.keys(live.maps).length);
  });

  it("requires an explicit object map rect and entry and builds without arming paint", () => {
    // Given
    const { target } = manualBuildFixture();
    setDatabaseActiveTab("spatialObjects");
    setSpatialTab("objects");
    selectSpatialDesign(libraryObjectCardId("hearth-design"));
    paint();
    fill("spatial-build-seed", "19");
    fill("spatial-build-map", target.mapId);
    fill("spatial-build-rect-x", String(target.rect.x));
    fill("spatial-build-rect-y", String(target.rect.y));
    fill("spatial-build-rect-width", String(target.rect.width));
    fill("spatial-build-rect-height", String(target.rect.height));
    expect(control<HTMLButtonElement>("spatial-build").disabled).toBe(true);
    fill("spatial-build-entry-x", String(target.entry.x));
    fill("spatial-build-entry-y", String(target.entry.y));
    const ready = structuredClone(store.getCurrent());
    // When
    click("spatial-build");
    // Then
    expect(store.getCurrent()).toEqual(ready);
    expect(hasAuthoringPreview()).toBe(true);
    expect(spatialBuildProposal()?.input).toMatchObject({
      source: { kind: "object", id: "hearth-design" }, seed: 19,
      destination: { kind: "map", currentMapId: target.mapId, selection: { mapId: target.mapId, ...target.rect }, entry: target.entry },
    });
    expect(editorState.get().activePaletteStamp).toBeNull();
  });

  it("rejects an object Build whose map atlas does not match without arming paint", () => {
    // Given
    const { target } = manualBuildFixture();
    setDatabaseActiveTab("spatialObjects");
    setSpatialTab("objects");
    selectSpatialDesign(libraryObjectCardId("hearth-design"));
    paint();
    fill("spatial-build-seed", "19");
    fill("spatial-build-map", target.mapId);
    fill("spatial-build-rect-x", String(target.rect.x));
    fill("spatial-build-rect-y", String(target.rect.y));
    fill("spatial-build-rect-width", String(target.rect.width));
    fill("spatial-build-rect-height", String(target.rect.height));
    fill("spatial-build-entry-x", String(target.entry.x));
    fill("spatial-build-entry-y", String(target.entry.y));
    store.updateMap(target.mapId, (map) => { map.tilesetId = "easyrpg_chipset_combined_town"; });
    const mismatched = structuredClone(store.getCurrent());
    // When
    click("spatial-build");
    // Then
    expect(control<HTMLElement>("spatial-preview-error").textContent).toMatch(/atlas/);
    expect(hasAuthoringPreview()).toBe(false);
    expect(store.getCurrent()).toEqual(mismatched);
    expect(getMapEditHistoryEntries()).toHaveLength(0);
    expect(editorState.get().activePaletteStamp).toBeNull();
  });
});
