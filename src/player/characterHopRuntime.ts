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
  characterHopLiftPx,
  clearCharacterLift,
  type CharacterHop,
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

export type HopVisualScene = Partial<ShadowSceneContext & LandingSceneContext>;

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
  applyCharacterLift(sprite, liftPx);
  if (shadowCapable(scene)) syncCharacterShadow(scene, key, groundX, groundY, liftPx);
  return liftPx;
}

/** 접지 프레임: 리프트 0 복귀 + 그림자 숨김 + 착지 임팩트 1 회. */
export function finishHop(
  scene: HopVisualScene,
  key: string,
  sprite: HopSprite | undefined,
  groundX: number,
  groundY: number,
  hop: CharacterHop
): void {
  clearCharacterLift(sprite);
  hideCharacterShadow(scene, key);
  const plan = landingImpactPlan(hop, { reducedMotion: prefersReducedMotion() });
  if (!plan) return;
  if (!landingCapable(scene)) return;
  playLandingImpact(scene, plan, groundX, groundY, playLandingSe);
}

/** 중단 경로(맵 전이, 이동 취소, 스프라이트 소멸) — 임팩트 없이 접지만 되돌린다. */
export function abortHop(scene: HopVisualScene, key: string, sprite: HopSprite | undefined): void {
  clearCharacterLift(sprite);
  destroyCharacterShadow(scene, key);
}

function playLandingSe(resourceId: string): void {
  playAudioCommand({ resourceId, loop: false }, store.getCurrent());
}
