// 목표 바로 곁 절벽에 경사로 — 끝맺음 clearLanes.
//
// 왜(2026-10-29 vm4 deepseek jrpg 판정 blocker «동굴 입구가 보이는데 문에 닿는 길이 없음»): 동굴 입구 (25,3)는 낮은 땅에 있고, 바로 왼쪽
// 언덕(높이 1, x≤23)이 입구 옆까지 붙어 있었다. 플레이어는 언덕 위 동쪽 끝(23,4)에 서서 한 칸 아래 입구 앞 (24,4)를 보고도 내려갈 수 없었다 —
// 실제 길은 언덕 서쪽 경사로로 내려가 지붕 사이 한 줄을 돌아오는 17걸음이었다. 데이터 도달성(자동 플레이)은 닿으니 통과였다.
//
// 규칙: 높이 지형 맵에서 진행·이동 이벤트의 앞 칸(2칸 안)에 단이 하나 다른 이웃 칸 쌍(낮은 칸 l, 높은 칸 h)이 둘 다 걸어 닿고,
// l↔h 걸음 거리가 12 를 넘으면 l(과 그 바깥 한 칸)에 h 쪽으로 오르는 경사로를 놓는다(맵의 기존 경사로 모양: 매끈한 풀 경사 또는 계단). 낮은 쪽 바깥 착지 칸이 같은 단·통행이어야 하고,
// 놓은 뒤 못 닿는 이벤트가 늘거나 닿는 칸이 줄면 되돌린다. 그림은 relief 렌더러의 경사로(새 도트 없음).
import { canMove, isPassable } from "@/project/collision";
import { invalidateReliefSlopes, rampAt, rampCode, reliefLevel, type RampDir } from "@/project/relief/walk";
import type { GameEvent, GameMap, Project } from "@/project/types";
import { reachableCells, unreachableEvents } from "./eventReach";
import type { BuildRun } from "./types";

type Cell = { x: number; y: number };
const DIRS: [number, number, RampDir][] = [[0, -1, "n"], [0, 1, "s"], [1, 0, "e"], [-1, 0, "w"]];

function goal(ev: GameEvent): boolean {
  const text = JSON.stringify(ev.pages ?? []);
  const auto = (ev.pages ?? []).every((p) => { const t = p.trigger as unknown; const k = typeof t === "string" ? t : (t as { kind?: string } | undefined)?.kind; return k === "auto" || k === "autorun" || k === "parallel"; });
  return !auto && /"kind":"(?:transfer|battleProcessing|setSwitch|changeItem|triggerEnding)"/u.test(text);
}

function walkDistance(project: Project, map: GameMap, from: Cell, to: Cell, limit: number): number {
  const W = map.width, H = map.height;
  const dist = new Int32Array(W * H).fill(-1);
  dist[from.y * W + from.x] = 0;
  const q = [from.y * W + from.x];
  for (let k = 0; k < q.length; k += 1) {
    const c = q[k]!, x = c % W, y = (c - x) / W, d = dist[c]!;
    if (x === to.x && y === to.y) return d;
    if (d >= limit) continue;
    for (const [dx, dy] of DIRS) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= W || ny >= H || dist[ny * W + nx]! >= 0 || !canMove(project, map, x, y, nx, ny)) continue;
      dist[ny * W + nx] = d + 1; q.push(ny * W + nx);
    }
  }
  return Infinity;
}

