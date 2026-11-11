// 조수 v2 장소 빌더 목록 — 명세 종류(type·style)로 하나를 고른다. 앞에 있는 것이 먼저.
import type { PlaceBuilder, PlaceSpec } from "../../shared/types";
import { interiorBuilder } from "./interior";
import { VILLAGE_BUILDER } from "./village";
import { VILLAGE_POOL_BUILDER } from "./villagePool";
import { DUNGEON_BUILDER } from "./dungeon";
import { JP_CITY_BUILDER } from "./jpCity";
import { MONSTER_TOWN_BUILDER } from "./monsterTown";
import { MODERN_KR_BUILDER } from "./modernCity";
import { JOSEON_BUILDER } from "./joseon";
import { WIZARDING_BUILDER } from "./wizarding";
import { BBOX_DUNGEON_BUILDER, BBOX_VILLAGE_BUILDER } from "./placeLayout";
import { WORLD_PLACE_BUILDER } from "./worldPlace";

// 세계 장소(style "world:…", world.ts)는 맨 앞 — 종류가 실내(interior)·바깥(village)이어도 그 세계의 구성기가 짓는다.
// 칩셋 풀 마을(style "pool:…")은 모델이 칸 배치(hints.layout)를 줘도 풀 빌더가 먼저 받는다 — 아니면 칸 배치 빌더가 버들항으로 짓는다.
// 칸 배치(bbox) 빌더는 모델이 배치(spec.dungeonLayout·villageLayout)를 줄 때만 받는다 — 없으면 옛 빌더(같은 id)로.
export const PLACE_BUILDERS: PlaceBuilder[] = [WORLD_PLACE_BUILDER, VILLAGE_POOL_BUILDER, BBOX_DUNGEON_BUILDER, BBOX_VILLAGE_BUILDER, JOSEON_BUILDER, WIZARDING_BUILDER, interiorBuilder, MONSTER_TOWN_BUILDER, MODERN_KR_BUILDER, JP_CITY_BUILDER, VILLAGE_BUILDER, DUNGEON_BUILDER];

export function builderFor(spec: PlaceSpec): PlaceBuilder | undefined {
  return PLACE_BUILDERS.find((builder) => builder.accepts(spec));
}
