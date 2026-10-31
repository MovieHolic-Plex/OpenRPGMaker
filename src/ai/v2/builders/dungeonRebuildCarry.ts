// 던전 다시 짓기(edit_place)에서 지키는 것 — 짓기 도구 밖에서 그 층에 붙은 이벤트와 다른 맵에서 들어오는 문.
//
// 왜(2026-10-30 omo-loop-1030b terra boss-room r1~r3): 보스 방을 다시 지으려 하면 «바깥에서 들어오는 문이 여러 맵에서 이어져 있다 — 다시 지으면
// 그 문이 맵 밖을 가리켜 거부된다»로 거절했고, 세 판 모두 비평 항목(«보스 앞 바닥이 휑하다 — 방을 좁혀라»)이 막힘으로 끝났다.
// 또 author_dungeon rebuild:true 는 그 층의 이벤트를 모두 비운다 — add_people·add_event 로 세운 해골 기사·입장 컷신이 다시 짓기에서 사라진다.
// 규칙(거절 대신 가까운 자리로):
//   - 다른 맵에서 이 던전 층으로 들어오는 이동은 지우지 않고, 다시 지은 층(같은 순번, 없으면 마지막 층)의 옛 착지 칸에서 가장 가까운 걸어 닿는 빈 칸으로 다시 가리킨다.
//   - 짓기 도구가 만들지 않은 이벤트(사람·컷신·조사·상자·보이는 적 — id 가 `ev_<층 id>_` 로 시작하지 않는 것)는 같은 층 같은 칸, 막혔으면 가장 가까운 걸어 닿는 빈 칸으로 옮겨 싣는다.
//     다시 잇는 바깥 맵(relink)으로 돌아가는 이동만 든 이벤트는 싣지 않는다 — 다시 잇기가 새 짝을 만든다.
import { isPassable } from "@/project/collision";
import type { GameEvent, GameMap, Project } from "@/project/types";
import { reachableCells } from "../eventReach";

type Cell = { x: number; y: number };

function walkTransfers(node: unknown, visit: (cmd: Record<string, unknown>) => void): void {
  if (Array.isArray(node)) { for (const n of node) walkTransfers(n, visit); return; }
  if (!node || typeof node !== "object") return;
  const o = node as Record<string, unknown>;
  if (o.kind === "transfer" && typeof o.mapId === "string") visit(o);
  for (const v of Object.values(o)) if (v && typeof v === "object") walkTransfers(v, visit);
}

/** 이벤트가 가리키는 이동 목적 맵들. */
export function transferMapIds(ev: GameEvent): string[] {
  const out: string[] = [];
  walkTransfers(ev.pages ?? [], (c) => out.push(String(c.mapId)));
  return out;
}

/** want 에서 가장 가까운(맨해튼) 칸 — 걸을 수 있고, 걸어 닿고(닿는 칸 계산이 되면), taken 에 없는 칸. */
export function nearestOpenCell(project: Project, map: GameMap, want: Cell, taken: ReadonlySet<string>, landingBelow = false): Cell | undefined {
  const reach = reachableCells(project, map);
  const w = map.width, h = map.height;
  const cx = Math.max(0, Math.min(w - 1, want.x)), cy = Math.max(0, Math.min(h - 1, want.y));
  const ok = (x: number, y: number) => x >= 0 && y >= 0 && x < w && y < h && !taken.has(`${x},${y}`) && isPassable(project, map, x, y)
    && (!reach || !!reach[y * w + x]) && (!landingBelow || (y + 1 < h && isPassable(project, map, x, y + 1)));
  const maxR = w + h;
  for (let r = 0; r <= maxR; r += 1) {
    for (let dx = -r; dx <= r; dx += 1) {
      const dy = r - Math.abs(dx);
      for (const sy of dy === 0 ? [0] : [-dy, dy]) {
        const x = cx + dx, y = cy + sy;
        if (ok(x, y)) return { x, y };
      }
    }
  }
  return undefined;
}

