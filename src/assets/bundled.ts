import { MONSTER_KIT_CHIPSET_ASSETS, monsterKitSheet } from "./monsterKitAssets";
import { loadUploadedEventSprites, registerUploadedEventSpriteFrames } from "./uploadedEventSprites";
import { CC0_ICON_ASSETS, resolveCc0IconAssetUrl } from './cc0IconAssets';
import { uploadedAssetUrl } from "@/project/persistence/assetAccessors";
import atlasVehicles from "./atlasVehiclesTileset.json";
import beodeulCitySheet from "./beodeulCitySheet.json";
import beodeulGroundCatalog from './beodeulGroundCatalog.json';
import beodeulWarmTreesCatalog from './beodeulWarmTreesCatalog.json';
import beodeulArchitectureCatalog from './beodeulArchitectureCatalog.json';
import beodeulFormsCatalog from './beodeulFormsCatalog.json';
import joseonBaramSheet from "./joseonBaramSheet.json";
import modernCitySheet from "./modernCitySheet.json";
import jpCitySheet from "./jpCitySheet.json";
import wizardingWorldSheet from "./wizardingWorldSheet.json";
import worldmapSelectedSheet from "./worldmapSelectedSheet.json";
import worldmapAuthoringSheet from "./worldmapAuthoringSheet.json";
import atlasBiomeInterior from "./atlasBiomeInteriorSheet.json";
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
  CASTLE_TILESET_TEXTURE_KEY,
  CASTLE_REFERENCE_TILESET_TEXTURE_KEY,
  LPC_WOODEN_FURNITURE_16_TEXTURE_KEY,
  LPC_WOODEN_FURNITURE_TILESET_TEXTURE_KEY,
} from "@/project/defaults/constants";
import { CHARSET_ASSETS } from "@/assets/charsetCatalog";
import { VEHICLE_CHARSET_TEXTURE_KEY } from "@/project/vehicles";
import { EASYRPG_PICTURE_ASSETS } from "@/assets/easyrpgRtp";
import { FARMING_CROP_SPRITE_ASSETS } from "@/assets/farmingSprites";
import { generatedMonsterSpriteUrl, isGeneratedMonsterSprite } from "@/assets/generatedMonsterSprites";
import { cropGraphicStages } from "@/project/farmModel";
import { SCARLOXY_CHIPSET_ASSETS } from "@/assets/scarloxyPack";
import { EMERALD_MONSTER_KIT_CHIPSET_ASSETS, emeraldMonsterKitSheet } from "@/assets/emeraldMonsterKitAssets";
import { EMOTE_ASSET_PATH, EMOTE_FRAME_SIZE, EMOTE_KINDS, EMOTE_TEXTURE_KEY } from "@/project/emotes";
import { PLACEABLE_OVERLAY_TEXTURE_KEYS } from "@/player/placeableOverlayGraphics";
import type { Project } from "@/project/types";
import { bundledChipsetTileSize, bundledChipsetTilesPerRow } from "./bundledChipsetGeometry";
export { bundledChipsetTileSize, bundledChipsetTilesPerRow } from "./bundledChipsetGeometry";
export { isColorKeyedChipsetTextureKey } from "@/assets/chipsetTransparency";

export const TEX_TILESET = "tex_tiles_default";
export const TEX_DIALOGUE_FRAME = "tex_dialogue_frame";

/** [LPC] Wooden Furniture texture key — re-exported for defaults/webExport wiring. */
export { LPC_WOODEN_FURNITURE_16_TEXTURE_KEY, LPC_WOODEN_FURNITURE_TILESET_TEXTURE_KEY } from "@/project/defaults/constants";

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

