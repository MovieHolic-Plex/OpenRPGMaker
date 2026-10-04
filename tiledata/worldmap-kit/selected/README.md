# 사람 선택 월드맵 아이콘

tilesetId=worldmap_selected, tex_worldmap_selected, 16px, 30열. 원본 지형 0~479 뒤에 사람 선택 아이콘을 붙였다.
source SHA256·선택 후보·시트 판본은 worldmapSelectedSheet.json/selected.json에 있다. 아래 사전의 원점은 0기준 시트 칸이고 픽셀 원점은 x*16,y*16이다.

## 놓는 순서
1. list_worldmap_icons로 id·크기를 읽는다. read_tileset_reference로 용도 문서와 원본 그림을 끝까지 확인한다.
2. 지형을 먼저 깐다. stamp_worldmap_icon(mapId,iconId,at:{x,y})로 전체 위층 배열을 원형 그대로 찍는다.
   다른 월드맵 타일셋이면 번들 그림을 타일 이식으로 덧붙인다. map.tilesetId와 기존 지형 번호는 바뀌지 않는다.
3. 아이콘은 고정 조각이다. 이어 붙이기·회전·타일 번호별 재조립을 하지 않는다. 겹친 위층·맵 밖이면 전체 배치를 거부한다.
4. 땅·도시·성·탑·동굴은 열린 육지 받침에만 놓는다. floating 역할만 바다 위에 허용한다. 밑줄 중앙 1칸이 출입구이며 나머지 밑줄은 막힌다.
   위쪽 줄은 ★(tileMeta.passage=star)로 아래 지형의 통행을 따른다. 투명 여부와 통행은 별개다.
5. entrance=(at.x+floor(width/2),at.y+height-1), approach=(entrance.x,entrance.y+1).
   문 그림·접근 칸·이동 이벤트는 별개다. stamp는 이벤트를 만들지 않는다. create_map_transfer로 연결하고 실제 플레이로 왕복을 확인한다.
6. 집 실내·가구·숲·울타리 조립 부품은 이 사전에 없다. 실내는 atlas_biome_interior, 던전·배는 atlas_biome_dungeon의 현재 참고문서를 읽는다.
7. inspect_worldmap_icon으로 저장한 맵의 모든 칸을 정답 배열과 대조한다. 누락은 MISSING_CELL, 다른 그림은 WRONG_CELL로 실제 맵 좌표와 함께 반환한다.

검사는 그림 해시·칸 수·배열·경계·기존 위층 충돌·받침을 확인한다. 이벤트 실행과 미적 품질, 모델 성공률은 별도 검증이다.
