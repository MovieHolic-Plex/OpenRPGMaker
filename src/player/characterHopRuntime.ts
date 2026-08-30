/**
 * 체공 시각화 글루 — 곡선(characterHop) · 그림자(characterShadow) · 착지(characterLanding) 를
 * 한 프레임 단위로 묶는다. 주인공과 NPC 가 **같은 두 함수**를 쓴다: 매 프레임 `applyHopFrame`,
 * 끝나는 프레임에 `finishHop`.
 *
 * 씬 능력은 전부 optional 이다. 단위 테스트의 목 씬은 `add`/`textures`/`cameras`/`tweens` 를
 * 갖고 있지 않고, 그때는 리프트만 적용되고 그림자·임팩트는 조용히 빠진다. 리프트가 본질이고
 * 나머지는 장식이라 이 우선순위가 맞다.
 */

import { playAudioCommand } from "@/player/audio";
import {
  applyCharacterLift,
  applyHopScale,
  characterHopLiftPx,
  clearCharacterLift,
  hopAirScale,
  hopBaseScaleOf,
  hopLandingSquashScale,
  HOP_SCALE_NEUTRAL,
  HOP_SQUASH_MS,
  type CharacterHop,
  type HopScale,
  type HopSprite,
} from "@/player/characterHop";
import {
  landingImpactPlan,
  playLandingImpact,
  prefersReducedMotion,
  type LandingSceneContext,
} from "@/player/characterLanding";
import {
  destroyCharacterShadow,
  hideCharacterShadow,
  syncCharacterShadow,
  type ShadowSceneContext,
} from "@/player/characterShadow";
import { store } from "@/project/store";

/**
 * 스쿼시 기준 배율 풀. 그림자 풀과 같은 키를 쓴다.
 *
 * 왜 풀에 담는가: 스트레치는 매 프레임 `base × factor` 로 덮어쓰므로 기준을 프레임마다 스프라이트에서
 * 읽으면 직전 프레임의 늘어난 값이 기준이 되어 계속 커진다. 체공 시작 프레임에 한 번 붙잡아
 * 두고, 접지·중단에서 그 값으로 되돌린 뒤 버린다.
 */
export type HopScalePool = { characterHopScales?: Map<string, HopScale> };

export type HopVisualScene = Partial<ShadowSceneContext & LandingSceneContext> & HopScalePool;

/** 그림자 풀 키. 주인공은 고정, 이벤트는 id — 스프라이트 풀과 1:1 이다. */
export const PLAYER_SHADOW_KEY = "__player";

function shadowCapable(scene: HopVisualScene): scene is ShadowSceneContext {
  return typeof scene.add?.image === "function" && typeof scene.textures?.exists === "function";
}

function landingCapable(scene: HopVisualScene): scene is ShadowSceneContext & LandingSceneContext {
  // 능력 검사를 먼저 한다 — `shadowCapable` 로 좁히면 optional 이던 cameras/tweens 가 사라진다.
  const hasCamera = typeof scene.cameras?.main?.shake === "function";
  const hasTweens = typeof scene.tweens?.add === "function";
  return hasCamera && hasTweens && shadowCapable(scene);
}

/**
 * 한 프레임의 체공 상태를 스프라이트에 반영한다. 반환값은 이번 프레임의 리프트(px).
 *
 * ⚠️ **호출 순서 계약**: 프레임 갱신(`setFrame`/`setNpcWalkFrame`) 뒤에 불러야 한다.
 * Phaser 의 `setFrame` 이 `updateDisplayOrigin()` 으로 원점을 되돌려 리프트를 지운다.
 */
export function applyHopFrame(
  scene: HopVisualScene,
  key: string,
  sprite: HopSprite | undefined,
  groundX: number,
  groundY: number,
  hop: CharacterHop,
  progress: number
): number {
  const liftPx = characterHopLiftPx(hop, progress);
  // 스케일 먼저, 리프트 나중 — applyCharacterLift 가 그 시점 scaleY 로 원점을 나눈다.
  // 배율은 스트레치(속도) × 원근(높이) 를 곱한 값이다 — hopAirScale 참고.
  applyHopScale(sprite, rememberHopBaseScale(scene, key, sprite), hopAirScale(hop, progress));
  applyCharacterLift(sprite, liftPx);
  // 그림자 기준은 이번 체공의 시작 높이다 — 8 칸 낙하에서 전 구간 자라게 하는 값.
  if (shadowCapable(scene)) syncCharacterShadow(scene, key, groundX, groundY, liftPx, hop.liftPx);
  return liftPx;
}

