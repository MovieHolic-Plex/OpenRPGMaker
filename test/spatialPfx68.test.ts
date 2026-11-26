// @vitest-environment happy-dom

import { afterEach, beforeEach, expect, it, vi, describe } from "vitest";
import { createSpatialAuthoringController } from "../src/editor/spatial/actions";
import type { SpatialAuthoringRequest } from "../src/editor/spatial/authoringTypes";
import { compileSpatialOccurrence } from "../src/editor/spatial/compileSpatialOccurrence";
import { spatialRasterDigest } from "../src/editor/spatial/compilerValidation";
import { getMapEditHistoryEntries, resetMapEditHistory, getMapEditHistoryState } from "../src/editor/mapEditHistory";
import { store } from "../src/project/store";
import { isPassableLanding } from "../src/project/collision";
import { assertNever, own, requireOccurrenceAssociations, spatialId } from "../src/project/spatial/domain";
import { isOwnedSpatialBinding } from "../src/project/spatial/bindings";
import { spatialPortLanding } from "../src/project/spatial/overview";
import { authoringValue, authoringFixture } from "./support/spatialAuthoringFixture";
import { fixtureDocument } from "./support/spatialSpaceCompilerFixture";
import { placeCompilerFixture, placeRoot, stairFloors, withStairConnections } from "./support/spatialPlaceCompilerFixture";
import { bindSpatialAuthoringControllerFactory, editAuthoringDraft, previewAuthoringDraft, applyAuthoringPreview, spatialAuthoringController } from "../src/editor/panels/spatialAuthoringAccess";
import { ProjectRoutingError } from "../src/project/spatial/saveRouting";
import { isolateTimers } from "./mergedTeardown";

