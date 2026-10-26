// project/stairs/fit.ts
// 계단 층 이동 맞추기 — 입구 계약대로 이동 이벤트는 계단 그림 칸(trigger)에, 도착은 앞 칸(approach)에 계단을 등지고.
// 조수 도구(build_hand_interior_room 의 links, create_transfer_pair)가 쓰기 직후 부른다. 계약 없는 계단·문은 건드리지 않는다.
import type { Command, GameEvent, GameMap, Project } from "../types";
import { SIDE_DELTA, stairApproachCells, stairArrivalFacing, stairTriggerCells } from "./contract";
import { findPlacedStairs, walkableCell, type FoundStair } from "./detect";

type Transfer = Extract<Command, { kind: "transfer" }>;
type Cell = { x: number; y: number };

function transfersOf(event: GameEvent): Transfer[] {
  const lists = [event.commands ?? [], ...(event.pages ?? []).map((p) => p.commands ?? [])];
  return lists.flatMap((l) => l.filter((c): c is Transfer => c?.kind === "transfer"));
}
const dist = (a: Cell, b: Cell) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y);

/** 계단 영역(그림 + 앞 칸)에서 이 칸까지 거리. */
function nearStair(s: FoundStair, c: Cell): number {
  let best = Infinity;
  for (let dy = 0; dy < s.contract.h; dy++) for (let dx = 0; dx < s.contract.w; dx++) best = Math.min(best, dist({ x: s.x + dx, y: s.y + dy }, c));
  for (const a of stairApproachCells(s)) best = Math.min(best, dist(a, c));
  return best;
}

/**
 * mapIds 의 계단에 걸린 이동을 계약대로 맞춘다. 돌려주는 값은 사람이 읽는 메모.
 *  - mapIds 맵의 이동 이벤트가 계단 영역(1칸 안)에 있고 trigger 가 아니면 → 가장 가까운 빈 trigger 칸으로(bump 면 priority same).
 *  - 어느 맵에서든 mapIds 맵의 계단 영역(2칸 안)으로 도착하는 이동 → 가장 가까운 걸을 수 있는 앞 칸, 계단을 등진 방향.
 */
