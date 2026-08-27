// 공격 입력 버퍼 규칙(퓨어 모듈, Phaser 없음).
// 쿨다운 중에 눌린 공격은 버퍼에 기록되고, 쿨다운이 0 이 되는 순간
// 정확히 한 번의 스윙으로 방출된다. 버퍼에는 수명(기본 250ms)이 있어서
// 쿨다운이 수명보다 길면 오래된 입력이 나중에 발화하지 않는다.
// 상태는 명시적으로 넘기는 순수 함수뿐이라 16ms 스텝과 50ms 스텝이
// 같은 총 경과 시간에 대해 같은 결과를 낸다(수명·쿨다운 모두 남은량 카운터로 관리).

export const ATTACK_BUFFER_LIFETIME_MS = 250;

export interface AttackBufferState {
  /** 버퍼에 담긴 입력의 남은 수명. 0 이면 비어 있다. */
  lifetimeRemainingMs: number;
}

export interface AttackBufferTickResult {
  readonly fired: boolean;
  readonly cooldownRemainingMs: number;
}

export function createAttackBuffer(): AttackBufferState {
  return { lifetimeRemainingMs: 0 };
}

/** 쿨다운 중에 눌린 공격을 버퍼에 기록한다. 이미 버퍼에 입력이 있으면 무시한다(한 번에 하나). */
export function bufferAttackPress(state: AttackBufferState, lifetimeMs: number = ATTACK_BUFFER_LIFETIME_MS): void {
  if (state.lifetimeRemainingMs > 0) return;
  state.lifetimeRemainingMs = lifetimeMs;
}

/**
 * 버퍼를 한 프레임 동안 진행한다. 쿨다운이 남아 있는 동안에만 수명과 쿨다운을
 * 함께 깎고, 쿨다운이 이 프레임에서 0 에 닿는 순간 수명이 살아 있으면 딱 한 번
 * 발화한다. 발화와 동시에 버퍼는 비워져 한 번의 눌림이 두 번 발화하지 않는다.
 */
export function tickAttackBuffer(state: AttackBufferState, cooldownRemainingMs: number, deltaMs: number): AttackBufferTickResult {
  let lifetime = state.lifetimeRemainingMs;
  let cooldown = cooldownRemainingMs;
  if (cooldown > 0) {
    lifetime = Math.max(0, lifetime - deltaMs);
    cooldown = Math.max(0, cooldown - deltaMs);
  }
  let fired = false;
  if (cooldownRemainingMs > 0 && cooldown === 0 && lifetime > 0) {
    fired = true;
    lifetime = 0;
  }
  state.lifetimeRemainingMs = lifetime;
  return { fired, cooldownRemainingMs: cooldown };
}
