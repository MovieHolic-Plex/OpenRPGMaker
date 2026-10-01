# 지하 수도교·하수도 — 고른 조각 45종

tilesetId `beodeul_city` · 그림 `public/assets/beodeul-city/beodeul-city-chipset.png`(텍스처 `tex_beodeul_city`, 27648칸, 16px 칸, 한 줄 128칸 — 번호 n 의 칸은 행 n÷128, 열 n%128). 0~23935 은 버들항 도시 칸, 23936~27647 은 고른 장소 조각 칸(이 용도). 다른 칩셋 번호를 섞지 않는다.

## 원래 계획 (tiledata/beodeul-variants/aqueduct-sewer/plan.md 앞부분 — 목적·구역을 보고 새로 배치한다)
# 버들항 지하 수도교·하수도 (aqueduct-sewer) — 계획

60×44칸 (960×704px). 버들항 도시 밑을 흐르는 로마식 수도교의 배수로. 3/4 시점, 1칸=16px=1m, 빛 왼쪽 위.

## 목적
- 버들항 대로 밑으로 내려와(입구 계단) 수도교 본수로를 따라 걷고, 다리로 건너, 교단이 숨긴 제단(비밀문)에 닿는 던전.
- 플레이어가 배우는 것: 물길은 못 건넌다 → 다리를 찾는다 / 벽 앞면 이음매가 다른 돌은 비밀문 / 밸브방은 수위(물길) 장치.

## 구역 (7곳 + 방 사이 복도)
| 이름 | 위치(칸) | 크기 | 용도 |
|---|---|---|---|
| E 입구 계단 홀 | x3–11, y34–41 | 9×8 | 대로로 올라가는 계단(벽 앞면) · 시작점 |
| C 본수로 홀 | x6–49, y18–25 (물 y20–23, 보도 y18–19·24–25) | 44×8 | 남북 보도 + 가운데 물길 + 다리 2 + 섬(밸브 대) |
| V 밸브실 | x8–21, y5–12 | 14×8 | 큰 매니폴드·밸브 바퀴·구리관, 수위 장치 |
| CI 저수조 | x26–44, y5–12 | 19×8 | 고인 물 + 둘레 보도 + 기둥 + 가운데 다리 |
| S 밀수 창고 | x18–30, y34–41 | 13×8 | 나무판자 바닥, 통·상자·침상 |
| W 수문실 | x36–48, y34–41 | 13×8 | 북벽 아치에서 쏟아지는 물 + 웅덩이 + 다리 |
| CA 교단 전실 | x52–57, y18–25 | 6×8 | 깃발·화로·촛불, 북벽 앞면에 비밀문 |
| AR 숨은 제단 (끝) | x48–57, y5–14 | 10×10 | 교단 제단·향로·깃발 — 최종 목적지 |
| R 폐기 구덩이 | x52–57, y36–41 | 6×6 | 교단이 버린 것: 뼈·해골 · 막다른 곳 |

## 앵커(눈에 띄는 것)

