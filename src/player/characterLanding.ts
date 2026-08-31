/**
 * 착지 임팩트 — 체공이 끝나는 프레임에 화면 흔들림·먼지·효과음을 한 번 낸다.
 *
 * 순수 계획(`landingImpactPlan`) 과 실행(`playLandingImpact`) 을 갈라 둔다. 흔들림 세기는
 * 떨어진 높이에 비례하는데, 그 비례식은 테스트로 잠글 수 있어야 하고 카메라는 아니다.
 *
 * 접근성: `prefers-reduced-motion: reduce` 면 흔들림과 먼지를 빼고 효과음만 남긴다.
 * 화면 흔들림은 멀미를 유발하는 대표 패턴이라 무음보다 흔들림을 먼저 버린다.
 */

import { TILE_SIZE } from "@/assets/bundled";
import type { CharacterHop } from "@/player/characterHop";
import {
  CHARACTER_SHADOW_DEPTH_BASE,
  CHARACTER_SHADOW_TEXTURE_KEY,
  installCharacterShadowTexture,
  type ShadowImage,
  type ShadowSceneContext,
} from "@/player/characterShadow";

/** 저작 효과음이 없는 임팩트 착지의 기본 소리. 번들 카탈로그 id 라 프로젝트 등록이 필요 없다. */
export const DEFAULT_LANDING_SE = "cc0-se-kis-impactsoft-heavy-000";

/**
 * 한 칸 높이에서 떨어진 착지의 흔들림. 액션 전투 피격(0.006) 과 같은 급에서 시작한다.
 * 상한은 8 칸 낙하가 피격보다 세 배 무겁게 읽히도록 0.018 — 320×240 에서 약 4px 진폭이다.
 */
const SHAKE_RATIO_MIN = 0.003;
const SHAKE_RATIO_MAX = 0.018;
const SHAKE_MS_MIN = 60;
const SHAKE_MS_MAX = 180;
/** 이 높이 이상은 흔들림이 더 세지지 않는다. 4 칸이면 320×240 화면에서 충분히 무겁다. */
const SHAKE_SATURATION_LIFT_PX = TILE_SIZE * 4;
/** 이 높이 밑에서 떨어지면 임팩트를 내지 않는다 — 제자리 홉마다 화면이 흔들리면 멀미난다. */
export const MIN_IMPACT_LIFT_PX = TILE_SIZE;

/**
 * 먼지는 두 겹이다. 한 겹만 퍼뜨리면 "그림자가 커졌다" 로 읽혀서 착지 순간이 안 보인다.
 * 안쪽(짧고 진한 코어) + 바깥쪽(넓고 옅고 느린 링) 으로 나누면 터지는 타이밍이 잡힌다.
 */
const DUST_MS = 220;
const DUST_START_SCALE = 0.4;
const DUST_END_SCALE = 1.6;
const DUST_START_ALPHA = 0.5;
const DUST_RING_MS = 360;
const DUST_RING_START_SCALE = 0.8;
const DUST_RING_END_SCALE = 2.6;
const DUST_RING_START_ALPHA = 0.22;

/**
 * 높은 곳에서 떨어지면 먼지도 커진다 — 아래 값은 **포화 높이(4 칸)** 에서의 최종 지름이다.
 *
 * 왜 높이에 묶는가: 낙하가 시작 배율 ×3 을 받으므로(`FALL_PERSPECTIVE_MAX`) 8 칸에서 떨어진
 * 캐릭터 밑에 1 칸 홉과 같은 크기의 구름이 피면 충격이 안 실린다. 흔들림·소리와 같은
 * `impactStrength` 를 쓰므로 세 신호가 같은 높이에서 같이 커진다.
 */
const DUST_END_SCALE_MAX = 2.6;
const DUST_RING_END_SCALE_MAX = 4.4;

export type LandingImpactPlan = {
  readonly shakeMs: number;
  readonly shakeRatio: number;
  readonly dust: boolean;
  /** 먼지 두 겹의 최종 지름 배율. 0 이면 먼지를 내지 않는다. */
  readonly dustEndScale: number;
  readonly dustRingEndScale: number;
  readonly se?: string;
};

export type LandingImpactOptions = {
  readonly reducedMotion?: boolean;
};

