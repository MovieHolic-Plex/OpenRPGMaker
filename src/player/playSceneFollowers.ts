import { setCharacterBaseOrigin } from "./characterOrigin";
import { mapTileSize } from "@/project/tileGeometry";
import { mapCharacterSizeFactor } from "@/project/characterScale";
import { projectReferenceTileSize } from "@/project/mapViewScale";
import { DEFAULT_EASYRPG_CHARSET_ID } from "@/project/defaults/constants";
import { store } from "@/project/store";
import { characterSpriteX, characterSpriteY, placeCharacterSprite, updateCharacterDepth } from "@/player/characterDepth";
import { eventSpriteScale, resolveEventSpriteTexture } from "@/player/eventSpriteResources";
import { followerMinDistance, followerPositions, getFollowerBodySpan, setFollowerBodySpan, type FollowerSlotMotion, type FollowerWorld } from "@/project/followers";
import type { PlaySceneContext } from "@/player/playSceneTypes";
import {
  NPC_MOVE_DURATION_MS,
  charsetIdleFrameIndex,
  charsetWalkFrameIndex,
  charsetWalkStepFromElapsedMs,
  isEasyRpgCharsetTextureKey,
} from "@/player/charsetMotion";
import type { Dir } from "@/player/input";
import { boardedVehicleId } from "@/project/vehicles";
import { findBlockingRuntimeEventAtInMap } from "@/project/runtimeEventState";
import { runtimeMap } from "@/project/runtimeMap";
import type { Project } from "@/project/types";

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
/** 설 칸이 없어 숨겨 둔 동료(followerPositions 의 hidden). */
const followerHidden = new Set<string>();

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

/** NPC·간판이 선 칸은 동료 자리로 주지 않는다 — 걷는 NPC 와 같은 칸에 겹쳐 서는 것을 막는다. */
function followerWorldFor(scene: PlaySceneContext, project: Project): FollowerWorld {
  const map = runtimeMap(scene.map, scene.session);
  return {
    project,
    map: scene.map,
    blocked: (x, y) => findBlockingRuntimeEventAtInMap(project, map, scene.session, scene.eventPositions, x, y) !== undefined,
    inScene: scene.running,
    playerFacing: scene.facing,
  };
}

export function syncFollowerSprites(
  scene: PlaySceneContext,
  options?: {
    readonly stepDurationMs?: number;
    /** 맵 이동·순간이동처럼 궤적을 새로 깐 직후 — 보간 없이 새 칸에 바로 세운다. */
    readonly snap?: boolean;
  },
  respaced = false
): void {
  const expected = new Set<string>();
  const project = store.getCurrent();
  const now = scene.game?.loop?.time ?? 0;
  // 걸음 지속 시간은 플레이어 걸음과 1:1 — 걸음 완료 시점에 열린 보간이 다음
  // 완료 시점에 정확히 끝나 팔로워가 한 칸 뒤를 걷는다(옵션 없으면 NPC 기본값).
  const stepDurationMs = options?.stepDurationMs ?? NPC_MOVE_DURATION_MS;
  // 탈것에 탄 동안 파티는 탈것 안에 있다 — 동료를 그리지 않는다. 내리면 궤적이 새로 깔리며 돌아온다.
  const followers = boardedVehicleId(scene.session) ? [] : followerPositions(scene.session, project.system.companions, followerWorldFor(scene, project));
  for (const position of followers) {
    const key = followerSpriteKey(position.follower);
    expected.add(key);
    const spriteRef = position.follower.graphic.sprite;
    if (!spriteRef || position.follower.graphic.transparent === true) {
      destroyFollowerSprite(scene, key);
      continue;
    }
    // 설 칸이 없으면 숨긴다(주인공 위에 겹쳐 그리지 않는다). 다시 나타날 때는 숨었던 자리에서 미끄러지지 않고 바로 선다.
    const reappearing = !position.hidden && followerHidden.has(key);
    if (position.hidden) followerHidden.add(key);
    else followerHidden.delete(key);
    if (options?.snap || position.hidden || reappearing) {
      followerSlotMotion.delete(key);
      followerWalkElapsedMs.set(key, 0);
    }
    const motion = options?.snap || position.hidden || reappearing ? null : nextFollowerMotion(key, position, now, stepDurationMs);
    const progress = motion ? Math.min(1, (now - motion.startedAt) / motion.durationMs) : 0;
    const spriteTile = motion
      ? { x: lerp(motion.from.x, motion.to.x, progress), y: lerp(motion.from.y, motion.to.y, progress) }
      : position;
    const texture = resolveEventSpriteTexture(project, spriteRef.id, position.follower.graphic.pattern);
    const direction = position.direction ?? position.follower.graphic.direction ?? "down";
    const charsetFrame = texture && (texture.charset || isFollowerCharsetTexture(texture.texture)) && typeof texture.frame === "number"
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
    sprite.setScale(eventSpriteScale(texture, sprite, position.follower.graphic.scale, mapTileSize(scene.map), position.follower.graphic.scaleMode, projectReferenceTileSize(store.getCurrent()), mapCharacterSizeFactor(scene.map)));
    sprite.setFrame(frame);
    setCharacterBaseOrigin(sprite, texture?.origin);
    placeCharacterSprite(sprite, "same");
    sprite.setVisible(!position.hidden);
  }
  for (const key of [...scene.followerSprites.keys()]) {
    if (!expected.has(key)) destroyFollowerSprite(scene, key);
  }
  // 그려진 몸 크기로 동료 간격(궤적 칸 수)을 맞춘다. 간격이 바뀌었으면(첫 등장·다른 크기의 동료 합류)
  // 새 간격으로 한 번 더 세운다 — 보간 없이 바로 세워야 한 칸 간격 자리에서 주인공을 가로지르지 않는다.
  if (followers.length > 0) {
    const span = followerBodySpanTiles(scene);
    if (span !== getFollowerBodySpan(scene.session)) {
      setFollowerBodySpan(scene.session, span);
      if (!respaced) syncFollowerSprites(scene, { ...options, snap: true }, true);
    }
  }
}

