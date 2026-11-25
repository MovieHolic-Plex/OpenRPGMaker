import { describe, expect, it } from "vitest";
import { compileSpatialOccurrence } from "../src/editor/spatial/compileSpatialOccurrence";
import { deserialize, serialize } from "../src/project/io";
import { isOwnedSpatialBinding } from "../src/project/spatial/bindings";
import { own, spatialId } from "../src/project/spatial/domain";
import type { RegionDesign } from "../src/project/spatial/types";
import { editedRegion, editedWorld } from "./support/spatialGeographyEdits";
import { geographyFixture, geographyRoot } from "./support/spatialGeographyFixture";
import { fixtureDocument, reinstantiateSpace, spaceCompilerFixture, spaceRoot, interiorAtlas } from "./support/spatialSpaceCompilerFixture";
import { snapshotGraphic } from "../src/project/spatial/snapshotRaster";
import { isolateTimers } from "./mergedTeardown";

describe("spatialGeographySafety", () => {
  isolateTimers();
  const invalidRegions: readonly { readonly name: string; readonly update: (region: RegionDesign) => RegionDesign }[] = [
    { name: "atlas", update: region => ({ ...region, terrain: { ...region.terrain, tilesetId: "easyrpg_chipset_combined_town" } }) },
    { name: "material", update: region => ({ ...region, terrain: { ...region.terrain, floor: "lava" } }) },
    { name: "area bounds", update: region => ({ ...region, terrain: { ...region.terrain,
      areas: [{ kind: "rect", x: -1, y: 1, width: 5, height: 5, material: "water" }] } }) },
    { name: "marker bounds", update: region => ({ ...region, places: region.places.map(place => ({ ...place, x: 99 })) }) },
    { name: "marker level", update: region => ({ ...region, places: region.places.map(place => ({ ...place, level: 1 })) }) },
    { name: "one-way", update: region => ({ ...region, routes: region.routes.map(route => ({ ...route, bidirectional: false })) }) },
    { name: "route bounds", update: region => ({ ...region, routes: region.routes.map(route => ({ ...route,
      points: [{ x: 5, y: 8 }, { x: 5, y: -1 }, { x: 25, y: -1 }, { x: 25, y: 8 }] })) }) },
    { name: "route endpoint", update: region => ({ ...region, routes: region.routes.map(route => ({ ...route, points: [{ x: 4, y: 8 }, { x: 25, y: 8 }] })) }) },
    { name: "blocked route", update: region => ({ ...region, terrain: { ...region.terrain,
      areas: [{ kind: "rect", x: 12, y: 7, width: 3, height: 3, material: "forest" }] } }) },
    { name: "unreachable port", update: region => ({ ...region, ports: [...region.ports, { id: spatialId("isolated"), name: "Isolated", x: 1, y: 1 }],
      terrain: { ...region.terrain, areas: [{ kind: "rect", x: 0, y: 3, width: 32, height: 1, material: "forest" }] } }) },
  ];
  describe("geography acceptance safety", () => {
    it.each(invalidRegions)("rejects before caller mutation when $name is invalid", ({ update }) => {
      // Given: structurally valid frozen input with one unsupported geography feature.
      const input = geographyFixture("region");
      const original = fixtureDocument(input);
      const root = own(original.occurrences, geographyRoot);
      const region = update(own(original.library.regions, root.source.id));
      const library = { ...original.library, regions: { [region.id]: region } };
      input.spatialAuthoring = { ...original, library,
        connections: original.connections.map(link => ({ ...link,
          bidirectional: region.routes.find(route => route.id === link.overviewRoute?.localConnectionId)?.bidirectional ?? link.bidirectional })),
        occurrences: Object.fromEntries(Object.values(original.occurrences).map(child => {
          const slot = child.parentId === root.id ? region.places.find(slot => slot.id === child.parentSlot?.slotId) : undefined;
          return [child.id, child.id === root.id ? { ...child, snapshot: { ...child.snapshot, library } }
            : slot ? { ...child, x: slot.x, y: slot.y, level: slot.level } : child];
        })) };
      const before = serialize(input);
      // When / Then: the public boundary refuses the proposal and preserves the caller.
      expect(() => compileSpatialOccurrence(input, { occurrenceId: geographyRoot })).toThrow();
      expect(serialize(input)).toBe(before);
    });

    it("creates no portal when children have containment but no entry intent", () => {
      // Given: children exist but no authored routes address their ports.
      const input = editedRegion(region => ({ ...region, routes: [] }));
      // When: compile contained maps.
      const output = compileSpatialOccurrence(input, { occurrenceId: geographyRoot });
      // Then: compilation does not infer portals from ancestry.
      const binding = own(fixtureDocument(output).occurrences, geographyRoot).bindings.find(isOwnedSpatialBinding);
      expect(binding?.overviewEntries).toBeUndefined();
      expect(output.mapConnections ?? []).toEqual([]);
    });

    it("honors only the declared world entry when no crossing is authored", () => {
      // Given: the selector deliberately differs from the first child fallback.
      const input = editedWorld(world => ({ ...world, connections: [], entryPort: { childId: spatialId("second"), portId: spatialId("entry") } }));
      // When: compile the world.
      const output = compileSpatialOccurrence(input, { occurrenceId: geographyRoot });
      // Then: exactly that child is enterable from the world overview.
      const document = fixtureDocument(output);
      const binding = own(document.occurrences, geographyRoot).bindings.find(isOwnedSpatialBinding);
      const selected = Object.values(document.occurrences).find(child => child.parentId === geographyRoot && child.parentSlot?.slotId === "second");
      expect(binding?.overviewEntries?.map(entry => entry.target.occurrenceId)).toEqual([selected?.id]);
    });

    it("recompiles identically when the loaded geography has unchanged owned content", () => {
      // Given: a canonical compiled/reloaded region with distinct unmanaged map metadata.
      const input = deserialize(serialize(compileSpatialOccurrence(geographyFixture("region"), { occurrenceId: geographyRoot })));
      const before = serialize(input);
      // When: compile the same frozen occurrence again.
      const output = compileSpatialOccurrence(input, { occurrenceId: geographyRoot });
      // Then: exact identity, raster, associations and original caller remain stable.
      expect(output).toEqual(input);
      expect(serialize(input)).toBe(before);
    });

    it("rejects manual raster edits when recompile would overwrite owned content", () => {
      // Given: a user has painted an owned overview cell after compilation.
      const input = compileSpatialOccurrence(geographyFixture("region"), { occurrenceId: geographyRoot });
      const binding = own(fixtureDocument(input).occurrences, geographyRoot).bindings.find(isOwnedSpatialBinding);
      if (!binding) throw new TypeError("Missing owner");
      own(input.maps, binding.mapId).lowerTiles[0] = 190;
      const before = serialize(input);
      // When / Then: reject instead of adopting the changed raster digest.
      expect(() => compileSpatialOccurrence(input, { occurrenceId: geographyRoot })).toThrowError(/ownership/);
      expect(serialize(input)).toBe(before);
    });
  });
});

