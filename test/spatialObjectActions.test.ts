// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { editorState } from "@/editor/editorState";
import { recordProjectSnapshot, resetMapEditHistory, undoMapEdit } from "@/editor/mapEditHistory";
import { INTERIOR_OBJECT_CATALOG } from "@/editor/interiorObjectCatalog";
import { renderDatabasePanel, setDatabaseActiveTab } from "@/editor/panels/database";
import {
  resetSpatialAuthoringSessions,
  selectSpatialDesign,
  setSpatialTab,
} from "@/editor/panels/spatialAuthoringSession";
import {
  applyAuthoringPreview,
  bindSpatialAuthoringControllerFactory,
  editAuthoringDraft,
  hasAuthoringPreview,
  previewAuthoringDraft,
  visibleAuthoringProject,
} from "@/editor/panels/spatialAuthoringAccess";
import { libraryObjectCardId, patchObjectDesign } from "@/editor/panels/spatialObjectDraft";
import { createSpatialAuthoringController } from "@/editor/spatial/actions";
import {
  atlasMismatch,
  cloneAuthoringProject,
  copyBuiltinObjectIntoProject,
  previewObjectDelete,
} from "@/editor/panels/spatialObjectDraft";
import { resetSpatialObjectsTabChrome } from "@/editor/panels/spatialObjectChromeState";
import { duplicateIntoTileset } from "@/editor/harnessSuggestion/structureKitActions";
import { INTERIOR_ROOM_TILESET_ID } from "@/editor/interiorRoomPipeline";
import { createBlankProject } from "@/project/defaults";
import { validateSpatialAuthoring } from "@/project/spatial/guards";
import { store } from "@/project/store";
import { spatialId } from "@/project/spatial/domain";
import { spatialFixture } from "./support/spatialSchemaFixture";

const previous = store.getCurrent();
const previousEditor = editorState.get();

beforeEach(() => {
  bindSpatialAuthoringControllerFactory(null);
  resetSpatialAuthoringSessions();
  resetSpatialObjectsTabChrome();
  resetMapEditHistory();
  store.replace(createBlankProject(), { preserveEventDrafts: false });
  editorState.set({ currentMapId: store.getCurrent().startMapId });
});

afterEach(() => {
  bindSpatialAuthoringControllerFactory(null);
  resetSpatialAuthoringSessions();
  resetSpatialObjectsTabChrome();
  store.replace(previous, { preserveEventDrafts: false });
  editorState.set(previousEditor);
  setDatabaseActiveTab("overview");
});

