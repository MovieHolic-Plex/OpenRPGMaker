# 성 지하 감옥·카타콤 — 고른 조각 35종

tilesetId `beodeul_city` · 그림 `public/assets/beodeul-city/beodeul-city-chipset.png`(텍스처 `tex_beodeul_city`, 27648칸, 16px 칸, 한 줄 128칸 — 번호 n 의 칸은 행 n÷128, 열 n%128). 0~23935 은 버들항 도시 칸, 23936~27647 은 고른 장소 조각 칸(이 용도). 다른 칩셋 번호를 섞지 않는다.

## 원래 계획 (tiledata/beodeul-variants/castle-catacombs/plan.md 앞부분 — 목적·구역을 보고 새로 배치한다)
# 성 지하 감옥·카타콤 (castle-catacombs) — 계획

- 크기 56×42 (16px 칸, 1칸 = 1m). 3/4 시점, 빛은 왼쪽 위.
- 목적: 버들항 성 밑 감옥에서 시작해 고문실을 지나 카타콤 안쪽 뼈의 방 제단까지 내려가는 던전 한 판. 위쪽(성)은 석재 앞면(castle), 아래쪽(카타콤)은 벽감 앞면(cata).
- 규칙: 천장 밑에는 반드시 앞면 2~3칸(방 3, 복도 2). 천장은 어두운 3단 명암. 방은 복도로만 이어지고 고립 방 없음. 20×15 화면당 빈 바닥 40% 이하.

## 구역 (앵커)
| 코드 | 구역 | 위치(x,y,w,h) | 바닥 | 앞면 | 앵커 |
|---|---|---|---|---|---|
| E | 입구 계단실 | 20,35,16,6 | castle | castle | 북벽 위 계단(성으로 오르는 곳), 횃불 |
| CB | 감방동 | 3,20,22,10 | cell(칸) + castle(복도홀) | castle | 칸막이 벽 셋으로 나뉜 감방 4칸, 볏짚·쇠사슬·양동이, 간수 자리(탁자) |
| GR | 간수 대기실 | 3,35,13,6 | castle | castle | 술통·상자·모루탁자, 화로 |
| TR | 고문실 | 30,20,24,10 | darkcata | castle | 고문대 둘, 강철 처녀, 화로 넷, 매달린 새장, 배수 창살 |
| NG | 벽감 회랑 | 3,6,28,8 | cata | cata | 북벽 벽감 줄(해골·수의·항아리), 관, 석관, 촛불 |
| BC | 뼈의 방 | 36,4,18,12 | bone | cata | 뼈 더미, 해골, 뼈 제단 (최종 지점) |
| OS | 납골당 | 38,34,16,7 | darkcata | cata | 석관 여럿, 기둥 |

## 동선 (2칸 폭 복도)
입구 E → (23~24,30~34) → CB 홀 → (22~23,14~19) → NG → (31~35,9~10) → BC 최종.
지름길·순환: E → (31~32,30~34) → TR → (45~46,16~19) → BC. E → (36~37,37~38) → OS → (44~45,30~33) → TR. E → (16~19,37~38) → GR.
입구에서 최종 지점까지 grid.json BFS 로 걷힌다. 칸막이 벽은 벽 위 얇은 조각(앞면 세 칸)으로 남기고 감방은 홀 쪽으로 열려 있다.


