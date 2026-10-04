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

## 판타지 전체 사전

![번호별 실제 그림](image:wmi-fantasy-sheet)

### 1. fantasy/adobe_village

흙벽 돔 마을 — 황토 평지붕 집과 돔, 줄무늬 차양, 우물

```json
{"id": "fantasy/adobe_village", "role": "village", "origin": {"x": 2, "y": 26}, "width": 2, "height": 2, "lower": [[-1, -1], [-1, -1]], "upper": [[782, 783], [812, 813]]}
```

### 2. fantasy/castle_dark

어둠의 성 — 원본 어두운 성(2x2)의 둥근 탑·성벽 모듈을 키운 3x3

```json
{"id": "fantasy/castle_dark", "role": "castle", "origin": {"x": 4, "y": 26}, "width": 3, "height": 3, "lower": [[-1, -1, -1], [-1, -1, -1], [-1, -1, -1]], "upper": [[784, 785, 786], [814, 815, 816], [844, 845, 846]]}
```

### 3. fantasy/castle_dark_grand

대성 — 바깥 성벽과 문·모서리 탑 둘 뒤로 안쪽 성이 솟는 5x5

```json
{"id": "fantasy/castle_dark_grand", "role": "capital", "origin": {"x": 7, "y": 26}, "width": 5, "height": 5, "lower": [[-1, -1, -1, -1, -1], [-1, -1, -1, -1, -1], [-1, -1, -1, -1, -1], [-1, -1, -1, -1, -1], [-1, -1, -1, -1, -1]], "upper": [[787, 788, 789, 790, 791], [817, 818, 819, 820, 821], [847, 848, 849, 850, 851], [877, 878, 879, 880, 881], [907, 908, 909, 910, 911]]}
```

### 4. fantasy/cave_rock

바위 동굴 — 갈색 바위 더미 속 어두운 입

```json
{"id": "fantasy/cave_rock", "role": "cave", "origin": {"x": 12, "y": 26}, "width": 2, "height": 2, "lower": [[-1, -1], [-1, -1]], "upper": [[792, 793], [822, 823]]}
```

### 5. fantasy/cave_vine

덩굴 유적 동굴 — 이끼 둔덕의 돌 틀 입구, 늘어진 덩굴

```json
{"id": "fantasy/cave_vine", "role": "cave", "origin": {"x": 14, "y": 26}, "width": 2, "height": 2, "lower": [[-1, -1], [-1, -1]], "upper": [[794, 795], [824, 825]]}
```

### 6. fantasy/city_capital

수도 — 6x6 이중 성벽 도시

```json
{"id": "fantasy/city_capital", "role": "capital", "origin": {"x": 16, "y": 26}, "width": 6, "height": 6, "lower": [[-1, -1, -1, -1, -1, -1], [-1, -1, -1, -1, -1, -1], [-1, -1, -1, -1, -1, -1], [-1, -1, -1, -1, -1, -1], [-1, -1, -1, -1, -1, -1], [-1, -1, -1, -1, -1, -1]], "upper": [[796, 797, 798, 799, 800, 801], [826, 827, 828, 829, 830, 831], [856, 857, 858, 859, 860, 861], [886, 887, 888, 889, 890, 891], [916, 917, 918, 919, 920, 921], [946, 947, 948, 949, 950, 951]]}
```

### 7. fantasy/city_fort

성곽 도시 — 4x4

```json
{"id": "fantasy/city_fort", "role": "fort_city", "origin": {"x": 22, "y": 26}, "width": 4, "height": 4, "lower": [[-1, -1, -1, -1], [-1, -1, -1, -1], [-1, -1, -1, -1], [-1, -1, -1, -1]], "upper": [[802, 803, 804, 805], [832, 833, 834, 835], [862, 863, 864, 865], [892, 893, 894, 895]]}
```

### 8. fantasy/city_harbor

항구 성곽 도시 — 5x4, 남쪽이 부두

