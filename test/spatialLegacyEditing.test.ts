// @vitest-environment happy-dom
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import { createSpatialAuthoringController } from "@/editor/spatial/actions";
import { bindSpatialAuthoringControllerFactory, hasAuthoringDraft, visibleAuthoringProject, previewAuthoringDraft, applyAuthoringPreview } from "@/editor/panels/spatialAuthoringAccess";
import { openDetachedKitPainter, commitLiveOrDraft } from "@/editor/panels/spatialObjectMutations";
import { renameOwnedKit } from "@/editor/panels/spatialObjectDraft";
import { resetMapEditHistory, undoMapEdit } from "@/editor/mapEditHistory";
import { renderSpatialSpacesInspector } from "@/editor/panels/spatialSpaceInspector";
import { roomKindOf } from "@/editor/panels/spatialGallery";
import { BUILTIN_INTERIOR_ROOM_KINDS } from "@/project/defaults/interiorRoomKinds";
import { INTERIOR_ROOM_TILESET_ID } from "@/editor/interiorRoomPipeline";
import { deserialize, serialize } from "@/project/io";
import type { SpatialGalleryCard } from "@/editor/panels/spatialCatalog";

import { convertLegacySpatialSnapshot } from "@/project/spatial/legacyImport";
import { resolveSpatialGraphic } from "@/project/spatial/assets";

const previous = store.getCurrent();
const tilesetId = INTERIOR_ROOM_TILESET_ID;
beforeEach(() => {
  store.replace(createBlankProject(), { preserveEventDrafts: false });
  bindSpatialAuthoringControllerFactory(createSpatialAuthoringController);
  resetMapEditHistory();
});
afterEach(() => {
  bindSpatialAuthoringControllerFactory(null);
  store.replace(previous, { preserveEventDrafts: false });
  document.body.replaceChildren();
});
it("saves legacy object edits with the production controller bound, survives IO, and undoes", () => {
  store.update(project => { project.tilesets[tilesetId].structureKits = [{ id: "test-kit", name: "Before", kind: "section", width: 1, height: 1, rows: [{ tiles: [1] }] }]; });
  commitLiveOrDraft(() => {}, project => renameOwnedKit(project, tilesetId, "test-kit", "After"));
  expect(hasAuthoringDraft()).toBe(false);
  expect(deserialize(serialize(store.getCurrent())).tilesets[tilesetId].structureKits?.[0].name).toBe("After");
  undoMapEdit();
  expect(store.getCurrent().tilesets[tilesetId].structureKits?.[0].name).toBe("Before");
});
it("edits authored room rules even when their id matches the builtin catalog", () => {
  const kind = BUILTIN_INTERIOR_ROOM_KINDS[0];
  store.update(project => { project.tilesets[tilesetId].interiorRoomKinds = [{ ...kind, label: "Authored" }]; });
  const card: SpatialGalleryCard = { id: "test-room", localId: kind.id, name: "Authored", kind: "spaces", source: "own", usage: 0, tilesetId, compatibility: "room-rule" };
  expect(roomKindOf(card)?.label).toBe("Authored");
  const inspector = renderSpatialSpacesInspector(card, true, () => {});
  document.body.append(inspector);
  const input = inspector.querySelector<HTMLInputElement>(`[data-testid='tileset-spaces-kind-label-${kind.id}']`)!;
  expect(input).not.toBeNull();
  input.value = "Renamed";
  input.dispatchEvent(new Event("change", { bubbles: true }));
  expect(roomKindOf(card)?.label).toBe("Renamed");
  expect(deserialize(serialize(store.getCurrent())).tilesets[tilesetId].interiorRoomKinds?.[0].label).toBe("Renamed");
  undoMapEdit();
  expect(roomKindOf(card)?.label).toBe("Authored");
});
it("copies a builtin room without overwriting an existing authored rule with the same id", () => {
  const kind = BUILTIN_INTERIOR_ROOM_KINDS[0];
  store.update(project => { project.tilesets[tilesetId].interiorRoomKinds = [{ ...kind, label: "Keep me" }]; });
  const card: SpatialGalleryCard = { id: kind.id, localId: kind.id, name: kind.label, kind: "spaces", source: "default", usage: 0, tilesetId };
  const inspector = renderSpatialSpacesInspector(card, true, () => {});
  inspector.querySelector<HTMLButtonElement>("[data-testid='spatial-space-copy']")!.click();
  const records = store.getCurrent().tilesets[tilesetId].interiorRoomKinds!;
  expect(records).toHaveLength(2);
  expect(records[0].label).toBe("Keep me");
  expect(records[1].id).not.toBe(kind.id);
});

it("bakes a canonical builtin graphic into a private editable kit and applies through the controller", () => {
  store.replace(convertLegacySpatialSnapshot(serialize(store.getCurrent())).preview, { preserveEventDrafts: false });
  const before = store.getCurrent();
  const object = Object.values(before.spatialAuthoring!.library.objects)
    .find(entry => resolveSpatialGraphic(before, entry.graphic)?.source === "builtin")!;
  expect(object).toBeDefined();
  const refresh = vi.fn();
  openDetachedKitPainter(object.graphic.tilesetId, object.graphic.kitId, refresh, object.id);
  expect(document.querySelector("[data-testid='structure-kit-editor']")).not.toBeNull();
  const edited = visibleAuthoringProject().spatialAuthoring!.library.objects[object.id];
  expect(edited.graphic.kitId).not.toBe(object.graphic.kitId);
  expect(store.getCurrent()).toBe(before);
  expect(resolveSpatialGraphic(visibleAuthoringProject(), edited.graphic)?.source).toBe("authored");
  const overlay = document.querySelector<HTMLElement>("[data-testid='structure-kit-editor']")!;
  overlay.click();
  expect(refresh).toHaveBeenCalledTimes(1);
  expect(overlay.isConnected).toBe(false);
  expect(previewAuthoringDraft().kind).toBe("ok");
  expect(applyAuthoringPreview().kind).toBe("ok");
  expect(store.getCurrent().spatialAuthoring!.library.objects[object.id].graphic.kitId).toBe(edited.graphic.kitId);
});