describe("spatialAuthoringConnectionSafety", () => {
  isolateTimers();
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "setInterval", "clearInterval"] });
    store._setPersistenceStateForTest({ loaded: false, remotePersistenceEnabled: false, disabledReason: null });
    resetMapEditHistory();
  });
  afterEach(() => { resetMapEditHistory(); vi.clearAllTimers(); vi.useRealTimers(); });
  it.each(["unknown-id", "duplicate-id", "missing-port", "foreign-port", "missing-occurrence", "missing-compile", "foreign-compile", "blocked-port", "raw-retarget"] as const)(
    "rejects atomically when connection editing requests %s", failure => {
      // Given: compiled ordinary links and an invalid exact edit request or draft.
      store.replace(compileSpatialOccurrence(withStairConnections(placeCompilerFixture()), { occurrenceId: placeRoot }));
      resetMapEditHistory();
      const controller = createSpatialAuthoringController();
      const draft = authoringValue(controller.createDraft());
      const document = fixtureDocument(draft.project);
      const link = document.connections[0];
      const floor = stairFloors(draft.project)[2];
      if (!link || !floor) throw new TypeError("Missing fixture edge/floor");
      const compile = { occurrenceId: placeRoot };
      let request: SpatialAuthoringRequest;
      switch (failure) {
        case "unknown-id": request = { operation: { kind: "edit-connection", request: { kind: "remove", connectionId: spatialId("absent") } }, compile }; break;
        case "duplicate-id": request = { operation: { kind: "edit-connection", request: { kind: "create", connection: link } }, compile }; break;
        case "missing-port": request = { operation: { kind: "edit-connection", request: { kind: "replace", connection: { ...link, to: { ...link.to, portId: spatialId("absent") } } } }, compile }; break;
        case "foreign-port": request = { operation: { kind: "edit-connection", request: { kind: "replace", connection: { ...link, to: { ...link.to, portId: link.from.portId } } } }, compile }; break;
        case "missing-occurrence": request = { operation: { kind: "edit-connection", request: { kind: "replace", connection: { ...link, to: { ...link.to, occurrenceId: spatialId("absent") } } } }, compile }; break;
        case "missing-compile": request = { operation: { kind: "edit-connection", request: { kind: "remove", connectionId: link.id } } }; break;
        case "foreign-compile": request = { operation: { kind: "edit-connection", request: { kind: "remove", connectionId: link.id } }, compile: { occurrenceId: floor.roomId } }; break;
        case "raw-retarget": {
          draft.project.spatialAuthoring = { ...document, connections: document.connections.map(value => value.id === link.id ? { ...value, bidirectional: false } : value) };
          request = { operation: { kind: "edit-connection", request: { kind: "remove", connectionId: link.id } }, compile }; break;
        }
        case "blocked-port": {
          const room = requireOccurrenceAssociations(own(document.occurrences, floor.roomId));
          const port = room.snapshot.ports[0];
          if (!port) throw new TypeError("Missing room entry");
          const design = own(room.snapshot.library.spaces, room.source.id);
          const landing = spatialPortLanding(document, { occurrenceId: room.id, portId: port.id });
          if (!landing) throw new TypeError("Missing compiled room entry");
          expect(isPassableLanding(draft.project, own(draft.project.maps, landing.mapId), landing.x - port.x + 1, landing.y - port.y + 4)).toBe(false);
          draft.project.spatialAuthoring = { ...document, occurrences: { ...document.occurrences, [room.id]: { ...room, snapshot: { ...room.snapshot,
            ports: room.snapshot.ports.map(value => value.id === port.id ? { ...value, x: 1, y: 4 } : value),
            library: { ...room.snapshot.library, spaces: { ...room.snapshot.library.spaces, [design.id]: { ...design,
              ports: design.ports.map(value => value.id === port.localPortId ? { ...value, x: 1, y: 4 } : value) } } },
          } } } };
          request = { operation: { kind: "edit-connection", request: { kind: "replace", connection: { ...link, to: { occurrenceId: room.id, portId: port.id } } } }, compile }; break;
        }
        default: return assertNever(failure);
      }
      const before = structuredClone(store.getCurrent());
      // When: the real controller handles the invalid operation.
      const result = controller.preview(draft, request);
      // Then: no proposal or partial live/history mutation escapes.
      expect(result.kind).toBe("error");
      expect(store.getCurrent()).toEqual(before);
      expect(getMapEditHistoryEntries()).toHaveLength(0);
    },
  );
  it.each(["digest", "unmanaged", "missing-projection", "wrong-transfer", "competing-event"] as const)(
    "rejects unlink when old transfer proof has %s corruption", corruption => {
      // Given: a formerly compiled pair with a precise ownership/projection corruption.
      const project = compileSpatialOccurrence(withStairConnections(placeCompilerFixture()), { occurrenceId: placeRoot });
      const document = fixtureDocument(project);
      const link = document.connections[0];
      if (!link) throw new TypeError("Missing fixture edge");
      const landing = spatialPortLanding(document, link.from);
      if (!landing) throw new TypeError("Missing fixture landing");
      const map = own(project.maps, landing.mapId);
      const pair = project.mapConnections?.find(value => value.from.mapId === landing.mapId && value.from.x === landing.x && value.from.y === landing.y);
      const event = map.events.find(value => value.id === pair?.id);
      if (!pair || !event) throw new TypeError("Missing generated pair");
      switch (corruption) {
        case "digest": map.lowerTiles[0] = 42; break;
        case "unmanaged":
          project.spatialAuthoring = { ...document, occurrences: Object.fromEntries(Object.values(document.occurrences).map(occurrence => [occurrence.id, { ...occurrence,
            bindings: occurrence.bindings.map(binding => {
              if (!isOwnedSpatialBinding(binding) || !binding.eventIds.includes(event.id)) return binding;
              const next = { ...binding, eventIds: binding.eventIds.filter(id => id !== event.id), connectionIds: binding.connectionIds.filter(id => id !== link.id) };
              return { ...next, contentDigest: spatialRasterDigest(map, next) };
            }),
          }])) }; break;
        case "missing-projection": project.mapConnections = project.mapConnections?.filter(value => value.id !== pair.id); break;
        case "wrong-transfer": {
          map.events = map.events.map(value => value.id === event.id ? { ...value, pages: value.pages?.map(page => ({ ...page,
            commands: [{ kind: "transfer", mapId: pair.to.mapId, x: pair.to.x + 1, y: pair.to.y }],
          })) } : value);
          project.spatialAuthoring = { ...document, occurrences: Object.fromEntries(Object.values(document.occurrences).map(occurrence => [occurrence.id, { ...occurrence,
            bindings: occurrence.bindings.map(binding => isOwnedSpatialBinding(binding) && binding.mapId === map.id
              ? { ...binding, contentDigest: spatialRasterDigest(map, binding) } : binding),
          }])) }; break;
        }
        case "competing-event": map.events.push({ ...event, id: "unmanaged-automatic-event" }); break;
        default: return assertNever(corruption);
      }
      store.replace(project);
      resetMapEditHistory();
      const before = structuredClone(store.getCurrent());
      const controller = createSpatialAuthoringController();
      // When: unlink asks to release this exact old pair.
      const result = controller.preview(authoringValue(controller.createDraft()), {
        operation: { kind: "edit-connection", request: { kind: "remove", connectionId: link.id } }, compile: { occurrenceId: placeRoot },
      });
      // Then: proof failure never grants erasure authority or a history entry.
      expect(result.kind).toBe("error");
      expect(store.getCurrent()).toEqual(before);
      expect(getMapEditHistoryEntries()).toHaveLength(0);
    },
  );
});

