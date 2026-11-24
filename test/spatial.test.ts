import { describe, expect, it, beforeAll } from "vitest";
import { deserialize, serialize } from "@/project/io";
import { checkedDocument, spatialId, own } from "@/project/spatial/domain";
import { instantiateSpatialDesign } from "@/project/spatial/instances";
import { compileSpatialOccurrence } from "@/editor/spatial/compileSpatialOccurrence";
import { placeCompilerFixture } from "./support/spatialConnectionSceneFixture";
import { isPassableLanding } from "../src/project/collision";
import { isOwnedSpatialBinding } from "../src/project/spatial/bindings";
import { geographyFixture, geographyRoot } from "./support/spatialGeographyFixture";
import { fixtureDocument } from "./support/spatialSpaceCompilerFixture";
import { editedRegion } from "./support/spatialGeographyEdits";
import type { Project } from "../src/project/types";
import { geographyRecipeFixture } from "./support/spatialGeographyRecipes";
import { isolateTimers } from "./mergedTeardown";

describe("spatialFacilityLevels", () => {
  isolateTimers();
  function projectWithFloor(level: number, outdoor = false) {
    const project = placeCompilerFixture();
    const document = project.spatialAuthoring!;
    const inn = document.library.places["nested-inn-design"]!;
    project.spatialAuthoring = { ...document, occurrences: {}, rootOccurrenceIds: [], connections: [], library: {
      ...document.library, places: { ...document.library.places, [inn.id]: { ...inn, children: [...inn.children, {
        id: spatialId("new-floor"), level, x: 0, y: 0,
        source: { kind: "space", id: spatialId(outdoor ? "nested-square-design" : "room-design") },
      }] } },
    } };
    return project;
  }
  describe("facilities with yards and four floors", () => {
    it("compiles floor four and preserves its frozen source through ordinary save/load", () => {
      const project = projectWithFloor(4);
      const document = checkedDocument(project.spatialAuthoring, project);
      project.spatialAuthoring = instantiateSpatialDesign(document, project, {
        source: { kind: "place", id: spatialId("nested-inn-design") }, rootId: spatialId("four-floor-house"),
        x: 0, y: 0, level: 0, seed: 7, generatorVersion: "facility-floor-contract",
      });
      const compiled = compileSpatialOccurrence(project, { occurrenceId: "four-floor-house" });
      const reloaded = deserialize(serialize(compiled));
      expect(reloaded.spatialAuthoring).toEqual(compiled.spatialAuthoring);
      const fourth = Object.values(reloaded.spatialAuthoring!.occurrences).find(value => value.parentId === "four-floor-house" && value.level === 4);
      expect(fourth?.bindings[0]?.mapId).toBeTruthy();
      expect(reloaded.maps[fourth!.bindings[0]!.mapId]).toBeDefined();
    });

    it("allows a ground-level outdoor yard without accepting ground-level indoor rooms", () => {
      const yard = projectWithFloor(0, true);
      expect(() => deserialize(serialize(yard))).not.toThrow();
      const room = projectWithFloor(0);
      expect(() => checkedDocument(room.spatialAuthoring, room)).toThrow(/facility supports floors/);
    });

    it.each([-1, 5])("rejects unsupported floor %s instead of silently clipping", level => {
      const project = projectWithFloor(level);
      expect(() => checkedDocument(project.spatialAuthoring, project)).toThrow(/facility supports floors/);
    });
  });
});

describe("spatialGeographyCompiler", () => {
  isolateTimers();
  describe("bounded geography public compiler", () => {
    it.each(["region", "world"] as const)("emits traversable overview entries when a %s has positioned children", kind => {
      // Given: validated frozen geography containing the actual task9 nested-place fixture.
      const input = geographyFixture(kind);
      const before = serialize(input);
      // When: the existing public compiler receives the geographic root.
      const output = compileSpatialOccurrence(input, { occurrenceId: geographyRoot });
      // Then: real overview tiles and transfers exist, not name/count-only results.
      const root = own(fixtureDocument(output).occurrences, geographyRoot);
      const binding = root.bindings.find(isOwnedSpatialBinding);
      expect(binding).toBeDefined();
      if (!binding) throw new TypeError("Missing geographic raster owner");
      const overview = own(output.maps, binding.mapId);
      expect(overview.tilesetId).toBe("worldmap_selected");
      expect(overview.lowerTiles.some(tile => tile >= 0)).toBe(true);
      const transfers = output.mapConnections?.filter(connection => connection.from.mapId === overview.id);
      expect(transfers?.length).toBeGreaterThan(0);
      for (const connection of transfers ?? []) {
        expect(isPassableLanding(output, own(output.maps, connection.to.mapId), connection.to.x, connection.to.y)).toBe(true);
      }
      expect(serialize(input)).toBe(before);
    });
  });
});

describe("spatialGeographyOwnership", () => {
  isolateTimers();
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
});

describe("spatialGeographyRepeat", () => {
  isolateTimers();
  let loaded: Project;
  beforeAll(() => {
    loaded = deserialize(serialize(compileSpatialOccurrence(geographyRecipeFixture("lake-kingdom"), { occurrenceId: geographyRoot })));
  });
  it("retains exact child ownership when a connected three-region world is recompiled", () => {
    // Given: the loaded real world, including generated overview return events on region maps.
    const input = loaded;
    // When: regenerate the complete write set.
    const repeated = compileSpatialOccurrence(input, { occurrenceId: geographyRoot });
    // Then: compare by top-level contract to retain a useful bounded failure diagnostic.
    expect(repeated.maps).toEqual(input.maps);
    expect(repeated.mapConnections).toEqual(input.mapConnections);
    expect(repeated.spatialAuthoring).toEqual(input.spatialAuthoring);
    expect(repeated).toEqual(input);
  });
});
