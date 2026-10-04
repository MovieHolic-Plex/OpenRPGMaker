# 해안 절벽길 — 고른 조각 18종

tilesetId `beodeul_city` · 그림 `public/assets/beodeul-city/beodeul-city-chipset.png`(텍스처 `tex_beodeul_city`, 27648칸, 16px 칸, 한 줄 128칸 — 번호 n 의 칸은 행 n÷128, 열 n%128). 0~23935 은 버들항 도시 칸, 23936~27647 은 고른 장소 조각 칸(이 용도). 다른 칩셋 번호를 섞지 않는다.

## 원래 계획 (tiledata/beodeul-variants/coast-cliff-road/plan.md 앞부분 — 목적·구역을 보고 새로 배치한다)
# 해안 절벽길 (coast-cliff-road) — 80×44칸, 16px

## 용도
버들항(항구 도시)과 다음 마을 사이를 잇는 **바다 낀 고원길**. 동서로 가로지르는 2칸 폭 자갈 대로 한 줄이 뼈대이고,
바다 쪽 절벽 밑에는 계단으로 내려가는 작은 만(코브)이 숨어 있다. 걷는 사람이 「바다를 보며 걷다가 잠깐 들를 곳」이 3~4개 있는 길.

## 구역
| 구역 | 칸 범위(대략) | 내용 |
|---|---|---|
| 북쪽 숲 띠 | y 0~15 | 전나무·참나무 덩이, 북서쪽에 양우리 |
| 히스 고원 | y 16~33 | 낮은 히스 덤불(덩이 잡음), 소나무·삼나무·돌 덩이, 절벽 끝은 울타리 |
| 절벽 | y 34~36 (E0=33) | 시트의 절벽 면. 계단 하나 |
| 만(코브) | x 47~60, 절벽 밑 | 모래 바닥, 배 한 척, 그물 걸이, 생선 궤짝, 유목, 바위와 물거품 |
| 바다 | y 37~43 | 물, 파도 바위 몇 개(소 12·대 3) |

## 앵커(랜드마크)
1. **길가 사당** (x 32~37, 길 북쪽, 모래 앞마당) — 작은 사당 + 삼나무 둘 + 표지 십자.
2. **이정표 둘** — 서쪽 입구 근처(x=11, 길 남쪽), 만 갈림길 근처(x=60, 길 북쪽).
3. **양치기 우리** (북쪽 곁길 끝, x≈22) — 작은 오두막, 울타리, 건초·통, 양 떼.
4. **바다 전망대** (남쪽 곁길 끝, x≈69) — 벤치, 울타리, 우산소나무 곁.
5. **만으로 내려가는 계단** (x≈52) — 배·그물·궤짝이 있는 어촌 뒷문 같은 곳.


## 조각 표
번호 = 그림 `coast-cliff-road-parts` 의 번호. 판정: after = 사용자가 AFTER 를 고름 · unpicked-after = 안 고름(AFTER) · before = BEFORE 사본 복원.
| # | 키트 | 이름 | 칸 | 종류 | 막힘 줄 | 판정 |
|---|---|---|---|---|---|---|
| 1 | `bd-pick-coast-cliff-road-driftwood` | 떠내려온 통나무 | 1×1 | 물체 | 1 | after |
| 2 | `bd-pick-coast-cliff-road-fir-l` | 전나무 | 3×4 | 나무 | 1 | unpicked-after |
| 3 | `bd-pick-coast-cliff-road-fir-m` | 전나무 | 2×3 | 나무 | 1 | unpicked-after |
| 4 | `bd-pick-coast-cliff-road-fir-m2` | 전나무 | 2×3 | 나무 | 1 | unpicked-after |
| 5 | `bd-pick-coast-cliff-road-fir-s` | 전나무 | 2×3 | 나무 | 1 | unpicked-after |
| 6 | `bd-pick-coast-cliff-road-haystack` | 짚단 더미 | 2×2 | 물체 | 1 | after |
| 7 | `bd-pick-coast-cliff-road-heath-a` | 낮은 헤더 덤불 A | 1×1 | 바닥 소품(걸음) | - | after |
| 8 | `bd-pick-coast-cliff-road-heath-b` | 낮은 헤더 덤불 B | 1×1 | 바닥 소품(걸음) | - | after |
| 9 | `bd-pick-coast-cliff-road-heath-c` | 낮은 헤더 덤불 C | 1×1 | 바닥 소품(걸음) | - | after |
| 10 | `bd-pick-coast-cliff-road-milestone` | 로마식 이정표 돌기둥 | 1×2 | 물체 | 1 | unpicked-after |
| 11 | `bd-pick-coast-cliff-road-rowboat` | 뭍에 올린 작은 배 | 2×1 | 물체 | 1 | after |
| 12 | `bd-pick-coast-cliff-road-sea-rock-l` | 바다 바위 | 2×2 | 물체 | 1 | unpicked-after |
| 13 | `bd-pick-coast-cliff-road-sea-rock-s` | 바다 바위 | 1×1 | 물체 | 1 | unpicked-after |
| 14 | `bd-pick-coast-cliff-road-sheep-a` | 양 A | 1×1 | 물체 | 1 | unpicked-after |
| 15 | `bd-pick-coast-cliff-road-sheep-b` | 양 B | 1×1 | 물체 | 1 | unpicked-after |
| 16 | `bd-pick-coast-cliff-road-shrine` | 길가 사당 | 2×3 | 물체 | 2 | after |
| 17 | `bd-pick-coast-cliff-road-trough` | 돌 물통 | 2×1 | 물체 | 1 | after |
| 18 | `bd-pick-coast-cliff-road-wayside-cross` | 길가 표지 십자 | 1×2 | 물체 | 1 | after |

