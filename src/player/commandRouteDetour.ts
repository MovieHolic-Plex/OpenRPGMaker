// 이벤트 명령 이동(moveEvent)의 걸음을 주인공이 막으면, 같은 끝 칸까지 주인공을 비켜 가는 길로 바꾼다.
//
// 왜(2026-10-22 장면 교훈 r2 npc-walk-out, Sonnet 5.5 high): 여관 주인이 「잠깐 창고에 다녀올게요」 하고 문까지
// 네 칸 내려가는 경로를 받았는데, 말을 건 주인공이 바로 아래 칸에 서 있었다. 작가 경로의 막힌 걸음은 소비되므로
// (RPG 만들기의 「이동할 수 없으면 무시」) 네 걸음이 모두 버려지고 주인이 제자리에서 사라졌다 — 데모에서 손으로
// 고친 「제자리 소멸」 그대로다. 말을 건 주인공은 대개 그 인물 옆에 서 있으므로 이 막힘은 예외가 아니라 기본이다.
//
// 규칙: 반복하지 않는 명령 경로에서, 막힌 걸음부터 이어지는 단순 걸음(move)들의 끝 칸을 목표로 주인공 칸을 피해
// 최단 길(4방향)을 찾는다. 길이가 원래 걸음 수 + 8 안이면 그 길로 바꾸고, 뒤따르는 방향 바꾸기·투명도 같은
// 명령은 그대로 잇는다. 끝 칸에 주인공이 서 있거나 길이 없으면 예전처럼 걸음을 버린다.
import type { Dir, MoveCommand } from "@/project/types";

const STEPS: ReadonlyArray<{ dir: Dir; x: number; y: number }> = [
  { dir: "down", x: 0, y: 1 }, { dir: "left", x: -1, y: 0 }, { dir: "right", x: 1, y: 0 }, { dir: "up", x: 0, y: -1 },
];
const DELTA: Record<Dir, { x: number; y: number }> = { down: { x: 0, y: 1 }, left: { x: -1, y: 0 }, right: { x: 1, y: 0 }, up: { x: 0, y: -1 } };

export interface DetourInput {
  readonly moves: readonly MoveCommand[];
  /** 막힌 걸음의 moves 안 번호. */
  readonly blockedIndex: number;
  readonly from: { readonly x: number; readonly y: number };
  readonly width: number;
  readonly height: number;
  /** 한 칸 걸음이 가능한가(주인공·다른 인물·지형 포함). */
  readonly canStep: (from: { x: number; y: number }, to: { x: number; y: number }, dir: Dir) => boolean;
  readonly isPlayerAt: (x: number, y: number) => boolean;
}

/** 주인공을 비켜 가는 새 moves(막힌 번호부터 갈아 끼운 전체 배열)를 돌려준다. 못 찾으면 null. */
export function detourAroundPlayer(input: DetourInput): MoveCommand[] | null {
  const { moves, blockedIndex, from } = input;
  let k = blockedIndex, end = { x: from.x, y: from.y };
  while (k < moves.length) {
    const m = moves[k];
    if (!m || m.kind !== "move" || !DELTA[m.dir]) break;
    end = { x: end.x + DELTA[m.dir].x, y: end.y + DELTA[m.dir].y };
    k++;
  }
  const straight = k - blockedIndex;
  if (straight === 0 || (end.x === from.x && end.y === from.y)) return null;
  if (end.x < 0 || end.y < 0 || end.x >= input.width || end.y >= input.height || input.isPlayerAt(end.x, end.y)) return null;
  const key = (x: number, y: number) => y * input.width + x;
  const prev = new Map<number, { at: number; dir: Dir }>();
  const queue: Array<{ x: number; y: number; d: number }> = [{ x: from.x, y: from.y, d: 0 }];
  const seen = new Set<number>([key(from.x, from.y)]);
  const limit = straight + 8;
  let found = false;
  for (let head = 0; head < queue.length && head < 2000 && !found; head++) {
    const cur = queue[head]!;
    if (cur.d >= limit) continue;
    for (const s of STEPS) {
      const nx = cur.x + s.x, ny = cur.y + s.y, id = key(nx, ny);
      if (nx < 0 || ny < 0 || nx >= input.width || ny >= input.height || seen.has(id)) continue;
      if (input.isPlayerAt(nx, ny) || !input.canStep({ x: cur.x, y: cur.y }, { x: nx, y: ny }, s.dir)) continue;
      seen.add(id); prev.set(id, { at: key(cur.x, cur.y), dir: s.dir });
      if (nx === end.x && ny === end.y) { found = true; break; }
      queue.push({ x: nx, y: ny, d: cur.d + 1 });
    }
  }
  if (!found) return null;
  const path: MoveCommand[] = [];
  for (let id = key(end.x, end.y); id !== key(from.x, from.y);) {
    const p = prev.get(id)!;
    path.unshift({ kind: "move", dir: p.dir });
    id = p.at;
  }
  return [...moves.slice(0, blockedIndex), ...path, ...moves.slice(k)];
}

