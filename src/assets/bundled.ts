import { loadUploadedEventSprites, registerUploadedEventSpriteFrames } from "./uploadedEventSprites";
import sharedVillageObjects from "./sharedVillageObjects.json";
import { uploadedAssetUrl } from "@/project/persistence/assetAccessors";
import forestHarmony from "./forestHarmonyTileset.json";
import forestHarmonyHouseParts from "./forestHarmonyHouseParts.json";
import forestHarmonyTreetopParts from "./forestHarmonyTreetopParts.json";
import atlasVehicles from "./atlasVehiclesTileset.json";
import forestHarmonyAtlasTownParts from "./forestHarmonyAtlasTownParts.json";
import forestHarmonyTreeShadows from "./forestHarmonyTreeShadows.json";
import climateSheets from "../../tiledata/climate-villages/sheets.json";
import atlasBiomeSheets from "./atlasBiomeSheets.json";
import beodeulCitySheet from "./beodeulCitySheet.json";
import joseonBaramSheet from "./joseonBaramSheet.json";
import modernCitySheet from "./modernCitySheet.json";
import jpCitySheet from "./jpCitySheet.json";
import worldmapSelectedSheet from "./worldmapSelectedSheet.json";
import tiboRecovered from "./tiboRecoveredTileset.json";
import atlasBiomeInterior from "./atlasBiomeInteriorSheet.json";
import atlasBiomeDungeon from "./atlasBiomeDungeonSheet.json";
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
  CASTLE_TILE_COUNT,
  CASTLE_TILESET_NAME,
  CASTLE_TILESET_TEXTURE_KEY,
  CASTLE_REFERENCE_TILE_COUNT,
  CASTLE_REFERENCE_TILESET_TEXTURE_KEY,
  COMBINED_TOWN_RETRO_WORLD_NAME,
  COMBINED_TOWN_RETRO_WORLD_TEXTURE_KEY,
  COMBINED_TOWN_RETRO_WORLD_TILE_COUNT,
  LPC_WOODEN_FURNITURE_16_NAME,
  LPC_WOODEN_FURNITURE_16_TEXTURE_KEY,
  LPC_WOODEN_FURNITURE_16_TILE_COUNT,
  LPC_WOODEN_FURNITURE_TILE_COUNT,
  LPC_WOODEN_FURNITURE_TILESET_TEXTURE_KEY,
} from "@/project/defaults/constants";
import { CHARSET_ASSETS } from "@/assets/charsetCatalog";
import { VEHICLE_CHARSET_TEXTURE_KEY } from "@/project/vehicles";
import { EASYRPG_PICTURE_ASSETS } from "@/assets/easyrpgRtp";
import { FARMING_CROP_SPRITE_ASSETS } from "@/assets/farmingSprites";
import { generatedMonsterSpriteUrl, isGeneratedMonsterSprite } from "@/assets/generatedMonsterSprites";
import { cropGraphicStages } from "@/project/farmModel";
import { SCARLOXY_CHIPSET_ASSETS } from "@/assets/scarloxyPack";
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

export const FOREST_FANTASY_TOWN_TEXTURE_KEY = "tex_forest_harmony_fantasy_town";
/** 480×1168 시트 = 30열 × 73줄. */
const FOREST_FANTASY_TOWN_FRAME_COUNT = 2190;

