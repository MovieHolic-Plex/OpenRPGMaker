import { expect, it, describe } from "vitest";
import { deserialize, serialize } from "@/project/io";
import { compileSpatialOccurrence } from "@/editor/spatial/compileSpatialOccurrence";
import { mixedFixture } from "./support/spatialMixedFixture";
import { runTool } from "@/editor/tools/toolRunner";
import { spaceCompilerFixture, spaceDesign, fixtureDocument, replaceOccurrence } from "./support/spatialSpaceCompilerFixture";
import { SPATIAL_KIND_SCHEMA, SPATIAL_UPSERT_SCHEMA } from "@/editor/tools/spatialToolSchemas";
import { publicSpatialValue, storageSpatialDesign } from "@/editor/tools/spatialPlaceContract";
import { CONCEPT_FLOOR_TILES } from "../src/editor/conceptBundleResolve";
import { own, requireOccurrenceAssociations, spatialId, resolveOccurrencePortId } from "../src/project/spatial/domain";
import { placeChild, placeCompilerFixture, placeRoot, stairFloors } from "./support/spatialConnectionSceneFixture";
import { exteriorPlaceFixture } from "./support/spatialPlaceGeometryFixture";
import { isPassableLanding } from "../src/project/collision";
import { computeReachableCells } from "../src/project/lint/reachability";
import { projectedStairOutput } from "./support/spatialPlaceOutputContract";
import { isolateTimers } from "./mergedTeardown";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { inspectNestedTraversal } from "./support/spatialPlaceTraversal";

