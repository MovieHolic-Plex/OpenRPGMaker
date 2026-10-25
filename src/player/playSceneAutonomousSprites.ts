import {
  charsetIdleFrameIndex,
  charsetWalkFrameIndex,
  charsetWalkStepFromElapsedMs,
  isCharsetLikeTextureKey,
  NPC_MOVE_DURATION_MS,
} from "@/player/charsetMotion";
import { npcWalkFrameMsForStep } from "@/project/characterMotion";
import type { Dir } from "@/player/input";
import type { AutonomousNpcSprite } from "@/player/playSceneAutonomousTypes";
import { store } from "@/project/store";

export function setNpcWalkFrame(
  sprite: AutonomousNpcSprite | undefined,
  baseFrame: number,
  dir: Dir,
  elapsedMs: number,
  animationType: string,
  animationEnabled: boolean,
  /** 이번 한 칸의 걷는 시간. 발 그림은 한 칸에 두 장(npcWalkFrameMsForStep) — 느리게 걸으면 발도 느리게. */
  stepDurationMs: number = NPC_MOVE_DURATION_MS,
  /** 걷기 패턴 위상(mover.walkPhase). 칸마다 이어져 왼발·오른발이 번갈아 나온다. */
  walkPhase = 0,
): void {
  if (!animationEnabled) return;
  if (animationType === "fixedGraphic") return;
  if (!sprite || !isCharsetSprite(sprite.texture.key)) return;
  // 칩셋 자산이 걷기 주기를 직접 정했으면(meta.walkFrameMs) 그것을 따른다.
  const frameMs = store.getCurrent().assets.uploaded[sprite.texture.key]?.meta.walkFrameMs ?? npcWalkFrameMsForStep(stepDurationMs);
  sprite.setFrame(charsetWalkFrameIndex(baseFrame, dir, walkPhase + charsetWalkStepFromElapsedMs(elapsedMs, frameMs)));
}

export function setNpcIdleFrame(
  sprite: AutonomousNpcSprite | undefined,
  baseFrame: number,
  dir: Dir,
  animationType: string,
  animationEnabled: boolean
): void {
  if (!animationEnabled) return;
  if (animationType === "fixedGraphic") return;
  if (!sprite) return;
  if (isCharsetSprite(sprite.texture.key)) sprite.setFrame(charsetIdleFrameIndex(baseFrame, dir));
}

function isCharsetSprite(key: string): boolean {
  return isCharsetLikeTextureKey(key) || store.getCurrent().assets.uploaded[key]?.kind === "charset";
}

export function applySpriteAlpha(sprite: AutonomousNpcSprite | undefined, opacity: number): void {
  if (!sprite) return;
  sprite.setAlpha(opacity / 255);
}