/**
 * 다시 지은 층으로 옛 이벤트를 싣는다. oldFloors[k] = 다시 짓기 전 k 번째 층(사본), newFloorIds[k] = 다시 지은 k 번째 층.
 * dropReturnTo = 다시 잇는 바깥 맵 — 그 맵으로만 돌아가는 이동 이벤트는 싣지 않는다. 바꾼 것을 한국어 줄로 돌려준다.
 */
export function carryFloorEvents(project: Project, oldFloors: readonly GameMap[], newFloorIds: readonly string[], dropReturnTo: ReadonlySet<string>): string[] {
  const notes: string[] = [];
  oldFloors.forEach((old, k) => {
    const newId = newFloorIds[Math.min(k, newFloorIds.length - 1)];
    const map = newId ? project.maps[newId] : undefined;
    if (!map) return;
    const builderPrefix = `ev_${old.id}_`;
    const newPrefix = `ev_${map.id}_`;
    const have = new Set(map.events.map((e) => e.id));
    const carried: string[] = [];
    for (const ev of old.events ?? []) {
      if (ev.id.startsWith(builderPrefix) || ev.id.startsWith(newPrefix) || have.has(ev.id)) continue;
      const targets = transferMapIds(ev);
      const outside = targets.filter((t) => t !== old.id && t !== map.id);
      if (outside.length && outside.every((t) => dropReturnTo.has(t))) continue;
      const taken = new Set(map.events.map((e) => `${e.x},${e.y}`));
      const spot = nearestOpenCell(project, map, { x: ev.x, y: ev.y }, taken);
      if (!spot) continue;
      // 같은 층 안 이동(구덩이 등 짓기 도구가 만든 것)이 아닌 한, 이 층 자신을 가리키는 이동은 새 층 id 로.
      const moved = structuredClone(ev) as GameEvent;
      walkTransfers(moved.pages ?? [], (c) => { if (c.mapId === old.id) c.mapId = map.id; });
      map.events = [...map.events, { ...moved, x: spot.x, y: spot.y }];
      carried.push(`${ev.name ?? ev.id}${spot.x !== ev.x || spot.y !== ev.y ? `(${ev.x},${ev.y})→(${spot.x},${spot.y})` : ""}`);
    }
    if (carried.length) notes.push(`다시 짓기 전 이 층에 있던 이벤트 ${carried.length}개를 그대로 옮겨 실었다: ${carried.slice(0, 6).join(", ")}${carried.length > 6 ? " …" : ""}`);
  });
  return notes;
}

/**
 * 다른 맵에서 옛 층으로 들어오던 이동을 다시 지은 층으로 다시 가리킨다(옛 착지 칸에서 가장 가까운 걸어 닿는 빈 칸).
 * oldToNew = 옛 층 id → 새 층 id, only = 다시 짓기 전에 그 층으로 들어오던 이벤트(「맵 id:이벤트 id」, 다시 잇기로 지운 문은 빼고) — 짓기가 새로 단 문은 건드리지 않는다. 바꾼 이벤트 수.
 */
export function retargetIncoming(project: Project, oldToNew: ReadonlyMap<string, string>, only: ReadonlySet<string>): number {
  const floorIds = new Set([...oldToNew.values()]);
  let n = 0;
  for (const m of Object.values(project.maps)) {
    if (floorIds.has(m.id) || oldToNew.has(m.id)) continue;
    let changed = false;
    const events = m.events.map((ev) => {
      if (!only.has(`${m.id}:${ev.id}`) || !transferMapIds(ev).some((t) => oldToNew.has(t))) return ev;
      const next = structuredClone(ev) as GameEvent;
      walkTransfers(next.pages ?? [], (c) => {
        const to = oldToNew.get(String(c.mapId));
        const dest = to ? project.maps[to] : undefined;
        if (!dest) return;
        const taken = new Set(dest.events.map((e) => `${e.x},${e.y}`));
        const spot = nearestOpenCell(project, dest, { x: Number(c.x) || 0, y: Number(c.y) || 0 }, taken);
        if (!spot) return;
        c.mapId = dest.id; c.x = spot.x; c.y = spot.y;
      });
      changed = true; n += 1;
      return next;
    });
    if (changed) m.events = events;
  }
  return n;
}
