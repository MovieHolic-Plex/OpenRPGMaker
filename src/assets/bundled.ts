import forestHarmony from "./forestHarmonyTileset.json";
import tiboRecovered from "./tiboRecoveredTileset.json";
import { withInlineAsset } from "@/assets/inlineAssetStore";
import { loadUploadedTilesets, registerUploadedTilesets } from "./uploadedTilesets";
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
import {
  COMBINED_TOWN_RETRO_WORLD_NAME,
  COMBINED_TOWN_RETRO_WORLD_TEXTURE_KEY,
  COMBINED_TOWN_RETRO_WORLD_TILE_COUNT,
} from "@/project/defaults/constants";
import { CHARSET_ASSETS } from "@/assets/charsetCatalog";
import { EASYRPG_PICTURE_ASSETS } from "@/assets/easyrpgRtp";
import { FARMING_CROP_SPRITE_ASSETS } from "@/assets/farmingSprites";
import { generatedMonsterSpriteUrl, isGeneratedMonsterSprite } from "@/assets/generatedMonsterSprites";
import { cropGraphicStages } from "@/project/farmModel";
import { SCARLOXY_CHIPSET_ASSETS } from "@/assets/scarloxyPack";
import { EMOTE_ASSET_PATH, EMOTE_FRAME_SIZE, EMOTE_KINDS, EMOTE_TEXTURE_KEY } from "@/project/emotes";
import { PLACEABLE_OVERLAY_TEXTURE_KEYS } from "@/player/placeableOverlayGraphics";
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

/**
 * Slates 32×32px orthogonal tileset (Ivan Voirol, CC-BY 4.0) — 1792×704 = 56열×22행 = 1232칸.
 * 상단 32px 제목 띠는 잘라낸 본문만 번들한다. 출처·라이선스는 `public/assets/ATTRIBUTION.md`.
 */
export const SLATES_32_TEXTURE_KEY = "tex_slates_32";
export const SLATES_32_TILE_SIZE = 32;
export const SLATES_32_TILES_PER_ROW = 56;
export const SLATES_32_FRAME_COUNT = 56 * 22;
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
  {textureKey:"tex_forest_harmony",path:"assets/forest-harmony/chipset.png",name:"숲마을 · 거리별 잔디"},
  {textureKey:"tex_tibo_interior_expanded",path:"assets/tibo-interior/interior-expanded.png",name:"실내 확장 · Tibo"},
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
  // 480×608 확장 시트(1140칸) — 위 480칸 합본 마을 그대로, 다음 480칸 레트로 월드맵(+480), 맨 아래 180칸 숲 나무 띠(960~).
  // 그림은 scripts/gen-combined-town-retro-world-chipset.mjs, 정의는 defaults/combinedTownRetroWorld.ts.
  { textureKey: COMBINED_TOWN_RETRO_WORLD_TEXTURE_KEY, path: "assets/easyrpg-chipset-combined-town-retro-world-transparent.png", name: COMBINED_TOWN_RETRO_WORLD_NAME },
  { textureKey: "tex_modern_exteriors_nocturne", path: "assets/modern-exteriors/modern-city-atlas.png", name: "Modern Exteriors · 네온 녹턴" },
  { textureKey: SLATES_32_TEXTURE_KEY, path: "assets/slates/slates-v2-32px.png", name: "Slates 32px · Ivan Voirol (CC-BY 4.0)" },
  ...SCARLOXY_CHIPSET_ASSETS,
] as const satisfies readonly BundledImageAsset[];

/**
 * 16px 규격이 아닌 번들 시트의 기하. 여기 없는 시트는 16px·30열이다.
 *
 * Slates 는 32px 격자(1792×704 = 56열×22행 = 1232칸)다. 이 값을 프레임 등록·타일셋 정의·
 * 자료 보관함 프로필이 **모두 같은 출처**에서 읽어야 팔레트와 캔버스가 같은 그림을 가리킨다.
 */
export const BUNDLED_CHIPSET_GEOMETRY: Readonly<Record<string, { readonly tileSize: number; readonly tilesPerRow: number }>> = {
  tex_slates_32: { tileSize: 32, tilesPerRow: 56 },
};

/** 이 번들 시트의 타일 한 변(px). 16px 규격이면 16. */
export function bundledChipsetTileSize(key: string): number {
  return BUNDLED_CHIPSET_GEOMETRY[key]?.tileSize ?? TILE_SIZE;
}

/** 이 번들 시트의 한 행 칸 수. 16px 규격이면 30. */
export function bundledChipsetTilesPerRow(key: string): number {
  return BUNDLED_CHIPSET_GEOMETRY[key]?.tilesPerRow ?? TILES_PER_ROW;
}

