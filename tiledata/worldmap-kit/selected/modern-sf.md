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

## 현대·SF 전체 사전

![번호별 실제 그림](image:wmi-modern-sf-sheet)

### 1. modern-sf/camp_a

탐사 캠프 — 돔 텐트 셋·발전기·투광등. 2x2

```json
{"id": "modern-sf/camp_a", "role": "camp", "origin": {"x": 12, "y": 40}, "width": 2, "height": 2, "lower": [[-1, -1], [-1, -1]], "upper": [[1212, 1213], [1242, 1243]]}
```

### 2. modern-sf/camp_b

피난민 캠프 — A자 천막 셋·급수 탱크·무전 마스트. 2x2

```json
{"id": "modern-sf/camp_b", "role": "camp", "origin": {"x": 14, "y": 40}, "width": 2, "height": 2, "lower": [[-1, -1], [-1, -1]], "upper": [[1214, 1215], [1244, 1245]]}
```

### 3. modern-sf/capital

메가시티 — 높이가 다른 고층 빌딩 군(옥상 설비·헬리패드·창 격자)과 중앙 광장 첨탑, 순환 도로. 6x6

```json
{"id": "modern-sf/capital", "role": "capital", "origin": {"x": 16, "y": 40}, "width": 6, "height": 6, "lower": [[-1, -1, -1, -1, -1, -1], [-1, -1, -1, -1, -1, -1], [-1, -1, -1, -1, -1, -1], [-1, -1, -1, -1, -1, -1], [-1, -1, -1, -1, -1, -1], [-1, -1, -1, -1, -1, -1]], "upper": [[1216, 1217, 1218, 1219, 1220, 1221], [1246, 1247, 1248, 1249, 1250, 1251], [1276, 1277, 1278, 1279, 1280, 1281], [1306, 1307, 1308, 1309, 1310, 1311], [1336, 1337, 1338, 1339, 1340, 1341], [1366, 1367, 1368, 1369, 1370, 1371]]}
```

### 4. modern-sf/castle_a

군사 기지(격납고형) — 반원통 격납고·콘크리트 방벽·철문·레이더 타워. 3x3

```json
{"id": "modern-sf/castle_a", "role": "castle", "origin": {"x": 22, "y": 40}, "width": 3, "height": 3, "lower": [[-1, -1, -1], [-1, -1, -1], [-1, -1, -1]], "upper": [[1222, 1223, 1224], [1252, 1253, 1254], [1282, 1283, 1284]]}
```

### 5. modern-sf/castle_b

군사 기지(포탑형) — 원통 포탑 넷·사령동·철문 문루. 3x3

```json
{"id": "modern-sf/castle_b", "role": "castle", "origin": {"x": 25, "y": 40}, "width": 3, "height": 3, "lower": [[-1, -1, -1], [-1, -1, -1], [-1, -1, -1]], "upper": [[1225, 1226, 1227], [1255, 1256, 1257], [1285, 1286, 1287]]}
```

### 6. modern-sf/cave

지하 벙커 입구 — 흙 언덕·콘크리트 문틀·철문·환기구. 2x2

```json
{"id": "modern-sf/cave", "role": "cave", "origin": {"x": 28, "y": 40}, "width": 2, "height": 2, "lower": [[-1, -1], [-1, -1]], "upper": [[1228, 1229], [1258, 1259]]}
```

### 7. modern-sf/circle

위성 안테나 어레이 — 접시 안테나 셋. 2x2

```json
{"id": "modern-sf/circle", "role": "circle", "origin": {"x": 0, "y": 46}, "width": 2, "height": 2, "lower": [[-1, -1], [-1, -1]], "upper": [[1380, 1381], [1410, 1411]]}
```

### 8. modern-sf/floating

부유 도시 — 공중에 뜬 암반 원판 위 고층·돔·밑 추진기, 땅에 그림자. 5x4

```json
{"id": "modern-sf/floating", "role": "floating", "origin": {"x": 2, "y": 46}, "width": 5, "height": 4, "lower": [[-1, -1, -1, -1, -1], [-1, -1, -1, -1, -1], [-1, -1, -1, -1, -1], [-1, -1, -1, -1, -1]], "upper": [[1382, 1383, 1384, 1385, 1386], [1412, 1413, 1414, 1415, 1416], [1442, 1443, 1444, 1445, 1446], [1472, 1473, 1474, 1475, 1476]]}
```

### 9. modern-sf/fort_city

방벽 도시 — 콘크리트 방벽 고리·모서리 감시탑·앞 철문 문루 뒤로 고층. 4x4

```json
{"id": "modern-sf/fort_city", "role": "fort_city", "origin": {"x": 7, "y": 46}, "width": 4, "height": 4, "lower": [[-1, -1, -1, -1], [-1, -1, -1, -1], [-1, -1, -1, -1], [-1, -1, -1, -1]], "upper": [[1387, 1388, 1389, 1390], [1417, 1418, 1419, 1420], [1447, 1448, 1449, 1450], [1477, 1478, 1479, 1480]]}
```

### 10. modern-sf/harbor_city

항만 도시 — 문형 컨테이너 크레인·컨테이너 더미·컨테이너 실은 화물선·항만 고층. 5x4