/** The reference composite is loaded only by projects that explicitly use its board tileset. */
export const BUNDLED_REFERENCE_CHIPSET_ASSETS = [
  { textureKey: "tex_forest_cliff_reference", path: "assets/region-references/forest-cliff-village-atlas.png", name: "굽이숲 절벽마을 · 숲 조립 참조" },
  { textureKey: CASTLE_REFERENCE_TILESET_TEXTURE_KEY, path: "assets/opengameart-castle-reference-composite.png", name: "성채 참고 이미지 · 큰 돌다리 제거" },
  // 장소 「개울 건너 숲성 마을」의 생성 건물(설계도 방식)·손 도트 소품 시트. 숲마을 타일셋이 tileGrafts 로 뒤에 붙인다.
  // 재생성: scripts/asset-gen/forest-harmony-buildings/publish_place.py
  { textureKey: FOREST_FANTASY_TOWN_TEXTURE_KEY, path: "assets/forest-harmony/fantasy-town-buildings.png", name: "개울 건너 숲성 마을 · 생성 건물·소품" },
  // 집 부품(굴뚝·지붕창·현관 차양·박공 꼭대기 장식) 손 도트 시트 — forest_harmony 가 tileGrafts 로 3060~ 에 붙인다.
  // 재생성: scripts/content/build-forest-harmony-house-parts.py, 정의는 project/defaults/forestHarmonyHouseParts.ts.
  { textureKey: "tex_forest_harmony_house_parts", path: "assets/forest-harmony/house-parts.png", name: "숲마을 · 집 부품" },
  // 나무 위 마을(데크·밧줄 다리·줄기 집·사다리·등불·깊은 숲) 손 도트 시트 — forest_harmony 가 tileGrafts 로 3131~ 에 붙인다.
  // 재생성: scripts/content/elf-treetop.py, 정의는 project/defaults/forestHarmonyTreetopParts.ts.
  { textureKey: "tex_forest_harmony_treetop_parts", path: "assets/forest-harmony/treetop-parts.png", name: "숲마을 · 나무 위 마을" },
  // 마을·도시 부품(범선·분수·차양 노점·불길·비계·축제 등롱·온천 김·가죽 천막·토템) — forest_harmony 가 tileGrafts 로 3311~ 에 붙인다.
  // 재생성: scripts/content/bake-atlas-town-parts.py, 정의는 project/defaults/forestHarmonyAtlasTownParts.ts. 범선은 EasyRPG 배 칩셋(CC0).
  { textureKey: "tex_forest_harmony_atlas_town_parts", path: "assets/forest-harmony/atlas-town-parts.png", name: "숲마을 · 마을·도시 부품" },
  // 나무 밑 그림자(밑동 칸 투명부·발치 칸의 숲 그늘) — forest_harmony 가 tileGrafts 로 3611~ 에 붙인다.
  // 재생성: scripts/content/bake-forest-harmony-tree-shadows.py, 정의는 project/defaults/forestHarmonyTreeShadows.ts.
  { textureKey: "tex_forest_harmony_tree_shadows", path: "assets/forest-harmony/tree-shadows.png", name: "숲마을 · 나무 밑 그림자" },
  // 던전 칩셋을 칸 번호 그대로 다시 칠한 네 장(scripts/content/build-rpg-dungeon-sheets.py) — 던전 장소(tiledata/rpg-dungeons) 사본만 쓴다.
  { textureKey: "tex_oprn_dungeon_desert", path: "assets/rpg-dungeons/desert-chipset.png", name: "던전 · 사암 피라미드 (재칠)" },
  { textureKey: "tex_oprn_dungeon_sea", path: "assets/rpg-dungeons/sea-chipset.png", name: "던전 · 해저 동굴 (재칠)" },
  { textureKey: "tex_oprn_dungeon_lair", path: "assets/rpg-dungeons/lair-chipset.png", name: "던전 · 용의 둥지 (재칠)" },
  { textureKey: "tex_oprn_dungeon_cave", path: "assets/rpg-dungeons/cave-chipset.png", name: "던전 · 동굴 물웅덩이 (재칠)" },
  // 아틀라스 던전(tiledata/atlas-dungeons, scripts/content/build-atlas-dungeon-sheets.py): 던전 가족 타일셋이 510~ 에 이식하는 조각 시트(EasyRPG 실내·배 사본, 재칠 수정·불, 직접 그린 관·거미줄·함정·장치)
  // 와 던전 칩셋을 칸 번호 그대로 다시 칠하거나 형제 EasyRPG 시트의 오토타일 블록을 옮겨 넣은 열세 장.
  { textureKey: "tex_oprn_dungeon_parts", path: "assets/atlas-dungeons/parts.png", name: "던전 조각 · 아틀라스 이식 시트" },
  { textureKey: "tex_oprn_dungeon_ghostship", path: "assets/atlas-dungeons/ghostship-chipset.png", name: "던전 · 유령선 (배 시트 선실 벽·갑판·구멍, 재칠)" },
  { textureKey: "tex_oprn_dungeon_manor", path: "assets/atlas-dungeons/manor-chipset.png", name: "던전 · 유령 저택 (실내 시트 벽지·마루·카펫, 재칠)" },
  { textureKey: "tex_oprn_dungeon_lab", path: "assets/atlas-dungeons/lab-chipset.png", name: "던전 · 비밀 연구소 (밝은 벽돌·석재 바닥, 재칠)" },
  { textureKey: "tex_oprn_dungeon_wind", path: "assets/atlas-dungeons/wind-chipset.png", name: "던전 · 바람의 신전 (옥빛 대리석, 재칠)" },
  { textureKey: "tex_oprn_dungeon_tide", path: "assets/atlas-dungeons/tide-chipset.png", name: "던전 · 물의 신전 (청백 대리석, 재칠)" },
  { textureKey: "tex_oprn_dungeon_earth", path: "assets/atlas-dungeons/earth-chipset.png", name: "던전 · 땅의 신전 (황토 사암·이끼, 재칠)" },
  { textureKey: "tex_oprn_dungeon_fire", path: "assets/atlas-dungeons/fire-chipset.png", name: "던전 · 불의 신전 (검붉은 현무암, 재칠)" },
  { textureKey: "tex_oprn_dungeon_sky", path: "assets/atlas-dungeons/sky-chipset.png", name: "던전 · 하늘 탑 (흰 대리석·금, 바깥은 하늘)" },
  { textureKey: "tex_oprn_dungeon_trial", path: "assets/atlas-dungeons/trial-chipset.png", name: "던전 · 시련의 탑 (흑요석·보랏빛, 재칠)" },
  { textureKey: "tex_oprn_dungeon_dream", path: "assets/atlas-dungeons/dream-chipset.png", name: "던전 · 꿈 세계 (연보라 몽환, 별 뜬 공허)" },
  { textureKey: "tex_oprn_dungeon_spider", path: "assets/atlas-dungeons/spider-chipset.png", name: "던전 · 거미 소굴 (잿빛 동굴, 재칠)" },
  { textureKey: "tex_oprn_dungeon_ruins", path: "assets/atlas-dungeons/ruins-chipset.png", name: "던전 · 고대 유적 (녹슨 청동·이끼 사암, 재칠)" },
  { textureKey: "tex_oprn_dungeon_abyss", path: "assets/atlas-dungeons/abyss-chipset.png", name: "던전 · 심연 (흑금, 보너스 던전)" },
] as const satisfies readonly BundledImageAsset[];

