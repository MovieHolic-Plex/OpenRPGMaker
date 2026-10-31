/**
 * 새 게임·불러오기·체크포인트 복귀 직후 짧은 은총 시간 — 추격자가 아직 주인공을 보거나 잡지 않는다.
 * 시작점이 추격자 시야 안이면 태어나자마자 붙잡혔고, 「다시 시도」가 같은 자리로 되돌려 게임 오버가 끝없이 반복됐다
 * (2026-10-25 심판 J61, 공포 학교: 시작 (11,8) · 추격자 (15,8) · 시야 5). 시간은 장면이 받는 프레임 시간으로 센다 —
 * 멈춘(숨긴) 탭에서는 줄지 않는다.
 */
export const CHASE_SPAWN_GRACE_MS = 2000;

/**
 * 맵에 들어선 직후의 짧은 유예(ms) — 추격이 빨라진 뒤(2026-10-29, @/project/chaseTempo) 입구 가까운 추격자에게 들어서자마자
 * 붙잡히지 않게. 화면이 밝아지는 동안(전환 페이드)에도 시간은 흐르므로 페이드보다 넉넉히 준다.
 */
export const CHASE_ENTRY_GRACE_MS = 1200;

const graceLeft = new WeakMap<object, number>();

/** 남은 유예가 ms 보다 짧으면 ms 로 늘린다(긴 은총 시간을 줄이지 않는다). */
export function extendChaseSpawnGrace(scene: object, ms: number): void {
  if ((graceLeft.get(scene) ?? 0) < ms) graceLeft.set(scene, Math.max(0, ms));
}

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

/**
 * 도착 보호(arrival shield) — 주인공이 문·이동으로 다른 맵에 들어선 직후, 추격자가 **새로** 알아채지 못하는 짧은 창.
 * 위의 정지 유예(CHASE_ENTRY_GRACE_MS)는 화면이 밝아지는 동안 추격자를 세워 두기만 하고, 그 뒤 입구가 시야 안이면 바로 들킨다.
 * 예전에는 이걸 저작 도구(set_field_detection·tune_field_enemies)가 **입구 가까운 추격자의 시야를 영구히 깎아서** 막았다 —
 * 폴른 스타 B6 성문 앞 기사는 도개교 칸이 입구로 잡혀 시야 12 → 5, B2 밤 순찰은 지하 뚜껑 곁이라 2 가 되어 바로 곁을 지나는
 * 주인공도 못 봤다(2026-10-31 QA). 보호는 도착 직후에만 필요하므로 런타임이 시간·걸음으로 끝낸다:
 *   - ARRIVAL_SHIELD_MS 가 지나거나
 *   - 주인공이 도착 칸에서 ARRIVAL_SHIELD_STEPS 칸(맨해튼) 이상 떨어지면
 * 끝난다. 끝난 뒤에는 저작한 시야 그대로 본다. 이미 쫓던 추격자(문을 따라 넘어온 추격 등)는 막지 않는다.
 */
export const ARRIVAL_SHIELD_MS = 3000;
export const ARRIVAL_SHIELD_STEPS = 3;

interface ArrivalShield { mapId: string; x: number; y: number; leftMs: number }
const arrivalShields = new WeakMap<object, ArrivalShield>();

/** 주인공이 (mapId,x,y) 에 들어섰다 — 도착 보호를 새로 건다. key 는 세션 객체(장면·추격 판정이 같이 쓴다).
 * 시작·불러오기·체크포인트 복귀는 걸지 않는다 — 그쪽은 위의 정지 은총(2000ms)과 저작 검사(chaserSpawnSafety)가 맡는다. */
export function startArrivalShield(session: object, at: { mapId: string; x: number; y: number }, ms = ARRIVAL_SHIELD_MS): void {
  arrivalShields.set(session, { mapId: at.mapId, x: at.x, y: at.y, leftMs: Math.max(0, ms) });
}

/** 프레임마다: 시간을 빼고, 주인공이 도착 칸에서 충분히 떨어졌거나 다른 맵이면 보호를 끝낸다. 아직 보호 중이면 true. */
export function tickArrivalShield(session: object, deltaMs: number, player: { mapId: string; x: number; y: number }): boolean {
  const shield = arrivalShields.get(session);
  if (!shield) return false;
  shield.leftMs -= Math.max(0, deltaMs);
  const moved = Math.abs(player.x - shield.x) + Math.abs(player.y - shield.y);
  if (shield.leftMs <= 0 || player.mapId !== shield.mapId || moved >= ARRIVAL_SHIELD_STEPS) {
    arrivalShields.delete(session);
    return false;
  }
  return true;
}

/** 이 맵에서 도착 보호 중인가 — 추격자가 새로 알아채면 안 된다. */
export function arrivalShielded(session: object, mapId: string): boolean {
  const shield = arrivalShields.get(session);
  return !!shield && shield.mapId === mapId && shield.leftMs > 0;
}