## 칸 배열 (원점 = 키트 왼쪽 위, -1 = 그 층을 건드리지 않음)
역할 글자: `S` 윗부분 막힘(사람과 y 정렬) · `C` 윗부분 걸음 ★(사람 위에 그려짐) · `W` 윗부분 걸음(사람 아래, 다리·계단·바닥 얼룩) · `F` 땅 걸음 · `X` 땅 막힘 · `.` 빈 칸(-1, 찍는 자리의 그 층을 건드리지 않음).

### 1. `bd-pick-coast-cliff-road-driftwood` 떠내려온 통나무 1×1
역할 `S`
```
아래층
-1
윗층
27479
```

### 2. `bd-pick-coast-cliff-road-fir-l` 전나무 3×4
역할 `.C. / CCC / CCC / SSS`
```
아래층
-1 -1 -1
-1 -1 -1
-1 -1 -1
-1 -1 -1
윗층
-1 27480 -1
27481 27482 27483
27484 27485 27486
27487 27488 27489
```

### 3. `bd-pick-coast-cliff-road-fir-m` 전나무 2×3
역할 `CC / CC / SS`
```
아래층
-1 -1
-1 -1
-1 -1
윗층
27490 27491
27492 27493
27494 27495
```

### 4. `bd-pick-coast-cliff-road-fir-m2` 전나무 2×3
역할 `CC / CC / SS`
```
아래층
-1 -1
-1 -1
-1 -1
윗층
27496 27497
27498 27499
27500 27501
```

### 5. `bd-pick-coast-cliff-road-fir-s` 전나무 2×3
역할 `C. / CC / SS`
```
아래층
-1 -1
-1 -1
-1 -1
윗층
27502 -1
27503 27504
27505 27506
```

### 6. `bd-pick-coast-cliff-road-haystack` 짚단 더미 2×2
역할 `CC / SS`
```
아래층
-1 -1
-1 -1
윗층
27507 27508
27509 27510
```

### 7. `bd-pick-coast-cliff-road-heath-a` 낮은 헤더 덤불 A 1×1
역할 `W`
```
아래층
-1
윗층
27511
```

### 8. `bd-pick-coast-cliff-road-heath-b` 낮은 헤더 덤불 B 1×1
역할 `W`
```
아래층
-1
윗층
27512
```

### 9. `bd-pick-coast-cliff-road-heath-c` 낮은 헤더 덤불 C 1×1
역할 `W`
```
아래층
-1
윗층
27513
```

### 10. `bd-pick-coast-cliff-road-milestone` 로마식 이정표 돌기둥 1×2
역할 `C / S`
```
아래층
-1
-1
윗층
27514
27515
```

### 11. `bd-pick-coast-cliff-road-rowboat` 뭍에 올린 작은 배 2×1
역할 `SS`
```
아래층
-1 -1
윗층
27516 27517
```

### 12. `bd-pick-coast-cliff-road-sea-rock-l` 바다 바위 2×2
역할 `CC / SS`
```
아래층
-1 -1
-1 -1
윗층
27518 27519
27520 27521
```

### 13. `bd-pick-coast-cliff-road-sea-rock-s` 바다 바위 1×1
역할 `S`
```
아래층
-1
윗층
27522
```

### 14. `bd-pick-coast-cliff-road-sheep-a` 양 A 1×1
역할 `S`
```
아래층
-1
윗층
27523
```

### 15. `bd-pick-coast-cliff-road-sheep-b` 양 B 1×1
역할 `S`
```
아래층
-1
윗층
27524
```

### 16. `bd-pick-coast-cliff-road-shrine` 길가 사당 2×3
역할 `CC / SS / SS`
```
아래층
-1 -1
-1 -1
-1 -1
윗층
27525 27526
27527 27528
27529 27530
```

### 17. `bd-pick-coast-cliff-road-trough` 돌 물통 2×1
역할 `SS`
```
아래층
-1 -1
윗층
27531 27532
```

### 18. `bd-pick-coast-cliff-road-wayside-cross` 길가 표지 십자 1×2
역할 `C / S`
```
아래층
-1
-1
윗층
27533
27534
```
