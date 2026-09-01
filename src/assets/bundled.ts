import { withInlineAsset } from "@/assets/inlineAssetStore";
import type Phaser from "phaser";
import { BUILTIN_SPRITE_SLICING, RESOURCE_SLICING } from "@/assets/resourceSlicing";
import {
  CHARSET_FRAME_COUNT,
  CHARSET_FRAME_HEIGHT,
  CHARSET_FRAME_WIDTH,
  CHARSET_SHEET_COLUMNS,
} from "@/assets/easyrpgRtp";
import {
  chipsetLoadTextureKey,
  createTransparentColorKeyCanvas,
  isColorKeyedChipsetTextureKey,
  isTransparentColorKeySourceImage,
  rawChipsetTextureKey,
} from "@/assets/chipsetTransparency";
import { CHIPSET_ANIMATION_FPS, CHIPSET_ANIMATION_STRIPS } from "@/project/defaults/chipsetAnimation";
import { CHARSET_ASSETS } from "@/assets/charsetCatalog";
import { FARMING_CROP_SPRITE_ASSETS } from "@/assets/farmingSprites";
import { cropGraphicStages } from "@/project/farmModel";
import { SCARLOXY_CHIPSET_ASSETS } from "@/assets/scarloxyPack";
import type { Project } from "@/project/types";
export { isColorKeyedChipsetTextureKey } from "@/assets/chipsetTransparency";

export const TEX_TILESET = "tex_tiles_default";
export const TEX_DIALOGUE_FRAME = "tex_dialogue_frame";

export type BundledImageAsset = {
  readonly textureKey: string;
  readonly path: string;
  readonly name: string;
};

export const TILE_SIZE = RESOURCE_SLICING.chipset.cellWidth;
export const TILES_PER_ROW = RESOURCE_SLICING.chipset.columns;
export const TILE_FRAME_COUNT = RESOURCE_SLICING.chipset.count;
const TILE_QUARTER_SIZE = TILE_SIZE / 2;
const TILE_QUARTERS = [
  { name: "nw", dx: 0, dy: 0 },
  { name: "ne", dx: TILE_QUARTER_SIZE, dy: 0 },
  { name: "sw", dx: 0, dy: TILE_QUARTER_SIZE },
  { name: "se", dx: TILE_QUARTER_SIZE, dy: TILE_QUARTER_SIZE },
] as const;

export const SPRITE_FRAMES = BUILTIN_SPRITE_SLICING.count;
export const SPRITE_COLS = BUILTIN_SPRITE_SLICING.columns;
export const SPRITE_ROWS = BUILTIN_SPRITE_SLICING.rows;
export const SPRITE_FRAME_WIDTH = BUILTIN_SPRITE_SLICING.cellWidth;
export const SPRITE_FRAME_HEIGHT = BUILTIN_SPRITE_SLICING.cellHeight;
export { CHARSET_FRAME_HEIGHT, CHARSET_FRAME_WIDTH } from "@/assets/easyrpgRtp";

export const ASSET_TILESET = "assets/easyrpg-chipset-exterior.png";
const ASSET_DIALOGUE_FRAME = "assets/dialogue-frame.png";

// 표시명 규약 (2026-08-21 출처 정리) —
// `name` 은 자료 보관함·타일셋 선택 드롭다운에 **사용자에게 그대로 보인다.** 예전 이름은
// "RM2K3 Original ChipSet" / "EasyRPG RTP … ChipSet" 이었는데 둘 다 문제였다:
//   · "RM2K3 Original" 은 **거짓이면서 위험한 이름**이었다. public/assets/ATTRIBUTION.md
//     기준 이 파일의 실제 출처는 EasyRPG RTP 의 `ChipSet/Exterior.png`(JasonPerry, CC0)
//     이고 Enterbrain 의 독점 RTP 가 아니다. 그런데 이름이 "원본"을 주장해, 파일 목록을
//     훑는 사람이 침해로 오해할 소지가 있었다. 파일명도 easyrpg-chipset-exterior.png 로 옮겼다.
//   · "RTP" 는 Enterbrain 의 용어다. EasyRPG 는 그 **대체본**이므로 굳이 쓸 이유가 없다.
// 이제 이름은 한국어 용도 + 출처 + 라이선스를 말한다. 라이선스 근거는 ATTRIBUTION.md.
const CORE_BUNDLED_IMAGE_ASSETS = [
  { textureKey: TEX_TILESET, path: ASSET_TILESET, name: "바깥 마을 · EasyRPG (CC0)" },
  { textureKey: TEX_DIALOGUE_FRAME, path: ASSET_DIALOGUE_FRAME, name: "기본 대사창 테두리" },
] as const satisfies readonly BundledImageAsset[];

