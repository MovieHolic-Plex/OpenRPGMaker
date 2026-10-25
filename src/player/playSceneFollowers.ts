import { setCharacterBaseOrigin } from "./characterOrigin";
import { mapTileSize } from "@/project/tileGeometry";
import { mapCharacterSizeFactor } from "@/project/characterScale";
import { projectReferenceTileSize } from "@/project/mapViewScale";
import { DEFAULT_EASYRPG_CHARSET_ID } from "@/project/defaults/constants";
import { store } from "@/project/store";
import { characterSpriteX, characterSpriteY, placeCharacterSprite, updateCharacterDepth } from "@/player/characterDepth";
import { eventSpriteScale, resolveEventSpriteTexture } from "@/player/eventSpriteResources";
import { followerMinDistance, followerPositions, getFollowerBodySpan, recordFollowerPlayerStep, setFollowerBodySpan, type FollowerSlotMotion, type FollowerWorld } from "@/project/followers";
import type { PlaySceneContext } from "@/player/playSceneTypes";
import {
  NPC_MOVE_DURATION_MS,
  charsetIdleFrameIndex,
  charsetWalkFrameIndex,
  charsetWalkStepFromElapsedMs,
  isCharsetLikeTextureKey,
} from "@/player/charsetMotion";
import type { Dir } from "@/player/input";
import { boardedVehicleId } from "@/project/vehicles";
import { findBlockingRuntimeEventAtInMap } from "@/project/runtimeEventState";
import { runtimeMap } from "@/project/runtimeMap";
import type { Project } from "@/project/types";
import { isCutsceneInputLocked } from "@/player/cutsceneControl";

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
  /** 서 있을 때 제자리 걸음(몬스터 동료). */
  readonly idleStep?: boolean;
};
const followerRenderState = new Map<string, FollowerRenderState>();
/** 걷기 주기 위상 — 걷는 동안 연속 누적하고, 서 있으면 0 으로 돌려 정지 프레임을 유지한다. */
const followerWalkElapsedMs = new Map<string, number>();
/** 설 칸이 없어 숨겨 둔 동료(followerPositions 의 hidden). */
const followerHidden = new Set<string>();
/** 서 있는 몬스터 동료의 제자리 걸음 위상(ms) — HGSS 동료처럼 멈춰 있어도 숨 쉬듯 발을 구른다. */
const followerIdleElapsedMs = new Map<string, number>();
/** 제자리 걸음 한 장의 시간. 걷기(90ms/장)보다 훨씬 느리게 — 숨 쉬는 정도. */
const FOLLOWER_IDLE_FRAME_MS = 300;
/**
 * 문·계단으로 들어와 숨어 있다가 다시 나타나는 몬스터 동료(경과 ms). 주인공 몸이 그 칸을 다 비울 때까지는 그리지 않고,
 * 비우면 짧게 떠오른다. 바로 그리면 첫 걸음 동안 주인공 다리 위에 겹쳐 「툭 튀어나왔다」(2026-10-23 적대 검수).
 */
const followerEmerging = new Map<string, number>();
const FOLLOWER_EMERGE_FADE_MS = 140;

function isFollowerCharsetTexture(textureKey: string): boolean {
  return isCharsetLikeTextureKey(textureKey) || store.getCurrent().assets.uploaded[textureKey]?.kind === "charset";
}

function lerp(start: number, end: number, progress: number): number {
  return start + (end - start) * progress;
}

const VIA_EPS = 1e-3;

/** 두 축이 다 바뀌는 이동이면 한 축씩 꺾어 가는 경유 칸을 돌려준다(걸어온 쪽 축을 먼저). 사방 인접이면 없음. */
function viaCorner(
  from: { readonly x: number; readonly y: number },
  to: { readonly x: number; readonly y: number },
  facing: Dir | undefined
): { x: number; y: number } | undefined {
  if (Math.abs(to.x - from.x) < VIA_EPS || Math.abs(to.y - from.y) < VIA_EPS) return undefined;
  const horizontalFirst = facing === "left" || facing === "right";
  return horizontalFirst ? { x: to.x, y: from.y } : { x: from.x, y: to.y };
}

