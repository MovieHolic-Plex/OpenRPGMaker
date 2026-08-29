import { DEFAULT_EASYRPG_CHARSET_ID } from "@/project/defaults/constants";
import { store } from "@/project/store";
import { characterSpriteX, characterSpriteY, placeCharacterSprite, updateCharacterDepth } from "@/player/characterDepth";
import { eventSpriteFrameForDirection, resolveEventSpriteTexture } from "@/player/eventSpriteResources";
import { followerPositions } from "@/project/followers";
import { normalizeCharacterScale } from "@/project/footprint";
import type { PlaySceneContext } from "@/player/playSceneTypes";

export function syncFollowerSprites(scene: PlaySceneContext): void {
  const expected = new Set<string>();
  const project = store.getCurrent();
  for (const position of followerPositions(scene.session, project.system.companions, { project, map: scene.map })) {
    const key = followerSpriteKey(position.follower);
    expected.add(key);
    const spriteRef = position.follower.graphic.sprite;
    if (!spriteRef || position.follower.graphic.transparent === true) {
      destroyFollowerSprite(scene, key);
      continue;
    }
    const texture = resolveEventSpriteTexture(project, spriteRef.id, position.follower.graphic.pattern);
    const frame = eventSpriteFrameForDirection(texture, position.direction ?? position.follower.graphic.direction) ?? texture?.frame ?? 0;
    let sprite = scene.followerSprites.get(key);
    if (!sprite) {
      sprite = scene.add.sprite(
        characterSpriteX(position.x),
        characterSpriteY(position.y),
        texture?.texture ?? DEFAULT_EASYRPG_CHARSET_ID,
        frame
      );
      placeCharacterSprite(sprite, "same");
      scene.followerSprites.set(key, sprite);
    } else {
      sprite.setTexture(texture?.texture ?? DEFAULT_EASYRPG_CHARSET_ID, frame);
      sprite.setPosition(characterSpriteX(position.x), characterSpriteY(position.y));
      updateCharacterDepth(sprite, "same");
    }
    // 동료도 배율을 따른다 — 큰 동료가 이벤트로 서 있을 때와 따라올 때 크기가 달라지면
    // 같은 캐릭터로 보이지 않는다. 배율 없는 동료는 1(항등).
    sprite.setScale(normalizeCharacterScale(position.follower.graphic.scale));
    sprite.setFrame(frame);
  }
  for (const key of [...scene.followerSprites.keys()]) {
    if (!expected.has(key)) destroyFollowerSprite(scene, key);
  }
}

export function clearFollowerSprites(scene: Pick<PlaySceneContext, "followerSprites">): void {
  for (const sprite of scene.followerSprites.values()) sprite.destroy();
  scene.followerSprites.clear();
}

function destroyFollowerSprite(scene: Pick<PlaySceneContext, "followerSprites">, key: string): void {
  scene.followerSprites.get(key)?.destroy();
  scene.followerSprites.delete(key);
}

function followerSpriteKey(follower: { readonly id?: string; readonly name: string }): string {
  // Prefer stable id; fall back to name for saves from before this patch.
  if (follower.id) return `follower:${follower.id}`;
  return `follower:${follower.name}`;
}
