import { FOREST_HARMONY_ID } from "./forestHarmony";

/** The approved Places example and village generator share this default style.
 * The saved raster is an outdoor reference; house count/seed remain request inputs. */
export const RIVER_VILLAGE_STYLE = {
  placeId: "place_river_forest_village",
  name: "강변 숲마을",
  tilesetId: FOREST_HARMONY_ID,
  morphology: "river",
  description: "중앙 강과 다리, 양안 주택과 길, 주변 숲·텃밭. 숲마을 · 거리별 잔디의 나무 조립 사용. 시장·일반 주택 울타리는 기본 없음. 울타리는 명시한 부잣집 등 중요한 집에만.",
} as const;

export const RIVER_VILLAGE_STYLE_GUIDANCE = `장소 → 마을·도시의 「${RIVER_VILLAGE_STYLE.name}」(${RIVER_VILLAGE_STYLE.placeId})가 새 마을의 기본 꾸밈 기준이다. ${RIVER_VILLAGE_STYLE.description} author_village에 대상과 요청한 집 수를 전달하고, 배치·테마 요청이 없으면 morphology/theme를 임의로 만들어 넣지 않는다. 집 수는 예제의 8채로 고정하지 않는다. 명시한 테마·저장 설계서·기존 맵·선택 범위를 우선한다. 장소의 실외 도안과 실제 NPC·실내 연결은 별개다.`;
