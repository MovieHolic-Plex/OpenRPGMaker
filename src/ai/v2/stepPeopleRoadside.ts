// 단계 사람(말을 걸어야 진행되는 NPC)이 길·광장에서 멀리 떨어진 맨바닥에 서 있으면 가까운 길가로 옮긴다(끝맺음, 결정적).
// 왜(2026-10-29 vm8 terra jrpg): 「마을의 경고」를 전할 사람을 판정자가 끝내 못 찾았다 — 사람이 아니라 투명 칸이었고(stepSubjects 가 사람으로 세운다),
// 사람은 길을 따라 걷는 플레이어 눈에 띄는 자리(길가·광장·샘·상인·처음 선 자리 곁)에 서야 한다.
// 규칙: 마지막 단계가 아닌 단계 이벤트가 사람 그림이고, 그 칸에서 3칸 안에 길 칸도, 눈에 띄는 것(그림 있는 이름 이벤트·시작 자리)도 없으면
// 6칸 안에서 길과 맞닿은(상하좌우) 걸어 닿는 빈 칸(길 칸 자신은 아님 — 길을 막지 않게)으로 옮긴다. 옮긴 뒤 닿지 못하는 이벤트가 늘거나
// 걸어 닿는 칸이 줄면(사람이 좁은 목을 막으면) 그 자리는 쓰지 않는다.
import type { GameEvent, GameMap, Project } from "@/project/types";
import type { BuildRun } from "./types";
import { resolveSteps } from "./mysteryCase";
import { reachableCells, unreachableEvents } from "./eventReach";
import { isRoadCell } from "./edgeExitRoads";

const shown = (ev: GameEvent) => (ev.pages ?? []).some((p) => { const g = (p.graphic ?? {}) as { transparent?: boolean; sprite?: unknown; appearanceId?: unknown }; return g.transparent !== true && Boolean(g.sprite || g.appearanceId); });
const reachCount = (project: Project, map: GameMap) => { const r = reachableCells(project, map); let n = 0; if (r) for (const v of r) n += v ? 1 : 0; return n; };

export function standStepPeopleByRoads(run: BuildRun): string[] {
  const project0 = run.ctx.project;
  const bp = project0.gameBlueprint;
  if (!bp) return [];
  const notes: string[] = [];
  for (const r of resolveSteps(project0)) {
    if (r.k === bp.steps.length - 1) continue;
    const project = run.ctx.project;
    const map = project.maps[r.map.id];
    const ev = map?.events.find((e) => e.id === r.ev.id);
    if (!map || !ev || !shown(ev)) continue;
    const roads: { x: number; y: number }[] = [];
    for (let y = 0; y < map.height; y++) for (let x = 0; x < map.width; x++) if (isRoadCell(project, map, x, y)) roads.push({ x, y });
    if (!roads.length) continue;
    const near = (p: { x: number; y: number }, d: number) => Math.abs(p.x - ev.x) + Math.abs(p.y - ev.y) <= d;
    const sights = map.events.filter((e) => e.id !== ev.id && shown(e) && String((e as { name?: string }).name ?? e.id).trim()).map((e) => ({ x: e.x, y: e.y }));
    const start = project as unknown as { startMapId?: string; startPos?: { x: number; y: number } };
    if (start.startMapId === map.id && start.startPos) sights.push(start.startPos);
    if (roads.some((p) => near(p, 3)) || sights.some((p) => near(p, 3))) continue;
    const reach = reachableCells(project, map);
    if (!reach) continue;
    const road = new Set(roads.map((p) => p.y * map.width + p.x));
    const taken = new Set(map.events.map((e) => e.y * map.width + e.x));
    const cands: { x: number; y: number; d: number }[] = [];
    for (let y = Math.max(0, ev.y - 6); y <= Math.min(map.height - 1, ev.y + 6); y++) for (let x = Math.max(0, ev.x - 6); x <= Math.min(map.width - 1, ev.x + 6); x++) {
      const i = y * map.width + x, d = Math.abs(x - ev.x) + Math.abs(y - ev.y);
      if (d === 0 || d > 6 || !reach[i] || road.has(i) || taken.has(i)) continue;
      if (![[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => road.has((y + dy!) * map.width + (x + dx!)) && x + dx! >= 0 && x + dx! < map.width)) continue;
      cands.push({ x, y, d });
    }
    cands.sort((a, b) => a.d - b.d || a.y - b.y || a.x - b.x);
    const was = new Set(unreachableEvents(project, map.id));
    const count = reachCount(project, map);
    for (const c of cands) {
      const snapshot = run.ctx.project;
      const res = run.call("move_event", { mapId: map.id, eventId: ev.id, x: c.x, y: c.y });
      const after = run.ctx.project.maps[map.id];
      if (res.ok && after && !unreachableEvents(run.ctx.project, map.id).some((id) => !was.has(id)) && reachCount(run.ctx.project, after) >= count) {
        notes.push(`「${String((ev as { name?: string }).name ?? ev.id)}」 길가로 (${ev.x},${ev.y}) → (${c.x},${c.y})`);
        break;
      }
      run.ctx.project = snapshot;
    }
  }
  return notes;
}
