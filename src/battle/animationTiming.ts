// 전투 애니메이션 재생 시간의 순수 산식 — DOM 이 없어 규칙 층(src/battle)이 스냅샷에 길이를 실을 수 있다.
// 플레이어 층의 `battleAnimationPlayback.ts` 는 여기를 재수출한다(기존 import 경로 유지).
import type { BattleAnimationRecord, BattleAnimationTiming } from "@/project/types";
import { generatedEffectFrameDurationMs } from "@/assets/generatedEffectSheets";
import pixelFxTiming from "@/vendor/pixelfx/timing.json";

export const BATTLE_ANIMATION_FRAME_MS = 120;
export const DEFAULT_BATTLE_ANIMATION_DURATION_MS = 360;

/** 번들 생성 이펙트는 카탈로그 간격(75ms), 그 밖의 저작 시트는 120ms. */
export function battleAnimationFrameDurationMs(record: BattleAnimationRecord | undefined): number {
  return generatedEffectFrameDurationMs(record?.resourceId) ?? BATTLE_ANIMATION_FRAME_MS;
}

/** 프레임 하나가 보이는 기본 프레임 수(hold, 1~16). 없거나 이상하면 1 — 옛 레코드의 길이는 그대로다. */
export function battleAnimationFrameHold(record: BattleAnimationRecord | undefined, frameIndex: number): number {
  const hold = record?.frames?.[frameIndex]?.hold;
  return typeof hold === "number" && Number.isFinite(hold) && hold >= 1 ? Math.min(16, Math.floor(hold)) : 1;
}

/** 0번 프레임부터 `frameIndex` 번 프레임이 시작될 때까지의 기본 프레임 수(hold 합). hold 가 없으면 frameIndex 그대로. */
export function battleAnimationFrameStartUnits(record: BattleAnimationRecord | undefined, frameIndex: number): number {
  const count = Math.max(0, Math.min(frameIndex, record?.frames?.length ?? 0));
  let units = 0;
  for (let index = 0; index < count; index += 1) units += battleAnimationFrameHold(record, index);
  return units + Math.max(0, frameIndex - count);
}

/** 흐른 기본 프레임 수 → 그때 보이는 프레임(startIndex 부터 재생한 경우). 끝을 지나면 frames.length. */
export function battleAnimationFrameAtUnits(record: BattleAnimationRecord | undefined, startIndex: number, elapsedUnits: number): number {
  const frameCount = record?.frames?.length ?? 0;
  const target = battleAnimationFrameStartUnits(record, startIndex) + Math.max(0, elapsedUnits);
  let index = startIndex;
  while (index < frameCount && battleAnimationFrameStartUnits(record, index + 1) <= target) index += 1;
  return index;
}

/** 전투에서 pixelfx 효과가 차례를 붙잡는 최대 길이. 연기·불티 꼬리는 다음 행동과 겹쳐 사라진다(battleAnimationDom). */
export const PIXEL_FX_BATTLE_HOLD_MS = 1600;
/** 반복 효과(투사체 비행·오라)를 전투에서 한 번 틀 때의 길이. */
export const PIXEL_FX_BATTLE_LOOP_MS = 1200;

/** pixelfx 효과의 원래 길이(ms)와 반복 여부. 목록에 없으면 undefined. */
export function pixelFxEffectTiming(effectId: string | undefined): { readonly durationMs: number; readonly loop: boolean } | undefined {
  const entry = effectId ? (pixelFxTiming as Record<string, readonly number[]>)[effectId] : undefined;
  return entry ? { durationMs: entry[0] ?? 1000, loop: entry[1] === 1 } : undefined;
}

/** pixelfx 레코드가 전투 차례를 붙잡는 길이(속도 반영, 상한 PIXEL_FX_BATTLE_HOLD_MS). */
export function pixelFxBattleDurationMs(record: BattleAnimationRecord): number {
  const timing = pixelFxEffectTiming(record.pixelFx?.effectId);
  const speed = record.pixelFx?.speed && record.pixelFx.speed > 0 ? record.pixelFx.speed : 1;
  const raw = timing ? (timing.loop ? PIXEL_FX_BATTLE_LOOP_MS : timing.durationMs / speed) : DEFAULT_BATTLE_ANIMATION_DURATION_MS;
  return Math.round(Math.min(PIXEL_FX_BATTLE_HOLD_MS, Math.max(BATTLE_ANIMATION_FRAME_MS, raw)));
}

export function battleAnimationDurationMs(record: BattleAnimationRecord | undefined): number {
  if (record?.pixelFx) return pixelFxBattleDurationMs(record);
  const frameCount = Math.max(0, record?.frames?.length ?? 0);
  if (frameCount === 0) return DEFAULT_BATTLE_ANIMATION_DURATION_MS;
  const frameDurationMs = battleAnimationFrameDurationMs(record);
  return Math.max(frameDurationMs, battleAnimationFrameStartUnits(record, frameCount) * frameDurationMs);
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
    total = Math.max(total, battleAnimationFrameStartUnits(record, followUp.startFrame) * frameMs + battleAnimationDurationMs(follow));
  }
  return total;
}

/** 한 프레임에 살아 있는 타이밍 효과. 플래시·흔들림은 `durationFrames` 동안 이어진다. */
export type ActiveTimingEffects = {
  readonly flash?: BattleAnimationTiming["flash"];
  readonly screenShake?: BattleAnimationTiming["screenShake"];
};

/**
 * `frameIndex` 에 살아 있는 플래시·흔들림을 고른다.
 *
 * 타이밍은 시작 프레임 한 곳에만 적혀 있지만 효과는 `durationFrames` 동안 이어져야 한다 —
 * 예전에는 시작 프레임과 같은 프레임에만 클래스를 걸어 4~7 프레임짜리 플래시가 한 프레임(100ms)
 * 만 보이고 꺼졋다(실측: 생성 이펙트 32종 전부 durationFrames 4~8). 같은 종류가 겹치면 **나중에
 * 시작한** 타이밍이 이긴다. `durationFrames` 가 0·음수·비정상이면 시작 프레임 한 칸으로 본다.
 */
export function activeTimingEffects(
  timings: readonly BattleAnimationTiming[] | undefined,
  frameIndex: number
): ActiveTimingEffects {
  let flash: BattleAnimationTiming["flash"];
  let flashStart = -1;
  let screenShake: BattleAnimationTiming["screenShake"];
  let shakeStart = -1;
  for (const timing of timings ?? []) {
    if (timing.frameIndex > frameIndex) continue;
    if (timing.flash && timing.frameIndex >= flashStart && frameIndex < timing.frameIndex + effectFrames(timing.flash.durationFrames)) {
      flash = timing.flash;
      flashStart = timing.frameIndex;
    }
    if (
      timing.screenShake &&
      timing.frameIndex >= shakeStart &&
      frameIndex < timing.frameIndex + effectFrames(timing.screenShake.durationFrames)
    ) {
      screenShake = timing.screenShake;
      shakeStart = timing.frameIndex;
    }
  }
  return { flash, screenShake };
}

function effectFrames(durationFrames: number): number {
  return Number.isFinite(durationFrames) && durationFrames >= 1 ? Math.floor(durationFrames) : 1;
}