## 조각 표
번호 = 그림 `castle-catacombs-parts` 의 번호. 판정: after = 사용자가 AFTER 를 고름 · unpicked-after = 안 고름(AFTER) · before = BEFORE 사본 복원.
| # | 키트 | 이름 | 칸 | 종류 | 막힘 줄 | 판정 |
|---|---|---|---|---|---|---|
| 1 | `bd-pick-aqueduct-sewer-banner-cult` | 교단 깃발 | 1×2 | 물체 | 1 | unpicked-after |
| 2 | `bd-pick-aqueduct-sewer-barrel` | 통 | 1×1 | 물체 | 1 | unpicked-after |
| 3 | `bd-pick-aqueduct-sewer-bone-heap` | 뼈 더미 | 2×2 | 물체 | 1 | unpicked-after |
| 4 | `bd-pick-aqueduct-sewer-bones` | 흩어진 뼈 | 1×1 | 바닥 소품(걸음) | - | unpicked-after |
| 5 | `bd-pick-aqueduct-sewer-brazier` | 화로 | 1×1 | 물체 | 1 | after |
| 6 | `bd-pick-aqueduct-sewer-bucket` | 양동이 | 1×1 | 물체 | 1 | after |
| 7 | `bd-pick-aqueduct-sewer-candles` | 촛불 세 자루 | 1×1 | 물체 | 1 | after |
| 8 | `bd-pick-aqueduct-sewer-ceiling` | 어두운 천장 + 밝은 테두리 | 3×3 | 벽 앞면·절벽·천장 표본 | - | after |
| 9 | `bd-pick-aqueduct-sewer-chains` | 벽에 걸린 사슬·수갑 | 1×1 | 물체 | 1 | unpicked-after |
| 10 | `bd-pick-aqueduct-sewer-coffin` | 관 | 2×2 | 물체 | 1 | unpicked-after |
| 11 | `bd-pick-aqueduct-sewer-crate` | 나무 상자 | 1×1 | 물체 | 1 | unpicked-after |
| 12 | `bd-pick-aqueduct-sewer-face-cata-2h` | 벽 앞면 카타콤 돌 2칸 높이 | 3×2 | 벽 앞면·절벽·천장 표본 | - | after |
| 13 | `bd-pick-aqueduct-sewer-face-cata-3h` | 벽 앞면 카타콤 돌 3칸 높이 | 3×3 | 벽 앞면·절벽·천장 표본 | - | after |
| 14 | `bd-pick-aqueduct-sewer-floor-bone` | 바닥 뼈 | 2×2 | 바닥 표본 | - | after |
| 15 | `bd-pick-aqueduct-sewer-floor-cata` | 바닥 카타콤 | 2×2 | 바닥 표본 | - | after |
| 16 | `bd-pick-aqueduct-sewer-floor-darkcata` | 바닥 어두운 카타콤 | 2×2 | 바닥 표본 | - | after |
| 17 | `bd-pick-aqueduct-sewer-grate-floor` | 바닥 쇠창살 | 1×1 | 바닥 표본 | - | unpicked-after |
| 18 | `bd-pick-aqueduct-sewer-skulls` | 해골 무더기 | 1×1 | 물체 | 1 | after |
| 19 | `bd-pick-aqueduct-sewer-stairs-up-face` | 벽 앞면에서 올라가는 계단 | 1×2 | 걸음 구조물(다리·계단·잔교) | - | unpicked-after |
| 20 | `bd-pick-aqueduct-sewer-torch-wall` | 벽 횃불 | 1×1 | 물체 | 1 | unpicked-after |
| 21 | `bd-pick-castle-catacombs-altar-stone` | 돌 제단 | 2×2 | 물체 | 1 | unpicked-after |
| 22 | `bd-pick-castle-catacombs-anvil-table` | 모루 탁자 | 2×2 | 물체 | 1 | unpicked-after |
| 23 | `bd-pick-castle-catacombs-cage-hanging` | 매달린 새장 | 1×2 | 물체 | 1 | after |
| 24 | `bd-pick-castle-catacombs-column-cata` | 카타콤 기둥 | 1×2 | 물체 | 1 | after |
| 25 | `bd-pick-castle-catacombs-face-castle-2h` | 벽 앞면 성 돌 2칸 높이 | 3×2 | 벽 앞면·절벽·천장 표본 | - | after |
| 26 | `bd-pick-castle-catacombs-face-castle-3h` | 벽 앞면 성 돌 3칸 높이 | 3×3 | 벽 앞면·절벽·천장 표본 | - | after |
| 27 | `bd-pick-castle-catacombs-floor-castle` | 바닥 성 | 2×2 | 바닥 표본 | - | unpicked-after |
| 28 | `bd-pick-castle-catacombs-floor-cell` | 바닥 감방 | 2×2 | 바닥 표본 | - | after |
| 29 | `bd-pick-castle-catacombs-iron-maiden` | 강철 처녀 | 1×2 | 물체 | 1 | after |
| 30 | `bd-pick-castle-catacombs-niche-shroud` | 벽감 | 1×1 | 물체 | 1 | unpicked-after |
| 31 | `bd-pick-castle-catacombs-niche-skull` | 벽감 | 1×1 | 물체 | 1 | unpicked-after |
| 32 | `bd-pick-castle-catacombs-niche-urn` | 벽감 | 1×1 | 물체 | 1 | unpicked-after |
| 33 | `bd-pick-castle-catacombs-rack-32` | 고문대 | 2×2 | 물체 | 1 | unpicked-after |
| 34 | `bd-pick-castle-catacombs-rubble` | 돌무더기 | 1×1 | 바닥 소품(걸음) | - | after |
| 35 | `bd-pick-castle-catacombs-straw-bed` | 볏짚 침상 | 1×1 | 물체 | 1 | after |

