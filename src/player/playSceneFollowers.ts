import { DEFAULT_EASYRPG_CHARSET_ID } from "@/project/defaults/constants";
import { store } from "@/project/store";
import { characterSpriteX, characterSpriteY, placeCharacterSprite, updateCharacterDepth } from "@/player/characterDepth";
import { eventSpriteFrameForDirection, resolveEventSpriteTexture } from "@/player/eventSpriteResources";
import { followerPositions } from "@/player/followers";
import type { PlaySceneContext } from "@/player/playSceneTypes";

export function syncFollowerSprites(scene: PlaySceneContext): void {
  const expected = new Set<string>();
  const project = store.getCurrent();
  for (const position of followerPositions(scene.session)) {
    const key = followerSpriteKey(position.follower.name);
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

function followerSpriteKey(name: string): string {
  return `follower:${name}`;
}
