/** @vitest-environment happy-dom */
import { afterEach, beforeAll, beforeEach, expect, it, vi } from "vitest";
import { getMapEditHistoryEntries, resetMapEditHistory } from "../src/editor/mapEditHistory";
import { createSpatialAuthoringController } from "../src/editor/spatial/actions";
import { deserialize, serialize } from "../src/project/io";
import { isOwnedSpatialBinding } from "../src/project/spatial/bindings";
import { assertNever, own, requireOccurrenceAssociations } from "../src/project/spatial/domain";
import { spatialEventOwner } from "../src/project/spatial/overview";
import { store } from "../src/project/store";
import type { Project } from "../src/project/types";
import { authoringValue } from "./support/spatialAuthoringFixture";
import { geographyRoot } from "./support/spatialGeographyFixture";
import { geographyMotionFixture, motionChild, moveMotionChild } from "./support/spatialGeographyMotionFixture";
import { fixtureDocument } from "./support/spatialSpaceCompilerFixture";

let baseline: string;
const previous = store.getCurrent();
const request = { operation: { kind: "edit" }, compile: { occurrenceId: geographyRoot } } as const;
beforeAll(() => { baseline = serialize(geographyMotionFixture()); });
beforeEach(() => {
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "setInterval", "clearInterval"] });
  store._setPersistenceStateForTest({ loaded: false, remotePersistenceEnabled: false, disabledReason: null });
  store.replace(deserialize(baseline)); resetMapEditHistory();
});
afterEach(() => { store.replace(previous); resetMapEditHistory(); vi.clearAllTimers(); vi.useRealTimers(); });

const faults = ["entry", "return", "enter-command", "return-command", "map-connection", "digest", "return-digest", "owner", "maps"] as const;
type Fault = typeof faults[number];
function corrupt(project: Project, fault: Fault): void {
  const document = fixtureDocument(project);
  const root = own(document.occurrences, geographyRoot);
  const first = motionChild(project, geographyRoot, "first");
  const binding = root.bindings.find(isOwnedSpatialBinding);
  const entry = binding?.overviewEntries?.find(entry => entry.target.occurrenceId === first);
  if (!binding || !entry) throw new TypeError("Missing protected pair");
  switch (fault) {
    case "entry": case "return": case "digest": case "owner": {
      const changed = (() => {
        switch (fault) {
          case "entry": return { ...binding, overviewEntries: binding.overviewEntries?.map(value => value.eventId === entry.eventId ? { ...value, x: value.x + 1 } : value) };
          case "return": return { ...binding, overviewEntries: binding.overviewEntries?.map(value => value.eventId === entry.eventId ? { ...value, returnEventId: entry.eventId } : value) };
          case "digest": return { ...binding, contentDigest: "0".repeat(64) };
          case "owner": return { ...binding, eventIds: binding.eventIds.filter(id => id !== entry.eventId) };
          default: return assertNever(fault);
        }
      })();
      project.spatialAuthoring = { ...document, occurrences: { ...document.occurrences,
        [root.id]: { ...root, bindings: root.bindings.map(value => value === binding ? changed : value) } } };
      break;
    }
    case "enter-command": case "return-command": {
      const id = fault === "enter-command" ? entry.eventId : entry.returnEventId;
      const link = project.mapConnections?.find(link => link.id === id);
      if (!link) throw new TypeError("Missing protected projection");
      const map = own(project.maps, link.from.mapId);
      map.events = map.events.map(event => event.id === id ? { ...event, pages: event.pages?.map(page => ({ ...page,
        commands: [{ kind: "transfer", mapId: link.to.mapId, x: link.to.x + 1, y: link.to.y }] })) } : event);
      break;
    }
    case "map-connection": project.mapConnections = project.mapConnections?.map(link => link.id === entry.returnEventId
      ? { ...link, to: { ...link.to, x: link.to.x + 1 } } : link); break;
    case "maps": {
      const map = own(project.maps, binding.mapId);
      map.lowerTiles[0] = (map.lowerTiles[0] ?? 0) + 1;
      break;
    }
    case "return-digest": {
      const link = project.mapConnections?.find(link => link.id === entry.returnEventId);
      if (!link) throw new TypeError("Missing return projection");
      const owner = spatialEventOwner(document, { mapId: link.from.mapId, eventId: entry.returnEventId });
      if (!owner) throw new TypeError("Missing return owner");
      const occurrence = own(document.occurrences, owner.occurrenceId);
      project.spatialAuthoring = { ...document, occurrences: { ...document.occurrences, [occurrence.id]: { ...occurrence,
        bindings: occurrence.bindings.map(value => value === owner.binding ? { ...value, contentDigest: "0".repeat(64) } : value) } } };
      break;
    }
    default: assertNever(fault);
  }
}

