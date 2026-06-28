import type { BattleAnimationSnapshot } from "@/battle/types";
import type { BattleAnimationId, BattleAnimationRecord } from "@/project/types";

export function createBattleAnimationSnapshot(
  records: readonly BattleAnimationRecord[],
  animationId: BattleAnimationId,
  targetId: string
): BattleAnimationSnapshot {
  const record = records.find((entry) => entry.id === animationId);
  const timings = record?.timings ?? [];
  return {
    animationId,
    targetId,
    name: record?.name,
    resourceId: record?.resourceId,
    scope: record?.scope,
    position: record?.position,
    soundResourceIds: timings.flatMap((timing) => timing.soundResourceId ? [timing.soundResourceId] : []),
    flashTargets: timings.flatMap((timing) => timing.flash ? [timing.flash.target] : []),
    screenShake: timings.some((timing) => Boolean(timing.screenShake)),
    frameCount: record?.frames?.length ?? 0,
  };
}
