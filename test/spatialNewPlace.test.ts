// @vitest-environment happy-dom
import { afterEach, beforeEach, expect, it } from "vitest";
import { createNewPlace, newPlaceTilesets, type NewPlaceKind } from "@/editor/panels/spatialNewPlace";
import { openNewPlaceDialog } from "@/editor/panels/spatialNewPlaceDialog";
import { spaceCompilerFixture } from "./support/spatialSpaceCompilerFixture";
import { instantiateSpatialDesign } from "@/project/spatial/instances";
import { compileSpatialOccurrence } from "@/editor/spatial/compileSpatialOccurrence";
import { spatialId } from "@/project/spatial/domain";
import { serialize, deserialize } from "@/project/io";
import { store } from "@/project/store";
import { createSpatialAuthoringController } from "@/editor/spatial/actions";
import { bindSpatialAuthoringControllerFactory, clearAuthoringSession, hasAuthoringDraft, visibleAuthoringProject, previewAuthoringDraft, applyAuthoringPreview } from "@/editor/panels/spatialAuthoringAccess";
import { resetSpatialAuthoringSessions, spatialSession, onSpatialTabReveal } from "@/editor/panels/spatialAuthoringSession";
const previous = store.getCurrent();
beforeEach(() => {
  resetSpatialAuthoringSessions(); store.replace(spaceCompilerFixture());
  bindSpatialAuthoringControllerFactory(createSpatialAuthoringController);
});
afterEach(() => {
  document.querySelector<HTMLButtonElement>('[data-testid="new-place-cancel"]')?.click();
  onSpatialTabReveal(null); clearAuthoringSession(); bindSpatialAuthoringControllerFactory(null);
  resetSpatialAuthoringSessions(); store.replace(previous);
});
it.each<NewPlaceKind>(["interior", "outdoor", "building"])("creates a playable %s design that survives serialization without changing existing maps", kind => {
  const project = spaceCompilerFixture(); const before = structuredClone(project);
  const tileset = newPlaceTilesets(project, kind)[0]!;
  expect(tileset).toBeDefined();
  const result = createNewPlace(project, { kind, name: "새 장소", width: 10, height: 8, tilesetId: tileset.id });
  expect(project).toEqual(before);
  expect(result.project.maps).toEqual(before.maps);
  const next = deserialize(serialize(result.project));
  const rootId = spatialId(`new-${kind}`);
  next.spatialAuthoring = instantiateSpatialDesign(next.spatialAuthoring!, next, { source: result.source, rootId, x: 0, y: 0, level: 0, seed: 7, generatorVersion: "test" });
  const compiled = compileSpatialOccurrence(next, { occurrenceId: rootId });
  const loaded = deserialize(serialize(compiled));
  expect(loaded.spatialAuthoring!.occurrences[rootId].bindings.length).toBeGreaterThan(0);
  expect(Object.keys(loaded.maps).length).toBeGreaterThan(Object.keys(project.maps).length);
  if (kind === "building") {
    const place = next.spatialAuthoring!.library.places[result.source.id];
    expect(place.kind).toBe("facility"); expect(place.children[0].level).toBe(1);
    expect(next.spatialAuthoring!.library.spaces[place.children[0].source.id].name).toBe("새 장소 1층");
  }
});
it("rejects invalid dimensions and missing atlases without modifying the project", () => {
  const project = spaceCompilerFixture(); const before = structuredClone(project);
  const options = { kind: "interior" as const, name: "방", width: 10, height: 8, tilesetId: "easyrpg_chipset_interior" };
  for (const patch of [{ name: " " }, { width: 0 }, { height: 4.5 }, { width: 129 }, { tilesetId: "missing" }]) {
    expect(() => createNewPlace(project, { ...options, ...patch })).toThrow();
  }
  expect(project).toEqual(before);
});
it("cancelling creation does not create a draft or a design", () => {
  const before = structuredClone(store.getCurrent()); openNewPlaceDialog(() => {});
  document.querySelector<HTMLButtonElement>('[data-testid="new-place-cancel"]')!.click();
  expect(hasAuthoringDraft()).toBe(false); expect(store.getCurrent()).toEqual(before);
});
it("keeps validation errors open, then creates the named room in one draft and opens its editor", () => {
  const before = structuredClone(store.getCurrent()); openNewPlaceDialog(() => {});
  const name = document.querySelector<HTMLInputElement>('[data-testid="new-place-name"]')!;
  const form = name.closest('form')!;
  name.value = " "; form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
  expect(document.querySelector('[data-testid="new-place-dialog"]')).not.toBeNull();
  expect(hasAuthoringDraft()).toBe(false);
  name.value = "내 침실"; form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
  expect(document.querySelector('[data-testid="new-place-dialog"]')).toBeNull();
  expect(spatialSession().tab).toBe("spaces");
  expect(Object.values(visibleAuthoringProject().spatialAuthoring!.library.spaces).some(s => s.name === "내 침실")).toBe(true);
  expect(store.getCurrent()).toEqual(before);
  expect(previewAuthoringDraft().kind).toBe("ok"); expect(applyAuthoringPreview().kind).toBe("ok");
  expect(Object.values(store.getCurrent().spatialAuthoring!.library.spaces).some(s => s.name === "내 침실")).toBe(true);
});