/** 걸음 경로(직선 또는 from→via→to) 위의 진행도 p 지점과 그 지점에서 걷는 방향. */
function pathAt(motion: FollowerSlotMotion, progress: number): { x: number; y: number; dir: Dir | undefined } {
  const p = Math.max(0, Math.min(1, progress));
  const { from, to, via } = motion;
  if (!via) {
    const dir = from.x === to.x && from.y === to.y ? undefined : stepDirection(from, to);
    return { x: lerp(from.x, to.x, p), y: lerp(from.y, to.y, p), dir };
  }
  const len1 = Math.abs(via.x - from.x) + Math.abs(via.y - from.y);
  const len2 = Math.abs(to.x - via.x) + Math.abs(to.y - via.y);
  const total = len1 + len2;
  const d = p * total;
  if (d <= len1 && len1 > 0) {
    const t = d / len1;
    return { x: lerp(from.x, via.x, t), y: lerp(from.y, via.y, t), dir: stepDirection(from, via) };
  }
  const t = len2 > 0 ? (d - len1) / len2 : 1;
  return { x: lerp(via.x, to.x, t), y: lerp(via.y, to.y, t), dir: len2 > 0 ? stepDirection(via, to) : undefined };
}

/** 슬롯이 그대로면 유지, 바뀌면 직전 슬롯(또는 걷던 자리)에서 이번 슬롯으로 새 걸음을 연다. */
function nextFollowerMotion(
  key: string,
  position: { readonly x: number; readonly y: number },
  now: number,
  durationMs: number,
  lockToHero = false
): FollowerSlotMotion | null {
  const last = followerSlotMotion.get(key);
  if (last && last.to.x === position.x && last.to.y === position.y) {
    return last.lockToHero || now - last.startedAt < last.durationMs ? last : null;
  }
  // 주인공과 함께 걷던 걸음은 주인공 걸음이 끝날 때 함께 끝났다 — 다음 걸음은 도착 칸에서 연다.
  // 직전 걸음이 이미 끝나 지워졌으면 지금 서 있는 칸(마지막 슬롯)에서 연다 — 새 슬롯에서 열면 한 칸 순간이동이다.
  const standing = followerRenderState.get(key)?.slot;
  const from = last ? (last.lockToHero ? last.to : lerpFollower(last, now) ?? last.to) : standing ?? position;
  // 제자리(주인공이 돌아서기만 함)는 걸음이 아니다 — 0칸 걸음을 열면 320ms 동안 발만 구른다.
  if (!last && from.x === position.x && from.y === position.y) return null;
  const via = viaCorner(from, position, followerRenderState.get(key)?.direction);
  const motion: FollowerSlotMotion = { from, to: position, startedAt: now, durationMs, ...(via ? { via } : {}), ...(lockToHero ? { lockToHero: true } : {}) };
  followerSlotMotion.set(key, motion);
  return motion;
}

/** 걸음 진행도(0~1). 주인공과 함께 연 걸음은 주인공 걸음 진행도, 아니면 시계. 1 이상이면 끝. */
function motionProgress(scene: Pick<PlaySceneContext, "moving" | "moveProgress">, motion: FollowerSlotMotion, now: number): number {
  if (motion.lockToHero) return scene.moving ? Math.max(0, Math.min(1, scene.moveProgress)) : 1;
  return Math.max(0, (now - motion.startedAt) / motion.durationMs);
}

/** 진행 중인 걸음의 현재 화면 좌표(타일 단위). 끝났으면 null. */
function lerpFollower(motion: FollowerSlotMotion, now: number): { x: number; y: number } | null {
  const progress = (now - motion.startedAt) / motion.durationMs;
  if (progress >= 1) return null;
  const at = pathAt(motion, progress);
  return { x: at.x, y: at.y };
}

