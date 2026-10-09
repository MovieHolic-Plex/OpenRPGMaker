/** @vitest-environment happy-dom */
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { createSpatialAuthoringController } from "../src/editor/spatial/actions";
import { getMapEditHistoryEntries, getMapEditHistoryState, resetMapEditHistory } from "../src/editor/mapEditHistory";
import { own, requireOccurrenceAssociations, spatialId } from "../src/project/spatial/domain";
import { spatialRasterDigest } from "../src/editor/spatial/compilerValidation";
import { isOwnedSpatialBinding } from "../src/project/spatial/bindings";
import { store } from "../src/project/store";
import { authoringValue } from "./support/spatialAuthoringFixture";
import { fixtureDocument } from "./support/spatialSpaceCompilerFixture";
import { changeOwnedObjectSource, ownedObjectRefreshFixture, refreshCompile, refreshTarget,
  replacementKit, selectedObject, siblingObject } from "./support/spatialOwnedObjectRefreshFixture";

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "setInterval", "clearInterval"] });
  store._setPersistenceStateForTest({ loaded: false, remotePersistenceEnabled: false, disabledReason: null });
});
afterEach(() => { resetMapEditHistory(); vi.clearAllTimers(); vi.useRealTimers(); });

function refreshFixture() {
  store.replace(ownedObjectRefreshFixture());
  resetMapEditHistory();
  const controller = createSpatialAuthoringController();
  const draft = authoringValue(controller.createDraft());
  changeOwnedObjectSource(draft.project);
  return { controller, draft, before: structuredClone(store.getCurrent()) };
}
const request = { operation: { kind: "refresh", request: { occurrenceId: selectedObject, externalConnections: "reject" } },
  compile: refreshCompile } as const;

it("replaces only the selected mixed-layer graphic when its source changes after two builds", () => {
  // Given two compiled asymmetric mixed-layer instances and a later source graphic edit.
  const f = refreshFixture();
  const old = own(fixtureDocument(f.before).occurrences, selectedObject);
  // When only one instance is explicitly refreshed through the actual controller/compiler.
  const preview = authoringValue(f.controller.preview(f.draft, request));
  // Then the input-derived replacement cells, removed old layer and retained identities are exact.
  const map = own(preview.project.maps, refreshTarget.mapId);
  expect(map.lowerTiles[3 * map.width + 3]).toBe(403);
  expect(map.lowerTiles[3 * map.width + 4]).toBe(402);
  expect(map.lowerTiles[3 * map.width + 5]).toBe(-1);
  expect(map.upperTiles[3 * map.width + 5]).toBe(404);
  expect(map.upperTiles[5 * map.width + 3]).toBe(464);
  expect(map.upperTiles[5 * map.width + 5]).toBe(462);
  const next = own(fixtureDocument(preview.project).occurrences, selectedObject);
  expect(next.id).toBe(old.id);
  expect(next.snapshot.ports).toEqual(old.snapshot.ports);
  expect(next.source.revision).toBe(2);
  expect(own(fixtureDocument(preview.project).occurrences, siblingObject)).toEqual(own(fixtureDocument(f.before).occurrences, siblingObject));
  expect(store.getCurrent()).toEqual(f.before);
  expect(getMapEditHistoryEntries()).toEqual([]);
});

it("preserves unmanaged cells events and stacks when a selected graphic is refreshed", () => {
  // Given authored content in unused cells of the reservation, and outside it.
  const f = refreshFixture();
  const beforeMap = own(f.before.maps, refreshTarget.mapId);
  // When a graphic replacement is proposed.
  const preview = authoringValue(f.controller.preview(f.draft, request));
  // Then every non-graphic layer value and all unmanaged events/stacks remain exact.
  const map = own(preview.project.maps, refreshTarget.mapId);
  const writes = new Set(["lower:51", "lower:52", "lower:53", "upper:53", "lower:67", "upper:68", "lower:69", "upper:83", "upper:84", "upper:85"]);
  for (let i = 0; i < map.width * map.height; i++) {
    if (!writes.has(`lower:${i}`)) expect(map.lowerTiles[i]).toBe(beforeMap.lowerTiles[i]);
    if (!writes.has(`upper:${i}`)) expect(map.upperTiles[i]).toBe(beforeMap.upperTiles[i]);
  }
  expect(map.lowerTileStacks).toEqual(beforeMap.lowerTileStacks);
  expect(map.upperTileStacks).toEqual(beforeMap.upperTileStacks);
  const ownedIds = new Set(own(fixtureDocument(f.before).occurrences, selectedObject).bindings
    .filter(isOwnedSpatialBinding).flatMap(binding => binding.eventIds));
  expect(map.events.filter(event => !ownedIds.has(event.id))).toEqual(beforeMap.events.filter(event => !ownedIds.has(event.id)));
  expect(map.events.filter(event => ownedIds.has(event.id))).toEqual(beforeMap.events.filter(event => ownedIds.has(event.id)));
});