it.each(faults.flatMap(fault => [ { fault, checkpoint: true }, { fault, checkpoint: false } ]))(
  "rejects $fault forgery before a compiled move (checkpoint=$checkpoint)", ({ fault, checkpoint }) => {
    // Given a damaged old checkpoint or an editable draft trying to supply its own output proof.
    if (checkpoint) corrupt(store.getCurrent(), fault);
    const controller = createSpatialAuthoringController();
    const draft = authoringValue(controller.createDraft());
    Object.assign(draft.project, moveMotionChild(draft.project, { parentId: geographyRoot, slot: "first", x: 8 }));
    if (!checkpoint) corrupt(draft.project, fault);
    const live = JSON.stringify(store.getCurrent());
    const authored = JSON.stringify(draft.project);
    // When previewing the motion with the actual containing root.
    const result = controller.preview(draft, request);
    // Then no damaged pair or digest is repaired into ownership and no state is published.
    expect(result.kind).toBe("error");
    expect(JSON.stringify(store.getCurrent())).toBe(live);
    expect(JSON.stringify(draft.project)).toBe(authored);
    expect(getMapEditHistoryEntries()).toEqual([]);
  });

it.each(["missing-compile", "partial-root", "parent", "ports", "graph", "clipped", "occupied"] as const)(
  "rejects a compiled move when its contract has %s", fault => {
    // Given a valid old world and a proposed move with invalid scope, identity or destination.
    const controller = createSpatialAuthoringController();
    const draft = authoringValue(controller.createDraft());
    const first = motionChild(draft.project, geographyRoot, "first");
    Object.assign(draft.project, moveMotionChild(draft.project, { parentId: geographyRoot, slot: "first", x: 8 }));
    const document = fixtureDocument(draft.project);
    const child = requireOccurrenceAssociations(own(document.occurrences, first));
    if (child.parentSlot === null) throw new TypeError("Expected associated child, not root");
    let compile = request.compile;
    switch (fault) {
      case "missing-compile": break;
      case "partial-root": compile = { occurrenceId: first }; break;
      case "parent": draft.project.spatialAuthoring = { ...document, occurrences: { ...document.occurrences,
        [first]: { ...child, parentId: motionChild(draft.project, geographyRoot, "third") } } }; break;
      case "ports": draft.project.spatialAuthoring = { ...document, occurrences: { ...document.occurrences,
        [first]: { ...child, snapshot: { ...child.snapshot, ports: [] } } } }; break;
      case "graph": draft.project.spatialAuthoring = { ...document, connections: document.connections.map(link =>
        link.overviewRoute?.occurrenceId === geographyRoot ? { ...link, bidirectional: false } : link) }; break;
      case "clipped": draft.project.spatialAuthoring = { ...document, occurrences: { ...document.occurrences,
        [first]: { ...child, x: 1000 } } }; break;
      case "occupied": Object.assign(draft.project, moveMotionChild(draft.project, { parentId: geographyRoot, slot: "first", x: 26 })); break;
      default: assertNever(fault);
    }
    const live = JSON.stringify(store.getCurrent());
    const authored = JSON.stringify(draft.project);
    // When the real controller previews the invalid placement.
    const result = controller.preview(draft, fault === "missing-compile" ? { operation: { kind: "edit" } } : { ...request, compile });
    // Then the transaction fails atomically, without weakening the compiled ownership contract.
    expect(result.kind).toBe("error");
    expect(JSON.stringify(store.getCurrent())).toBe(live);
    expect(JSON.stringify(draft.project)).toBe(authored);
    expect(getMapEditHistoryEntries()).toEqual([]);
  });