```json
{"id": "fantasy/city_harbor", "role": "harbor_city", "origin": {"x": 0, "y": 32}, "width": 5, "height": 4, "lower": [[-1, -1, -1, -1, -1], [-1, -1, -1, -1, -1], [-1, -1, -1, -1, -1], [-1, -1, -1, -1, -1]], "upper": [[960, 961, 962, 963, 964], [990, 991, 992, 993, 994], [1020, 1021, 1022, 1023, 1024], [1050, 1051, 1052, 1053, 1054]]}
```

### 9. fantasy/crypt

무덤(묘당) — 박공 묘당, 묘비, 죽은 나무, 혼불

```json
{"id": "fantasy/crypt", "role": "ruin", "origin": {"x": 5, "y": 32}, "width": 2, "height": 2, "lower": [[-1, -1], [-1, -1]], "upper": [[965, 966], [995, 996]]}
```

### 10. fantasy/desert_colonnade

모래 묻힌 기둥 회랑 — 부러진 기둥과 상인방, 쓰러진 토막

```json
{"id": "fantasy/desert_colonnade", "role": "ruin", "origin": {"x": 7, "y": 32}, "width": 2, "height": 2, "lower": [[-1, -1], [-1, -1]], "upper": [[967, 968], [997, 998]]}
```

### 11. fantasy/desert_temple

사막 신전

```json
{"id": "fantasy/desert_temple", "role": "shrine", "origin": {"x": 9, "y": 32}, "width": 3, "height": 3, "lower": [[-1, -1, -1], [-1, -1, -1], [-1, -1, -1]], "upper": [[969, 970, 971], [999, 1000, 1001], [1029, 1030, 1031]]}
```

### 12. fantasy/flame_fortress

화염 요새 — 검은 현무암 첨탑 성채, 용암 도랑

```json
{"id": "fantasy/flame_fortress", "role": "castle", "origin": {"x": 12, "y": 32}, "width": 3, "height": 3, "lower": [[-1, -1, -1], [-1, -1, -1], [-1, -1, -1]], "upper": [[972, 973, 974], [1002, 1003, 1004], [1032, 1033, 1034]]}
```

### 13. fantasy/giant_tower

거대한 탑

```json
{"id": "fantasy/giant_tower", "role": "tower_great", "origin": {"x": 15, "y": 32}, "width": 2, "height": 4, "lower": [[-1, -1], [-1, -1], [-1, -1], [-1, -1]], "upper": [[975, 976], [1005, 1006], [1035, 1036], [1065, 1066]]}
```

### 14. fantasy/giant_tree

거목

```json
{"id": "fantasy/giant_tree", "role": "landmark_nature", "origin": {"x": 17, "y": 32}, "width": 3, "height": 3, "lower": [[-1, -1, -1], [-1, -1, -1], [-1, -1, -1]], "upper": [[977, 978, 979], [1007, 1008, 1009], [1037, 1038, 1039]]}
```

### 15. fantasy/harbor_town

항구 마을 — 물가 붉은 지붕 집, 두 부두, 돛단배

```json
{"id": "fantasy/harbor_town", "role": "large_town", "origin": {"x": 20, "y": 32}, "width": 3, "height": 3, "lower": [[-1, -1, -1], [-1, -1, -1], [-1, -1, -1]], "upper": [[980, 981, 982], [1010, 1011, 1012], [1040, 1041, 1042]]}
```

### 16. fantasy/igloo_camp

이글루 촌락 — 크기가 다른 눈 돔과 삼나무, 말린 생선 틀

```json
{"id": "fantasy/igloo_camp", "role": "village", "origin": {"x": 23, "y": 32}, "width": 2, "height": 2, "lower": [[-1, -1], [-1, -1]], "upper": [[983, 984], [1013, 1014]]}
```

### 17. fantasy/lighthouse

등대 — 모래 섬 어귀의 등대 — 빨강·하양 띠, 금빛 등롱

