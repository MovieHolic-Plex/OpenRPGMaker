import { describe, expect, it } from "vitest";
import { createBlankProject } from "@/project/defaults";
import { TILE } from "@/project/defaults/constants";
import { AUTHOR_VILLAGE_TOOL } from "@/editor/tools/authorVillageTool";
import { withVillageMorphologyDefault } from "@/editor/tools/village/defaultMorphology";
import { planVillageRiver } from "@/editor/tools/village/riverPlan";
import { assertRiverVillage } from "@/editor/tools/village/riverValidation";
import { morphologyDebugSink } from "@/editor/tools/village/morphologyBuild";
import { scrubPlacementConflicts, validateLayoutPlacement } from "@/project/lint/layoutPlacementValidate";
import { animationKeyForTile } from "@/project/defaults/chipsetAnimation";

const key = (p: { x: number; y: number }) => `${p.x},${p.y}`;

describe("river village", () => {
  it("reserves a connected boundary-to-boundary channel within an offset selection", () => {
    const area = { x: 7, y: 11, w: 78, h: 44 };
    const river = planVillageRiver(area, 17, 5);
    const cells = new Set(river.cells.map(key)), queue = [river.cells[0]!], seen = new Set([key(queue[0]!)]);
    for (let i = 0; i < queue.length; i++) {
      const p = queue[i]!;
      for (const [dx, dy] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) {
        const q = { x: p.x + dx!, y: p.y + dy! };
        if (cells.has(key(q)) && !seen.has(key(q))) { seen.add(key(q)); queue.push(q); }
      }
    }
    expect(seen.size).toBe(cells.size);
    expect(Math.min(...river.cells.map(p => p.y))).toBe(area.y);
    expect(Math.max(...river.cells.map(p => p.y))).toBe(area.y + area.h - 1);
    expect(river.cells.every(p => p.x >= area.x && p.x < area.x + area.w)).toBe(true);
    expect(river.bridge.every(p => cells.has(key(p)))).toBe(true);
    expect(planVillageRiver(area, 18, 5).cells).not.toEqual(river.cells);
  });

  it("defaults only blank unbounded targets and preserves explicit styles, themes and authored terrain", () => {
    const p = createBlankProject(), map = p.maps[p.startMapId]!;
    const args = { target: { kind: "existing", mapId: map.id }, houseCount: 8 };
    expect(withVillageMorphologyDefault(p, args).morphology).toBe("river");
    for (const extra of [{ morphology: "green" }, { theme: "산골" }, { settlementLayout: "clusters" }, { presetId: "saved" }]) {
      expect(withVillageMorphologyDefault(p, { ...args, ...extra })).toEqual({ ...args, ...extra });
    }
    const selected = { ...args, target: { ...args.target, bounds: { x: 0, y: 0, w: 16, h: 16 } } };
    expect(withVillageMorphologyDefault(p, selected)).toEqual(selected);
    map.lowerTiles[0] = TILE.EMPTY;
    expect(withVillageMorphologyDefault(p, args).morphology).toBeUndefined();
  });

  it("builds eight houses across a real bridge, preserves it during cleanup and rejects a severed crossing", () => {
    const p = createBlankProject();
    AUTHOR_VILLAGE_TOOL.run(p, { target: { kind: "existing", mapId: p.startMapId }, houseCount: 8,
      npcCount: 0, seed: 17, countPolicy: "exact", interior: false });
    const map = p.maps[p.startMapId]!, plan = morphologyDebugSink.lastPlan!, river = plan.river!;
    expect(river).toBeDefined();
    expect(map.tilesetId).toBe("forest_harmony");
    expect(map.layoutPlan!.regions.filter(r => r.role === "house").every(r => !r.hasFence)).toBe(true);
    // 강은 움직이는 0번 물로 칠한다 — 1517~1563 호수는 프레임이 한 장이라 멈춰 보였다(2026-09-27).
    const riverTiles = river.cells.map(cell => map.lowerTiles[cell.y * map.width + cell.x]!);
    expect(riverTiles.every(tile => animationKeyForTile(tile) !== null)).toBe(true);
    expect(riverTiles.some(tile => tile >= 1517 && tile <= 1563)).toBe(false);
    const oldTrees = new Set([260, 261, 262, 263, 290, 291, 292, 293]);
    expect([...map.lowerTiles, ...map.upperTiles].some(tile => oldTrees.has(tile))).toBe(false);
    const fronts = map.layoutPlan!.regions.filter(r => r.role === "house").map(r => r.front!);
    expect(fronts).toHaveLength(8);
    expect(() => assertRiverVillage(p, map, river, fronts, p.startPos)).not.toThrow();
    scrubPlacementConflicts(p, map);
    expect(river.bridge.every(cell => map.upperTiles[cell.y * map.width + cell.x] === 199)).toBe(true);
    expect(validateLayoutPlacement(p, { mapId: map.id }).filter(i => i.code === "layout-prop-on-water")).toEqual([]);
    for (const cell of river.bridge) map.upperTiles[cell.y * map.width + cell.x] = TILE.EMPTY;
    expect(() => assertRiverVillage(p, map, river, fronts, p.startPos)).toThrow();
  });

  it("fences only requested important houses and respects a manor opt-out", () => {
    const p = createBlankProject();
    AUTHOR_VILLAGE_TOOL.run(p, { target: { kind: "existing", mapId: p.startMapId }, houseCount: 8,
      housePlans: Array.from({ length: 8 }, (_, i) => ({ program: i < 2 ? "manor" : "dwelling", ...(i === 1 ? { fence: false } : {}) })),
      npcCount: 0, seed: 17, countPolicy: "exact", interior: false });
    const houses = p.maps[p.startMapId]!.layoutPlan!.regions.filter(r => r.role === "house");
    expect(houses.map(house => house.hasFence)).toEqual([true, false, false, false, false, false, false, false]);
  });
});
