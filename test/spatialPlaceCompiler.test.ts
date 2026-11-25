import { expect, it, describe } from "vitest";
import { compileSpatialOccurrence } from "../src/editor/spatial/compileSpatialOccurrence";
import { refreshSpatialAuthoring } from "../src/editor/spatial/authoringRefresh";
import { spatialRasterDigest } from "../src/editor/spatial/compilerValidation";
import { isOwnedSpatialBinding } from "../src/project/spatial/bindings";
import { assertNever, own, spatialId, requireOccurrenceAssociations } from "../src/project/spatial/domain";
import { fixtureDocument, interiorAtlas, replaceOccurrence } from "./support/spatialSpaceCompilerFixture";
import { changeOwnedObjectSource, ownedObjectRefreshFixture, refreshCompile, refreshTarget, replacementKit, selectedObject, siblingObject } from "./support/spatialOwnedObjectRefreshFixture";
import { isPassableLanding } from "../src/project/collision";
import { placeChild, placeCompilerFixture, placeRoot, stairFloors, withStairConnections } from "./support/spatialPlaceCompilerFixture";
import { preparePlaceContainer } from "@/editor/panels/spatialPlaceContainer";
import { mixedFixture } from "./support/spatialMixedFixture";
import { composedPlaceFloorsFixture } from "./support/spatialComposedFloorsFixture";
import { instantiateSpatialDesign } from "@/project/spatial/instances";
import { deserialize, serialize } from "@/project/io";
import { isolateTimers } from "./mergedTeardown";