describe("spatialPlace", () => {
  isolateTimers();
  describe("spatialPlaceContract", () => {
    isolateTimers();
    it("advertises a single place kind and body", () => {
      expect(SPATIAL_KIND_SCHEMA.enum).toEqual(["object", "place", "region", "world"]);
      expect(SPATIAL_UPSERT_SCHEMA.properties).not.toHaveProperty("space");
    });
    it("lists and reads historical rooms as places, including resolved references", () => {
      const ctx = { project: spaceCompilerFixture() };
      const list = runTool(ctx, "list_spatial_designs", { kind: "place" });
      expect(list.ok).toBe(true);
      expect((list.data as any).designs.some((d: any) => d.id === spaceDesign && d.kind === "place")).toBe(true);
      const get = runTool(ctx, "get_spatial_design", { kind: "place", id: spaceDesign });
      expect(get.ok, get.summary).toBe(true);
      expect(get.data).toMatchObject({ kind: "place", design: { environment: "interior" } });
      expect(JSON.stringify(get.data)).not.toContain('"kind":"space"');
      expect((get.data as any).resolved.snapshot.library).not.toHaveProperty("spaces");
    });
    it("round trips a room update and accepts the historical tool input", () => {
      const ctx = { project: spaceCompilerFixture() };
      const current = ctx.project.spatialAuthoring!.library.spaces[spaceDesign];
      const updated = { ...current, name: "새 방 이름", revision: current.revision + 1 };
      const upsert = runTool(ctx, "upsert_spatial_design", { kind: "place", expectedRevision: current.revision, place: updated });
      expect(upsert.ok, upsert.summary).toBe(true);
      expect(upsert.data).toMatchObject({ kind: "place", design: { name: "새 방 이름" } });
      const legacy = runTool(ctx, "get_spatial_design", { kind: "space", id: spaceDesign, resolved: false });
      expect(legacy.ok, legacy.summary).toBe(true);
      expect(legacy.data).toMatchObject({ kind: "place" });
      const preview = runTool(ctx, "preview_spatial_build", { kind: "place", id: spaceDesign, occurrenceId: "single-place-preview", seed: 7 });
      expect(preview.ok, preview.summary).toBe(true);
    });
    it("maps child place references by exact global identity rather than names", () => {
      const project = spaceCompilerFixture();
      const body = { id: "inn", children: [{ id: "room-slot", source: { kind: "place", id: spaceDesign }, x: 0, y: 0, level: 1 }] };
      expect(storageSpatialDesign(project, "place", body).design).toMatchObject({ children: [{ source: { kind: "space", id: spaceDesign } }] });
      expect(publicSpatialValue(body)).toEqual(body);
    });
    it("round trips painted place bodies and member references through the public tool schema", () => {
      const ctx = { project: mixedFixture() };
      const read = runTool(ctx, "get_spatial_design", { kind: "place", id: "inn", resolved: false });
      expect(read.ok, read.summary).toBe(true);
      const body = (read.data as any).design;
      expect(body.composition.members[0].source.kind).toBe("place");
      const save = runTool(ctx, "upsert_spatial_design", { kind: "place", expectedRevision: body.revision,
        place: { ...body, revision: body.revision + 1, name: "수정한 여관" } });
      expect(save.ok, save.summary).toBe(true);
      expect(ctx.project.spatialAuthoring!.library.places.inn.composition!.members[0].source.kind).toBe("space");
      expect(JSON.stringify(save.data)).not.toContain('"kind":"space"');
    });
    it("accepts a directly editable place as a region child through the unified contract", () => {
      const ctx = { project: structuredClone(spaceCompilerFixture()) };
      const room = ctx.project.spatialAuthoring!.library.spaces[spaceDesign];
      ctx.project.spatialAuthoring!.library.spaces[spaceDesign] = { ...room, composition: { tilesetId: room.tilesetId,
        width: room.width + 4, height: room.height + 6, tiles: [{ x: 3, y: 5, layer: "lower", tile: 240 }], members: [] } };
      const result = runTool(ctx, "upsert_spatial_design", { kind: "region", expectedRevision: 0, region: {
        id: "room-region", name: "방을 포함한 지역", revision: 1, tags: [], provenance: { origin: "user" },
        terrain: { tilesetId: "easyrpg_chipset_world", width: 20, height: 20, floor: "ground", areas: [] },
        places: [{ id: "region-room", source: { kind: "place", id: spaceDesign }, x: 4, y: 4, level: 0 }],
        ports: [{ id: "region-entry", name: "입구", x: 1, y: 1 }], routes: [{ id: "room-path", from: { childId: null, portId: "region-entry" }, to: { childId: "region-room", portId: ctx.project.spatialAuthoring!.library.spaces[spaceDesign].ports[0].id }, bidirectional: true, points: [{ x: 1, y: 1 }, { x: 4, y: 1 }, { x: 4, y: 4 }] }],
      } });
      expect(result.ok, result.summary).toBe(true);
      const build = runTool(ctx, "preview_spatial_build", { kind: "region", id: "room-region", occurrenceId: "region-with-room", seed: 7 });
      expect(build.ok, build.summary).toBe(true);
      const apply = runTool(ctx, "apply_spatial_build", { previewId: (build.data as any).previewId });
      expect(apply.ok, apply.summary).toBe(true);
      const read = deserialize(serialize(ctx.project));
      expect(read.mapConnections!.length).toBeGreaterThanOrEqual(2);
      expect(compileSpatialOccurrence(read, { occurrenceId: "region-with-room" }).maps).toEqual(read.maps);
    });
  });
  describe("spatialPlaceGeometry", () => {
    isolateTimers();
    describe("nested place geometry", () => {
      it("translates outdoor rasters when actual children move independently of their frozen slots", () => {
        // Given: actual coordinates deliberately differ from the frozen square slot.
        const fixture = placeCompilerFixture();
        const id = placeChild(fixture, placeRoot, "square");
        const input = replaceOccurrence(fixture, { ...own(fixtureDocument(fixture).occurrences, id), x: 7, y: 9 });
        // When: compile the enclosing place.
        const output = compileSpatialOccurrence(input, { occurrenceId: placeRoot });
        // Then: the exact output rectangle honors the actual occurrence.
        expect(own(fixtureDocument(output).occurrences, id).bindings[0]?.rect).toEqual({ x: 7, y: 9, width: 20, height: 16 });
      });

      it("keeps the frozen mixed-layer exterior on its atlas when a natural place contains a facility", () => {
        // Given: a frozen section exterior, not a live kit lookup during compilation.
        const input = exteriorPlaceFixture();
        const innId = placeChild(input, placeRoot, "inn");
        const squareId = placeChild(input, placeRoot, "square");
        // When: compile actual nested children and exterior cells.
        const output = compileSpatialOccurrence(input, { occurrenceId: placeRoot });
        // Then: same-plane outdoor surfaces share one atlas; the upper exterior cell is exact.
        const exterior = own(fixtureDocument(output).occurrences, innId).bindings.find(binding => binding.kind === undefined);
        const square = own(fixtureDocument(output).occurrences, squareId).bindings[0];
        expect(exterior?.mapId).toBe(square?.mapId);
        if (!exterior) throw new TypeError("Missing exterior ownership");
        const map = own(output.maps, exterior.mapId);
        const frozen = own(own(fixtureDocument(input).occurrences, innId).snapshot.kitCells, "nested-inn-design");
        for (const cell of frozen.cells) expect((cell.layer === "lower" ? map.lowerTiles : map.upperTiles)[(8 + cell.y) * map.width + 24 + cell.x]).toBe(cell.tile);
        expect(stairFloors(output).map(floor => own(fixtureDocument(output).occurrences, floor.roomId).bindings[0]?.mapId))
          .not.toContain(exterior.mapId);
      });

      it("resolves a place's named port exactly when persisted local associations link its exterior to a room", () => {
        // Given: an exterior local port with an explicit persisted room connection.
        const input = exteriorPlaceFixture(true);
        // When: compile the natural place.
        const output = compileSpatialOccurrence(input, { occurrenceId: placeRoot });
        // Then: the declared entry is neither moved nor inferred from containment.
        const inn = requireOccurrenceAssociations(own(fixtureDocument(output).occurrences, placeChild(input, placeRoot, "inn")));
        expect(inn.bindings.flatMap(binding => binding.ports)).toContainEqual({ portId: resolveOccurrencePortId(inn, spatialId("door")), x: 26, y: 10 });
        expect(output.mapConnections).toHaveLength(2);
      });

      it("keeps outdoor atlases separate when a frozen exterior uses a different atlas", () => {
        // Given: only this actual exterior snapshot changes atlas, not the live parent design.
        const fixture = exteriorPlaceFixture();
        const innId = placeChild(fixture, placeRoot, "inn");
        const inn = requireOccurrenceAssociations(own(fixtureDocument(fixture).occurrences, innId));
        const design = own(inn.snapshot.library.places, inn.source.id);
        const frozen = own(inn.snapshot.kitCells, design.id);
        const atlas = "easyrpg_chipset_interior";
        const input = replaceOccurrence(fixture, { ...inn, snapshot: { ...inn.snapshot,
          library: { ...inn.snapshot.library, places: { ...inn.snapshot.library.places,
            [design.id]: { ...design, exterior: { tilesetId: atlas, kitId: frozen.kitId } } } },
          kitCells: { ...inn.snapshot.kitCells, [design.id]: { ...frozen, tilesetId: atlas,
            cells: frozen.cells.filter(cell => cell.layer === "lower").map(cell => ({ ...cell, tile: CONCEPT_FLOOR_TILES.wood })) } } } });
        // When: compile both outdoor surfaces.
        const output = compileSpatialOccurrence(input, { occurrenceId: placeRoot });
        // Then: incompatible atlases are never mixed in a single map.
        const exterior = own(fixtureDocument(output).occurrences, innId).bindings[0];
        const square = own(fixtureDocument(output).occurrences, placeChild(input, placeRoot, "square")).bindings[0];
        expect(exterior?.mapId).not.toBe(square?.mapId);
        if (!exterior) throw new TypeError("Missing exterior");
        expect(own(output.maps, exterior.mapId).tilesetId).toBe(atlas);
      });

      it("keeps actual levels separate when a square moves off the exterior's plane", () => {
        // Given: actual level differs from the frozen parent slot's level zero.
        const fixture = exteriorPlaceFixture();
        const squareId = placeChild(fixture, placeRoot, "square");
        const input = replaceOccurrence(fixture, { ...own(fixtureDocument(fixture).occurrences, squareId), level: 1 });
        // When: compile the nested place.
        const output = compileSpatialOccurrence(input, { occurrenceId: placeRoot });
        // Then: same atlas and overlapping plane coordinates do not flatten different levels.
        const document = fixtureDocument(output);
        expect(own(document.occurrences, squareId).bindings[0]?.mapId)
          .not.toBe(own(document.occurrences, placeChild(input, placeRoot, "inn")).bindings[0]?.mapId);
      });

      it("keeps an authored automatic-slot override when its actual coordinates are no longer placeholders", () => {
        // Given: an actual bed moved from its unplaced 0,0 placeholder.
        const fixture = placeCompilerFixture();
        const floor = stairFloors(fixture)[0];
        if (!floor) throw new TypeError("Missing fixture floor");
        const bedId = placeChild(fixture, floor.roomId, "beds");
        const input = replaceOccurrence(fixture, { ...own(fixtureDocument(fixture).occurrences, bedId), x: 6, y: 3 });
        // When: compile the root, without replacing its actual bed child.
        const output = compileSpatialOccurrence(input, { occurrenceId: placeRoot });
        // Then: the shell offset is the only coordinate translation.
        expect(own(fixtureDocument(output).occurrences, bedId).bindings[0]?.rect).toEqual({ x: 8, y: 7, width: 1, height: 2 });
      });
    });
  });
  describe("spatialPlaceOutputContract", () => {
    isolateTimers();
    describe("nested place projected stair output contract", () => {
      it("accepts complete connection bookkeeping when the raster owner hosts projected stair endpoints", () => {
        // Given: real space-compiler maps and the existing house transfer-event adapter.
        const { proposal } = projectedStairOutput();
        // When: proposed complete ownership crosses the actual project IO boundary.
        const loaded = deserialize(JSON.stringify(proposal));
        // Then: the raster owner's generated connection bookkeeping survives IO.
        expect(loaded.spatialAuthoring).toEqual(proposal.spatialAuthoring);
      });

      it("isolates connection bookkeeping when the identical numeric output omits only connectionIds", () => {
        // Given: same tiles, projected ports, owned events, transfers, and navigation.
        const { control } = projectedStairOutput();
        // When: load the diagnostic control (not an acceptable complete compiler output).
        const loaded = deserialize(JSON.stringify(control));
        // Then: the remainder of the output contract is valid.
        expect(loaded.spatialAuthoring).toEqual(control.spatialAuthoring);
        expect(loaded.mapConnections).toEqual(control.mapConnections);
      });

      it("has reachable passable endpoints when the real stair rasters carry transfer events", () => {
        // Given: actual authored stairs and transfer commands from the existing adapter.
        const { proposal, routes } = projectedStairOutput();
        // When: existing-engine collision and walking reachability inspect each endpoint.
        const access = routes.map(route => {
          const source = own(proposal.maps, route.from.mapId);
          const target = own(proposal.maps, route.to.mapId);
          const reached = computeReachableCells(proposal, source, 10, 15);
          return reached.has(`${route.from.x},${route.from.y}`)
            && isPassableLanding(proposal, target, route.to.x, route.to.y);
        });
        // Then: failure of the complete proposal cannot be blamed on blocked landings.
        expect(access).toEqual([true, true, true, true]);
      });
    });
  });
});