export const BUNDLED_EASYRPG_CHIPSET_ASSETS = [
  { textureKey: "tex_easyrpg_chipset_dungeon", path: "assets/easyrpg-chipset-dungeon-transparent.png", name: "던전 · EasyRPG (CC0)" },
  { textureKey: "tex_easyrpg_chipset_interior", path: "assets/easyrpg-chipset-interior-transparent.png", name: "실내 · EasyRPG (CC0)" },
  { textureKey: "tex_easyrpg_chipset_ship", path: "assets/easyrpg-chipset-ship-transparent.png", name: "배 · EasyRPG (CC0)" },
  { textureKey: "tex_easyrpg_chipset_world", path: "assets/easyrpg-chipset-world-transparent.png", name: "월드맵 · EasyRPG (CC0)" },
  // retro_* 세 장은 출처가 섞여 있다(CC-BY/CC0/WTFPL) — ATTRIBUTION.md 와 vendor AUTHORS.md 참고.
  { textureKey: "tex_easyrpg_chipset_retro_dungeon", path: "assets/easyrpg-chipset-retro-dungeon-transparent.png", name: "레트로 던전 · EasyRPG (CC0)" },
  { textureKey: "tex_easyrpg_chipset_retro_exterior", path: "assets/easyrpg-chipset-retro-exterior-transparent.png", name: "레트로 바깥 · EasyRPG (혼합 출처)" },
  { textureKey: "tex_easyrpg_chipset_retro_house", path: "assets/easyrpg-chipset-retro-house-transparent.png", name: "레트로 집 · EasyRPG (혼합 출처)" },
  { textureKey: "tex_easyrpg_chipset_combined_town", path: "assets/easyrpg-chipset-combined-town-transparent.png", name: "합본 마을 · EasyRPG (CC0)" },
  { textureKey: "tex_easyrpg_chipset_retro_world", path: "assets/easyrpg-chipset-retro-world-transparent.png", name: "레트로 월드맵 · EasyRPG (혼합 출처)" },
  { textureKey: "tex_modern_exteriors_nocturne", path: "assets/modern-exteriors/modern-city-atlas.png", name: "Modern Exteriors · 네온 녹턴" },
  ...SCARLOXY_CHIPSET_ASSETS,
] as const satisfies readonly BundledImageAsset[];

export function bundledEasyRpgTilesetId(textureKey: string): string {
  return textureKey.startsWith("tex_") ? textureKey.slice(4) : textureKey;
}

export const BUNDLED_EASYRPG_CHARSET_ASSETS =
  CHARSET_ASSETS satisfies readonly BundledImageAsset[];

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
export function loadBundledAssets(scene: Phaser.Scene, project?: Project): void {
  const usedTextures = project ? projectBundledTextureKeys(project) : null;
  scene.load.image(TEX_TILESET, withInlineAsset(ASSET_TILESET));
  for (const asset of BUNDLED_EASYRPG_CHIPSET_ASSETS) {
    if (usedTextures && !usedTextures.has(asset.textureKey)) continue;
    scene.load.image(chipsetLoadTextureKey(asset.textureKey), withInlineAsset(asset.path));
  }
  for (const asset of BUNDLED_EASYRPG_CHARSET_ASSETS) {
    if (usedTextures && !usedTextures.has(asset.textureKey)) continue;
    scene.load.image(rawCharsetTextureKey(asset.textureKey), withInlineAsset(asset.path));
  }
  for (const asset of FARMING_CROP_SPRITE_ASSETS) {
    if (usedTextures && !usedTextures.has(asset.id)) continue;
    scene.load.image(asset.id, withInlineAsset(asset.path));
  }
  scene.load.image(TEX_DIALOGUE_FRAME, withInlineAsset(ASSET_DIALOGUE_FRAME));

  scene.load.on("loaderror", (file: Phaser.Loader.File) => {
    if (
      file.key === TEX_TILESET ||
      file.key === TEX_DIALOGUE_FRAME ||
      isExtraBundledLoadKey(file.key)
    ) {
      console.error(
        `[assets] 에셋 파일 로드 실패: ${file.key} -> ${file.url}. public/assets/ 를 확인하세요.`
      );
    }
  });
}