```json
{"id": "modern-sf/harbor_city", "role": "harbor_city", "origin": {"x": 11, "y": 46}, "width": 5, "height": 4, "lower": [[-1, -1, -1, -1, -1], [-1, -1, -1, -1, -1], [-1, -1, -1, -1, -1], [-1, -1, -1, -1, -1]], "upper": [[1391, 1392, 1393, 1394, 1395], [1421, 1422, 1423, 1424, 1425], [1451, 1452, 1453, 1454, 1455], [1481, 1482, 1483, 1484, 1485]]}
```

### 11. modern-sf/landmark_nature

거대 태양광 패널 농장 — 기울어진 패널 열·관리동. 3x3

```json
{"id": "modern-sf/landmark_nature", "role": "landmark_nature", "origin": {"x": 16, "y": 46}, "width": 3, "height": 3, "lower": [[-1, -1, -1], [-1, -1, -1], [-1, -1, -1]], "upper": [[1396, 1397, 1398], [1426, 1427, 1428], [1456, 1457, 1458]]}
```

### 12. modern-sf/large_town_a

교외 주택가(박공) — 박공 주택 여섯 동·마당 나무. 3x3

```json
{"id": "modern-sf/large_town_a", "role": "large_town", "origin": {"x": 19, "y": 46}, "width": 3, "height": 3, "lower": [[-1, -1, -1], [-1, -1, -1], [-1, -1, -1]], "upper": [[1399, 1400, 1401], [1429, 1430, 1431], [1459, 1460, 1461]]}
```

### 13. modern-sf/large_town_b

교외 주택가(신축) — 평지붕 주택 여섯 동·옥상 태양광. 3x3

```json
{"id": "modern-sf/large_town_b", "role": "large_town", "origin": {"x": 22, "y": 46}, "width": 3, "height": 3, "lower": [[-1, -1, -1], [-1, -1, -1], [-1, -1, -1]], "upper": [[1402, 1403, 1404], [1432, 1433, 1434], [1462, 1463, 1464]]}
```

### 14. modern-sf/ruin

무너진 건물 — 앞이 뜯긴 몸체·기울어 박힌 슬래브·철근·잔해. 2x2

```json
{"id": "modern-sf/ruin", "role": "ruin", "origin": {"x": 25, "y": 46}, "width": 2, "height": 2, "lower": [[-1, -1], [-1, -1]], "upper": [[1405, 1406], [1435, 1436]]}
```

### 15. modern-sf/ruin_city

폐허 도시 — 무너진 고층 다섯 동과 잔해 더미. 4x3

```json
{"id": "modern-sf/ruin_city", "role": "ruin_city", "origin": {"x": 0, "y": 50}, "width": 4, "height": 3, "lower": [[-1, -1, -1, -1], [-1, -1, -1, -1], [-1, -1, -1, -1]], "upper": [[1500, 1501, 1502, 1503], [1530, 1531, 1532, 1533], [1560, 1561, 1562, 1563]]}
```

### 16. modern-sf/shrine

연구 시설 — 원형 관측 돔·부속동·접시 안테나. 3x3

```json
{"id": "modern-sf/shrine", "role": "shrine", "origin": {"x": 4, "y": 50}, "width": 3, "height": 3, "lower": [[-1, -1, -1], [-1, -1, -1], [-1, -1, -1]], "upper": [[1504, 1505, 1506], [1534, 1535, 1536], [1564, 1565, 1566]]}
```

### 17. modern-sf/tower_great

궤도 엘리베이터 기단 — 층진 원통 탑·전망 고리·안테나. 2x4

```json
{"id": "modern-sf/tower_great", "role": "tower_great", "origin": {"x": 7, "y": 50}, "width": 2, "height": 4, "lower": [[-1, -1], [-1, -1], [-1, -1], [-1, -1]], "upper": [[1507, 1508], [1537, 1538], [1567, 1568], [1597, 1598]]}
```

### 18. modern-sf/tower_small_a

송신탑 — 적백 줄무늬 철탑·안테나 플랫폼. 1x2

```json
{"id": "modern-sf/tower_small_a", "role": "tower_small", "origin": {"x": 9, "y": 50}, "width": 1, "height": 2, "lower": [[-1], [-1]], "upper": [[1509], [1539]]}
```

### 19. modern-sf/tower_small_b

풍력 터빈 — 흰 기둥·나셀·날개 셋. 1x2

```json
{"id": "modern-sf/tower_small_b", "role": "tower_small", "origin": {"x": 10, "y": 50}, "width": 1, "height": 2, "lower": [[-1], [-1]], "upper": [[1510], [1540]]}
```

### 20. modern-sf/village_a

컨테이너 촌락 — 쌓은 컨테이너 집·급수탑·옥상 태양광. 2x2

```json
{"id": "modern-sf/village_a", "role": "village", "origin": {"x": 11, "y": 50}, "width": 2, "height": 2, "lower": [[-1, -1], [-1, -1]], "upper": [[1511, 1512], [1541, 1542]]}
```

### 21. modern-sf/village_b

농가 — 붉은 헛간·사일로·살림집. 2x2

```json
{"id": "modern-sf/village_b", "role": "village", "origin": {"x": 13, "y": 50}, "width": 2, "height": 2, "lower": [[-1, -1], [-1, -1]], "upper": [[1513, 1514], [1543, 1544]]}
```

### 22. modern-sf/volcano

지열 발전소 — 냉각탑과 증기 기둥·터빈동. 2x2

```json
{"id": "modern-sf/volcano", "role": "volcano", "origin": {"x": 15, "y": 50}, "width": 2, "height": 2, "lower": [[-1, -1], [-1, -1]], "upper": [[1515, 1516], [1545, 1546]]}
```