describe("spatial object draft actions", () => {
  it("copies a builtin into a detached project without mutating the live store or catalog", () => {
    // Given
    const builtin = INTERIOR_OBJECT_CATALOG[0];
    expect(builtin).toBeDefined();
    if (!builtin) throw new Error("missing catalog object");
    const before = structuredClone(store.getCurrent());
    const tilesetId = Object.hasOwn(before.tilesets, INTERIOR_ROOM_TILESET_ID)
      ? INTERIOR_ROOM_TILESET_ID
      : Object.keys(before.tilesets)[0];
    expect(tilesetId).toBeDefined();
    if (!tilesetId) throw new Error("missing tileset");

    // When
    const copied = copyBuiltinObjectIntoProject({
      project: cloneAuthoringProject(before),
      tilesetId,
      builtinId: builtin.id,
      kitId: "kit_copy_test",
    });

    // Then
    expect("error" in copied).toBe(false);
    if ("error" in copied) throw new Error(copied.error);
    expect(store.getCurrent()).toEqual(before);
    expect(interiorObjectByIdName(builtin.id)).toBe(builtin.label);
    expect(copied.kit.id).toBe("kit_copy_test");
    expect(copied.project.tilesets[tilesetId]?.structureKits?.some((kit) => kit.id === "kit_copy_test")).toBe(true);
    expect(before.tilesets[tilesetId]?.structureKits?.some((kit) => kit.id === "kit_copy_test") ?? false).toBe(false);
  });

  it("undo restores the original kit after a live copy", () => {
    // Given
    const builtin = INTERIOR_OBJECT_CATALOG[0];
    expect(builtin).toBeDefined();
    if (!builtin) throw new Error("missing catalog object");
    const tilesetId = Object.hasOwn(store.getCurrent().tilesets, INTERIOR_ROOM_TILESET_ID)
      ? INTERIOR_ROOM_TILESET_ID
      : Object.keys(store.getCurrent().tilesets)[0];
    expect(tilesetId).toBeDefined();
    if (!tilesetId) throw new Error("missing tileset");
    const beforeKits = store.getCurrent().tilesets[tilesetId]?.structureKits ?? [];

    // When
    recordProjectSnapshot();
    const copy = duplicateIntoTileset(tilesetId, builtin);
    expect(store.getCurrent().tilesets[tilesetId]?.structureKits?.some((kit) => kit.id === copy.id)).toBe(true);
    const undone = undoMapEdit();

    // Then
    expect(undone).toBe(true);
    expect(store.getCurrent().tilesets[tilesetId]?.structureKits ?? []).toEqual(beforeKits);
    expect(interiorObjectByIdName(builtin.id)).toBe(builtin.label);
  });

  it("delete preview lists strong library references and atlas mismatch is visible", () => {
    // Given
    const { project, document, tilesetId } = spatialFixture();
    const withDoc = { ...project, spatialAuthoring: validateSpatialAuthoring(document) };
    const otherTileset = Object.keys(withDoc.tilesets).find((id) => id !== tilesetId);
    expect(otherTileset).toBeDefined();
    if (!otherTileset) throw new Error("need a second atlas");
    const map = Object.values(withDoc.maps)[0];
    expect(map).toBeDefined();
    if (!map) throw new Error("missing map");
    const mismatched = {
      ...withDoc,
      maps: { ...withDoc.maps, [map.id]: { ...map, tilesetId: otherTileset } },
    };

    // When
    const preview = previewObjectDelete(withDoc, {
      cardId: "library-object/library/desk",
      tilesetId,
      kitId: "kit",
      name: "desk",
      source: "own",
      libraryId: spatialId("desk"),
    });
    const mismatch = atlasMismatch(mismatched, tilesetId, map.id);

    // Then
    expect(preview.strong.length).toBeGreaterThan(0);
    expect(mismatch).toBe("다른 타일셋에는 찍을 수 없습니다");
  });
});

describe("spatial tiles and objects surfaces", () => {
  it("renders the live tileset editor on the tiles tab without writing the project", () => {
    // Given
    const host = document.createElement("div");
    host.className = "database-modal-body";
    document.body.append(host);
    const before = structuredClone(store.getCurrent());
    setDatabaseActiveTab("spatialTiles");
    setSpatialTab("tiles");

    // When
    renderDatabasePanel(host);

    // Then
    expect(host.querySelector("[data-testid='spatial-tiles-editor']")).not.toBeNull();
    expect(host.querySelector("[data-testid='spatial-canvas']")).not.toBeNull();
    expect(store.getCurrent()).toEqual(before);
    host.remove();
  });

  it("renders object preview and copy-on-write control for a builtin", () => {
    // Given
    const host = document.createElement("div");
    host.className = "database-modal-body";
    document.body.append(host);
    const before = structuredClone(store.getCurrent());
    setDatabaseActiveTab("spatialObjects");
    setSpatialTab("objects");

    // When
    renderDatabasePanel(host);

    // Then
    expect(host.querySelector("[data-testid='spatial-object-preview']")).not.toBeNull();
    expect(host.querySelector("[data-testid='spatial-object-copy']")).not.toBeNull();
    expect(host.querySelector("[data-testid='spatial-object-name']")).not.toBeNull();
    expect(store.getCurrent()).toEqual(before);
    host.remove();
  });
});



function selectDeskCard(host: HTMLElement): void {
  const card = host.querySelector<HTMLButtonElement>('[data-card-id="library-object/library/desk"]');
  expect(card, "library desk card").not.toBeNull();
  card?.click();
}

function bindIdentityController(): void {
  bindSpatialAuthoringControllerFactory(createSpatialAuthoringController);
}

function loadLibraryProject(): string {
  const { project, document, tilesetId } = spatialFixture();
  store.replace({ ...project, spatialAuthoring: validateSpatialAuthoring(document) }, { preserveEventDrafts: false });
  return tilesetId;
}

