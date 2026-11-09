// 적 한 마리가 가진 공격 묶음에서 다음 공격을 고른다.
//
// 아이디어 출처: OpenWorld(MIT, Copyright (c) 2026 The OpenWorld authors)의 packages/modules/src/kits/kit.ts —
// 몬스터의 스킬 묶음과 스킬마다 거는 발동 조건(거리 띠·정렬·체력 비율). 코드는 가져오지 않았고,
// 이 저장소의 공격 시작 문(playSceneActionCombat 의 combat 모드)과 같은 규칙을 순수 함수로 옮겨 새로 썼다.
// 난수를 쓰지 않아 같은 상황이면 항상 같은 공격이 나온다.
import type { EnemyActionAttack } from "@/project/types";

export const MAX_ENEMY_KIT_EXTRA_ATTACKS = 3;

export interface EnemyAttackContext {
  /** 대상까지 체비쇼프 거리(칸). */
  readonly distance: number;
  /** 대상이 같은 행이나 같은 열에 있는가(돌진 조건). */
  readonly aligned: boolean;
  /** 남은 체력 비율 0..100. */
  readonly hpPercent: number;
}

/** 이 공격을 지금 시작할 수 있는가. 종류별 거리 규칙은 기존 단일 공격의 시작 문과 같다. */
export function attackIsEligible(attack: EnemyActionAttack, ctx: EnemyAttackContext): boolean {
  if (attack.hpBelowPercent !== undefined && ctx.hpPercent > attack.hpBelowPercent) return false;
  if (attack.kind === "melee") return ctx.distance <= attack.range;
  if (attack.kind === "projectile") return ctx.distance <= attack.range && ctx.distance >= 2;
  return ctx.distance <= attack.range && ctx.distance >= 2 && ctx.aligned;
}

/**
 * 직전에 쓴 공격 다음 칸부터 한 바퀴 돌며 처음으로 쓸 수 있는 공격의 번호를 돌려준다.
 * 하나도 없으면 -1. 직전 공격은 맨 마지막 후보라, 쓸 수 있는 다른 공격이 있으면 같은 공격을 반복하지 않는다.
 */
export function pickEnemyAttack(attacks: readonly EnemyActionAttack[], lastIndex: number, ctx: EnemyAttackContext): number {
  const count = attacks.length;
  for (let step = 1; step <= count; step += 1) {
    const index = (((lastIndex + step) % count) + count) % count;
    const attack = attacks[index];
    if (attack && attackIsEligible(attack, ctx)) return index;
  }
  return -1;
}
