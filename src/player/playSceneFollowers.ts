import { mapTileSize } from "@/project/tileGeometry";
import { DEFAULT_EASYRPG_CHARSET_ID } from "@/project/defaults/constants";
import { store } from "@/project/store";
import { characterSpriteX, characterSpriteY, placeCharacterSprite, updateCharacterDepth } from "@/player/characterDepth";
import { eventSpriteScale, resolveEventSpriteTexture } from "@/player/eventSpriteResources";
import { followerPositions, type FollowerSlotMotion } from "@/project/followers";
import type { PlaySceneContext } from "@/player/playSceneTypes";
import {
  NPC_MOVE_DURATION_MS,
  charsetIdleFrameIndex,
  charsetWalkFrameIndex,
  charsetWalkStepFromElapsedMs,
  isEasyRpgCharsetTextureKey,
} from "@/player/charsetMotion";
import type { Dir } from "@/player/input";

/**
 * 팔로워 슬롯 보간 상태(스프라이트 계층 전용). 슬롯(궤적 칸)은 플레이어 걸음이
 * 끝날 때만 바뀌지만, 화면 좌표는 렌더 프레임마다 직전 슬롯 → 이번 슬롯 사이를
 * 이어 그려야 스냅 이동이 사라진다. 스프라이트의 현재 좌표를 기준으로 쓰면
 * 프레임마다 목적지가 자기 뒤로 밀리는 점근 추격이 되므로 반드시 슬롯이 기준이다.
 */
const followerSlotMotion = new Map<string, FollowerSlotMotion>();

/** sync 가 마지막으로 계산한 슬롯·프레임 정보. 매 프레임 도는 보간기가 이걸로 그린다. */
type FollowerRenderState = {
  readonly texture: string;
  readonly baseFrame: number;
  readonly isCharset: boolean;
  readonly direction: Dir;
  readonly slot: { readonly x: number; readonly y: number };
};
const followerRenderState = new Map<string, FollowerRenderState>();
/** 걷기 주기 위상 — 걷는 동안 연속 누적하고, 서 있으면 0 으로 돌려 정지 프레임을 유지한다. */
const followerWalkElapsedMs = new Map<string, number>();

function isFollowerCharsetTexture(textureKey: string): boolean {
  return isEasyRpgCharsetTextureKey(textureKey) || store.getCurrent().assets.uploaded[textureKey]?.kind === "charset";
}

function lerp(start: number, end: number, progress: number): number {
  return start + (end - start) * progress;
}

/** 슬롯이 그대로면 유지, 바뀌면 직전 슬롯(또는 걷던 자리)에서 이번 슬롯으로 새 걸음을 연다. */
function nextFollowerMotion(
  key: string,
  position: { readonly x: number; readonly y: number },
  now: number,
  durationMs: number
): FollowerSlotMotion | null {
  const last = followerSlotMotion.get(key);
  if (last && last.to.x === position.x && last.to.y === position.y) {
    return now - last.startedAt < last.durationMs ? last : null;
  }
  const from = last ? lerpFollower(last, now) ?? last.to : position;
  const motion: FollowerSlotMotion = { from, to: position, startedAt: now, durationMs };
  followerSlotMotion.set(key, motion);
  return motion;
}

/** 진행 중인 걸음의 현재 화면 좌표(타일 단위). 끝났으면 null. */
function lerpFollower(motion: FollowerSlotMotion, now: number): { x: number; y: number } | null {
  const progress = (now - motion.startedAt) / motion.durationMs;
  if (progress >= 1) return null;
  return { x: lerp(motion.from.x, motion.to.x, progress), y: lerp(motion.from.y, motion.to.y, progress) };
}

