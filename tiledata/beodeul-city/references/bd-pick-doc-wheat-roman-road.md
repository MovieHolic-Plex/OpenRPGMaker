# 밀밭 로마 가도 — 고른 조각 11종

tilesetId `beodeul_city` · 그림 `public/assets/beodeul-city/beodeul-city-chipset.png`(텍스처 `tex_beodeul_city`, 27648칸, 16px 칸, 한 줄 128칸 — 번호 n 의 칸은 행 n÷128, 열 n%128). 0~23935 은 버들항 도시 칸, 23936~27647 은 고른 장소 조각 칸(이 용도). 다른 칩셋 번호를 섞지 않는다.

## 원래 계획 (tiledata/beodeul-variants/wheat-roman-road/plan.md 앞부분 — 목적·구역을 보고 새로 배치한다)
# 밀밭 로마 대로 (wheat-roman-road) — 버들항 변형 5-2

88x52칸(1408x832px), 16px 3/4, 단일 지면(고도 1단). 버들항 v6 땅·포장·길 오토타일, 버들항 오브젝트/키트 재사용.

## 용도
버들항 성문과 내륙 마을을 잇는 제국 대로. 가는 사람은 (1) 여관에서 말을 쉬게 하고, (2) 밭 사이 곁길로 농가를 찾고, (3) 언덕 위 풍차로 가는 길을 물을 수 있다. 큰길은 끊기지 않고 곁길은 막다른 데 쓸모가 있다.

## 구역 / 앵커
| 구역 | 위치(칸) | 앵커 |
|---|---|---|
| 대로 | y~24±3, 폭 3칸 자갈 포장 | 서쪽(0,y)·동쪽(87,y) 출구, 이정표 2개(서 x=8, 동 x=79) |
| 길가 여관 | 대로 북쪽 x 36~44 | 여관 본채(128x124), 마구간, 우물, 말 물통, 나무 벤치 |
| 북쪽 농장 | 곁길 x~62 로 북쪽 | 판자 농가, 헛간(긴집), 장작간, 우물, 건초 |
| 풍차 언덕 | 농장 곁길 끝 북동 x~78, y~10 | 풍차(몸통+날개), 밀단 |
| 밀밭 | 서북(불규칙 덩이 2), 남동(덩이 2), 농장 둘레 | 울타리·생울타리·허수아비·밀단 |
| 남쪽 곁길 | x~22 로 남쪽 | 연못 + 과수 무리 + 벤치·채소수레 |

## 동선
서쪽 출구 → 이정표 → (곁길 남: 연못) → 여관 앞 → (곁길 북: 농장 → 풍차) → 동쪽 이정표 → 동쪽 출구.
모든 곁길은 대로에서 한 번에 갈라진다. 마크(marks) 전부가 양쪽 출구에서 BFS 로 닿아야 한다.

## 규칙 확인

## 조각 표
번호 = 그림 `wheat-roman-road-parts` 의 번호. 판정: after = 사용자가 AFTER 를 고름 · unpicked-after = 안 고름(AFTER) · before = BEFORE 사본 복원.
| # | 키트 | 이름 | 칸 | 종류 | 막힘 줄 | 판정 |
|---|---|---|---|---|---|---|
| 1 | `bd-pick-coast-cliff-road-haystack` | 짚단 더미 | 2×2 | 물체 | 1 | after |
| 2 | `bd-pick-coast-cliff-road-milestone` | 로마식 이정표 돌기둥 | 1×2 | 물체 | 1 | unpicked-after |
| 3 | `bd-pick-deep-forest-path-wild-c` | 풀밭 들꽃 무더기 C | 1×1 | 바닥 소품(걸음) | - | before |
| 4 | `bd-pick-wheat-roman-road-scarecrow` | 허수아비 | 1×2 | 물체 | 1 | unpicked-after |
| 5 | `bd-pick-wheat-roman-road-trough` | 말 물통 | 2×1 | 물체 | 1 | after |
| 6 | `bd-pick-wheat-roman-road-wheat-a` | 밀밭 칸 A | 1×1 | 물체 | 1 | unpicked-after |
| 7 | `bd-pick-wheat-roman-road-wheat-b` | 밀밭 칸 B | 1×1 | 물체 | 1 | after |
| 8 | `bd-pick-wheat-roman-road-wheat-c` | 밀밭 칸 C | 1×1 | 물체 | 1 | after |
| 9 | `bd-pick-wheat-roman-road-wheat-sheaf` | 밀단 | 1×1 | 물체 | 1 | unpicked-after |
| 10 | `bd-pick-wheat-roman-road-wild-a` | 풀밭 들꽃 무더기 A | 1×1 | 바닥 소품(걸음) | - | after |
| 11 | `bd-pick-wheat-roman-road-wild-b` | 들꽃 풀덩이 B | 1×1 | 바닥 소품(걸음) | - | after |

## 칸 배열 (원점 = 키트 왼쪽 위, -1 = 그 층을 건드리지 않음)
역할 글자: `S` 윗부분 막힘(사람과 y 정렬) · `C` 윗부분 걸음 ★(사람 위에 그려짐) · `W` 윗부분 걸음(사람 아래, 다리·계단·바닥 얼룩) · `F` 땅 걸음 · `X` 땅 막힘 · `.` 빈 칸(-1, 찍는 자리의 그 층을 건드리지 않음).

### 1. `bd-pick-coast-cliff-road-haystack` 짚단 더미 2×2
역할 `CC / SS`
```
아래층
-1 -1
-1 -1
윗층
27507 27508
27509 27510
```

### 2. `bd-pick-coast-cliff-road-milestone` 로마식 이정표 돌기둥 1×2
역할 `C / S`
```
아래층
-1
-1
윗층
27514
27515
```

### 3. `bd-pick-deep-forest-path-wild-c` 풀밭 들꽃 무더기 C 1×1
역할 `W`
```
아래층
-1
윗층
27575
```

### 4. `bd-pick-wheat-roman-road-scarecrow` 허수아비 1×2
역할 `C / S`
```
아래층
-1
-1
윗층
27634
27635
```

### 5. `bd-pick-wheat-roman-road-trough` 말 물통 2×1
역할 `SS`
```
아래층
-1 -1
윗층
27636 27637
```

### 6. `bd-pick-wheat-roman-road-wheat-a` 밀밭 칸 A 1×1
역할 `S`
```
아래층
-1
윗층
27638
```

### 7. `bd-pick-wheat-roman-road-wheat-b` 밀밭 칸 B 1×1
역할 `S`
```
아래층
-1
윗층
27639
```

### 8. `bd-pick-wheat-roman-road-wheat-c` 밀밭 칸 C 1×1
역할 `S`
```
아래층
-1
윗층
27640
```

### 9. `bd-pick-wheat-roman-road-wheat-sheaf` 밀단 1×1
역할 `S`
```
아래층
-1
윗층
27641
```

### 10. `bd-pick-wheat-roman-road-wild-a` 풀밭 들꽃 무더기 A 1×1
역할 `W`
```
아래층
-1
윗층
27642
```

### 11. `bd-pick-wheat-roman-road-wild-b` 들꽃 풀덩이 B 1×1
역할 `W`
```
아래층
-1
윗층
27643
```
