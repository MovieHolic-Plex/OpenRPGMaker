# 강가 방앗간 마을 — 고른 조각 10종

tilesetId `beodeul_city` · 그림 `public/assets/beodeul-city/beodeul-city-chipset.png`(텍스처 `tex_beodeul_city`, 27648칸, 16px 칸, 한 줄 128칸 — 번호 n 의 칸은 행 n÷128, 열 n%128). 0~23935 은 버들항 도시 칸, 23936~27647 은 고른 장소 조각 칸(이 용도). 다른 칩셋 번호를 섞지 않는다.

## 원래 계획 (tiledata/beodeul-variants/riverside-mill/plan.md 앞부분 — 목적·구역을 보고 새로 배치한다)
# 강가 물레방아 마을 (riverside-mill) — 56x44

## 용도
버들항 로마풍 팔레트의 소박한 농촌 마을. 강이 마을을 북서와 남동으로 가르고, 다리 두 곳(큰 돌다리, 북쪽 섶다리)이 이어 준다. 물레방아·방앗간이 중심이고 가장자리에 밀밭·채소밭이 있다.

## 구역·앵커
| 구역 | 위치 | 앵커 |
|---|---|---|
| 방앗간 마당 | 북중앙 x28~41, y1~9 | 방앗간(h109_0), 물레방아(동서 물길 위), 수문, 맷돌, 밀가루 수레 |
| 큰 돌다리 | x27~30, y24~25 | 서쪽 광장과 동쪽 큰길을 잇는 돌다리 |
| 섶다리 | x42~45, y2~4 | 북서 방앗간 길과 북동 밭길을 잇는 목재 다리 |
| 마을 광장 | x17~26, y21~28 | 지붕 우물, 벤치, 채소 좌판, 가로등 |
| 서쪽·동쪽 주거 | 큰길 남북, y15~34 | 박공 집 3열(서), 2열(동) + 창고(ware0) |
| 밭 | 북서, 북동, 남서, 남동 가장자리 | 밀·양배추·새싹 밭, 허수아비, 밀단, 건초더미 |

## 동선
큰길(0,24)~(55,24)이 돌다리를 건넌다. 방앗간 길 x22~23이 광장에서 북쪽 방앗간 밭두렁 길(y8)로 올라가고, 뒷길(y1)이 섶다리를 지나 동쪽 밭길로 이어진다. 남쪽 윗길(y33)은 남쪽 골목 두 곳(x6, x40)으로 큰길과 연결된다.

## 새로 찍은 조각 (bdv_mill.py, 10종)
물레방아, 섶다리, 맷돌, 밀단 두 종, 허수아비, 빨랫줄, 밀가루 수레, 수문, 건초더미. 설명은 parts.md.
재사용: 시장 키트(자루더미·건초곡물자루), 버들항 집·우물·가로등·밭.


## 조각 표
번호 = 그림 `riverside-mill-parts` 의 번호. 판정: after = 사용자가 AFTER 를 고름 · unpicked-after = 안 고름(AFTER) · before = BEFORE 사본 복원.
| # | 키트 | 이름 | 칸 | 종류 | 막힘 줄 | 판정 |
|---|---|---|---|---|---|---|
| 1 | `bd-pick-riverside-mill-flour-cart` | 밀가루 손수레 | 4×3 | 물체 | 2 | after |
| 2 | `bd-pick-riverside-mill-haystack` | 둥근 짚가리 | 2×3 | 물체 | 2 | unpicked-after |
| 3 | `bd-pick-riverside-mill-laundry-line` | 빨랫줄 | 3×3 | 물체 | 2 | after |
| 4 | `bd-pick-riverside-mill-millstones` | 맷돌 | 2×2 | 물체 | 1 | unpicked-after |
| 5 | `bd-pick-riverside-mill-plank-footbridge` | 나무 널다리 | 5×4 | 걸음 구조물(다리·계단·잔교) | - | unpicked-after |
| 6 | `bd-pick-riverside-mill-scarecrow` | 허수아비 | 2×3 | 물체 | 2 | before |
| 7 | `bd-pick-riverside-mill-sluice-gate` | 수문 | 3×3 | 물체 | 2 | after |
| 8 | `bd-pick-riverside-mill-waterwheel` | 물레방아 | 3×4 | 물체 | 2 | before |
| 9 | `bd-pick-riverside-mill-wheat-stooks-a` | 밀 단 세움 | 2×2 | 물체 | 1 | unpicked-after |
| 10 | `bd-pick-riverside-mill-wheat-stooks-b` | 밀 단 세움 | 2×2 | 물체 | 1 | unpicked-after |