/** NPC·간판이 선 칸은 동료 자리로 주지 않는다 — 걷는 NPC 와 같은 칸에 겹쳐 서는 것을 막는다. */
function followerWorldFor(scene: PlaySceneContext, project: Project, heroAt?: { readonly x: number; readonly y: number }): FollowerWorld {
  const map = runtimeMap(scene.map, scene.session);
  return {
    project,
    map: scene.map,
    blocked: (x, y) => findBlockingRuntimeEventAtInMap(project, map, scene.session, scene.eventPositions, x, y) !== undefined,
    inScene: scene.running,
    storyScene: followerStoryScene(scene),
    playerFacing: scene.facing,
    ...(heroAt ? { heroAt } : {}),
  };
}

/** 세션 플래그 — 도는 이벤트에서 선두가 아닌 파티원이 대사를 했다(이벤트가 끝나면 지운다). companions.display "scenesOnly" 용. */
export const COMPANION_SCENE_FLAG = "companions:sceneShown";

/** 이야기 장면인가 — 컷신 제어가 켜졌거나, 도는 이벤트에서 동료가 말했다. 이벤트가 끝났으면 동료 대사 플래그를 지운다. */
function followerStoryScene(scene: PlaySceneContext): boolean {
  if (!scene.running && scene.session.flags[COMPANION_SCENE_FLAG] === true) delete scene.session.flags[COMPANION_SCENE_FLAG];
  return isCutsceneInputLocked(scene.session) || (scene.running && scene.session.flags[COMPANION_SCENE_FLAG] === true);
}

const lastStoryScene = new WeakMap<object, boolean>();
/**
 * companions.display "scenesOnly"(FF6 식): 이야기 장면이 시작·끝나는 프레임에 동료를 다시 세운다(걸음이 없어도).
 * 매 프레임 불러도 장면 상태가 바뀔 때만 syncFollowerSprites 를 돈다.
 */
export function syncFollowerSceneVisibility(scene: PlaySceneContext): void {
  if (store.getCurrent().system.companions?.display !== "scenesOnly") return;
  if ((scene.session.followers?.length ?? 0) === 0) return;
  const now = followerStoryScene(scene);
  if (lastStoryScene.get(scene) === now) return;
  lastStoryScene.set(scene, now);
  syncFollowerSprites(scene, { snap: true });
}

/** 몬스터만 따라오는 열차인가 — HGSS 처럼 한 칸 뒤에 붙는다(몸 길이로 띄우지 않는다). */
function monsterOnlyTrain(scene: PlaySceneContext): boolean {
  const followers = scene.session.followers ?? [];
  return followers.length > 0 && followers.every((entry) => entry.kind === "monster" || Boolean(entry.monsterInstanceId));
}

/**
 * 주인공이 한 칸 걸음을 **시작하는** 순간 — 떠나는 칸을 궤적에 넣고 동료도 같은 시간으로 한 칸 내딛는다.
 * 예전에는 걸음이 끝난 뒤에 궤적을 늘리고 동료는 NPC 걸음(320ms)으로 걸어서, 주인공(160ms)이 멈춘 뒤에야
 * 뒤늦게 따라붙고 모퉁이에서는 두 칸씩 순간이동했다(2026-10-23 「따라오는 게 매우 어색함」, 프레임 기록).
 * HGSS 동료: 주인공이 떠난 칸으로 같은 박자에 들어선다 — 늘 정확히 한 칸 뒤, 따라잡기 질주 없음.
 */
export function beginFollowerStep(
  scene: PlaySceneContext,
  from: { readonly x: number; readonly y: number },
  to: { readonly x: number; readonly y: number },
  durationMs: number,
): void {
  if ((scene.session.followers?.length ?? 0) === 0 || boardedVehicleId(scene.session)) return;
  recordFollowerPlayerStep(scene.session, { x: from.x, y: from.y, direction: scene.facing });
  syncFollowerSprites(scene, { stepDurationMs: durationMs, heroAt: to });
}

