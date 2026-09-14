import { renderPlaceLinkActions } from "@/editor/panels/spatialPlaceLinks";
import { spatialSession } from "@/editor/panels/spatialAuthoringSession";
// @vitest-environment happy-dom
import { afterEach, beforeEach, expect, it } from "vitest";
import { store } from "@/project/store";
import { createSpatialAuthoringController } from "@/editor/spatial/actions";
import { createNewPlace } from "@/editor/panels/spatialNewPlace";
import { addNewPlaceRoom, preparePlaceRoom } from "@/editor/panels/spatialPlaceRooms";
import { renderSpatialPlacesInspector } from "@/editor/panels/spatialPlaceInspector";
import { placeChromeState } from "@/editor/panels/spatialPlaceChromeState";
import { placeDraftTarget } from "@/editor/panels/spatialPlaceDraft";
import { bindSpatialAuthoringControllerFactory, visibleAuthoringProject, applyAuthoringPreview, previewAuthoringDraft, previewPreparedAuthoringDraft, editAuthoringDraft, hasAuthoringPreview } from "@/editor/panels/spatialAuthoringAccess";
import { instantiateSpatialDesign } from "@/project/spatial/instances";
import { compileSpatialOccurrence } from "@/editor/spatial/compileSpatialOccurrence";
import { placedPlaceChildren } from "@/editor/spatial/placedPlaceEdits";
import { spatialId } from "@/project/spatial/domain";
import { spaceCompilerFixture } from "./support/spatialSpaceCompilerFixture";
import { deserialize, serialize } from "@/project/io";
const original = store.getCurrent();
const options = { kind: "interior" as const, name: "객실", width: 8, height: 6, tilesetId: "easyrpg_chipset_interior" };
function fixture() { return createNewPlace(spaceCompilerFixture(), { ...options, kind: "building", name: "여관" }); }
function target(id: string, placed = false) { return placeDraftTarget({ id, localId: id, name: "여관", kind: "places", source: placed ? "placed" : "own", usage: 0 }); }
beforeEach(() => { bindSpatialAuthoringControllerFactory(createSpatialAuthoringController); });
afterEach(() => { bindSpatialAuthoringControllerFactory(null); store.replace(original); });
it("adds a separate room and floor without changing existing shared room templates", () => {
  const made = fixture(); const before = structuredClone(made.project);
  const first = preparePlaceRoom(made.project, target(made.source.id), options, 1);
  const second = preparePlaceRoom(first.project, target(made.source.id), { ...options, name: "2층" }, 2);
  const place = second.project.spatialAuthoring!.library.places[made.source.id];
  expect(place.children.map(child => child.level)).toEqual([1, 1, 2]);
  expect(place.children[1].x).toBeGreaterThan(place.children[0].x + options.width);
  for (const [id, room] of Object.entries(before.spatialAuthoring!.library.spaces)) expect(second.project.spatialAuthoring!.library.spaces[id]).toEqual(room);
  expect(made.project).toEqual(before);
  const reloaded = deserialize(serialize(second.project));
  const root = spatialId("room-test-root");
  reloaded.spatialAuthoring = instantiateSpatialDesign(reloaded.spatialAuthoring!, reloaded, { source: made.source, rootId: root, x: 0, y: 0, level: 0, seed: 7, generatorVersion: "test" });
  const compiled = compileSpatialOccurrence(reloaded, { occurrenceId: root });
  const children = placedPlaceChildren(compiled, root);
  expect(children.map(child => child.level)).toEqual([1, 1, 2]);
  expect(new Set(children.map(child => compiled.spatialAuthoring!.occurrences[child.occurrenceId].bindings[0].mapId)).size).toBe(3);
});
it("adds to a placed building through an issued preview without editing its source recipe", () => {
  const made = fixture(); const root = spatialId("placed-room-test");
  made.project.spatialAuthoring = instantiateSpatialDesign(made.project.spatialAuthoring!, made.project, { source: made.source, rootId: root, x: 0, y: 0, level: 0, seed: 7, generatorVersion: "test" });
  const built = compileSpatialOccurrence(made.project, { occurrenceId: root });
  store.replace(built);
  const before = structuredClone(store.getCurrent());
  expect(addNewPlaceRoom(target(root, true), options, 2)).toBeNull();
  expect(store.getCurrent()).toEqual(before);
  expect(hasAuthoringPreview()).toBe(true);
  expect(applyAuthoringPreview().kind).toBe("ok");
  expect(placedPlaceChildren(store.getCurrent(), root).map(child => child.level)).toEqual([1, 2]);
  expect(store.getCurrent().spatialAuthoring!.library.places[made.source.id]).toEqual(before.spatialAuthoring!.library.places[made.source.id]);
});
it("preserves the earlier issued preview after a prepared operation rejects", () => {
  const made = fixture(); store.replace(made.project);
  editAuthoringDraft(project => ({ ...project, meta: { ...project.meta, title: "기존 초안" } }));
  expect(previewAuthoringDraft().kind).toBe("ok");
  const before = structuredClone(visibleAuthoringProject());
  const rejected = previewPreparedAuthoringDraft(project => createNewPlace(project, options).project, () => ({ kind: "error", error: { code: "unsupported", message: "intentional rejection" } }));
  expect(rejected.kind).toBe("error");
  expect(visibleAuthoringProject()).toEqual(before);
  expect(hasAuthoringPreview()).toBe(true);
  expect(applyAuthoringPreview().kind).toBe("ok");
  expect(store.getCurrent().meta.title).toBe("기존 초안");
});
it("rejects invalid floors before leaving any new design", () => {
  const made = fixture(); store.replace(made.project); const before = structuredClone(visibleAuthoringProject());
  expect(() => addNewPlaceRoom(target(made.source.id), options, 5)).toThrow();
  expect(visibleAuthoringProject()).toEqual(before);
});

