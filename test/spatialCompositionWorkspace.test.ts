// @vitest-environment happy-dom
import { afterEach, beforeEach, expect, it } from "vitest";
import { store } from "@/project/store";
import { mixedFixture } from "./support/spatialMixedFixture";
import { bindSpatialAuthoringControllerFactory, clearAuthoringSession, visibleAuthoringProject, previewAuthoringDraft, applyAuthoringPreview } from "@/editor/panels/spatialAuthoringAccess";
import { createSpatialAuthoringController } from "@/editor/spatial/actions";
import { renderSpatialCompositionWorkspace } from "@/editor/panels/spatialCompositionWorkspace";
import { spatialSession } from "@/editor/panels/spatialAuthoringSession";
import { editComposition } from "@/editor/panels/spatialCompositionAccess";
import { spatialId } from "@/project/spatial/domain";
const previous = store.getCurrent();
beforeEach(() => { clearAuthoringSession(); const fixture = mixedFixture();
  for (const records of [fixture.spatialAuthoring!.library.places, fixture.spatialAuthoring!.library.regions, fixture.spatialAuthoring!.library.worlds]) for (const [id, value] of Object.entries(records)) records[id] = { ...value, composition: { ...value.composition!, tiles: [] } };
  store.replace(fixture, { preserveEventDrafts: false }); bindSpatialAuthoringControllerFactory(createSpatialAuthoringController); });
afterEach(() => { document.body.replaceChildren(); clearAuthoringSession(); bindSpatialAuthoringControllerFactory(null); store.replace(previous, { preserveEventDrafts: false }); });
const source = { kind: "space" as const, id: spatialId("room-design") };
function mount() {
  const render = () => document.body.replaceChildren(renderSpatialCompositionWorkspace({ ...spatialSession(), tab: "spaces" }, { id: "room", name: "Room", kind: "spaces", source: "own", usage: 0, canonicalSource: source }, render));
  render();
}
function click(id: string) { document.querySelector<HTMLButtonElement>(`[data-testid='${id}']`)!.click(); }
it("moves and removes a selected direct member with consecutive keyboard edits, then applies", () => {
  mount();
  document.querySelector<HTMLButtonElement>(".spatial-mixed-member")!.click();
  expect(document.activeElement?.getAttribute("data-testid")).toBe("composition-board");
  document.activeElement!.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }));
  document.activeElement!.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }));
  expect(visibleAuthoringProject().spatialAuthoring!.library.spaces[source.id].composition!.members[0].x).toBe(6);
  expect(store.getCurrent().spatialAuthoring!.library.spaces[source.id].composition!.members[0].x).toBe(4);
  document.activeElement!.dispatchEvent(new KeyboardEvent("keydown", { key: "Delete", bubbles: true }));
  expect(visibleAuthoringProject().spatialAuthoring!.library.spaces[source.id].composition!.members).toHaveLength(0);
  click("composition-undo");
  expect(visibleAuthoringProject().spatialAuthoring!.library.spaces[source.id].composition!.members).toHaveLength(1);
  expect(previewAuthoringDraft().kind).toBe("ok"); expect(applyAuthoringPreview().kind).toBe("ok");
  expect(store.getCurrent().spatialAuthoring!.library.spaces[source.id].composition!.members[0].x).toBe(6);
});
it("rejects shrinking across a child's footprint without poisoning the draft", () => {
  const before = visibleAuthoringProject();
  expect(editComposition(source, value => ({ ...value, height: 7 }))).not.toBeNull();
  expect(visibleAuthoringProject()).toBe(before);
  expect(editComposition(source, value => ({ ...value, width: 22 }))).toBeNull();
  expect(previewAuthoringDraft().kind).toBe("ok");
});
it("offers only lower kinds in each container", () => {
  for (const [kind, id, tab, allowed] of [["space", "room-design", "spaces", ["tile", "object"]], ["place", "inn", "places", ["tile", "object", "space"]], ["region", "town", "regions", ["tile", "object", "space", "place"]], ["world", "world", "worlds", ["tile", "object", "space", "place", "region"]]] as const) {
    const root = renderSpatialCompositionWorkspace({ ...spatialSession(), tab }, { id, name: id, kind: tab, source: "own", usage: 0, canonicalSource: { kind, id: spatialId(id) } }, () => {});
    expect([...root.querySelectorAll("[data-testid^='composition-material-']")].map(el => el.getAttribute("data-testid")!.replace("composition-material-", ""))).toEqual(allowed);
  }
});