## 칸 배열 (원점 = 키트 왼쪽 위, -1 = 그 층을 건드리지 않음)
역할 글자: `S` 윗부분 막힘(사람과 y 정렬) · `C` 윗부분 걸음 ★(사람 위에 그려짐) · `W` 윗부분 걸음(사람 아래, 다리·계단·바닥 얼룩) · `F` 땅 걸음 · `X` 땅 막힘 · `.` 빈 칸(-1, 찍는 자리의 그 층을 건드리지 않음).

### 1. `bd-pick-riverside-mill-flour-cart` 밀가루 손수레 4×3
역할 `CCC. / SSSS / SSSS`
```
아래층
-1 -1 -1 -1
-1 -1 -1 -1
-1 -1 -1 -1
윗층
24088 24089 24090 -1
24091 24092 24093 24094
24095 24096 24097 24098
```

### 2. `bd-pick-riverside-mill-haystack` 둥근 짚가리 2×3
역할 `.C / SS / SS`
```
아래층
-1 -1
-1 -1
-1 -1
윗층
-1 24099
24100 24101
24102 24103
```

### 3. `bd-pick-riverside-mill-laundry-line` 빨랫줄 3×3
역할 `CCC / SSS / SSS`
```
아래층
-1 -1 -1
-1 -1 -1
-1 -1 -1
윗층
24104 24105 24106
24107 24108 24109
24110 24111 24112
```

### 4. `bd-pick-riverside-mill-millstones` 맷돌 2×2
역할 `CC / SS`
```
아래층
-1 -1
-1 -1
윗층
24113 24114
24115 24116
```

### 5. `bd-pick-riverside-mill-plank-footbridge` 나무 널다리 5×4
역할 `WWWWW / FFFFF / FFFFF / WWWWW`
```
아래층
-1 -1 -1 -1 -1
24120 24121 24122 24123 24124
24125 24126 24127 24128 24129
-1 -1 -1 -1 -1
윗층
24117 24118 24118 24118 24119
-1 -1 -1 -1 -1
-1 -1 -1 -1 -1
24130 24131 24131 24131 24132
```

### 6. `bd-pick-riverside-mill-scarecrow` 허수아비 2×3
역할 `CC / SS / SS`
```
아래층
-1 -1
-1 -1
-1 -1
윗층
24133 24134
24135 24136
24137 24138
```

### 7. `bd-pick-riverside-mill-sluice-gate` 수문 3×3
역할 `CCC / SSS / SSS`
```
아래층
-1 -1 -1
-1 -1 -1
-1 -1 -1
윗층
24139 24140 24141
24142 24143 24144
24145 24146 24147
```

### 8. `bd-pick-riverside-mill-waterwheel` 물레방아 3×4
역할 `CCC / CCC / SSS / SSS`
```
아래층
-1 -1 -1
-1 -1 -1
-1 -1 -1
-1 -1 -1
윗층
24148 24149 24150
24151 24152 24153
24154 24155 24156
24157 24158 24159
```

### 9. `bd-pick-riverside-mill-wheat-stooks-a` 밀 단 세움 2×2
역할 `CC / SS`
```
아래층
-1 -1
-1 -1
윗층
24160 24161
24162 24163
```

### 10. `bd-pick-riverside-mill-wheat-stooks-b` 밀 단 세움 2×2
역할 `CC / SS`
```
아래층
-1 -1
-1 -1
윗층
24164 24165
24166 24167
```
