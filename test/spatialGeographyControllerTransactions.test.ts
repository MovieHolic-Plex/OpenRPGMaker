/** @vitest-environment happy-dom */
import { afterEach, beforeAll, beforeEach, expect, it, vi } from "vitest";
import { createSpatialAuthoringController } from "../src/editor/spatial/actions";
import { compileSpatialOccurrence } from "../src/editor/spatial/compileSpatialOccurrence";
import { getMapEditHistoryEntries, resetMapEditHistory } from "../src/editor/mapEditHistory";
import { deserialize, serialize } from "../src/project/io";
import { isOwnedSpatialBinding } from "../src/project/spatial/bindings";
import { assertNever, own } from "../src/project/spatial/domain";
import { store } from "../src/project/store";
import type { Project } from "../src/project/types";
import { authoringValue } from "./support/spatialAuthoringFixture";
import { geographyRoot, geographyRegion } from "./support/spatialGeographyFixture";
import { geographyControllerInput } from "./support/spatialGeographyControllerFixture";
import { fixtureDocument } from "./support/spatialSpaceCompilerFixture";

let compiledWorld: Project;
beforeAll(() => { compiledWorld = compileSpatialOccurrence(geographyControllerInput("world"), { occurrenceId: geographyRoot }); });
beforeEach(() => {
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "setInterval", "clearInterval"] });
  store._setPersistenceStateForTest({ loaded: false, remotePersistenceEnabled: false, disabledReason: null });
  resetMapEditHistory();
});
afterEach(() => { resetMapEditHistory(); vi.clearAllTimers(); vi.useRealTimers(); });

it.each(["region", "world"] as const)("accepts one exact undoable transaction when real %s geography is previewed", kind => {
  // Given source-only contract input, with shared middle-region intent in the world case.
  store.replace(geographyControllerInput(kind));
  const before = serialize(store.getCurrent());
  const controller = createSpatialAuthoringController();
  // When the real geography compiler produces a detached preview that is explicitly accepted.
  const preview = authoringValue(controller.preview(authoringValue(controller.createDraft()), { operation: { kind: "edit" }, compile: { occurrenceId: geographyRoot } }));
  expect(serialize(store.getCurrent())).toBe(before);
  expect(getMapEditHistoryEntries()).toEqual([]);
  const applied = authoringValue(controller.apply(preview));
  // Then complete maps/events/associations are one history step, not a placeholder geography result.
  expect(applied.changed).toBe(true);
  const doc = fixtureDocument(store.getCurrent());
  const owner = own(doc.occurrences, geographyRoot);
  const binding = owner.bindings.find(isOwnedSpatialBinding);
  if (!binding) throw new TypeError("Missing generated overview");
  const children = Object.values(doc.occurrences).filter(child => child.parentId === geographyRoot);
  expect(binding.overviewEntries?.map(entry => entry.target.occurrenceId)).toEqual(children.map(child => child.id));
  expect(store.getCurrent().mapConnections?.length).toBeGreaterThan(0);
  expect(getMapEditHistoryEntries()).toHaveLength(1);
  const accepted = serialize(store.getCurrent());
  expect(accepted).toBe(serialize(preview.project));
  expect(controller.undo()).toBe(true);
  expect(serialize(store.getCurrent())).toBe(before);
  expect(controller.redo()).toBe(true);
  expect(serialize(store.getCurrent())).toBe(accepted);
});

it.each(["overviewEntries", "overviewRoute", "nested-source"] as const)("rejects stale apply when valid %s metadata changes on task10-generated shared world output", field => {
  // Given actual compiled/reloaded nested geography and an unapplied authoring edit.
  store.replace(deserialize(serialize(compiledWorld)));
  const controller = createSpatialAuthoringController();
  const draft = authoringValue(controller.createDraft());
  draft.project.meta.title = "pending controller edit";
  const preview = authoringValue(controller.preview(draft, { operation: { kind: "edit" } }));
  const original = fixtureDocument(store.getCurrent());
  const mapsBefore = JSON.stringify(store.getCurrent().maps);
  const digestsBefore = Object.values(original.occurrences).flatMap(owner => owner.bindings.filter(isOwnedSpatialBinding).map(binding => binding.contentDigest));
  store.update(project => {
    const doc = fixtureDocument(project);
    switch (field) {
      case "overviewEntries": {
        const root = own(doc.occurrences, geographyRoot);
        project.spatialAuthoring = { ...doc, occurrences: { ...doc.occurrences, [root.id]: { ...root,
          bindings: root.bindings.map(binding => isOwnedSpatialBinding(binding) ? { ...binding,
            overviewEntries: [...binding.overviewEntries ?? []].reverse() } : binding) } } };
        break;
      }
      case "overviewRoute": {
        const [first, second] = doc.connections.filter(link => link.overviewRoute?.occurrenceId === geographyRoot);
        if (!first || !second) throw new TypeError("Shared world requires two routes");
        project.spatialAuthoring = { ...doc, connections: doc.connections.map(link => link.id === first.id
          ? { ...second, id: first.id } : link.id === second.id ? { ...first, id: second.id } : link) };
        break;
      }
      case "nested-source": project.spatialAuthoring = { ...doc, library: { ...doc.library, regions: { ...doc.library.regions,
        [geographyRegion]: { ...own(doc.library.regions, geographyRegion), revision: 2 } } } }; break;
      default: return assertNever(field);
    }
  });
  // The competing edit is valid complete project data, not a malformed-metadata shortcut.
  deserialize(serialize(store.getCurrent()));
  expect(JSON.stringify(store.getCurrent().maps)).toBe(mapsBefore);
  expect(Object.values(fixtureDocument(store.getCurrent()).occurrences).flatMap(owner => owner.bindings.filter(isOwnedSpatialBinding).map(binding => binding.contentDigest))).toEqual(digestsBefore);
  const changed = serialize(store.getCurrent());
  // When accepting the earlier full-logical-baseline preview.
  const result = controller.apply(preview);
  // Then unchanged raster digests cannot authorize the stale logical write.
  expect(result).toMatchObject({ kind: "error", error: { code: "stale" } });
  expect(serialize(store.getCurrent())).toBe(changed);
  expect(getMapEditHistoryEntries()).toEqual([]);
});
