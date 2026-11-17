// 길을 막는 자리 찾기 — «막고 선다» 고 한 적은 돌아갈 길이 없는 칸에 서야 한다.
//
// 왜(2026-11-16 확인 빌드 r6a): 「내려가는 길목을 해골 병사가 막고 서 있어서 싸워 이겨야 지나갈 수 있어」 의 병사가 폭 8칸 홀 한가운데에 서서
// 옆으로 돌아 보스에게 갈 수 있었다. 도구는 그 칸이 길을 끊는지 보지 않았다.
// 하는 일: 청한 칸에서 걸어서 가까운 순으로, 그 칸(또는 그 칸을 지나는 3칸 이하의 가로·세로 단면)을 막으면 들어오는 쪽에서 맵의 한 덩이에
// 더는 닿지 못하는 자리를 찾는다. 단면이 2~3칸이면 적의 몸(footprint)이 그 폭을 덮는다 — 그림은 한 칸이어도 옆 칸으로 못 지난다.
import type { GameMap, Project } from "@/project/types";
import { isPassable } from "@/project/collision";
import { anchorsOf, blockersOf, reachFrom } from "../judge/eventReach";

type Pt = { x: number; y: number };

export interface BarSpot {
  /** 적이 설 칸(몸의 기준 칸 — 가로 단면은 가운데, 세로 단면은 맨 아래). */
  readonly at: Pt;
  /** 막는 칸 전부. */
  readonly cells: readonly Pt[];
  /** 몸 크기 — 한 칸이면 1×1. */
  readonly footprint: { readonly width: number; readonly height: number };
  /** 막은 저쪽에 갈 곳(보스 · 다른 맵으로 가는 길 · 엔딩)이 있는가. */
  readonly guards: boolean;
}

/** 단면이 이보다 넓으면 한 사람이 막는 길목이 아니다. */
const MAX_SPAN = 3;
/** 청한 칸에서 이 걸음 수 안에서만 찾는다 — 멀리 옮기면 모델이 정한 자리가 아니다. */
const MAX_STEPS = 14;
/** 막아서 끊기는 쪽이 이만큼은 돼야 길이다(막다른 한두 칸 구석은 길이 아니다) — 칸 수 하한과, 걸어 닿는 칸 전체에 대한 몫. */
const MIN_BEYOND = 8;
const MIN_BEYOND_SHARE = 0.12;
const STEPS = [[1, 0], [-1, 0], [0, 1], [0, -1]] as const;

/**
 * from 에서 가장 가까운 «막으면 길이 끊기는» 자리. 없으면 undefined(트인 곳 — 어디에 서도 돌아간다).
 * except = 지금 놓는 적 자신의 이벤트 id(제 칸을 막힌 칸으로 세지 않는다).
 */
