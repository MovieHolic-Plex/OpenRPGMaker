import type { BattleSnapshot } from "@/battle/runtime";
import type { DamageFeedback } from "@/player/battleSequencer";

/**
 * 프레젠테이션 HP 원장 — 런타임은 명령 즉시 최종 상태가 되지만, 화면은 비트가
 * 재생될 때까지 이전 값을 보여야 한다. 시퀀스 시작 시 `before` 스냅샷으로 만들고,
 * 각 impact 비트(onDamageFeedback)에서 해당 데미지만큼만 깎는다. 시퀀스가 끝나면
 * 버리고 실제 스냅샷으로 돌아간다.
 */
export interface PresentedVitals {
  hp: number;
  readonly maxHp: number;
  defeated: boolean;
}

export interface BattlePresentationLedger {
  /** 적 id·아군 배틀러 id·recordId 중 무엇으로든 조회 가능. */
  vitalsFor(idOrRecordId: string | undefined): PresentedVitals | undefined;
  applyFeedback(feedback: DamageFeedback): void;
}

export function createPresentationLedger(before: BattleSnapshot): BattlePresentationLedger {
  const byKey = new Map<string, PresentedVitals>();
  const register = (battler: { id: string; recordId: string; hp: number; maxHp: number; defeated: boolean }): void => {
    const vitals: PresentedVitals = { hp: battler.hp, maxHp: battler.maxHp, defeated: battler.defeated };
    byKey.set(battler.id, vitals);
    byKey.set(battler.recordId, vitals);
  };
  for (const enemy of before.enemies) register(enemy);
  for (const actor of before.actors) register(actor);

  return {
    vitalsFor(idOrRecordId) {
      if (!idOrRecordId) return undefined;
      return byKey.get(idOrRecordId);
    },
    applyFeedback(feedback) {
      const vitals = byKey.get(feedback.targetId);
      if (!vitals || feedback.miss) return;
      // MP 회복은 HP 원장에 반영하지 않는다. MP 표기는 원장이 아니라 최종 스냅샷에서 바로
      // 읽으므로, 여기서 amount 를 HP 에 더하면 회복 비트 동안 화면 HP 만 부풀었다가
      // 다음 동기화에서 조용히 되돌아간다(실측: 마력약 MP+30 → HP 250→280→250).
      if (feedback.healing && feedback.resource === "mp") return;
      const delta = feedback.healing ? feedback.amount : -feedback.amount;
      vitals.hp = Math.max(0, Math.min(vitals.maxHp, vitals.hp + delta));
      if (vitals.hp <= 0) vitals.defeated = true;
      else if (feedback.healing && vitals.hp > 0) vitals.defeated = false;
    },
  };
}
