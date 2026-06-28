import type { BattleResult } from "@/battle/runtime";
import type { BattleRewardsSnapshot } from "@/battle/types";
import { changeGold, changeItem, type PlaySession } from "@/project/session";

export type BattleRewardsOutcome = {
  readonly result: BattleResult;
  readonly rewards: BattleRewardsSnapshot;
};

export function applyBattleRewardsToSession(session: PlaySession, outcome: BattleRewardsOutcome): void {
  if (outcome.result !== "victory") return;
  const earnedExp = Math.max(0, Math.trunc(outcome.rewards.exp));
  for (const actorId of session.partyActorIds) {
    session.actorExperience[actorId] = (session.actorExperience[actorId] ?? 0) + earnedExp;
  }
  changeGold(session, "+=", Math.max(0, Math.trunc(outcome.rewards.gold)));
  for (const itemId of outcome.rewards.items) {
    changeItem(session, itemId, "+=", 1);
  }
}