describe("spatial object UI wiring", () => {
  it("keeps unequal library design id and graphic kit id in the inspector", () => {
    // Given
    const tilesetId = loadLibraryProject();
    bindIdentityController();
    selectSpatialDesign(libraryObjectCardId("desk"));
    setDatabaseActiveTab("spatialObjects");
    setSpatialTab("objects");
    const host = document.createElement("div");
    host.className = "database-modal-body";
    document.body.append(host);

    // When
    renderDatabasePanel(host);
    selectDeskCard(host);

    // Then
    const designId = host.querySelector("[data-testid='spatial-object-design-id']")?.textContent;
    const kitId = host.querySelector("[data-testid='spatial-object-kit-id']")?.textContent
      ?? host.querySelector<HTMLSelectElement>("[data-testid='spatial-object-kit']")?.value;
    expect(designId).toBe("desk");
    expect(kitId).toBe("kit");
    expect(designId).not.toBe(kitId);
    expect(tilesetId).toBeTruthy();
    host.remove();
  });

  it("copy from the object button does not mutate live store before apply", () => {
    // Given
    loadLibraryProject();
    bindIdentityController();
    setDatabaseActiveTab("spatialObjects");
    setSpatialTab("objects");
    const host = document.createElement("div");
    host.className = "database-modal-body";
    document.body.append(host);
    renderDatabasePanel(host);
    const before = structuredClone(store.getCurrent());
    const copy = host.querySelector<HTMLButtonElement>("[data-testid='spatial-object-copy']");

    // When
    copy?.click();

    // Then
    expect(store.getCurrent()).toEqual(before);
    host.remove();
  });

  it("keeps sequential name and chip edits visible on the draft after rerender", () => {
    // Given
    loadLibraryProject();
    bindIdentityController();
    selectSpatialDesign(libraryObjectCardId("desk"));
    setDatabaseActiveTab("spatialObjects");
    setSpatialTab("objects");
    const host = document.createElement("div");
    host.className = "database-modal-body";
    document.body.append(host);
    renderDatabasePanel(host);
    selectDeskCard(host);
    const before = structuredClone(store.getCurrent());
    const name = host.querySelector<HTMLInputElement>("[data-testid='spatial-object-name']");
    expect(name).not.toBeNull();
    if (!name) throw new Error("missing name");

    // When
    name.value = "Renamed Desk";
    name.dispatchEvent(new Event("change"));
    const sit = host.querySelector<HTMLInputElement>("[data-testid='spatial-object-chip-sit']");
    expect(sit).not.toBeNull();
    if (!sit) throw new Error("missing chip");
    sit.checked = true;
    sit.dispatchEvent(new Event("change"));

    // Then
    const nameAfter = host.querySelector<HTMLInputElement>("[data-testid='spatial-object-name']");
    const sitAfter = host.querySelector<HTMLInputElement>("[data-testid='spatial-object-chip-sit']");
    expect(nameAfter?.value).toBe("Renamed Desk");
    expect(sitAfter?.checked).toBe(true);
    expect(store.getCurrent()).toEqual(before);
    expect(visibleAuthoringProject().spatialAuthoring?.library.objects.desk?.name).toBe("Renamed Desk");
    host.remove();
  });

  it("apply is one undoable store write and copy graphic is a new kit", () => {
    // Given
    loadLibraryProject();
    bindIdentityController();
    setDatabaseActiveTab("spatialObjects");
    setSpatialTab("objects");
    const host = document.createElement("div");
    host.className = "database-modal-body";
    document.body.append(host);
    renderDatabasePanel(host);
    const before = structuredClone(store.getCurrent());
    const originalKits = Object.values(before.tilesets).flatMap((tileset) => tileset.structureKits ?? []).map((kit) => kit.id);

    // When
    host.querySelector<HTMLButtonElement>("[data-testid='spatial-object-copy']")?.click();
    expect(store.getCurrent()).toEqual(before);
    expect(host.querySelector<HTMLButtonElement>("[data-testid='spatial-apply']")?.disabled).toBe(true);
    host.querySelector<HTMLButtonElement>("[data-testid='spatial-preview']")?.click();
    host.querySelector<HTMLButtonElement>("[data-testid='spatial-apply']")?.click();
    const afterApply = store.getCurrent();
    const newKits = Object.values(afterApply.tilesets).flatMap((tileset) => tileset.structureKits ?? []);
    const added = newKits.filter((kit) => !originalKits.includes(kit.id));
    const undone = undoMapEdit();

    // Then
    expect(added.length).toBeGreaterThan(0);
    const copiedDesign = Object.values(afterApply.spatialAuthoring?.library.objects ?? {}).find((design) => design.id !== spatialId("desk"));
    expect(copiedDesign?.graphic.kitId).toBe(added[0]?.id);
    expect(copiedDesign?.graphic.kitId).not.toBe("kit");
    expect(undone).toBe(true);
    expect(store.getCurrent().tilesets).toEqual(before.tilesets);
    host.remove();
  });

  it("does not leak a draft into another project session", () => {
    // Given
    loadLibraryProject();
    bindIdentityController();
    selectSpatialDesign(libraryObjectCardId("desk"));
    setDatabaseActiveTab("spatialObjects");
    setSpatialTab("objects");
    const host = document.createElement("div");
    host.className = "database-modal-body";
    document.body.append(host);
    renderDatabasePanel(host);
    selectDeskCard(host);
    const name = host.querySelector<HTMLInputElement>("[data-testid='spatial-object-name']");
    if (!name) throw new Error("missing name");
    name.value = "Leaked Name";
    name.dispatchEvent(new Event("change"));
    expect(visibleAuthoringProject().spatialAuthoring?.library.objects.desk?.name).toBe("Leaked Name");

    // When
    store.replaceProject(createBlankProject());

    // Then
    expect(visibleAuthoringProject().spatialAuthoring?.library.objects.desk).toBeUndefined();
    host.remove();
  });
});


  it("refuses apply until an issued preview exists", () => {
    // Given
    loadLibraryProject();
    bindIdentityController();
    setDatabaseActiveTab("spatialObjects");
    setSpatialTab("objects");
    const host = document.createElement("div");
    host.className = "database-modal-body";
    document.body.append(host);
    renderDatabasePanel(host);
    const before = structuredClone(store.getCurrent());
    host.querySelector<HTMLButtonElement>("[data-testid='spatial-object-copy']")?.click();

    // When
    const applied = applyAuthoringPreview();

    // Then
    expect(applied.kind).toBe("error");
    if (applied.kind === "error") expect(applied.error.message).toBe("authoring-preview-missing");
    expect(hasAuthoringPreview()).toBe(false);
    expect(store.getCurrent()).toEqual(before);
    host.remove();
  });

  it("creates a library ObjectDesign with the blank add action", () => {
    // Given
    loadLibraryProject();
    bindIdentityController();
    setDatabaseActiveTab("spatialObjects");
    setSpatialTab("objects");
    const host = document.createElement("div");
    host.className = "database-modal-body";
    document.body.append(host);
    renderDatabasePanel(host);
    const before = structuredClone(store.getCurrent());

    // When
    host.querySelector<HTMLButtonElement>("[data-testid='spatial-add']")?.click();

    // Then
    expect(store.getCurrent()).toEqual(before);
    const designs = Object.values(visibleAuthoringProject().spatialAuthoring?.library.objects ?? {});
    const added = designs.find((design) => design.id !== spatialId("desk"));
    expect(added).toBeDefined();
    expect(added?.graphic.kitId).toBeTruthy();
    expect(added?.graphic.kitId).not.toBe(added?.id);
    expect(host.querySelector("[data-testid='spatial-object-design-id']")?.textContent).toBe(added?.id);
    host.remove();
  });

  it("keeps a previewed clone-design when later draft edits continue", () => {
    // Given
    loadLibraryProject();
    bindIdentityController();
    const cloneId = spatialId("desk-copy");
    const edited = editAuthoringDraft((project) => project, {
      operation: { kind: "clone-design", source: { kind: "object", id: spatialId("desk") }, id: cloneId, name: "Desk Copy" },
    });
    expect(edited.kind).toBe("ok");
    expect(visibleAuthoringProject().spatialAuthoring?.library.objects[cloneId]).toBeUndefined();

    // When
    const previewed = previewAuthoringDraft();
    expect(previewed.kind).toBe("ok");
    expect(visibleAuthoringProject().spatialAuthoring?.library.objects[cloneId]?.name).toBe("Desk Copy");
    const continued = editAuthoringDraft((project) => patchObjectDesign(project, cloneId, { name: "Desk Copy Edited" }));

    // Then
    expect(continued.kind).toBe("ok");
    expect(visibleAuthoringProject().spatialAuthoring?.library.objects[cloneId]?.name).toBe("Desk Copy Edited");
    expect(hasAuthoringPreview()).toBe(false);
    expect(applyAuthoringPreview().kind).toBe("error");
  });

function interiorObjectByIdName(id: string): string | undefined {
  return INTERIOR_OBJECT_CATALOG.find((object) => object.id === id)?.label;
}
