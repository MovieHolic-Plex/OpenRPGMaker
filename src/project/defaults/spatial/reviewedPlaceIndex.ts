import { sharedPlaceSummaries } from "../../sharedContent";
// Card list for the Places gallery. Full rasters stay in reviewedPlaceCatalog
// and load only when a place is copied or its map is compiled.
export type ReviewedPlaceSummary = {
  readonly id: string;
  readonly name: string;
  readonly kind: "facility" | "settlement" | "natural";
  readonly tags: readonly string[];
  readonly tilesetId: string | null;
};

export const REVIEWED_PLACE_INDEX: readonly ReviewedPlaceSummary[] = [
  {
    "id": "place_river_forest_village",
    "name": "강변 숲마을",
    "kind": "settlement",
    "tags": [
      "그림체:EasyRPG",
      "장소유형:마을·도시",
      "공간형태:실외",
      "용도:주거",
      "용도:마을 꾸밈 기준",
      "강변",
      "숲",
      "울타리 기본 없음",
      "실외 도안"
    ],
    "tilesetId": "forest_harmony"
  },
  {
    "id": "place_ice_deep_cave",
    "name": "푸른 침묵 · 빙벽 굴길",
    "kind": "natural",
    "tags": [
      "얼음",
      "굴곡 지형",
      "연속 단차",
      "68×58"
    ],
    "tilesetId": "ice_deep_cave_tiles"
  },
  {
    "id": "place_fallen_ossuary",
    "name": "침묵의 묘역 · 무너진 납골당",
    "kind": "natural",
    "tags": [
      "crypt",
      "54×50",
      "방 연결 그래프·공간별 군락"
    ],
    "tilesetId": "fallen_ossuary_tiles"
  },
  {
    "id": "place_iron_vein_mine",
    "name": "광산 · 개미굴 갱도",
    "kind": "natural",
    "tags": [
      "광산",
      "개미굴",
      "순환 갱도",
      "88×72"
    ],
    "tilesetId": "iron_vein_mine_tiles"
  },
  {
    "id": "place_lava_deep_cave",
    "name": "불꽃 심장 · 용암 분지",
    "kind": "natural",
    "tags": [
      "용암",
      "굴곡 지형",
      "연속 단차",
      "72×58"
    ],
    "tilesetId": "lava_deep_cave_tiles"
  },
  {
    "id": "place_old_waterworks",
    "name": "잔물결 수로 · 옛 배수 회랑",
    "kind": "natural",
    "tags": [
      "sewer",
      "56×50",
      "방 연결 그래프·공간별 군락"
    ],
    "tilesetId": "old_waterworks_tiles"
  },
  {
    "id": "place_snow_windcrest",
    "name": "흰바람 능선 · 설산",
    "kind": "natural",
    "tags": [
      "설원",
      "산",
      "능선",
      "64×56"
    ],
    "tilesetId": "easyrpg_chipset_dungeon"
  },
  {
    "id": "place_sunken_sanctuary",
    "name": "잠긴 종소리 · 수몰 성소",
    "kind": "natural",
    "tags": [
      "수몰 유적",
      "지하 호수",
      "대각 절벽",
      "104×88"
    ],
    "tilesetId": "sunken_sanctuary_tiles"
  },
  {
    "id": "place_creeper_haul_mine",
    "name": "덩굴에 잠긴 광산 · 마지막 운반선",
    "kind": "natural",
    "tags": [
      "mine",
      "64×52",
      "방 연결 그래프·공간별 군락"
    ],
    "tilesetId": "creeper_haul_mine_tiles"
  },
  {
    "id": "place_snow_grand_ascent",
    "name": "산기슭마을",
    "kind": "natural",
    "tags": [
      "설산",
      "대각선 외곽",
      "80×64",
      "산기슭 집 네 채"
    ],
    "tilesetId": "snow_grand_ascent_tiles"
  },
  {
    "id": "place_grand_labyrinth_mine",
    "name": "광산 · 심층 미궁 (256×256)",
    "kind": "natural",
    "tags": [
      "광산",
      "256×256",
      "대각 절벽",
      "연결 철로"
    ],
    "tilesetId": "grand_labyrinth_mine_tiles"
  },
  {
    "id": "place_terraced_copper_mine",
    "name": "광산 · 굴곡 단층 갱도",
    "kind": "natural",
    "tags": [
      "광산",
      "개미굴",
      "순환 갱도",
      "88×72"
    ],
    "tilesetId": "winding_strata_mine_tiles"
  },
  {
    "id": "place_ashen_vault_lava_cave",
    "name": "용암 동굴 · 붉은 숨결",
    "kind": "natural",
    "tags": [
      "던전",
      "용암",
      "동굴",
      "56×44",
      "고정 지형"
    ],
    "tilesetId": "easyrpg_chipset_dungeon"
  },
  {
    "id": "place_winding_mine_expanded",
    "name": "굴곡 갱도 · 운반선 확장",
    "kind": "natural",
    "tags": [
      "광산",
      "굴곡 갱도 확장",
      "54×38",
      "연결 철로"
    ],
    "tilesetId": "winding_mine_expanded_tiles"
  },
  {
    "id": "place_reference_winding_mine",
    "name": "굴곡 갱도 · 참고 재현",
    "kind": "natural",
    "tags": [
      "광산",
      "참고 이미지 재현",
      "18×15"
    ],
    "tilesetId": "reference_winding_mine_tiles"
  },
  {
    "id": "place_forest_forgotten_shrine",
    "name": "이끼숲 · 잊힌 신전",
    "kind": "natural",
    "tags": [
      "숲",
      "폐허",
      "개울",
      "신전",
      "96×80"
    ],
    "tilesetId": "forest_ruins_tiles"
  },
  {
    "id": "place_resonant_crystal_grotto",
    "name": "푸른 맥 · 공명 수정굴",
    "kind": "natural",
    "tags": [
      "crystal",
      "56×50",
      "방 연결 그래프·공간별 군락"
    ],
    "tilesetId": "resonant_crystal_grotto_tiles"
  },
  {
    "id": "place_snow_grand_ascent_natural",
    "name": "설산 · 큰 등반로",
    "kind": "natural",
    "tags": [
      "설산",
      "80×64"
    ],
    "tilesetId": "snow_grand_ascent_tiles"
  },
  {
    "id": "place_tibo_complete_inn",
    "name": "달빛 여관 · 외관",
    "kind": "facility",
    "tags": [
      "EasyRPG",
      "실외",
      "건물 외관",
      "공용 장소"
    ],
    "tilesetId": "complete_inn:easyrpg_chipset_combined_town"
  },
  {
    "id": "place_tibo_facility_bank",
    "name": "은빛 은행 · 외관",
    "kind": "facility",
    "tags": [
      "EasyRPG",
      "실외",
      "건물 외관",
      "공용 장소"
    ],
    "tilesetId": "purpose_ten:easyrpg_chipset_combined_town"
  },
  {
    "id": "place_tibo_facility_bakery",
    "name": "아침빵 제과점 · 외관",
    "kind": "facility",
    "tags": [
      "EasyRPG",
      "실외",
      "건물 외관",
      "공용 장소"
    ],
    "tilesetId": "purpose_ten:easyrpg_chipset_combined_town"
  },
  {
    "id": "place_tibo_facility_school",
    "name": "느티나무 학교 · 외관",
    "kind": "facility",
    "tags": [
      "EasyRPG",
      "실외",
      "건물 외관",
      "공용 장소"
    ],
    "tilesetId": "purpose_ten:easyrpg_chipset_combined_town"
  },
  {
    "id": "place_tibo_facility_tailor",
    "name": "은실 재단사점 · 외관",
    "kind": "facility",
    "tags": [
      "EasyRPG",
      "실외",
      "건물 외관",
      "공용 장소"
    ],
    "tilesetId": "purpose_ten:easyrpg_chipset_combined_town"
  },
  {
    "id": "place_tibo_facility_carpenter",
    "name": "참나무 목공소 · 외관",
    "kind": "facility",
    "tags": [
      "EasyRPG",
      "실외",
      "건물 외관",
      "공용 장소"
    ],
    "tilesetId": "purpose_ten:easyrpg_chipset_combined_town"
  },
  {
    "id": "place_tibo_facility_infirmary",
    "name": "새벽 진료소 · 외관",
    "kind": "facility",
    "tags": [
      "EasyRPG",
      "실외",
      "건물 외관",
      "공용 장소"
    ],
    "tilesetId": "purpose_ten:easyrpg_chipset_combined_town"
  },
  {
    "id": "place_tibo_facility_guild_hall",
    "name": "등불 길드 접수소 · 외관",
    "kind": "facility",
    "tags": [
      "EasyRPG",
      "실외",
      "건물 외관",
      "공용 장소"
    ],
    "tilesetId": "purpose_ten:easyrpg_chipset_combined_town"
  },
  {
    "id": "place_tibo_facility_post_office",
    "name": "바람 우체국 · 외관",
    "kind": "facility",
    "tags": [
      "EasyRPG",
      "실외",
      "건물 외관",
      "공용 장소"
    ],
    "tilesetId": "purpose_ten:easyrpg_chipset_combined_town"
  },
  {
    "id": "place_tibo_facility_public_bath",
    "name": "온돌 공중목욕탕 · 외관",
    "kind": "facility",
    "tags": [
      "EasyRPG",
      "실외",
      "건물 외관",
      "공용 장소"
    ],
    "tilesetId": "purpose_ten:easyrpg_chipset_combined_town"
  },
  {
    "id": "place_tibo_facility_public_library",
    "name": "잎새 도서관 · 외관",
    "kind": "facility",
    "tags": [
      "EasyRPG",
      "실외",
      "건물 외관",
      "공용 장소"
    ],
    "tilesetId": "purpose_ten:easyrpg_chipset_combined_town"
  },
  {
    "id": "shared_authored-map_five_more_1_20260921",
    "name": "골목 목욕탕",
    "kind": "facility",
    "tags": [
      "그림체:Tibo",
      "장소유형:건물·시설",
      "공간형태:건물 내부",
      "용도:시설"
    ],
    "tilesetId": "shared_tileset_interior_materials_20260921"
  },
  {
    "id": "shared_authored-map_five_more_2_20260921",
    "name": "마을 서고",
    "kind": "facility",
    "tags": [
      "그림체:Tibo",
      "장소유형:건물·시설",
      "공간형태:건물 내부",
      "용도:시설"
    ],
    "tilesetId": "shared_tileset_potter_cohesive_20260921"
  },
  {
    "id": "shared_authored-map_five_more_3_20260921",
    "name": "직조·재봉 공방",
    "kind": "facility",
    "tags": [
      "그림체:Tibo",
      "장소유형:건물·시설",
      "공간형태:건물 내부",
      "용도:시설"
    ],
    "tilesetId": "shared_tileset_potter_cohesive_20260921"
  },
  {
    "id": "shared_authored-map_five_more_4_20260921",
    "name": "철물 대장간",
    "kind": "facility",
    "tags": [
      "그림체:Tibo",
      "장소유형:건물·시설",
      "공간형태:건물 내부",
      "용도:시설"
    ],
    "tilesetId": "shared_tileset_interior_materials_20260921"
  },
  {
    "id": "shared_authored-map_five_more_5_20260921",
    "name": "골목 주점",
    "kind": "facility",
    "tags": [
      "그림체:Tibo",
      "장소유형:건물·시설",
      "공간형태:건물 내부",
      "용도:시설"
    ],
    "tilesetId": "shared_tileset_potter_cohesive_20260921"
  },
  {
    "id": "shared_authored-map_homes_inn_1_20260921",
    "name": "어부의 집",
    "kind": "facility",
    "tags": [
      "그림체:Tibo",
      "장소유형:건물·시설",
      "공간형태:건물 내부",
      "용도:주거"
    ],
    "tilesetId": "shared_tileset_potter_cohesive_20260921"
  },
  {
    "id": "shared_authored-map_homes_inn_2_20260921",
    "name": "목공의 집",
    "kind": "facility",
    "tags": [
      "그림체:Tibo",
      "장소유형:건물·시설",
      "공간형태:건물 내부",
      "용도:주거"
    ],
    "tilesetId": "shared_tileset_potter_cohesive_20260921"
  },
  {
    "id": "shared_authored-map_homes_inn_3_20260921",
    "name": "노부부의 단칸집",
    "kind": "facility",
    "tags": [
      "그림체:Tibo",
      "장소유형:건물·시설",
      "공간형태:건물 내부",
      "용도:주거"
    ],
    "tilesetId": "shared_tileset_potter_cohesive_20260921"
  },
  {
    "id": "shared_authored-map_homes_inn_4_20260921",
    "name": "버드나무 여관",
    "kind": "facility",
    "tags": [
      "그림체:Tibo",
      "장소유형:건물·시설",
      "공간형태:건물 내부",
      "용도:숙박"
    ],
    "tilesetId": "shared_tileset_potter_cohesive_20260921"
  },
  {
    "id": "shared_authored-map_dozen_rooms_1_20260921",
    "name": "항구 지도제작소",
    "kind": "facility",
    "tags": [
      "그림체:Tibo",
      "장소유형:건물·시설",
      "공간형태:건물 내부",
      "용도:시설"
    ],
    "tilesetId": "shared_tileset_potter_cohesive_20260921"
  },
  {
    "id": "shared_authored-map_dozen_rooms_2_20260921",
    "name": "골목 목공소",
    "kind": "facility",
    "tags": [
      "그림체:Tibo",
      "장소유형:건물·시설",
      "공간형태:건물 내부",
      "용도:시설"
    ],
    "tilesetId": "shared_tileset_potter_cohesive_20260921"
  },
  {
    "id": "shared_authored-map_dozen_rooms_3_20260921",
    "name": "색실 직물 상회",
    "kind": "facility",
    "tags": [
      "그림체:Tibo",
      "장소유형:건물·시설",
      "공간형태:건물 내부",
      "용도:시설"
    ],
    "tilesetId": "shared_tileset_potter_cohesive_20260921"
  },
  {
    "id": "shared_authored-map_dozen_rooms_4_20260921",
    "name": "음악가의 연습소",
    "kind": "facility",
    "tags": [
      "그림체:Tibo",
      "장소유형:건물·시설",
      "공간형태:건물 내부",
      "용도:시설"
    ],
    "tilesetId": "shared_tileset_potter_cohesive_20260921"
  },
  {
    "id": "shared_authored-map_dozen_rooms_5_20260921",
    "name": "어린아이가 있는 집",
    "kind": "facility",
    "tags": [
      "그림체:Tibo",
      "장소유형:건물·시설",
      "공간형태:건물 내부",
      "용도:시설"
    ],
    "tilesetId": "shared_tileset_potter_cohesive_20260921"
  },
  {
    "id": "shared_authored-map_dozen_rooms_6_20260921",
    "name": "여행자 길드",
    "kind": "facility",
    "tags": [
      "그림체:Tibo",
      "장소유형:건물·시설",
      "공간형태:건물 내부",
      "용도:시설"
    ],
    "tilesetId": "shared_tileset_potter_cohesive_20260921"
  },
  {
    "id": "shared_authored-map_dozen_rooms_7_20260921",
    "name": "약초 치료원",
    "kind": "facility",
    "tags": [
      "그림체:Tibo",
      "장소유형:건물·시설",
      "공간형태:건물 내부",
      "용도:시설"
    ],
    "tilesetId": "shared_tileset_potter_cohesive_20260921"
  },
  {
    "id": "shared_authored-map_dozen_rooms_8_20260921",
    "name": "강변 양조장",
    "kind": "facility",
    "tags": [
      "그림체:Tibo",
      "장소유형:건물·시설",
      "공간형태:건물 내부",
      "용도:시설"
    ],
    "tilesetId": "shared_tileset_interior_materials_20260921"
  },
  {
    "id": "shared_authored-map_dozen_rooms_9_20260921",
    "name": "마구와 여행장비점",
    "kind": "facility",
    "tags": [
      "그림체:Tibo",
      "장소유형:건물·시설",
      "공간형태:건물 내부",
      "용도:시설"
    ],
    "tilesetId": "shared_tileset_potter_cohesive_20260921"
  },
  {
    "id": "shared_authored-map_places_five_1_20260921",
    "name": "골목 빵집",
    "kind": "facility",
    "tags": [
      "그림체:Tibo",
      "장소유형:건물·시설",
      "공간형태:건물 내부",
      "용도:시설"
    ],
    "tilesetId": "shared_tileset_trade_rooms_20260921"
  },
  {
    "id": "shared_authored-map_places_five_2_20260921",
    "name": "동네 세탁소",
    "kind": "facility",
    "tags": [
      "그림체:Tibo",
      "장소유형:건물·시설",
      "공간형태:건물 내부",
      "용도:시설"
    ],
    "tilesetId": "shared_tileset_interior_materials_20260921"
  },
  {
    "id": "shared_authored-map_places_five_3_20260921",
    "name": "작은 약방",
    "kind": "facility",
    "tags": [
      "그림체:Tibo",
      "장소유형:건물·시설",
      "공간형태:건물 내부",
      "용도:시설"
    ],
    "tilesetId": "shared_tileset_trade_rooms_20260921"
  },
  {
    "id": "shared_authored-map_places_five_4_20260921",
    "name": "야간 경비 초소",
    "kind": "facility",
    "tags": [
      "그림체:Tibo",
      "장소유형:건물·시설",
      "공간형태:건물 내부",
      "용도:시설"
    ],
    "tilesetId": "shared_tileset_interior_materials_20260921"
  },
  {
    "id": "shared_authored-map_places_five_5_20260921",
    "name": "작은 예배당",
    "kind": "facility",
    "tags": [
      "그림체:Tibo",
      "장소유형:건물·시설",
      "공간형태:건물 내부",
      "용도:시설"
    ],
    "tilesetId": "shared_tileset_interior_materials_20260921"
  },
  {
    "id": "shared_authored-map_dozen_rooms_10_20260921",
    "name": "야간 경비대 숙소",
    "kind": "facility",
    "tags": [
      "그림체:Tibo",
      "장소유형:건물·시설",
      "공간형태:건물 내부",
      "용도:시설"
    ],
    "tilesetId": "shared_tileset_interior_materials_20260921"
  },
  {
    "id": "shared_authored-map_dozen_rooms_11_20260921",
    "name": "마을 문서보관소",
    "kind": "facility",
    "tags": [
      "그림체:Tibo",
      "장소유형:건물·시설",
      "공간형태:건물 내부",
      "용도:시설"
    ],
    "tilesetId": "shared_tileset_potter_cohesive_20260921"
  },
  {
    "id": "shared_authored-map_dozen_rooms_12_20260921",
    "name": "여행자의 작은 예배당",
    "kind": "facility",
    "tags": [
      "그림체:Tibo",
      "장소유형:건물·시설",
      "공간형태:건물 내부",
      "용도:시설"
    ],
    "tilesetId": "shared_tileset_interior_materials_20260921"
  },
  {
    "id": "shared_authored-map_variety_house_1_20260921",
    "name": "텃밭지기의 작은 집",
    "kind": "facility",
    "tags": [
      "그림체:Tibo",
      "장소유형:건물·시설",
      "공간형태:건물 내부",
      "용도:주택"
    ],
    "tilesetId": "shared_tileset_potter_cohesive_20260921"
  },
  {
    "id": "shared_authored-map_variety_house_2_20260921",
    "name": "실 잣는 부부의 집",
    "kind": "facility",
    "tags": [
      "그림체:Tibo",
      "장소유형:건물·시설",
      "공간형태:건물 내부",
      "용도:주택"
    ],
    "tilesetId": "shared_tileset_potter_cohesive_20260921"
  },
  {
    "id": "shared_authored-map_variety_house_3_20260921",
    "name": "약초꾼의 작업 겸 살림집",
    "kind": "facility",
    "tags": [
      "그림체:Tibo",
      "장소유형:건물·시설",
      "공간형태:건물 내부",
      "용도:주택"
    ],
    "tilesetId": "shared_tileset_interior_materials_20260921"
  },
  {
    "id": "shared_authored-map_variety_house_4_20260921",
    "name": "떠돌이 악사의 집",
    "kind": "facility",
    "tags": [
      "그림체:Tibo",
      "장소유형:건물·시설",
      "공간형태:건물 내부",
      "용도:주택"
    ],
    "tilesetId": "shared_tileset_potter_cohesive_20260921"
  },
  {
    "id": "shared_authored-map_variety_house_5_20260921",
    "name": "곡물 상인의 가족집",
    "kind": "facility",
    "tags": [
      "그림체:Tibo",
      "장소유형:건물·시설",
      "공간형태:건물 내부",
      "용도:주택"
    ],
    "tilesetId": "shared_tileset_interior_materials_20260921"
  }
];

export function reviewedPlaceIndex(): readonly ReviewedPlaceSummary[] {
  const entries = new Map(REVIEWED_PLACE_INDEX.map(p => [p.id, p]));
  for (const p of sharedPlaceSummaries()) entries.set(p.id, p);
  return [...entries.values()];
}

export function reviewedPlaceSummary(id: string): ReviewedPlaceSummary | undefined {
  return reviewedPlaceIndex().find(place => place.id === id);
}