## 칸 배열 (원점 = 키트 왼쪽 위, -1 = 그 층을 건드리지 않음)
역할 글자: `S` 윗부분 막힘(사람과 y 정렬) · `C` 윗부분 걸음 ★(사람 위에 그려짐) · `W` 윗부분 걸음(사람 아래, 다리·계단·바닥 얼룩) · `F` 땅 걸음 · `X` 땅 막힘 · `.` 빈 칸(-1, 찍는 자리의 그 층을 건드리지 않음).

### 1. `bd-pick-aqueduct-sewer-banner-cult` 교단 깃발 1×2
역할 `C / S`
```
아래층
-1
-1
윗층
26578
26579
```

### 2. `bd-pick-aqueduct-sewer-barrel` 통 1×1
역할 `S`
```
아래층
-1
윗층
26580
```

### 3. `bd-pick-aqueduct-sewer-bone-heap` 뼈 더미 2×2
역할 `.. / SS`
```
아래층
-1 -1
-1 -1
윗층
-1 -1
26581 26582
```

### 4. `bd-pick-aqueduct-sewer-bones` 흩어진 뼈 1×1
역할 `W`
```
아래층
-1
윗층
26583
```

### 5. `bd-pick-aqueduct-sewer-brazier` 화로 1×1
역할 `S`
```
아래층
-1
윗층
26584
```

### 6. `bd-pick-aqueduct-sewer-bucket` 양동이 1×1
역할 `S`
```
아래층
-1
윗층
26587
```

### 7. `bd-pick-aqueduct-sewer-candles` 촛불 세 자루 1×1
역할 `S`
```
아래층
-1
윗층
26588
```

### 8. `bd-pick-aqueduct-sewer-ceiling` 어두운 천장 + 밝은 테두리 3×3
역할 `XXX / XXX / XXX`
```
아래층
26589 26590 26591
26592 26593 26594
26595 26596 26597
윗층
-1 -1 -1
-1 -1 -1
-1 -1 -1
```

### 9. `bd-pick-aqueduct-sewer-chains` 벽에 걸린 사슬·수갑 1×1
역할 `S`
```
아래층
-1
윗층
26598
```

### 10. `bd-pick-aqueduct-sewer-coffin` 관 2×2
역할 `CC / SS`
```
아래층
-1 -1
-1 -1
윗층
26599 26600
26601 26602
```

### 11. `bd-pick-aqueduct-sewer-crate` 나무 상자 1×1
역할 `S`
```
아래층
-1
윗층
26606
```

### 12. `bd-pick-aqueduct-sewer-face-cata-2h` 벽 앞면 카타콤 돌 2칸 높이 3×2
역할 `XXX / XXX`
```
아래층
26609 26610 26611
26612 26613 26614
윗층
-1 -1 -1
-1 -1 -1
```

### 13. `bd-pick-aqueduct-sewer-face-cata-3h` 벽 앞면 카타콤 돌 3칸 높이 3×3
역할 `XXX / XXX / XXX`
```
아래층
26609 26610 26611
26615 26616 26617
26618 26619 26620
윗층
-1 -1 -1
-1 -1 -1
-1 -1 -1
```

### 14. `bd-pick-aqueduct-sewer-floor-bone` 바닥 뼈 2×2
역할 `FF / FF`
```
아래층
26641 26642
26642 26643
윗층
-1 -1
-1 -1
```

