import { describe, expect, it } from "vitest";
import { deserialize, serialize, serializePretty } from "@/project/io";
import { validateSpatialAuthoring } from "@/project/spatial/guards";
import { inspectLegacySpatialConstraints } from "@/project/spatial/legacyConstraints";
import { emptySpatialDocument, spatialProject, spatialWire } from "./support/spatialSchemaFixture";
import { canonicalConceptBundles, canonicalConceptLayout } from "@/editor/spatial/legacyConcepts";
import { checkedDocument, own, spatialId } from "@/project/spatial/domain";
import type { Project } from "@/project/types";
import type { PlaceDesign } from "@/project/spatial/types";
import { fixtureDocument, interiorAtlas, spaceCompilerFixture, reinstantiateSpace, spaceRoot } from "./support/spatialSpaceCompilerFixture";
import { mixedFixture } from "./support/spatialMixedFixture";
import { instantiateSpatialDesign } from "@/project/spatial/instances";
import { compileSpatialOccurrence, SpatialCompileError } from "@/editor/spatial/compileSpatialOccurrence";
import { inspectSpatialDesignReferences } from "@/project/spatial/ownership";
import { paintComposition } from "@/project/spatial/composition";
import { previewPlaceMaps } from "@/editor/panels/spatialPlacePreview";
import { resolveMaterialSlots } from "../src/editor/operators/materialSlots";
import { canMove, isPassableLanding } from "../src/project/collision";
import { autotileGroupsForTileset } from "../src/project/defaults/autotileGroups";
import { SAND_TILE } from "../src/project/defaults/chipsetMapping";
import { computeReachableCells } from "../src/project/lint/reachability";
import { outdoorShapeFixture } from "./support/spatialOutdoorShapeFixture";
import { inspectCompiledSpace } from "./support/spatialCompilerAssertions";
import { inspectOutdoorShape } from "./support/spatialOutdoorAssertions";
import { isolateTimers } from "./mergedTeardown";

describe("spatialLegacyRoomKinds", () => {
  isolateTimers();
  const original = { tilesetId: " removed atlas ", record: {
    id: " room ", label: "  label\n", requiredRoles: [" custom ", " custom ", ""],
    suggestedModifiers: ["", " mood ", " mood "], walkway: false,
  } };
  const variants = [
    [original, original], [],
    [{ tilesetId: "", record: { id: "", label: "", requiredRoles: [] } }],
    [{ tilesetId: " ", record: { id: " ", label: " ", requiredRoles: [], suggestedModifiers: [], walkway: true } }],
  ];
  describe("historical typed room constraints", () => {
    it.each(variants.map(roomKinds => ({ roomKinds })))("preserves original records when $roomKinds roundtrip", ({ roomKinds }) => {
      // Given: qualifiers and duplicates are historical, never live keys.
      const { project } = spatialProject();
      const document = emptySpatialDocument();
      const input = { ...document, legacyImport: { ...document.legacyImport, roomKinds } };
      const before = JSON.stringify(input);
      // When
      const results = [serialize, serializePretty].map(write => deserialize(write(deserialize(spatialWire(project, input)))));
      // Then
      for (const result of results) expect(result.spatialAuthoring).toStrictEqual(input);
      expect(JSON.stringify(input)).toBe(before);
    });

    it("retains omission when old version1 receipts have no roomKinds", () => {
      // Given
      const input = emptySpatialDocument();
      // When
      const parsed = validateSpatialAuthoring(input);
      // Then
      expect(Object.hasOwn(parsed.legacyImport, "roomKinds")).toBe(false);
    });

    it.each([undefined, ...variants].map(roomKinds => ({ roomKinds })))("exposes typed compatibility data when inspecting $roomKinds", ({ roomKinds }) => {
      // Given
      const document = emptySpatialDocument();
      const receipt = validateSpatialAuthoring({ ...document, legacyImport: {
        ...document.legacyImport, ...(roomKinds === undefined ? {} : { roomKinds }),
      } }).legacyImport;
      const before = JSON.stringify(receipt);
      // When
      const view = inspectLegacySpatialConstraints(receipt);
      // Then: the discriminator is a machine-facing routing value, not pinned prose.
      expect(view).toStrictEqual({ kind: "legacy-compatibility-constraints", ...(roomKinds === undefined ? {} : { roomKinds }) });
      expect(JSON.stringify(receipt)).toBe(before);
    });

    const invalid = [
      undefined, null, {}, [null], [{ record: original.record }], [{ ...original, tilesetId: 1 }],
      [{ ...original, extra: true }], [{ ...original, record: { ...original.record, extra: true } }],
      ...["id", "label", "requiredRoles"].map(key => [{ ...original, record: Object.fromEntries(Object.entries(original.record).filter(([field]) => field !== key)) }]),
      ...[null, "bed", [1]].map(requiredRoles => [{ ...original, record: { ...original.record, requiredRoles } }]),
      ...[undefined, null, "mood", [false]].map(suggestedModifiers => [{ ...original, record: { ...original.record, suggestedModifiers } }]),
      ...[undefined, null, "false", 0].map(walkway => [{ ...original, record: { ...original.record, walkway } }]),
    ];
    it.each(invalid.map(roomKinds => ({ roomKinds })))("rejects malformed shapes when roomKinds is $roomKinds", ({ roomKinds }) => {
      // Given
      const document = emptySpatialDocument();
      const input = { ...document, legacyImport: { ...document.legacyImport, roomKinds } };
      // When
      const parse = () => validateSpatialAuthoring(input);
      // Then
      expect(parse).toThrow("spatialAuthoring.legacyImport.roomKinds");
    });
  });
});

