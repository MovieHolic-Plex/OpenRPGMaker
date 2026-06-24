import {
  createBlankProject,
  createDbExtractedHouseTemplateProject,
  createHouseTemplateGalleryProject,
  createLogCabinShowcaseProject,
  createRetroHouseShowcaseProject,
  createSmallHouseVariantProject,
  createTownArchitectureCityProject,
  createTownArchitectureTestProject,
  createTownCityShowcaseProject,
  createTownHouseShowcaseProject,
  type SmallHouseVariantIndex,
  type TownHouseShowcaseStyle,
} from "./defaults";
import type { Project } from "./types";

const DEV_FRESH_PROJECT_PARAM = "freshProject";
const DEV_LOG_CABIN_SHOWCASE_PARAM = "logCabinShowcase";
const DEV_RETRO_HOUSE_SHOWCASE_PARAM = "retroHouseShowcase";
const DEV_TOWN_HOUSE_SHOWCASE_PARAM = "townHouseShowcase";
const DEV_TOWN_CITY_SHOWCASE_PARAM = "townCityShowcase";
const DEV_TOWN_ARCHITECTURE_CITY_PARAM = "townArchitectureCity";
const DEV_TOWN_ARCHITECTURE_TEST_PARAM = "townArchitectureTest";
const DEV_DB_EXTRACTED_HOUSE_TEMPLATE_PARAM = "dbExtractedHouseTemplate";
const DEV_SMALL_HOUSE_VARIANT_PARAM = "smallHouseVariant";
const DEV_HOUSE_TEMPLATE_GALLERY_PARAM = "houseTemplateGallery";

export function createDevShowcaseProjectForLocation(): Project | null {
  if (typeof window === "undefined") return null;
  if (!isLocalDevHost(window.location.hostname)) return null;
  const params = new URLSearchParams(window.location.search);
  if (params.has(DEV_LOG_CABIN_SHOWCASE_PARAM)) return createLogCabinShowcaseProject();
  if (params.has(DEV_RETRO_HOUSE_SHOWCASE_PARAM)) return createRetroHouseShowcaseProject();
  if (params.has(DEV_TOWN_HOUSE_SHOWCASE_PARAM)) {
    return createTownHouseShowcaseProject(normalizeTownHouseShowcaseStyle(params.get(DEV_TOWN_HOUSE_SHOWCASE_PARAM)));
  }
  if (params.has(DEV_TOWN_CITY_SHOWCASE_PARAM)) return createTownCityShowcaseProject();
  if (params.has(DEV_TOWN_ARCHITECTURE_CITY_PARAM)) return createTownArchitectureCityProject();
  if (params.has(DEV_TOWN_ARCHITECTURE_TEST_PARAM)) return createTownArchitectureTestProject();
  if (params.has(DEV_HOUSE_TEMPLATE_GALLERY_PARAM) || params.get(DEV_SMALL_HOUSE_VARIANT_PARAM) === "all") {
    return createHouseTemplateGalleryProject();
  }
  if (params.has(DEV_SMALL_HOUSE_VARIANT_PARAM)) {
    return createSmallHouseVariantProject(normalizeSmallHouseVariant(params.get(DEV_SMALL_HOUSE_VARIANT_PARAM)));
  }
  if (params.has(DEV_DB_EXTRACTED_HOUSE_TEMPLATE_PARAM)) return createDbExtractedHouseTemplateProject();
  if (params.has(DEV_FRESH_PROJECT_PARAM)) return createBlankProject();
  return null;
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
