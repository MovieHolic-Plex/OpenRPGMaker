// player/chaseNoise.ts
// 추격자가 듣는 소리 — 주인공 발소리(걷기·달리기·서 있기)와 레버·스위치·밀기 같은 일회성 소리.
// 세이브에 들어가지 않는 런타임 기억이라 세션 객체를 키로 WeakMap 에 둔다(@/project/chaseBrain 머리말).
import type { ChasePoint } from "./chaseAi";

/** 주인공 발소리의 상태(프레임마다 한 번 갱신). */
export type PlayerGait = "still" | "walk" | "run";

export type ChaseNoise = {
  readonly mapId: string;
  readonly x: number;
  readonly y: number;
  readonly radius: number;
  /** 남은 수명(ms). */
  ttlMs: number;
  /** 이 소리를 이미 들은 추격자(한 번만 반응). */
  readonly heardBy: Set<string>;
};

/** 소리는 이만큼(ms) 들린다 — 그 사이에 결정하는 추격자만 반응한다. */
export const CHASE_NOISE_TTL_MS = 600;

type Footsteps = { gait: PlayerGait; at: ChasePoint; echoMs: number };
const footsteps = new WeakMap<object, Footsteps>();
const noises = new WeakMap<object, ChaseNoise[]>();
/** 걸음을 멈춘 뒤에도 발소리가 이만큼(ms) 남는다 — 마지막 걸음이 땅에 닿는 소리. */
const FOOTSTEP_ECHO_MS = 300;

/**
 * 프레임마다 주인공 발소리를 갱신한다. 걷는 중이면 소리 자리는 걸어 들어가는 칸(movingTo)이다 — 세션 좌표는 걸음이 끝나야 바뀐다.
 * 멈춘 직후 FOOTSTEP_ECHO_MS 동안은 마지막 걸음 소리가 남는다.
 */
export function updatePlayerFootsteps(session: object, input: { readonly moving: boolean; readonly dashing: boolean; readonly at: ChasePoint; readonly deltaMs: number }): void {
  const before = footsteps.get(session);
  if (input.moving) {
    footsteps.set(session, { gait: input.dashing ? "run" : "walk", at: { ...input.at }, echoMs: FOOTSTEP_ECHO_MS });
    return;
  }
  const echo = (before?.echoMs ?? 0) - Math.max(0, input.deltaMs);
  if (before && before.gait !== "still" && echo > 0) footsteps.set(session, { gait: before.gait, at: { ...input.at }, echoMs: echo });
  else footsteps.set(session, { gait: "still", at: { ...input.at }, echoMs: 0 });
}

export function playerGait(session: object): PlayerGait {
  return footsteps.get(session)?.gait ?? "still";
}

/** 발소리가 나는 칸(걷는 중이면 걸어 들어가는 칸). 모르면 undefined. */
export function playerFootstepAt(session: object): ChasePoint | undefined {
  return footsteps.get(session)?.at;
}

/** 일회성 소리를 낸다(레버·스위치·밀기·효과음). 같은 칸 소리는 하나로 합친다. */
export function emitChaseNoise(session: object, mapId: string, at: ChasePoint, radius: number): void {
  if (!(radius > 0)) return;
  const list = noises.get(session) ?? [];
  const same = list.find((n) => n.mapId === mapId && n.x === at.x && n.y === at.y);
  if (same) {
    same.ttlMs = CHASE_NOISE_TTL_MS;
    return;
  }
  list.push({ mapId, x: at.x, y: at.y, radius, ttlMs: CHASE_NOISE_TTL_MS, heardBy: new Set() });
  if (list.length > 16) list.shift();
  noises.set(session, list);
}

/** 프레임 시간을 빼고 끝난 소리를 버린다. */
export function tickChaseNoises(session: object, deltaMs: number): void {
  const list = noises.get(session);
  if (!list?.length) return;
  for (const noise of list) noise.ttlMs -= Math.max(0, deltaMs);
  const alive = list.filter((n) => n.ttlMs > 0);
  if (alive.length) noises.set(session, alive);
  else noises.delete(session);
}

/** 이 추격자가 처음 듣는 가장 가까운 소리(맨해튼 ≤ radius × scale). 들은 것으로 표시한다. */
export function hearChaseNoise(session: object, mapId: string, listener: string, at: ChasePoint, scale: number): ChaseNoise | undefined {
  if (!(scale > 0)) return undefined;
  const list = noises.get(session);
  if (!list?.length) return undefined;
  let best: ChaseNoise | undefined;
  let bestD = Number.POSITIVE_INFINITY;
  for (const noise of list) {
    if (noise.mapId !== mapId || noise.heardBy.has(listener)) continue;
    const d = Math.abs(noise.x - at.x) + Math.abs(noise.y - at.y);
    if (d <= noise.radius * scale && d < bestD) { best = noise; bestD = d; }
  }
  best?.heardBy.add(listener);
  return best;
}
