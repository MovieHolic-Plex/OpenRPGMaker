import type Phaser from "phaser";
import {
  CHARSET_FRAME_COUNT,
  CHARSET_FRAME_HEIGHT,
  CHARSET_FRAME_WIDTH,
  CHARSET_SHEET_COLUMNS,
  EASYRPG_CHARSET_ASSETS,
} from "@/assets/easyrpgRtp";
import { applyTransparentColorKey } from "@/assets/transparentColorKey";
import { CHIPSET_ANIMATION_FPS, CHIPSET_ANIMATION_STRIPS } from "@/project/defaults/chipsetAnimation";

export const TEX_TILESET = "tex_tiles_default";
export const TEX_NPC = "tex_npc_villager";
export const TEX_DIALOGUE_FRAME = "tex_dialogue_frame";

export type BundledImageAsset = {
  readonly textureKey: string;
  readonly path: string;
  readonly name: string;
};

export const TILE_SIZE = 16;
export const TILES_PER_ROW = 30;
export const TILE_FRAME_COUNT = 480;
const TILE_QUARTER_SIZE = TILE_SIZE / 2;
const TILE_QUARTERS = [
  { name: "nw", dx: 0, dy: 0 },
  { name: "ne", dx: TILE_QUARTER_SIZE, dy: 0 },
  { name: "sw", dx: 0, dy: TILE_QUARTER_SIZE },
  { name: "se", dx: TILE_QUARTER_SIZE, dy: TILE_QUARTER_SIZE },
] as const;

export const SPRITE_FRAMES = 8;
export const SPRITE_COLS = 2;
export const SPRITE_ROWS = 4;
export const SPRITE_FRAME_WIDTH = 32;
export const SPRITE_FRAME_HEIGHT = 32;
export { CHARSET_FRAME_HEIGHT, CHARSET_FRAME_WIDTH } from "@/assets/easyrpgRtp";

export const ASSET_TILESET = "assets/rm2k3-original-chipset.png";
const ASSET_NPC = "assets/npc_villager.png";
const ASSET_DIALOGUE_FRAME = "assets/dialogue-frame.png";

const CORE_BUNDLED_IMAGE_ASSETS = [
  { textureKey: TEX_TILESET, path: ASSET_TILESET, name: "RM2K3 Original ChipSet" },
  { textureKey: TEX_NPC, path: ASSET_NPC, name: "Default NPC CharSet" },
  { textureKey: TEX_DIALOGUE_FRAME, path: ASSET_DIALOGUE_FRAME, name: "Default Dialogue Frame" },
] as const satisfies readonly BundledImageAsset[];

export const BUNDLED_EASYRPG_CHIPSET_ASSETS = [
  { textureKey: "tex_easyrpg_chipset_dungeon", path: "assets/easyrpg-chipset-dungeon-transparent.png", name: "EasyRPG RTP Dungeon ChipSet" },
  { textureKey: "tex_easyrpg_chipset_interior", path: "assets/easyrpg-chipset-interior-transparent.png", name: "EasyRPG RTP Interior ChipSet" },
  { textureKey: "tex_easyrpg_chipset_ship", path: "assets/easyrpg-chipset-ship-transparent.png", name: "EasyRPG RTP Ship ChipSet" },
  { textureKey: "tex_easyrpg_chipset_world", path: "assets/easyrpg-chipset-world-transparent.png", name: "EasyRPG RTP World ChipSet" },
  { textureKey: "tex_easyrpg_chipset_retro_dungeon", path: "assets/easyrpg-chipset-retro-dungeon-transparent.png", name: "EasyRPG RTP retro Dungeon ChipSet" },
  { textureKey: "tex_easyrpg_chipset_retro_exterior", path: "assets/easyrpg-chipset-retro-exterior-transparent.png", name: "EasyRPG RTP retro Exterior ChipSet" },
  { textureKey: "tex_easyrpg_chipset_retro_house", path: "assets/easyrpg-chipset-retro-house-transparent.png", name: "EasyRPG RTP retro House ChipSet" },
  { textureKey: "tex_easyrpg_chipset_combined_town", path: "assets/easyrpg-chipset-combined-town-transparent.png", name: "EasyRPG RTP Combined Town ChipSet" },
  { textureKey: "tex_easyrpg_chipset_retro_world", path: "assets/easyrpg-chipset-retro-world-transparent.png", name: "EasyRPG RTP retro World ChipSet" },
] as const satisfies readonly BundledImageAsset[];

