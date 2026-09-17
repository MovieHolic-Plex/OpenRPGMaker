import type Phaser from "phaser";

interface TileAnimationGroup {
  readonly driver: Phaser.GameObjects.Sprite;
  readonly images: Set<Phaser.GameObjects.Image>;
}

const sceneGroups = new WeakMap<Phaser.Scene, Map<string, TileAnimationGroup>>();

/** One animation clock per strip, rather than one AnimationState per tile quarter.
 * Phaser's AnimationState subscribes to a global event; destroying N sprites
 * individually removes N listeners from that same array, taking quadratic time.
 * Images retain their own tint, alpha, culling and container ownership.
 */
export function createSharedAnimatedTile(
  scene: Phaser.Scene,
  x: number,
  y: number,
  texture: string,
  frame: string,
  animation: string,
): Phaser.GameObjects.Image {
  const groups = sceneGroups.get(scene) ?? new Map<string, TileAnimationGroup>();
  sceneGroups.set(scene, groups);
  // Animation keys include the texture identity (including uploaded/grafted atlases).
  let group = groups.get(animation);
  if (!group) {
    const driver = scene.add.sprite(0, 0, texture, frame).setVisible(false);
    const images = new Set<Phaser.GameObjects.Image>();
    group = { driver, images };
    groups.set(animation, group);
    driver.on("animationupdate", () => {
      for (const image of images) image.setTexture(driver.texture.key, driver.frame.name);
    });
    driver.play(animation);
  }
  const { driver, images } = group;
  const image = scene.add.image(x, y, driver.texture.key, driver.frame.name);
  images.add(image);
  image.once("destroy", () => {
    images.delete(image);
    if (images.size === 0) {
      groups.delete(animation);
      driver.destroy();
    }
  });
  return image;
}