/**
 * 비켜 갈 길이 아예 없을 때 주인공이 인물의 남은 경로 밖으로 비켜 서는 걸음들(가장 가까운 칸, 최대 8걸음).
 * 왜(2026-10-22 r3 npc-walk-out): 여관 주인이 술통 진열대와 통 사이 틈에 섰고, 유일한 출구 칸에 주인공이 서 있었다. 경로는
 * 기다리기(wait)라 이벤트가 30초 멈췄고 주인공도 움직일 수 없었다.
 * 왜 여러 걸음(r4): 카운터와 벽 사이 한 칸 폭 통로에서 주인이 문으로 내려가는데 말을 건 주인공이 바로 아래에 서 있었다. 옆 칸이 모두
 * 막혀 한 칸 비켜서기를 못 찾았고, 막힌 걸음이 하나씩 버려져 주인이 제자리에서 사라졌다. 통로 끝까지 앞서 걸어 비켜 서면 둘 다 풀린다.
 * 인물의 현재 칸과 남은 걸음 칸은 목적지가 될 수 없다(지나갈 수는 있다). 같은 거리면 인물이 처음 가려는 방향과 직각인 쪽을 먼저 고른다.
 */
export function sidestepForPlayer(input: {
  readonly moves: readonly MoveCommand[];
  readonly blockedIndex: number;
  readonly from: { readonly x: number; readonly y: number };
  readonly player: { readonly x: number; readonly y: number };
  readonly canPlayerStand: (x: number, y: number) => boolean;
  readonly maxSteps?: number;
}): Dir[] | null {
  const path = new Set<string>([`${input.from.x},${input.from.y}`]);
  let cur = { x: input.from.x, y: input.from.y };
  let first: Dir | null = null;
  for (let k = input.blockedIndex; k < input.moves.length; k++) {
    const m = input.moves[k];
    if (!m || m.kind !== "move" || !DELTA[m.dir]) break;
    first ??= m.dir;
    cur = { x: cur.x + DELTA[m.dir].x, y: cur.y + DELTA[m.dir].y };
    path.add(`${cur.x},${cur.y}`);
  }
  const vertical = first === "up" || first === "down";
  const order: Dir[] = vertical ? ["left", "right", "down", "up"] : ["down", "up", "left", "right"];
  const limit = input.maxSteps ?? 8;
  const start = `${input.player.x},${input.player.y}`;
  const prev = new Map<string, { at: string; dir: Dir }>();
  const queue: Array<{ x: number; y: number; d: number }> = [{ x: input.player.x, y: input.player.y, d: 0 }];
  const seen = new Set<string>([start, `${input.from.x},${input.from.y}`]);
  for (let head = 0; head < queue.length && head < 400; head++) {
    const c = queue[head]!;
    if (c.d >= limit) continue;
    for (const dir of order) {
      const x = c.x + DELTA[dir].x, y = c.y + DELTA[dir].y, id = `${x},${y}`;
      if (seen.has(id) || !input.canPlayerStand(x, y)) continue;
      seen.add(id); prev.set(id, { at: `${c.x},${c.y}`, dir });
      if (!path.has(id)) {
        const steps: Dir[] = [];
        for (let k = id; k !== start;) { const p = prev.get(k)!; steps.unshift(p.dir); k = p.at; }
        return steps;
      }
      queue.push({ x, y, d: c.d + 1 });
    }
  }
  return null;
}