describe("spatialOutdoorCompiler", () => {
  isolateTimers();
  describe("spatialLegacyPathIdentity", () => {
    isolateTimers();
    // T17-AV-2: promoted from independent/legacy-probes.mts, preserving its valid 1-based floors.
    function collisionProject(path: readonly [string, string] = ["A", "B"]): Project {
      const project = spaceCompilerFixture();
      const document = fixtureDocument(project);
      const space = own(document.library.spaces, "room-design");
      const first = { ...space, id: spatialId("room-one"), name: "First room", objectSlots: space.objectSlots.filter(slot => slot.id === "beds") };
      const second = { ...space, id: spatialId("room-two"), name: "Second room", objectSlots: space.objectSlots.filter(slot => slot.id === "hearth") };
      const base = { revision: 1, tags: [], provenance: { origin: "user" }, kind: "facility", layout: "manual", ports: [], connections: [] } as const;
      const nested: PlaceDesign = { ...base, id: spatialId("nested"), name: "Nested", children: [
        { id: spatialId(path[1]), source: { kind: "space", id: second.id }, x: 0, y: 0, level: 1 },
      ] };
      const root: PlaceDesign = { ...base, id: spatialId("collision-root"), name: "Collision root", children: [
        { id: spatialId(`${path[0]}/${path[1]}`), source: { kind: "space", id: first.id }, x: 0, y: 0, level: 1 },
        { id: spatialId(path[0]), source: { kind: "place", id: nested.id }, x: 20, y: 0, level: 1 },
      ] };
      project.spatialAuthoring = checkedDocument({ ...document, library: { ...document.library,
        spaces: { ...document.library.spaces, [first.id]: first, [second.id]: second }, places: { [root.id]: root, [nested.id]: nested },
      } }, project);
      return project;
    }
    function projectedBundle(project: Project, id = "collision-root") {
      const bundle = canonicalConceptBundles(project, interiorAtlas).find(bundle => bundle.id === id);
      if (!bundle) throw new TypeError(`Missing projected fixture bundle: ${id}`);
      return bundle;
    }
    describe("canonical legacy opaque path identity", () => {
      // Removed it.each "keeps bed and hearth overlays separate when direct %s/%s also occurs as a nested path": get_concept_facility was removed from the tool registry on purpose.

      it("retains separate room and thing occurrences when a canonical space is reused under colliding paths", () => {
        // Given: valid source reuse must not be deduplicated or rejected, even with identical labels and slots.
        const project = collisionProject();
        const document = fixtureDocument(project);
        const nested = own(document.library.places, "nested");
        project.spatialAuthoring = checkedDocument({ ...document, library: { ...document.library, places: { ...document.library.places,
          [nested.id]: { ...nested, children: nested.children.map(child => ({ ...child, source: { kind: "space", id: spatialId("room-one") } })) },
        } } }, project);
        // When
        const bundle = projectedBundle(project);
        // Then
        expect(new Set(bundle.places.map(room => room.id)).size).toBe(2);
        expect(new Set(bundle.things.map(thing => thing.id)).size).toBe(4);
        expect(bundle.places.map(room => bundle.things.filter(thing => thing.placeIds.includes(room.id)).map(thing => thing.objectId)))
          .toEqual([["bed_v", "bed_v"], ["bed_v", "bed_v"]]);
      });

      it("encodes the root boundary when different facilities have the same flattened room path", () => {
        // Given: root A/B + slot C and root A + slot B/C are different complete tuples.
        const project = collisionProject();
        const document = fixtureDocument(project);
        const template = own(document.library.places, "collision-root");
        const places = Object.fromEntries([["A/B", "C"], ["A", "B/C"]].map(([root, slot]) => {
          if (!root || !slot) throw new TypeError("Missing root/slot fixture");
          const place: PlaceDesign = { ...template, id: spatialId(root), children: [
            { id: spatialId(slot), source: { kind: "space", id: spatialId("room-one") }, x: 0, y: 0, level: 1 },
          ] };
          return [place.id, place];
        }));
        project.spatialAuthoring = checkedDocument({ ...document, library: { ...document.library, places } }, project);
        // When
        const bundles = canonicalConceptBundles(project, interiorAtlas);
        // Then
        expect(new Set(bundles.flatMap(bundle => bundle.places.map(room => room.id))).size).toBe(2);
        expect(new Set(bundles.flatMap(bundle => bundle.things.map(thing => thing.id))).size).toBe(4);
      });

      it("projects deterministic identities when the same canonical input is read again", () => {
        // Given
        const project = collisionProject();
        const first = projectedBundle(project);
        const layout = canonicalConceptLayout(first);
        const before = JSON.stringify(project);
        // When
        const second = projectedBundle(project);
        // Then
        expect(second).toEqual(first);
        expect(canonicalConceptLayout(second)).toEqual(layout);
        expect(JSON.stringify(project)).toBe(before);
      });
    });
  });
  describe("spatialMixedComposition", () => {
    isolateTimers();
    it('roundtrips direct tiles and all lower kinds without rewriting legacy records', () => {
      const project = mixedFixture();
      checkedDocument(project.spatialAuthoring, project);
      const read = deserialize(serialize(project));
      expect(read.spatialAuthoring!.library).toEqual(project.spatialAuthoring!.library);
      expect(inspectSpatialDesignReferences(read.spatialAuthoring, read, { kind: 'object', id: spatialId('bed-design') }).strong).toHaveLength(4);
    });
    it('rejects geography inside a place', () => {
      const project = mixedFixture();
      const paint = project.spatialAuthoring!.library.places.inn.composition!;
      project.spatialAuthoring!.library.places.inn = { ...project.spatialAuthoring!.library.places.inn, composition: { ...paint, members: [{ ...paint.members[0], source: { kind: 'world', id: spatialId('world') } }] } };
      expect(() => checkedDocument(project.spatialAuthoring, project)).toThrow('incompatible member kind');
    });
    it('paints one layer, restores a base cell, and ignores outside strokes', () => {
      const paint = mixedFixture().spatialAuthoring!.library.places.inn.composition!;
      const next = paintComposition(paint, { x: 2, y: 2 }, 'upper', 54);
      expect(next.tiles.some(cell => cell.layer === 'upper' && cell.tile === 54)).toBe(true);
      expect(paintComposition(next, { x: 2, y: 2 }, 'upper', null)).toEqual(paint);
      expect(paintComposition(paint, { x: -1, y: 2 }, 'lower', 4)).toBe(paint);
    });
    it('compiles the frozen mixed tree, reloads and protects manual map edits', () => {
      const project = mixedFixture();
      project.spatialAuthoring = instantiateSpatialDesign(project.spatialAuthoring, project, { source: { kind: 'world', id: spatialId('world') }, rootId: 'mixed-world', x: 0, y: 0, level: 0, seed: 7, generatorVersion: 'mixed-v1' });
      const compiled = compileSpatialOccurrence(project, { occurrenceId: 'mixed-world' });
      const map = compiled.maps['spatial:mixed-world'];
      expect(map.width).toBe(128);
      const rootBed = Object.values(compiled.spatialAuthoring!.occurrences).find(o => o.parentId === 'mixed-world' && o.kind === 'object')!;
      const cells = rootBed.snapshot.kitCells['bed-design'].cells;
      for (const cell of cells) expect((cell.layer === 'lower' ? map.lowerTiles : map.upperTiles)[(80 + cell.y) * map.width + 95 + cell.x]).toBe(cell.tile);
      const changedSource = structuredClone(project);
      changedSource.spatialAuthoring!.library.worlds.world = { ...changedSource.spatialAuthoring!.library.worlds.world, composition: { ...changedSource.spatialAuthoring!.library.worlds.world.composition!, tiles: [] } };
      expect(compileSpatialOccurrence(changedSource, { occurrenceId: 'mixed-world' }).maps[map.id]).toEqual(map);
      expect(Object.values(compiled.spatialAuthoring!.occurrences).filter(o => o.bindings.length)).toHaveLength(Object.keys(compiled.spatialAuthoring!.occurrences).length);
      const read = deserialize(serialize(compiled));
      expect(compileSpatialOccurrence(read, { occurrenceId: 'mixed-world' }).maps[map.id]).toEqual(read.maps[map.id]);
      read.maps[map.id].lowerTiles[0] = 10;
      expect(() => compileSpatialOccurrence(read, { occurrenceId: 'mixed-world' })).toThrow('ownership');
    }, 60_000);
    it('allows nested places of either historical storage kind and rejects cycles', () => {
      const project = mixedFixture();
      const doc = project.spatialAuthoring!;
      const room = doc.library.spaces['room-design'];
      doc.library.spaces['small-room'] = { ...room, id: spatialId('small-room'), width: 4, height: 4, objectSlots: [], ports: [], composition: undefined };
      doc.library.places['small-place'] = { ...doc.library.places.inn, id: spatialId('small-place'), composition: {
        tilesetId: room.tilesetId, width: 8, height: 10, tiles: [], members: [{ id: spatialId('inner-room'), source: { kind: 'space', id: spatialId('small-room') }, x: 0, y: 0, level: 0 }],
      } };
      doc.library.spaces[room.id] = { ...room, composition: { ...room.composition!, members: [{ id: spatialId('nested-place'), source: { kind: 'place', id: spatialId('small-place') }, x: 1, y: 1, level: 0 }] } };
      project.spatialAuthoring = instantiateSpatialDesign(doc, project, { source: { kind: 'space', id: room.id }, rootId: 'nested-root', x: 0, y: 0, level: 0, seed: 7, generatorVersion: 'nested-place-v1' });
      const compiled = compileSpatialOccurrence(project, { occurrenceId: 'nested-root' });
      const read = deserialize(serialize(compiled));
      expect(compileSpatialOccurrence(read, { occurrenceId: 'nested-root' }).maps).toEqual(read.maps);
      const live = read.spatialAuthoring!.library;
      live.places['small-place'] = { ...live.places['small-place'], composition: { ...live.places['small-place'].composition!, members: [{ id: spatialId('cycle'), source: { kind: 'space', id: room.id }, x: 0, y: 0, level: 0 }] } };
      expect(() => checkedDocument(read.spatialAuthoring, read)).toThrow('containment cycle');
    }, 60_000);
    it('keeps a world overview separate from a directly composed child region', () => {
      const project = mixedFixture();
      const world = project.spatialAuthoring!.library.worlds.world;
      const { composition: _canvas, ...overview } = world;
      project.spatialAuthoring!.library.worlds.world = { ...overview, regions: [{ id: spatialId('overview-town'), source: { kind: 'region', id: spatialId('town') }, x: 5, y: 5, level: 0 }] };
      project.spatialAuthoring = instantiateSpatialDesign(project.spatialAuthoring, project, { source: { kind: 'world', id: spatialId('world') }, rootId: 'overview-with-canvas', x: 0, y: 0, level: 0, seed: 7, generatorVersion: 'overview-composition-v1' });
      const compiled = compileSpatialOccurrence(project, { occurrenceId: 'overview-with-canvas' });
      const root = compiled.spatialAuthoring!.occurrences['overview-with-canvas'];
      const child = Object.values(compiled.spatialAuthoring!.occurrences).find(o => o.parentId === root.id)!;
      expect(root.bindings[0].mapId).not.toBe(child.bindings[0].mapId);
      // 개요 맵은 세계 지형 칩셋을 쓴다 — 고정물의 세계 지형은 #2906 에서 worldmap_selected 로 바뀌었다(spatialMixedFixture.ts).
      expect(compiled.maps[root.bindings[0].mapId].tilesetId).toBe('worldmap_selected');
      expect(compiled.maps[child.bindings[0].mapId]).toMatchObject({ width: 80, height: 60 });
      expect(compileSpatialOccurrence(deserialize(serialize(compiled)), { occurrenceId: root.id }).maps).toEqual(compiled.maps);
    }, 60_000);
    it('previews a room captured from a painted map on a non-shell atlas', () => {
      const project = mixedFixture();
      const doc = project.spatialAuthoring!;
      const room = doc.library.spaces['room-design'];
      project.tilesets['painted_atlas'] = { ...structuredClone(project.tilesets[room.tilesetId]), id: 'painted_atlas' };
      const width = 6, height = 5;
      doc.library.spaces['painted-room'] = { ...room, id: spatialId('painted-room'), tilesetId: 'painted_atlas', environment: 'interior', width, height, objectSlots: [],
        ports: [{ id: spatialId('painted-entry'), name: '입구', x: 2, y: 4 }],
        composition: { tilesetId: 'painted_atlas', width, height, members: [],
          tiles: Array.from({ length: width * height }, (_, i) => ({ x: i % width, y: Math.floor(i / width), layer: 'lower' as const, tile: 240 })) } };
      const place = { ...doc.library.places.inn, id: spatialId('painted-house'), kind: 'facility' as const, composition: undefined,
        children: [{ id: spatialId('painted-floor'), source: { kind: 'space' as const, id: spatialId('painted-room') }, x: 0, y: 0, level: 1 }] };
      doc.library.places['painted-house'] = place;
      const { maps } = previewPlaceMaps({ project, place, floor: null });
      expect(maps).toHaveLength(1);
      expect(maps[0].map).toMatchObject({ tilesetId: 'painted_atlas', width, height });
      expect(maps[0].map.lowerTiles.every(tile => tile === 240)).toBe(true);
    }, 60_000);
  });
  describe("spatialOutdoorCompiler", () => {
    isolateTimers();
    const shapes = ["rect", "l", "alcove"] as const;
    describe("outdoor compiler footprint", () => {
      it.each(shapes)("clips material rectangles and polygons to the %s shape when rasterizing 22x16", shape => {
        // Given: an independent cell oracle, not the compiler's footprint helper.
        const input = reinstantiateSpace(outdoorShapeFixture(19, shape), space => ({ ...space, objectSlots: [] }));
        const before = JSON.stringify(input);
        // When
        const proposal = compileSpatialOccurrence(input, { occurrenceId: spaceRoot });
        // Then: every material cell and every excluded corner obey real engine collision.
        const map = own(proposal.maps, `spatial:${spaceRoot}`);
        const tileset = own(proposal.tilesets, map.tilesetId);
        const slots = resolveMaterialSlots(tileset);
        const materialTiles = Object.fromEntries(Object.entries(slots).map(([id, slot]) => [id, [
          ...slot.tiles, ...autotileGroupsForTileset(tileset).filter(group => group.memberTileIds.includes(slot.body ?? slot.tiles[0] ?? -1))
            .flatMap(group => Object.values(group.variantMap)),
        ]]));
        const reached = computeReachableCells(proposal, map, 10, 14);
        for (let y = 0; y < 16; y++) for (let x = 0; x < 22; x++) {
          const inside = shape === "rect" || y >= 2 || (x < 15 && (shape === "l" || x >= 2));
          const tile = map.lowerTiles[y * 22 + x];
          const material = x >= 12 && y <= x - 12 ? "shore" : y < 3 ? "path" : "ground";
          if (inside) expect(own(materialTiles, material)).toContain(tile);
          else expect([tile, map.upperTiles[y * 22 + x]]).toEqual([-1, -1]);
          expect(isPassableLanding(proposal, map, x, y)).toBe(inside);
          expect(reached.has(`${x},${y}`)).toBe(inside);
        }
        expect(reached.size).toBe(shape === "rect" ? 352 : shape === "l" ? 338 : 334);
        expect(map.lowerTiles[14]).toBe(shape === "rect" ? SAND_TILE.EDGE_NORTH : SAND_TILE.CORNER_NORTH_EAST);
        expect(canMove(proposal, map, 14, 0, 15, 0)).toBe(shape === "rect");
        expect(canMove(proposal, map, 21, 2, 21, 1)).toBe(shape === "rect");
        expect(deserialize(serialize(proposal)).maps[map.id]).toEqual(map);
        expect(JSON.stringify(input)).toBe(before);
      });

      it.each(shapes)("keeps required fixed and automatic objects inside %s when composing frozen occurrences", shape => {
        // Given
        const input = outdoorShapeFixture(31, shape);
        const before = JSON.stringify(input);
        // When
        const proposal = compileSpatialOccurrence(input, { occurrenceId: spaceRoot });
        // Then
        const receipt = inspectCompiledSpace(input, proposal);
        expect(receipt.accessibleRequiredObjects).toBe(3);
        expect(inspectOutdoorShape(proposal).checkedCells).toBe(352);
        expect(receipt.objects.find(object => object.occurrenceId.includes("tree-slot"))?.rect).toEqual({ x: 2, y: 2, width: 1, height: 2 });
        for (const object of receipt.objects) for (const cell of object.cells) {
          expect(shape === "rect" || cell.y >= 2 || (cell.x < 15 && (shape === "l" || cell.x >= 2))).toBe(true);
        }
        expect(compileSpatialOccurrence(deserialize(serialize(proposal)), { occurrenceId: spaceRoot })).toEqual(proposal);
        expect(JSON.stringify(input)).toBe(before);
      });

      it.each(["l", "alcove"] as const)("rejects required fixed cells atomically when they straddle the %s cutout", shape => {
        // Given
        const input = reinstantiateSpace(outdoorShapeFixture(7, shape), space => ({ ...space, objectSlots: space.objectSlots.map(slot =>
          slot.id === "tree-slot" ? { ...slot, placement: { mode: "fixed", x: 15, y: 1 } } : slot) }));
        const before = JSON.stringify(input);
        // When / Then
        expect(() => compileSpatialOccurrence(input, { occurrenceId: spaceRoot })).toThrowError(expect.objectContaining({ code: "clipped" }));
        expect(JSON.stringify(input)).toBe(before);
      });

      it.each(["entry", "port"] as const)("rejects an outside-shape %s atomically instead of relocating it", failure => {
        // Given
        const input = reinstantiateSpace(outdoorShapeFixture(7, "alcove"), space => ({ ...space, objectSlots: [],
          ports: failure === "entry" ? [{ id: spatialId("corner"), name: "Corner", x: 0, y: 0 }]
            : [...space.ports, { id: spatialId("corner"), name: "Corner", x: 21, y: 0 }] }));
        const before = JSON.stringify(input);
        // When / Then
        expect(() => compileSpatialOccurrence(input, { occurrenceId: spaceRoot })).toThrowError(expect.objectContaining({ code: failure }));
        expect(JSON.stringify(input)).toBe(before);
      });

      it("rejects a child port when its authored offset lands outside the containing shape", () => {
        // Given: the flower is inside at (14,1), but its anchor at (15,1) is outside.
        const base = outdoorShapeFixture(19, "l");
        const document = fixtureDocument(base);
        const flower = own(document.library.objects, "flower");
        base.spatialAuthoring = { ...document, library: { ...document.library, objects: { ...document.library.objects,
          flower: { ...flower, anchors: [{ id: spatialId("edge"), name: "Edge", x: 1, y: 0 }] } } } };
        const input = reinstantiateSpace(base, space => ({ ...space, objectSlots: space.objectSlots.filter(slot => slot.id === "flower-slot")
          .map(slot => ({ ...slot, quantity: 1, placement: { mode: "fixed", x: 14, y: 1 } })) }));
        const before = JSON.stringify(input);
        // When / Then
        expect(() => compileSpatialOccurrence(input, { occurrenceId: spaceRoot })).toThrowError(SpatialCompileError);
        expect(JSON.stringify(input)).toBe(before);
      });
    });
  });
});