describe("spatialOwnedObjectCompile", () => {
  isolateTimers();
  it("paints the changed frozen raster when old owned graphic authorization is supplied", () => {
    // Given a refreshed object and its actual previously compiled occurrence.
    const project = ownedObjectRefreshFixture();
    const previous = own(fixtureDocument(project).occurrences, selectedObject);
    changeOwnedObjectSource(project);
    refreshSpatialAuthoring(project, { occurrenceId: selectedObject, externalConnections: "reject" });
    const before = structuredClone(project);
    // When the real compiler replaces its owned graphic.
    const result = compileSpatialOccurrence(project, refreshCompile, previous);
    // Then the removed lower layer is empty and the new upper cell is present, without mutating input.
    const map = own(result.maps, refreshTarget.mapId);
    expect([map.lowerTiles[53], map.upperTiles[53], map.lowerTiles[51], map.upperTiles[85]]).toEqual([-1, 404, 403, 462]);
    const beforeMap = own(before.maps, refreshTarget.mapId);
    const writes = new Set(["lower:51", "lower:52", "lower:53", "upper:53", "lower:67", "upper:68", "lower:69", "upper:83", "upper:84", "upper:85"]);
    for (let i = 0; i < map.width * map.height; i++) {
      if (!writes.has(`lower:${i}`)) expect(map.lowerTiles[i]).toBe(beforeMap.lowerTiles[i]);
      if (!writes.has(`upper:${i}`)) expect(map.upperTiles[i]).toBe(beforeMap.upperTiles[i]);
    }
    expect(map.lowerTileStacks).toEqual(beforeMap.lowerTileStacks);
    expect(map.upperTileStacks).toEqual(beforeMap.upperTileStacks);
    const ownedIds = new Set(previous.bindings.filter(isOwnedSpatialBinding).flatMap(binding => binding.eventIds));
    expect(map.events.filter(event => !ownedIds.has(event.id))).toEqual(beforeMap.events.filter(event => !ownedIds.has(event.id)));
    expect(map.events.filter(event => ownedIds.has(event.id))).toEqual(beforeMap.events.filter(event => ownedIds.has(event.id)));
    expect(own(fixtureDocument(result).occurrences, siblingObject)).toEqual(own(fixtureDocument(before).occurrences, siblingObject));
    expect(own(fixtureDocument(result).occurrences, selectedObject).snapshot.ports).toEqual(previous.snapshot.ports);
    expect(project).toEqual(before);
  });
  it("removes vacated graphic cells without enlarging ownership when a replacement shrinks", () => {
    // Given a two-by-two new source after two three-by-three objects were compiled.
    const project = ownedObjectRefreshFixture();
    const previous = own(fixtureDocument(project).occurrences, selectedObject);
    changeOwnedObjectSource(project, { ...replacementKit, width: 2, height: 2, rows: [
      { tiles: [403, 402] }, { tiles: [434, -1], upperTiles: [-1, 124] },
    ] });
    refreshSpatialAuthoring(project, { occurrenceId: selectedObject, externalConnections: "reject" });
    // When the selected graphic is compiled using its prior footprint.
    const result = compileSpatialOccurrence(project, refreshCompile, previous);
    // Then all vacated cells are empty, the reservation stays fixed, and the emitted event follows the new anchor.
    const map = own(result.maps, refreshTarget.mapId);
    expect([map.lowerTiles[53], map.lowerTiles[69], map.upperTiles[83], map.upperTiles[84], map.upperTiles[85]]).toEqual([-1, -1, -1, -1, -1]);
    const binding = own(fixtureDocument(result).occurrences, selectedObject).bindings.find(isOwnedSpatialBinding);
    if (!binding) throw new TypeError("Expected owned refreshed binding");
    expect(binding.rect).toEqual(refreshTarget.rect);
    expect(map.events.filter(event => binding.eventIds.includes(event.id)).map(event => [event.x, event.y])).toEqual([[4, 4]]);
  });
  it("retains old graphics when only the live source changes without explicit refresh", () => {
    // Given two frozen objects and a later kit edit.
    const project = ownedObjectRefreshFixture();
    const before = structuredClone(project);
    const previous = own(fixtureDocument(project).occurrences, selectedObject);
    changeOwnedObjectSource(project);
    // When the selected frozen occurrence is recompiled without refreshing its snapshot.
    const result = compileSpatialOccurrence(project, refreshCompile, previous);
    // Then neither occurrence nor either graphic adopts the edited live source.
    expect(fixtureDocument(result).occurrences).toEqual(fixtureDocument(before).occurrences);
    expect(own(result.maps, refreshTarget.mapId).lowerTiles).toEqual(own(before.maps, refreshTarget.mapId).lowerTiles);
    expect(own(result.maps, refreshTarget.mapId).upperTiles).toEqual(own(before.maps, refreshTarget.mapId).upperTiles);
  });
  it.each([
    ["old-digest", "ownership"], ["adopted-digest", "ownership"], ["target", "ownership"], ["oversized", "clipped"],
    ["atlas", "atlas"], ["new-event", "blocked"], ["old-event", "blocked"],
    ["new-stack", "blocked"], ["blocked-floor", "blocked"], ["port", "port"],
  ] as const)("rejects without mutation when replacement encounters %s", (failure, code) => {
    // Given an independently varied invalid replacement and the authentic old occurrence.
    const project = ownedObjectRefreshFixture();
    const previous = own(fixtureDocument(project).occurrences, selectedObject);
    const map = own(project.maps, refreshTarget.mapId);
    let target = refreshTarget;
    changeOwnedObjectSource(project);
    switch (failure) {
      case "old-digest": map.lowerTiles[51] = 124; break;
      case "adopted-digest": {
        map.lowerTiles[51] = 124;
        const document = fixtureDocument(project);
        project.spatialAuthoring = { ...document, occurrences: { ...document.occurrences, [selectedObject]: { ...previous,
          bindings: previous.bindings.map(binding => isOwnedSpatialBinding(binding)
            ? { ...binding, contentDigest: spatialRasterDigest(map, binding) } : binding),
        } } };
        break;
      }
      case "target": target = { ...target, rect: { ...target.rect, width: 5 } }; break;
      case "oversized": changeOwnedObjectSource(project, { ...replacementKit, width: 5,
        rows: replacementKit.rows.map(row => ({ tiles: [...row.tiles, -1, 124],
          upperTiles: [...(row.upperTiles ?? [-1, -1, -1]), -1, -1] })) }); break;
      case "atlas": {
        const document = fixtureDocument(project);
        const source = own(document.library.objects, "hearth-design");
        const atlas = own(project.tilesets, "easyrpg_chipset_combined_town");
        atlas.structureKits = [...(atlas.structureKits ?? []), replacementKit];
        project.spatialAuthoring = { ...document, library: { ...document.library, objects: { ...document.library.objects,
          [source.id]: { ...source, graphic: { ...source.graphic, tilesetId: atlas.id } } } } };
        break;
      }
      case "new-event": case "old-event": {
        const event = map.events[0];
        if (!event) throw new TypeError("Expected compiled event");
        map.events.push({ ...structuredClone(event), id: "blocking-unmanaged-event", x: failure === "old-event" ? 3 : 6, y: 3 });
        if (failure === "new-event") changeOwnedObjectSource(project, { ...replacementKit, width: 4,
          rows: replacementKit.rows.map(row => ({ tiles: [...row.tiles, 124], upperTiles: [...(row.upperTiles ?? [-1, -1, -1]), -1] })) });
        break;
      }
      case "new-stack": {
        // The new cell at (6,5) contains only pre-existing stacks, not an event or upper tile.
        changeOwnedObjectSource(project, { ...replacementKit, width: 4,
          rows: replacementKit.rows.map((row, y) => ({ tiles: [...row.tiles, y === 2 ? 124 : -1],
            upperTiles: [...(row.upperTiles ?? [-1, -1, -1]), -1] })) });
        break;
      }
      case "blocked-floor": {
        // The new cell at (6,3) has no stack, upper tile or event. Only its live passage blocks stamping.
        changeOwnedObjectSource(project, { ...replacementKit, width: 4,
          rows: replacementKit.rows.map((row, y) => ({ tiles: [...row.tiles, y === 0 ? 124 : -1],
            upperTiles: [...(row.upperTiles ?? [-1, -1, -1]), -1] })) });
        const atlas = own(project.tilesets, interiorAtlas);
        const floor = map.lowerTiles[54];
        atlas.passability[floor] = { up: false, down: false, left: false, right: false };
        break;
      }
      case "port": {
        const document = fixtureDocument(project);
        const source = own(document.library.objects, "hearth-design");
        project.spatialAuthoring = { ...document, library: { ...document.library, objects: { ...document.library.objects,
          [source.id]: { ...source, anchors: [{ id: spatialId("approach"), name: "Approach", x: 0, y: 0 }] } } } };
        break;
      }
      default: assertNever(failure);
    }
    refreshSpatialAuthoring(project, { occurrenceId: selectedObject, externalConnections: "reject" });
    const before = structuredClone(project);
    // When the compiler attempts the replacement.
    const compile = () => compileSpatialOccurrence(project, { ...refreshCompile, target }, previous);
    // Then it reports the precise guard without changing any input.
    expect(compile).toThrowError(expect.objectContaining({ code }));
    expect(project).toEqual(before);
  });
});