/** 높이 → 0..1. 임팩트 하한 아래는 0 이고 포화 높이에서 1 이다. */
function impactStrength(liftPx: number): number {
  if (!Number.isFinite(liftPx) || liftPx <= MIN_IMPACT_LIFT_PX) return 0;
  const span = SHAKE_SATURATION_LIFT_PX - MIN_IMPACT_LIFT_PX;
  if (span <= 0) return 1;
  return Math.max(0, Math.min(1, (liftPx - MIN_IMPACT_LIFT_PX) / span));
}

/** 낼 게 하나도 없으면 null — 호출부가 카메라·오디오를 아예 건드리지 않게 한다. */
export function landingImpactPlan(hop: CharacterHop, options: LandingImpactOptions = {}): LandingImpactPlan | null {
  const strength = hop.impact ? impactStrength(hop.liftPx) : 0;
  const motion = strength > 0 && options.reducedMotion !== true;
  const se = hop.se ?? (strength > 0 ? DEFAULT_LANDING_SE : undefined);
  if (!motion && se === undefined) return null;
  return {
    shakeMs: motion ? Math.round(SHAKE_MS_MIN + (SHAKE_MS_MAX - SHAKE_MS_MIN) * strength) : 0,
    shakeRatio: motion ? SHAKE_RATIO_MIN + (SHAKE_RATIO_MAX - SHAKE_RATIO_MIN) * strength : 0,
    dust: motion,
    dustEndScale: motion ? DUST_END_SCALE + (DUST_END_SCALE_MAX - DUST_END_SCALE) * strength : 0,
    dustRingEndScale: motion
      ? DUST_RING_END_SCALE + (DUST_RING_END_SCALE_MAX - DUST_RING_END_SCALE) * strength
      : 0,
    se,
  };
}

export function prefersReducedMotion(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export type LandingSceneContext = ShadowSceneContext & {
  readonly cameras: { readonly main: { shake(durationMs: number, intensity: number): unknown } };
  readonly tweens: {
    add(config: {
      targets: unknown;
      scaleX?: number;
      scaleY?: number;
      alpha?: number;
      duration: number;
      ease?: string;
      onComplete?: () => void;
    }): unknown;
    /** 착지 스쿼시가 앞선 스케일 트윈(액션 전투 스윙 등) 과 겹치지 않게 끊는다. optional 이다. */
    killTweensOf?(target: unknown): unknown;
  };
};

/**
 * 계획을 실제 카메라/오디오/먼지로 낸다. 효과음 재생은 주입받는다 —
 * 이 모듈이 `store` 나 오디오 엔진을 직접 붙들면 단위 테스트에서 소리가 난다.
 */
export function playLandingImpact(
  scene: LandingSceneContext,
  plan: LandingImpactPlan | null,
  groundX: number,
  groundY: number,
  playSe?: (resourceId: string) => void
): void {
  if (!plan) return;
  if (plan.shakeMs > 0) scene.cameras.main.shake(plan.shakeMs, plan.shakeRatio);
  if (plan.dust) spawnLandingDust(scene, plan, groundX, groundY);
  if (plan.se !== undefined && playSe) playSe(plan.se);
}

/** 그림자 텍스처를 재활용해 퍼지며 사라지는 먼지. 새 스프라이트시트가 필요 없다. */
function spawnLandingDust(
  scene: LandingSceneContext,
  plan: LandingImpactPlan,
  groundX: number,
  groundY: number
): void {
  installCharacterShadowTexture(scene);
  spawnDustLayer(scene, groundX, groundY, DUST_START_SCALE, plan.dustEndScale, DUST_START_ALPHA, DUST_MS);
  spawnDustLayer(
    scene,
    groundX,
    groundY,
    DUST_RING_START_SCALE,
    plan.dustRingEndScale,
    DUST_RING_START_ALPHA,
    DUST_RING_MS
  );
}

function spawnDustLayer(
  scene: LandingSceneContext,
  groundX: number,
  groundY: number,
  startScale: number,
  endScale: number,
  startAlpha: number,
  durationMs: number
): void {
  let dust: ShadowImage;
  try {
    dust = scene.add.image(groundX, groundY, CHARACTER_SHADOW_TEXTURE_KEY);
  } catch {
    return;
  }
  dust.setOrigin(0.5, 0.5);
  dust.setDepth(CHARACTER_SHADOW_DEPTH_BASE + groundY + 1);
  dust.setScale(startScale, startScale);
  dust.setAlpha(startAlpha);
  dust.setVisible(true);
  scene.tweens.add({
    targets: dust,
    scaleX: endScale,
    scaleY: endScale,
    alpha: 0,
    duration: durationMs,
    onComplete: () => dust.destroy(),
  });
}