describe("spatialPlaceCli", () => {
  isolateTimers();
  describe("nested-places CLI", () => {
    it("executes generated transfers through the engine when three requested seeds compile", () => {
      // Given: a per-run evidence sandbox, with no live DB or editor store.
      const directory = mkdtempSync(join(tmpdir(), "task9-cli-"));
      try {
        // When: execute the real CLI with its requested scenario and seeds.
        const result = spawnSync("bun", ["run", "scripts/qa/spatial-compile.mts", "--scenario", "nested-places", "--seeds", "7,19,31", "--evidence", directory],
          { encoding: "utf8", timeout: 90000, stdio: ["ignore", "pipe", "pipe"] });
        // Then: actual serialized proposals execute four directed stair routes each.
        expect(result.error).toBeUndefined();
        expect(result.status, result.stderr).toBe(0);
        for (const seed of [7, 19, 31]) {
          const proposal = deserialize(readFileSync(join(directory, `proposal-${seed}.json`), "utf8"));
          const receipt = inspectNestedTraversal(proposal);
          expect(receipt.routes).toHaveLength(4);
          expect(receipt.routes.every(route => route.walk.length > 1 && route.executedTransfer.kind === "transfer")).toBe(true);
        }
      } finally {
        rmSync(directory, { recursive: true, force: true });
      }
    }, 120000);

    it("exits unsuccessfully without a proposal when a persisted landing is blocked", () => {
      // Given: an isolated CLI evidence directory and the explicit error-path fixture.
      const directory = mkdtempSync(join(tmpdir(), "task9-cli-failure-"));
      try {
        // When: drive the failure through the same public command, not a diagnostic witness.
        const result = spawnSync("bun", ["run", "scripts/qa/spatial-compile.mts", "--scenario", "nested-places", "--seeds", "7",
          "--fault", "blocked-port", "--evidence", directory], { encoding: "utf8", timeout: 90000, stdio: ["ignore", "pipe", "pipe"] });
        // Then: the real exit is nonzero and its machine-readable rejection names the landing.
        expect(result.error).toBeUndefined();
        expect(result.status).toBe(1);
        const rejection: unknown = JSON.parse(readFileSync(join(directory, "rejection.json"), "utf8"));
        expect(rejection).toMatchObject({ code: "port", callerUnchanged: true, partialProposal: false });
      } finally {
        rmSync(directory, { recursive: true, force: true });
      }
    }, 120000);
  });
});
