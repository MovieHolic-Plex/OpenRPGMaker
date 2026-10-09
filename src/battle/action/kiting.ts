// 원거리 적의 거리 유지(kiting) 순수 규칙.
// 예전에는 모든 적이 같은 추격 묘버를 써서, 사거리 8 의 해골 궁수도 플레이어 몸에
// 붙을 때까지 걸어와 접촉 피해로 싸웠다(투사체는 cheby>=2 에서만 나가므로 붙으면 아무것도 못 함).
// 여기서는 "물러날지 / 버틸지 / 다가갈지" 만 정한다. 실제 경로/통행 판정은 chaseAi 가 한다.

import type { EnemyActionAttack } from "@/project/types";

export type KiteIntent = "retreat" | "hold" | "advance";

export interface KiteBand {
  /** 이 거리 이하로 붙으면 물러난다. */
  readonly minRange: number;
  /** 이 거리까지는 버틴다. 넘으면 다가간다. */
  readonly preferredRange: number;
}

/** 투사체가 나가지 않는 최소 거리(액션 전투 발사 게이트와 동일). */
const KITE_MIN_RANGE = 2;

/** 투사체 공격을 가진 적만 거리 밴드를 갖는다. 근접/돌진은 그대로 붙는다. */
export function kiteBandForAttack(attack: EnemyActionAttack | undefined): KiteBand | null {
  if (!attack || attack.kind !== "projectile") return null;
  const range = Number.isFinite(attack.range) ? Math.max(1, Math.round(attack.range)) : 1;
  return { minRange: KITE_MIN_RANGE, preferredRange: Math.max(KITE_MIN_RANGE + 1, range) };
}

export function resolveKiteIntent(input: { readonly distance: number; readonly band: KiteBand }): KiteIntent {
  const distance = Number.isFinite(input.distance) ? input.distance : 0;
  if (distance <= input.band.minRange) return "retreat";
  if (distance > input.band.preferredRange) return "advance";
  return "hold";
}
