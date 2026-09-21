import { ensureSceneImageTexture } from "@/player/playSceneImageTexture";
import type Phaser from "phaser";
import { withInlineAsset } from "./inlineAssetStore";
import { uploadedAssetUrl } from "@/project/persistence/assetAccessors";
import type { Project, TilesetDef, TilesetAnimationStrip } from "@/project/types";

/** Uploaded atlases cannot share the bundled exterior texture or its 480 fixed frames. */
export function uploadedTilesetTextureKey(tileset: TilesetDef): string {
  return `uploaded_tileset:${encodeURIComponent(tileset.image.id)}:${tileset.tileSize}:${tileset.tilesPerRow}:${tileset.count}`;
}

function animationName(strip: TilesetAnimationStrip): string {
  return `uploaded_tiles_${strip.baseTile}_${strip.frames}_${strip.fps}`;
}

export function uploadedTilesetAnimationName(tileset: TilesetDef, tile: number): string | null {
  if (tileset.image.type !== "uploaded") return null;
  const strip = tileset.animationStrips?.find(s => tile >= s.baseTile && tile < s.baseTile + s.frames);
  return strip ? animationName(strip) : null;
}

export function loadUploadedTilesets(
  scene: { readonly load: Pick<Phaser.Loader.LoaderPlugin, "image"> },
  project?: Project,
): void {
  const queued = new Set<string>();
  for (const tileset of Object.values(project?.tilesets ?? {})) {
    if (tileset.image.type !== "uploaded") continue;
    const asset = project?.assets.uploaded[tileset.image.id];
    const imageUrl = asset ? uploadedAssetUrl(asset) : "";
    if (!imageUrl) continue;
    const key = uploadedTilesetTextureKey(tileset);
    if (queued.has(key)) continue;
    queued.add(key);
    scene.load.image(key, withInlineAsset(imageUrl));
  }
}

export function registerUploadedTilesetFrames(
  scene: Phaser.Scene,
  tileset: TilesetDef,
  key = uploadedTilesetTextureKey(tileset),
): void {
  if (!scene.textures.exists(key)) return;
  const texture = scene.textures.get(key);
  const existing = new Set(texture.getFrameNames());
  for (let tile = 0; tile < tileset.count; tile++) {
    const name = `tile_${tile}`;
    if (!existing.has(name)) texture.add(name, 0,
      tile % tileset.tilesPerRow * tileset.tileSize,
      Math.floor(tile / tileset.tilesPerRow) * tileset.tileSize,
      tileset.tileSize, tileset.tileSize);
  }
  for (const strip of tileset.animationStrips ?? []) {
    const name = `${key}:${animationName(strip)}`;
    if (scene.anims.exists(name)) continue;
    scene.anims.create({ key: name, frameRate: strip.fps, repeat: -1,
      frames: Array.from({ length: strip.frames }, (_, frame) => ({ key, frame: `tile_${strip.baseTile + frame}` })),
    });
  }
}

export function registerUploadedTilesets(scene: Phaser.Scene, project?: Project): void {
  for (const tileset of Object.values(project?.tilesets ?? {})) {
    if (tileset.image.type === "uploaded") registerUploadedTilesetFrames(scene, tileset);
  }
}

const pendingSceneTilesets = new WeakMap<Phaser.Scene, Set<string>>();

/** Import and geometry changes happen after preload. Queue once per atlas, not once per cell. */
export function ensureUploadedTilesetTextures(scene: Phaser.Scene, project: Project, onReady: () => void): void {
  const pending = pendingSceneTilesets.get(scene) ?? new Set<string>();
  pendingSceneTilesets.set(scene, pending);
  for (const tileset of Object.values(project.tilesets)) {
    if (tileset.image.type !== "uploaded") continue;
    const key = uploadedTilesetTextureKey(tileset);
    if (scene.textures.exists(key) || pending.has(key)) continue;
    const asset = project.assets.uploaded[tileset.image.id];
    const url = asset ? uploadedAssetUrl(asset) : "";
    if (!url) continue;
    pending.add(key);
    void ensureSceneImageTexture(scene, key, withInlineAsset(url)).then(loaded => {
      pending.delete(key);
      if (!loaded || !scene.sys.isActive()) return;
      registerUploadedTilesetFrames(scene, tileset, loaded);
      onReady();
    });
  }
}