## 조각 표
번호 = 그림 `aqueduct-sewer-parts` 의 번호. 판정: after = 사용자가 AFTER 를 고름 · unpicked-after = 안 고름(AFTER) · before = BEFORE 사본 복원.
| # | 키트 | 이름 | 칸 | 종류 | 막힘 줄 | 판정 |
|---|---|---|---|---|---|---|
| 1 | `bd-pick-aqueduct-sewer-altar-cult` | 교단 제단 | 2×2 | 물체 | 1 | after |
| 2 | `bd-pick-aqueduct-sewer-arch-bars` | 벽 아치 | 2×2 | 물체 | 1 | after |
| 3 | `bd-pick-aqueduct-sewer-arch-dark` | 벽 아치 | 2×2 | 물체 | 1 | after |
| 4 | `bd-pick-aqueduct-sewer-arch-water` | 벽 아치 | 2×2 | 물체 | 1 | after |
| 5 | `bd-pick-aqueduct-sewer-banner-cult` | 교단 깃발 | 1×2 | 물체 | 1 | unpicked-after |
| 6 | `bd-pick-aqueduct-sewer-barrel` | 통 | 1×1 | 물체 | 1 | unpicked-after |
| 7 | `bd-pick-aqueduct-sewer-bone-heap` | 뼈 더미 | 2×2 | 물체 | 1 | unpicked-after |
| 8 | `bd-pick-aqueduct-sewer-bones` | 흩어진 뼈 | 1×1 | 바닥 소품(걸음) | - | unpicked-after |
| 9 | `bd-pick-aqueduct-sewer-brazier` | 화로 | 1×1 | 물체 | 1 | after |
| 10 | `bd-pick-aqueduct-sewer-bridge-ew-stone` | 돌다리 동서 방향 한 칸 | 1×1 | 걸음 구조물(다리·계단·잔교) | - | unpicked-after |
| 11 | `bd-pick-aqueduct-sewer-bridge-ns-stone` | 돌다리 남북 방향 한 칸 | 1×1 | 걸음 구조물(다리·계단·잔교) | - | unpicked-after |
| 12 | `bd-pick-aqueduct-sewer-bucket` | 양동이 | 1×1 | 물체 | 1 | after |
| 13 | `bd-pick-aqueduct-sewer-candles` | 촛불 세 자루 | 1×1 | 물체 | 1 | after |
| 14 | `bd-pick-aqueduct-sewer-ceiling` | 어두운 천장 + 밝은 테두리 | 3×3 | 벽 앞면·절벽·천장 표본 | - | after |
| 15 | `bd-pick-aqueduct-sewer-chains` | 벽에 걸린 사슬·수갑 | 1×1 | 물체 | 1 | unpicked-after |
| 16 | `bd-pick-aqueduct-sewer-coffin` | 관 | 2×2 | 물체 | 1 | unpicked-after |
| 17 | `bd-pick-aqueduct-sewer-column-sewer` | 벽 앞에 선 돌 기둥 | 1×2 | 물체 | 1 | after |
| 18 | `bd-pick-aqueduct-sewer-column-sewer-broken` | 부러진 돌 기둥 그루터기 | 1×2 | 물체 | 1 | after |
| 19 | `bd-pick-aqueduct-sewer-crate` | 나무 상자 | 1×1 | 물체 | 1 | unpicked-after |
| 20 | `bd-pick-aqueduct-sewer-crate-stack` | 쌓은 나무 상자 | 1×2 | 물체 | 1 | unpicked-after |
| 21 | `bd-pick-aqueduct-sewer-face-cata-2h` | 벽 앞면 카타콤 돌 2칸 높이 | 3×2 | 벽 앞면·절벽·천장 표본 | - | after |
| 22 | `bd-pick-aqueduct-sewer-face-cata-3h` | 벽 앞면 카타콤 돌 3칸 높이 | 3×3 | 벽 앞면·절벽·천장 표본 | - | after |
| 23 | `bd-pick-aqueduct-sewer-face-sewer-1h` | face_sewer_1h | 3×1 | 벽 앞면·절벽·천장 표본 | - | unpicked-after |
| 24 | `bd-pick-aqueduct-sewer-face-sewer-2h` | 벽 앞면 하수도 돌 2칸 높이 | 3×2 | 벽 앞면·절벽·천장 표본 | - | after |
| 25 | `bd-pick-aqueduct-sewer-face-sewer-3h` | 벽 앞면 하수도 돌 3칸 높이 | 3×3 | 벽 앞면·절벽·천장 표본 | - | after |
| 26 | `bd-pick-aqueduct-sewer-fallen-column` | 쓰러진 돌 기둥 | 2×1 | 물체 | 1 | unpicked-after |
| 27 | `bd-pick-aqueduct-sewer-floor-bone` | 바닥 뼈 | 2×2 | 바닥 표본 | - | after |
| 28 | `bd-pick-aqueduct-sewer-floor-cata` | 바닥 카타콤 | 2×2 | 바닥 표본 | - | after |
| 29 | `bd-pick-aqueduct-sewer-floor-darkcata` | 바닥 어두운 카타콤 | 2×2 | 바닥 표본 | - | after |
| 30 | `bd-pick-aqueduct-sewer-floor-plank` | 바닥 널빤지 | 2×2 | 바닥 표본 | - | after |
| 31 | `bd-pick-aqueduct-sewer-floor-sewer` | 바닥 하수도 | 2×2 | 바닥 표본 | - | unpicked-after |
| 32 | `bd-pick-aqueduct-sewer-grate-floor` | 바닥 쇠창살 | 1×1 | 바닥 표본 | - | unpicked-after |
| 33 | `bd-pick-aqueduct-sewer-lantern-post` | 등불 기둥 | 1×2 | 물체 | 1 | after |
| 34 | `bd-pick-aqueduct-sewer-manifold-3` | 방을 가로지르는 큰 구리 매니폴드 + 밸 | 3×2 | 물체 | 1 | unpicked-after |
| 35 | `bd-pick-aqueduct-sewer-pipe-copper` | 벽 앞면을 가로지르는 구리 관 한 칸 | 1×1 | 물체 | 1 | unpicked-after |
| 36 | `bd-pick-aqueduct-sewer-pipe-copper-elbow` | 구리 관 | 1×1 | 물체 | 1 | unpicked-after |
| 37 | `bd-pick-aqueduct-sewer-pipe-copper-leak` | 구리 관 | 1×1 | 물체 | 1 | unpicked-after |
| 38 | `bd-pick-aqueduct-sewer-rubble` | 무너진 돌 부스러기 | 1×1 | 바닥 소품(걸음) | - | before |
| 39 | `bd-pick-aqueduct-sewer-secret-door` | 비밀문 | 1×2 | 물체 | 1 | unpicked-after |
| 40 | `bd-pick-aqueduct-sewer-skulls` | 해골 무더기 | 1×1 | 물체 | 1 | after |
| 41 | `bd-pick-aqueduct-sewer-stairs-up-face` | 벽 앞면에서 올라가는 계단 | 1×2 | 걸음 구조물(다리·계단·잔교) | - | unpicked-after |
| 42 | `bd-pick-aqueduct-sewer-straw-bed` | 짚 침상 | 1×1 | 물체 | 1 | after |
| 43 | `bd-pick-aqueduct-sewer-torch-wall` | 벽 횃불 | 1×1 | 물체 | 1 | unpicked-after |
| 44 | `bd-pick-aqueduct-sewer-valve-wheel` | 바닥에서 솟은 배관 + 밸브 바퀴 | 1×2 | 물체 | 1 | after |
| 45 | `bd-pick-aqueduct-sewer-water-sew` | 물 하수 | 3×2 | 물·용암 표본 | - | unpicked-after |

