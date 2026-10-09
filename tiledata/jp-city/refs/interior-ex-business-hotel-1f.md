# 일본 도시 — 일본 실내 예제: 일본 비즈니스 호텔 1층 로비(프런트·엘리베이터) (`jp-city-business-hotel-1f`, 13×9)

tilesetId `jp_city` · 그림 `public/assets/jp-city/jp-city-chipset.png`(텍스처 `tex_jp_city`, **14465칸**, 16px 칸, 시트 1536×2416px, 한 줄 **96칸** — 번호 n 의 칸은 열 n%96, 행 n÷96(내림), 픽셀 좌표 (열×16, 행×16), 모두 0 기준). 계열 `oprn-jp` — 버들항(`oprn-atlas`)·현대 도시(`modern_city`, `oprn-modern`)·조선·숲마을·EasyRPG 칩셋의 칸 번호와 섞지 않는다.

입력(도구 `build_hand_interior_room` 인자 그대로) → 4층 정답 배열 → 원본 그림 `jp-img-interior-business-hotel-1f`. 도구 결과: 손 도트 실내 '일본 비즈니스 호텔 1층 로비(프런트·엘리베이터)' 13×9 (jp-city-business-hotel-1f, jp_city) — 출입구에서 닿는 칸 38, 닿지 못한 빈 바닥 0, 경고 0

## 입력
```json
{"tileset": "jp_city", "mapId": "jp-city-business-hotel-1f", "name": "일본 비즈니스 호텔 1층 로비(프런트·엘리베이터)", "plan": ["#############", "#......#....#", "#......#....#", "#......#....#", "#...........#", "#...........#", "#...........#", "#...........#", "#####..######"], "floor": "ht-lobby-floor", "wall": "ht-hotel-wall", "zones": [], "objects": [{"id": "ht-elevator", "x": 1, "y": 3}, {"id": "of-elevator-button", "x": 3, "y": 1}, {"id": "ht-elevator", "x": 4, "y": 3}, {"id": "of-vending", "x": 6, "y": 3}, {"id": "of-cabinet", "x": 8, "y": 3}, {"id": "sc-key-box", "x": 9, "y": 1}, {"id": "wall-clock", "x": 10, "y": 1}, {"id": "ht-front", "x": 8, "y": 5}, {"id": "ht-front", "x": 9, "y": 5}, {"id": "ht-front", "x": 10, "y": 5}, {"id": "ht-lobby-sofa-e", "x": 1, "y": 6}, {"id": "ht-lobby-sofa-w", "x": 3, "y": 6}, {"id": "of-plant-big", "x": 4, "y": 6}, {"id": "cv-autodoor", "x": 5, "y": 8}], "tables": [{"style": "ht-lobby-table", "x": 2, "y": 6, "w": 1, "h": 2}], "goods": [{"id": "ht-bell", "x": 8, "y": 5}, {"id": "ht-card-key", "x": 10, "y": 5}], "exitWidth": 2, "start": [{"x": 5, "y": 7}], "links": [{"x": 1, "y": 4, "toMapId": "jp-city-business-hotel-floor", "toX": 1, "toY": 5, "direction": "up"}, {"x": 2, "y": 4, "toMapId": "jp-city-business-hotel-floor", "toX": 2, "toY": 5, "direction": "up"}, {"x": 4, "y": 4, "toMapId": "jp-city-business-hotel-floor", "toX": 4, "toY": 5, "direction": "up"}, {"x": 5, "y": 4, "toMapId": "jp-city-business-hotel-floor", "toX": 5, "toY": 5, "direction": "up"}], "replace": true}
```

## 방 구획(사람이 붙인 이름 — `list_hand_interior_parts` 방 표의 근거)
| 방 | 사각형(x0,y0)-(x1,y1) |
|---|---|
| elevatorhall | (0,0)-(6,5) |
| front | (7,0)-(12,5) |
| lobby | (0,6)-(12,8) |

## 이동
| 이벤트 | 칸 | 이동 |
|---|---|---|
| jp-city-business-hotel-1f-link-0 | (1,4) | jp-city-business-hotel-floor (1,5) |
| jp-city-business-hotel-1f-link-1 | (2,4) | jp-city-business-hotel-floor (2,5) |
| jp-city-business-hotel-1f-link-2 | (4,4) | jp-city-business-hotel-floor (4,5) |
| jp-city-business-hotel-1f-link-3 | (5,4) | jp-city-business-hotel-floor (5,5) |

## 통행(엔진 `isPassable`, `X` 막힘 · `.` 걸음)
```
XXXXXXXXXXXXX
XXXXXXXXXXXXX
XXXXXXXXXXXXX
XXX.XXXXX...X
X......X....X
X......XXXX.X
XXXXX.......X
XXXX........X
XXXXX..XXXXXX
```

## 4층 정답 배열 (칸 번호, `.` = 빈 칸)
### 1층
```
y=00: 8740 8741 8741 8741 8741 8741 8741 8740 8741 8741 8741 8741 8740
y=01: 8732 13969 13968 13968 13968 13968 13968 8736 13969 13968 13968 13968 8728
y=02: 8732 13971 13970 13970 13970 13970 13970 8736 13971 13970 13970 13970 8728
y=03: 8732 13847 13849 13853 13841 13845 13849 8737 13843 13845 13849 13853 8728
y=04: 8732 13810 13812 13816 13804 13808 13812 13968 13804 13808 13812 13816 8728
y=05: 8732 13826 13828 13832 13820 13824 13828 13970 13820 13824 13828 13832 8728
y=06: 8732 13810 13804 13836 13804 13808 13804 13837 13804 13808 13804 13836 8728
y=07: 8732 13846 13848 13852 13840 13844 13848 13852 13840 13844 13848 13852 8728
y=08: 8724 8726 8726 8726 8734 13810 13812 8730 8726 8726 8726 8726 8724
```

### 2층
```
y=00: . . . . . . . . . . . . .
y=01: . . . . . . . . . . . . .
y=02: . . . . . . . . . . . . .
y=03: . . . . . . . . . . . . .
y=04: . . . . . . . . . . . . .
y=05: . . . . . . . . . . . . .
y=06: . . . . . . . . . . . . .
y=07: . . . . . . . . . . . . .
y=08: . . . . . 9230 9231 . . . . . .
```

### 3층
```
y=00: . . . . . . . . . . . . .
y=01: . 14009 14010 11072 14009 14010 11142 . 11110 10416 8813 . .
y=02: . 14011 14012 11073 14011 14012 11143 . 11111 10417 . . .
y=03: . 14013 14014 . 14013 14014 11144 . 11112 . . . .
y=04: . . . . 11082 . . . . . . . .
y=05: . 14003 . 14006 11083 . . . 14002 14002 14002 . .
y=06: . 14004 14059 14007 11084 . . . . . . . .
y=07: . 14005 14061 14008 . . . . . . . . .
y=08: . . . . . . . . . . . . .
```

### 4층
```
y=00: . . . . . . . . . . . . .
y=01: . . . . . . . . . . . . .
y=02: . . . . . . . . . . . . .
y=03: . . . . . . . . . . . . .
y=04: . . . . . . . . . . . . .
y=05: . . . . . . . . 14083 . 14082 . .
y=06: . . . . . . . . . . . . .
y=07: . . . . . . . . . . . . .
y=08: . . . . . . . . . . . . .
```