export function registerBundledFrames(scene: Phaser.Scene, project?: Project): void {
  const usedTextures = project ? projectBundledTextureKeys(project) : null;
  if (!scene.textures.exists(TEX_TILESET)) {
    console.error(
      `[assets] ${TEX_TILESET} 가 로드되지 않았습니다. 에셋 파일을 확인하세요.`
    );
    return;
  }
  registerTileFrames(scene, TEX_TILESET);
  for (const asset of BUNDLED_EASYRPG_CHIPSET_ASSETS) {
    if (usedTextures && !usedTextures.has(asset.textureKey)) continue;
    if (isColorKeyedChipsetTextureKey(asset.textureKey)) {
      registerTransparentChipsetTexture(scene, asset);
    }
    if (!scene.textures.exists(asset.textureKey)) {
      console.error(`[assets] ${asset.textureKey} 가 로드되지 않았습니다. EasyRPG ChipSet 파일을 확인하세요.`);
      continue;
    }
    registerTileFrames(scene, asset.textureKey);
  }
  registerTileAnimations(scene, [
    TEX_TILESET,
    ...BUNDLED_EASYRPG_CHIPSET_ASSETS
      .filter((asset) => !usedTextures || usedTextures.has(asset.textureKey))
      .map((asset) => asset.textureKey),
  ]);
  registerEasyRpgCharsetTextures(scene, usedTextures);
  registerFarmingCropFrames(scene, usedTextures);
}

// 작물 성장 시트(16x16 프레임 가로 나열)를 성장 단계 인덱스로 접근할 수 있게 숫자 프레임을 등록한다.
function registerFarmingCropFrames(scene: Phaser.Scene, usedTextures: ReadonlySet<string> | null = null): void {
  for (const asset of FARMING_CROP_SPRITE_ASSETS) {
    if (usedTextures && !usedTextures.has(asset.id)) continue;
    if (!scene.textures.exists(asset.id)) {
      console.error(`[assets] ${asset.id} 가 로드되지 않았습니다. 농사 작물 스프라이트 파일을 확인하세요.`);
      continue;
    }
    const texture = scene.textures.get(asset.id);
    const existing = texture.getFrameNames();
    for (let frameIndex = 0; frameIndex < asset.frameCount; frameIndex += 1) {
      if (existing.includes(String(frameIndex))) continue;
      texture.add(frameIndex, 0, frameIndex * asset.frameWidth, 0, asset.frameWidth, asset.frameHeight);
    }
  }
}

// frameCount: 확장 타일셋(타일 이식)용 — 기본 480(TILE_FRAME_COUNT)은 불변, 확장분만 추가 등록.
export function registerTilesetTextureFrames(
  scene: Phaser.Scene,
  textureKey: string,
  frameCount: number = TILE_FRAME_COUNT
): void {
  registerTileFrames(scene, textureKey, frameCount);
  registerTileAnimationsForTexture(scene, textureKey);
}

function registerTransparentChipsetTexture(scene: Phaser.Scene, asset: BundledImageAsset): void {
  if (scene.textures.exists(asset.textureKey)) return;
  const rawKey = rawChipsetTextureKey(asset.textureKey);
  if (!scene.textures.exists(rawKey)) {
    console.error(`[assets] ${rawKey} 가 로드되지 않았습니다. EasyRPG ChipSet 파일을 확인하세요.`);
    return;
  }
  const source = scene.textures.get(rawKey).getSourceImage();
  if (!isTransparentColorKeySourceImage(source)) {
    console.error(`[assets] ${rawKey} 원본 이미지를 캔버스로 변환할 수 없습니다.`);
    return;
  }
  const canvas = createTransparentColorKeyCanvas(asset.textureKey, source);
  if (!canvas) {
    console.error(`[assets] ${rawKey} 투명색 캔버스를 만들 수 없습니다.`);
    return;
  }
  const texture = scene.textures.addCanvas(asset.textureKey, canvas);
  if (!texture) {
    console.error(`[assets] ${asset.textureKey} 텍스처 등록에 실패했습니다.`);
  }
}

