/** @vitest-environment happy-dom */
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { createSpatialAuthoringController } from "../src/editor/spatial/actions";
import { getMapEditHistoryEntries, resetMapEditHistory } from "../src/editor/mapEditHistory";
import { store } from "../src/project/store";
import { own, spatialId } from "../src/project/spatial/domain";
import { authoringFixture, authoringValue } from "./support/spatialAuthoringFixture";
import { fixtureDocument } from "./support/spatialSpaceCompilerFixture";
import { geographyFixture, geographyRoot } from "./support/spatialGeographyFixture";

beforeEach(() => vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "setInterval", "clearInterval"] }));
afterEach(() => { resetMapEditHistory(); vi.clearAllTimers(); vi.useRealTimers(); });

it("instantiates frozen content when an explicit source insertion is previewed", () => {
  // Given a source in the active library.
  const f = authoringFixture();
  // When the domain insertion request crosses the shared controller.
  const preview = authoringValue(f.controller.preview(f.draft, { operation: { kind: "instantiate", request: {
    source: { kind: "object", id: spatialId("hearth-design") }, rootId: "fresh-object", x: 0, y: 0, level: 0,
    seed: 19, generatorVersion: "authoring-test",
  } } }));
  // Then a standalone frozen occurrence is authored without touching raster.
  const occurrence = own(fixtureDocument(preview.project).occurrences, "fresh-object");
  expect(occurrence.source.revision).toBe(1);
  expect(occurrence.parentId).toBeNull();
  expect(occurrence.bindings).toEqual([]);
  expect(preview.project.maps).toEqual(store.getCurrent().maps);
});

it("rejects deletion when a design still has strong references", () => {
  // Given a hearth source used by a space design.
  const f = authoringFixture();
  // When the shared delete operation is requested without rewriting its references.
  const result = f.controller.preview(f.draft, { operation: { kind: "delete-design", source: { kind: "object", id: spatialId("hearth-design") } } });
  // Then the actual domain strong-reference rule blocks the proposal.
  expect(result).toMatchObject({ kind: "error", error: { code: "invalid" } });
  expect(getMapEditHistoryEntries()).toHaveLength(0);
});

it("deletes a source while preserving historical snapshots when only historical references remain", () => {
  // Given the standalone object source no longer used by current space definitions.
  const f = authoringFixture();
  const doc = fixtureDocument(f.draft.project);
  f.draft.project.spatialAuthoring = { ...doc, library: { ...doc.library, spaces: {} } };
  // When deleting that source explicitly.
  const preview = authoringValue(f.controller.preview(f.draft, { operation: { kind: "delete-design", source: { kind: "object", id: spatialId("hearth-design") } } }));
  // Then historical raster snapshots survive loss of the editable source.
  const next = fixtureDocument(preview.project);
  expect(next.library.objects["hearth-design"]).toBeUndefined();
  expect(next.occurrences).toEqual(doc.occurrences);
});

it("rejects foreign preview handles when a different controller issued them", () => {
  // Given an issued preview.
  const f = authoringFixture();
  const preview = authoringValue(f.controller.preview(f.draft, { operation: { kind: "edit" } }));
  // When another controller receives that handle.
  const result = createSpatialAuthoringController().apply(preview);
  // Then it cannot assume the issuer's baseline authority.
  expect(result).toMatchObject({ kind: "error", error: { code: "foreign-preview" } });
});

it("leaves history empty when a canonical no-op preview is accepted", () => {
  // Given canonical compiled input without edits.
  const f = authoringFixture(true);
  const preview = authoringValue(f.controller.preview(f.draft, { operation: { kind: "edit" } }));
  // When the unchanged proposal is accepted.
  const result = authoringValue(f.controller.apply(preview));
  // Then acceptance does not manufacture a history step.
  expect(result.changed).toBe(false);
  expect(getMapEditHistoryEntries()).toHaveLength(0);
});

it("rejects a clipped stamp without mutation when compile preflight fails", () => {
  // Given a detached stamp request smaller than the frozen raster.
  const f = authoringFixture();
  const before = structuredClone(store.getCurrent());
  // When actual compilation checks its footprint.
  const result = f.controller.preview(f.draft, { operation: { kind: "edit" }, compile: { ...f.compile,
    target: { ...f.target, rect: { ...f.target.rect, width: 1 } } } });
  // Then no partial map, metadata or history becomes live.
  expect(result).toMatchObject({ kind: "error", error: { code: "invalid" } });
  expect(store.getCurrent()).toEqual(before);
  expect(getMapEditHistoryEntries()).toHaveLength(0);
});

it("previews real geography when its compiler is integrated", () => {
  // Given typed geography routed to the integrated region compiler.
  authoringFixture();
  store.replace(geographyFixture("region", 109));
  const controller = createSpatialAuthoringController();
  // When geography compilation is explicitly requested.
  const result = controller.preview(authoringValue(controller.createDraft()), { operation: { kind: "edit" }, compile: { occurrenceId: geographyRoot } });
  // Then concrete overview ownership is present in the detached result, not an unsupported placeholder.
  const preview = authoringValue(result);
  const bindings = own(fixtureDocument(preview.project).occurrences, geographyRoot).bindings;
  expect(bindings).toHaveLength(1);
  for (const binding of bindings) expect(Object.hasOwn(preview.project.maps, binding.mapId)).toBe(true);
  expect(getMapEditHistoryEntries()).toHaveLength(0);
});
