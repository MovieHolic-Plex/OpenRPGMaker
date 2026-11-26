// @vitest-environment happy-dom

import { afterEach, beforeAll, beforeEach, expect, it, vi, describe } from "vitest";
import { getMapEditHistoryEntries, resetMapEditHistory, getMapEditHistoryState } from "../src/editor/mapEditHistory";
import { createSpatialAuthoringController } from "../src/editor/spatial/actions";
import { deserialize, serialize } from "../src/project/io";
import { isOwnedSpatialBinding } from "../src/project/spatial/bindings";
import { assertNever, own, requireOccurrenceAssociations, spatialId } from "../src/project/spatial/domain";
import { spatialEventOwner } from "../src/project/spatial/overview";
import { store } from "../src/project/store";
import type { Project } from "../src/project/types";
import { authoringValue } from "./support/spatialAuthoringFixture";
import { geographyRoot } from "./support/spatialGeographyFixture";
import { geographyMotionFixture, motionChild, moveMotionChild } from "./support/spatialGeographyMotionFixture";
import { fixtureDocument, spaceCompilerFixture } from "./support/spatialSpaceCompilerFixture";
import { createNewPlace, newPlaceTilesets, type NewPlaceKind } from "@/editor/panels/spatialNewPlace";
import { openNewPlaceDialog } from "@/editor/panels/spatialNewPlaceDialog";
import { instantiateSpatialDesign } from "@/project/spatial/instances";
import { compileSpatialOccurrence } from "@/editor/spatial/compileSpatialOccurrence";
import { bindSpatialAuthoringControllerFactory, clearAuthoringSession, hasAuthoringDraft, visibleAuthoringProject, previewAuthoringDraft, applyAuthoringPreview } from "@/editor/panels/spatialAuthoringAccess";
import { resetSpatialAuthoringSessions, spatialSession, onSpatialTabReveal } from "@/editor/panels/spatialAuthoringSession";
import { spatialRasterDigest } from "../src/editor/spatial/compilerValidation";
import { changeOwnedObjectSource, ownedObjectRefreshFixture, refreshCompile, refreshTarget, replacementKit, selectedObject, siblingObject } from "./support/spatialOwnedObjectRefreshFixture";
import { isolateTimers } from "./mergedTeardown";

describe("spatialGeographyControllerMoveSafety", () => {
  isolateTimers();
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
});

describe("spatialNewPlace", () => {
  isolateTimers();
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
});

describe("spatialOwnedObjectRefresh", () => {
  isolateTimers();
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
});
