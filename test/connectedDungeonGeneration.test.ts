import { describe, expect, it } from "vitest";
import { createBlankProject } from "@/project/defaults";
import { serialize, deserialize } from "@/project/io";
import { getRoomKit } from "@/editor/roomHarness/registry";
import { runRoomPipeline, startRoomSession, advanceRoomBuild } from "@/editor/roomHarness/engine";
import { evaluateConnectedDungeon } from "@/editor/dungeonGeneration/connected";
import { dungeonFloorMask, resolveDungeonPath, validateDungeonGraph, type DungeonGraph } from "@/editor/dungeonGeneration/topology";
import { runTool } from "@/editor/tools/toolRunner";
import { toOpenAiTools } from "@/editor/tools/toolRegistry";
import type { DungeonRoomPlan } from "@/editor/dungeonRoomPipeline";

const kit = getRoomKit("dungeon-room-v1")!;
describe("connected dungeon production generation", () => {
  for (const theme of ["stone", "lava", "ice"] as const) for (const seed of [1, 7, 41]) {
    it(`${theme}/${seed}: authored rooms remain reachable with supported walls and props`, () => {
      const project = createBlankProject(), beforeTilesets = structuredClone(project.tilesets);
      const result = runRoomPipeline(project, kit.kitId, { mapId: "new_dungeon", width: 64, height: 52, theme, seed, character: theme === "stone" ? "mine" : "crystal" });
      const map = project.maps.new_dungeon!, plan = map.roomHarnessPlan!.plan as DungeonRoomPlan;
      expect((result.data as { ok: boolean; warnings: string[] }).warnings).toEqual([]);
      expect(evaluateConnectedDungeon(map, plan, project).issues).toEqual([]);
      expect(project.tilesets).toEqual(beforeTilesets);
      expect(plan.layout).toBe("connected");
      expect(new Set(map.lowerTiles).size).toBeGreaterThan(4);
      if (theme === "stone") expect(evaluateConnectedDungeon(map, plan, project).metrics.railCells).toBeGreaterThan(10);
    });
  }
  it("explicit room roles and bent connections are retained, with local confluence relief", () => {
    const project = createBlankProject();
    const graph = { rooms: [
      { id: "entry", role: "entrance", x: 9, y: 43, width: 14, height: 12 },
      { id: "main", role: "crystal", x: 32, y: 29, width: 26, height: 20 },
      { id: "west", role: "collapse", x: 13, y: 22, width: 16, height: 14 },
      { id: "east", role: "worksite", x: 51, y: 28, width: 18, height: 14 },
      { id: "north", role: "worksite", x: 44, y: 10, width: 20, height: 12 },
      { id: "upper", role: "collapse", x: 13, y: 8, width: 14, height: 10 },
    ], connections: [
      { from: "entry", to: "main", via: [{ x: 16, y: 40 }, { x: 24, y: 38 }, { x: 29, y: 34 }] },
      { from: "west", to: "main", via: [{ x: 19, y: 27 }] },
      { from: "main", to: "north", via: [{ x: 36, y: 23 }, { x: 39, y: 18 }] },
      { from: "entry", to: "west", via: [{ x: 7, y: 36 }, { x: 8, y: 29 }] },
      { from: "main", to: "east" }, { from: "west", to: "upper" }, { from: "upper", to: "north" },
    ] };
    const ctx = { project };
    const result = runTool(ctx, "run_dungeon_room_pipeline", { mapId: "designed", theme: "stone", character: "mine", width: 64, height: 52, graph }, { dryRun: false });
    expect(result.ok, result.summary).toBe(true);
    const map = ctx.project.maps.designed!;
    expect((map.roomHarnessPlan!.plan as DungeonRoomPlan).graph).toEqual(graph);
    expect(map.lowerTiles.some(t => t === 192 || t === 193)).toBe(true);
    expect(map.upperTiles.some(t => [252, 253, 254].includes(t))).toBe(true);
  });
  it("keeps already seeded user collision and priority rules unchanged", () => {
    const project = createBlankProject(), tileset = project.tilesets.easyrpg_chipset_dungeon!;
    for (const tile of [262, 292, 320, 321, 350, 351, 322, 323, 352, 353]) {
      tileset.passability[tile] = { up: false, down: false, left: false, right: false };
      tileset.priority[tile] = "lower";
    }
    const before = structuredClone(project.tilesets);
    const result = runRoomPipeline(project, kit.kitId, { mapId: "authored_rules", theme: "ice", character: "crystal", width: 64, height: 52, seed: 7 });
    expect((result.data as { ok: boolean }).ok).toBe(true);
    expect(project.tilesets).toEqual(before);
  });
  it("same seed is reproducible, different seeds change room topology and silhouette", () => {
    const a = kit.parsePlan({ mapId: "a", theme: "stone", seed: 1 }) as DungeonRoomPlan;
    const b = kit.parsePlan({ mapId: "a", theme: "stone", seed: 1 }) as DungeonRoomPlan;
    const c = kit.parsePlan({ mapId: "a", theme: "stone", seed: 29 }) as DungeonRoomPlan;
    expect(a).toEqual(b);
    expect(kit.runPipeline(a).map).toEqual(kit.runPipeline(b).map);
    expect(a.graph).not.toEqual(c.graph);
    expect(kit.runPipeline(a).map.lowerTiles).not.toEqual(kit.runPipeline(c).map.lowerTiles);
  });
  it("staged and one-shot builds match and the graph survives serialization", () => {
    const project = createBlankProject(), args = { mapId: "staged", theme: "lava", width: 48, height: 40, seed: 8 };
    const res = startRoomSession(project, kit.kitId, args);
    const sessionId = (res.data as { sessionId: string }).sessionId;
    for (let i = 1; i < kit.buildOrder.length; i++) advanceRoomBuild(project, sessionId);
    const staged = structuredClone(project.maps.staged!);
    runRoomPipeline(project, kit.kitId, { ...args, mapId: "one" });
    expect(staged.lowerTiles).toEqual(project.maps.one!.lowerTiles);
    expect(staged.upperTiles).toEqual(project.maps.one!.upperTiles);
    const loaded = deserialize(serialize(project)), map = loaded.maps.staged!;
    expect(map.roomHarnessPlan).toEqual(staged.roomHarnessPlan);
    expect(evaluateConnectedDungeon(map, map.roomHarnessPlan!.plan as DungeonRoomPlan, loaded).issues).toEqual([]);
  });
  it("rejects disconnected graphs and excessive dimensions before changing maps", () => {
    const project = createBlankProject(), before = structuredClone(project.maps);
    expect(() => runRoomPipeline(project, kit.kitId, { mapId: "invalid", theme: "stone", width: 48, height: 40, graph: { rooms: [{ id: "a", role: "entrance", x: 8, y: 8, width: 9, height: 9 }, { id: "b", role: "chamber", x: 30, y: 30, width: 9, height: 9 }], connections: [] } })).toThrow("disconnected");
    expect(() => kit.parsePlan({ mapId: "too_big", theme: "stone", width: 1000000, height: 1000000 })).toThrow();
    expect(project.maps).toEqual(before);
    expect(validateDungeonGraph({ rooms: [], connections: [] }, 48, 40).length).toBeGreaterThan(0);
  });
  it("reports an erased supporting wall instead of accepting a fixed-coordinate template", () => {
    const project = createBlankProject();
    runRoomPipeline(project, kit.kitId, { mapId: "damage", theme: "stone", seed: 9 });
    const map = project.maps.damage!, plan = map.roomHarnessPlan!.plan as DungeonRoomPlan;
    const wall = map.lowerTiles.indexOf(226); expect(wall).toBeGreaterThan(-1);
    map.lowerTiles[wall] = 421;
    expect(evaluateConnectedDungeon(map, plan, project).issues.some(s => s.includes("ceiling wall"))).toBe(true);
  });
  it("AI generate_map uses the shared generator and evaluation works after reload", () => {
    const ctx = { project: createBlankProject() };
    const result = runTool(ctx, "generate_map", { id: "tool_dungeon", theme: "cave", width: 48, height: 40, seed: 12 }, { dryRun: false });
    expect(result.ok, result.summary).toBe(true);
    const map = ctx.project.maps.tool_dungeon!;
    expect(map.roomHarnessPlan?.kitId).toBe(kit.kitId);
    expect((map.roomHarnessPlan!.plan as DungeonRoomPlan).layout).toBe("connected");
    const loaded = { project: deserialize(serialize(ctx.project)) };
    const evaluation = runTool(loaded, "evaluate_dungeon_room", { mapId: "tool_dungeon" });
    expect((evaluation.data as { report: { issues: string[] } }).report.issues).toEqual([]);
    const schema = toOpenAiTools().find(t => t.function.name === "run_dungeon_room_pipeline")!;
    expect(schema.function.parameters.properties).toHaveProperty("graph");
    expect(schema.function.parameters.properties).toHaveProperty("path");
  });
  it("path follows the request, and omitting it keeps the historical silhouette", () => {
    expect(resolveDungeonPath({ character: "crypt" })).toBe("straight");
    expect(resolveDungeonPath({ character: "cavern" })).toBe("cave");
    expect(resolveDungeonPath({ character: "crypt", path: "winding" })).toBe("winding");
    const graph: DungeonGraph = { rooms: [
      { id: "mouth", role: "entrance", x: 16, y: 40, width: 12, height: 10 },
      { id: "hall", role: "chamber", x: 40, y: 40, width: 14, height: 12 },
      { id: "altar", role: "shrine", x: 40, y: 18, width: 12, height: 10 },
    ], connections: [
      { from: "mouth", to: "hall", width: 8, via: [{ x: 28, y: 40 }] },
      { from: "hall", to: "altar", width: 8, via: [{ x: 40, y: 29 }] },
    ] };
    const mask = (path?: "straight" | "cave" | "winding", character: "cavern" | "crypt" = "cavern") => dungeonFloorMask(56, 48, graph, { seed: 4, character, ...(path ? { path } : {}) });
    const count = (path?: "straight" | "cave" | "winding") => mask(path).filter(Boolean).length;
    expect(mask()).toEqual(mask());
    expect(mask(undefined, "crypt")).toEqual(mask(undefined, "crypt"));
    expect(count("cave")).toBeGreaterThan(count("straight"));
    expect(count("winding")).not.toBe(count("straight"));
    expect(mask()).not.toEqual(mask("straight"));
    const project = createBlankProject();
    for (const path of ["straight", "cave", "winding"] as const) {
      const result = runRoomPipeline(project, kit.kitId, { mapId: `path_${path}`, theme: "lava", character: "cavern", path, width: 56, height: 48, seed: 4, graph });
      expect((result.data as { ok?: boolean }).ok, result.summary).toBe(true);
      expect((project.maps[`path_${path}`]!.roomHarnessPlan!.plan as DungeonRoomPlan).path).toBe(path);
    }
    expect(() => runRoomPipeline(createBlankProject(), kit.kitId, { mapId: "bad_path", theme: "stone", path: "maze", width: 32, height: 32 })).toThrow(/path/);
  });
  it("returns outside, marks the far room, and patrols a known troop", () => {
    const project = createBlankProject();
    const outside = project.startMapId;
    project.database.troops.push({ id: "troop_bat", name: "박쥐", enemyIds: [], members: [], autoAlign: true, battleEventPages: [] });
    const result = runRoomPipeline(project, kit.kitId, {
      mapId: "linked", theme: "stone", character: "crypt", path: "straight", width: 48, height: 40, seed: 3,
      linkMapId: outside, landmark: "gate", pressure: "patrol", troopId: "troop_bat",
    });
    expect((result.data as { ok?: boolean }).ok, result.warnings?.join("; ")).toBe(true);
    const map = project.maps.linked!;
    const leaves = (events: typeof map.events, mapId: string) => events?.some((event) => event.pages[0]?.commands.some((command) => command.kind === "transfer" && command.mapId === mapId));
    expect(leaves(map.events, outside)).toBe(true);
    expect(leaves(project.maps[outside]!.events, "linked")).toBe(true);
    expect(map.upperTiles.includes(298)).toBe(true);
    expect(map.fieldSpawns?.some((spawn) => spawn.troopId === "troop_bat" && spawn.chase)).toBe(true);
  });
});