## 칸 배열 (원점 = 키트 왼쪽 위, -1 = 그 층을 건드리지 않음)
역할 글자: `S` 윗부분 막힘(사람과 y 정렬) · `C` 윗부분 걸음 ★(사람 위에 그려짐) · `W` 윗부분 걸음(사람 아래, 다리·계단·바닥 얼룩) · `F` 땅 걸음 · `X` 땅 막힘 · `.` 빈 칸(-1, 찍는 자리의 그 층을 건드리지 않음).

### 1. `bd-pick-aqueduct-sewer-altar-cult` 교단 제단 2×2
역할 `CC / SS`
```
아래층
-1 -1
-1 -1
윗층
26564 26565
26566 26567
```

### 2. `bd-pick-aqueduct-sewer-arch-bars` 벽 아치 2×2
역할 `CC / SS`
```
아래층
-1 -1
-1 -1
윗층
26568 26569
26570 26571
```

### 3. `bd-pick-aqueduct-sewer-arch-dark` 벽 아치 2×2
역할 `CC / SS`
```
아래층
-1 -1
-1 -1
윗층
26572 26573
26574 26575
```

### 4. `bd-pick-aqueduct-sewer-arch-water` 벽 아치 2×2
역할 `CC / SS`
```
아래층
-1 -1
-1 -1
윗층
26572 26573
26576 26577
```

