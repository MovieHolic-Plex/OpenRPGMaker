// 조선(바람의나라풍) 칩셋 joseon_baram(계열 oprn-joseon) 조수 연결 — 번들에 있는 칩셋·완성 장소를 «있는 것»으로 알게 한다.
// 배경(2026-10-07 space-craft 무림 과제 4회·조선 칩셋 전수): 시스템 프롬프트·실내 정책 어디에도 joseon_baram 이 없었고
// (실내 정책은 «모든 새 실내 = atlas_biome_interior»), 장소 검색에 「객잔」「한옥」「사극」이 0건이라 조수가 조선 주막·민가 15곳을
// 한 번도 쓰지 않았다. jpCityPolicy.ts 의 포인터 줄과 같은 모양이다.
// build_hand_interior_room·author_village·author_beodeul_town 은 이 칩셋을 짓지 못한다 — 완성 장소 가져오기와 조각 찍기가 길이다.

export const JOSEON_TILESET_ID = "joseon_baram";

/** 시스템 프롬프트 한 줄(공간 작업일 때) — 칩셋이 있다는 사실과 길을 알린다. */
export const JOSEON_POINTER_LINE =
  "조선·한국 전통·사극·바람의나라풍(고구려·삼국 포함) 마을·궁·실내·사냥터·동굴은 번들 칩셋 joseon_baram(계열 oprn-joseon)으로 짓는다 — 버들항·실내 v5·숲마을 칩셋으로 대신 깔지 않는다. "
  + "먼저 완성 장소를 쓴다: list_spatial_designs({kind:\"place\", query:\"조선\"}) 에 마을 20호·국내성·사냥터·동굴과 민가·주막·대장간·약방·서당·관아 실내, 궁 어좌전·회랑·침전·서고가 있고 "
  + "import_region_reference({id}) 한 번으로 맵째 가져와 요청에 맞게 고친다(객잔·주점은 주막, 학당은 서당, 왕궁은 어좌전이 가장 가깝다). "
  + "새로 깔 때는 create_map({tilesetId:\"joseon_baram\"}) 뒤 list_tileset_references({tilesetId:\"joseon_baram\"}) 의 조립법·조각 사전을 읽고, 집·나무·담·소품·실내 벽(jb-in_…) 조각은 "
  + "stamp_object({objectId:\"kit:joseon_baram/jb-…\"}) 로 찍는다(조각 id 는 list_spatial_designs({kind:\"object\", query:\"조선\"})). "
  + "build_hand_interior_room·author_village·author_beodeul_town 은 이 칩셋을 짓지 못한다. 보는 맵이 다른 계열이면 ask_tileset_change(toTilesetId:\"joseon_baram\") 로 묻는다.";