function registerEasyRpgCharsetTextures(scene: Phaser.Scene, usedTextures: ReadonlySet<string> | null = null): void {
  for (const asset of BUNDLED_EASYRPG_CHARSET_ASSETS) {
    if (usedTextures && !usedTextures.has(asset.textureKey)) continue;
    if (scene.textures.exists(asset.textureKey)) continue;
    const rawKey = rawCharsetTextureKey(asset.textureKey);
    if (!scene.textures.exists(rawKey)) {
      console.error(`[assets] ${rawKey} 가 로드되지 않았습니다. EasyRPG CharSet 파일을 확인하세요.`);
      continue;
    }
    const source = scene.textures.get(rawKey).getSourceImage();
    if (!isTransparentColorKeySourceImage(source)) {
      console.error(`[assets] ${rawKey} 원본 이미지를 캔버스로 변환할 수 없습니다.`);
      continue;
    }
    const canvas = createTransparentColorKeyCanvas(asset.textureKey, source);
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

function projectBundledTextureKeys(project: Project): Set<string> {
  const strings = new Set<string>();
  collectProjectStrings(project, strings);
  const keys = new Set<string>([TEX_TILESET, TEX_DIALOGUE_FRAME]);
  for (const asset of BUNDLED_EASYRPG_CHIPSET_ASSETS) {
    if (strings.has(asset.textureKey)) keys.add(asset.textureKey);
  }
  for (const asset of BUNDLED_EASYRPG_CHARSET_ASSETS) {
    if (strings.has(asset.id) || strings.has(asset.textureKey)) keys.add(asset.textureKey);
  }
  // 자동 배선된 작물 그래픽은 프로젝트 문자열에 없다(저장하지 않는다) — 그래서 해석해서 더한다.
  const cropAssetIds = new Set<string>();
  for (const crop of project.database.crops ?? []) {
    for (const stage of cropGraphicStages(crop)) {
      if (stage.resourceId) cropAssetIds.add(stage.resourceId);
    }
  }
  for (const asset of FARMING_CROP_SPRITE_ASSETS) {
    if (strings.has(asset.id) || cropAssetIds.has(asset.id)) keys.add(asset.id);
  }
  return keys;
}

function collectProjectStrings(value: unknown, out: Set<string>): void {
  if (typeof value === "string") {
    out.add(value);
    return;
  }
  if (Array.isArray(value)) {
    for (const item of value) collectProjectStrings(item, out);
    return;
  }
  if (typeof value !== "object" || value === null) return;
  for (const [key, child] of Object.entries(value)) {
    if (key === "uploaded") continue;
    collectProjectStrings(child, out);
  }
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
  return (
    EXTRA_BUNDLED_IMAGE_ASSETS.some(
      (asset) =>
        asset.textureKey === fileKey ||
        rawCharsetTextureKey(asset.textureKey) === fileKey ||
        rawChipsetTextureKey(asset.textureKey) === fileKey
    ) || FARMING_CROP_SPRITE_ASSETS.some((asset) => asset.id === fileKey)
  );
}

function registerTileFrames(scene: Phaser.Scene, textureKey: string, frameCount: number = TILE_FRAME_COUNT): void {
  const tex = scene.textures.get(textureKey);
  const existing = tex.getFrameNames();
  // 마지막 프레임까지 이미 있으면 완료 — 확장 타일셋(frameCount > 480)은 확장분만 이어서 등록한다.
  if (existing.includes("tile_0") && existing.includes("tile_0_nw") && existing.includes(`tile_${frameCount - 1}_se`)) return;
  for (let i = 0; i < frameCount; i++) {
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

export function chipsetAnimationKey(textureKey: string, animationKey: string): string {
  return textureKey === TEX_TILESET ? animationKey : `${textureKey}:${animationKey}`;
}

function registerTileAnimations(scene: Phaser.Scene, textureKeys: readonly string[]): void {
  for (const textureKey of textureKeys) {
    if (!scene.textures.exists(textureKey)) continue;
    registerTileAnimationsForTexture(scene, textureKey);
  }
}

function registerTileAnimationsForTexture(scene: Phaser.Scene, textureKey: string): void {
  for (const strip of CHIPSET_ANIMATION_STRIPS) {
    const stripKey = chipsetAnimationKey(textureKey, strip.key);
    if (scene.anims.exists(stripKey)) continue;
    const frameRate = strip.fps > 0 ? strip.fps : CHIPSET_ANIMATION_FPS;
    scene.anims.create({
      key: stripKey,
      frames: strip.frames.map((frame) => ({ key: textureKey, frame: `tile_${frame}` })),
      frameRate,
      repeat: -1,
    });
    for (const quarter of TILE_QUARTERS) {
      const key = chipsetAnimationKey(textureKey, `${strip.key}_${quarter.name}`);
      if (scene.anims.exists(key)) continue;
      scene.anims.create({
        key,
        frames: strip.frames.map((frame) => ({ key: textureKey, frame: `tile_${frame}_${quarter.name}` })),
        frameRate,
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