export function findBarSpot(project: Project, map: GameMap, from: Pt, except?: string): BarSpot | undefined {
  const W = map.width, H = map.height;
  const others = blockersOf(map, except);
  const open = (x: number, y: number): boolean => x >= 0 && y >= 0 && x < W && y < H && !others.has(y * W + x) && isPassable(project, map, x, y);
  const anchors = anchorsOf(project, map).filter((a) => open(a.x, a.y));
  if (!anchors.length) return undefined;
  const count = (seen: Uint8Array): number => { let n = 0; for (let i = 0; i < seen.length; i++) n += seen[i]!; return n; };
  const all = count(reachFrom(project, map, anchors, others));
  // 곁방 하나를 끊는 자리는 길목이 아니다(r6a 되풀이: 병사가 서쪽 구석방 입구로 옮겨졌다) — 맵의 한 덩이를 끊어야 한다.
  const need = Math.max(MIN_BEYOND, Math.ceil(all * MIN_BEYOND_SHARE));
  const before = reachFrom(project, map, anchors, others);
  // 막은 저쪽에 «갈 곳» 이 있는 자리가 먼저다 — 도망 못 치는 싸움(보스), 다른 맵으로 가는 이동, 엔딩을 부르는 이벤트.
  // 왜(r6a 되풀이): 가장 가까운 끊는 자리가 보물 곁방 입구라 병사가 거기로 갔고, 보스 가는 통로는 그대로 열려 있었다.
  const goals = (map.events ?? []).filter((e) => e.id !== except && /"canEscape":false|"kind":"transfer"|"kind":"triggerEnding"/u.test(JSON.stringify(e.pages ?? [])));
  const touched = (seen: Uint8Array, e: Pt): boolean => [[0, 0], ...STEPS].some(([dx, dy]) => { const x = e.x + dx!, y = e.y + dy!; return x >= 0 && y >= 0 && x < W && y < H && !!seen[y * W + x]; });
  /** 이 칸들을 막으면 들어오는 쪽에서 못 닿게 되는 칸 수(막은 칸은 빼고)와, 그 저쪽에 갈 곳이 있는가. 들어오는 칸을 막는 자리는 -1. */
  const beyond = (cells: readonly Pt[]): { cut: number; goal: boolean } => {
    if (cells.some((c) => anchors.some((a) => a.x === c.x && a.y === c.y))) return { cut: -1, goal: false };
    const blocked = new Set(others);
    for (const c of cells) blocked.add(c.y * W + c.x);
    const after = reachFrom(project, map, anchors, blocked);
    return { cut: all - cells.length - count(after), goal: goals.some((e) => touched(before, e) && !touched(after, e) && !cells.some((c) => Math.abs(c.x - e.x) + Math.abs(c.y - e.y) <= 1)) };
  };
  /** c 를 지나는 가로(dx=1)·세로(dy=1) 단면 — 양 끝이 막힌 연속 칸. 너무 넓으면 undefined. */
  const span = (c: Pt, dx: number, dy: number): Pt[] | undefined => {
    const cells: Pt[] = [c];
    for (const dir of [-1, 1]) for (let k = 1; k <= MAX_SPAN; k++) {
      const x = c.x + dx * dir * k, y = c.y + dy * dir * k;
      if (!open(x, y)) break;
      if (dir < 0) cells.unshift({ x, y }); else cells.push({ x, y });
    }
    return cells.length <= MAX_SPAN ? cells : undefined;
  };
  // 청한 칸에서 걸음 순으로 훑는다.
  const dist = new Int16Array(W * H).fill(-1);
  const start = open(from.x, from.y) ? from : STEPS.map(([dx, dy]) => ({ x: from.x + dx, y: from.y + dy })).find((p) => open(p.x, p.y));
  if (!start) return undefined;
  /** 저쪽에 갈 곳이 없는 가장 가까운 끊는 자리 — 갈 곳을 끊는 자리가 걸음 수 안에 없을 때만 쓴다. */
  let fallback: BarSpot | undefined;
  const queue: Pt[] = [start];
  dist[start.y * W + start.x] = 0;
  for (let k = 0; k < queue.length; k++) {
    const c = queue[k]!, d = dist[c.y * W + c.x]!;
    for (const cells of [[c], span(c, 1, 0), span(c, 0, 1)]) {
      if (!cells) continue;
      const far = beyond(cells);
      if (far.cut < need || (fallback && !far.goal)) continue;
      const wide = cells.length > 1 && cells[0]!.y === cells[1]!.y;
      const at = cells.length === 1 ? c : wide ? cells[Math.floor((cells.length - 1) / 2)]! : cells[cells.length - 1]!;
      const spot: BarSpot = { at, cells, footprint: wide ? { width: cells.length, height: 1 } : { width: 1, height: cells.length }, guards: far.goal };
      if (far.goal) return spot;
      fallback = spot;
    }
    if (d >= MAX_STEPS) continue;
    for (const [dx, dy] of STEPS) {
      const x = c.x + dx, y = c.y + dy;
      if (!open(x, y) || dist[y * W + x] !== -1) continue;
      dist[y * W + x] = d + 1;
      queue.push({ x, y });
    }
  }
  return fallback;
}