### 15. `bd-pick-aqueduct-sewer-floor-cata` 바닥 카타콤 2×2
역할 `FF / FF`
```
아래층
26644 26645
26646 26645
윗층
-1 -1
-1 -1
```

### 16. `bd-pick-aqueduct-sewer-floor-darkcata` 바닥 어두운 카타콤 2×2
역할 `FF / FF`
```
아래층
26647 26648
26647 26649
윗층
-1 -1
-1 -1
```

### 17. `bd-pick-aqueduct-sewer-grate-floor` 바닥 쇠창살 1×1
역할 `W`
```
아래층
-1
윗층
26654
```

### 18. `bd-pick-aqueduct-sewer-skulls` 해골 무더기 1×1
역할 `S`
```
아래층
-1
윗층
26669
```

### 19. `bd-pick-aqueduct-sewer-stairs-up-face` 벽 앞면에서 올라가는 계단 1×2
역할 `F / F`
```
아래층
26670
26671
윗층
-1
-1
```

### 20. `bd-pick-aqueduct-sewer-torch-wall` 벽 횃불 1×1
역할 `S`
```
아래층
-1
윗층
26673
```

### 21. `bd-pick-castle-catacombs-altar-stone` 돌 제단 2×2
역할 `CC / SS`
```
아래층
-1 -1
-1 -1
윗층
26682 26683
26684 26685
```

### 22. `bd-pick-castle-catacombs-anvil-table` 모루 탁자 2×2
역할 `CC / SS`
```
아래층
-1 -1
-1 -1
윗층
26686 26687
26688 26689
```

### 23. `bd-pick-castle-catacombs-cage-hanging` 매달린 새장 1×2
역할 `C / S`
```
아래층
-1
-1
윗층
26690
26691
```

### 24. `bd-pick-castle-catacombs-column-cata` 카타콤 기둥 1×2
역할 `C / S`
```
아래층
-1
-1
윗층
26692
26693
```

### 25. `bd-pick-castle-catacombs-face-castle-2h` 벽 앞면 성 돌 2칸 높이 3×2
역할 `XXX / XXX`
```
아래층
26694 26695 26696
26697 26698 26699
윗층
-1 -1 -1
-1 -1 -1
```

### 26. `bd-pick-castle-catacombs-face-castle-3h` 벽 앞면 성 돌 3칸 높이 3×3
역할 `XXX / XXX / XXX`
```
아래층
26694 26695 26696
26700 26701 26702
26703 26704 26705
윗층
-1 -1 -1
-1 -1 -1
-1 -1 -1
```

### 27. `bd-pick-castle-catacombs-floor-castle` 바닥 성 2×2
역할 `FF / FF`
```
아래층
26706 26706
26707 26706
윗층
-1 -1
-1 -1
```

### 28. `bd-pick-castle-catacombs-floor-cell` 바닥 감방 2×2
역할 `FF / FF`
```
아래층
26708 26709
26710 26710
윗층
-1 -1
-1 -1
```

### 29. `bd-pick-castle-catacombs-iron-maiden` 강철 처녀 1×2
역할 `C / S`
```
아래층
-1
-1
윗층
26711
26712
```

### 30. `bd-pick-castle-catacombs-niche-shroud` 벽감 1×1
역할 `S`
```
아래층
-1
윗층
26713
```

### 31. `bd-pick-castle-catacombs-niche-skull` 벽감 1×1
역할 `S`
```
아래층
-1
윗층
26714
```

### 32. `bd-pick-castle-catacombs-niche-urn` 벽감 1×1
역할 `S`
```
아래층
-1
윗층
26715
```

### 33. `bd-pick-castle-catacombs-rack-32` 고문대 2×2
역할 `CC / SS`
```
아래층
-1 -1
-1 -1
윗층
26716 26717
26718 26719
```

### 34. `bd-pick-castle-catacombs-rubble` 돌무더기 1×1
역할 `W`
```
아래층
-1
윗층
26720
```

### 35. `bd-pick-castle-catacombs-straw-bed` 볏짚 침상 1×1
역할 `S`
```
아래층
-1
윗층
26721
```