### 5. `bd-pick-aqueduct-sewer-banner-cult` 교단 깃발 1×2
역할 `C / S`
```
아래층
-1
-1
윗층
26578
26579
```

### 6. `bd-pick-aqueduct-sewer-barrel` 통 1×1
역할 `S`
```
아래층
-1
윗층
26580
```

### 7. `bd-pick-aqueduct-sewer-bone-heap` 뼈 더미 2×2
역할 `.. / SS`
```
아래층
-1 -1
-1 -1
윗층
-1 -1
26581 26582
```

### 8. `bd-pick-aqueduct-sewer-bones` 흩어진 뼈 1×1
역할 `W`
```
아래층
-1
윗층
26583
```

### 9. `bd-pick-aqueduct-sewer-brazier` 화로 1×1
역할 `S`
```
아래층
-1
윗층
26584
```

### 10. `bd-pick-aqueduct-sewer-bridge-ew-stone` 돌다리 동서 방향 한 칸 1×1
역할 `F`
```
아래층
26585
윗층
-1
```

### 11. `bd-pick-aqueduct-sewer-bridge-ns-stone` 돌다리 남북 방향 한 칸 1×1
역할 `F`
```
아래층
26586
윗층
-1
```

### 12. `bd-pick-aqueduct-sewer-bucket` 양동이 1×1
역할 `S`
```
아래층
-1
윗층
26587
```

### 13. `bd-pick-aqueduct-sewer-candles` 촛불 세 자루 1×1
역할 `S`
```
아래층
-1
윗층
26588
```

### 14. `bd-pick-aqueduct-sewer-ceiling` 어두운 천장 + 밝은 테두리 3×3
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

### 15. `bd-pick-aqueduct-sewer-chains` 벽에 걸린 사슬·수갑 1×1
역할 `S`
```
아래층
-1
윗층
26598
```

### 16. `bd-pick-aqueduct-sewer-coffin` 관 2×2
역할 `CC / SS`
```
아래층
-1 -1
-1 -1
윗층
26599 26600
26601 26602
```

### 17. `bd-pick-aqueduct-sewer-column-sewer` 벽 앞에 선 돌 기둥 1×2
역할 `C / S`
```
아래층
-1
-1
윗층
26603
26604
```

### 18. `bd-pick-aqueduct-sewer-column-sewer-broken` 부러진 돌 기둥 그루터기 1×2
역할 `. / S`
```
아래층
-1
-1
윗층
-1
26605
```

### 19. `bd-pick-aqueduct-sewer-crate` 나무 상자 1×1
역할 `S`
```
아래층
-1
윗층
26606
```

### 20. `bd-pick-aqueduct-sewer-crate-stack` 쌓은 나무 상자 1×2
역할 `C / S`
```
아래층
-1
-1
윗층
26607
26608
```

### 21. `bd-pick-aqueduct-sewer-face-cata-2h` 벽 앞면 카타콤 돌 2칸 높이 3×2
역할 `XXX / XXX`
```
아래층
26609 26610 26611
26612 26613 26614
윗층
-1 -1 -1
-1 -1 -1
```

### 22. `bd-pick-aqueduct-sewer-face-cata-3h` 벽 앞면 카타콤 돌 3칸 높이 3×3
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

### 23. `bd-pick-aqueduct-sewer-face-sewer-1h` face_sewer_1h 3×1
역할 `XXX`
```
아래층
26621 26622 26623
윗층
-1 -1 -1
```

### 24. `bd-pick-aqueduct-sewer-face-sewer-2h` 벽 앞면 하수도 돌 2칸 높이 3×2
역할 `XXX / XXX`
```
아래층
26624 26625 26626
26627 26628 26629
윗층
-1 -1 -1
-1 -1 -1
```

### 25. `bd-pick-aqueduct-sewer-face-sewer-3h` 벽 앞면 하수도 돌 3칸 높이 3×3
역할 `XXX / XXX / XXX`
```
아래층
26630 26631 26632
26633 26634 26635
26636 26637 26638
윗층
-1 -1 -1
-1 -1 -1
-1 -1 -1
```