export const BUNDLED_EASYRPG_CHIPSET_ASSETS = [
  {textureKey:"tex_shared_forest_village_objects",path:"assets/shared-village/objects.png",name:"숲마을 · 선별 소품 19종"},
  {textureKey:"tex_forest_harmony",path:"assets/forest-harmony/chipset.png",name:"숲마을 · 거리별 잔디"},
  {textureKey:"tex_forest_harmony_grass_joins",path:"assets/forest-harmony/grass-joins.png",name:"숲마을 · 잔디 사선 경계"},
  // 숲마을(이식 포함)을 한 장으로 구워 기후별로 다시 칠한 시트 — scripts/content/build-climate-chipsets.py, 정의는 defaults/climateVillages.ts.
  {textureKey:"tex_forest_harmony_snow",path:"assets/climate-villages/snow-chipset.png",name:"설원 마을 · 눈 덮인 숲마을"},
  {textureKey:"tex_forest_harmony_volcano",path:"assets/climate-villages/volcano-chipset.png",name:"화산 마을 · 재와 용암의 숲마을"},
  {textureKey:"tex_forest_harmony_desert",path:"assets/climate-villages/desert-chipset.png",name:"사막 마을 · 모래와 사암의 숲마을"},
  {textureKey:"tex_forest_harmony_autumn",path:"assets/climate-villages/autumn-chipset.png",name:"가을 마을 · 단풍 든 숲마을"},
  // 바이옴 시트 11장(tiledata/atlas-biomes) — 숲마을(이식 포함)을 바이옴별로 다시 칠하고 바이옴 그림(3030~)을 손 도트로 붙였다.
  // 그림은 scripts/content/build-atlas-biome-chipsets.py, 정의는 defaults/atlasBiomes.ts.
  {textureKey:"tex_atlas_biome_jungle",path:"assets/atlas-biomes/jungle-chipset.png",name:"정글 · 열대우림 (바이옴)"},
  {textureKey:"tex_atlas_biome_swamp",path:"assets/atlas-biomes/swamp-chipset.png",name:"늪 · 맹그로브 습지 (바이옴)"},
  {textureKey:"tex_atlas_biome_mushroom",path:"assets/atlas-biomes/mushroom-chipset.png",name:"버섯 숲 · 푸른 이끼 골짜기 (바이옴)"},
  {textureKey:"tex_atlas_biome_crystal",path:"assets/atlas-biomes/crystal-chipset.png",name:"수정 평원 · 빛나는 돌밭 (바이옴)"},
  {textureKey:"tex_atlas_biome_badlands",path:"assets/atlas-biomes/badlands-chipset.png",name:"황무지 · 붉은 협곡 (바이옴)"},
  {textureKey:"tex_atlas_biome_savanna",path:"assets/atlas-biomes/savanna-chipset.png",name:"사바나 · 금빛 초원 (바이옴)"},
  {textureKey:"tex_atlas_biome_taiga",path:"assets/atlas-biomes/taiga-chipset.png",name:"타이가 · 눈 덮인 침엽수림 (바이옴)"},
  {textureKey:"tex_atlas_biome_tundra",path:"assets/atlas-biomes/tundra-chipset.png",name:"툰드라 · 이끼 언 들 (바이옴)"},
  {textureKey:"tex_atlas_biome_blight",path:"assets/atlas-biomes/blight-chipset.png",name:"오염된 땅 · 어둠의 숲 (바이옴)"},
  {textureKey:"tex_atlas_biome_skyisle",path:"assets/atlas-biomes/skyisle-chipset.png",name:"하늘섬 · 구름 위 떠 있는 섬 (바이옴)"},
  {textureKey:"tex_atlas_biome_tropical",path:"assets/atlas-biomes/tropical-chipset.png",name:"열대 섬 · 산호 해안 (바이옴)"},
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
  // 바이옴 월드맵 시트 — EasyRPG 월드 시트(0~479 그대로) + 새 바이옴 지형 블록 10개·아이콘. build-atlas-biome-world.py, defaults/atlasBiomeWorld.ts.
  {textureKey:"tex_atlas_biome_world",path:"assets/atlas-biomes/world-chipset.png",name:"월드맵 · 바이옴 확장 (OPRN)"},
  {textureKey:"tex_worldmap_selected",path:"assets/worldmap-icons/worldmap-selected.png",name:"월드맵 · 사람 선택 아이콘"},
  {textureKey:"tex_tibo_interior_expanded",path:"assets/tibo-interior/interior-expanded.png",name:"실내 확장 · Tibo"},
  // 생성 칩셋(oprn-atlas) 공용 실내 — 손 도트 실내 v5 전용 시트(tiledata/hand-interior/v5, 가구·바닥·벽·천장·자동 타일·예제 26맵).
  // 그림·정의는 scripts/content/hand-interior/build_tileset.py, 정의 모듈은 project/defaults/atlasBiomeInterior.ts.
  {textureKey:"tex_atlas_biome_interior",path:"assets/atlas-interior/interior-chipset.png",name:"실내 · 손 도트 v5 (아틀라스)"},
  // 생성 칩셋 공용 배·던전 — 옛 atlas_biome_interior 의 배·던전 블록을 떼어 낸 것(scripts/content/atlas-dungeon/split-dungeon.mjs).
  {textureKey:"tex_atlas_biome_dungeon",path:"assets/atlas-interior/dungeon-chipset.png",name:"배·던전 · 생성 칩셋 공용 (아틀라스)"},
  { textureKey: CASTLE_TILESET_TEXTURE_KEY, path: "assets/opengameart-castle-tiles.png", name: CASTLE_TILESET_NAME },
  { textureKey: "tex_easyrpg_chipset_dungeon", path: "assets/easyrpg-chipset-dungeon-transparent.png", name: "던전 · EasyRPG (CC0)" },
  { textureKey: "tex_easyrpg_chipset_interior", path: "assets/easyrpg-chipset-interior-transparent.png", name: "실내 · EasyRPG (CC0)" },
  { textureKey: "tex_easyrpg_chipset_ship", path: "assets/easyrpg-chipset-ship-transparent.png", name: "배 · EasyRPG (CC0)" },
  // Harbor pieces for forest-village harbors (LPC rowboat CC-BY-SA 3.0 + EasyRPG ship tiles CC0) — assets/harbor-kit/CREDITS.txt.
  { textureKey: "tex_harbor_kit", path: "assets/harbor-kit/harbor-kit.png", name: "항구 조각 · 나룻배·계류 말뚝 (LPC CC-BY-SA · EasyRPG CC0)" },
  // 탈것·장면 조각(배·비공정·마차·축제·처형대·하늘) — EasyRPG 배 시트(CC0) 결로 찍은 손 도트. 정의는 project/defaults/atlasVehicles.ts,
  // 재생성: scripts/content/atlas-scenes/build_vehicles.py + register-vehicles.mjs. 출처 assets/atlas-scenes/CREDITS.txt.
  { textureKey: "tex_oprn_atlas_vehicles", path: "assets/atlas-scenes/vehicles.png", name: "탈것·장면 조각 · 배·비공정·마차·축제 (EasyRPG 배 시트 CC0 + 손 도트)" },
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
  { textureKey: LPC_WOODEN_FURNITURE_TILESET_TEXTURE_KEY, path: "assets/opengameart-lpc-wooden-furniture.png", name: "LPC 나무 가구 · OpenGameArt (CC-BY-SA 3.0)" },
  { textureKey: LPC_WOODEN_FURNITURE_16_TEXTURE_KEY, path: "assets/opengameart-lpc-wooden-furniture-16px.png", name: LPC_WOODEN_FURNITURE_16_NAME },
  ...SCARLOXY_CHIPSET_ASSETS,
] as const satisfies readonly BundledImageAsset[];

