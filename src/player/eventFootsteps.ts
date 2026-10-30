// player/eventFootsteps.ts
// 걷는 이벤트의 발소리(movement.footsteps) — 추격자·순찰 경비의 위치를 소리로 알린다.
// 음량은 주인공과의 «걸음» 거리(벽 너머면 돌아가는 길)로, 좌우는 가로 차이로 정한다. 순수 계산 + 재생 한 함수.
import type { EventFootsteps } from "@/project/types";
import type { ChasePoint } from "./chaseAi";

/** 발소리 기본값 — 두 칸에 한 번, 10칸까지 들림. */
export const FOOTSTEP_DEFAULT_EVERY = 2;
export const FOOTSTEP_DEFAULT_RADIUS = 10;
/** 좌우로 가장 멀리 가르는 정도(완전히 한쪽으로 몰면 헤드폰에서 어색하다). */
const MAX_PAN = 0.8;
/** 가로 차이 이만큼(칸)이면 가장 멀리 갈린다. */
const PAN_SPAN_CELLS = 8;
/** 이보다 작은 음량은 내지 않는다. */
const MIN_AUDIBLE_GAIN = 0.02;

export function footstepEvery(config: EventFootsteps): number {
  const n = Math.round(config.everySteps ?? FOOTSTEP_DEFAULT_EVERY);
  return Math.max(1, Math.min(8, Number.isFinite(n) ? n : FOOTSTEP_DEFAULT_EVERY));
}

export function footstepRadius(config: EventFootsteps): number {
  const r = config.radius ?? FOOTSTEP_DEFAULT_RADIUS;
  return Math.max(2, Math.min(30, Number.isFinite(r) ? r : FOOTSTEP_DEFAULT_RADIUS));
}

/**
 * 한 번 울리는 발소리의 음량·좌우. distance = 주인공까지 걸음 수(벽 너머면 돌아가는 길, 길이 없으면 Infinity).
 * 반경 밖이면 null(내지 않는다). 음량 = volume × (1 - d/radius)², 좌우 = clamp(dx/8, -0.8, 0.8).
 */
export function footstepMix(config: EventFootsteps, from: ChasePoint, player: ChasePoint, distance: number): { gain: number; pan: number } | null {
  const radius = footstepRadius(config);
  if (!(distance < radius)) return null;
  const near = 1 - Math.max(0, distance) / radius;
  const volume = Math.max(0, Math.min(1, config.volume ?? 1));
  const gain = volume * near * near;
  if (gain < MIN_AUDIBLE_GAIN) return null;
  const pan = Math.max(-MAX_PAN, Math.min(MAX_PAN, (from.x - player.x) / PAN_SPAN_CELLS));
  return { gain, pan: Math.round(pan * 100) / 100 };
}

/**
 * 주인공까지 걸음 수 — 4방향 BFS(반경 안까지만). passable(a, b) 는 a 에서 b 로 한 걸음 갈 수 있는가.
 * 맨해튼 거리가 반경 이상이면 BFS 없이 Infinity. 길이 없으면(닫힌 방) 맨해튼 + 4(벽 하나 너머로 먹먹하게)를 쓴다.
 */
export function walkingDistance(
  from: ChasePoint,
  to: ChasePoint,
  radius: number,
  passable: (a: ChasePoint, b: ChasePoint) => boolean,
): number {
  const manhattan = Math.abs(from.x - to.x) + Math.abs(from.y - to.y);
  if (manhattan >= radius) return Infinity;
  if (manhattan === 0) return 0;
  const seen = new Set<string>([`${from.x},${from.y}`]);
  let frontier: ChasePoint[] = [from];
  for (let depth = 1; depth < radius && frontier.length; depth += 1) {
    const next: ChasePoint[] = [];
    for (const p of frontier) {
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
        const q = { x: p.x + dx, y: p.y + dy };
        const key = `${q.x},${q.y}`;
        if (seen.has(key)) continue;
        seen.add(key);
        if (q.x === to.x && q.y === to.y) return depth;
        if (!passable(p, q)) continue;
        next.push(q);
      }
    }
    frontier = next;
  }
  return manhattan + 4;
}

/** 이벤트마다 걸음 수를 센다(세이브 밖 런타임 기억). */
const stepCounts = new WeakMap<object, Map<string, number>>();

/** 이 걸음에 소리를 내야 하는가 — everySteps 째 걸음마다 true. 첫 걸음에 바로 낸다. */
export function countFootstep(scope: object, eventId: string, config: EventFootsteps): boolean {
  const counts = stepCounts.get(scope) ?? new Map<string, number>();
  stepCounts.set(scope, counts);
  const n = counts.get(eventId) ?? 0;
  counts.set(eventId, n + 1);
  return n % footstepEvery(config) === 0;
}