describe("spatialAuthoringContinuation", () => {
  isolateTimers();
  beforeEach(() => vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "setInterval", "clearInterval"] }));
  afterEach(() => {
    bindSpatialAuthoringControllerFactory(null);
    resetMapEditHistory(); vi.clearAllTimers(); vi.useRealTimers();
  });
  // Permanent promotion of the two exact independent AV11-03 scenarios.
  it.each(["compile", "delete"] as const)("permits a second draft preview when the user continues after a %s preview", operation => {
    // Given a displayed generated/deletion preview that has not been accepted.
    const f = authoringFixture(operation === "delete");
    const before = structuredClone(store.getCurrent());
    bindSpatialAuthoringControllerFactory(createSpatialAuthoringController);
    switch (operation) {
      case "compile": authoringValue(editAuthoringDraft(project => project, { operation: { kind: "edit" }, compile: f.compile })); break;
      case "delete": authoringValue(editAuthoringDraft(project => project, { operation: { kind: "delete-occurrence",
        request: { occurrenceId: f.occurrenceId, externalConnections: "reject" } } })); break;
      default: return assertNever(operation);
    }
    authoringValue(previewAuthoringDraft());
    authoringValue(editAuthoringDraft(project => ({ ...project, meta: { ...project.meta, title: "continued-ui-edit" } })));
    // When the real helper submits the continued draft through its public preview action.
    const result = previewAuthoringDraft();
    // Then generated private raster must not become a forged user edit or leak into live state.
    expect(store.getCurrent()).toEqual(before);
    expect(result).toMatchObject({ kind: "ok" });
  });
  it.each(["compile", "delete"] as const)("accepts the whole proposal with one undo when a %s preview is continued", operation => {
    // Given an earlier source edit and an unapplied operation followed by two ordinary edits.
    const f = authoringFixture(operation === "delete");
    const before = structuredClone(store.getCurrent());
    bindSpatialAuthoringControllerFactory(createSpatialAuthoringController);
    authoringValue(editAuthoringDraft(project => {
      const doc = fixtureDocument(project);
      const source = own(doc.library.objects, "hearth-design");
      return { ...project, spatialAuthoring: { ...doc, library: { ...doc.library, objects: {
        ...doc.library.objects, [source.id]: { ...source, name: "Earlier source edit" },
      } } } };
    }));
    switch (operation) {
      case "compile": authoringValue(editAuthoringDraft(project => project, { operation: { kind: "edit" }, compile: f.compile })); break;
      case "delete": authoringValue(editAuthoringDraft(project => project, { operation: { kind: "delete-occurrence",
        request: { occurrenceId: f.occurrenceId, externalConnections: "reject" } } })); break;
      default: return assertNever(operation);
    }
    const first = authoringValue(previewAuthoringDraft());
    authoringValue(editAuthoringDraft(project => ({ ...project, meta: { ...project.meta, title: "Intermediate title" } })));
    authoringValue(previewAuthoringDraft());
    authoringValue(editAuthoringDraft(project => ({ ...project, meta: { ...project.meta, title: "Final title" } })));
    const final = authoringValue(previewAuthoringDraft());
    const expected = { ...structuredClone(first.project), meta: { ...first.project.meta, title: "Final title" } };
    expect(final.project).toEqual(expected);
    expect(final.impact).toEqual(first.impact);
    expect(first.impact.mapIds).toContain(f.target.mapId);
    expect(first.impact.occurrenceIds).toContain(f.occurrenceId);
    expect(store.getCurrent()).toEqual(before);
    const controller = spatialAuthoringController();
    if (!controller) throw new TypeError("Expected bound controller");
    // When the complete continued proposal traverses one acceptance, undo and redo.
    const accepted = authoringValue(applyAuthoringPreview());
    const adopted = structuredClone(store.getCurrent());
    const entries = getMapEditHistoryEntries().length;
    const undone = controller.undo();
    const restored = structuredClone(store.getCurrent());
    const redone = controller.redo();
    const reapplied = controller.apply(final);
    const continuedAfterApply = controller.continueDraft(final);
    // Then all authored and generated changes share one exact reversible transaction.
    expect(accepted).toEqual({ changed: true, impact: first.impact });
    expect(adopted).toEqual(expected);
    expect(entries).toBe(1);
    expect(undone).toBe(true);
    expect(restored).toEqual(before);
    expect(redone).toBe(true);
    expect(reapplied).toMatchObject({ kind: "error", error: { code: "already-applied" } });
    expect(continuedAfterApply).toMatchObject({ kind: "error", error: { code: "already-applied" } });
    expect(store.getCurrent()).toEqual(expected);
  });
  it("preserves the clone and prior edits when a design-clone preview is edited repeatedly", () => {
    // Given a source clone preview carrying an earlier ordinary edit.
    authoringFixture();
    const before = structuredClone(store.getCurrent());
    bindSpatialAuthoringControllerFactory(createSpatialAuthoringController);
    authoringValue(editAuthoringDraft(project => ({ ...project, meta: { ...project.meta, title: "Before clone" } }), {
      operation: { kind: "clone-design", source: { kind: "object", id: spatialId("hearth-design") },
        id: spatialId("continued-clone"), name: "Initial clone" },
    }));
    const first = authoringValue(previewAuthoringDraft());
    authoringValue(editAuthoringDraft(project => {
      const doc = fixtureDocument(project);
      const clone = own(doc.library.objects, "continued-clone");
      return { ...project, spatialAuthoring: { ...doc, library: { ...doc.library, objects: {
        ...doc.library.objects, [clone.id]: { ...clone, name: "Edited clone", revision: 2 },
      } } } };
    }));
    authoringValue(previewAuthoringDraft());
    authoringValue(editAuthoringDraft(project => ({ ...project, meta: { ...project.meta, title: "After clone" } })));
    authoringValue(previewAuthoringDraft());
    // When accepting the continued clone through the real helper.
    authoringValue(applyAuthoringPreview());
    // Then the operation is neither dropped nor replayed, and the source remains independent.
    const doc = fixtureDocument(store.getCurrent());
    expect(own(doc.library.objects, "continued-clone")).toEqual({
      ...own(fixtureDocument(first.project).library.objects, "continued-clone"), name: "Edited clone", revision: 2,
    });
    expect(own(doc.library.objects, "hearth-design")).toEqual(own(fixtureDocument(before).library.objects, "hearth-design"));
    expect(store.getCurrent().meta.title).toBe("After clone");
    expect(getMapEditHistoryEntries()).toHaveLength(1);
  });
});

