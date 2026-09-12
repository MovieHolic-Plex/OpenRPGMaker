import { afterEach, describe, expect, it, vi } from "vitest";
import { cloneDetachedDraft } from "@/editor/detachedDraftMemory";
import { createEmptyToolProject } from "@/editor/tools/emptyProject";
import { runTool } from "@/editor/tools/toolRunner";
import { normalizeVillagePlan } from "@/editor/tools/villagePlan";
import { countTreeCells, countWaterCells } from "@/editor/tools/villageEvaluate";
import { captureHouseProtection } from "@/editor/tools/houseProtection";
import { deserialize, serialize } from "@/project/io";
import * as roads from "@/editor/tools/village/roads";
import * as terrain from "@/editor/tools/villageTerrainPass";
import * as decor from "@/editor/tools/village/decor";
import { loadSession } from "@/editor/tools/villageSession";
import { DIRT_ROAD_TILE } from "@/project/defaults/chipsetMapping";

afterEach(() => vi.restoreAllMocks());

describe("village construction stages", () => {
  it.each(["normal", "dense"])("builds houses/roads, then %s trees, then water and decoration", density => {
    const ctx = { project: createEmptyToolProject("stage contract") };
    const stages: string[] = [];
    let sealed: ReturnType<typeof captureHouseProtection> = [];
    const paintRoads = roads.paintVillageRoadsChecked;
    vi.spyOn(roads, "paintVillageRoadsChecked").mockImplementation(args => {
      sealed = captureHouseProtection(args.draft);
      expect(sealed).toHaveLength(4);
      expect(countTreeCells(args.map)).toBe(0);
      expect(countWaterCells(args.map)).toBe(0);
      stages.push("roads");
      return paintRoads(args);
    });
    const paintTerrain = terrain.runTerrainConstraintPass;
    vi.spyOn(terrain, "runTerrainConstraintPass").mockImplementation((...args) => {
      const phase = args[6];
      if (phase === "water") {
        expect(countTreeCells(args[1])).toBeGreaterThan(0);
        expect(countWaterCells(args[1])).toBe(0);
        const masks = terrain.buildTerrainConstraintMasks(args[1], args[2], args[4], args[5]);
        for (const rect of masks.waterRects) {
          expect(countTreeCells(args[1], rect)).toBe(0);
        }
      }
      stages.push(String(phase));
      const result = paintTerrain(...args);
      expect(captureHouseProtection(args[0])).toEqual(sealed);
      return result;
    });
    const paintDecor = decor.placeVillageDecor;
    vi.spyOn(decor, "placeVillageDecor").mockImplementation((...args) => {
      expect(countWaterCells(args[1])).toBeGreaterThan(0);
      stages.push("decoration");
      return paintDecor(...args);
    });
    const result = runTool(ctx, "build_village", {
      theme: "강과 숲이 있는 마을", houses: 4, seed: 7,
      interior: false, npcCount: 0, forestDensity: density, pathStyle: "dirt",
    });
    expect(result.ok, JSON.stringify(result.issues)).toBe(true);
    expect(stages).toEqual(["roads", "trees", "water", "decoration"]);
    expect(result.data).toMatchObject({ doorsConnected: 4, doorsIntact: 4, roadComponents: 1 });
    expect(captureHouseProtection(deserialize(serialize(ctx.project)))).toEqual(sealed);
  });

  it.each([DIRT_ROAD_TILE.BODY, 260])("rejects final water over an existing road/tree (%i) without painting", tile => {
    const ctx = { project: createEmptyToolProject("water protection") };
    expect(runTool(ctx, "create_map", { id: "water-test", name: "Water", width: 20, height: 20 }).ok).toBe(true);
    const map = ctx.project.maps["water-test"]!;
    const index = 6 * map.width + 6;
    if (tile === 260) map.upperTiles[index] = tile;
    else map.lowerTiles[index] = tile;
    const before = serialize(ctx.project);
    expect(() => terrain.applyTerrainPassFromMasks(ctx.project, map, {
      width: 20, height: 20, roles: new Array(400).fill("buildable"),
      buildableRect: { x: 0, y: 0, w: 20, h: 20 },
      waterRects: [{ x: 1, y: 1, w: 10, h: 10 }], forestRects: [], notes: [],
    }, [], undefined, undefined, "water")).toThrow(/수역 예정지/);
    expect(serialize(ctx.project)).toBe(before);
  });

  it("normalizes a model's water-first plan to houses/roads, trees, water and decoration", () => {
    const result = normalizeVillagePlan({ theme: "강과 숲이 있는 마을", buildOrder: ["look", "water", "map", "settlement"] });
    expect(result.ok).toBe(true);
    expect(result.plan.buildOrder).toEqual(["plan", "map", "settlement", "forest_conifer", "forest_big", "water", "decoration", "critique", "look"]);
    expect(result.issues.some(issue => issue.message.includes("정규화"))).toBe(true);
  });

  it.each([
    { theme: "평범한 마을", seed: 7 },
    { theme: "서쪽 강과 호수가 있는 숲 마을", seed: 1 },
  ])("retains reservations and decoration across detached drafts: $theme", ({ theme, seed }) => {
    const ctx = { project: createEmptyToolProject("session stages") };
    const started = runTool(ctx, "start_village_session", { theme, seed, interior: false, budgetTurns: 16 });
    expect(started.ok, JSON.stringify(started.issues)).toBe(true);
    const sessionId = (started.data as { sessionId?: string; id?: string }).sessionId
      ?? (started.data as { id: string }).id;
    let session = loadSession(ctx.project, sessionId)!;
    expect(session).toBeDefined();
    for (let i = 0; i < 10 && session.checklist.find(item => item.id === "settlement")?.status !== "done"; i++) {
      const result = runTool(ctx, "advance_village_build", { sessionId });
      expect(result.ok, JSON.stringify(result.issues)).toBe(true);
      session = loadSession(ctx.project, sessionId)!;
    }
    expect(session.decorationPlan?.houses.length).toBeGreaterThan(0);
    expect(session.checklist.find(item => item.id === "decoration")?.status).not.toBe("done");
    const paintTerrain = terrain.runTerrainConstraintPass;
    vi.spyOn(terrain, "runTerrainConstraintPass").mockImplementation((...args) => {
      if (args[6] === "water") {
        const masks = terrain.buildTerrainConstraintMasks(args[1], args[2], args[4], args[5]);
        for (const rect of masks.waterRects) expect(countTreeCells(args[1], rect)).toBe(0);
      }
      return paintTerrain(...args);
    });
    ctx.project = cloneDetachedDraft(ctx.project);
    for (let i = 0; i < 10 && session.checklist.find(item => item.id === "decoration")?.status !== "done"; i++) {
      const result = runTool(ctx, "advance_village_build", { sessionId });
      expect(result.ok, JSON.stringify(result.issues)).toBe(true);
      session = loadSession(ctx.project, sessionId)!;
    }
    expect(session.checklist.find(item => item.id === "decoration")?.status).toBe("done");
    const reloaded = deserialize(serialize(ctx.project));
    expect(reloaded.maps[session.mapId!]).toEqual(ctx.project.maps[session.mapId!]);
  }, 60_000);
});