export function syncFollowerSprites(
  scene: PlaySceneContext,
  options?: {
    readonly stepDurationMs?: number;
    /** 맵 이동·순간이동처럼 궤적을 새로 깐 직후 — 보간 없이 새 칸에 바로 세운다. */
    readonly snap?: boolean;
    /** 주인공이 지금 걸어 들어가는 칸(beginFollowerStep). */
    readonly heroAt?: { readonly x: number; readonly y: number };
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
  const followers = boardedVehicleId(scene.session) ? [] : followerPositions(scene.session, project.system.companions, followerWorldFor(scene, project, options?.heroAt));
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
    if (reappearing && isMonsterFollower(position.follower)) followerEmerging.set(key, 0);
    if (options?.snap || position.hidden || reappearing) {
      followerSlotMotion.delete(key);
      followerWalkElapsedMs.set(key, 0);
    }
    const motion = options?.snap || position.hidden || reappearing ? null : nextFollowerMotion(key, position, now, stepDurationMs, options?.heroAt !== undefined);
    const progress = motion ? motionProgress(scene, motion, now) : 0;
    const pathNow = motion ? pathAt(motion, progress) : undefined;
    const spriteTile = pathNow ? { x: pathNow.x, y: pathNow.y } : position;
    const texture = resolveEventSpriteTexture(project, spriteRef.id, position.follower.graphic.pattern);
    // 걷는 동안은 걸어가는 쪽을 본다(궤적 점의 방향은 주인공이 그 칸을 **떠난** 방향이라 모퉁이에서 한 칸 일찍 돈다).
    // 서 있으면 마지막으로 걸어온 쪽을 그대로 본다 — 장면 중(sceneFacing)만 궤적 계산의 방향을 따른다.
    const walkDir = pathNow?.dir;
    const kept = followerRenderState.get(key)?.direction;
    // 다시 나타나는 동료는 주인공과 같은 쪽을 본다(주인공을 따라 문을 나서는 중이다).
    const direction = scene.running
      ? position.direction ?? position.follower.graphic.direction ?? "down"
      : reappearing ? scene.facing
      : walkDir ?? kept ?? position.direction ?? position.follower.graphic.direction ?? "down";
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
      idleStep: position.follower.kind === "monster" || Boolean(position.follower.monsterInstanceId),
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
      keepHeroInFront(scene, sprite, isMonsterFollower(position.follower));
      scene.followerSprites.set(key, sprite);
    } else {
      sprite.setTexture(texture?.texture ?? DEFAULT_EASYRPG_CHARSET_ID, frame);
      sprite.setPosition(characterSpriteX(spriteTile.x, mapTileSize(scene.map)), characterSpriteY(spriteTile.y, mapTileSize(scene.map)));
      updateCharacterDepth(sprite, "same");
      keepHeroInFront(scene, sprite, isMonsterFollower(position.follower));
    }
    // 동료도 배율을 따른다 — 큰 동료가 이벤트로 서 있을 때와 따라올 때 크기가 달라지면
    // 같은 캐릭터로 보이지 않는다. 자동 배율은 현재 맵에서 다시 계산한다.
    sprite.setScale(eventSpriteScale(texture, sprite, position.follower.graphic.scale, mapTileSize(scene.map), position.follower.graphic.scaleMode, projectReferenceTileSize(store.getCurrent()), mapCharacterSizeFactor(scene.map)));
    sprite.setFrame(frame);
    setCharacterBaseOrigin(sprite, texture?.origin);
    placeCharacterSprite(sprite, "same");
    keepHeroInFront(scene, sprite, isMonsterFollower(position.follower));
    sprite.setVisible(!position.hidden && !followerEmerging.has(key));
  }
  for (const key of [...scene.followerSprites.keys()]) {
    if (!expected.has(key)) destroyFollowerSprite(scene, key);
  }
  // 그려진 몸 크기로 동료 간격(궤적 칸 수)을 맞춘다. 간격이 바뀌었으면(첫 등장·다른 크기의 동료 합류)
  // 새 간격으로 한 번 더 세운다 — 보간 없이 바로 세워야 한 칸 간격 자리에서 주인공을 가로지르지 않는다.
  if (followers.length > 0) {
    const span = monsterOnlyTrain(scene) ? 1 : followerBodySpanTiles(scene);
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
    if (size > 0 && sprite.visible && !(motion && motionProgress(scene, motion, now) < 1)) {
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
    const initialState = followerRenderState.get(key);
    if (!initialState) continue;
    let state: FollowerRenderState = initialState;
    const emerging = followerEmerging.get(key);
    if (emerging !== undefined) {
      const hero = bodies.get("hero");
      if (followerHidden.has(key)) {
        followerEmerging.delete(key);
      } else if (emerging === 0 && hero && size > 0
        && Math.abs(hero.x - (sprite.x / size - 0.5)) < 0.97 && Math.abs(hero.y - (sprite.y / size - 1)) < 0.97) {
        // 주인공 몸이 아직 이 칸 위에 있다 — 기다린다.
        sprite.setVisible(false);
      } else {
        const elapsed = emerging + Math.max(1, deltaMs);
        sprite.setVisible(true);
        (sprite as { setAlpha?: (alpha: number) => unknown }).setAlpha?.(Math.min(1, elapsed / FOLLOWER_EMERGE_FADE_MS));
        if (elapsed >= FOLLOWER_EMERGE_FADE_MS) followerEmerging.delete(key);
        else followerEmerging.set(key, elapsed);
      }
    }
    let motion = followerSlotMotion.get(key);
    // 한 칸 간격(몸 길이 1)이면 비켜 서지 않는다 — 주인공과 같은 박자로 걷는 동료는 모퉁이에서 반 칸 대각으로 스칠 뿐
    // 겹치지 않는다. 여기서 멈추면 모퉁이마다 뒤처졌다가 따라붙는다(2026-10-23).
    if (yieldDistance > 0.75 && !motion?.lockToHero && motion && now - motion.startedAt < motion.durationMs && size > 0 && sprite.visible) {
      // 남의 몸 안으로 더 파고드는 걸음이면 이번 프레임은 제자리 — 시계를 미뤄서 나중에 끊김 없이 이어 걷는다.
      // 이미 붙어 있어도 멀어지는 걸음은 그대로 간다.
      const progress = (now - motion.startedAt) / motion.durationMs;
      const nextAt = pathAt(motion, progress);
      const nextX = nextAt.x, nextY = nextAt.y;
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
    const progressNow = motion ? motionProgress(scene, motion, now) : 1;
    if (motion && progressNow < 1) {
      const progress = progressNow;
      const at = pathAt(motion, progress);
      sprite.setPosition(
        characterSpriteX(at.x, mapTileSize(scene.map)),
        characterSpriteY(at.y, mapTileSize(scene.map))
      );
      updateCharacterDepth(sprite, "same");
      keepHeroInFront(scene, sprite, state.idleStep === true);
      // 모퉁이(via)를 지나면 두 번째 구간 방향으로 몸을 돌린다 — 대각으로 미끄러지며 엉뚱한 쪽을 보지 않게.
      if (at.dir && at.dir !== state.direction) {
        state = { ...state, direction: at.dir };
        followerRenderState.set(key, state);
      }
      if (state.isCharset) {
        const walkElapsed = (followerWalkElapsedMs.get(key) ?? 0) + Math.max(0, deltaMs);
        followerWalkElapsedMs.set(key, walkElapsed);
        const frameMs = store.getCurrent().assets.uploaded[state.texture]?.meta.walkFrameMs;
        sprite.setFrame(charsetWalkFrameIndex(state.baseFrame, state.direction, charsetWalkStepFromElapsedMs(walkElapsed, frameMs)));
      }
    } else if (motion) {
      // 걸음 완료 — 슬롯 중앙에 정착하고 정지 프레임으로. 걷기 위상은 남겨 둔다: 주인공이 곧바로 다음 걸음을 내디디면
      // 동료도 같은 발로 이어 걷는다(칸마다 같은 발로 다시 시작하면 종종걸음처럼 보인다).
      followerSlotMotion.delete(key);
      followerIdleElapsedMs.set(key, 0);
      sprite.setPosition(characterSpriteX(state.slot.x, mapTileSize(scene.map)), characterSpriteY(state.slot.y, mapTileSize(scene.map)));
      updateCharacterDepth(sprite, "same");
      keepHeroInFront(scene, sprite, state.idleStep === true);
      if (state.isCharset) sprite.setFrame(charsetIdleFrameIndex(state.baseFrame, state.direction));
    } else if (state.isCharset && state.idleStep && sprite.visible && !scene.moving) {
      // 서 있는 몬스터 동료: 느린 제자리 걸음(HGSS). 주인공이 멈춘 뒤 한 박자 쉬고 시작한다.
      const idle = (followerIdleElapsedMs.get(key) ?? 0) + Math.max(0, deltaMs);
      followerIdleElapsedMs.set(key, idle);
      followerWalkElapsedMs.set(key, 0);
      const phase = Math.floor(idle / FOLLOWER_IDLE_FRAME_MS);
      sprite.setFrame(phase < 2 ? charsetIdleFrameIndex(state.baseFrame, state.direction)
        : charsetWalkFrameIndex(state.baseFrame, state.direction, phase % 4));
    }
    // 주인공 깊이는 매 프레임 바뀐다(걸으며 y 가 바뀜) — 서 있는 동료도 매 프레임 주인공 뒤로 맞춘다.
    if (state.idleStep) {
      updateCharacterDepth(sprite, "same");
      keepHeroInFront(scene, sprite, true);
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
  followerIdleElapsedMs.delete(key);
  followerHidden.delete(key);
  followerEmerging.delete(key);
}

function followerSpriteKey(follower: { readonly id?: string; readonly name: string }): string {
  // Prefer stable id; fall back to name for saves from before this patch.
  if (follower.id) return `follower:${follower.id}`;
  return `follower:${follower.name}`;
}

function isMonsterFollower(follower: { readonly kind?: string; readonly monsterInstanceId?: string }): boolean {
  return follower.kind === "monster" || Boolean(follower.monsterInstanceId);
}

/**
 * 몬스터 동료는 주인공을 가리지 않는다. 한 칸 뒤(아래)에 선 24×32 동료는 y 정렬대로면 주인공 다리를 덮어
 * 둘이 한 덩이로 보였다(2026-10-23 실측) — 주인공을 언제나 앞에 그린다. 동료가 위쪽(뒤)일 때는 원래 그렇다.
 */
function keepHeroInFront(scene: PlaySceneContext, sprite: { readonly depth: number; setDepth(depth: number): unknown }, monster: boolean): void {
  const heroDepth = scene.player?.depth;
  if (!monster || typeof heroDepth !== "number" || !Number.isFinite(heroDepth)) return;
  if (sprite.depth >= heroDepth) sprite.setDepth(heroDepth - 0.5);
}

function stepDirection(from: { readonly x: number; readonly y: number }, to: { readonly x: number; readonly y: number }): Dir {
  const dx = to.x - from.x, dy = to.y - from.y;
  if (Math.abs(dx) >= Math.abs(dy)) return dx < 0 ? "left" : "right";
  return dy < 0 ? "up" : "down";
}

function numericFollowerFrame(frame: string | number | undefined): number {
  return typeof frame === "number" && Number.isFinite(frame) ? frame : 0;
}

/**
 * 보이는 동료가 이 칸에 서 있거나 이 칸을 드나드는 중인가. 동료는 통행을 막지 않지만(주인공 뒤를 걷는 장식),
 * 산책하는 주민이 동료 몸으로 걸어 들어가 겹쳐 서면 어색하다 — 산책 걸음만 이 칸을 피한다(2026-10-23 적대 검수).
 */
export function followerOccupiesTile(sprites: ReadonlyMap<string, { readonly visible: boolean }> | undefined, x: number, y: number): boolean {
  if (!sprites) return false;
  for (const [key, sprite] of sprites) {
    if (!sprite.visible || followerHidden.has(key)) continue;
    const slot = followerRenderState.get(key)?.slot;
    if (slot && slot.x === x && slot.y === y) return true;
    const motion = followerSlotMotion.get(key);
    if (motion && ((motion.to.x === x && motion.to.y === y) || (Math.round(motion.from.x) === x && Math.round(motion.from.y) === y))) return true;
  }
  return false;
}
