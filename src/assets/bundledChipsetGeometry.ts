import { monsterKitSheet } from "./monsterKitAssets";
import { RESOURCE_SLICING } from "./resourceSlicing";
import beodeulCitySheet from "./beodeulCitySheet.json";
import joseonBaramSheet from "./joseonBaramSheet.json";
import modernCitySheet from "./modernCitySheet.json";
import jpCitySheet from "./jpCitySheet.json";
import wizardingWorldSheet from "./wizardingWorldSheet.json";
import pirateIslesSheet from "./pirateIslesSheet.json";
import sengokuEdoSheet from "./sengokuEdoSheet.json";
import skyIslandSheet from "./skyIslandSheet.json";
import beodeulWavePlacesSheet from "./beodeulWavePlacesSheet.json";
import steampunkCitySheet from "./steampunkCitySheet.json";
import modernCampusSheet from "./modernCampusSheet.json";
import sfStationSheet from "./sfStationSheet.json";
import wastelandRuinsSheet from "./wastelandRuinsSheet.json";
import gothicManorSheet from "./gothicManorSheet.json";
import prehistoricSheet from "./prehistoricSheet.json";
import desertEastSheet from "./desertEastSheet.json";
import snowNorthSheet from "./snowNorthSheet.json";
import atlasBiomeInteriorSheet from "./atlasBiomeInteriorSheet.json";
import { emeraldMonsterKitSheet } from "./emeraldMonsterKitAssets";
import {
  CASTLE_REFERENCE_TILESET_TEXTURE_KEY,
  CASTLE_REFERENCE_TILE_SIZE,
  CASTLE_REFERENCE_TILES_PER_ROW,
  CASTLE_TILESET_TEXTURE_KEY,
  CASTLE_TILES_PER_ROW,
  CASTLE_TILE_SIZE,
  LPC_WOODEN_FURNITURE_16_TILE_SIZE,
  LPC_WOODEN_FURNITURE_16_TILES_PER_ROW,
  LPC_WOODEN_FURNITURE_16_TEXTURE_KEY,
  LPC_WOODEN_FURNITURE_TILE_SIZE,
  LPC_WOODEN_FURNITURE_TILES_PER_ROW,
  LPC_WOODEN_FURNITURE_TILESET_TEXTURE_KEY,
} from "@/project/defaults/constants";

/** Source atlas geometry, shared by frame registration, previews and tile grafts. */
/**
 * 방 짓기 역할표 변형 칸 시트(src/project/roomKit.ts) — id `roomkit_<칸 크기>_<해시>`, 줄마다 16칸. 칩셋 칸 크기를 그대로 쓴다.
 * 스토어에서 넣으면 id 앞에 `store_<slug>__` 가 붙는다(assetStore/format.ts storeProjectId).
 */
const ROOM_KIT_KEY = /^(?:store_[A-Za-z0-9_]+__)?roomkit_(16|24|32|48)_/u;

export function bundledChipsetTileSize(key: string): number {
  const roomKit = ROOM_KIT_KEY.exec(key);
  if (roomKit) return Number(roomKit[1]);
  if (key === "tex_slates_32" || key === "tex_atlas_cartography") return 32;
  if (key === CASTLE_TILESET_TEXTURE_KEY) return CASTLE_TILE_SIZE;
  if (key === CASTLE_REFERENCE_TILESET_TEXTURE_KEY) return CASTLE_REFERENCE_TILE_SIZE;
  if (key === LPC_WOODEN_FURNITURE_TILESET_TEXTURE_KEY) return LPC_WOODEN_FURNITURE_TILE_SIZE;
  if (key === LPC_WOODEN_FURNITURE_16_TEXTURE_KEY) return LPC_WOODEN_FURNITURE_16_TILE_SIZE;
  return RESOURCE_SLICING.chipset.cellWidth;
}

export function bundledChipsetTilesPerRow(key: string): number {
  if (ROOM_KIT_KEY.test(key)) return 16;
  if (key === "tex_worldmap_authoring") return 12;
  if (key === "tex_atlas_cartography") return 8;
  if (key === 'tex_beodeul_warm_trees') return 8;
  if (key === "tex_beodeul_door") return 8;
  if (key === "tex_beodeul_ground") return 8;
  if (key === "tex_beodeul_forest_trunks") return 16;
  if (key === "tex_beodeul_nature") return 16;
  if (key === 'tex_beodeul_architecture') return 16;
  if (key === 'tex_beodeul_forms') return 16;
  if (key === 'tex_beodeul_reviewed') return 16;
  if (key === 'tex_beodeul_massing') return 16;
  if (key === 'tex_beodeul_organic') return 16;
  if (key === "tex_forest_harmony_grass_joins") return 10;
  if (key === "tex_shared_forest_village_objects") return 6;
  if (key === "tex_slates_32") return 56;
  if (key === "tex_beodeul_city") return beodeulCitySheet.tilesPerRow;
  if (key === "tex_joseon_baram") return joseonBaramSheet.tilesPerRow;
  if (key === "tex_modern_city") return modernCitySheet.tilesPerRow;
  if (key === "tex_jp_city") return jpCitySheet.tilesPerRow;
  if (key === "tex_wizarding_world") return wizardingWorldSheet.tilesPerRow;
  if (key === "tex_pirate_isles") return pirateIslesSheet.tilesPerRow;
  if (key === "tex_sengoku_edo") return sengokuEdoSheet.tilesPerRow;
  if (key === "tex_sky_island") return skyIslandSheet.tilesPerRow;
  if (key === "tex_beodeul_wave_places") return beodeulWavePlacesSheet.tilesPerRow;
  if (key === "tex_steampunk_city") return steampunkCitySheet.tilesPerRow;
  if (key === "tex_modern_campus") return modernCampusSheet.tilesPerRow;
  if (key === "tex_sf_station") return sfStationSheet.tilesPerRow;
  if (key === "tex_wasteland_ruins") return wastelandRuinsSheet.tilesPerRow;
  if (key === "tex_gothic_manor") return gothicManorSheet.tilesPerRow;
  if (key === "tex_prehistoric") return prehistoricSheet.tilesPerRow;
  if (key === "tex_desert_east") return desertEastSheet.tilesPerRow;
  if (key === "tex_snow_north") return snowNorthSheet.tilesPerRow;
  if (key === "tex_atlas_biome_interior") return atlasBiomeInteriorSheet.tilesPerRow;
  const monsterKit = monsterKitSheet(key) ?? emeraldMonsterKitSheet(key);
  if (monsterKit) return monsterKit.tilesPerRow;
  if (key === CASTLE_TILESET_TEXTURE_KEY) return CASTLE_TILES_PER_ROW;
  if (key === CASTLE_REFERENCE_TILESET_TEXTURE_KEY) return CASTLE_REFERENCE_TILES_PER_ROW;
  if (key === LPC_WOODEN_FURNITURE_TILESET_TEXTURE_KEY) return LPC_WOODEN_FURNITURE_TILES_PER_ROW;
  if (key === LPC_WOODEN_FURNITURE_16_TEXTURE_KEY) return LPC_WOODEN_FURNITURE_16_TILES_PER_ROW;
  return RESOURCE_SLICING.chipset.columns;
}
