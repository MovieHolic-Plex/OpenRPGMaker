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
});
