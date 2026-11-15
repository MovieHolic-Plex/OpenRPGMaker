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
/** 길 칸이 네 방향으로 이어진 덩이 수. */
function roadBodies(project: Project, map: GameMap): number {
  const w = map.width, seen = new Set<number>();
  let n = 0;
  for (let y = 0; y < map.height; y += 1) for (let x = 0; x < w; x += 1) {
    if (seen.has(y * w + x) || !isRoadCell(project, map, x, y)) continue;
    n += 1;
    const queue = [{ x, y }]; seen.add(y * w + x);
    for (let k = 0; k < queue.length; k += 1) for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const nx = queue[k]!.x + dx, ny = queue[k]!.y + dy;
      if (nx < 0 || ny < 0 || nx >= w || ny >= map.height || seen.has(ny * w + nx) || !isRoadCell(project, map, nx, ny)) continue;
      seen.add(ny * w + nx); queue.push({ x: nx, y: ny });
    }
  }
  return n;
}
const walkable = (project: Project, map: GameMap): number => { let n = 0; for (let y = 0; y < map.height; y += 1) for (let x = 0; x < map.width; x += 1) if (isPassable(project, map, x, y)) n += 1; return n; };
const SLOW = 240_000;

describe("출구 없는 가장자리 길 — 마을 안에서 끝낸다", () => {
  // 이 두 시험은 «두 칸 폭 길 둘이 맵 끝에 닿은 마을» 을 본다(가장자리 길 넷 · 걷는 겹 = 묶음의 두 배). 마당 먼저 배치(2026-11-15)에서는 씨앗 7 의 동쪽 길 끝에
  // 길가 흙 번짐 한 칸이 붙어 묶음이 세 칸이 된다(길은 그래도 걷힌다 — 당긴 길 2 · 뒤 가장자리 길 0) — 그런 마을이 그대로인 씨앗 5 로 본다.
  it("강가 마을: 두 가장자리 길을 걷어 길이 맵 끝에 닿지 않고, 걷는 칸은 그대로이며, 「막힌 길」 표지는 서지 않는다 · 다시 불러도 그대로", () => {
    const { ctx, mapId } = village({ seed: 5 });
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
    const { ctx, mapId } = village({ seed: 5 });
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

  it("읍: 갈림목에서 멈춘다 — 걷은 뒤에도 길이 더 많은 덩이로 갈라지지 않는다(곁길이 줄기에서 떨어지지 않는다)", () => {
    const { ctx, mapId } = village({ form: "plaza" });
    const before = roadBodies(ctx.project, ctx.project.maps[mapId]!);
    const run = createBuildRun(ctx);
    expect(pullBackEdgeStubs(run, mapId).length).toBeGreaterThanOrEqual(1);
    const after = run.ctx.project.maps[mapId]!;
    expect(borderRoad(run.ctx.project, after)).toBe(0);
    expect(roadBodies(run.ctx.project, after)).toBeLessThanOrEqual(before);
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