/**
 * 주인공·동료 중 가장 큰 그림이 칸 몇 개를 덮는가. 24×32 칩은 16px 칸에서 2칸 — 한 칸 간격 일렬이면
 * 앞사람 머리와 뒷사람 발(위아래로 걸을 때)이 겹쳐 그려진다.
 */
function followerBodySpanTiles(scene: PlaySceneContext): number {
  const tile = mapTileSize(scene.map);
  if (!(tile > 0)) return 1;
  const sprites = [scene.player, ...scene.followerSprites.values()].filter((sprite) => sprite && sprite.visible !== false);
  let span = 1;
  for (const sprite of sprites) {
    const size = Math.max(Math.abs(sprite.displayHeight ?? 0), Math.abs(sprite.displayWidth ?? 0));
    if (Number.isFinite(size) && size > 0) span = Math.max(span, Math.ceil(size / tile - 1e-6));
  }
  return span;
}

/**
 * 매 프레임 보간기. updatePlayScene 이 렌더 프레임마다 부른다 — 논리 틱이 0 인
 * 고주사율 프레임에서도 이어 그려야 걸음이 매끈하다. 슬롯 자체는 걸음 완료 때만
 * 바뀌고(syncFollowerSprites), 여기서는 화면 좌표와 걷기 프레임만 진행시킨다.
 */
