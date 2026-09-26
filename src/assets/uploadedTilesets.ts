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

/**
 * 타일 이식이 업로드 그림판에서 칸을 가져올 수 있다(생성 건물 시트 등). 그 그림판의 자산 id 가 곧 텍스처 키다.
 * 자산 id 는 내용 해시로 짓는다 — 같은 id 의 그림이 바뀌면 이식 베이크 캐시가 낡는다.
 */
export function uploadedGraftSourceIds(project?: Project): string[] {
  const ids = new Set<string>();
  for (const tileset of Object.values(project?.tilesets ?? {})) {
    for (const graft of tileset.tileGrafts ?? []) {
      if (project?.assets.uploaded[graft.sourceChipset]) ids.add(graft.sourceChipset);
    }
  }
  return [...ids];
}

export function loadUploadedTilesets(
  scene: { readonly load: Pick<Phaser.Loader.LoaderPlugin, "image"> },
  project?: Project,
  options: { readonly onlyMapTilesets?: boolean } = {},
): void {
  const queued = new Set<string>();
  const used = options.onlyMapTilesets && project ? mapTilesetIds(project) : null;
  for (const tileset of Object.values(project?.tilesets ?? {})) {
    if (tileset.image.type !== "uploaded") continue;
    if (used && !used.has(tileset.id)) continue;
    const asset = project?.assets.uploaded[tileset.image.id];
    const imageUrl = asset ? uploadedAssetUrl(asset) : "";
    if (!imageUrl) continue;
    const key = uploadedTilesetTextureKey(tileset);
    if (queued.has(key)) continue;
    queued.add(key);
    scene.load.image(key, withInlineAsset(imageUrl));
  }
  for (const id of uploadedGraftSourceIds(project)) {
    const imageUrl = uploadedAssetUrl(project!.assets.uploaded[id]!);
    if (imageUrl && !queued.has(id)) { queued.add(id); scene.load.image(id, withInlineAsset(imageUrl)); }
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

/**
 * 맵이 쓰는 타일셋. 편집기는 이것만 올리고 나머지는 그 타일셋을 쓰는 맵이 생길 때 올린다.
 * 실측(2026-09-26): 공용 지역 타일셋 21벌이 설치된 팀 호스트 프로젝트에서 쓰지 않는 텍스처 업로드가
 * 부팅 직후 메인 스레드를 잡아 데이터베이스 첫 클릭이 2~3s 늦었다.
 */
export function mapTilesetIds(project: Project): Set<string> {
  return new Set(Object.values(project.maps).map(map => map.tilesetId));
}

/** Import and geometry changes happen after preload. Queue once per atlas, not once per cell. */
export function ensureUploadedTilesetTextures(scene: Phaser.Scene, project: Project, onReady: () => void, options: { readonly onlyMapTilesets?: boolean } = {}): void {
  const pending = pendingSceneTilesets.get(scene) ?? new Set<string>();
  pendingSceneTilesets.set(scene, pending);
  const used = options.onlyMapTilesets ? mapTilesetIds(project) : null;
  for (const tileset of Object.values(project.tilesets)) {
    if (tileset.image.type !== "uploaded") continue;
    if (used && !used.has(tileset.id)) continue;
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
  // 이식 소스 그림판: 실리기 전에는 ensureTilesetTexture 가 베이크를 미루므로(낡은 캐시 방지) 실린 뒤 다시 그리면 된다.
  for (const id of uploadedGraftSourceIds(project)) {
    if (scene.textures.exists(id) || pending.has(id)) continue;
    const url = uploadedAssetUrl(project.assets.uploaded[id]!);
    if (!url) continue;
    pending.add(id);
    void ensureSceneImageTexture(scene, id, withInlineAsset(url)).then(loaded => {
      pending.delete(id);
      if (loaded && scene.sys.isActive()) onReady();
    });
  }
}
