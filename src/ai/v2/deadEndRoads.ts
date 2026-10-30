// 맵 가장자리에서 끊긴 길에 「막힌 길」 표지 — 끝맺음 clearLanes.
//
// 왜(2026-10-29 vm6 flash jrpg 판정 major «동쪽 길은 (41,18)에서 막혔다»): 마을 포석길이 동쪽 가장자리 (41,19)까지 깔려 있는데 그 끝에
// 출구가 없다 — 판정자는 길을 따라 동쪽 끝까지 가서 더 나갈 데를 찾았다(실제 출구는 서쪽 끝). 출구 없는 가장자리 길은 「나가는 길」로 읽힌다.
// 규칙(버들항 바깥 맵): 가장자리 칸 가운데 길 바닥(이름표 길·포석·road·path)이고 걸을 수 있는 칸이 이어진 묶음(4칸 이하)마다,
// 2칸 안에 다른 맵으로 가는 이동·이벤트가 없으면
//   - 그 길 끝 칸들에 투명 접촉 이벤트 「막힌 길」(부딪히면 「길이 여기서 끊겼다…」)을 세우고,
//   - 길 옆 3칸 안 빈 풀밭에 번들 「외곽 이정표」(1×2, bd-out-signpost)를 세워 조사하면 같은 말을 한다.
// 세운 뒤 못 닿는 이벤트가 늘면 그 묶음은 되돌린다. 새 그림은 그리지 않는다. 되풀이 안전(같은 id).
import { isPassable } from "@/project/collision";
import type { GameEvent, GameMap, Project } from "@/project/types";
import { unreachableEvents } from "./eventReach";
import type { BuildRun } from "./types";

const SIGN = "kit:beodeul_city/bd-out-signpost";
const ROAD = /길|포석|road|path/iu;
const NOT_ROAD = /풀밭|물|water|강|벽|wall|지붕|roof|오솔길 표지|이정표/iu;
const LINE = "길이 여기서 끊겼다. 이쪽으로는 마을 밖으로 나갈 수 없다.";
export const DEAD_END_PREFIX = "ev_dead_end_";

const hasTransferOut = (ev: GameEvent, here: string) => (ev.pages ?? []).some((p) => (p.commands ?? []).some((c) => { const r = c as unknown as Record<string, unknown>; return r.kind === "transfer" && r.mapId !== here; }));

function touchEvent(id: string, name: string, x: number, y: number, trigger: "playerTouch" | "action"): GameEvent {
  return {
    id, name, x, y, trigger: { kind: trigger }, commands: [],
    pages: [{
      id: `${id}_p0`, name, conditions: [], graphic: { transparent: true }, trigger: { kind: trigger }, priority: "same", overlapForbidden: true,
      movement: { type: "fixed", speed: 3, frequency: 3 }, commands: [{ kind: "text", body: LINE }],
    }],
  } as unknown as GameEvent;
}