export function rampNearGoals(run: BuildRun, mapId: string): string[] {
  const notes: string[] = [];
  const map0 = run.ctx.project.maps[mapId];
  if (!map0?.relief?.levels?.some((v) => v > 0)) return notes;
  const W = map0.width, H = map0.height;
  const done = new Set<number>();
  for (const ev of map0.events ?? []) {
    if (!goal(ev)) continue;
    const project0 = run.ctx.project;
    const map = project0.maps[mapId]!;
    const rel = map.relief!;
    const reach = reachableCells(project0, map);
    if (!reach) return notes;
    const reached = (c: Cell) => c.x >= 0 && c.y >= 0 && c.x < W && c.y < H && !!reach[c.y * W + c.x];
    // 앞 칸 = 이벤트 칸 둘레의 닿는 칸(밟는 이벤트면 그 칸도).
    const fronts = [{ x: ev.x, y: ev.y }, ...DIRS.map(([dx, dy]) => ({ x: ev.x + dx, y: ev.y + dy }))].filter(reached);
    if (!fronts.length) continue;
    type Plan = { l: Cell; h: Cell; dir: RampDir; cells: Cell[]; gain: number };
    const plans: Plan[] = [];
    for (let y = 0; y < H; y += 1) for (let x = 0; x < W; x += 1) {
      const l = { x, y };
      if (!reached(l) || fronts.every((f) => Math.abs(f.x - x) + Math.abs(f.y - y) > 2)) continue;
      if (rampAt(rel, x, y) || (rel.ramps?.[y * W + x] ?? 0) !== 0) continue;
      const lo = reliefLevel(rel, x, y);
      for (const [dx, dy, dir] of DIRS) {
        const h = { x: x + dx, y: y + dy };
        if (!reached(h) || reliefLevel(rel, h.x, h.y) !== lo + 1 || rampAt(rel, h.x, h.y) || !isPassable(project0, map, h.x, h.y)) continue;
        const far = walkDistance(project0, map, l, h, 60);
        if (far <= 12) continue;
        // 경사로 칸: l, 가능하면 l 바깥 한 칸 더(두 칸 경사로가 마을 경사로와 같은 모양). 그 바깥은 같은 단 착지.
        const out1 = { x: x - dx, y: y - dy }, out2 = { x: x - 2 * dx, y: y - 2 * dy };
        const flat = (c: Cell) => c.x >= 0 && c.y >= 0 && c.x < W && c.y < H && reliefLevel(rel, c.x, c.y) === lo && !rampAt(rel, c.x, c.y) && (rel.ramps?.[c.y * W + c.x] ?? 0) === 0 && isPassable(project0, map, c.x, c.y) && reached(c);
        if (!flat(out1)) continue;
        const cells = flat(out2) ? [l, out1] : [l];
        if (cells.some((c) => done.has(c.y * W + c.x) || map.events.some((e) => e.x === c.x && e.y === c.y))) continue;
        plans.push({ l, h, dir, cells, gain: far === Infinity ? 99 : far });
      }
    }
    plans.sort((a, b) => b.gain - a.gain);
    const before = new Set(unreachableEvents(project0, mapId));
    const reachCount = reach.reduce((n, v) => n + (v ? 1 : 0), 0);
    for (const plan of plans.slice(0, 8)) {
      const next = structuredClone(project0) as Project;
      const m = next.maps[mapId]!;
      const r = m.relief!;
      const ramps = r.ramps ? r.ramps.slice() : new Array<number>(W * H).fill(0);
      // 맵에 이미 있는 경사로 모양을 따른다(마을 경사로는 매끈한 풀 경사, 계단이 있으면 계단).
      const stairs = ramps.some((v) => v >= 5 && v <= 8) || !ramps.some((v) => v >= 1 && v <= 4);
      for (const c of plan.cells) ramps[c.y * W + c.x] = rampCode(plan.dir, stairs);
      m.relief = { ...r, ramps };
      invalidateReliefSlopes(m.relief);
      if (walkDistance(next, m, plan.cells.at(-1)!, plan.h, 8) > plan.cells.length + 1) continue;
      if (unreachableEvents(next, mapId).some((u) => !before.has(u))) continue;
      const r2 = reachableCells(next, m);
      if (!r2 || r2.reduce((n, v) => n + (v ? 1 : 0), 0) < reachCount - plan.cells.length) continue;
      run.ctx.project = next;
      for (const c of plan.cells) done.add(c.y * W + c.x);
      notes.push(`「${String(ev.name ?? ev.id)}」 곁 절벽 (${plan.l.x},${plan.l.y})→(${plan.h.x},${plan.h.y})에 경사로 — 단 위·아래가 한 칸인데 ${plan.gain >= 99 ? "돌아가는 길이 없었다" : `${plan.gain}걸음 돌아가야 했다`}`);
      break;
    }
  }
  return notes;
}
