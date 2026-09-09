/** @vitest-environment happy-dom */
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { resetMapEditHistory } from "../src/editor/mapEditHistory";
import { createSpatialAuthoringController } from "../src/editor/spatial/actions";
import { compileSpatialOccurrence } from "../src/editor/spatial/compileSpatialOccurrence";
import { previewPlacedPlaceEdit } from "../src/editor/spatial/placedPlaceEdits";
import { assertNever, own, spatialId } from "../src/project/spatial/domain";
import { store } from "../src/project/store";
import { authoringValue } from "./support/spatialAuthoringFixture";
import { placeChild, placeCompilerFixture, placeRoot } from "./support/spatialPlaceCompilerFixture";
import { fixtureDocument } from "./support/spatialSpaceCompilerFixture";

beforeEach(() => vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "setInterval", "clearInterval"] }));
afterEach(() => { resetMapEditHistory(); vi.clearAllTimers(); vi.useRealTimers(); });

function fixture() {
  const project = placeCompilerFixture();
  store._setPersistenceStateForTest({ loaded: false, remotePersistenceEnabled: false, disabledReason: null });
  store.replace(compileSpatialOccurrence(project, { occurrenceId: placeRoot }));
  resetMapEditHistory();
  const controller = createSpatialAuthoringController();
  return { controller, innId: placeChild(project, placeRoot, "inn") };
}

it.each(["missing", "ancestor", "conflict"] as const)("rejects %s source additions without partial subtree or history writes", scenario => {
  // Given a frozen compiled village, optionally with a later live-source revision.
  const f = fixture();
  const draft = authoringValue(f.controller.createDraft());
  const doc = fixtureDocument(draft.project);
  const inn = own(doc.occurrences, f.innId);
  let sourceId = inn.source.id;
  switch (scenario) {
    case "missing": sourceId = spatialId("missing-reusable-design"); break;
    case "ancestor": sourceId = own(doc.occurrences, placeRoot).source.id; break;
    case "conflict": {
      const source = own(doc.library.places, sourceId);
      draft.project.spatialAuthoring = { ...doc, library: { ...doc.library, places: { ...doc.library.places,
        [sourceId]: { ...source, revision: source.revision + 1, name: "Later source revision" },
      } } };
      break;
    }
    default: return assertNever(scenario);
  }
  const before = structuredClone(store.getCurrent());
  const draftBefore = structuredClone(draft.project);
  // When explicitly adding this selected source through the controller adapter.
  const result = previewPlacedPlaceEdit(f.controller, draft, { compile: { occurrenceId: placeRoot }, edit: {
    kind: "add", parentId: f.innId, rootId: spatialId("rejected-new-subtree"), seed: 31, generatorVersion: "test-v1",
    slot: { id: spatialId("candidate-slot"), source: { kind: "place", id: sourceId }, x: 20, y: 20, level: 1 },
  } });
  // Then the rejected detached proposal cannot leak any graph/library/history writes.
  expect(result).toMatchObject({ kind: "error" });
  expect(draft.project).toEqual(draftBefore);
  expect(store.getCurrent()).toEqual(before);
  expect(f.controller.undo()).toBe(false);
});

it("requires persisted associations when a historical child has incomplete identity", () => {
  // Given valid historical data that intentionally lacks a direct child's associations.
  const f = fixture();
  const beforeProject = structuredClone(store.getCurrent());
  const doc = fixtureDocument(beforeProject);
  const { parentSlot: _association, ...legacy } = own(doc.occurrences, f.innId);
  beforeProject.spatialAuthoring = { ...doc, occurrences: { ...doc.occurrences,
    [f.innId]: { ...legacy, snapshot: { ...legacy.snapshot, ports: [] } },
  } };
  store.replace(beforeProject);
  const before = structuredClone(store.getCurrent());
  const draft = authoringValue(f.controller.createDraft());
  // When an identity-dependent move is requested.
  const result = previewPlacedPlaceEdit(f.controller, draft, { compile: { occurrenceId: placeRoot },
    edit: { kind: "move", parentId: placeRoot, slot: { slotId: spatialId("inn"), index: 0 }, position: { x: 30, y: 9, level: 0 } } });
  // Then no generated-ID or source-ID fallback guesses a target.
  expect(result).toMatchObject({ kind: "error", error: { detail: "association-required" } });
  expect(draft.project).toEqual(before);
  expect(store.getCurrent()).toEqual(before);
  expect(f.controller.undo()).toBe(false);
});

it("rejects fresh recompilation when owned output was manually painted", () => {
  // Given a manual raster edit made before creating the new draft (not just a stale handle).
  const f = fixture();
  const square = own(fixtureDocument(store.getCurrent()).occurrences, placeChild(store.getCurrent(), placeRoot, "square"));
  const binding = square.bindings[0];
  if (!binding) throw new TypeError("Expected compiled square ownership");
  store.updateMap(binding.mapId, map => { map.lowerTiles[binding.rect.y * map.width + binding.rect.x] = -1; });
  const before = structuredClone(store.getCurrent());
  const draft = authoringValue(f.controller.createDraft());
  // When moving the actual square would require replacing that owned output.
  const result = previewPlacedPlaceEdit(f.controller, draft, { compile: { occurrenceId: placeRoot },
    edit: { kind: "move", parentId: placeRoot, slot: { slotId: spatialId("square"), index: 0 }, position: { x: 7, y: 8, level: 0 } } });
  // Then ownership guards preserve the manual pixels, source, occurrences and history.
  expect(result).toMatchObject({ kind: "error", error: { code: "ownership" } });
  expect(draft.project).toEqual(before);
  expect(store.getCurrent()).toEqual(before);
  expect(f.controller.undo()).toBe(false);
});

it("rejects a deleted child slot instead of resurrecting its template", () => {
  // Given a controller-issued deletion preview.
  const f = fixture();
  const initial = authoringValue(f.controller.createDraft());
  const deletion = authoringValue(previewPlacedPlaceEdit(f.controller, initial, { compile: { occurrenceId: placeRoot },
    edit: { kind: "delete", parentId: placeRoot, slot: { slotId: spatialId("inn"), index: 0 }, externalConnections: "reject" } }));
  const draft = authoringValue(f.controller.continueDraft(deletion));
  const before = structuredClone(store.getCurrent());
  const draftBefore = structuredClone(draft.project);
  // When a stale token attempts to move the missing actual child.
  const result = previewPlacedPlaceEdit(f.controller, draft, { compile: { occurrenceId: placeRoot },
    edit: { kind: "move", parentId: placeRoot, slot: { slotId: spatialId("inn"), index: 0 }, position: { x: 30, y: 9, level: 0 } } });
  // Then the gap remains and no proposal can be applied accidentally.
  expect(result).toMatchObject({ kind: "error", error: { detail: "missing" } });
  expect(draft.project).toEqual(draftBefore);
  expect(store.getCurrent()).toEqual(before);
  expect(f.controller.undo()).toBe(false);
});
