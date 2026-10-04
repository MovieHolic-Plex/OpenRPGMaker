# 깊은 숲길 — 고른 조각 28종

tilesetId `beodeul_city` · 그림 `public/assets/beodeul-city/beodeul-city-chipset.png`(텍스처 `tex_beodeul_city`, 27648칸, 16px 칸, 한 줄 128칸 — 번호 n 의 칸은 행 n÷128, 열 n%128). 0~23935 은 버들항 도시 칸, 23936~27647 은 고른 장소 조각 칸(이 용도). 다른 칩셋 번호를 섞지 않는다.

## 원래 계획 (tiledata/beodeul-variants/deep-forest-path/plan.md 앞부분 — 목적·구역을 보고 새로 배치한다)
# 깊은 숲길 (버들항 변형 5-3) — 84×56칸, 16px

## 용도
항구 도시 서쪽 문에서 동쪽 산 마을로 이어지는 숲길 한 장. 밝은 활엽수 숲에서 시작해 사냥꾼 오두막 터,
개울 여울, 침엽수 어둠, 무너진 옛 성문을 차례로 지나 동쪽으로 나간다. 길 자체가 이야기의 순서다.
플레이어가 길을 벗어나 곁길로 들어가면 작은 볼거리 두 곳이 있다.

## 구역 (서 → 동)
1. 활엽수 숲 (x 0~22): 참나무 4×5·3×4 + 덤불 + 고사리. 길 옆 이정표(사냥꾼 표지 기둥)와 남쪽 곁길 갈림.
2. 사냥꾼 숲 터 (x 24~42): 지름 약 18칸의 트인 자리. 오두막(북쪽, 등을 숲에 댐) + 헛간·장작더미·도마·가죽 걸이·모닥불.
   집 문에서 큰길까지 짧은 앞길. 남쪽에 쓰러진 통나무, 그루터기.
3. 개울 여울 (x 48~51): 2칸 폭 개울이 북→남으로 흐른다. 큰길은 징검돌 4개로 건넌다(걸을 수 있음). 북쪽 곁길이 개울 옆 버섯 빈터로.
4. 침엽수 숲 (x 52~66): 전나무 위주, 어둡고 빽빽. 길이 좁고 그늘이 진다.
5. 옛 성문 (x 68~71): 길이 북쪽으로 꺾여 무너진 성문(64×56px)을 통과. 기둥 두 개가 막고 가운데 두 칸이 통로.
6. 동쪽 출구 (x 72~83): 전나무 사이로 동쪽 출구.

## 앵커·곁길
- 앵커 3: 사냥꾼 숲 터(오두막), 여울, 옛 성문.
- 곁길 2: (A) 남쪽, x≈12 갈림 → 야영지 웅덩이(모닥불·쓰러진 통나무 두 개·그루터기·버섯). (B) 북쪽, x≈42 → 버섯 빈터(그루터기 둘레 버섯 고리·돌무지·고사리).
- 이정표 2개: 서쪽 갈림 어귀(`hunter_post`, 사냥터 표지), 오두막 서쪽 들머리(`signpost` 키트).

## 동선

