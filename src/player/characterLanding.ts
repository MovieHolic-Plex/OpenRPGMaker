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

/** 한 칸 높이에서 떨어진 착지의 흔들림. 액션 전투 피격(0.006) 과 같은 급이다. */
const SHAKE_RATIO_MIN = 0.003;
const SHAKE_RATIO_MAX = 0.012;
const SHAKE_MS_MIN = 60;
const SHAKE_MS_MAX = 150;
/** 이 높이 이상은 흔들림이 더 세지지 않는다. 4 칸이면 320×240 화면에서 충분히 무겁다. */
const SHAKE_SATURATION_LIFT_PX = TILE_SIZE * 4;
/** 이 높이 밑에서 떨어지면 임팩트를 내지 않는다 — 제자리 홉마다 화면이 흔들리면 멀미난다. */
export const MIN_IMPACT_LIFT_PX = TILE_SIZE;

const DUST_MS = 220;
const DUST_START_SCALE = 0.4;
const DUST_END_SCALE = 1.6;
const DUST_START_ALPHA = 0.45;

export type LandingImpactPlan = {
  readonly shakeMs: number;
  readonly shakeRatio: number;
  readonly dust: boolean;
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
      onComplete?: () => void;
    }): unknown;
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
  if (plan.dust) spawnLandingDust(scene, groundX, groundY);
  if (plan.se !== undefined && playSe) playSe(plan.se);
}

/** 그림자 텍스처를 재활용해 퍼지며 사라지는 먼지 한 겹. 새 스프라이트시트가 필요 없다. */
function spawnLandingDust(scene: LandingSceneContext, groundX: number, groundY: number): void {
  installCharacterShadowTexture(scene);
  let dust: ShadowImage;
  try {
    dust = scene.add.image(groundX, groundY, CHARACTER_SHADOW_TEXTURE_KEY);
  } catch {
    return;
  }
  dust.setOrigin(0.5, 0.5);
  dust.setDepth(CHARACTER_SHADOW_DEPTH_BASE + groundY + 1);
  dust.setScale(DUST_START_SCALE, DUST_START_SCALE);
  dust.setAlpha(DUST_START_ALPHA);
  dust.setVisible(true);
  scene.tweens.add({
    targets: dust,
    scaleX: DUST_END_SCALE,
    scaleY: DUST_END_SCALE,
    alpha: 0,
    duration: DUST_MS,
    onComplete: () => dust.destroy(),
  });
}
