import { describe, expect, it, beforeAll, afterEach } from "vitest";
import { deserialize, serialize } from "@/project/io";
import { checkedDocument, spatialId, own } from "@/project/spatial/domain";
import { instantiateSpatialDesign } from "@/project/spatial/instances";
import { compileSpatialOccurrence } from "@/editor/spatial/compileSpatialOccurrence";
import { placeCompilerFixture } from "./support/spatialConnectionSceneFixture";
import { isPassableLanding, canMove } from "../src/project/collision";
import { isOwnedSpatialBinding } from "../src/project/spatial/bindings";
import { geographyFixture, geographyRoot } from "./support/spatialGeographyFixture";
import { fixtureDocument, reinstantiateSpace, spaceCompilerFixture, spaceRoot, interiorAtlas, spaceDesign } from "./support/spatialSpaceCompilerFixture";
import { editedRegion, editedWorld } from "./support/spatialGeographyEdits";
import type { Project } from "../src/project/types";
import { geographyRecipeFixture, regionRecipes, worldRecipes } from "./support/spatialGeographyRecipes";
import { isolateTimers } from "./mergedTeardown";
import { WORLD_STRUCTURE_RULES } from "../src/project/defaults/worldStructureRules";
import type { RegionDesign } from "../src/project/spatial/types";
import { snapshotGraphic } from "../src/project/spatial/snapshotRaster";
import { getMapEditHistoryEntries, redoMapEdit, undoMapEdit } from "../src/editor/mapEditHistory";
import { applyAuthoringPreview, bindSpatialAuthoringControllerFactory, editAuthoringDraft, hasAuthoringPreview, previewAuthoringDraft, visibleAuthoringProject } from "../src/editor/panels/spatialAuthoringAccess";
import { spatialSession } from "../src/editor/panels/spatialAuthoringSession";
import { previewSpatialSourceBuild, spatialBuildProposal } from "../src/editor/panels/spatialBuildActions";
import { store } from "../src/project/store";
import { authoringValue } from "./support/spatialAuthoringFixture";
import { manualBuildFixture } from "./support/spatialManualBuildFixture";

describe("spatial", () => {
  isolateTimers();
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
});

describe("spatialGeographyRecipes", () => {
  isolateTimers();
  describe("real geography contract recipes", () => {
    it.each([...regionRecipes.map(recipe => recipe.id), ...worldRecipes])("compiles exact terrain and entry identities when %s is instantiated", recipeId => {
      // Given: six differentiated authored rasters and two exact three-region chains.
      const input = geographyRecipeFixture(recipeId);
      const before = serialize(input);
      // When: compile through the existing public seam.
      const output = compileSpatialOccurrence(input, { occurrenceId: geographyRoot });
      // Then: actual maps, pair ownership and canonical reload survive.
      const document = fixtureDocument(output);
      const owner = own(document.occurrences, geographyRoot);
      const binding = owner.bindings.find(isOwnedSpatialBinding);
      if (!binding) throw new TypeError("Missing geographic owner");
      const map = own(output.maps, binding.mapId);
      expect([map.width, map.height]).toEqual(owner.kind === "world" ? [96, 64] : [128, 96]);
      expect(binding.overviewEntries?.map(entry => entry.target.occurrenceId)).toEqual(Object.values(document.occurrences)
        .filter(child => child.parentId === owner.id).map(child => child.id));
      expect(serialize(deserialize(serialize(output)))).toBe(serialize(output));
      expect(serialize(input)).toBe(before);
    });

    it("uses a real directional bridge when an authored route crosses lake water", () => {
      // Given: a full-height water strip with an explicit east-west crossing.
      const input = geographyRecipeFixture("lake-country");
      // When: compile the region.
      const output = compileSpatialOccurrence(input, { occurrenceId: geographyRoot });
      // Then: deck/support remain real World primitives, not water erased to dirt.
      const binding = own(fixtureDocument(output).occurrences, geographyRoot).bindings.find(isOwnedSpatialBinding);
      if (!binding) throw new TypeError("Missing owner");
      const map = own(output.maps, binding.mapId);
      expect(map.upperTiles[40 * map.width + 55]).toBe(WORLD_STRUCTURE_RULES.bridge.horizontal.deck);
      expect(map.upperTiles[41 * map.width + 55]).toBe(WORLD_STRUCTURE_RULES.bridge.horizontal.support);
      expect(canMove(output, map, 54, 40, 55, 40)).toBe(true);
      expect(canMove(output, map, 55, 40, 55, 41)).toBe(false);
    });

    it("retains stair passage when the explicit high-pass route climbs the mountain", () => {
      // Given: a bounded authored mountain rectangle and a route through its central stair.
      const input = geographyRecipeFixture("high-pass");
      // When: compile the region.
      const output = compileSpatialOccurrence(input, { occurrenceId: geographyRoot });
      // Then: the primitive staircase survives path painting.
      const binding = own(fixtureDocument(output).occurrences, geographyRoot).bindings.find(isOwnedSpatialBinding);
      if (!binding) throw new TypeError("Missing owner");
      const map = own(output.maps, binding.mapId);
      expect(map.lowerTiles[35 * map.width + 55]).toBe(WORLD_STRUCTURE_RULES.mountain.stair);
      expect(canMove(output, map, 55, 36, 55, 35)).toBe(true);
      expect(canMove(output, map, 55, 35, 54, 35)).toBe(false);
    });
  });
});