/** 번들 칩셋의 칸 수. 480칸 규격이 아닌 확장 시트(Tibo 실내 확장·합본 마을+레트로 월드맵)만 여기서 갈라진다. */
export function bundledChipsetFrameCount(key: string): number {
  if (key === CASTLE_TILESET_TEXTURE_KEY) return CASTLE_TILE_COUNT;
  if (key === CASTLE_REFERENCE_TILESET_TEXTURE_KEY) return CASTLE_REFERENCE_TILE_COUNT;
  if (key === "tex_forest_cliff_reference") return 2640;
  if (key === FOREST_FANTASY_TOWN_TEXTURE_KEY) return FOREST_FANTASY_TOWN_FRAME_COUNT;
  if (key === "tex_shared_forest_village_objects") return sharedVillageObjects.count;
  if (key === "tex_forest_harmony") return forestHarmony.count;
  if (key === "tex_forest_harmony_house_parts") return forestHarmonyHouseParts.frames;
  if (key === "tex_forest_harmony_treetop_parts") return forestHarmonyTreetopParts.frames;
  if (key === "tex_oprn_atlas_vehicles") return atlasVehicles.count;
  if (key === "tex_forest_harmony_atlas_town_parts") return forestHarmonyAtlasTownParts.frames;
  if (key === "tex_forest_harmony_tree_shadows") return forestHarmonyTreeShadows.frames;
  if (key === "tex_forest_harmony_grass_joins") return 10;
  if (key === "tex_forest_harmony_snow") return climateSheets.snow.count;
  if (key === "tex_forest_harmony_volcano") return climateSheets.volcano.count;
  if (key === "tex_forest_harmony_desert") return climateSheets.desert.count;
  if (key === "tex_forest_harmony_autumn") return climateSheets.autumn.count;
  if (key in atlasBiomeSheets) return (atlasBiomeSheets as Record<string, number>)[key]!;
  if (key === "tex_beodeul_city") return beodeulCitySheet.count;
  if (key === "tex_joseon_baram") return joseonBaramSheet.count;
  if (key === "tex_modern_city") return modernCitySheet.count;
  if (key === "tex_jp_city") return jpCitySheet.count;
  if (key === "tex_worldmap_selected") return worldmapSelectedSheet.count;
  if (key === "tex_tibo_interior_expanded") return tiboRecovered.count;
  if (key === "tex_atlas_biome_interior") return atlasBiomeInterior.count;
  if (key === "tex_atlas_biome_dungeon") return atlasBiomeDungeon.count;
  if (key === SLATES_32_TEXTURE_KEY) return SLATES_32_FRAME_COUNT;
  if (key === COMBINED_TOWN_RETRO_WORLD_TEXTURE_KEY) return COMBINED_TOWN_RETRO_WORLD_TILE_COUNT;
  if (key === LPC_WOODEN_FURNITURE_TILESET_TEXTURE_KEY) return LPC_WOODEN_FURNITURE_TILE_COUNT;
  if (key === LPC_WOODEN_FURNITURE_16_TEXTURE_KEY) return LPC_WOODEN_FURNITURE_16_TILE_COUNT;
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
  if (chipsets.length === 0 && charsetKeys.size === 0 && cropIds.size === 0) return;
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
