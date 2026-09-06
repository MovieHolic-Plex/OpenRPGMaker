import { afterEach, describe, expect, it, vi } from "vitest";
import { createEmptyToolProject } from "@/editor/tools/emptyProject";
import { captureHouseProtection, type HouseSnapshot } from "@/editor/tools/houseProtection";
import { runTool } from "@/editor/tools/toolRunner";
import * as houses from "@/editor/tools/village/houses";
import * as roads from "@/editor/tools/village/roads";
import * as decor from "@/editor/tools/village/decor";
import * as landscape from "@/editor/tools/village/landscape";
import * as terrain from "@/editor/tools/villageTerrainPass";
import * as fences from "@/editor/tools/village/fences";
import * as placement from "@/project/lint/layoutPlacementValidate";
import { deserialize, serialize } from "@/project/io";
import { isPassable } from "@/project/collision";
import { roofDeckLadderAttachment } from "@/editor/tools/houseProtection";
import * as evaluation from "@/editor/tools/villageEvaluate";
import { createExistingProject } from "./authorVillageFacadeFixtures";
import { TILE } from "@/project/defaults/constants";
import type { GameMap } from "@/project/types";

afterEach(() => vi.restoreAllMocks());

describe("village early completion lifecycle", () => {
  it("registers finished houses before roads and preserves the same snapshots through every real stage", () => {
    const ctx = { project: createEmptyToolProject("early seal") };
    let sealed: HouseSnapshot[] = [];
    const stages: string[] = [];
    const paint = roads.paintVillageRoadsChecked;
    vi.spyOn(roads, "paintVillageRoadsChecked").mockImplementation((args) => {
      sealed = captureHouseProtection(args.draft);
      expect(sealed).toHaveLength(4);
      expect(sealed.some(h => h.cells.some(c => c.upper === 208 || c.upper === 209))).toBe(true);
      expect(args.map.events.some(e => e.id.startsWith("ev_house_door"))).toBe(true);
      stages.push("roads");
      const result = paint(args);
      expect(captureHouseProtection(args.draft)).toEqual(sealed);
      return result;
    });
    const decorate = decor.placeVillageDecor;
    vi.spyOn(decor, "placeVillageDecor").mockImplementation((...args) => {
      stages.push("decor");
      expect(captureHouseProtection(args[0])).toEqual(sealed);
      const result = decorate(...args);
      expect(captureHouseProtection(args[0])).toEqual(sealed);
      return result;
    });
    const result = runTool(ctx, "build_village", { houses: 4, seed: 7, groundTheme: "snow" });
    expect(result.ok, JSON.stringify(result.issues)).toBe(true);
    expect(stages).toEqual(["roads", "decor"]);
    expect(captureHouseProtection(ctx.project)).toEqual(sealed);
  });

  it.each(["roads", "terrain", "fences", "decor", "landscape", "scrub"] as const)(
    "rejects the whole tool immediately after real %s stage corruption, before door restoration", (stage) => {
      const ctx = { project: createEmptyToolProject("stage damage") };
      const before = serialize(ctx.project);
      let door: { x: number; y: number } | undefined;
      const build = houses.buildHouses;
      vi.spyOn(houses, "buildHouses").mockImplementation((...args) => {
        const built = build(...args);
        door = built[0]?.doorAt;
        return built;
      });
      const restore = vi.spyOn(houses, "restoreHouseDoors");
      let restoreCountAtDamage = -1;
      const damage = (map: GameMap): void => {
        if (!door) throw new Error("Real house stage did not build a door");
        map.lowerTiles[door.y * map.width + door.x] = TILE.GRASS;
        restoreCountAtDamage = restore.mock.calls.length;
      };
      if (stage === "roads") {
        const real = roads.paintVillageRoadsChecked;
        vi.spyOn(roads, "paintVillageRoadsChecked").mockImplementation(args => { const r = real(args); damage(args.map); return r; });
      } else if (stage === "terrain") {
        const real = terrain.runTerrainConstraintPass;
        vi.spyOn(terrain, "runTerrainConstraintPass").mockImplementation((...args) => { const r = real(...args); damage(args[1]); return r; });
      } else if (stage === "fences") {
        const real = fences.placeHouseLotFences;
        vi.spyOn(fences, "placeHouseLotFences").mockImplementation((...args) => { real(...args); damage(args[0]); });
      } else if (stage === "decor") {
        const real = decor.placeVillageDecor;
        vi.spyOn(decor, "placeVillageDecor").mockImplementation((...args) => { const r = real(...args); damage(args[1]); return r; });
      } else if (stage === "landscape") {
        const real = landscape.dressVillageLandscape;
        vi.spyOn(landscape, "dressVillageLandscape").mockImplementation((...args) => { const r = real(...args); damage(args[0]); return r; });
      } else {
        const real = placement.scrubPlacementConflicts;
        vi.spyOn(placement, "scrubPlacementConflicts").mockImplementation((...args) => { const r = real(...args); damage(args[1]); return r; });
      }
      const result = runTool(ctx, "build_village", { houses: 4, seed: 7, interior: false,
        ...(stage === "terrain" ? { theme: "river forest", forestDensity: "dense" } : {}),
        ...(stage === "landscape" ? { width: 100, height: 100, edgeTrees: "none" } : {}),
      });
      expect(restoreCountAtDamage).toBeGreaterThanOrEqual(0);
      expect(result.ok, JSON.stringify(result.issues)).toBe(false);
      expect(result.issues?.[0]?.code).toBe("protected-house-write");
      expect(restore.mock.calls).toHaveLength(restoreCountAtDamage);
      expect(serialize(ctx.project)).toBe(before);
    }, 90_000,
  );
});