```json
{"id": "fantasy/lighthouse", "role": "tower_small", "origin": {"x": 25, "y": 32}, "width": 1, "height": 2, "lower": [[-1], [-1]], "upper": [[985], [1015]]}
```

### 18. fantasy/log_village

통나무 설원 마을 — 눈 얹은 장작 대청, 모닥불, 눈 삼나무

```json
{"id": "fantasy/log_village", "role": "large_town", "origin": {"x": 26, "y": 32}, "width": 3, "height": 3, "lower": [[-1, -1, -1], [-1, -1, -1], [-1, -1, -1]], "upper": [[986, 987, 988], [1016, 1017, 1018], [1046, 1047, 1048]]}
```

### 19. fantasy/mage_spire

마법사 첨탑 — 고원 가장자리의 하얀 감시 첨탑 — 푸른 지붕, 끝의 수정

```json
{"id": "fantasy/mage_spire", "role": "tower_small", "origin": {"x": 29, "y": 32}, "width": 1, "height": 2, "lower": [[-1], [-1]], "upper": [[989], [1019]]}
```

### 20. fantasy/mine_town

광산 마을 — 바위 면의 갱도 입구, 감는 바퀴 탑, 광석 수레

```json
{"id": "fantasy/mine_town", "role": "village", "origin": {"x": 0, "y": 36}, "width": 2, "height": 2, "lower": [[-1, -1], [-1, -1]], "upper": [[1080, 1081], [1110, 1111]]}
```

### 21. fantasy/monastery

고원 수도원 — 하얀 벽, 푸른 돔과 금빛 십자, 종탑, 담장

```json
{"id": "fantasy/monastery", "role": "village", "origin": {"x": 2, "y": 36}, "width": 2, "height": 2, "lower": [[-1, -1], [-1, -1]], "upper": [[1082, 1083], [1112, 1113]]}
```

### 22. fantasy/oasis_camp

오아시스 천막 — 못과 갈대, 야자, 줄무늬 천막

```json
{"id": "fantasy/oasis_camp", "role": "camp", "origin": {"x": 4, "y": 36}, "width": 2, "height": 2, "lower": [[-1, -1], [-1, -1]], "upper": [[1084, 1085], [1114, 1115]]}
```

### 23. fantasy/pass_fortress

관문 요새 — 사암 성벽, 붉은 기와 이층 문루, 망루

```json
{"id": "fantasy/pass_fortress", "role": "castle", "origin": {"x": 6, "y": 36}, "width": 3, "height": 3, "lower": [[-1, -1, -1], [-1, -1, -1], [-1, -1, -1]], "upper": [[1086, 1087, 1088], [1116, 1117, 1118], [1146, 1147, 1148]]}
```

### 24. fantasy/ruined_city

폐허 도시

```json
{"id": "fantasy/ruined_city", "role": "ruin_city", "origin": {"x": 9, "y": 36}, "width": 4, "height": 3, "lower": [[-1, -1, -1, -1], [-1, -1, -1, -1], [-1, -1, -1, -1]], "upper": [[1089, 1090, 1091, 1092], [1119, 1120, 1121, 1122], [1149, 1150, 1151, 1152]]}
```

### 25. fantasy/sky_island

천공섬 — 떠 있는 대륙

```json
{"id": "fantasy/sky_island", "role": "floating", "origin": {"x": 13, "y": 36}, "width": 5, "height": 4, "lower": [[-1, -1, -1, -1, -1], [-1, -1, -1, -1, -1], [-1, -1, -1, -1, -1], [-1, -1, -1, -1, -1]], "upper": [[1093, 1094, 1095, 1096, 1097], [1123, 1124, 1125, 1126, 1127], [1153, 1154, 1155, 1156, 1157], [1183, 1184, 1185, 1186, 1187]]}
```

### 26. fantasy/stepped_pyramid

계단 피라미드 — 네 단 사암 피라미드와 꼭대기 신전

```json
{"id": "fantasy/stepped_pyramid", "role": "ruin", "origin": {"x": 18, "y": 36}, "width": 2, "height": 2, "lower": [[-1, -1], [-1, -1]], "upper": [[1098, 1099], [1128, 1129]]}
```