it.each(["source", "frozen"] as const)("keeps actual placements and pairs when only the %s design moves", kind => {
  // Given an unchanged actual occurrence and a changed source or frozen template slot.
  const controller = createSpatialAuthoringController();
  const draft = authoringValue(controller.createDraft());
  const document = fixtureDocument(draft.project);
  const root = requireOccurrenceAssociations(own(document.occurrences, geographyRoot));
  const world = own(root.snapshot.library.worlds, root.source.id);
  const changed = { ...world, regions: world.regions.map(slot => slot.id === "first" ? { ...slot, x: 8 } : slot) };
  switch (kind) {
    case "source": draft.project.spatialAuthoring = { ...document, library: { ...document.library, worlds: { ...document.library.worlds, [world.id]: changed } } }; break;
    case "frozen": draft.project.spatialAuthoring = { ...document, occurrences: { ...document.occurrences, [root.id]: { ...root,
      snapshot: { ...root.snapshot, library: { ...root.snapshot.library, worlds: { ...root.snapshot.library.worlds, [world.id]: changed } } } } } }; break;
    default: assertNever(kind);
  }
  // When previewing without requesting actual compilation or member motion.
  const preview = authoringValue(controller.preview(draft, { operation: { kind: "edit" } }));
  // Then no motion output is prepared and the actual coordinate remains independent of the design.
  expect(own(fixtureDocument(preview.project).occurrences, motionChild(draft.project, geographyRoot, "first")).x).toBe(6);
  expect(preview.project.maps).toEqual(store.getCurrent().maps);
  expect(preview.project.mapConnections).toEqual(store.getCurrent().mapConnections);
});

it.each(["copy", "maps", "bindings", "stale"] as const)("rejects %s authority when continuing a compiled move", fault => {
  // Given a genuine moved preview and either a copied handle or a damaged continuation.
  const controller = createSpatialAuthoringController();
  const draft = authoringValue(controller.createDraft());
  Object.assign(draft.project, moveMotionChild(draft.project, { parentId: geographyRoot, slot: "first", x: 8 }));
  const preview = authoringValue(controller.preview(draft, request));
  const checkpoint = serialize(preview.project);
  const continued = authoringValue(controller.continueDraft(preview));
  Object.assign(continued.project, moveMotionChild(continued.project, { parentId: geographyRoot, slot: "first", x: 9 }));
  switch (fault) {
    case "copy": break;
    case "maps": corrupt(continued.project, "maps"); break;
    case "bindings": corrupt(continued.project, "return-digest"); break;
    case "stale": store.getCurrent().meta.title = "Changed live baseline"; break;
    default: assertNever(fault);
  }
  const live = JSON.stringify(store.getCurrent());
  // When the real controller is asked to use the forged or stale authority.
  const result = fault === "copy" ? controller.continueDraft(structuredClone(preview)) : controller.preview(continued, request);
  // Then neither the immutable full checkpoint nor live project/history is adopted from editable data.
  expect(result.kind).toBe("error");
  expect(serialize(preview.project)).toBe(checkpoint);
  expect(Object.isFrozen(preview.project)).toBe(true);
  expect(JSON.stringify(store.getCurrent())).toBe(live);
  expect(getMapEditHistoryEntries()).toEqual([]);
});