function rememberHopBaseScale(scene: HopVisualScene, key: string, sprite: HopSprite | undefined): HopScale {
  scene.characterHopScales ??= new Map();
  const known = scene.characterHopScales.get(key);
  if (known) return known;
  const base = hopBaseScaleOf(sprite);
  scene.characterHopScales.set(key, base);
  return base;
}

/** 기준 배율을 꺼내면서 풀에서 지운다. 없으면 스프라이트의 현재 배율(=건드린 적 없음)이 기준이다. */
function takeHopBaseScale(scene: HopVisualScene, key: string, sprite: HopSprite | undefined): HopScale {
  const known = scene.characterHopScales?.get(key);
  scene.characterHopScales?.delete(key);
  return known ?? hopBaseScaleOf(sprite);
}

/** 접지 프레임: 리프트 0 복귀 + 배율 복귀 + 그림자 숨김 + 착지 임팩트(스쿼시 포함) 1 회. */
export function finishHop(
  scene: HopVisualScene,
  key: string,
  sprite: HopSprite | undefined,
  groundX: number,
  groundY: number,
  hop: CharacterHop
): void {
  const base = takeHopBaseScale(scene, key, sprite);
  applyHopScale(sprite, base, HOP_SCALE_NEUTRAL);
  clearCharacterLift(sprite);
  hideCharacterShadow(scene, key);
  const plan = landingImpactPlan(hop, { reducedMotion: prefersReducedMotion() });
  if (!plan) return;
  if (!landingCapable(scene)) return;
  playLandingImpact(scene, plan, groundX, groundY, playLandingSe);
  // 스쿼시는 화면 모션과 같은 급이라 임팩트(dust) 와 운명을 같이 한다 — reduced-motion 이면 빠진다.
  if (plan.dust) playLandingSquash(scene, sprite, base, hop);
}

/**
 * 착지 눌림 — 즉시 눌러 놓고 원래 배율로 튀어 돌아온다. 트윈이 끝나기 전에 다음 체공이 시작되면
 * `rememberHopBaseScale` 이 눌린 배율을 기준으로 잡을 수 있으므로 시작에서 트윈을 끊는다.
 */
function playLandingSquash(
  scene: LandingSceneContext,
  sprite: HopSprite | undefined,
  base: HopScale,
  hop: CharacterHop
): void {
  if (!sprite?.setScale) return;
  const squash = hopLandingSquashScale(hop);
  if (squash.y >= 1) return;
  applyHopScale(sprite, base, squash);
  scene.tweens.add({
    targets: sprite,
    scaleX: base.x,
    scaleY: base.y,
    duration: HOP_SQUASH_MS,
    ease: "Back.easeOut",
    onComplete: () => applyHopScale(sprite, base, HOP_SCALE_NEUTRAL),
  });
}

/** 맵 전이·런타임 리셋 — 스프라이트가 통째로 사라지므로 기준 배율 풀도 함께 비운다. */
export function clearAllHopScales(scene: HopScalePool): void {
  scene.characterHopScales?.clear();
}

/** 중단 경로(맵 전이, 이동 취소, 스프라이트 소멸) — 임팩트 없이 접지·배율만 되돌린다. */
export function abortHop(scene: HopVisualScene, key: string, sprite: HopSprite | undefined): void {
  const base = takeHopBaseScale(scene, key, sprite);
  scene.tweens?.killTweensOf?.(sprite);
  applyHopScale(sprite, base, HOP_SCALE_NEUTRAL);
  clearCharacterLift(sprite);
  destroyCharacterShadow(scene, key);
}

function playLandingSe(resourceId: string): void {
  playAudioCommand({ resourceId, loop: false }, store.getCurrent());
}