// 2026-10-07 저작권 정리: 예전 기본 시트(EasyRPG Exterior)를 지웠다. 기본 텍스처 키(tex_tiles_default)는 부팅·옛 맵 호환에
// 필요해 같은 크기의 빈(투명) 시트로 남긴다 — 이 키로 그린 옛 맵은 빈 칸으로 보인다.
export const ASSET_TILESET = "assets/blank-chipset.png";
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
  { textureKey: TEX_TILESET, path: ASSET_TILESET, name: "기본 빈 칩셋 (예전 EasyRPG 바깥 시트는 삭제)" },
  { textureKey: TEX_DIALOGUE_FRAME, path: ASSET_DIALOGUE_FRAME, name: "기본 대사창 테두리" },
] as const satisfies readonly BundledImageAsset[];

export const FOREST_FANTASY_TOWN_TEXTURE_KEY = "tex_forest_harmony_fantasy_town";

/** The reference composite is loaded only by projects that explicitly use its board tileset. */
// 참고·이식 시트(숲마을 부품·던전 재칠 등)는 저작권 정리(2026-10-07)로 전부 지웠다. 자리만 남긴다.
export const BUNDLED_REFERENCE_CHIPSET_ASSETS: readonly BundledImageAsset[] = [];

export const BUNDLED_EASYRPG_CHIPSET_ASSETS = [
  {textureKey:'tex_beodeul_warm_trees',path:'assets/beodeul-warm-trees/chipset.png',name:'버들항 · 따뜻한 황록 나무·숲'},
  {textureKey:"tex_beodeul_door",path:"assets/beodeul-door/door-states.png",name:"버들항 · 문 열림 손 도트 시안"},
  {textureKey:"tex_beodeul_ground",path:"assets/beodeul-ground/chipset.png",name:"버들항 · 기초·밑동·잔디 꾸미기"},
  {textureKey:'tex_beodeul_architecture',path:'assets/beodeul-architecture/chipset.png',name:'버들항 · 원본 보존 민가·성당'},
  {textureKey:'tex_beodeul_forms',path:'assets/beodeul-forms/chipset.png',name:'버들항 · 건물 구조 여섯 계열'},
  // 버들항 v6(2026-09-28) — 로마풍 항구 도시 손 도트 렌더를 16px 칸으로 자른 시트(칸마다 땅/윗부분, 움직임 animationStrips).
  // 재생성: scripts/content/build-beodeul-city.py, 정의는 project/defaults/beodeulCity.ts, openwiki/beodeul-city.md.
  {textureKey:"tex_beodeul_city",path:"assets/beodeul-city/beodeul-city-chipset.png",name:"버들항 v6 · 로마풍 항구 도시 (손 도트)"},
  // 조선 · 바람의나라풍(2026-10-02) — 손 도트 조각(집·나무·담·성문·궁궐) + 오토타일(흙길·마당·강·논) 한 장. 마을 20호·국내성 맵이 같은 시트를 쓴다.
  // 재생성: scripts/content/build-joseon-tileset.py (입력만 바꿔 같은 명령), 정의는 project/defaults/joseonBaram.ts, openwiki/joseon-baram.md.
  {textureKey:"tex_joseon_baram",path:"assets/joseon-baram/joseon-baram-chipset.png",name:"조선 · 바람의나라풍 (손 도트)"},
  // 현대 도시 · 도쿄풍(2026-10) — modern-chipset 하네스가 합성한 도시(건물·도로·소품·차량)를 16px 칸으로 자른 시트. 칸 번호는 덧붙이기 전용.
  // 재생성: src/harnesses/modern-chipset/bake_tileset.py, 정의는 project/defaults/modernCity.ts, openwiki/modern-city.md.
  {textureKey:"tex_modern_city",path:"assets/modern-city/modern-city-chipset.png",name:"현대 도시 · 도쿄풍 (도트)"},
  // 일본 도시(2026-10) — modern3 팔레트 손 도트 상가·주택·역·신사를 48열 16px 칸으로 구운 시트. modern_city 와 별개 번들이다. 칸 번호는 덧붙이기 전용(자리 키 핀).
  // 재생성: scripts/content/jp-city/bake_jp.py, 정의는 project/defaults/jpCity.ts, openwiki/jp-city.md.
  {textureKey:"tex_jp_city",path:"assets/jp-city/jp-city-chipset.png",name:"일본 도시 · 상가·주택·역·신사 (도트)"},
  // 마법 학교 · 해리포터풍(2026-10) — HP 테마 42색 손 도트(성채 벽·12개 공간 기물·자연·탈것·생물·효과 움직임)를 48열 16px 칸으로 구운 시트. 칸 번호는 덧붙이기 전용(자리 키 핀).
  // 재생성: scripts/content/wizarding/bake_wz.py (검수 통과 조각만), 정의는 project/defaults/wizardingWorld.ts, openwiki/wizarding-world.md.
  {textureKey:"tex_wizarding_world",path:"assets/wizarding-world/wizarding-world-chipset.png",name:"마법 학교 · 해리포터풍 (손 도트)"},
  {textureKey:"tex_worldmap_selected",path:"assets/worldmap-icons/worldmap-selected.png",name:"월드맵 · 사람 선택 아이콘"},
  {textureKey:"tex_worldmap_authoring",path:"assets/worldmap-icons/worldmap-authoring.png",name:"월드맵 · 연결 지형 붓"},
  // 생성 칩셋(oprn-atlas) 공용 실내 — 손 도트 실내 v5 전용 시트(tiledata/hand-interior/v5, 가구·바닥·벽·천장·자동 타일·예제 26맵).
  // 그림·정의는 scripts/content/hand-interior/build_tileset.py, 정의 모듈은 project/defaults/atlasBiomeInterior.ts.
  {textureKey:"tex_atlas_biome_interior",path:"assets/atlas-interior/interior-chipset.png",name:"실내 · 손 도트 v5 (아틀라스)"},
  // 탈것·장면 조각(배·비공정·마차·축제·처형대·하늘) — EasyRPG 배 시트(CC0) 결로 찍은 손 도트. 정의는 project/defaults/atlasVehicles.ts,
  // 재생성: scripts/content/atlas-scenes/build_vehicles.py + register-vehicles.mjs. 출처 assets/atlas-scenes/CREDITS.txt.
  { textureKey: "tex_oprn_atlas_vehicles", path: "assets/atlas-scenes/vehicles.png", name: "탈것·장면 조각 · 배·비공정·마차·축제 (EasyRPG 배 시트 CC0 + 손 도트)" },
  ...SCARLOXY_CHIPSET_ASSETS,
  ...MONSTER_KIT_CHIPSET_ASSETS,
  ...EMERALD_MONSTER_KIT_CHIPSET_ASSETS,
  { textureKey: "tex_atlas_cartography", path: "assets/atlas-cartography/chipset.png", name: "지도 지형 · 새 손 도트 32px" },
] as const satisfies readonly BundledImageAsset[];

