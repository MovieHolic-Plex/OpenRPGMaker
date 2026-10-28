// 조수 v2 장소 빌더 목록 — 명세 종류(type·style)로 하나를 고른다. 앞에 있는 것이 먼저.
import type { PlaceBuilder, PlaceSpec } from "../types";
import { interiorBuilder } from "./interior";
import { VILLAGE_BUILDER } from "./village";
import { DUNGEON_BUILDER } from "./dungeon";
import { JP_CITY_BUILDER } from "./jpCity";
import { MONSTER_TOWN_BUILDER } from "./monsterTown";
import { MODERN_KR_BUILDER } from "./modernCity";
import { JOSEON_BUILDER } from "./joseon";
import { WIZARDING_BUILDER } from "./wizarding";

export const PLACE_BUILDERS: PlaceBuilder[] = [JOSEON_BUILDER, WIZARDING_BUILDER, interiorBuilder, MONSTER_TOWN_BUILDER, MODERN_KR_BUILDER, JP_CITY_BUILDER, VILLAGE_BUILDER, DUNGEON_BUILDER];

export function builderFor(spec: PlaceSpec): PlaceBuilder | undefined {
  return PLACE_BUILDERS.find((builder) => builder.accepts(spec));
}