export function bundledEasyRpgTilesetId(textureKey: string): string {
  return textureKey.startsWith("tex_") ? textureKey.slice(4) : textureKey;
}

export const BUNDLED_EASYRPG_CHARSET_ASSETS =
  EASYRPG_CHARSET_ASSETS satisfies readonly BundledImageAsset[];

const EXTRA_BUNDLED_IMAGE_ASSETS = [
  ...BUNDLED_EASYRPG_CHIPSET_ASSETS,
  ...BUNDLED_EASYRPG_CHARSET_ASSETS,
] as const satisfies readonly BundledImageAsset[];

export const BUNDLED_IMAGE_ASSETS = [
  ...CORE_BUNDLED_IMAGE_ASSETS,
  ...EXTRA_BUNDLED_IMAGE_ASSETS,
] as const satisfies readonly BundledImageAsset[];

export function findBundledImageAsset(textureKey: string): BundledImageAsset | undefined {
  return BUNDLED_IMAGE_ASSETS.find((asset) => asset.textureKey === textureKey);
}

const RAW_CHARSET_TEXTURE_SUFFIX = "__raw";

export function loadBundledAssets(scene: Phaser.Scene): void {
  scene.load.image(TEX_TILESET, ASSET_TILESET);
  for (const asset of BUNDLED_EASYRPG_CHIPSET_ASSETS) {
    scene.load.image(asset.textureKey, asset.path);
  }
  for (const asset of BUNDLED_EASYRPG_CHARSET_ASSETS) {
    scene.load.image(rawCharsetTextureKey(asset.textureKey), asset.path);
  }
  scene.load.spritesheet(TEX_NPC, ASSET_NPC, {
    frameWidth: SPRITE_FRAME_WIDTH,
    frameHeight: SPRITE_FRAME_HEIGHT,
  });
  scene.load.image(TEX_DIALOGUE_FRAME, ASSET_DIALOGUE_FRAME);

  scene.load.on("loaderror", (file: Phaser.Loader.File) => {
    if (
      file.key === TEX_TILESET ||
      file.key === TEX_NPC ||
      file.key === TEX_DIALOGUE_FRAME ||
      isExtraBundledLoadKey(file.key)
    ) {
      console.error(
        `[assets] 에셋 파일 로드 실패: ${file.key} -> ${file.url}. public/assets/ 를 확인하세요.`
      );
    }
  });
}

export function registerBundledFrames(scene: Phaser.Scene): void {
  if (!scene.textures.exists(TEX_TILESET)) {
    console.error(
      `[assets] ${TEX_TILESET} 가 로드되지 않았습니다. 에셋 파일을 확인하세요.`
    );
    return;
  }
  registerTileFrames(scene, TEX_TILESET);
  for (const asset of BUNDLED_EASYRPG_CHIPSET_ASSETS) {
    if (!scene.textures.exists(asset.textureKey)) {
      console.error(`[assets] ${asset.textureKey} 가 로드되지 않았습니다. EasyRPG ChipSet 파일을 확인하세요.`);
      continue;
    }
    registerTileFrames(scene, asset.textureKey);
  }
  registerTileAnimations(scene);
  registerEasyRpgCharsetTextures(scene);
}

function registerEasyRpgCharsetTextures(scene: Phaser.Scene): void {
  for (const asset of BUNDLED_EASYRPG_CHARSET_ASSETS) {
    if (scene.textures.exists(asset.textureKey)) continue;
    const rawKey = rawCharsetTextureKey(asset.textureKey);
    if (!scene.textures.exists(rawKey)) {
      console.error(`[assets] ${rawKey} 가 로드되지 않았습니다. EasyRPG CharSet 파일을 확인하세요.`);
      continue;
    }
    const source = scene.textures.get(rawKey).getSourceImage();
    if (!isCharsetSourceImage(source)) {
      console.error(`[assets] ${rawKey} 원본 이미지를 캔버스로 변환할 수 없습니다.`);
      continue;
    }
    const canvas = createTransparentCharsetCanvas(source);
    if (!canvas) {
      console.error(`[assets] ${rawKey} 투명색 캔버스를 만들 수 없습니다.`);
      continue;
    }
    const texture = scene.textures.addCanvas(asset.textureKey, canvas);
    if (!texture) {
      console.error(`[assets] ${asset.textureKey} 텍스처 등록에 실패했습니다.`);
      continue;
    }
    registerCharsetTextureFrames(texture);
  }
}