/** 번들 칩셋의 칸 수. 480칸 규격이 아닌 확장 시트(Tibo 실내 확장·합본 마을+레트로 월드맵)만 여기서 갈라진다. */
export function bundledChipsetFrameCount(key: string): number {
  if (key === "tex_atlas_cartography") return 136;
  if (key === 'tex_beodeul_warm_trees') return beodeulWarmTreesCatalog.count;
  if (key === "tex_beodeul_door") return 16;
  if (key === "tex_beodeul_ground") return beodeulGroundCatalog.count;
  if (key === 'tex_beodeul_architecture') return beodeulArchitectureCatalog.count;
  if (key === 'tex_beodeul_forms') return beodeulFormsCatalog.count;
  if (key === "tex_oprn_atlas_vehicles") return atlasVehicles.count;
  if (key === "tex_beodeul_city") return beodeulCitySheet.count;
  if (key === "tex_joseon_baram") return joseonBaramSheet.count;
  if (key === "tex_modern_city") return modernCitySheet.count;
  if (key === "tex_jp_city") return jpCitySheet.count;
  if (key === "tex_wizarding_world") return wizardingWorldSheet.count;
  const monsterKit = monsterKitSheet(key) ?? emeraldMonsterKitSheet(key);
  if (monsterKit) return monsterKit.count;
  if (key === "tex_worldmap_selected") return worldmapSelectedSheet.count;
  if (key === "tex_worldmap_authoring") return worldmapAuthoringSheet.count;
  if (key === "tex_atlas_biome_interior") return atlasBiomeInterior.count;
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
  ...BUNDLED_REFERENCE_CHIPSET_ASSETS,
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
export function loadBundledAssets(scene: { readonly load: Pick<Phaser.Loader.LoaderPlugin, "image" | "on"> }, project?: Project, options: { readonly onlyMapTilesets?: boolean } = {}): void {
  const usedTextures = project ? projectBundledTextureKeys(project) : null;
  loadUploadedTilesets(scene, project, options);
  loadUploadedEventSprites(scene, project, project ? collectPlayReferencedStrings(project) : undefined);
  scene.load.image(TEX_TILESET, withInlineAsset(ASSET_TILESET));
  for (const asset of BUNDLED_EASYRPG_CHIPSET_ASSETS) {
    if (usedTextures && !usedTextures.has(asset.textureKey)) continue;
    scene.load.image(chipsetLoadTextureKey(asset.textureKey), withInlineAsset(asset.path));
  }
  for (const asset of BUNDLED_REFERENCE_CHIPSET_ASSETS) {
    if (usedTextures && !usedTextures.has(asset.textureKey)) continue;
    scene.load.image(chipsetLoadTextureKey(asset.textureKey), withInlineAsset(asset.path));
  }
  for (const asset of BUNDLED_EASYRPG_CHARSET_ASSETS) {
    if (usedTextures && !usedTextures.has(asset.textureKey)) continue;
    scene.load.image(rawCharsetTextureKey(asset.textureKey), withInlineAsset(asset.path));
  }
  for (const asset of Object.values(project?.assets.uploaded ?? {})) {
    // 번들 캐릭셋과 같은 규약 — 원본은 raw 키로 싣고, asset.id 는 색상 키를 뺀 캔버스가 가진다.
    if (asset.kind === "charset") scene.load.image(rawCharsetTextureKey(asset.id), uploadedAssetUrl(asset));
    else if (asset.kind === "monster") scene.load.image(asset.id, uploadedAssetUrl(asset));
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
    const iconUrl = resolveCc0IconAssetUrl(id);
    const url = iconUrl ?? generatedMonsterSpriteUrl(id);
    if (url) scene.load.image(id, iconUrl ? withInlineAsset(url) : url);
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
    registerTileFrames(
      scene,
      asset.textureKey,
      bundledChipsetFrameCount(asset.textureKey),
      bundledChipsetTileSize(asset.textureKey),
      bundledChipsetTilesPerRow(asset.textureKey),
    );
  }
  for (const asset of BUNDLED_REFERENCE_CHIPSET_ASSETS) {
    if (usedTextures && !usedTextures.has(asset.textureKey)) continue;
    if (!scene.textures.exists(asset.textureKey)) {
      console.error(`[assets] ${asset.textureKey} 가 로드되지 않았습니다. 참고 이미지 파일을 확인하세요.`);
      continue;
    }
    registerTileFrames(scene, asset.textureKey, bundledChipsetFrameCount(asset.textureKey), bundledChipsetTileSize(asset.textureKey), bundledChipsetTilesPerRow(asset.textureKey));
  }
  registerTileAnimations(scene, [
    TEX_TILESET,
    ...BUNDLED_EASYRPG_CHIPSET_ASSETS
      .filter((asset) => !usedTextures || usedTextures.has(asset.textureKey))
      .map((asset) => asset.textureKey),
    ...BUNDLED_REFERENCE_CHIPSET_ASSETS
      .filter((asset) => !usedTextures || usedTextures.has(asset.textureKey))
      .map((asset) => asset.textureKey),
  ]);
  registerEasyRpgCharsetTextures(scene, usedTextures);
  registerUploadedCharsetTextures(scene, project);
  registerUploadedTilesets(scene, project);
  registerUploadedEventSpriteFrames(scene, project);
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
  tileSize = bundledChipsetTileSize(textureKey),
  tilesPerRow = bundledChipsetTilesPerRow(textureKey),
): void {
  registerTileFrames(
    scene,
    textureKey,
    frameCount,
    tileSize,
    tilesPerRow,
  );
  if (tileSize === TILE_SIZE) registerTileAnimationsForTexture(scene, textureKey);
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
    scene.load.image(rawKey, uploadedAssetUrl(asset));
  }
  if (queued.length === 0) return;
  scene.load.once("complete", () => {
    for (const rawKey of queued) inFlight.delete(rawKey);
    registerUploadedCharsetTextures(scene, project);
    onRegistered?.();
  });
  scene.load.start();
}

