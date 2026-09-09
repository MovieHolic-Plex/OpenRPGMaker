/** @vitest-environment happy-dom */
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { createSpatialAuthoringController } from "../src/editor/spatial/actions";
import type { SpatialAuthoringRequest } from "../src/editor/spatial/authoringTypes";
import { compileSpatialOccurrence } from "../src/editor/spatial/compileSpatialOccurrence";
import { spatialRasterDigest } from "../src/editor/spatial/compilerValidation";
import { getMapEditHistoryEntries, resetMapEditHistory } from "../src/editor/mapEditHistory";
import { store } from "../src/project/store";
import { isPassableLanding } from "../src/project/collision";
import { assertNever, own, requireOccurrenceAssociations, spatialId } from "../src/project/spatial/domain";
import { isOwnedSpatialBinding } from "../src/project/spatial/bindings";
import { spatialPortLanding } from "../src/project/spatial/overview";
import { authoringValue } from "./support/spatialAuthoringFixture";
import { fixtureDocument } from "./support/spatialSpaceCompilerFixture";
import { placeCompilerFixture, placeRoot, stairFloors, withStairConnections } from "./support/spatialPlaceCompilerFixture";

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