/** 번들 칩셋의 칸 수. 480칸 규격이 아닌 확장 시트(Tibo 실내 확장·합본 마을+레트로 월드맵)만 여기서 갈라진다. */
export function bundledChipsetFrameCount(key: string): number {
  if (key === "tex_forest_harmony") return forestHarmony.count;
  if (key === "tex_tibo_interior_expanded") return tiboRecovered.count;
  if (key === SLATES_32_TEXTURE_KEY) return SLATES_32_FRAME_COUNT;
  if (key === COMBINED_TOWN_RETRO_WORLD_TEXTURE_KEY) return COMBINED_TOWN_RETRO_WORLD_TILE_COUNT;
  return TILE_FRAME_COUNT;
}

/** 번들 칩셋 시트의 세로 픽셀 — 자료 보관함 프로필(imageHeight)이 실제 파일과 맞게 한다. */
export function bundledChipsetSheetHeight(key: string): number {
  return Math.ceil(bundledChipsetFrameCount(key) / bundledChipsetTilesPerRow(key)) * bundledChipsetTileSize(key);
}

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
export function loadBundledAssets(scene: { readonly load: Pick<Phaser.Loader.LoaderPlugin, "image" | "on"> }, project?: Project): void {
  const usedTextures = project ? projectBundledTextureKeys(project) : null;
  loadUploadedTilesets(scene, project);
  scene.load.image(TEX_TILESET, withInlineAsset(ASSET_TILESET));
  for (const asset of BUNDLED_EASYRPG_CHIPSET_ASSETS) {
    if (usedTextures && !usedTextures.has(asset.textureKey)) continue;
    scene.load.image(chipsetLoadTextureKey(asset.textureKey), withInlineAsset(asset.path));
  }
  for (const asset of BUNDLED_EASYRPG_CHARSET_ASSETS) {
    if (usedTextures && !usedTextures.has(asset.textureKey)) continue;
    scene.load.image(rawCharsetTextureKey(asset.textureKey), withInlineAsset(asset.path));
  }
  for (const asset of Object.values(project?.assets.uploaded ?? {})) {
    // 번들 캐릭셋과 같은 규약 — 원본은 raw 키로 싣고, asset.id 는 색상 키를 뺀 캔버스가 가진다.
    if (asset.kind === "charset") scene.load.image(rawCharsetTextureKey(asset.id), asset.dataUrl);
  }
  for (const asset of FARMING_CROP_SPRITE_ASSETS) {
    if (usedTextures && !usedTextures.has(asset.id)) continue;
    scene.load.image(asset.id, withInlineAsset(asset.path));
  }
  for (const asset of EASYRPG_PICTURE_ASSETS) {
    if (!usedTextures?.has(asset.id)) continue;
    scene.load.image(asset.id, withInlineAsset(asset.path));
  }
  for (const id of usedTextures ?? []) {
    // Project-owned sprites/uploads keep their existing texture ownership.
    if (project?.assets.sprites[id] || project?.assets.uploaded[id]) continue;
    const url = generatedMonsterSpriteUrl(id);
    if (url) scene.load.image(id, url);
  }
  scene.load.image(TEX_DIALOGUE_FRAME, withInlineAsset(ASSET_DIALOGUE_FRAME));
  scene.load.image(EMOTE_TEXTURE_KEY, withInlineAsset(EMOTE_ASSET_PATH));

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
    registerTileFrames(scene, asset.textureKey, bundledChipsetFrameCount(asset.textureKey), {
      tileSize: bundledChipsetTileSize(asset.textureKey),
      tilesPerRow: bundledChipsetTilesPerRow(asset.textureKey),
    });
  }
  registerTileAnimations(scene, [
    TEX_TILESET,
    ...BUNDLED_EASYRPG_CHIPSET_ASSETS
      .filter((asset) => !usedTextures || usedTextures.has(asset.textureKey))
      .map((asset) => asset.textureKey),
  ]);
  registerEasyRpgCharsetTextures(scene, usedTextures);
  registerUploadedCharsetTextures(scene, project);
  registerUploadedTilesets(scene, project);
  registerFarmingCropFrames(scene, usedTextures);
  registerEmoteFrames(scene);
}