describe("spatialGeographySafety", () => {
  isolateTimers();
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
});

describe("spatialManualBuild", () => {
  isolateTimers();
  afterEach(() => bindSpatialAuthoringControllerFactory(null));
  describe("manual source build through the real controller", () => {
    it("displays exact raster without adoption when an explicit object target is built", () => {
      // Given
      const { project, target } = manualBuildFixture();
      const rootId = spatialId("manual-object-opaque-19");
      const input = { source: { kind: "object", id: spatialId("hearth-design") }, rootId, seed: 19,
        destination: { kind: "map", currentMapId: target.mapId, selection: { mapId: target.mapId, ...target.rect }, entry: target.entry } } as const;
      // When
      const preview = authoringValue(previewSpatialSourceBuild(input));
      // Then
      expect(store.getCurrent()).toEqual(project);
      expect(getMapEditHistoryEntries()).toHaveLength(0);
      expect(visibleAuthoringProject()).toBe(preview.project);
      expect(spatialBuildProposal()?.input).toEqual(input);
      const occurrence = own(fixtureDocument(preview.project).occurrences, rootId);
      expect(occurrence).toMatchObject({ seed: 19, parentId: null, parentSlot: null, source: input.source });
      const map = own(preview.project.maps, target.mapId);
      expect(map.lowerTiles.slice(3 * map.width + 3, 3 * map.width + 6)).toEqual([402, 403, 404]);
      expect(map.upperTiles.slice(4 * map.width + 3, 4 * map.width + 6)).toEqual([-1, 433, -1]);
      expect(map.upperTiles.slice(5 * map.width + 3, 5 * map.width + 6)).toEqual([462, 124, 464]);
      expect(map.events.length).toBeGreaterThan(0);
      expect(occurrence.bindings).toMatchObject([{ mapId: target.mapId, rect: target.rect }]);
      const before = own(project.maps, target.mapId);
      for (let y = 0; y < map.height; y++) for (let x = 0; x < map.width; x++) {
        if (x >= 3 && x < 6 && y >= 3 && y < 6) continue;
        expect([map.lowerTiles[y * map.width + x], map.upperTiles[y * map.width + x]])
          .toEqual([before.lowerTiles[y * map.width + x], before.upperTiles[y * map.width + x]]);
      }
    });

    it("adopts one undo step and selects the exact root when Apply accepts a space build", () => {
      // Given
      const { project } = manualBuildFixture();
      const rootId = spatialId("manual-room-19");
      const preview = authoringValue(previewSpatialSourceBuild({ source: { kind: "space", id: spaceDesign }, rootId, seed: 19,
        destination: { kind: "new-maps" } }));
      // When
      authoringValue(applyAuthoringPreview());
      // Then
      expect(store.getCurrent()).toEqual(preview.project);
      expect(getMapEditHistoryEntries()).toHaveLength(1);
      expect(spatialSession()).toMatchObject({ tab: "spaces", mode: "instances", occurrenceId: rootId, designId: null });
      expect(undoMapEdit()).toBe(true);
      expect(store.getCurrent()).toEqual(project);
      expect(redoMapEdit()).toBe(true);
      expect(store.getCurrent()).toEqual(preview.project);
    });

    it("retains the allocated root when a displayed build is previewed again", () => {
      // Given
      manualBuildFixture();
      const input = { source: { kind: "space", id: spaceDesign }, rootId: spatialId("stable-proposal"), seed: 19,
        destination: { kind: "new-maps" } } as const;
      const first = authoringValue(previewSpatialSourceBuild(input));
      // When
      const second = authoringValue(previewSpatialSourceBuild(input));
      // Then
      expect(second.project).toEqual(first.project);
      expect(fixtureDocument(second.project).rootOccurrenceIds).toEqual([input.rootId]);
      expect(getMapEditHistoryEntries()).toHaveLength(0);
    });

    it("preserves continuation when a build is edited without replaying instantiate", () => {
      // Given
      manualBuildFixture();
      const input = { source: { kind: "space", id: spaceDesign }, rootId: spatialId("continued-root"), seed: 19,
        destination: { kind: "new-maps" } } as const;
      authoringValue(previewSpatialSourceBuild(input));
      authoringValue(editAuthoringDraft(project => project, { operation: { kind: "edit" }, compile: { occurrenceId: input.rootId } }));
      // When
      const preview = authoringValue(previewSpatialSourceBuild(input));
      // Then
      expect(fixtureDocument(preview.project).rootOccurrenceIds).toEqual([input.rootId]);
      expect(getMapEditHistoryEntries()).toHaveLength(0);
    });

    it("creates no occurrence when ordinary source-save Preview is used", () => {
      // Given
      manualBuildFixture();
      authoringValue(editAuthoringDraft(project => project));
      // When
      const preview = authoringValue(previewAuthoringDraft());
      // Then
      expect(fixtureDocument(preview.project).occurrences).toEqual({});
      expect(spatialBuildProposal()).toBeNull();
    });

    it("rejects stale Apply without adoption when a live target tile changes", () => {
      // Given
      const { target } = manualBuildFixture();
      authoringValue(previewSpatialSourceBuild({ source: { kind: "space", id: spaceDesign }, rootId: spatialId("stale-root"), seed: 19,
        destination: { kind: "new-maps" } }));
      store.updateMap(target.mapId, map => { map.lowerTiles[0] = 402; });
      const before = structuredClone(store.getCurrent());
      const history = getMapEditHistoryEntries();
      const selection = spatialSession();
      // When
      const result = applyAuthoringPreview();
      // Then
      expect(result).toMatchObject({ kind: "error", error: { code: "stale" } });
      expect(store.getCurrent()).toEqual(before);
      expect(getMapEditHistoryEntries()).toEqual(history);
      expect(spatialSession()).toEqual(selection);
    });

    it("keeps Apply unavailable when an occupied object target is rejected", () => {
      // Given
      const { target } = manualBuildFixture();
      store.updateMap(target.mapId, map => { map.upperTiles[3 * map.width + 3] = 402; });
      const before = structuredClone(store.getCurrent());
      // When
      const result = previewSpatialSourceBuild({ source: { kind: "object", id: spatialId("hearth-design") }, rootId: spatialId("blocked-root"), seed: 19,
        destination: { kind: "map", currentMapId: target.mapId, selection: { mapId: target.mapId, ...target.rect }, entry: target.entry } });
      // Then
      expect(result).toMatchObject({ kind: "error", error: { detail: "blocked" } });
      expect(hasAuthoringPreview()).toBe(false);
      expect(store.getCurrent()).toEqual(before);
      expect(getMapEditHistoryEntries()).toHaveLength(0);
    });
  });
});