it("edits and removes a room slot through the inspector while retaining its source", () => {
  const made = fixture();
  store.replace(made.project);
  const id = made.source.id;
  const child = made.project.spatialAuthoring!.library.places[id].children[0];
  const originalRoom = made.project.spatialAuthoring!.library.spaces[child.source.id];
  placeChromeState.selectedChildId = child.id;
  const host = document.createElement("div");
  const render = () => host.replaceChildren(renderSpatialPlacesInspector({ id, localId: id, name: "여관", kind: "places", source: "own", usage: 0 }, true, render));
  render();
  expect(host.textContent).not.toContain("space");
  const level = host.querySelector<HTMLInputElement>("[data-testid='spatial-place-child-level']")!;
  level.value = "2";
  level.dispatchEvent(new Event("change", { bubbles: true }));
  expect(visibleAuthoringProject().spatialAuthoring!.library.places[id].children[0].level).toBe(2);
  host.querySelector<HTMLButtonElement>("[data-testid='spatial-place-child-delete']")!.click();
  expect(visibleAuthoringProject().spatialAuthoring!.library.places[id].children).toHaveLength(0);
  expect(visibleAuthoringProject().spatialAuthoring!.library.spaces[child.source.id]).toEqual(originalRoom);
  expect(store.getCurrent().spatialAuthoring!.library.places[id].children).toHaveLength(1);
  expect(previewAuthoringDraft().kind).toBe("ok");
  expect(applyAuthoringPreview().kind).toBe("ok");
  expect(store.getCurrent().spatialAuthoring!.library.places[id].children).toHaveLength(0);
});

it("retargets and removes a source doorway without changing rooms", () => {
  const made = fixture();
  const added = preparePlaceRoom(made.project, target(made.source.id), { ...options, name: "위층" }, 2);
  const library = added.project.spatialAuthoring!.library;
  const place = library.places[made.source.id];
  const [from, to] = place.children;
  library.places[place.id] = { ...place, connections: [{ id: spatialId("test-door"), from: { childId: from.id, portId: library.spaces[from.source.id].ports[0].id }, to: { childId: to.id, portId: library.spaces[to.source.id].ports[0].id }, bidirectional: true }] };
  store.replace(added.project);
  placeChromeState.selectedConnectionId = "test-door";
  placeChromeState.connectFromId = from.id;
  placeChromeState.connectFromPort = library.spaces[from.source.id].ports[0].id;
  placeChromeState.connectToId = to.id;
  placeChromeState.connectToPort = library.spaces[to.source.id].ports[0].id;
  placeChromeState.connectBidirectional = false;
  const host = document.createElement("div");
  const render = () => host.replaceChildren(renderPlaceLinkActions(visibleAuthoringProject().spatialAuthoring!.library.places[place.id], target(place.id), { ...spatialSession(), mode: "design" }, render));
  render();
  host.querySelector<HTMLButtonElement>("[data-testid='spatial-place-connect']")!.click();
  expect(visibleAuthoringProject().spatialAuthoring!.library.places[place.id].connections).toMatchObject([{ id: "test-door", bidirectional: false }]);
  host.querySelector<HTMLButtonElement>("[data-testid='spatial-place-disconnect']")!.click();
  expect(visibleAuthoringProject().spatialAuthoring!.library.places[place.id].connections).toHaveLength(0);
  expect(visibleAuthoringProject().spatialAuthoring!.library.spaces).toEqual(library.spaces);
});