describe("spatialInteriorVocabulary", () => {
  isolateTimers();
  function room(kit: string, chips: string[] = []) {
    const project = structuredClone(spaceCompilerFixture());
    fixtureDocument(project).library.objects["wall-prop"] = {
      id: spatialId("wall-prop"),
      name: "Wall prop",
      revision: 1,
      tags: [],
      provenance: { origin: "user" },
      graphic: { tilesetId: interiorAtlas, kitId: kit },
      anchors: [],
      chips,
    };
    return reinstantiateSpace(project, (s) => ({
      ...s,
      objectSlots: [
        {
          id: spatialId("prop"),
          objectDesignId: spatialId("wall-prop"),
          quantity: 1,
          required: true,
          placement: { mode: "auto" },
        },
      ],
    }));
  }
  function compiled(project: ReturnType<typeof room>) {
    const result = compileSpatialOccurrence(project, { occurrenceId: spaceRoot });
    const root = own(fixtureDocument(result).occurrences, spaceRoot);
    return { result, map: result.maps[root.bindings[0]!.mapId]! };
  }
  describe("frozen interior placement vocabulary", () => {
    it("freezes snap/role alongside pixels and survives project save/load", () => {
      const project = room("bed_v");
      const child = Object.values(fixtureDocument(project).occurrences).find(
        (o) => o.kind === "object",
      )!;
      expect(child.snapshot.kitCells["wall-prop"]!.interior).toMatchObject({
        id: "bed_v",
        snap: "wall-north",
        role: "bed",
      });
      const { map } = compiled(deserialize(serialize(project)));
      expect(map.upperTiles.slice(4 * map.width, 5 * map.width)).toContain(324);
    });
    it("freezes effective upper wall pixels and preserves the wall under a window", () => {
      const project = room("window", ["wall"]);
      const { map } = compiled(project);
      const i = map.upperTiles.findIndex(
        (t) =>
          t ===
          snapshotGraphic(project, { tilesetId: interiorAtlas, kitId: "window" })
            .cells[0]!.tile,
      );
      expect(Math.floor(i / map.width)).toBe(2);
      expect([74, 75, 76, 77]).toContain(map.lowerTiles[i]);
    });
    it("keeps wall investigation reachable after compiling and saving", () => {
      const { result, map } = compiled(room("religious", ["wall", "event"]));
      expect(map.events).toHaveLength(1);
      expect(map.events[0]!.y).toBe(4);
      expect(compiled(deserialize(serialize(result))).map).toEqual(map);
    });
    it("does not consult edited live kit metadata when recompiling a frozen occurrence", () => {
      const project = room("bed_v");
      const before = compiled(project).map;
      const changed = structuredClone(project);
      changed.tilesets[interiorAtlas]!.structureKits!.push({
        id: "bed_v",
        kind: "section",
        width: 1,
        height: 1,
        rows: [{ tiles: [72] }],
        ai: { description: "changed", placementRules: "", snap: "floor" },
      });
      expect(compiled(changed).map).toEqual(before);
    });
    it("keeps legacy snapshots without metadata at their original floor placement", () => {
      const project = structuredClone(room("bed_v"));
      for (const o of Object.values(fixtureDocument(project).occurrences))
        for (const raster of Object.values(o.snapshot.kitCells))
          delete (raster as { interior?: unknown }).interior;
      const before = compiled(project).map;
      expect(
        before.upperTiles.slice(4 * before.width, 5 * before.width),
      ).not.toContain(324);
      expect(compiled(deserialize(serialize(project))).map).toEqual(before);
    });
    it("preserves explicit fixed investigation coordinates", () => {
      const project = reinstantiateSpace(
        room("religious", ["wall", "event"]),
        (s) => ({
          ...s,
          objectSlots: s.objectSlots.map((slot) => ({
            ...slot,
            placement: { mode: "fixed", x: 1, y: 1 },
          })),
        }),
      );
      expect(compiled(project).map.events[0]).toMatchObject({ x: 3, y: 5 });
    });
    it("does not reinterpret outdoor kit layers as interior wall furniture", () => {
      const project = structuredClone(room("bed_v"));
      const atlas = "easyrpg_chipset_combined_town";
      (project.tilesets[atlas]!.structureKits ??= []).push({
        id: "outdoor-wall",
        kind: "section",
        width: 1,
        height: 1,
        rows: [{ tiles: [243] }],
        ai: { description: "", placementRules: "", snap: "wall-any" },
      });
      const raster = snapshotGraphic(project, {
        tilesetId: atlas,
        kitId: "outdoor-wall",
      });
      expect(raster.interior).toBeUndefined();
      expect(raster.cells).toEqual([{ x: 0, y: 0, layer: "lower", tile: 243 }]);
    });
  });
  it.each(['stone-brick','gold-brick'] as const)('keeps automatic wall props on %s faces after retint',wall=>{
   const project=reinstantiateSpace(room('religious',['wall','event']),s=>({...s,wall}));
   const {map}=compiled(deserialize(serialize(project)));
   const cell=map.upperTiles.findIndex(t=>t===59);
   expect(cell).toBeGreaterThanOrEqual(0);
   expect(wall==='stone-brick'?[134,135,136]:[314,315,316]).toContain(map.lowerTiles[cell]);
   expect(map.events[0]!.y).toBe(4);
  });
});