## 조각 표
번호 = 그림 `deep-forest-path-parts` 의 번호. 판정: after = 사용자가 AFTER 를 고름 · unpicked-after = 안 고름(AFTER) · before = BEFORE 사본 복원.
| # | 키트 | 이름 | 칸 | 종류 | 막힘 줄 | 판정 |
|---|---|---|---|---|---|---|
| 1 | `bd-pick-coast-cliff-road-fir-l` | 전나무 | 3×4 | 나무 | 1 | unpicked-after |
| 2 | `bd-pick-coast-cliff-road-fir-m` | 전나무 | 2×3 | 나무 | 1 | unpicked-after |
| 3 | `bd-pick-coast-cliff-road-fir-m2` | 전나무 | 2×3 | 나무 | 1 | unpicked-after |
| 4 | `bd-pick-coast-cliff-road-fir-s` | 전나무 | 2×3 | 나무 | 1 | unpicked-after |
| 5 | `bd-pick-deep-forest-path-cairn` | 돌탑 | 1×2 | 물체 | 1 | before |
| 6 | `bd-pick-deep-forest-path-cairn-s` | 돌탑 | 1×1 | 물체 | 1 | before |
| 7 | `bd-pick-deep-forest-path-campfire` | 모닥불 | 1×1 | 물체 | 1 | unpicked-after |
| 8 | `bd-pick-deep-forest-path-chopping-block` | 장작 패는 그루터기 | 1×1 | 물체 | 1 | after |
| 9 | `bd-pick-deep-forest-path-fern-a` | 고사리 A | 1×1 | 바닥 소품(걸음) | - | after |
| 10 | `bd-pick-deep-forest-path-fern-b` | 고사리 B | 1×1 | 바닥 소품(걸음) | - | after |
| 11 | `bd-pick-deep-forest-path-fern-c` | 고사리 C | 1×1 | 바닥 소품(걸음) | - | before |
| 12 | `bd-pick-deep-forest-path-heath-a` | 낮은 헤더 덤불 A | 1×1 | 바닥 소품(걸음) | - | after |
| 13 | `bd-pick-deep-forest-path-heath-b` | 낮은 헤더 덤불 B | 1×1 | 바닥 소품(걸음) | - | after |
| 14 | `bd-pick-deep-forest-path-heath-c` | 낮은 헤더 덤불 C | 1×1 | 바닥 소품(걸음) | - | before |
| 15 | `bd-pick-deep-forest-path-hide-rack` | 가죽 말림틀 | 2×2 | 물체 | 1 | before |
| 16 | `bd-pick-deep-forest-path-hunter-post` | 사냥 표지 기둥 | 1×2 | 물체 | 1 | after |
| 17 | `bd-pick-deep-forest-path-log-fallen` | 쓰러진 통나무 | 2×1 | 물체 | 1 | before |
| 18 | `bd-pick-deep-forest-path-ruin-gate` | 무너진 성문 | 4×4 | 물체 | 2 | before |
| 19 | `bd-pick-deep-forest-path-stones-a` | 징검돌 A | 1×1 | 바닥 소품(걸음) | - | before |
| 20 | `bd-pick-deep-forest-path-stones-b` | 징검돌 B | 1×1 | 바닥 소품(걸음) | - | before |
| 21 | `bd-pick-deep-forest-path-stones-c` | 징검돌 C | 1×1 | 바닥 소품(걸음) | - | before |
| 22 | `bd-pick-deep-forest-path-stump` | 그루터기 | 1×1 | 물체 | 1 | before |
| 23 | `bd-pick-deep-forest-path-toadstools-a` | 독버섯 A | 1×1 | 바닥 소품(걸음) | - | before |
| 24 | `bd-pick-deep-forest-path-toadstools-b` | 독버섯 B | 1×1 | 바닥 소품(걸음) | - | before |
| 25 | `bd-pick-deep-forest-path-toadstools-c` | 독버섯 C | 1×1 | 바닥 소품(걸음) | - | before |
| 26 | `bd-pick-deep-forest-path-wild-a` | 들꽃·고사리 무더기 A | 1×1 | 바닥 소품(걸음) | - | after |
| 27 | `bd-pick-deep-forest-path-wild-b` | 풀밭 들꽃 무더기 B | 1×1 | 바닥 소품(걸음) | - | before |
| 28 | `bd-pick-deep-forest-path-wild-c` | 풀밭 들꽃 무더기 C | 1×1 | 바닥 소품(걸음) | - | before |

## 칸 배열 (원점 = 키트 왼쪽 위, -1 = 그 층을 건드리지 않음)
역할 글자: `S` 윗부분 막힘(사람과 y 정렬) · `C` 윗부분 걸음 ★(사람 위에 그려짐) · `W` 윗부분 걸음(사람 아래, 다리·계단·바닥 얼룩) · `F` 땅 걸음 · `X` 땅 막힘 · `.` 빈 칸(-1, 찍는 자리의 그 층을 건드리지 않음).

### 1. `bd-pick-coast-cliff-road-fir-l` 전나무 3×4
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

### 2. `bd-pick-coast-cliff-road-fir-m` 전나무 2×3
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

### 3. `bd-pick-coast-cliff-road-fir-m2` 전나무 2×3
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

### 4. `bd-pick-coast-cliff-road-fir-s` 전나무 2×3
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