// 이모트 시트(16x16 프레임 가로 나열) — 프레임 인덱스 = EMOTE_KINDS 순서.
function registerEmoteFrames(scene: Phaser.Scene): void {
  if (!scene.textures.exists(EMOTE_TEXTURE_KEY)) {
    console.error(`[assets] ${EMOTE_TEXTURE_KEY} 가 로드되지 않았습니다. node scripts/gen-emote-sheet.mjs 를 실행하세요.`);
    return;
  }
  const texture = scene.textures.get(EMOTE_TEXTURE_KEY);
  const existing = texture.getFrameNames();
  EMOTE_KINDS.forEach((_kind, frameIndex) => {
    if (existing.includes(String(frameIndex))) return;
    texture.add(frameIndex, 0, frameIndex * EMOTE_FRAME_SIZE, 0, EMOTE_FRAME_SIZE, EMOTE_FRAME_SIZE);
  });
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
  frameCount: number = TILE_FRAME_COUNT,
  geometry: { readonly tileSize?: number; readonly tilesPerRow?: number } = {},
): void {
  registerTileFrames(scene, textureKey, frameCount, geometry);
  if ((geometry.tileSize ?? TILE_SIZE) === TILE_SIZE) registerTileAnimationsForTexture(scene, textureKey);
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

/**
 * 자료 보관함에 올린 캐릭터셋을 번들 캐릭셋과 **같은 파이프라인**으로 등록한다.
 *
 * 원본 RM2000 캐릭셋은 배경이 단색(청록·마젠타)이고 알파가 없다. raw 키로 실은 원본에서
 * 색상 키를 뺀 캔버스를 만들어 `asset.id` 로 올려야 편집 맵·인게임 어디서도 스프라이트
 * 주위에 배경 사각형이 남지 않는다. 에디터 DOM 미리보기는 이미
 * `applyCharsetFrameCrop` 이 같은 처리를 하므로, 이 함수로 Phaser 쪽 규약이 맞춰진다.
 */
export function registerUploadedCharsetTextures(scene: Phaser.Scene, project?: Project): void {
  for (const asset of Object.values(project?.assets.uploaded ?? {})) {
    if (asset.kind !== "charset") continue;
    if (scene.textures.exists(asset.id)) continue;
    const rawKey = rawCharsetTextureKey(asset.id);
    if (!scene.textures.exists(rawKey)) continue;
    const source = scene.textures.get(rawKey).getSourceImage();
    if (!isTransparentColorKeySourceImage(source)) {
      console.error(`[assets] ${rawKey} 원본 이미지를 캔버스로 변환할 수 없습니다.`);
      continue;
    }
    const width = uploadedSourceWidth(source);
    const height = uploadedSourceHeight(source);
    if (width !== RESOURCE_SLICING.charset.sheetWidth || height !== RESOURCE_SLICING.charset.sheetHeight) {
      console.error(`[assets] Unsupported charset dimensions: ${asset.id} (${width}x${height})`);
      continue;
    }
    const canvas = createTransparentColorKeyCanvas(asset.id, source);
    if (!canvas) {
      console.error(`[assets] ${rawKey} 투명색 캔버스를 만들 수 없습니다.`);
      continue;
    }
    const texture = scene.textures.addCanvas(asset.id, canvas);
    if (!texture) {
      console.error(`[assets] ${asset.id} 텍스처 등록에 실패했습니다.`);
      continue;
    }
    registerCharsetTextureFrames(texture);
  }
}

/** 씬별 진행 중인 업로드 캐릭셋 로드 키. 같은 자산을 매 store 변경마다 다시 싣지 않기 위한 것. */
const uploadedCharsetLoadsInFlight = new WeakMap<Phaser.Scene, Set<string>>();

/**
 * 실행 중인 씬에 **부팅 이후 들어온** 업로드 캐릭터셋을 뒤늦게 실어 준다.
 *
 * `loadBundledAssets` 는 preload 한 번뿐이라, 자료 보관함에서 방금 가져온 캐릭셋은
 * 텍스처가 없어 이벤트 마커가 Phaser 의 "빠진 텍스처" 사각형으로 그려졌다. 새로고침해야
 * 보이던 것이 이 함수로 그 자리에서 보인다.
 */
export function ensureUploadedCharsetTextures(
  scene: Phaser.Scene,
  project: Project,
  onRegistered?: () => void
): void {
  registerUploadedCharsetTextures(scene, project);
  const inFlight = uploadedCharsetLoadsInFlight.get(scene) ?? new Set<string>();
  uploadedCharsetLoadsInFlight.set(scene, inFlight);
  const queued: string[] = [];
  for (const asset of Object.values(project.assets.uploaded)) {
    if (asset.kind !== "charset") continue;
    if (scene.textures.exists(asset.id)) continue;
    const rawKey = rawCharsetTextureKey(asset.id);
    if (scene.textures.exists(rawKey) || inFlight.has(rawKey)) continue;
    inFlight.add(rawKey);
    queued.push(rawKey);
    scene.load.image(rawKey, asset.dataUrl);
  }
  if (queued.length === 0) return;
  scene.load.once("complete", () => {
    for (const rawKey of queued) inFlight.delete(rawKey);
    registerUploadedCharsetTextures(scene, project);
    onRegistered?.();
  });
  scene.load.start();
}

function uploadedSourceWidth(source: HTMLImageElement | HTMLCanvasElement): number {
  return source instanceof HTMLImageElement ? source.naturalWidth || source.width : source.width;
}

function uploadedSourceHeight(source: HTMLImageElement | HTMLCanvasElement): number {
  return source instanceof HTMLImageElement ? source.naturalHeight || source.height : source.height;
}

function projectBundledTextureKeys(project: Project): Set<string> {
  const strings = new Set<string>();
  collectProjectStrings(project, strings);
  const keys = new Set<string>([TEX_TILESET, TEX_DIALOGUE_FRAME]);
  for (const id of strings) {
    if (isGeneratedMonsterSprite(id)) keys.add(id);
  }
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
  for (const asset of EASYRPG_PICTURE_ASSETS) {
    if (spatialGraphicResourceIds(project).has(asset.id)) keys.add(asset.id);
  }
  // Rock/gem charset + tree chipset frames are hardcoded by the placeable overlay renderer,
  // so they are not always present as project strings even when rocks/trees exist in session.
  for (const textureKey of PLACEABLE_OVERLAY_TEXTURE_KEYS) keys.add(textureKey);
  return keys;
}

function spatialGraphicResourceIds(project: Project): Set<string> {
  const ids = new Set<string>();
  const add = (id: string | undefined): void => {
    if (id) ids.add(id);
  };
  for (const type of project.database.farmBuildingTypes ?? []) {
    for (const level of type.levels) {
      add(level.graphicResourceId);
      for (const resourceId of Object.values(level.orientationGraphicResourceIds ?? {})) add(resourceId);
    }
  }
  for (const type of project.database.homeDecorationTypes ?? []) {
    add(type.graphicResourceId);
    for (const resourceId of Object.values(type.orientationGraphicResourceIds ?? {})) add(resourceId);
  }
  return ids;
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

export function rawCharsetTextureKey(textureKey: string): string {
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

/**
 * 타일 프레임을 등록한다. `geometry` 를 주면 그 크기·행 폭으로 자른다 —
 * 16px 규격이 아닌 시트(예: 32px Slates)는 기본값(TILE_SIZE·TILES_PER_ROW)으로 자르면
 * 프레임 사각형이 어긋나 **엉뚱한 그림 조각**이 등록된다.
 */
function registerTileFrames(
  scene: Phaser.Scene,
  textureKey: string,
  frameCount: number = TILE_FRAME_COUNT,
  geometry: { readonly tileSize?: number; readonly tilesPerRow?: number } = {},
): void {
  const tileSize = geometry.tileSize ?? TILE_SIZE;
  const tilesPerRow = geometry.tilesPerRow ?? TILES_PER_ROW;
  const quarterSize = tileSize / 2;
  const quarters = [
    { name: "nw", dx: 0, dy: 0 },
    { name: "ne", dx: quarterSize, dy: 0 },
    { name: "sw", dx: 0, dy: quarterSize },
    { name: "se", dx: quarterSize, dy: quarterSize },
  ] as const;
  const tex = scene.textures.get(textureKey);
  const existing = tex.getFrameNames();
  // 마지막 프레임까지 이미 있으면 완료 — 확장 타일셋(frameCount > 480)은 확장분만 이어서 등록한다.
  if (existing.includes("tile_0") && existing.includes("tile_0_nw") && existing.includes(`tile_${frameCount - 1}_se`)) return;
  for (let i = 0; i < frameCount; i++) {
    const sx = i % tilesPerRow * tileSize;
    const sy = Math.floor(i / tilesPerRow) * tileSize;
    if (!existing.includes(`tile_${i}`)) {
      tex.add(`tile_${i}`, 0, sx, sy, tileSize, tileSize);
    }
    for (const quarter of quarters) {
      const frameName = `tile_${i}_${quarter.name}`;
      if (!existing.includes(frameName)) {
        tex.add(frameName, 0, sx + quarter.dx, sy + quarter.dy, quarterSize, quarterSize);
      }
    }
  }
}

export function chipsetAnimationKey(textureKey: string, animationKey: string): string {
  return textureKey === TEX_TILESET ? animationKey : `${textureKey}:${animationKey}`;
}

function registerTileAnimations(scene: Phaser.Scene, textureKeys: readonly string[]): void {
  for (const textureKey of textureKeys) {
    if (!scene.textures.exists(textureKey) || bundledChipsetTileSize(textureKey) !== TILE_SIZE) continue;
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