export function updateFollowerSpriteMotion(scene: PlaySceneContext, deltaMs: number): void {
  const now = scene.game?.loop?.time ?? 0;
  const size = mapTileSize(scene.map);
  // 몸 위치(칸 단위, 발 칸): 주인공과 모든 동료. 걷는 동료는 남의 몸 안으로 들어가는 걸음을 잠시 멈춘다
  // (열차 순서대로 처리하므로 앞사람은 이번 프레임 위치, 뒷사람은 직전 프레임 위치로 본다).
  // 비켜 주는 쪽은 언제나 뒷사람이다(주인공 → 첫 동료 → …) — 서로 비켜 주다 둘 다 서 버리는 일이 없다.
  const ordered = orderedFollowerSprites(scene);
  const bodies = new Map<string, { x: number; y: number }>();
  if (scene.player && size > 0) bodies.set("hero", { x: scene.player.x / size - 0.5, y: scene.player.y / size - 1 });
  const yieldDistance = followerMinDistance(scene.session, store.getCurrent().system.companions) - 0.25;
  // 뒤에 선 채 서 있는(걷지 않는) 동료 — 기다렸다 따라잡는 앞사람이 그 몸을 뚫고 지나가지 않게 이것도 피한다.
  // 다만 한 걸음 길이까지만: 앞사람 자리가 그 너머라면 결국 지나가야 한다.
  const resting = new Map<string, { x: number; y: number }>();
  for (const [key, sprite] of ordered) {
    const motion = followerSlotMotion.get(key);
    if (size > 0 && sprite.visible && !(motion && now - motion.startedAt < motion.durationMs)) {
      resting.set(key, { x: sprite.x / size - 0.5, y: sprite.y / size - 1 });
    }
  }
  /** 몸들까지 가장 가까운 체비쇼프 거리(칸). */
  const nearest = (self: string, x: number, y: number, among: ReadonlyMap<string, { x: number; y: number }>): number => {
    let best = Infinity;
    for (const [other, body] of among) {
      if (other !== self) best = Math.min(best, Math.max(Math.abs(body.x - x), Math.abs(body.y - y)));
    }
    return best;
  };
  for (const [key, sprite] of ordered) {
    const state = followerRenderState.get(key);
    if (!state) continue;
    let motion = followerSlotMotion.get(key);
    if (motion && now - motion.startedAt < motion.durationMs && size > 0 && sprite.visible) {
      // 남의 몸 안으로 더 파고드는 걸음이면 이번 프레임은 제자리 — 시계를 미뤄서 나중에 끊김 없이 이어 걷는다.
      // 이미 붙어 있어도 멀어지는 걸음은 그대로 간다.
      const progress = (now - motion.startedAt) / motion.durationMs;
      const nextX = lerp(motion.from.x, motion.to.x, progress), nextY = lerp(motion.from.y, motion.to.y, progress);
      const hereX = sprite.x / size - 0.5, hereY = sprite.y / size - 1;
      const ahead = nearest(key, nextX, nextY, bodies);
      const rest = nearest(key, nextX, nextY, resting);
      const intoAhead = ahead < yieldDistance && ahead < nearest(key, hereX, hereY, bodies) - 1e-4;
      const intoResting = (motion.pausedMs ?? 0) < motion.durationMs && rest < yieldDistance && rest < nearest(key, hereX, hereY, resting) - 1e-4;
      if (intoAhead || intoResting) {
        const wait = Math.max(0, deltaMs);
        motion = { ...motion, startedAt: motion.startedAt + wait, pausedMs: (motion.pausedMs ?? 0) + wait };
        followerSlotMotion.set(key, motion);
      }
    }
    if (motion && now - motion.startedAt < motion.durationMs) {
      const progress = Math.max(0, (now - motion.startedAt) / motion.durationMs);
      sprite.setPosition(
        characterSpriteX(lerp(motion.from.x, motion.to.x, progress), mapTileSize(scene.map)),
        characterSpriteY(lerp(motion.from.y, motion.to.y, progress), mapTileSize(scene.map))
      );
      updateCharacterDepth(sprite, "same");
      if (state.isCharset) {
        const walkElapsed = (followerWalkElapsedMs.get(key) ?? 0) + Math.max(0, deltaMs);
        followerWalkElapsedMs.set(key, walkElapsed);
        const frameMs = store.getCurrent().assets.uploaded[state.texture]?.meta.walkFrameMs;
        sprite.setFrame(charsetWalkFrameIndex(state.baseFrame, state.direction, charsetWalkStepFromElapsedMs(walkElapsed, frameMs)));
      }
    } else if (motion) {
      // 걸음 완료 — 슬롯 중앙에 정착하고 정지 프레임으로.
      followerSlotMotion.delete(key);
      followerWalkElapsedMs.set(key, 0);
      sprite.setPosition(characterSpriteX(state.slot.x, mapTileSize(scene.map)), characterSpriteY(state.slot.y, mapTileSize(scene.map)));
      updateCharacterDepth(sprite, "same");
      if (state.isCharset) sprite.setFrame(charsetIdleFrameIndex(state.baseFrame, state.direction));
    }
    if (sprite.visible && size > 0) bodies.set(key, { x: sprite.x / size - 0.5, y: sprite.y / size - 1 });
    resting.delete(key);
  }
}

type FollowerSprite = PlaySceneContext["followerSprites"] extends Map<string, infer S> ? S : never;

/** 동료 스프라이트를 열차 순서(session.followers)대로. 순서가 곧 「누가 누구에게 비켜 주는가」다. */
function orderedFollowerSprites(scene: PlaySceneContext): [string, FollowerSprite][] {
  const ordered: [string, FollowerSprite][] = [];
  const seen = new Set<string>();
  for (const follower of scene.session.followers ?? []) {
    const key = followerSpriteKey(follower);
    const sprite = scene.followerSprites.get(key);
    if (sprite && !seen.has(key)) { ordered.push([key, sprite]); seen.add(key); }
  }
  for (const entry of scene.followerSprites) if (!seen.has(entry[0])) ordered.push(entry);
  return ordered;
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
  followerHidden.delete(key);
}

function followerSpriteKey(follower: { readonly id?: string; readonly name: string }): string {
  // Prefer stable id; fall back to name for saves from before this patch.
  if (follower.id) return `follower:${follower.id}`;
  return `follower:${follower.name}`;
}

function numericFollowerFrame(frame: string | number | undefined): number {
  return typeof frame === "number" && Number.isFinite(frame) ? frame : 0;
}
