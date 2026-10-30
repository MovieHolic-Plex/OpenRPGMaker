// 맨땅 동굴 출입구에 굴 입구 그림(갱구) 세우기 — 끝맺음 clearLanes.
//
// 왜(2026-10-29 vm3 argon jrpg 판정 «촌장 허락 뒤 마을 밖으로 나가는 길이 화면에 안 보임»): 「→ 마왕의 동굴」 이동 칸 (25,10)이
// 풀밭 한가운데 투명 칸이었다. 잇기 도구(linkEntranceInDraft)는 이동 칸을 놓기 «전에» 갱구를 찍는데, 모델이 이동 칸을 먼저 놓은 판은
// 갱구 자리 검사(caveMouthSpotClear)가 출입구 이벤트 자신을 «곁의 이벤트»로 세어 늘 거절했다. 출하 검사(door-bare)는 모델에게 찍으라고만 말했다.
//
// 규칙: 버들항 바깥 맵에서 던전 맵으로 가는 출입구가 door-bare(문·계단·굴 그림 없음)면
//   1) 그 칸 위에 갱구가 맞으면(출입구 이벤트는 빼고 잰다) 찍는다.
//   2) 안 맞으면 8걸음 안에서 갱구가 맞는 걸어 닿는 칸으로 출입구를 옮기고 찍는다. 던전에서 돌아오는 이동은 새 출입구 아래 칸으로 맞춘다(짝).
//   옮기거나 찍은 뒤 못 닿는 이벤트가 늘거나 새 착지 칸에 못 닿으면 되돌린다. 새 그림은 그리지 않는다(번들 갱구 조각).
import { caveMouth, caveMouthSpotClear } from "@/editor/tools/dungeonLinkTools";
import { isPassable } from "@/project/collision";
import type { GameEvent, GameMap, Project } from "@/project/types";
import { reachableCells, unreachableEvents } from "./eventReach";
import { placementProblems } from "./placementRules";
import type { BuildRun } from "./types";

type Cell = { x: number; y: number };

function withoutEvent(map: GameMap, id: string): GameMap {
  return { ...map, events: map.events.filter((e) => e.id !== id) };
}

/** 도착 맵에서 이 맵으로 돌아오는 이동 가운데 옛 출입구 둘레 2칸 안에 내리던 것을 새 착지 칸으로. 맞춘 이벤트 수. */
function repairReturn(project: Project, mapId: string, destId: string, old: Cell, landing: Cell): number {
  const dest = project.maps[destId];
  if (!dest) return 0;
  let n = 0;
  dest.events = dest.events.map((de) => {
    let touched = false;
    const pages = (de.pages ?? []).map((p) => ({ ...p, commands: (p.commands ?? []).map((c) => {
      const r = c as unknown as Record<string, unknown>;
      if (r.kind !== "transfer" || r.mapId !== mapId || typeof r.x !== "number" || typeof r.y !== "number") return c;
      if (Math.abs(r.x - old.x) + Math.abs(r.y - old.y) > 2) return c;
      touched = true;
      return { ...r, x: landing.x, y: landing.y, direction: "down" } as unknown as typeof c;
    }) }));
    if (touched) n += 1;
    return touched ? { ...de, pages } as GameEvent : de;
  });
  return n;
}

const destOf = (ev: GameEvent, mapId: string): string | undefined => {
  for (const p of ev.pages ?? []) for (const c of p.commands ?? []) {
    const r = c as unknown as Record<string, unknown>;
    if (r.kind === "transfer" && typeof r.mapId === "string" && r.mapId !== mapId) return r.mapId;
  }
  return undefined;
};

/** 남은 출입구로 들어서기 전 칸 — 던전에서 그 출입구로 돌아오는 이동이 이미 내려 주는 칸이 있으면 그것, 없으면 걸어 닿는 이웃 칸. */
function twinLanding(project: Project, map: GameMap, twin: GameEvent): Cell | undefined {
  for (const m of Object.values(project.maps)) for (const e of m.events ?? []) for (const p of e.pages ?? []) for (const c of p.commands ?? []) {
    const r = c as unknown as Record<string, unknown>;
    if (r.kind === "transfer" && r.mapId === map.id && typeof r.x === "number" && typeof r.y === "number" && Math.abs(r.x - twin.x) + Math.abs(r.y - twin.y) === 1) return { x: r.x, y: r.y };
  }
  const reach = reachableCells(project, map);
  return [[0, -1], [0, 1], [-1, 0], [1, 0]].map(([dx, dy]) => ({ x: twin.x + dx!, y: twin.y + dy! }))
    .find((c) => c.x >= 0 && c.y >= 0 && c.x < map.width && c.y < map.height && !!reach?.[c.y * map.width + c.x]);
}

