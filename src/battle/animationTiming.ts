// 전투 애니메이션 재생 시간의 순수 산식 — DOM 이 없어 규칙 층(src/battle)이 스냅샷에 길이를 실을 수 있다.
// 플레이어 층의 `battleAnimationPlayback.ts` 는 여기를 재수출한다(기존 import 경로 유지).
import type { BattleAnimationRecord } from "@/project/types";
import { generatedEffectFrameDurationMs } from "@/assets/generatedEffectSheets";

export const BATTLE_ANIMATION_FRAME_MS = 120;
export const DEFAULT_BATTLE_ANIMATION_DURATION_MS = 360;

/** 번들 생성 이펙트는 카탈로그 간격(75ms), 그 밖의 저작 시트는 120ms. */
export function battleAnimationFrameDurationMs(record: BattleAnimationRecord | undefined): number {
  return generatedEffectFrameDurationMs(record?.resourceId) ?? BATTLE_ANIMATION_FRAME_MS;
}

export function battleAnimationDurationMs(record: BattleAnimationRecord | undefined): number {
  const frameCount = Math.max(0, record?.frames?.length ?? 0);
  if (frameCount === 0) return DEFAULT_BATTLE_ANIMATION_DURATION_MS;
  const frameDurationMs = battleAnimationFrameDurationMs(record);
  return Math.max(frameDurationMs, frameCount * frameDurationMs);
}

/**
 * 후속(followUps)까지 포함한 전체 길이 — 본체 끝과 「시작 프레임 × 본체 프레임 간격 + 후속 길이」 중 늦은 쪽.
 * 후속의 후속은 세지 않는다(깊이 1). 시퀀서가 이 값으로 recover 비트를 늘려 잔향이 잘리지 않게 한다.
 */
export function battleAnimationChainDurationMs(
  record: BattleAnimationRecord | undefined,
  records: readonly BattleAnimationRecord[]
): number {
  const base = battleAnimationDurationMs(record);
  const frameMs = battleAnimationFrameDurationMs(record);
  let total = base;
  for (const followUp of record?.followUps ?? []) {
    const follow = records.find((entry) => entry.id === followUp.animationId);
    if (!follow) continue;
    total = Math.max(total, followUp.startFrame * frameMs + battleAnimationDurationMs(follow));
  }
  return total;
}