export function fitStairTransfers(project: Project, mapIds: readonly string[]): string[] {
  const notes: string[] = [];
  const stairs = new Map<string, FoundStair[]>();
  for (const id of mapIds) { const m = project.maps[id]; if (m) stairs.set(id, findPlacedStairs(project, m).filter((s) => s.contract.leads !== "same")); }
  for (const [mapId, list] of stairs) {
    const map = project.maps[mapId] as GameMap;
    if (!list.length) continue;
    const taken = new Set((map.events ?? []).map((e) => `${e.x},${e.y}`));
    for (const e of map.events ?? []) {
      if (!transfersOf(e).some((t) => t.mapId !== mapId)) continue;
      const s = list.filter((st) => nearStair(st, e) <= 1).sort((a, b) => nearStair(a, e) - nearStair(b, e))[0];
      if (!s) continue;
      const trig = stairTriggerCells(s);
      if (trig.some((t) => t.x === e.x && t.y === e.y)) continue;
      const free = trig.filter((t) => !taken.has(`${t.x},${t.y}`)).sort((a, b) => dist(a, e) - dist(b, e))[0];
      if (!free) continue;
      taken.delete(`${e.x},${e.y}`);
      notes.push(`${mapId} 층 이동 ${e.id} (${e.x},${e.y}) → 계단 그림 칸 (${free.x},${free.y})${s.contract.mode === "bump" ? " 부딪힘" : ""} [${s.kitId}]`);
      e.x = free.x; e.y = free.y;
      taken.add(`${e.x},${e.y}`);
      // 막힌 계단 그림 칸은 부딪힘으로 탄다(같은 층 접촉 — 런타임은 same + overlapForbidden 만 막는 이벤트로 본다).
      if (s.contract.mode === "bump") for (const page of e.pages ?? []) Object.assign(page as object, { priority: "same", overlapForbidden: true });
    }
  }
  // 계단 폭 전체가 출구다(J87, 2026-10-26 검은 장미 저택): 3칸 계단의 가운데 한 칸에만 이동을 달아, 왼쪽 앞 칸에 내린 사람이
  // 계단 쪽(위)으로 걸어도 아무 일이 없었다 — 옆 칸 두 번만 통했다. 이동이 달린 계단의 나머지 trigger 칸에도 같은 이동을 단다.
  for (const [mapId, list] of stairs) {
    const map = project.maps[mapId] as GameMap;
    for (const s of list) {
      const trig = stairTriggerCells(s);
      const owner = (map.events ?? []).find((e) => trig.some((t) => t.x === e.x && t.y === e.y) && transfersOf(e).some((t) => t.mapId !== mapId));
      if (!owner) continue;
      for (const t of trig) {
        if ((map.events ?? []).some((e) => e.x === t.x && e.y === t.y)) continue;
        if (s.contract.mode === "walk" && !walkableCell(project, map, t.x, t.y)) continue;
        const copy = structuredClone(owner) as GameEvent;
        copy.id = `${owner.id}__w${t.x - owner.x}_${t.y - owner.y}`;
        copy.x = t.x; copy.y = t.y;
        for (const [i, page] of (copy.pages ?? []).entries()) (page as { id?: string }).id = `${copy.id}_page${i}`;
        map.events.push(copy);
        notes.push(`${mapId} 계단 ${s.kitId} 폭 전체를 출구로 — (${t.x},${t.y}) 에도 ${owner.id} 와 같은 이동`);
      }
    }
  }
  const srcCache = new Map<string, FoundStair[]>();
  const sourceStairs = (m: GameMap) => {
    let v = stairs.get(m.id) ?? srcCache.get(m.id);
    if (!v) { v = findPlacedStairs(project, m).filter((x) => x.contract.leads !== "same"); srcCache.set(m.id, v); }
    return v;
  };
  // 짝 맞추기: 오르는 계단으로 위층의 「오르는」 계단 앞에 내리면, 위층에서 이 맵으로 돌아오는 「내려가는」 계단 앞으로 옮긴다.
  for (const from of Object.values(project.maps)) {
    for (const e of from.events ?? []) for (const t of transfersOf(e)) {
      const list = stairs.get(t.mapId);
      const dest = project.maps[t.mapId];
      if (!list?.length || !dest || t.mapId === from.id) continue;
      const src = sourceStairs(from).filter((st) => nearStair(st, e) <= 1).sort((a, b) => nearStair(a, e) - nearStair(b, e))[0];
      const there = list.filter((st) => nearStair(st, t) <= 2).sort((a, b) => nearStair(a, t) - nearStair(b, t))[0];
      if (!src || !there || there.contract.leads !== src.contract.leads) continue;
      const opposite = list.filter((st) => st.contract.leads !== src.contract.leads);
      const back = opposite.filter((st) => (dest.events ?? []).some((de) => nearStair(st, de) <= 1 && transfersOf(de).some((dt) => dt.mapId === from.id)));
      const pick = back[0] ?? (opposite.length === 1 ? opposite[0] : undefined);
      const land = pick && stairApproachCells(pick).filter((a) => walkableCell(project, dest, a.x, a.y)).sort((a, b) => dist(a, t) - dist(b, t))[0];
      if (!pick || !land) continue;
      const facing = stairArrivalFacing(pick.contract, land, stairTriggerCells(pick)[0]);
      notes.push(`${from.id}/${e.id} 도착 ${t.mapId}(${t.x},${t.y}) 같은 쪽 계단 ${there.kitId} → 짝 계단 ${pick.kitId} 앞 (${land.x},${land.y}) ${facing}`);
      t.x = land.x; t.y = land.y; t.direction = facing;
    }
  }
  for (const from of Object.values(project.maps)) {
    for (const e of from.events ?? []) for (const t of transfersOf(e)) {
      const list = stairs.get(t.mapId);
      const dest = project.maps[t.mapId];
      if (!list?.length || !dest || t.mapId === from.id) continue;
      const s = list.filter((st) => nearStair(st, t) <= 2).sort((a, b) => nearStair(a, t) - nearStair(b, t))[0];
      if (!s) continue;
      // 문으로 들어오는 사람이 우연히 계단 곁에 내리는 것은 건드리지 않는다 — 계단에서 온 이동이거나 계단 그림 위에 내리는 것만.
      const onArt = (() => { for (let dy = 0; dy < s.contract.h; dy++) for (let dx = 0; dx < s.contract.w; dx++) if (s.x + dx === t.x && s.y + dy === t.y) return true; return false; })();
      if (!onArt && !sourceStairs(from).some((st) => nearStair(st, e) <= 1)) continue;
      const land = stairApproachCells(s).filter((a) => walkableCell(project, dest, a.x, a.y)).sort((a, b) => dist(a, t) - dist(b, t))[0];
      if (!land) continue;
      const trig = stairTriggerCells(s).sort((a, b) => dist(a, land) - dist(b, land))[0];
      const facing = stairArrivalFacing(s.contract, land, trig);
      if (t.x === land.x && t.y === land.y && t.direction === facing) continue;
      notes.push(`${from.id}/${e.id} 도착 ${t.mapId}(${t.x},${t.y}) → 계단 앞 (${land.x},${land.y}) ${facing} [${s.kitId}]`);
      t.x = land.x; t.y = land.y; t.direction = facing;
    }
  }
  return notes;
}