### 27. fantasy/stilt_village

수상 마을 — 석호 위 말뚝집, 널다리, 카누

```json
{"id": "fantasy/stilt_village", "role": "village", "origin": {"x": 20, "y": 36}, "width": 2, "height": 2, "lower": [[-1, -1], [-1, -1]], "upper": [[1100, 1101], [1130, 1131]]}
```

### 28. fantasy/stone_circle

고대 돌원

```json
{"id": "fantasy/stone_circle", "role": "circle", "origin": {"x": 22, "y": 36}, "width": 2, "height": 2, "lower": [[-1, -1], [-1, -1]], "upper": [[1102, 1103], [1132, 1133]]}
```

### 29. fantasy/tent_camp

천막 야영지 — 가죽 천막 셋과 모닥불

```json
{"id": "fantasy/tent_camp", "role": "camp", "origin": {"x": 24, "y": 36}, "width": 2, "height": 2, "lower": [[-1, -1], [-1, -1]], "upper": [[1104, 1105], [1134, 1135]]}
```

### 30. fantasy/town_red

큰 마을 — 원본 붉은 지붕·목조 집 여섯 채·덤불 (3x3)

```json
{"id": "fantasy/town_red", "role": "large_town", "origin": {"x": 26, "y": 36}, "width": 3, "height": 3, "lower": [[-1, -1, -1], [-1, -1, -1], [-1, -1, -1]], "upper": [[1106, 1107, 1108], [1136, 1137, 1138], [1166, 1167, 1168]]}
```

### 31. fantasy/town_snow

설원 큰 마을 — 눈 덮인 집 여섯 채 (3x3)

```json
{"id": "fantasy/town_snow", "role": "large_town", "origin": {"x": 0, "y": 40}, "width": 3, "height": 3, "lower": [[-1, -1, -1], [-1, -1, -1], [-1, -1, -1]], "upper": [[1200, 1201, 1202], [1230, 1231, 1232], [1260, 1261, 1262]]}
```

### 32. fantasy/treehouse_village

나무 위 마을 — 굵은 줄기 위 초가 오두막, 줄다리, 사다리

```json
{"id": "fantasy/treehouse_village", "role": "village", "origin": {"x": 3, "y": 40}, "width": 2, "height": 2, "lower": [[-1, -1], [-1, -1]], "upper": [[1203, 1204], [1233, 1234]]}
```

### 33. fantasy/village_snow

설원 촌락 — 눈 덮인 집 세 채 (2x2)

```json
{"id": "fantasy/village_snow", "role": "village", "origin": {"x": 5, "y": 40}, "width": 2, "height": 2, "lower": [[-1, -1], [-1, -1]], "upper": [[1205, 1206], [1235, 1236]]}
```

### 34. fantasy/village_wood

촌락 — 목조 집 세 채·덤불 (2x2)

```json
{"id": "fantasy/village_wood", "role": "village", "origin": {"x": 7, "y": 40}, "width": 2, "height": 2, "lower": [[-1, -1], [-1, -1]], "upper": [[1207, 1208], [1237, 1238]]}
```

### 35. fantasy/volcano_altar

화산 제단 — 끓는 분화구와 용암 줄기, 기슭의 돌 제단

```json
{"id": "fantasy/volcano_altar", "role": "volcano", "origin": {"x": 9, "y": 40}, "width": 2, "height": 2, "lower": [[-1, -1], [-1, -1]], "upper": [[1209, 1210], [1239, 1240]]}
```

### 36. fantasy/witch_tower

마녀 탑 — 독늪의 말뚝 위 휜 탑 — 마녀 모자 지붕, 초록 불빛

```json
{"id": "fantasy/witch_tower", "role": "tower_small", "origin": {"x": 11, "y": 40}, "width": 1, "height": 2, "lower": [[-1], [-1]], "upper": [[1211], [1241]]}
```