describe("spatialPlaceCompiler", () => {
  isolateTimers();
  describe("nested place compiler", () => {
    it("materializes the actual square and nested rooms when a village contains an inn", () => {
      // Given: authored square coordinates and three actual interior children.
      const input = placeCompilerFixture();
      const squareId = placeChild(input, placeRoot, "square");
      const children = [squareId, ...stairFloors(input).map(floor => floor.roomId)];
      // When: the existing pure compiler seam receives the parent occurrence.
      const proposal = compileSpatialOccurrence(input, { occurrenceId: placeRoot });
      // Then: every actual space has real nonempty raster output from its own atlas.
      for (const id of children) {
        const occurrence = own(fixtureDocument(proposal).occurrences, id);
        const binding = occurrence.bindings[0];
        expect(binding).toBeDefined();
        if (!binding) throw new TypeError("Missing compiled child binding");
        const map = own(proposal.maps, binding.mapId);
        expect(map.tilesetId).toBe(own(occurrence.snapshot.library.spaces, occurrence.source.id).tilesetId);
        expect(map.lowerTiles.some(tile => tile >= 0)).toBe(true);
      }
    });

    it("preserves declared stair roundtrips when actual children occupy all three floors", () => {
      // Given: explicit concrete object-port links, not containment-derived portals.
      const input = withStairConnections(placeCompilerFixture());
      // When: compile the nested settlement.
      const proposal = compileSpatialOccurrence(input, { occurrenceId: placeRoot });
      // Then: both directions have real transfer commands to the associated passable port.
      const document = fixtureDocument(proposal);
      for (const link of document.connections) for (const [source, target] of [[link.from, link.to], [link.to, link.from]] as const) {
        const from = own(document.occurrences, source.occurrenceId).bindings.find(binding => binding.ports.some(port => port.portId === source.portId));
        const to = own(document.occurrences, target.occurrenceId).bindings.find(binding => binding.ports.some(port => port.portId === target.portId));
        if (!from || !to) throw new TypeError("Missing compiled stair endpoint");
        const port = to.ports.find(port => port.portId === target.portId);
        if (!port) throw new TypeError("Missing compiled stair port");
        expect(isPassableLanding(proposal, own(proposal.maps, to.mapId), port.x, port.y)).toBe(true);
        const commands = own(proposal.maps, from.mapId).events.flatMap(event => [...event.commands, ...(event.pages ?? []).flatMap(page => page.commands)]);
        expect(commands).toContainEqual(expect.objectContaining({ kind: "transfer", mapId: to.mapId, x: port.x, y: port.y }));
      }
    });

    it("rejects the concrete invalid landing when a declared stair port lands on a blocked hearth", () => {
      // Given: a persisted named stair landing translated onto the frozen hearth.
      const fixture = withStairConnections(placeCompilerFixture());
      const floor = stairFloors(fixture)[0];
      if (!floor) throw new TypeError("Missing fixture floor");
      const stair = requireOccurrenceAssociations(own(fixtureDocument(fixture).occurrences, floor.stairId));
      const input = replaceOccurrence(fixture, { ...stair, snapshot: { ...stair.snapshot,
        ports: stair.snapshot.ports.map(port => ({ ...port, x: -7, y: -7 })) } });
      // When / Then: fail for the landing itself, not unsupported place compilation.
      expect(() => compileSpatialOccurrence(input, { occurrenceId: placeRoot })).toThrowError(expect.objectContaining({ code: "port" }));
    });

    it("creates no transfer when containment has no declared connection", () => {
      // Given: nested floors with stairs as frozen passable raster only.
      const input = placeCompilerFixture();
      // When: compile without any navigation link.
      const proposal = compileSpatialOccurrence(input, { occurrenceId: placeRoot });
      // Then: compilation does not invent transfer commands between contained records.
      const commands = Object.values(proposal.maps).filter(map => !Object.hasOwn(input.maps, map.id))
        .flatMap(map => map.events.flatMap(event => [...event.commands, ...(event.pages ?? []).flatMap(page => page.commands)]));
      expect(commands.filter(command => command.kind === "transfer")).toEqual([]);
    });
  });
});