describe("integrated village production surface", () => {
  it.each([
    { size: 50, seed: 7, kitId: "blue-stone", templateId: "rooftop-deck" },
    { size: 50, seed: 9, kitId: "bright-plaster", templateId: "l" },
    { size: 50, seed: 11, kitId: "amber-wood", templateId: "annex" },
    { size: 50, seed: 13, kitId: "slate-wood", templateId: "rect-2f" },
    { size: 50, seed: 15, kitId: "timber-hall", templateId: "rect-large" },
    { size: 50, seed: 17, kitId: "aframe-stone", templateId: "aframe-mid" },
    { size: 100, seed: 41, kitId: "blue-stone", templateId: "rooftop-deck" },
  ])("seals $kitId/$templateId on $size snow map, reloads and accepts useful fill/forest outside", ({ size, seed, kitId, templateId }) => {
    const ctx = { project: createExistingProject(size) };
    let sealed: HouseSnapshot[] = [];
    const paint = roads.paintVillageRoadsChecked;
    vi.spyOn(roads, "paintVillageRoadsChecked").mockImplementation(args => {
      sealed = captureHouseProtection(args.draft);
      expect(sealed).toHaveLength(1);
      return paint(args);
    });
    const result = runTool(ctx, "build_village", {
      mapId: "map_existing", houses: 1, housePlans: [{ kitId, templateId }],
      interior: true, npcCount: 2, groundTheme: "snow", seed,
      // Forest composition is exercised explicitly after reload below; avoid the
      // unrelated quadratic natural conifer scatter on the 100x100 fixture.
      ...(size === 100 ? { edgeTrees: "none" } : {}),
    });
    expect(result.ok, JSON.stringify(result.issues)).toBe(true);
    expect(result.data).toMatchObject({ housesBuilt: 1, doorsConnected: 1, doorsIntact: 1, roadComponents: 1, interiorCount: 1 });
    expect(captureHouseProtection(ctx.project)).toEqual(sealed);
    ctx.project = deserialize(serialize(ctx.project));
    expect(captureHouseProtection(ctx.project)).toEqual(sealed);
    const map = ctx.project.maps.map_existing!;
    const region = map.layoutPlan!.regions.find(r => r.role === "house")!;
    expect(region.kitId).toBe(kitId);
    expect(region.shape).toBe(templateId);
    expect(isPassable(ctx.project, map, region.front!.x, region.front!.y)).toBe(true);
    const step = map.events.find(e => e.x === region.front!.x && e.y === region.front!.y && e.id.endsWith("_step"))!;
    expect(step.pages?.[0]?.trigger).toEqual({ kind: "playerTouch" });
    expect(step.pages?.[0]?.commands[0]).toMatchObject({ kind: "callMapEvent" });
    if (templateId === "rooftop-deck") {
      const ladder = roofDeckLadderAttachment(region, region.doorAt!);
      expect(sealed[0]!.cells).toEqual(expect.arrayContaining([expect.objectContaining({ ...ladder, upper: 322 })]));
      expect(isPassable(ctx.project, map, ladder.x, ladder.y)).toBe(true);
      expect(sealed[0]!.cells).toHaveLength(region.w * (region.h + 1) + 1);
    }
    // Sand includes the ridge and yard but cannot change a single owned layer/stack value.
    const fill = runTool(ctx, "fill_region", { mapId: map.id, material: "모래", clearUpper: false,
      rect: { x: region.x - 1, y: region.y - 1, w: region.w + 2, h: region.h + 2 } });
    expect(fill.ok, JSON.stringify(fill.issues)).toBe(true);
    expect(fill.data).toMatchObject({ mutatedCells: expect.any(Number) });
    expect(Number((fill.data as { mutatedCells: number }).mutatedCells)).toBeGreaterThan(0);
    const forest = runTool(ctx, "place_props", { mapId: map.id, material: "침엽수", density: "dense", seed: 7,
      area: { x: 0, y: 0, w: size, h: size } });
    expect(forest.ok, JSON.stringify(forest.issues)).toBe(true);
    expect(Number((forest.data as { placed: number }).placed)).toBeGreaterThan(0);
    expect(captureHouseProtection(ctx.project)).toEqual(sealed);
  }, 90_000);

  it("discards a real failed-look attempt without leaving project-wide house seals", () => {
    const ctx = { project: createExistingProject() };
    const acceptedMap = structuredClone(ctx.project.maps.map_existing);
    const real = evaluation.evaluateVillageLook;
    const attemptMaps: string[] = [];
    vi.spyOn(evaluation, "evaluateVillageLook").mockImplementation(args => {
      const report = real(args);
      attemptMaps.push(args.mapId);
      return { ...report, ok: attemptMaps.length === 2 };
    });
    const result = runTool(ctx, "run_village_pipeline", { theme: "quiet village", houses: [{}, {}, {}, {}],
      seed: 7, maxAttempts: 2 });
    expect(result.ok, JSON.stringify(result.issues)).toBe(true);
    expect(result.data).toMatchObject({ ok: true, attempt: 2 });
    expect(attemptMaps).toHaveLength(2);
    expect(ctx.project.maps[attemptMaps[0]!]).toBeUndefined();
    expect(ctx.project.maps[attemptMaps[1]!]).toBeDefined();
    expect(ctx.project.maps.map_existing).toEqual(acceptedMap);
    expect(captureHouseProtection(ctx.project).every(h => h.mapId === attemptMaps[1])).toBe(true);
  }, 90_000);

  it("rejects corruption inside the real road attempt before its retry can restore the house", () => {
    const ctx = { project: createEmptyToolProject("road attempt") };
    const before = serialize(ctx.project);
    const real = roads.paintVillageRoadsChecked;
    let writes = 0;
    vi.spyOn(roads, "paintVillageRoadsChecked").mockImplementation(args => {
      const house = captureHouseProtection(args.draft)[0]!;
      const cell = house.cells[0]!;
      const index = cell.y * args.map.width + cell.x;
      // Actual road painter still executes. A write to any road tile injects house
      // damage once, modelling a buggy direct stage writer inside the retry loop.
      args.map.lowerTiles = new Proxy(args.map.lowerTiles, {
        set(target, key, value) {
          if (writes++ === 0) target[index] = cell.lower === TILE.GRASS ? TILE.EMPTY : TILE.GRASS;
          return Reflect.set(target, key, value);
        },
      });
      return real(args);
    });
    const result = runTool(ctx, "build_village", { houses: 4, seed: 7, interior: false });
    expect(writes).toBeGreaterThan(0);
    expect(result.ok).toBe(false);
    expect(result.issues?.[0]?.code).toBe("protected-house-write");
    expect(serialize(ctx.project)).toBe(before);
  });
});