### 5. `bd-pick-deep-forest-path-cairn` 돌탑 1×2
역할 `C / S`
```
아래층
-1
-1
윗층
27535
27536
```

### 6. `bd-pick-deep-forest-path-cairn-s` 돌탑 1×1
역할 `S`
```
아래층
-1
윗층
27537
```

### 7. `bd-pick-deep-forest-path-campfire` 모닥불 1×1
역할 `S`
```
아래층
-1
윗층
27538
```

### 8. `bd-pick-deep-forest-path-chopping-block` 장작 패는 그루터기 1×1
역할 `S`
```
아래층
-1
윗층
27539
```

### 9. `bd-pick-deep-forest-path-fern-a` 고사리 A 1×1
역할 `W`
```
아래층
-1
윗층
27540
```

### 10. `bd-pick-deep-forest-path-fern-b` 고사리 B 1×1
역할 `W`
```
아래층
-1
윗층
27541
```

### 11. `bd-pick-deep-forest-path-fern-c` 고사리 C 1×1
역할 `W`
```
아래층
-1
윗층
27542
```

### 12. `bd-pick-deep-forest-path-heath-a` 낮은 헤더 덤불 A 1×1
역할 `W`
```
아래층
-1
윗층
27543
```

### 13. `bd-pick-deep-forest-path-heath-b` 낮은 헤더 덤불 B 1×1
역할 `W`
```
아래층
-1
윗층
27544
```

### 14. `bd-pick-deep-forest-path-heath-c` 낮은 헤더 덤불 C 1×1
역할 `W`
```
아래층
-1
윗층
27545
```

### 15. `bd-pick-deep-forest-path-hide-rack` 가죽 말림틀 2×2
역할 `CC / SS`
```
아래층
-1 -1
-1 -1
윗층
27546 27547
27548 27549
```

### 16. `bd-pick-deep-forest-path-hunter-post` 사냥 표지 기둥 1×2
역할 `C / S`
```
아래층
-1
-1
윗층
27550
27551
```

### 17. `bd-pick-deep-forest-path-log-fallen` 쓰러진 통나무 2×1
역할 `SS`
```
아래층
-1 -1
윗층
27552 27553
```

### 18. `bd-pick-deep-forest-path-ruin-gate` 무너진 성문 4×4
역할 `.... / CCCC / SSSS / SSSS`
```
아래층
-1 -1 -1 -1
-1 -1 -1 -1
-1 -1 -1 -1
-1 -1 -1 -1
윗층
-1 -1 -1 -1
27554 27555 27556 27557
27558 27559 27560 27561
27562 27563 27564 27565
```

### 19. `bd-pick-deep-forest-path-stones-a` 징검돌 A 1×1
역할 `W`
```
아래층
-1
윗층
27566
```

### 20. `bd-pick-deep-forest-path-stones-b` 징검돌 B 1×1
역할 `W`
```
아래층
-1
윗층
27567
```

### 21. `bd-pick-deep-forest-path-stones-c` 징검돌 C 1×1
역할 `W`
```
아래층
-1
윗층
27568
```

### 22. `bd-pick-deep-forest-path-stump` 그루터기 1×1
역할 `S`
```
아래층
-1
윗층
27569
```

### 23. `bd-pick-deep-forest-path-toadstools-a` 독버섯 A 1×1
역할 `W`
```
아래층
-1
윗층
27570
```

### 24. `bd-pick-deep-forest-path-toadstools-b` 독버섯 B 1×1
역할 `W`
```
아래층
-1
윗층
27571
```

### 25. `bd-pick-deep-forest-path-toadstools-c` 독버섯 C 1×1
역할 `W`
```
아래층
-1
윗층
27572
```

### 26. `bd-pick-deep-forest-path-wild-a` 들꽃·고사리 무더기 A 1×1
역할 `W`
```
아래층
-1
윗층
27573
```

### 27. `bd-pick-deep-forest-path-wild-b` 풀밭 들꽃 무더기 B 1×1
역할 `W`
```
아래층
-1
윗층
27574
```

### 28. `bd-pick-deep-forest-path-wild-c` 풀밭 들꽃 무더기 C 1×1
역할 `W`
```
아래층
-1
윗층
27575
```