describe("spatialPlaceComposedFloors", () => {
  isolateTimers();
  it("keeps a painted room, nested projections and two-way floor transfers on separate maps", () => {
    const { compiled, first, second } = composedPlaceFloorsFixture();
    const occurrences = Object.values(compiled.spatialAuthoring!.occurrences);
    const room = occurrences.find(o => o.parentId === "painted-floors" && o.source.id === first.id)!;
    const upstairs = occurrences.find(o => o.parentId === "painted-floors" && o.source.id === second.id)!;
    expect(room.bindings[0].mapId).not.toBe(upstairs.bindings[0].mapId);
    const map = compiled.maps[room.bindings[0].mapId];
    expect(map.lowerTiles[5 * map.width + 3]).toBe(240);
    const bed = occurrences.find(o => o.parentId === room.id && o.source.id === "bed-design")!;
    expect(bed.bindings[0]).toMatchObject({ kind: "projection", mapId: map.id, rect: { x: 5, y: 6 } });
    const links = compiled.mapConnections!.filter(link => [room.bindings[0].mapId, upstairs.bindings[0].mapId].includes(link.from.mapId));
    expect(links).toHaveLength(2);
    expect(links.map(link => link.to.mapId).sort()).toEqual([room.bindings[0].mapId, upstairs.bindings[0].mapId].sort());
    const read = deserialize(serialize(compiled));
    expect(compileSpatialOccurrence(read, { occurrenceId: "painted-floors" }).maps).toEqual(read.maps);
    read.maps[map.id].lowerTiles[5 * map.width + 3] = 0;
    expect(() => compileSpatialOccurrence(read, { occurrenceId: "painted-floors" })).toThrow("ownership");
  }, 60_000);
  it("wraps a directly painted place without changing its original design", () => {
    const project = mixedFixture();
    const before = serialize(project);
    const wrapped = preparePlaceContainer(project, { kind: "place", id: spatialId("inn") });
    expect(serialize(project)).toBe(before);
    expect(wrapped.project.spatialAuthoring!.library.places.inn).toEqual(project.spatialAuthoring!.library.places.inn);
    expect(wrapped.project.spatialAuthoring!.library.places[wrapped.source.id].children[0]).toMatchObject({ source: { kind: "place", id: "inn" }, level: 1 });
    const document = instantiateSpatialDesign(wrapped.project.spatialAuthoring, wrapped.project, { source: wrapped.source, rootId: "wrapped-painted-place", x: 0, y: 0, level: 0, seed: 7, generatorVersion: "wrapped-place-v1" });
    const compiled = compileSpatialOccurrence({ ...wrapped.project, spatialAuthoring: document }, { occurrenceId: "wrapped-painted-place" });
    const child = Object.values(compiled.spatialAuthoring!.occurrences).find(o => o.parentId === "wrapped-painted-place")!;
    expect(compiled.maps[child.bindings[0].mapId]).toMatchObject({ width: 40, height: 30 });
    expect(compileSpatialOccurrence(deserialize(serialize(compiled)), { occurrenceId: "wrapped-painted-place" }).maps).toEqual(compiled.maps);
  }, 60_000);
});
