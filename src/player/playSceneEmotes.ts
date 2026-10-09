import { spriteReliefLiftPx } from "@/player/playSceneRelief";
import Phaser from "phaser";
import { runtimeMapWorldScale } from "@/player/runtimeViewScale";
import { TILE_SIZE } from "@/assets/bundled";
import {
  clampEmoteDurationMs,
  emoteFrameIndex,
  EMOTE_TEXTURE_KEY,
  type EmoteKind,
} from "@/project/emotes";
import type { PlaySceneContext } from "@/player/playSceneTypes";

// 이모트는 캐릭터(same=200k+)와 above 이벤트(300k+) 위에 떠야 한다. 맵 애니메이션과 같은 층에
// 두면 above 가구에 가려 정수리가 잘린다 — characterDepth.ts 의 depth 표 참고.
const EMOTE_DEPTH = 400_000;
const EMOTE_RISE_PX = 6;
const EMOTE_HEAD_GAP_PX = 4;
const EMOTE_POP_MS = 140;
const EMOTE_FADE_MS = 200;

type ActiveEmote = {
  readonly sprite: Phaser.GameObjects.Sprite;
  /** 매 프레임 위치를 다시 계산하므로 상승분은 별도 값으로 트윈한다(트윈과 동기화가 y 를 다투지 않게). */
  readonly lift: { value: number };
  readonly timer: Phaser.Time.TimerEvent;
};

const sceneEmotes = new WeakMap<object, Map<string, ActiveEmote>>();

function activeEmotes(scene: PlaySceneContext): Map<string, ActiveEmote> {
  const existing = sceneEmotes.get(scene);
  if (existing) return existing;
  const created = new Map<string, ActiveEmote>();
  sceneEmotes.set(scene, created);
  return created;
}

function hostSprite(
  scene: PlaySceneContext,
  target: "player" | string
): Phaser.GameObjects.Sprite | undefined {
  if (target === "player") return scene.player;
  return scene.eventSprites.get(target);
}

/**
 * 머리 위 기준점. 스프라이트 원점은 발밑(characterSpriteY)이므로 키만큼 올려야 정수리다.
 * 타일 크기로 고정하면 24px 캐릭셋(EasyRPG charset)의 머리를 4px 파고든다(실측) — 실제 표시 높이를 쓴다.
 */
function anchorY(scene: PlaySceneContext, sprite: Phaser.GameObjects.Sprite): number {
  const height = sprite.displayHeight > 0 ? sprite.displayHeight : TILE_SIZE;
  return sprite.y - height * sprite.originY - EMOTE_HEAD_GAP_PX - spriteReliefLiftPx(scene.map, sprite);
}

export function showSceneEmote(
  scene: PlaySceneContext,
  target: "player" | string,
  emote: EmoteKind,
  durationMs?: number
): void {
  const host = hostSprite(scene, target);
  if (!host || !scene.textures.exists(EMOTE_TEXTURE_KEY)) return;

  clearSceneEmote(scene, target);

  const sprite = scene.add.sprite(host.x, anchorY(scene, host), EMOTE_TEXTURE_KEY, emoteFrameIndex(emote));
  sprite.setDepth(EMOTE_DEPTH);
  sprite.setScrollFactor(1);
  // 타일 크기가 기준과 다른 맵에서도 말풍선이 캐릭터와 같은 비율로 보이게 세계 배율을 곱한다.
  const worldScale = runtimeMapWorldScale(scene);
  sprite.setScale(0.4 * worldScale);
  sprite.setAlpha(0);

  const lifetime = clampEmoteDurationMs(durationMs);
  const lift = { value: 0 };
  scene.tweens.add({ targets: sprite, scale: worldScale, alpha: 1, duration: EMOTE_POP_MS, ease: "Back.easeOut" });
  scene.tweens.add({ targets: lift, value: -EMOTE_RISE_PX * worldScale, duration: lifetime, ease: "Sine.easeOut" });
  scene.tweens.add({
    targets: sprite,
    alpha: 0,
    delay: Math.max(EMOTE_POP_MS, lifetime - EMOTE_FADE_MS),
    duration: EMOTE_FADE_MS,
  });

  const timer = scene.time.delayedCall(lifetime, () => {
    clearSceneEmote(scene, target);
  });

  activeEmotes(scene).set(target, { sprite, lift, timer });
}

export function clearSceneEmote(scene: PlaySceneContext, target: "player" | string): void {
  const map = activeEmotes(scene);
  const existing = map.get(target);
  if (!existing) return;
  existing.timer.remove(false);
  scene.tweens.killTweensOf(existing.sprite);
  scene.tweens.killTweensOf(existing.lift);
  existing.sprite.destroy();
  map.delete(target);
}

export function clearAllSceneEmotes(scene: PlaySceneContext): void {
  for (const key of [...activeEmotes(scene).keys()]) clearSceneEmote(scene, key);
}

/**
 * NPC 는 걷는다 — 매 프레임 주인의 정수리로 다시 옮기지 않으면 이모트가 허공에 남는다.
 * 주인이 사라졌으면(맵 이동·이벤트 소멸) 이모트도 함께 정리한다.
 */
export function syncSceneEmotes(scene: PlaySceneContext): void {
  const map = activeEmotes(scene);
  for (const [target, entry] of [...map.entries()]) {
    const host = hostSprite(scene, target);
    if (!host || !host.active) {
      clearSceneEmote(scene, target);
      continue;
    }
    entry.sprite.x = host.x;
    entry.sprite.y = anchorY(scene, host) + entry.lift.value;
  }
}

export type SceneEmoteDebug = {
  readonly target: string;
  readonly frame: string;
  readonly x: number;
  readonly y: number;
  readonly alpha: number;
};

/** QA 하네스용 관측치 — Phaser 스프라이트는 DOM testid 로 볼 수 없으므로 훅으로 노출한다. */
export function describeSceneEmotes(scene: PlaySceneContext): readonly SceneEmoteDebug[] {
  return [...activeEmotes(scene).entries()].map(([target, entry]) => ({
    target,
    frame: String(entry.sprite.frame.name),
    x: Math.round(entry.sprite.x),
    y: Math.round(entry.sprite.y),
    alpha: Number(entry.sprite.alpha.toFixed(2)),
  }));
}
