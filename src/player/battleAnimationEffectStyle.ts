/**
 * 애니메이션 타이밍의 flash/screenShake 를 CSS 커스텀 프로퍼티로 옮긴다.
 *
 * 왜 필요한가: 예전에는 렌더러가 `Boolean(timing.flash)` 로 존재 여부만 보고 클래스를
 * 토글해서, 감독이 저작한 **색·지속·세기가 전부 버려졌다**. 그 결과 「타격」·「마법 충격」·
 * 「회복 빛」이 같은 시트의 같은 패턴을 쓰면서 유일한 차이인 flash 색마저 흰색으로 뭉개져
 * 화면에서 완전히 동일하게 보였다.
 *
 * 계산은 여기(순수 함수)에서 하고 CSS 는 변수만 소비한다 — 매핑을 테스트로 고정하기 위해서다.
 */
import type { BattleAnimationFlash, BattleAnimationScreenShake } from "@/project/types";
import { BATTLE_ANIMATION_FRAME_MS } from "@/player/battleAnimationPlayback";

/** 화면 전체를 덮는 플래시의 최대 불투명도. 기존 고정값(0.45)을 상한으로 유지한다. */
const FLASH_PEAK_ALPHA = 0.45;

/** RM2K3 흔들림 power(1~9) 가 만드는 진폭(px) 범위. */
const SHAKE_MIN_AMPLITUDE_PX = 2;
const SHAKE_MAX_AMPLITUDE_PX = 18;

/** RM2K3 흔들림 speed(1~9) 가 만드는 1회 진동 주기(ms) 범위. speed 가 클수록 짧다. */
const SHAKE_SLOWEST_PERIOD_MS = 320;
const SHAKE_FASTEST_PERIOD_MS = 80;

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

/** 1~9 를 0~1 로 편다. 범위 밖/비정상 입력은 하한으로 접는다. */
function unitFromRank(rank: number): number {
  return (clamp(rank, 1, 9) - 1) / 8;
}

/** 프레임 수 → ms. 재생 간격과 같은 상수를 써야 애니메이션과 어긋나지 않는다. */
export function framesToMs(frames: number): number {
  return Math.max(1, Math.round(clamp(frames, 1, 999))) * BATTLE_ANIMATION_FRAME_MS;
}

export type EffectCssVariables = Readonly<Record<string, string>>;

/**
 * flash 타이밍 → CSS 변수.
 * `gray` 는 RM2K3 의 채도 제거 채널이라 색을 회색으로 끌어당기는 데 쓴다.
 */
export function flashCssVariables(flash: BattleAnimationFlash): EffectCssVariables {
  const { red, green, blue, gray } = flash.color;
  const grayUnit = clamp(gray, 0, 255) / 255;
  const luma = 0.299 * clamp(red, 0, 255) + 0.587 * clamp(green, 0, 255) + 0.114 * clamp(blue, 0, 255);
  const mix = (channel: number): number =>
    Math.round(clamp(channel, 0, 255) * (1 - grayUnit) + luma * grayUnit);

  return {
    "--battle-flash-color": `rgba(${mix(red)}, ${mix(green)}, ${mix(blue)}, ${FLASH_PEAK_ALPHA})`,
    "--battle-flash-duration": `${framesToMs(flash.durationFrames)}ms`,
  };
}

/**
 * screenShake 타이밍 → CSS 변수.
 * power 는 진폭, speed 는 1회 진동 주기, durationFrames 는 총 길이를 정한다.
 * CSS 는 `주기 × 반복횟수 = 총 길이` 로 재생하므로 반복 횟수를 여기서 계산해 넘긴다.
 */
export function screenShakeCssVariables(shake: BattleAnimationScreenShake): EffectCssVariables {
  const powerUnit = unitFromRank(shake.power);
  const speedUnit = unitFromRank(shake.speed);
  const amplitude = SHAKE_MIN_AMPLITUDE_PX + powerUnit * (SHAKE_MAX_AMPLITUDE_PX - SHAKE_MIN_AMPLITUDE_PX);
  const period = SHAKE_SLOWEST_PERIOD_MS - speedUnit * (SHAKE_SLOWEST_PERIOD_MS - SHAKE_FASTEST_PERIOD_MS);
  const totalMs = framesToMs(shake.durationFrames);

  return {
    "--battle-shake-x": `${amplitude.toFixed(2)}px`,
    // 세로는 가로의 2/3 — 순수 수평 흔들림보다 타격감이 산다(기존 6px/4px 비율 유지).
    "--battle-shake-y": `${(amplitude * (2 / 3)).toFixed(2)}px`,
    "--battle-shake-period": `${Math.round(period)}ms`,
    "--battle-shake-iterations": String(Math.max(1, Math.round(totalMs / period))),
  };
}

/** 효과가 없는 프레임에서 변수를 걷어낸다. 남아 있으면 다음 효과가 이전 값을 물려받는다. */
export const BATTLE_EFFECT_CSS_VARIABLES: readonly string[] = [
  "--battle-flash-color",
  "--battle-flash-duration",
  "--battle-shake-x",
  "--battle-shake-y",
  "--battle-shake-period",
  "--battle-shake-iterations",
];