it("uses the latest protected raster when a refresh preview is continued with another graphic edit", () => {
  // Given one issued refresh whose pixels differ from the original live checkpoint.
  const f = refreshFixture();
  const first = authoringValue(f.controller.preview(f.draft, request));
  const continued = authoringValue(f.controller.continueDraft(first));
  changeOwnedObjectSource(continued.project, { ...replacementKit, rows: replacementKit.rows.map((row, y) =>
    y === 0 ? { ...row, tiles: [404, 403, -1] } : row) });
  // When refreshing the selected object again within the unapplied proposal.
  const second = authoringValue(f.controller.preview(continued, request));
  // Then the latest frozen checkpoint authorizes replacement, without adopting or changing its sibling.
  expect(own(second.project.maps, refreshTarget.mapId).lowerTiles.slice(51, 54)).toEqual([404, 403, -1]);
  expect(own(first.project.maps, refreshTarget.mapId).lowerTiles.slice(51, 54)).toEqual([403, 402, -1]);
  expect(own(fixtureDocument(second.project).occurrences, siblingObject)).toEqual(own(fixtureDocument(f.before).occurrences, siblingObject));
  expect(second.impact.occurrenceIds).toEqual([selectedObject]);
  expect(store.getCurrent()).toEqual(f.before);
  expect(getMapEditHistoryEntries()).toEqual([]);
});

it("preserves unmanaged pixels when the editable draft forges an old graphic footprint", () => {
  // Given a forged pre-operation snapshot claiming an unmanaged upper cell inside the reservation.
  const f = refreshFixture();
  const document = fixtureDocument(f.draft.project);
  const selected = requireOccurrenceAssociations(own(document.occurrences, selectedObject));
  const graphic = own(selected.snapshot.kitCells, selected.source.id);
  f.draft.project.spatialAuthoring = { ...document, occurrences: { ...document.occurrences, [selected.id]: { ...selected,
    snapshot: { ...selected.snapshot, kitCells: { ...selected.snapshot.kitCells, [selected.source.id]: { ...graphic, width: 4,
      cells: [...graphic.cells, { x: 3, y: 1, layer: "upper", tile: 124 }],
    } } },
  } } };
  // When explicit refresh replaces that draft snapshot from the source.
  const preview = authoringValue(f.controller.preview(f.draft, request));
  // Then only the protected checkpoint supplies erasure authority; editable footprint data cannot erase this cell.
  expect(own(preview.project.maps, refreshTarget.mapId).upperTiles[70]).toBe(124);
  expect(store.getCurrent()).toEqual(f.before);
  expect(getMapEditHistoryEntries()).toEqual([]);
});

it("compiles the requested first build when the checkpoint has no prior occurrence", () => {
  // Given a new root ID and a free explicit target, unlike both existing instances.
  const f = refreshFixture();
  const rootId = spatialId("first-built-after-source-edit");
  const target = { ...refreshTarget, rect: { ...refreshTarget.rect, y: 8 } };
  // When instantiate and compile run in one real controller preview.
  const preview = authoringValue(f.controller.preview(f.draft, { operation: { kind: "instantiate", request: {
    source: { kind: "object", id: spatialId("hearth-design") }, rootId, x: 0, y: 0, level: 0, seed: 19, generatorVersion: "bridge-first-build",
  } }, compile: { occurrenceId: rootId, target } }));
  // Then absence of prior ownership preserves the original first-stamp path.
  const map = own(preview.project.maps, target.mapId);
  expect([map.lowerTiles[131], map.lowerTiles[132], map.upperTiles[133]]).toEqual([403, 402, 404]);
  expect(own(fixtureDocument(preview.project).occurrences, rootId).bindings[0]?.rect).toEqual(target.rect);
  expect(own(fixtureDocument(preview.project).occurrences, selectedObject)).toEqual(own(fixtureDocument(f.before).occurrences, selectedObject));
  expect(store.getCurrent()).toEqual(f.before);
  expect(getMapEditHistoryEntries()).toEqual([]);
});

it.each(["stored", "forged"] as const)("rejects changed owned pixels when a refresh uses a %s digest", digest => {
  // Given live manual raster changes before a fresh draft is issued.
  const f = refreshFixture();
  store.updateMap(refreshTarget.mapId, map => { map.lowerTiles[51] = 124; });
  const before = structuredClone(store.getCurrent());
  const draft = authoringValue(f.controller.createDraft());
  changeOwnedObjectSource(draft.project);
  if (digest === "forged") {
    const document = fixtureDocument(draft.project);
    const selected = own(document.occurrences, selectedObject);
    const map = own(draft.project.maps, refreshTarget.mapId);
    draft.project.spatialAuthoring = { ...document, occurrences: { ...document.occurrences, [selected.id]: { ...selected,
      bindings: selected.bindings.map(binding => isOwnedSpatialBinding(binding)
        ? { ...binding, contentDigest: spatialRasterDigest(map, binding) } : binding),
    } } };
  }
  // When refresh attempts to replace pixels using stale or freshly forged proof.
  const result = f.controller.preview(draft, request);
  // Then neither new ownership nor live/history mutation is accepted.
  expect(result).toMatchObject({ kind: "error", error: { code: "ownership" } });
  expect(store.getCurrent()).toEqual(before);
  expect(getMapEditHistoryEntries()).toEqual([]);
});

it.each(["apply", "undo", "redo"] as const)("retains exact whole-project state when refresh history performs %s", action => {
  // Given one detached selective refresh proposal, with no history beforehand.
  const f = refreshFixture();
  const preview = authoringValue(f.controller.preview(f.draft, request));
  if (action !== "apply") authoringValue(f.controller.apply(preview));
  if (action === "redo") f.controller.undo();
  // When exactly the selected history operation executes.
  if (action === "apply") authoringValue(f.controller.apply(preview));
  else expect(f.controller[action]()).toBe(true);
  // Then the complete project and the one-step history state match the intended snapshot.
  expect(store.getCurrent()).toEqual(action === "undo" ? f.before : preview.project);
  expect(getMapEditHistoryState()).toEqual({ canUndo: action !== "undo", canRedo: action === "undo" });
  expect(getMapEditHistoryEntries()).toHaveLength(action === "undo" ? 0 : 1);
});
