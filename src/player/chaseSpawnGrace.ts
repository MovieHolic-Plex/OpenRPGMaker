/**
 * 새 게임·불러오기·체크포인트 복귀 직후 짧은 은총 시간 — 추격자가 아직 주인공을 보거나 잡지 않는다.
 * 시작점이 추격자 시야 안이면 태어나자마자 붙잡혔고, 「다시 시도」가 같은 자리로 되돌려 게임 오버가 끝없이 반복됐다
 * (2026-10-25 심판 J61, 공포 학교: 시작 (11,8) · 추격자 (15,8) · 시야 5). 시간은 장면이 받는 프레임 시간으로 센다 —
 * 멈춘(숨긴) 탭에서는 줄지 않는다.
 */
export const CHASE_SPAWN_GRACE_MS = 2000;

const graceLeft = new WeakMap<object, number>();

/** 장면이 주인공을 새로 세웠다(시작·불러오기·체크포인트·패배 복구). */
export function startChaseSpawnGrace(scene: object, ms = CHASE_SPAWN_GRACE_MS): void {
  graceLeft.set(scene, Math.max(0, ms));
}

/** 이번 프레임 시간을 빼고, 아직 은총 시간이면 true. */
export function tickChaseSpawnGrace(scene: object, deltaMs: number): boolean {
  const left = graceLeft.get(scene);
  if (left === undefined) return false;
  const next = left - Math.max(0, deltaMs);
  if (next <= 0) { graceLeft.delete(scene); return false; }
  graceLeft.set(scene, next);
  return true;
}

export function inChaseSpawnGrace(scene: object): boolean {
  return (graceLeft.get(scene) ?? 0) > 0;
}
