import { describe, expect, it } from "vitest";
import { compileSpatialOccurrence } from "../src/editor/spatial/compileSpatialOccurrence";
import { isPassableLanding } from "../src/project/collision";
import { own, requireOccurrenceAssociations } from "../src/project/spatial/domain";
import { fixtureDocument, replaceOccurrence } from "./support/spatialSpaceCompilerFixture";
import { placeChild, placeCompilerFixture, placeRoot, stairFloors, withStairConnections } from "./support/spatialPlaceCompilerFixture";

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