function createTransparentCharsetCanvas(source: HTMLImageElement | HTMLCanvasElement): HTMLCanvasElement | null {
  const canvas = document.createElement("canvas");
  canvas.width = sourceImageWidth(source);
  canvas.height = sourceImageHeight(source);
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) return null;
  context.drawImage(source, 0, 0);
  const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
  applyTransparentColorKey(imageData.data);
  context.putImageData(imageData, 0, 0);
  return canvas;
}

function registerCharsetTextureFrames(texture: Phaser.Textures.Texture): void {
  for (let frameIndex = 0; frameIndex < CHARSET_FRAME_COUNT; frameIndex += 1) {
    const column = frameIndex % CHARSET_SHEET_COLUMNS;
    const row = Math.floor(frameIndex / CHARSET_SHEET_COLUMNS);
    texture.add(
      frameIndex,
      0,
      column * CHARSET_FRAME_WIDTH,
      row * CHARSET_FRAME_HEIGHT,
      CHARSET_FRAME_WIDTH,
      CHARSET_FRAME_HEIGHT
    );
  }
}

function rawCharsetTextureKey(textureKey: string): string {
  return `${textureKey}${RAW_CHARSET_TEXTURE_SUFFIX}`;
}

function isExtraBundledLoadKey(fileKey: string): boolean {
  return EXTRA_BUNDLED_IMAGE_ASSETS.some(
    (asset) => asset.textureKey === fileKey || rawCharsetTextureKey(asset.textureKey) === fileKey
  );
}

function isCharsetSourceImage(
  source: HTMLImageElement | HTMLCanvasElement | Phaser.GameObjects.RenderTexture
): source is HTMLImageElement | HTMLCanvasElement {
  return source instanceof HTMLImageElement || source instanceof HTMLCanvasElement;
}

function sourceImageWidth(source: HTMLImageElement | HTMLCanvasElement): number {
  return source instanceof HTMLImageElement ? source.naturalWidth || source.width : source.width;
}

function sourceImageHeight(source: HTMLImageElement | HTMLCanvasElement): number {
  return source instanceof HTMLImageElement ? source.naturalHeight || source.height : source.height;
}

function registerTileFrames(scene: Phaser.Scene, textureKey: string): void {
  const tex = scene.textures.get(textureKey);
  const existing = tex.getFrameNames();
  if (existing.includes("tile_0") && existing.includes("tile_0_nw")) return;
  for (let i = 0; i < TILE_FRAME_COUNT; i++) {
    const { sx, sy } = tileSourceXY(i);
    if (!existing.includes(`tile_${i}`)) {
      tex.add(`tile_${i}`, 0, sx, sy, TILE_SIZE, TILE_SIZE);
    }
    for (const quarter of TILE_QUARTERS) {
      const frameName = `tile_${i}_${quarter.name}`;
      if (!existing.includes(frameName)) {
        tex.add(frameName, 0, sx + quarter.dx, sy + quarter.dy, TILE_QUARTER_SIZE, TILE_QUARTER_SIZE);
      }
    }
  }
}

function registerTileAnimations(scene: Phaser.Scene): void {
  for (const strip of CHIPSET_ANIMATION_STRIPS) {
    if (scene.anims.exists(strip.key)) continue;
    scene.anims.create({
      key: strip.key,
      frames: strip.frames.map((frame) => ({ key: TEX_TILESET, frame: `tile_${frame}` })),
      frameRate: CHIPSET_ANIMATION_FPS,
      repeat: -1,
    });
    for (const quarter of TILE_QUARTERS) {
      const key = `${strip.key}_${quarter.name}`;
      if (scene.anims.exists(key)) continue;
      scene.anims.create({
        key,
        frames: strip.frames.map((frame) => ({ key: TEX_TILESET, frame: `tile_${frame}_${quarter.name}` })),
        frameRate: CHIPSET_ANIMATION_FPS,
        repeat: -1,
      });
    }
  }
}

export function tileSourceXY(index: number): { sx: number; sy: number } {
  if (index < 0) return { sx: 0, sy: 0 };
  const col = index % TILES_PER_ROW;
  const row = Math.floor(index / TILES_PER_ROW);
  return { sx: col * TILE_SIZE, sy: row * TILE_SIZE };
}

export function spriteFrameIndex(dir: number, frm: number): number {
  return dir * SPRITE_COLS + frm;
}