describe("existing target finishing boundary", () => {
  it("keeps the accepted start outside new candidates so facade start restoration cannot reopen a sealed house", () => {
    const control = { project: createExistingProject() };
    const built = runTool(control, "build_village", { mapId: "map_existing", houses: 4, seed: 7, interior: false });
    expect(built.ok).toBe(true);
    const first = control.project.maps.map_existing!.layoutPlan!.regions.find(r => r.role === "house")!;
    const ctx = { project: createExistingProject() };
    ctx.project.startPos = { ...first.doorAt! };
    let sealed: HouseSnapshot[] = [];
    const paint = roads.paintVillageRoadsChecked;
    vi.spyOn(roads, "paintVillageRoadsChecked").mockImplementation(args => {
      sealed = captureHouseProtection(args.draft);
      return paint(args);
    });
    const result = runTool(ctx, "author_village", { target: { kind: "existing", mapId: "map_existing" },
      houseCount: 4, countPolicy: "exact", seed: 7, interior: false });
    expect(result.ok, JSON.stringify(result.issues)).toBe(true);
    expect(captureHouseProtection(ctx.project)).toEqual(sealed);
    expect(sealed.flatMap(h => h.cells).some(c => c.x === first.doorAt!.x && c.y === first.doorAt!.y)).toBe(false);
  }, 90_000);
});
