// 출구 없이 맵 가장자리까지 간 길은 마을 안에서 끝낸다(ai/v2/place/roadStubs.ts) · 바깥 맵의 사람은 맵 끝 칸에 서지 않는다(place/where.ts).
// 2026-11-15 실모델 확인 판 r5 «물레강 마을»: 시작 자리 쪽 흙길이 동쪽 가장자리 (41,15)(41,16)까지 가 끝났고(「막힌 길」 표지 둘 + 이정표), 주민 하나가 (41,13) 끝 칸에 섰다.
import { describe, expect, it } from "vitest";
import { createBlankProject } from "@/project/defaults";
import { isPassable } from "@/project/collision";
import { runTool } from "@/editor/tools";
import type { ToolContext } from "@/editor/tools/types";
import type { GameEvent, GameMap, Project } from "@/project/types";
import { markDeadEndRoads } from "@/ai/v2/place/deadEndRoads";
import { pullBackEdgeStubs, stubRings } from "@/ai/v2/place/roadStubs";
import { isRoadCell } from "@/ai/v2/place/surface";
import { resolveWhere } from "@/ai/v2/place/where";
import { createBuildRun } from "@/ai/v2/shared/buildRun";

type Cell = { x: number; y: number };
function village(args: Record<string, unknown> = {}): { ctx: ToolContext; mapId: string } {
  const project = createBlankProject() as Project;
  const ctx = { project, currentMapId: project.startMapId } as ToolContext;
  const res = runTool(ctx, "author_beodeul_town", { theme: "river", seed: 7, ...args });
  expect(res.ok, res.summary).toBe(true);
  return { ctx, mapId: (res.data as { mapId: string }).mapId };
}
/** 동쪽 가장자리의 길 묶음들. */
function eastGroups(project: Project, map: GameMap): Cell[][] {
  const out: Cell[][] = []; let cur: Cell[] = [];
  for (let y = 0; y < map.height; y += 1) {
    if (isRoadCell(project, map, map.width - 1, y) && isPassable(project, map, map.width - 1, y)) cur.push({ x: map.width - 1, y });
    else { if (cur.length) out.push(cur); cur = []; }
  }
  if (cur.length) out.push(cur);
  return out;
}
const borderRoad = (project: Project, map: GameMap): number => {
  let n = 0;
  for (let y = 0; y < map.height; y += 1) for (let x = 0; x < map.width; x += 1)
    if ((x === 0 || y === 0 || x === map.width - 1 || y === map.height - 1) && isRoadCell(project, map, x, y) && isPassable(project, map, x, y)) n += 1;
  return n;
};
const walkable = (project: Project, map: GameMap): number => { let n = 0; for (let y = 0; y < map.height; y += 1) for (let x = 0; x < map.width; x += 1) if (isPassable(project, map, x, y)) n += 1; return n; };
const SLOW = 240_000;

