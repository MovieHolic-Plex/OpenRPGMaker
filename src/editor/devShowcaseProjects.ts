import {
  createBlankProject,
  createDbExtractedHouseTemplateProject,
  createHouseTemplateGalleryProject,
  createLogCabinShowcaseProject,
  createMarketTownProject,
  createRetroHouseShowcaseProject,
  createSampleAdventureProject,
  createScarloxyDemoProject,
  createScarloxyPokemonDemoProject,
  createShopShowcaseProject,
  createSmallHouseVariantProject,
  createSnowMountain60Project,
  createIcePlain64Project,
  createTownArchitectureCityProject,
  createTownArchitectureTestProject,
  createTownCityShowcaseProject,
  createTownHouseShowcaseProject,
  type SmallHouseVariantIndex,
  type TownHouseShowcaseStyle,
} from "@/project/defaults";
import { createVillageShoppingStreetProject } from "@/editor/content/villageShoppingStreetProject";
import { createModernNocturneProject } from "@/project/defaults/modernNocturneGame";
import type { Project } from "@/project/types";

const DEV_FRESH_PROJECT_PARAM = "freshProject";
const DEV_BLANK_PROJECT_PARAM = "blankProject";
const DEV_PROJECT_PARAM = "devProject";
const DEV_SAMPLE_ADVENTURE_PARAM = "sampleAdventure";
const DEV_DEFAULT_ADVENTURE_PARAM = "defaultAdventure";
const DEV_DEFAULT_ADVENTURE_VISUAL_PARAM = "defaultAdventureVisual";
const DEV_LOG_CABIN_SHOWCASE_PARAM = "logCabinShowcase";
const DEV_RETRO_HOUSE_SHOWCASE_PARAM = "retroHouseShowcase";
const DEV_TOWN_HOUSE_SHOWCASE_PARAM = "townHouseShowcase";
const DEV_TOWN_CITY_SHOWCASE_PARAM = "townCityShowcase";
const DEV_TOWN_ARCHITECTURE_CITY_PARAM = "townArchitectureCity";
const DEV_TOWN_ARCHITECTURE_TEST_PARAM = "townArchitectureTest";
const DEV_DB_EXTRACTED_HOUSE_TEMPLATE_PARAM = "dbExtractedHouseTemplate";
const DEV_SMALL_HOUSE_VARIANT_PARAM = "smallHouseVariant";
const DEV_HOUSE_TEMPLATE_GALLERY_PARAM = "houseTemplateGallery";
const DEV_SHOP_SHOWCASE_PARAM = "shopShowcase";
const DEV_MARKET_TOWN_PARAM = "marketTown";
const DEV_VILLAGE_SHOPPING_STREET_PARAM = "villageShoppingStreet";
/** 설산 60×60 절벽·계단 캔버스 — `?devProject=1&snowMountain60=1` 로 바로 열린다. */
const DEV_SNOW_MOUNTAIN_60_PARAM = "snowMountain60";
/** 얼음 대평원 64×64 절벽·계단 캔버스 — `?devProject=1&icePlain64=1` 로 바로 열린다. */
const DEV_ICE_PLAIN_64_PARAM = "icePlain64";
const DEV_MODERN_NOCTURNE_PARAM = "modernNocturne";
const SUPABASE_CANONICAL_PROJECT_PARAM = "supabaseRecovered";

