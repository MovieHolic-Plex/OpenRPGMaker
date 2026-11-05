// 2026-11-05 imageplan-follow: a ring dungeon read from an image plan lost its ring — the positioned layout pushed rooms that lacked
// wall-face rows and replaced the drawn corridors with its own L-corridors. Plan cells now keep their rows and corridors as drawn.
import { describe, expect, it } from "vitest";
import { createBlankProject } from "@/project/defaults";
import { AUTHOR_BEODEUL_DUNGEON_ALIAS } from "@/editor/tools/dungeonTools";
import { dungeonPlanFromCells, parseCellMap } from "@/ai/imagePlanCells";
import { runToolDefinition } from "@/editor/tools/toolRunner";

const ring = [
  "________________________",
  "____......____......____",
  "____......====......____",
  "____..A...____......____",
  "_____=__________=_______",
  "_____=___......_=_______",
  "_____=___..BB.._=_______",
  "_____=___......_=_______",
  "_____=__________=_______",
  "____......____......____",
  "____......====......____",
  "____......____......____",
];

describe("author_dungeon keeps an image plan's ring", () => {
  it("places every room where the plan put it and lays the drawn corridors", () => {
    const plan = dungeonPlanFromCells(parseCellMap({ cells: ring, landmarks: [{ id: "A", kind: "altar", x: 6, y: 3 }] }, "dungeon", 24, 12)!);
    const project = createBlankProject();
    const res = AUTHOR_BEODEUL_DUNGEON_ALIAS.run(project, { mapId: project.startMapId!, type: "castle", seed: 3, populate: false, rooms: plan.rooms, links: plan.links });
    expect((res.warnings ?? []).filter((w) => w.includes("옮겼다"))).toEqual([]);
    const rooms = (res.data as { rooms: { id: string; x: number; y: number }[] }).rooms;
    const at = (id: string) => rooms.find((r) => r.id === id)!;
    expect(at("r2").y).toBe(at("r3").y);
    expect(at("r5").y).toBe(at("r1").y);
    expect(at("r3").x - at("r2").x).toBe(at("r1").x - at("r5").x);
    const corridors = (res.data as { corridors: { from: string; to: string; w: number; h: number }[] }).corridors;
    const side = corridors.filter((c) => [c.from, c.to].sort().join() === "r2,r5");
    expect(side.length).toBe(1);
    expect(side.every((c) => c.w === 2)).toBe(true);
  });

  it("passes argument validation on the assistant's tool path and keeps a vertical corridor as one piece", () => {
    const plan = dungeonPlanFromCells(parseCellMap({ cells: ring, landmarks: [] }, "dungeon", 24, 12)!);
    const vertical = plan.links.find((l) => [l.from, l.to].sort().join() === "r2,r5")!;
    expect(vertical.rects.length).toBe(1);
    const project = createBlankProject();
    const res = runToolDefinition({ project }, AUTHOR_BEODEUL_DUNGEON_ALIAS, { mapId: project.startMapId!, type: "castle", seed: 3, populate: false, rooms: plan.rooms, links: plan.links });
    expect(res.ok, res.summary).toBe(true);
    expect((res.warnings ?? []).filter((w) => w.includes("빌더 통로로 이었다"))).toEqual([]);
  });

  it("stretches a one-row neck across the wall-face shift and keeps an L corridor off a third room", () => {
    const grid = (h: number) => Array.from({ length: h }, () => "_".repeat(30).split(""));
    const put = (g: string[][], x0: number, y0: number, w: number, h: number, ch: string) => { for (let y = y0; y < y0 + h; y += 1) for (let x = x0; x < x0 + w; x += 1) g[y]![x] = ch; };
    const neck = grid(16); put(neck, 2, 1, 24, 3, "."); put(neck, 10, 4, 2, 1, "="); put(neck, 2, 5, 24, 9, ".");
    const ell = grid(24); put(ell, 1, 1, 10, 5, "."); put(ell, 4, 6, 2, 8, "="); put(ell, 4, 14, 18, 2, "="); put(ell, 20, 16, 2, 2, "="); put(ell, 16, 18, 12, 5, "."); put(ell, 14, 2, 12, 7, ".");
    // a third room stacked above the target pushes it down by the wall-face gap, so the drawn leg is stretched past that room
    const third = grid(26); put(third, 1, 1, 8, 3, "."); put(third, 4, 4, 2, 14, "="); put(third, 4, 18, 20, 2, "="); put(third, 20, 6, 8, 8, "."); put(third, 20, 15, 8, 1, "."); put(third, 18, 20, 10, 5, ".");
    for (const g of [neck, ell, third]) {
      const plan = dungeonPlanFromCells(parseCellMap({ cells: g.map((r) => r.join("")) }, "dungeon", 30, g.length)!);
      for (const link of plan.links) for (const r of link.rects) {
        const others = plan.rooms.filter((o) => o.id !== link.from && o.id !== link.to);
        expect(others.some((o) => r.x < o.x + o.w && o.x < r.x + r.w && r.y < o.y + o.h && o.y < r.y + r.h)).toBe(false);
      }
      const project = createBlankProject();
      const res = runToolDefinition({ project }, AUTHOR_BEODEUL_DUNGEON_ALIAS, { mapId: project.startMapId!, type: "castle", seed: 3, populate: false, rooms: plan.rooms, links: plan.links });
      expect(res.ok, res.summary).toBe(true);
      expect((res.warnings ?? []).filter((w) => w.includes("빌더 통로로 이었다"))).toEqual([]);
    }
  });

  // r2 2026-11-05: links items typed ["array","object"] made Gemini answer 400 for every build turn (all tools, not just this one).
  it("keeps the links schema a single type Gemini accepts", () => {
    const links = (AUTHOR_BEODEUL_DUNGEON_ALIAS.parameters.properties as Record<string, { items?: { type?: unknown } }>).links!;
    expect(links.items?.type).toBe("object");
  });
});