describe("출구 없는 가장자리 길 — 마을 안에서 끝낸다", () => {
  it("강가 마을: 두 가장자리 길을 걷어 길이 맵 끝에 닿지 않고, 걷는 칸은 그대로이며, 「막힌 길」 표지는 서지 않는다 · 다시 불러도 그대로", () => {
    const { ctx, mapId } = village();
    const before = ctx.project.maps[mapId]!;
    expect(borderRoad(ctx.project, before)).toBe(4);
    const walk = walkable(ctx.project, before);
    const run = createBuildRun(ctx);
    const notes = pullBackEdgeStubs(run, mapId);
    expect(notes).toHaveLength(2);
    const after = run.ctx.project.maps[mapId]!;
    expect(borderRoad(run.ctx.project, after)).toBe(0);
    expect(walkable(run.ctx.project, after)).toBe(walk);
    expect(markDeadEndRoads(run, mapId)).toHaveLength(0);
    expect(pullBackEdgeStubs(run, mapId)).toHaveLength(0);
  }, SLOW);

  it("시작 자리가 그 길 위면 거기서 멈춘다 — 시작 칸은 길로 남고 그 바깥 두 줄만 걷는다", () => {
    const { ctx, mapId } = village();
    const map = ctx.project.maps[mapId]!;
    const group = eastGroups(ctx.project, map)[0]!;
    const start = { x: map.width - 3, y: group[0]!.y };
    ctx.project = { ...ctx.project, startMapId: mapId, startPos: start } as Project;
    const cut = stubRings(ctx.project, ctx.project.maps[mapId]!, group);
    expect(cut?.drop).toHaveLength(group.length * 2);
    expect(cut?.tip.some((c) => c.x === start.x && c.y === start.y)).toBe(true);
    const run = createBuildRun(ctx);
    pullBackEdgeStubs(run, mapId);
    const after = run.ctx.project.maps[mapId]!;
    expect(isRoadCell(run.ctx.project, after, start.x, start.y)).toBe(true);
    expect(isRoadCell(run.ctx.project, after, start.x + 1, start.y)).toBe(false);
    expect(isRoadCell(run.ctx.project, after, start.x + 2, start.y)).toBe(false);
  }, SLOW);

  it("가장자리에 다른 맵으로 가는 이동이 있는 길은 그대로 둔다", () => {
    const { ctx, mapId } = village();
    const map = ctx.project.maps[mapId]!;
    const gate = eastGroups(ctx.project, map)[0]![0]!;
    const exit = { id: "ev_exit", name: "동쪽 출구", x: gate.x, y: gate.y, trigger: { kind: "playerTouch" }, commands: [],
      pages: [{ id: "ev_exit_p0", conditions: [], trigger: { kind: "playerTouch" }, commands: [{ kind: "transfer", mapId: "elsewhere", x: 1, y: 1 }] }] } as unknown as GameEvent;
    ctx.project = { ...ctx.project, maps: { ...ctx.project.maps, [mapId]: { ...map, events: [...map.events, exit] } } } as Project;
    const run = createBuildRun(ctx);
    pullBackEdgeStubs(run, mapId);
    expect(isRoadCell(run.ctx.project, run.ctx.project.maps[mapId]!, gate.x, gate.y)).toBe(true);
  }, SLOW);

  it("읍: 곁길이 갈라지는 모퉁이에서 멈춘다 — 줄기에서 곁길이 떨어지지 않는다", () => {
    const { ctx, mapId } = village({ form: "plaza" });
    const run = createBuildRun(ctx);
    const notes = pullBackEdgeStubs(run, mapId);
    expect(notes).toHaveLength(2);
    const after = run.ctx.project.maps[mapId]!;
    expect(borderRoad(run.ctx.project, after)).toBe(0);
    // 서쪽 길 끝 (4,37): 북쪽 성당 길과 이어진 모퉁이 — 그 칸과 위 칸이 길이다
    expect(isRoadCell(run.ctx.project, after, 4, 37)).toBe(true);
    expect(isRoadCell(run.ctx.project, after, 4, 36)).toBe(true);
    expect(isRoadCell(run.ctx.project, after, 3, 37)).toBe(false);
  }, SLOW);
});

describe("바깥 맵의 사람은 맵 끝 칸에 서지 않는다", () => {
  it("끝 칸을 짚어도 안쪽 가까운 칸으로 옮기고, «입구»도 끝 칸이 아니다", () => {
    const { ctx, mapId } = village();
    const project = ctx.project, map = project.maps[mapId]!;
    const onBorder = (c: Cell) => c.x === 0 || c.y === 0 || c.x === map.width - 1 || c.y === map.height - 1;
    let asked = 0;
    for (let y = 2; y < map.height - 2; y += 3) for (const x of [0, map.width - 1]) {
      if (!isPassable(project, map, x, y)) continue;
      asked += 1;
      expect(onBorder(resolveWhere(project, map, undefined, { at: { x, y } }).cell), `${x},${y}`).toBe(false);
    }
    expect(asked).toBeGreaterThan(6);
    expect(onBorder(resolveWhere(project, map, "입구").cell)).toBe(false);
  }, SLOW);
});