export function createDevShowcaseProjectForLocation(): Project | null {
  if (typeof window === "undefined") return null;
  if (!isLocalDevHost(window.location.hostname)) return null;
  const e2eProject = createE2eProjectForLocation();
  if (e2eProject) return e2eProject;
  const params = new URLSearchParams(window.location.search);
  if (params.has(SUPABASE_CANONICAL_PROJECT_PARAM)) return null;
  // 계약: blankProject=1 → 진짜 빈 프로젝트. freshProject=1 단독은 기존 e2e/드라이버
  // 32개 스펙이 예제 어드벤처를 기대하므로 레거시 의미를 유지한다.
  if (params.has(DEV_BLANK_PROJECT_PARAM)) return createBlankProject();
  if (params.has(DEV_FRESH_PROJECT_PARAM)) return createSampleAdventureProject();
  if (!params.has(DEV_PROJECT_PARAM)) return null;
  if (hasSampleAdventureParam(params)) return createSampleAdventureProject();
  if (params.has("scarloxyPokemonDemo")) return createScarloxyPokemonDemoProject();
  if (params.has("scarloxyDemo")) return createScarloxyDemoProject();
  if (params.has(DEV_LOG_CABIN_SHOWCASE_PARAM)) return createLogCabinShowcaseProject();
  if (params.has(DEV_RETRO_HOUSE_SHOWCASE_PARAM)) return createRetroHouseShowcaseProject();
  if (params.has(DEV_SHOP_SHOWCASE_PARAM)) return createShopShowcaseProject();
  if (params.has(DEV_TOWN_HOUSE_SHOWCASE_PARAM)) {
    return createTownHouseShowcaseProject(normalizeTownHouseShowcaseStyle(params.get(DEV_TOWN_HOUSE_SHOWCASE_PARAM)));
  }
  if (params.has(DEV_TOWN_CITY_SHOWCASE_PARAM)) return createTownCityShowcaseProject();
  if (params.has(DEV_TOWN_ARCHITECTURE_CITY_PARAM)) return createTownArchitectureCityProject();
  if (params.has(DEV_TOWN_ARCHITECTURE_TEST_PARAM)) return createTownArchitectureTestProject();
  if (params.has(DEV_MARKET_TOWN_PARAM)) return createMarketTownProject();
  if (params.has(DEV_VILLAGE_SHOPPING_STREET_PARAM)) return createVillageShoppingStreetProject();
  if (params.has(DEV_SNOW_MOUNTAIN_60_PARAM)) return createSnowMountain60Project();
  if (params.has(DEV_ICE_PLAIN_64_PARAM)) return createIcePlain64Project();
  if (params.has(DEV_MODERN_NOCTURNE_PARAM)) return createModernNocturneProject();
  if (params.has(DEV_HOUSE_TEMPLATE_GALLERY_PARAM) || params.get(DEV_SMALL_HOUSE_VARIANT_PARAM) === "all") {
    return createHouseTemplateGalleryProject();
  }
  if (params.has(DEV_SMALL_HOUSE_VARIANT_PARAM)) {
    return createSmallHouseVariantProject(normalizeSmallHouseVariant(params.get(DEV_SMALL_HOUSE_VARIANT_PARAM)));
  }
  if (params.has(DEV_DB_EXTRACTED_HOUSE_TEMPLATE_PARAM)) return createDbExtractedHouseTemplateProject();
  return null;
}

function hasSampleAdventureParam(params: URLSearchParams): boolean {
  return params.has(DEV_SAMPLE_ADVENTURE_PARAM) || params.has(DEV_DEFAULT_ADVENTURE_PARAM) || params.has(DEV_DEFAULT_ADVENTURE_VISUAL_PARAM);
}

function createE2eProjectForLocation(): Project | null {
  const seed = window.__RPG_ZZU_E2E_PROJECT__;
  if (!isE2eProject(seed)) return null;
  return structuredClone(seed);
}

function isE2eProject(value: unknown): value is Project {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  return "version" in value && "maps" in value && "startMapId" in value && "database" in value;
}

function normalizeTownHouseShowcaseStyle(value: string | null): TownHouseShowcaseStyle {
  if (value === "courtyard" || value === "multi" || value === "road" || value === "l") return value;
  return "l";
}

function normalizeSmallHouseVariant(value: string | null): SmallHouseVariantIndex {
  if (value === "2" || value === "3" || value === "4" || value === "5" || value === "6" || value === "7" || value === "8" || value === "9") {
    return Number(value) as SmallHouseVariantIndex;
  }
  return 1;
}

function isLocalDevHost(hostname: string): boolean {
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";
}