export function syncFollowerSprites(
  scene: PlaySceneContext,
  options?: { readonly stepDurationMs?: number }
): void {
  const expected = new Set<string>();
  const project = store.getCurrent();
  const now = scene.game?.loop?.time ?? 0;
  // 걸음 지속 시간은 플레이어 걸음과 1:1 — 걸음 완료 시점에 열린 보간이 다음
  // 완료 시점에 정확히 끝나 팔로워가 한 칸 뒤를 걷는다(옵션 없으면 NPC 기본값).
  const stepDurationMs = options?.stepDurationMs ?? NPC_MOVE_DURATION_MS;
  for (const position of followerPositions(scene.session, project.system.companions, { project, map: scene.map })) {
    const key = followerSpriteKey(position.follower);
    expected.add(key);
    const spriteRef = position.follower.graphic.sprite;
    if (!spriteRef || position.follower.graphic.transparent === true) {
      destroyFollowerSprite(scene, key);
      continue;
    }
    const motion = nextFollowerMotion(key, position, now, stepDurationMs);
    const progress = motion ? Math.min(1, (now - motion.startedAt) / motion.durationMs) : 0;
    const spriteTile = motion
      ? { x: lerp(motion.from.x, motion.to.x, progress), y: lerp(motion.from.y, motion.to.y, progress) }
      : position;
    const texture = resolveEventSpriteTexture(project, spriteRef.id, position.follower.graphic.pattern);
    const direction = position.direction ?? position.follower.graphic.direction ?? "down";
    const charsetFrame = texture && isFollowerCharsetTexture(texture.texture) && typeof texture.frame === "number"
      ? texture.frame
      : undefined;
    const frame = charsetFrame !== undefined ? charsetIdleFrameIndex(charsetFrame, direction) : numericFollowerFrame(texture?.frame);
    followerRenderState.set(key, {
      texture: texture?.texture ?? DEFAULT_EASYRPG_CHARSET_ID,
      baseFrame: numericFollowerFrame(texture?.frame),
      isCharset: charsetFrame !== undefined,
      direction,
      slot: { x: position.x, y: position.y },
    });
    let sprite = scene.followerSprites.get(key);
    if (!sprite) {
      sprite = scene.add.sprite(
        characterSpriteX(spriteTile.x, mapTileSize(scene.map)),
        characterSpriteY(spriteTile.y, mapTileSize(scene.map)),
        texture?.texture ?? DEFAULT_EASYRPG_CHARSET_ID,
        frame
      );
      placeCharacterSprite(sprite, "same");
      scene.followerSprites.set(key, sprite);
    } else {
      sprite.setTexture(texture?.texture ?? DEFAULT_EASYRPG_CHARSET_ID, frame);
      sprite.setPosition(characterSpriteX(spriteTile.x, mapTileSize(scene.map)), characterSpriteY(spriteTile.y, mapTileSize(scene.map)));
      updateCharacterDepth(sprite, "same");
    }
    // 동료도 배율을 따른다 — 큰 동료가 이벤트로 서 있을 때와 따라올 때 크기가 달라지면
    // 같은 캐릭터로 보이지 않는다. 자동 배율은 현재 맵에서 다시 계산한다.
    sprite.setScale(eventSpriteScale(texture, sprite, position.follower.graphic.scale, mapTileSize(scene.map), position.follower.graphic.scaleMode));
    sprite.setFrame(frame);
  }
  for (const key of [...scene.followerSprites.keys()]) {
    if (!expected.has(key)) destroyFollowerSprite(scene, key);
  }
}

/**
 * 매 프레임 보간기. updatePlayScene 이 렌더 프레임마다 부른다 — 논리 틱이 0 인
 * 고주사율 프레임에서도 이어 그려야 걸음이 매끈하다. 슬롯 자체는 걸음 완료 때만
 * 바뀌고(syncFollowerSprites), 여기서는 화면 좌표와 걷기 프레임만 진행시킨다.
 */
export function updateFollowerSpriteMotion(scene: PlaySceneContext, deltaMs: number): void {
  const now = scene.game?.loop?.time ?? 0;
  for (const [key, sprite] of scene.followerSprites) {
    const state = followerRenderState.get(key);
    if (!state) continue;
    const motion = followerSlotMotion.get(key);
    if (motion && now - motion.startedAt < motion.durationMs) {
      const progress = (now - motion.startedAt) / motion.durationMs;
      sprite.setPosition(
        characterSpriteX(lerp(motion.from.x, motion.to.x, progress), mapTileSize(scene.map)),
        characterSpriteY(lerp(motion.from.y, motion.to.y, progress), mapTileSize(scene.map))
      );
      updateCharacterDepth(sprite, "same");
      if (state.isCharset) {
        const walkElapsed = (followerWalkElapsedMs.get(key) ?? 0) + Math.max(0, deltaMs);
        followerWalkElapsedMs.set(key, walkElapsed);
        sprite.setFrame(charsetWalkFrameIndex(state.baseFrame, state.direction, charsetWalkStepFromElapsedMs(walkElapsed)));
      }
    } else if (motion) {
      // 걸음 완료 — 슬롯 중앙에 정착하고 정지 프레임으로.
      followerSlotMotion.delete(key);
      followerWalkElapsedMs.set(key, 0);
      sprite.setPosition(characterSpriteX(state.slot.x, mapTileSize(scene.map)), characterSpriteY(state.slot.y, mapTileSize(scene.map)));
      updateCharacterDepth(sprite, "same");
      if (state.isCharset) sprite.setFrame(charsetIdleFrameIndex(state.baseFrame, state.direction));
    }
  }
}

export function clearFollowerSprites(scene: Pick<PlaySceneContext, "followerSprites">): void {
  for (const key of [...scene.followerSprites.keys()]) destroyFollowerSprite(scene as PlaySceneContext, key);
}

function destroyFollowerSprite(scene: Pick<PlaySceneContext, "followerSprites">, key: string): void {
  scene.followerSprites.get(key)?.destroy();
  scene.followerSprites.delete(key);
  followerSlotMotion.delete(key);
  followerRenderState.delete(key);
  followerWalkElapsedMs.delete(key);
}

function followerSpriteKey(follower: { readonly id?: string; readonly name: string }): string {
  // Prefer stable id; fall back to name for saves from before this patch.
  if (follower.id) return `follower:${follower.id}`;
  return `follower:${follower.name}`;
}

function numericFollowerFrame(frame: string | number | undefined): number {
  return typeof frame === "number" && Number.isFinite(frame) ? frame : 0;
}