describe("spatialAuthoringSafety", () => {
  isolateTimers();
  beforeEach(() => vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "setInterval", "clearInterval"] }));
  afterEach(() => { resetMapEditHistory(); vi.clearAllTimers(); vi.useRealTimers(); vi.restoreAllMocks(); });
  it.each(["tile", "source", "association"] as const)("rejects stale apply without changing history when a human edits %s after preview", change => {
    // Given a compiled preview and a later independent human edit.
    const f = authoringFixture();
    const preview = authoringValue(f.controller.preview(f.draft, { operation: { kind: "edit" }, compile: f.compile }));
    store.update(project => {
      const doc = fixtureDocument(project);
      switch (change) {
        case "tile": own(project.maps, f.target.mapId).lowerTiles[0] = 42; break;
        case "source": project.spatialAuthoring = { ...doc, library: { ...doc.library, objects: { ...doc.library.objects,
          "hearth-design": { ...own(doc.library.objects, "hearth-design"), revision: 2 } } } }; break;
        case "association": project.spatialAuthoring = { ...doc, rootOccurrenceIds: [...doc.rootOccurrenceIds].reverse() }; break;
      }
    });
    const before = structuredClone(store.getCurrent());
    // When accepting the now-stale proposal.
    const result = f.controller.apply(preview);
    // Then neither human content nor history is changed.
    expect(result).toMatchObject({ kind: "error", error: { code: "stale" } });
    expect(store.getCurrent()).toEqual(before);
    expect(getMapEditHistoryEntries()).toHaveLength(0);
  });
  it("rejects preview when a detached draft rewrites manually owned raster", () => {
    // Given a detached working copy with a raw tile overwrite outside compiler ownership.
    const f = authoringFixture();
    own(f.draft.project.maps, f.target.mapId).lowerTiles[0] = 42;
    const before = structuredClone(store.getCurrent());
    // When requesting a source edit preview.
    const result = f.controller.preview(f.draft, { operation: { kind: "edit" } });
    // Then raw raster edits are rejected rather than smuggled through shared authoring.
    expect(result).toMatchObject({ kind: "error", error: { code: "ownership" } });
    expect(store.getCurrent()).toEqual(before);
  });
  it("rejects ownership forgery when a draft erases existing binding proof", () => {
    // Given an owned compiled occurrence whose draft tries to release ownership directly.
    const f = authoringFixture(true);
    const doc = fixtureDocument(f.draft.project);
    const occurrence = own(doc.occurrences, f.occurrenceId);
    f.draft.project.spatialAuthoring = { ...doc, occurrences: { ...doc.occurrences, [occurrence.id]: { ...occurrence, bindings: [] } } };
    // When preview bypasses the explicit detach operation.
    const result = f.controller.preview(f.draft, { operation: { kind: "edit" } });
    // Then the shared boundary rejects the forged release.
    expect(result).toMatchObject({ kind: "error", error: { code: "ownership" } });
  });
  it("does not add a second history entry when an accepted preview is applied again", () => {
    // Given an already accepted proposal.
    const f = authoringFixture();
    const preview = authoringValue(f.controller.preview(f.draft, { operation: { kind: "edit" }, compile: f.compile }));
    authoringValue(f.controller.apply(preview));
    // When the same handle is accepted again.
    const result = f.controller.apply(preview);
    // Then it is consumed exactly once.
    expect(result).toMatchObject({ kind: "error", error: { code: "already-applied" } });
    expect(getMapEditHistoryEntries()).toHaveLength(1);
  });
  it("preserves redo when store rejection prevents apply", () => {
    // Given an undo branch and a valid proposal whose real store boundary rejects authority.
    const f = authoringFixture();
    const preview = authoringValue(f.controller.preview(f.draft, { operation: { kind: "edit" }, compile: f.compile }));
    authoringValue(f.controller.apply(preview));
    f.controller.undo();
    const fresh = authoringValue(f.controller.preview(authoringValue(f.controller.createDraft()), { operation: { kind: "edit" }, compile: f.compile }));
    const before = structuredClone(store.getCurrent());
    const history = getMapEditHistoryState();
    vi.spyOn(store, "replace").mockImplementationOnce(() => { throw new ProjectRoutingError("canonical-replacement", "fixture rejection"); });
    // When the store refuses the commit before mutation.
    const result = f.controller.apply(fresh);
    // Then content and the existing redo branch survive exactly.
    expect(result.kind).toBe("error");
    expect(store.getCurrent()).toEqual(before);
    expect(getMapEditHistoryState()).toEqual(history);
  });
  it("rejects foreign handles when another controller issued the draft", () => {
    // Given a handle issued elsewhere.
    const f = authoringFixture();
    // When a second controller is asked to preview it.
    const result = createSpatialAuthoringController().preview(f.draft, { operation: { kind: "edit" } });
    // Then authority cannot be transferred by copying a structural object.
    expect(result).toMatchObject({ kind: "error", error: { code: "foreign-draft" } });
  });
});