export function markDeadEndRoads(run: BuildRun, mapId: string): string[] {
  const project0 = run.ctx.project;
  const map0 = project0.maps[mapId];
  if (!map0 || map0.tilesetId !== "beodeul_city") return [];
  if ((map0 as unknown as { climate?: { mode?: string } }).climate?.mode === "indoor") return [];
  const meta = (project0.tilesets[map0.tilesetId]?.tileMeta ?? []) as unknown as ({ label?: string } | undefined)[];
  const w = map0.width, h = map0.height;
  const road = (map: GameMap, x: number, y: number) => {
    const label = String(meta[map.lowerTiles[y * w + x] ?? -1]?.label ?? "");
    return ROAD.test(label) && !NOT_ROAD.test(label);
  };
  // 가장자리 네 변을 따라 이어진 길 칸 묶음.
  const sides: { cells: { x: number; y: number }[]; inward: { dx: number; dy: number } }[] = [
    { cells: Array.from({ length: w }, (_, x) => ({ x, y: 0 })), inward: { dx: 0, dy: 1 } },
    { cells: Array.from({ length: w }, (_, x) => ({ x, y: h - 1 })), inward: { dx: 0, dy: -1 } },
    { cells: Array.from({ length: h }, (_, y) => ({ x: 0, y })), inward: { dx: 1, dy: 0 } },
    { cells: Array.from({ length: h }, (_, y) => ({ x: w - 1, y })), inward: { dx: -1, dy: 0 } },
  ];
  const notes: string[] = [];
  for (const side of sides) {
    const groups: { x: number; y: number }[][] = [];
    let cur: { x: number; y: number }[] = [];
    for (const c of side.cells) {
      if (road(map0, c.x, c.y) && isPassable(project0, map0, c.x, c.y)) cur.push(c);
      else { if (cur.length) groups.push(cur); cur = []; }
    }
    if (cur.length) groups.push(cur);
    for (const group of groups) {
      if (group.length > 4) continue;
      const project = run.ctx.project;
      const map = project.maps[mapId]!;
      const near = (map.events ?? []).some((e) => group.some((c) => Math.abs(e.x - c.x) + Math.abs(e.y - c.y) <= 2) && (hasTransferOut(e, mapId) || e.id.startsWith(DEAD_END_PREFIX)));
      if (near || (map.events ?? []).some((e) => group.some((c) => e.x === c.x && e.y === c.y))) continue;
      const before = new Set(unreachableEvents(project, mapId));
      const snapshot = run.ctx.project;
      const added = group.map((c) => touchEvent(`${DEAD_END_PREFIX}${c.x}_${c.y}`, "막힌 길", c.x, c.y, "playerTouch"));
      run.ctx.project = { ...project, maps: { ...project.maps, [mapId]: { ...map, events: [...map.events, ...added] } } } as Project;
      // 표지: 길 끝에서 안쪽으로 1~3칸, 길 옆 칸에 1×2 이정표(아랫칸이 그 자리).
      let sign = "";
      // 가장자리 방향 축에서 묶음의 양 끝 바로 바깥(±1·±2) — 길 옆 풀밭.
      const along = side.inward.dx ? group.map((c) => c.y) : group.map((c) => c.x);
      const lo = Math.min(...along), hi = Math.max(...along);
      const tries: { x: number; y: number }[] = [];
      for (let k = 1; k <= 3; k++) for (const a of [lo - 1, hi + 1, lo - 2, hi + 2]) {
        const edge = group[0]!;
        tries.push(side.inward.dx ? { x: edge.x + side.inward.dx * k, y: a } : { x: a, y: edge.y + side.inward.dy * k });
      }
      for (const b of tries) {
        const cur2 = run.ctx.project.maps[mapId]!;
        if (b.x < 1 || b.y < 2 || b.x >= w - 1 || b.y >= h - 1) continue;
        const cells = [{ x: b.x, y: b.y - 1 }, b];
        const upper = (x: number, y: number) => ["upperTiles", "upperOverlayTiles"].some((key) => (((cur2 as unknown as Record<string, ArrayLike<number> | undefined>)[key])?.[y * w + x] ?? -1) >= 0);
        if (cells.some((c) => !isPassable(run.ctx.project, cur2, c.x, c.y) || road(cur2, c.x, c.y) || upper(c.x, c.y) || cur2.events.some((e) => e.x === c.x && e.y === c.y))) continue;
        const keep = run.ctx.project;
        const res = run.call("stamp_object", { objectId: SIGN, mapId, x: b.x, y: b.y - 1 });
        if (!res.ok) { run.ctx.project = keep; continue; }
        const m2 = run.ctx.project.maps[mapId]!;
        run.ctx.project = { ...run.ctx.project, maps: { ...run.ctx.project.maps, [mapId]: { ...m2, events: [...m2.events, touchEvent(`${DEAD_END_PREFIX}sign_${b.x}_${b.y}`, "막힌 길 이정표", b.x, b.y, "action")] } } } as Project;
        if (unreachableEvents(run.ctx.project, mapId).some((id) => !before.has(id) && !id.startsWith(DEAD_END_PREFIX))) { run.ctx.project = keep; continue; }
        sign = ` · 이정표 (${b.x},${b.y})`;
        break;
      }
      if (unreachableEvents(run.ctx.project, mapId).some((id) => !before.has(id) && !id.startsWith(DEAD_END_PREFIX))) { run.ctx.project = snapshot; continue; }
      notes.push(`가장자리에서 끊긴 길 ${group.map((c) => `(${c.x},${c.y})`).join("")} 에 「막힌 길」${sign}`);
    }
  }
  return notes;
}
