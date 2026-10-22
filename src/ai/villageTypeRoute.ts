// 마을 종류(villageTypeCatalog) → 조수 경로(2026-10-22). plainTurn 이 칩셋 정책 판정과 함께 부른다.
//  - needs-art 종류(엘프 숲 마을·해저 돔·폐허 마을·무림 객잔…)는 어떤 칩셋 노트도 붙이지 않는다 — 버들항 노트가 붙으면 모델이 버들항 마을을 지어 «엘프 마을»이라 부른다.
//  - 버들항이 아닌 칩셋의 종류(조선 장터·달 정착지…)는 버들항 마을 노트를 끈다 — 정책 낱말이 못 잡은 요청이 버들항으로 새지 않게.
//  - 그 칩셋의 도구를 첫 요청부터 보이게 한다.
import type { IntentDeclaration } from "@/ai/intentDeclaration";
import { matchVillageType, villageTypeById, type VillageType } from "./villageTypeCatalog";
import { SF_STATION_EXPOSED_TOOLS } from "./sfStationPolicy";
import { PREHISTORIC_EXPOSED_TOOLS } from "./prehistoricPolicy";
import { DESERT_EAST_EXPOSED_TOOLS } from "./desertEastPolicy";
import { SNOW_NORTH_EXPOSED_TOOLS } from "./snowNorthPolicy";
import { SENGOKU_EXPOSED_TOOLS } from "./sengokuEdoPolicy";
import { STEAMPUNK_EXPOSED_TOOLS } from "./steampunkCityPolicy";
import { PIRATE_ISLES_EXPOSED_TOOLS } from "./pirateIslesPolicy";
import { SKY_ISLAND_EXPOSED_TOOLS } from "./skyIslandPolicy";
import { JP_CITY_EXPOSED_TOOLS } from "./jpCityPolicy";
import { CAMPUS_EXPOSED_TOOLS } from "./campusPolicy";
import { MODERN_CITY_EXPOSED_TOOLS } from "./modernCityPolicy";

/** 마을·도시를 «짓는» 문장의 표지 — 「엘프 NPC 놓아 줘」 같은 문장이 엘프 마을로 잡히지 않게. */
const SETTLEMENT_RE = /마을|도시|동네|촌|부락|거리|시가|정착지|정착촌|콜로니|기지|단지|장터|시장|항구|포구|어항|대학가|상점가|주택가|관광지|수향|역참|town|village|city|settlement|colony|street|harbou?r/iu;

const JOSEON_TOOLS = ["dress_joseon_market", "import_region_reference", "read_region_reference", "list_spatial_designs", "stamp_object", "show_map_region", "list_map_locations", "check_reachability", "create_map"] as const;

const CHIPSET_TOOLS: Record<string, readonly string[]> = {
  sf_station: SF_STATION_EXPOSED_TOOLS,
  prehistoric: PREHISTORIC_EXPOSED_TOOLS,
  desert_east: DESERT_EAST_EXPOSED_TOOLS,
  snow_north: SNOW_NORTH_EXPOSED_TOOLS,
  sengoku_edo: SENGOKU_EXPOSED_TOOLS,
  steampunk_city: STEAMPUNK_EXPOSED_TOOLS,
  pirate_isles: PIRATE_ISLES_EXPOSED_TOOLS,
  sky_island: SKY_ISLAND_EXPOSED_TOOLS,
  jp_city: JP_CITY_EXPOSED_TOOLS,
  modern_campus: CAMPUS_EXPOSED_TOOLS,
  modern_city: MODERN_CITY_EXPOSED_TOOLS,
  joseon_baram: JOSEON_TOOLS,
  beodeul_city: ["author_beodeul_town", "dress_village_quarter", "stamp_object", "check_city_form", "check_reachability", "show_map_region"],
};

/** 이 턴이 마을·도시 «새로 짓기» 요청이고 종류가 표에 있으면 그 종류. */
export function villageTypeForTurn(intent: Pick<IntentDeclaration, "mode" | "space" | "source">, text: string | undefined): VillageType | null {
  if (intent.source !== "llm" || intent.mode !== "create" || intent.space === "interior") return null;
  if (!text || !SETTLEMENT_RE.test(text)) return null;
  return matchVillageType(text);
}

/** 어떤 칩셋 노트도 붙이지 않는다(그림 없음). */
export function villageTypeSuppressesThemes(type: VillageType | null): boolean {
  return type?.status === "needs-art";
}

/** 버들항 마을 노트를 끈다(그림 없음 또는 다른 칩셋). */
export function villageTypeSuppressesBeodeul(type: VillageType | null): boolean {
  return !!type && (type.status === "needs-art" || (type.chipset !== null && type.chipset !== "beodeul_city"));
}

export function villageTypeExposedTools(type: VillageType | null): string[] {
  if (!type) return [];
  // 그림이 없는 종류는 대안(nearest)을 짓는다 — 대안 칩셋의 도구도 보이게.
  const chipsets = [type.chipset, ...(type.nearest ?? []).map((id) => villageTypeById(id)?.chipset ?? null)].filter((c): c is string => !!c);
  return [...new Set(["find_village_type", ...chipsets.flatMap((c) => CHIPSET_TOOLS[c] ?? [])])];
}