export function dressBareCaveGates(run: BuildRun, mapId: string): string[] {
  const notes: string[] = [];
  const map0 = run.ctx.project.maps[mapId];
  if (!map0 || map0.tilesetId !== "beodeul_city") return notes;
  const bare = placementProblems(run.ctx.project, map0).filter((p) => p.kind === "door-bare");
  for (const problem of bare) {
    const project0 = run.ctx.project;
    const map = project0.maps[mapId]!;
    const ev = map.events.find((e) => e.id === problem.eventId);
    if (!ev) continue;
    const destId = destOf(ev, mapId);
    if (!destId) continue;
    // 가장자리 출구는 길 끝이 맡는다(edgeExitRoads) — 맵 밖으로 이어지는 길이 곧 입구다.
    if (ev.x === 0 || ev.y === 0 || ev.x === map.width - 1 || ev.y === map.height - 1) continue;
    const bareMap = withoutEvent(map, ev.id);
    const reach = reachableCells(project0, map);
    const reached = (c: Cell) => !!reach?.[c.y * map.width + c.x];
    const before = new Set(unreachableEvents(project0, mapId));
    const candidates: Cell[] = [{ x: ev.x, y: ev.y }];
    for (let y = 0; y < map.height; y += 1) for (let x = 0; x < map.width; x += 1) {
      const d = Math.abs(x - ev.x) + Math.abs(y - ev.y);
      if (d === 0 || d > 8) continue;
      candidates.push({ x, y });
    }
    candidates.sort((a, b) => (Math.abs(a.x - ev.x) + Math.abs(a.y - ev.y)) - (Math.abs(b.x - ev.x) + Math.abs(b.y - ev.y)));
    let done = false;
    for (const gate of candidates) {
      const landing = { x: gate.x, y: gate.y + 1 };
      if (landing.y >= map.height || !isPassable(project0, map, gate.x, gate.y) || !isPassable(project0, map, landing.x, landing.y)) continue;
      // 출입구 칸 자신은 도달 집합에서 빠진다(밟으면 옮겨지는 칸) — 옛 자리는 착지 칸만 본다.
      if (!reached(landing) || ((gate.x !== ev.x || gate.y !== ev.y) && !reached(gate))) continue;
      if (map.events.some((e) => e.id !== ev.id && Math.abs(e.x - gate.x) <= 1 && Math.abs(e.y - gate.y) <= 2)) continue;
      if (!caveMouthSpotClear(project0, bareMap, gate)) continue;
      const next = structuredClone(project0) as Project;
      const moved = gate.x !== ev.x || gate.y !== ev.y;
      if (moved) next.maps[mapId]!.events = next.maps[mapId]!.events.map((e) => e.id === ev.id ? { ...e, x: gate.x, y: gate.y } : e);
      const stamped = caveMouth(next, withoutEvent(next.maps[mapId]!, ev.id), gate);
      if (!stamped) continue;
      const paired = moved ? repairReturn(next, mapId, destId, { x: ev.x, y: ev.y }, landing) : 0;
      const m2 = next.maps[mapId]!;
      const r2 = reachableCells(next, m2);
      if (!r2?.[landing.y * m2.width + landing.x] || !isPassable(next, m2, gate.x, gate.y)) continue;
      if (unreachableEvents(next, mapId).some((u) => !before.has(u))) continue;
      if (moved && !paired) continue;
      run.ctx.project = next;
      notes.push(`「→ ${project0.maps[destId]?.name ?? destId}」 출입구 ${moved ? `(${ev.x},${ev.y})→(${gate.x},${gate.y}), 돌아오는 이동 ${paired}개를 그 앞으로 맞추고 ` : `(${gate.x},${gate.y}) `}위에 굴 입구(갱구)를 세웠다`);
      done = true;
      break;
    }
    if (done) continue;
    // 3) 굴 입구를 못 세우면: 같은 던전으로 가는 다른 출입구가 이 맵에 있고 그쪽은 보이는 입구(문·굴 그림 또는 길이 닿은 가장자리)면
    //    맨땅 출입구를 지우고 던전에서 이리로 돌아오던 이동을 그 입구 앞으로 맞춘다 — 목표 꼬리도 남은 입구를 가리키게 된다(refreshObjectiveRoutes).
    const twin = map.events.find((o) => o.id !== ev.id && destOf(o, mapId) === destId && !bare.some((b) => b.eventId === o.id && !(o.x === 0 || o.y === 0 || o.x === map.width - 1 || o.y === map.height - 1)));
    if (twin) {
      const landing = twinLanding(project0, map, twin);
      const next = structuredClone(project0) as Project;
      next.maps[mapId]!.events = next.maps[mapId]!.events.filter((e) => e.id !== ev.id);
      const paired = landing ? repairReturn(next, mapId, destId, { x: ev.x, y: ev.y }, landing) : 0;
      if (landing && !unreachableEvents(next, mapId).some((u) => !before.has(u))) {
        run.ctx.project = next;
        notes.push(`「→ ${project0.maps[destId]?.name ?? destId}」 맨땅 출입구 (${ev.x},${ev.y})는 굴 입구를 세울 빈 땅이 없어 지우고, 같은 곳으로 가는 (${twin.x},${twin.y})가 맡는다(돌아오는 이동 ${paired}개를 그 앞 (${landing.x},${landing.y})로)`);
        continue;
      }
    }
    notes.push(`「→ ${project0.maps[destId]?.name ?? destId}」 출입구 (${ev.x},${ev.y}): 8걸음 안에 굴 입구를 세울 빈 땅이 없어 그대로 둠`);
  }
  return notes;
}
