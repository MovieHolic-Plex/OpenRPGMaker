import { describe, expect, it } from "vitest";
import { compileSpatialOccurrence } from "../src/editor/spatial/compileSpatialOccurrence";
import { deserialize, serialize } from "../src/project/io";
import { isOwnedSpatialBinding } from "../src/project/spatial/bindings";
import { own } from "../src/project/spatial/domain";
import { geographyFixture, geographyRoot } from "./support/spatialGeographyFixture";
import { fixtureDocument } from "./support/spatialSpaceCompilerFixture";
import { editedRegion } from "./support/spatialGeographyEdits";

describe("geography scoped ownership", () => {
  it("rejects replacement when existing ownership uses a different map identity", () => {
    // Given: valid earlier ownership on a renamed map, without transfer commands affecting its digest.
    const original = compileSpatialOccurrence(editedRegion(region => ({ ...region, routes: [] })), { occurrenceId: geographyRoot });
    const binding = own(fixtureDocument(original).occurrences, geographyRoot).bindings.find(isOwnedSpatialBinding);
    if (!binding) throw new TypeError("Missing overview owner");
    const input = deserialize(serialize(original).replaceAll(JSON.stringify(binding.mapId), JSON.stringify("earlier-overview-map")));
    const before = serialize(input);
    // When / Then: reject unsupported ownership migration, rather than orphan the old raster.
    expect(() => compileSpatialOccurrence(input, { occurrenceId: geographyRoot })).toThrowError(/ownership/);
    expect(serialize(input)).toBe(before);
  });

  it("preserves unmanaged events when another map reuses a generated event ID", () => {
    // Given: event IDs are map-local, and an unrelated map owns the same spelling.
    const input = compileSpatialOccurrence(geographyFixture("region"), { occurrenceId: geographyRoot });
    const binding = own(fixtureDocument(input).occurrences, geographyRoot).bindings.find(isOwnedSpatialBinding);
    if (!binding) throw new TypeError("Missing overview owner");
    const event = own(input.maps, binding.mapId).events[0];
    if (!event) throw new TypeError("Missing generated event");
    const unmanaged = own(input.maps, input.startMapId);
    unmanaged.events.push({ ...structuredClone(event), x: 1, y: 1 });
    const before = structuredClone(unmanaged);
    // When: regenerate geography only.
    const output = compileSpatialOccurrence(input, { occurrenceId: geographyRoot });
    // Then: equal IDs in unrelated map scope grant no cleanup authority.
    expect(own(output.maps, unmanaged.id)).toEqual(before);
  });

  it("preserves manual overview events and shared atlas metadata when regenerated", () => {
    // Given: manual event content is outside generated event ownership.
    const input = compileSpatialOccurrence(geographyFixture("region"), { occurrenceId: geographyRoot });
    const binding = own(fixtureDocument(input).occurrences, geographyRoot).bindings.find(isOwnedSpatialBinding);
    if (!binding) throw new TypeError("Missing overview owner");
    const map = own(input.maps, binding.mapId);
    const event = map.events[0];
    if (!event) throw new TypeError("Missing generated event");
    const manual = { ...structuredClone(event), id: "manual-overview-event", x: 1, y: 1 };
    map.events.push(manual);
    const atlas = structuredClone(input.tilesets);
    // When: regenerate the unchanged owned pixels and generated events.
    const output = compileSpatialOccurrence(input, { occurrenceId: geographyRoot });
    // Then: manual content remains unmanaged and shared passage metadata is untouched.
    expect(own(output.maps, map.id).events.find(event => event.id === manual.id)).toEqual(manual);
    expect(output.tilesets).toEqual(atlas);
    expect(own(fixtureDocument(output).occurrences, geographyRoot).bindings.find(isOwnedSpatialBinding)?.eventIds).not.toContain(manual.id);
  });

  it("rejects partial child recompilation when its return pair belongs to the overview", () => {
    // Given: a complete entry/return pair crosses the requested child write set.
    const input = compileSpatialOccurrence(geographyFixture("region"), { occurrenceId: geographyRoot });
    const child = Object.values(fixtureDocument(input).occurrences).find(child => child.parentId === geographyRoot);
    if (!child) throw new TypeError("Missing child");
    const before = serialize(input);
    // When / Then: shared lifecycle API refuses a partial rewrite without changing data.
    expect(() => compileSpatialOccurrence(input, { occurrenceId: child.id })).toThrowError(/ownership/);
    expect(serialize(input)).toBe(before);
  });
});
