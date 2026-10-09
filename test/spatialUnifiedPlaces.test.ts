// @vitest-environment happy-dom
import { spaceCompilerFixture, spaceDesign } from "./support/spatialSpaceCompilerFixture";
import { instantiateSpatialDesign } from "@/project/spatial/instances";
import { spatialId } from "@/project/spatial/domain";
import { openSelectedChild } from "@/editor/panels/spatialGeographyNavigate";
import { geographyChromeState } from "@/editor/panels/spatialGeographyChromeState";
import type { RegionDesign } from "@/project/spatial/types";
import { afterEach, beforeEach, expect, it } from "vitest";
import { store } from "@/project/store";
import { spatialFixture } from "./support/spatialSchemaFixture";
import { listSpatialGalleryCards } from "@/editor/panels/spatialCatalog";
import { visibleSpatialSelection } from "@/editor/panels/spatialStage";
import { selectSpatialGalleryEntry } from "@/editor/panels/spatialGalleryNavigation";
import { resetSpatialAuthoringSessions, setSpatialTab, spatialSession, patchSpatialSession, popSpatialBreadcrumb } from "@/editor/panels/spatialAuthoringSession";
const previous = store.getCurrent();
beforeEach(() => {
  resetSpatialAuthoringSessions();
  const { project, document } = spatialFixture();
  store.replace({ ...project, spatialAuthoring: document } as unknown as typeof previous);
  setSpatialTab("places");
});
afterEach(() => { resetSpatialAuthoringSessions(); store.replace(previous); });
it("lists both kinds without rewriting shared room identities or data", () => {
  const before = structuredClone(store.getCurrent());
  const cards = listSpatialGalleryCards({ ...spatialSession(), source: "own" });
  expect(cards.filter(c => c.canonicalSource?.kind === "space").map(c => c.localId)).toEqual(["room"]);
  expect(cards.some(c => c.canonicalSource?.kind === "place" && c.localId === "inn")).toBe(true);
  expect(store.getCurrent()).toEqual(before);
});
it("opens a room in its editor even after using placement mode, and returns to places", () => {
  patchSpatialSession({ tab: "spaces", mode: "instances" });
  setSpatialTab("places");
  const room = listSpatialGalleryCards(spatialSession()).find(c => c.canonicalSource?.kind === "space")!;
  selectSpatialGalleryEntry(room);
  expect(spatialSession()).toMatchObject({ tab: "spaces", mode: "design", designId: room.id });
  popSpatialBreadcrumb();
  expect(spatialSession()).toMatchObject({ tab: "places", mode: "design", designId: null });
});
it("opens a placed room by occurrence identity, including frozen placements", () => {
  patchSpatialSession({ mode: "instances" });
  const card = listSpatialGalleryCards(spatialSession()).find(c => c.kind === "spaces")!;
  expect(card).toBeDefined();
  selectSpatialGalleryEntry(card);
  expect(spatialSession()).toMatchObject({ tab: "spaces", mode: "instances", occurrenceId: card.id });
  popSpatialBreadcrumb();
  expect(spatialSession()).toMatchObject({ tab: "places", mode: "instances" });
});

it("does not hand a lone placed room to place-specific controls before it is opened", () => {
  patchSpatialSession({ mode: "instances" });
  expect(listSpatialGalleryCards(spatialSession()).length).toBeGreaterThan(0);
  expect(visibleSpatialSelection(spatialSession())).toBeUndefined();
});

it.each(["design", "instances"] as const)("opens a direct place from a region in %s mode and restores its parent", mode => {
  const project = structuredClone(spaceCompilerFixture());
  const region: RegionDesign = { id: spatialId("direct-region"), name: "지역", revision: 1, tags: [], provenance: { origin: "user" },
    terrain: { tilesetId: "easyrpg_chipset_world", width: 20, height: 20, floor: "ground", areas: [] },
    places: [{ id: spatialId("direct-room"), source: { kind: "space", id: spaceDesign }, x: 4, y: 4, level: 0 }], ports: [], routes: [] };
  project.spatialAuthoring!.library.regions[region.id] = region;
  project.spatialAuthoring = instantiateSpatialDesign(project.spatialAuthoring, project, { source: { kind: "region", id: region.id }, rootId: "direct-region-root", x: 0, y: 0, level: 0, seed: 7, generatorVersion: "nav-test" });
  store.replace(project);
  patchSpatialSession({ tab: "regions", mode, designId: "library-region/library/direct-region", occurrenceId: mode === "instances" ? "direct-region-root" : null, camera: { x: 20, y: 30, zoom: 1.5 } });
  geographyChromeState.selectedChildId = "direct-room";
  openSelectedChild(spatialSession(), region, () => {});
  expect(spatialSession()).toMatchObject({ tab: "spaces", mode });
  if (mode === "design") expect(spatialSession().designId).toBe(`library-space/library/${spaceDesign}`);
  else expect(project.spatialAuthoring!.occurrences[spatialSession().occurrenceId!].source.id).toBe(spaceDesign);
  popSpatialBreadcrumb();
  expect(spatialSession()).toMatchObject({ tab: "regions", mode, camera: { x: 20, y: 30, zoom: 1.5 } });
});