### 26. `bd-pick-aqueduct-sewer-fallen-column` 쓰러진 돌 기둥 2×1
역할 `SS`
```
아래층
-1 -1
윗층
26639 26640
```

### 27. `bd-pick-aqueduct-sewer-floor-bone` 바닥 뼈 2×2
역할 `FF / FF`
```
아래층
26641 26642
26642 26643
윗층
-1 -1
-1 -1
```

### 28. `bd-pick-aqueduct-sewer-floor-cata` 바닥 카타콤 2×2
역할 `FF / FF`
```
아래층
26644 26645
26646 26645
윗층
-1 -1
-1 -1
```

### 29. `bd-pick-aqueduct-sewer-floor-darkcata` 바닥 어두운 카타콤 2×2
역할 `FF / FF`
```
아래층
26647 26648
26647 26649
윗층
-1 -1
-1 -1
```

### 30. `bd-pick-aqueduct-sewer-floor-plank` 바닥 널빤지 2×2
역할 `FF / FF`
```
아래층
26650 26650
26651 26650
윗층
-1 -1
-1 -1
```

### 31. `bd-pick-aqueduct-sewer-floor-sewer` 바닥 하수도 2×2
역할 `FF / FF`
```
아래층
26652 26653
26652 26652
윗층
-1 -1
-1 -1
```

### 32. `bd-pick-aqueduct-sewer-grate-floor` 바닥 쇠창살 1×1
역할 `W`
```
아래층
-1
윗층
26654
```

### 33. `bd-pick-aqueduct-sewer-lantern-post` 등불 기둥 1×2
역할 `C / S`
```
아래층
-1
-1
윗층
26655
26656
```

### 34. `bd-pick-aqueduct-sewer-manifold-3` 방을 가로지르는 큰 구리 매니폴드 + 밸 3×2
역할 `CCC / SSS`
```
아래층
-1 -1 -1
-1 -1 -1
윗층
26657 26658 26659
26660 26661 26662
```

### 35. `bd-pick-aqueduct-sewer-pipe-copper` 벽 앞면을 가로지르는 구리 관 한 칸 1×1
역할 `S`
```
아래층
-1
윗층
26663
```

### 36. `bd-pick-aqueduct-sewer-pipe-copper-elbow` 구리 관 1×1
역할 `S`
```
아래층
-1
윗층
26664
```

### 37. `bd-pick-aqueduct-sewer-pipe-copper-leak` 구리 관 1×1
역할 `S`
```
아래층
-1
윗층
26665
```

### 38. `bd-pick-aqueduct-sewer-rubble` 무너진 돌 부스러기 1×1
역할 `W`
```
아래층
-1
윗층
26666
```

### 39. `bd-pick-aqueduct-sewer-secret-door` 비밀문 1×2
역할 `C / S`
```
아래층
-1
-1
윗층
26667
26668
```

### 40. `bd-pick-aqueduct-sewer-skulls` 해골 무더기 1×1
역할 `S`
```
아래층
-1
윗층
26669
```

### 41. `bd-pick-aqueduct-sewer-stairs-up-face` 벽 앞면에서 올라가는 계단 1×2
역할 `F / F`
```
아래층
26670
26671
윗층
-1
-1
```

### 42. `bd-pick-aqueduct-sewer-straw-bed` 짚 침상 1×1
역할 `S`
```
아래층
-1
윗층
26672
```

### 43. `bd-pick-aqueduct-sewer-torch-wall` 벽 횃불 1×1
역할 `S`
```
아래층
-1
윗층
26673
```

### 44. `bd-pick-aqueduct-sewer-valve-wheel` 바닥에서 솟은 배관 + 밸브 바퀴 1×2
역할 `C / S`
```
아래층
-1
-1
윗층
26674
26675
```

### 45. `bd-pick-aqueduct-sewer-water-sew` 물 하수 3×2
역할 `XXX / XXX`
```
아래층
26676 26677 26678
26679 26680 26681
윗층
-1 -1 -1
-1 -1 -1
```