/** 씬별 진행 중인 번들 텍스처 로드 키. 같은 칩셋을 매 store 변경마다 다시 싣지 않기 위한 것. */
const bundledLoadsInFlight = new WeakMap<Phaser.Scene, Set<string>>();

/**
 * 실행 중인 씬에 **부팅 이후 쓰이기 시작한** 번들 칩셋·캐릭터셋·작물 그림을 뒤늦게 실어 준다.
 *
 * `loadBundledAssets` 는 preload 한 번뿐이고 그때 프로젝트가 쓰던 텍스처만 싣는다. 실측(2026-09-23):
 * 조수가 새 프로젝트 맵을 숲마을 칩셋으로 바꾸자 편집 캔버스 전체가 Phaser 의 "빠진 텍스처" 빗금으로
 * 그려졌다(`__MISSING tile_1141` 경고 수만 건). 새로고침해야 보이던 것이 이 함수로 그 자리에서 보인다.
 */
export function ensureBundledProjectTextures(
  scene: Phaser.Scene,
  project: Project,
  onRegistered?: () => void
): void {
  const used = projectBundledTextureKeys(project);
  const inFlight = bundledLoadsInFlight.get(scene) ?? new Set<string>();
  bundledLoadsInFlight.set(scene, inFlight);
  const chipsets: BundledImageAsset[] = [];
  const charsetKeys = new Set<string>();
  const cropIds = new Set<string>();
  const objectIds = new Set<string>();
  const queue = (loadKey: string, path: string): void => {
    inFlight.add(loadKey);
    scene.load.image(loadKey, withInlineAsset(path));
  };
  for (const asset of [...BUNDLED_EASYRPG_CHIPSET_ASSETS, ...BUNDLED_REFERENCE_CHIPSET_ASSETS]) {
    if (!used.has(asset.textureKey) || scene.textures.exists(asset.textureKey)) continue;
    const loadKey = chipsetLoadTextureKey(asset.textureKey);
    if (scene.textures.exists(loadKey) || inFlight.has(loadKey)) continue;
    queue(loadKey, asset.path);
    chipsets.push(asset);
  }
  for (const asset of BUNDLED_EASYRPG_CHARSET_ASSETS) {
    if (!used.has(asset.textureKey) || scene.textures.exists(asset.textureKey)) continue;
    const loadKey = rawCharsetTextureKey(asset.textureKey);
    if (scene.textures.exists(loadKey) || inFlight.has(loadKey)) continue;
    queue(loadKey, asset.path);
    charsetKeys.add(asset.textureKey);
  }
  for (const asset of FARMING_CROP_SPRITE_ASSETS) {
    if (!used.has(asset.id) || scene.textures.exists(asset.id) || inFlight.has(asset.id)) continue;
    queue(asset.id, asset.path);
    cropIds.add(asset.id);
  }
  for (const asset of CC0_ICON_ASSETS) {
    if (!used.has(asset.id) || project.assets.sprites[asset.id] || project.assets.uploaded[asset.id]
      || scene.textures.exists(asset.id) || inFlight.has(asset.id)) continue;
    queue(asset.id, asset.path);
    objectIds.add(asset.id);
  }
  if (chipsets.length === 0 && charsetKeys.size === 0 && cropIds.size === 0 && objectIds.size === 0) return;
  scene.load.once("complete", () => {
    for (const asset of chipsets) {
      inFlight.delete(chipsetLoadTextureKey(asset.textureKey));
      if (isColorKeyedChipsetTextureKey(asset.textureKey)) registerTransparentChipsetTexture(scene, asset);
      if (!scene.textures.exists(asset.textureKey)) continue;
      registerTilesetTextureFrames(scene, asset.textureKey, bundledChipsetFrameCount(asset.textureKey));
    }
    if (chipsets.length > 0) registerUploadedTilesets(scene, project);   // 늦게 실린 번들 시트의 저작 스트립
    for (const key of charsetKeys) inFlight.delete(rawCharsetTextureKey(key));
    for (const id of cropIds) inFlight.delete(id);
    for (const id of objectIds) inFlight.delete(id);
    if (charsetKeys.size > 0) registerEasyRpgCharsetTextures(scene, charsetKeys);
    if (cropIds.size > 0) registerFarmingCropFrames(scene, cropIds);
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
  const strings = collectPlayReferencedStrings(project);
  const keys = new Set<string>([TEX_TILESET, TEX_DIALOGUE_FRAME]);
  for (const id of strings) {
    if (isGeneratedMonsterSprite(id)) keys.add(id);
  }
  // 필드 스폰의 그림은 적 레코드에만 있고, 맵 이벤트는 부팅 뒤에 만들어진다.
  // 적 도감 전체의 monsterResourceId 는 여기서 다시 넣지 않는다.
  for (const id of fieldSpawnMonsterResourceIds(project)) {
    if (isGeneratedMonsterSprite(id)) keys.add(id);
  }
  for (const asset of BUNDLED_EASYRPG_CHIPSET_ASSETS) {
    if (strings.has(asset.textureKey)) keys.add(asset.textureKey);
  }
  for (const asset of BUNDLED_REFERENCE_CHIPSET_ASSETS) {
    if (strings.has(asset.textureKey)) keys.add(asset.textureKey);
  }
  for (const asset of BUNDLED_EASYRPG_CHARSET_ASSETS) {
    if (strings.has(asset.id) || strings.has(asset.textureKey)) keys.add(asset.textureKey);
  }
  // 탈것 그림은 system.vehicles 가 있으면 쓴다(id 만 저장하므로 문자열 수집에 안 걸린다).
  if (project.system.vehicles?.length) keys.add(VEHICLE_CHARSET_TEXTURE_KEY);
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
  const objectIds = spatialGraphicResourceIds(project);
  for (const map of Object.values(project.maps)) {
    for (const event of map.events) {
      if (event.sprite?.id) objectIds.add(event.sprite.id);
      for (const page of event.pages ?? []) if (page.graphic.sprite?.id) objectIds.add(page.graphic.sprite.id);
    }
  }
  for (const asset of EASYRPG_PICTURE_ASSETS) {
    if (objectIds.has(asset.id)) keys.add(asset.id);
  }
  for (const asset of CC0_ICON_ASSETS) {
    if (objectIds.has(asset.id)) keys.add(asset.id);
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
  collectPlayStrings(value, out, "");
}

/**
 * 플레이 부팅이 실제로 읽는 문자열.
 * 리소스 프로필과, 어떤 맵도 가리키지 않는 타일셋 카탈로그는 제외한다.
 */
export function collectPlayReferencedStrings(project: Project): Set<string> {
  const strings = new Set<string>();
  collectProjectStrings({ ...project, resourceProfiles: [], tilesets: {} }, strings);
  for (const tileset of Object.values(project.tilesets)) {
    if (!strings.has(tileset.id)) continue;
    collectProjectStrings(tileset, strings);
  }
  return strings;
}

function collectPlayStrings(value: unknown, out: Set<string>, key: string): void {
  // 적·종족 도감의 필드 그림 id. 전투 초상은 전투 DOM 이 그때 받고,
  // 맵에 깔린 스폰만 fieldSpawnMonsterResourceIds 가 다시 넣는다.
  if (key === "monsterResourceId" || key === "uploaded") return;
  if (typeof value === "string") {
    out.add(value);
    return;
  }
  if (Array.isArray(value)) {
    for (const item of value) collectPlayStrings(item, out, key);
    return;
  }
  if (typeof value !== "object" || value === null) return;
  for (const [childKey, child] of Object.entries(value)) {
    collectPlayStrings(child, out, childKey);
  }
}

/** defaultFieldSpawnGraphic 과 같은 적 선택. 이벤트 생성 전에 그 그림만 미리 싣는다. */
function fieldSpawnMonsterResourceIds(project: Project): readonly string[] {
  const ids: string[] = [];
  for (const map of Object.values(project.maps)) {
    for (const spawn of map.fieldSpawns ?? []) {
      const troop = project.database.troops.find((entry) => entry.id === spawn.troopId);
      const firstEnemyId = troop?.members?.find((member) => member.hidden !== true)?.enemyId ?? troop?.enemyIds?.[0];
      const resourceId = project.database.enemies.find((enemy) => enemy.id === firstEnemyId)?.monsterResourceId;
      if (resourceId) ids.push(resourceId);
    }
  }
  return ids;
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

function registerTileFrames(
  scene: Phaser.Scene,
  textureKey: string,
  frameCount: number = TILE_FRAME_COUNT,
  tileSize = bundledChipsetTileSize(textureKey),
  tilesPerRow = bundledChipsetTilesPerRow(textureKey),
): void {
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
    const { sx, sy } = tileSourceXY(i, tilesPerRow, tileSize);
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
  if (
    textureKey === CASTLE_TILESET_TEXTURE_KEY ||
    textureKey.startsWith(`${CASTLE_TILESET_TEXTURE_KEY}__`) ||
    textureKey === CASTLE_REFERENCE_TILESET_TEXTURE_KEY ||
    textureKey === LPC_WOODEN_FURNITURE_TILESET_TEXTURE_KEY ||
    textureKey === LPC_WOODEN_FURNITURE_16_TEXTURE_KEY
  ) return;
  const texture = scene.textures.get(textureKey);
  for (const strip of CHIPSET_ANIMATION_STRIPS) {
    // 물·폭포 스트립은 EasyRPG 480칸 배치(최대 tile_214)를 전제한다. 그보다 작은 부품 시트
    // (선별 소품 84칸·마을 부품 180칸·나무 윗단 180칸·잔디 사선 10칸)는 그 프레임을 등록하지 않으므로
    // 만들면 Phaser 가 'has no frame' 경고를 스트립마다 낸다. 실측 2026-09-26: 새 프로젝트에서 약 400건.
    if (!strip.frames.every((frame) => texture.has(`tile_${frame}`))) continue;
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

export function tileSourceXY(index: number, tilesPerRow: number = TILES_PER_ROW, tileSize: number = TILE_SIZE): { sx: number; sy: number } {
  if (index < 0) return { sx: 0, sy: 0 };
  const col = index % tilesPerRow;
  const row = Math.floor(index / tilesPerRow);
  return { sx: col * tileSize, sy: row * tileSize };
}

export function spriteFrameIndex(dir: number, frm: number): number {
  return dir * SPRITE_COLS + frm;
}