/** 두 계단을 이었을 때 방향이 짝인가 — 같은 쪽(오름↔오름, 내림↔내림)이면 경고 문장. 계단이 아니면 undefined. */
export function stairPairMismatch(project: Project, a: { mapId: string; x: number; y: number }, b: { mapId: string; x: number; y: number }): string | undefined {
  const at = (p: { mapId: string; x: number; y: number }) => {
    const m = project.maps[p.mapId];
    return m ? findPlacedStairs(project, m).filter((s) => s.contract.leads !== "same" && nearStair(s, p) <= 1)[0] : undefined;
  };
  const sa = at(a), sb = at(b);
  if (!sa || !sb || sa.contract.leads !== sb.contract.leads) return undefined;
  const ko = sa.contract.leads === "up" ? "오르는" : "내려가는";
  return `계단 방향이 짝이 아니다 — ${a.mapId} 의 ${sa.kitId} 와 ${b.mapId} 의 ${sb.kitId} 가 둘 다 ${ko} 계단이다. 위층에는 내려가는 계단, 아래층에는 오르는 계단을 둔다(stair-misfacing).`;
}

/**
 * 계단 출구를 «자연스러운 방향»으로 탈 수 있나(J87): 이동이 달린 계단의 앞 칸마다 계단 쪽으로 한 걸음 가면 이동 칸에 닿아야 한다.
 * 못 닿는 앞 칸 목록(사람이 읽는 문장). 계단 그림 한 칸에만 이동이 있으면 다른 앞 칸에서 위로 걸어도 아무 일이 없다.
 */
export function hiddenStairExits(project: Project): string[] {
  const out: string[] = [];
  for (const map of Object.values(project.maps)) {
    for (const s of findPlacedStairs(project, map).filter((st) => st.contract.leads !== "same")) {
      const trig = stairTriggerCells(s);
      const exitAt = (x: number, y: number) => (map.events ?? []).some((e) => e.x === x && e.y === y && transfersOf(e).some((t) => t.mapId !== map.id));
      if (!trig.some((t) => exitAt(t.x, t.y))) continue;
      const side = s.contract.side;
      for (const a of stairApproachCells(s)) {
        if (!walkableCell(project, map, a.x, a.y)) continue;
        const toward = side === "any" ? [...trig].sort((p, q) => dist(p, a) - dist(q, a))[0]! : { x: a.x - SIDE_DELTA[side][0], y: a.y - SIDE_DELTA[side][1] };
        if (!exitAt(toward.x, toward.y)) out.push(`${map.name ?? map.id}: 계단 ${s.kitId} 앞 (${a.x},${a.y}) 에서 계단 쪽으로 걸어도 (${toward.x},${toward.y}) 에 이동이 없다`);
      }
    }
  }
  return out;
}
