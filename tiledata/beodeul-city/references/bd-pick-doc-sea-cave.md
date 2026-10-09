# 바다 동굴 — 고른 조각 27종

tilesetId `beodeul_city` · 그림 `public/assets/beodeul-city/beodeul-city-chipset.png`(텍스처 `tex_beodeul_city`, 27648칸, 16px 칸, 한 줄 128칸 — 번호 n 의 칸은 행 n÷128, 열 n%128). 0~23935 은 버들항 도시 칸, 23936~27647 은 고른 장소 조각 칸(이 용도). 다른 칩셋 번호를 섞지 않는다.

## 원래 계획 (tiledata/beodeul-variants/sea-cave/plan.md 앞부분 — 목적·구역을 보고 새로 배치한다)
# 바다 동굴 (sea-cave) — 계획

크기 56×42 (칸 16px = 1m). 3/4 시점, 왼쪽 위 빛, 동굴 벽은 천장 밑에 앞면 2~3칸.

## 목적
버들항 방파제 밑 절벽 틈으로 바닷물이 들어오는 동굴. 해변으로 들어와 조간대 웅덩이 동굴을 지나
기둥 홀을 거쳐 밀수꾼의 은닉처(최종 지점)에 닿는다. 가지 길로 밀수 부두(바다와 이어짐)와 발광 이끼방이 있다.

## 구역 (앵커)
| 구역 | 좌표 | 성격 | 앵커 |
|---|---|---|---|
| BE 해변 | x34–53, y32–40 | 바깥. 모래·젖은 모래, 바다에 이어짐 | 난파 배 조각, 유목, 바다 |
| SEA 바다 | x0–33, y34–41 | 물 (걷지 못함), 맵 가장자리로 이어짐 | 물결·거품 |
| TG 조간대 동굴 | x22–47, y19–27 | 웅덩이 사이 젖은 모래 길 | 조수 웅덩이 4개, 발광 버섯 |
| DK 밀수 부두 | x2–17, y23–33 | 널판 부두 + 바다로 뻗은 잔교 | 정박한 배, 그물, 등불 |
| MC 발광 이끼방 | x3–17, y5–16 | 청록 이끼·버섯 | 이끼 무리, 종유석 |
| PH 기둥 홀 | x20–36, y6–14 | 바위 기둥 + 중앙 조수 웅덩이 | 바위 기둥 6개 |
| SC 은닉처 | x42–53, y4–13 | 밀수품 창고 (최종) | 궤·통 더미, 등불 |

## 길 (막다른 방 없음)
- 입구 (50,38) → BE → 복도 (42–43, 28–31) → TG
- TG → 복도 (28–29, 15–18) → PH → 복도 (37–41, 8–9) → SC (최종 지점 (47,8))

## 조각 표
번호 = 그림 `sea-cave-parts` 의 번호. 판정: after = 사용자가 AFTER 를 고름 · unpicked-after = 안 고름(AFTER) · before = BEFORE 사본 복원.
| # | 키트 | 이름 | 칸 | 종류 | 막힘 줄 | 판정 |
|---|---|---|---|---|---|---|
| 1 | `bd-pick-aqueduct-sewer-arch-dark` | 벽 아치 | 2×2 | 물체 | 1 | after |
| 2 | `bd-pick-aqueduct-sewer-barrel` | 통 | 1×1 | 물체 | 1 | unpicked-after |
| 3 | `bd-pick-aqueduct-sewer-bones` | 흩어진 뼈 | 1×1 | 바닥 소품(걸음) | - | unpicked-after |
| 4 | `bd-pick-aqueduct-sewer-bucket` | 양동이 | 1×1 | 물체 | 1 | after |
| 5 | `bd-pick-aqueduct-sewer-chains` | 벽에 걸린 사슬·수갑 | 1×1 | 물체 | 1 | unpicked-after |
| 6 | `bd-pick-aqueduct-sewer-crate` | 나무 상자 | 1×1 | 물체 | 1 | unpicked-after |
| 7 | `bd-pick-aqueduct-sewer-floor-plank` | 바닥 널빤지 | 2×2 | 바닥 표본 | - | after |
| 8 | `bd-pick-aqueduct-sewer-lantern-post` | 등불 기둥 | 1×2 | 물체 | 1 | after |
| 9 | `bd-pick-aqueduct-sewer-torch-wall` | 벽 횃불 | 1×1 | 물체 | 1 | unpicked-after |
| 10 | `bd-pick-sea-cave-boat` | 작은 배 | 2×2 | 물체 | 1 | unpicked-after |
| 11 | `bd-pick-sea-cave-ceiling-cave` | 어두운 천장 + 밝은 테두리 | 3×3 | 벽 앞면·절벽·천장 표본 | - | after |
| 12 | `bd-pick-sea-cave-dock-post` | 부두 말뚝 | 1×2 | 물체 | 1 | after |
| 13 | `bd-pick-sea-cave-driftwood` | 유목 | 2×1 | 물체 | 1 | after |
| 14 | `bd-pick-sea-cave-face-cave-2h` | 벽 앞면 동굴 돌 2칸 높이 | 3×2 | 벽 앞면·절벽·천장 표본 | - | after |
| 15 | `bd-pick-sea-cave-face-cave-3h` | 벽 앞면 동굴 돌 3칸 높이 | 3×3 | 벽 앞면·절벽·천장 표본 | - | after |
| 16 | `bd-pick-sea-cave-fish-net` | 말리는 그물 | 1×1 | 물체 | 1 | unpicked-after |
| 17 | `bd-pick-sea-cave-floor-cave` | 바닥 동굴 | 2×2 | 바닥 표본 | - | after |
| 18 | `bd-pick-sea-cave-floor-sand` | 바닥 모래 | 2×2 | 바닥 표본 | - | unpicked-after |
| 19 | `bd-pick-sea-cave-floor-wetsand` | 바닥 젖은 모래 | 2×2 | 바닥 표본 | - | unpicked-after |
| 20 | `bd-pick-sea-cave-glow-moss-floor` | 발광 이끼 | 1×1 | 바닥 표본 | - | unpicked-after |
| 21 | `bd-pick-sea-cave-glow-mushroom` | 발광 버섯 | 1×1 | 물체 | 1 | unpicked-after |
| 22 | `bd-pick-sea-cave-rock-pillar-2` | 바위 기둥 | 2×2 | 물체 | 1 | unpicked-after |
| 23 | `bd-pick-sea-cave-rubble-cave` | 바위 부스러기 | 1×1 | 바닥 소품(걸음) | - | after |
| 24 | `bd-pick-sea-cave-stalagmite-1` | 석순 | 1×2 | 물체 | 1 | unpicked-after |
| 25 | `bd-pick-sea-cave-vines-2` | 늘어진 덩굴 | 1×2 | 물체 | 1 | unpicked-after |
| 26 | `bd-pick-sea-cave-water-sea` | 물 바다 | 3×2 | 물·용암 표본 | - | unpicked-after |
| 27 | `bd-pick-sea-cave-water-tide` | 물 밀물 | 3×2 | 물·용암 표본 | - | unpicked-after |

## 칸 배열 (원점 = 키트 왼쪽 위, -1 = 그 층을 건드리지 않음)
역할 글자: `S` 윗부분 막힘(사람과 y 정렬) · `C` 윗부분 걸음 ★(사람 위에 그려짐) · `W` 윗부분 걸음(사람 아래, 다리·계단·바닥 얼룩) · `F` 땅 걸음 · `X` 땅 막힘 · `.` 빈 칸(-1, 찍는 자리의 그 층을 건드리지 않음).

### 1. `bd-pick-aqueduct-sewer-arch-dark` 벽 아치 2×2
역할 `CC / SS`
```
아래층
-1 -1
-1 -1
윗층
26572 26573
26574 26575
```

### 2. `bd-pick-aqueduct-sewer-barrel` 통 1×1
역할 `S`
```
아래층
-1
윗층
26580
```

### 3. `bd-pick-aqueduct-sewer-bones` 흩어진 뼈 1×1
역할 `W`
```
아래층
-1
윗층
26583
```

### 4. `bd-pick-aqueduct-sewer-bucket` 양동이 1×1
역할 `S`
```
아래층
-1
윗층
26587
```

### 5. `bd-pick-aqueduct-sewer-chains` 벽에 걸린 사슬·수갑 1×1
역할 `S`
```
아래층
-1
윗층
26598
```

### 6. `bd-pick-aqueduct-sewer-crate` 나무 상자 1×1
역할 `S`
```
아래층
-1
윗층
26606
```

### 7. `bd-pick-aqueduct-sewer-floor-plank` 바닥 널빤지 2×2
역할 `FF / FF`
```
아래층
26650 26650
26651 26650
윗층
-1 -1
-1 -1
```

### 8. `bd-pick-aqueduct-sewer-lantern-post` 등불 기둥 1×2
역할 `C / S`
```
아래층
-1
-1
윗층
26655
26656
```

### 9. `bd-pick-aqueduct-sewer-torch-wall` 벽 횃불 1×1
역할 `S`
```
아래층
-1
윗층
26673
```

### 10. `bd-pick-sea-cave-boat` 작은 배 2×2
역할 `CC / SS`
```
아래층
-1 -1
-1 -1
윗층
26722 26723
26724 26725
```

### 11. `bd-pick-sea-cave-ceiling-cave` 어두운 천장 + 밝은 테두리 3×3
역할 `XXX / XXX / XXX`
```
아래층
26726 26727 26728
26729 26730 26731
26732 26733 26734
윗층
-1 -1 -1
-1 -1 -1
-1 -1 -1
```

### 12. `bd-pick-sea-cave-dock-post` 부두 말뚝 1×2
역할 `C / S`
```
아래층
-1
-1
윗층
26735
26736
```

### 13. `bd-pick-sea-cave-driftwood` 유목 2×1
역할 `SS`
```
아래층
-1 -1
윗층
26737 26738
```

### 14. `bd-pick-sea-cave-face-cave-2h` 벽 앞면 동굴 돌 2칸 높이 3×2
역할 `XXX / XXX`
```
아래층
26739 26740 26741
26742 26743 26744
윗층
-1 -1 -1
-1 -1 -1
```

### 15. `bd-pick-sea-cave-face-cave-3h` 벽 앞면 동굴 돌 3칸 높이 3×3
역할 `XXX / XXX / XXX`
```
아래층
26739 26740 26741
26745 26746 26747
26748 26749 26750
윗층
-1 -1 -1
-1 -1 -1
-1 -1 -1
```

### 16. `bd-pick-sea-cave-fish-net` 말리는 그물 1×1
역할 `S`
```
아래층
-1
윗층
26751
```

### 17. `bd-pick-sea-cave-floor-cave` 바닥 동굴 2×2
역할 `FF / FF`
```
아래층
26752 26753
26754 26755
윗층
-1 -1
-1 -1
```

### 18. `bd-pick-sea-cave-floor-sand` 바닥 모래 2×2
역할 `FF / FF`
```
아래층
26756 26757
26757 26758
윗층
-1 -1
-1 -1
```

### 19. `bd-pick-sea-cave-floor-wetsand` 바닥 젖은 모래 2×2
역할 `FF / FF`
```
아래층
26759 26759
26760 26761
윗층
-1 -1
-1 -1
```

### 20. `bd-pick-sea-cave-glow-moss-floor` 발광 이끼 1×1
역할 `W`
```
아래층
-1
윗층
26762
```

### 21. `bd-pick-sea-cave-glow-mushroom` 발광 버섯 1×1
역할 `S`
```
아래층
-1
윗층
26763
```

### 22. `bd-pick-sea-cave-rock-pillar-2` 바위 기둥 2×2
역할 `CC / SS`
```
아래층
-1 -1
-1 -1
윗층
26764 26765
26766 26767
```

### 23. `bd-pick-sea-cave-rubble-cave` 바위 부스러기 1×1
역할 `W`
```
아래층
-1
윗층
26768
```

### 24. `bd-pick-sea-cave-stalagmite-1` 석순 1×2
역할 `C / S`
```
아래층
-1
-1
윗층
26769
26770
```

### 25. `bd-pick-sea-cave-vines-2` 늘어진 덩굴 1×2
역할 `C / S`
```
아래층
-1
-1
윗층
26771
26772
```

### 26. `bd-pick-sea-cave-water-sea` 물 바다 3×2
역할 `XXX / XXX`
```
아래층
26773 26774 26775
26776 26777 26778
윗층
-1 -1 -1
-1 -1 -1
```

### 27. `bd-pick-sea-cave-water-tide` 물 밀물 3×2
역할 `XXX / XXX`
```
아래층
26779 26780 26781
26782 26783 26784
윗층
-1 -1 -1
-1 -1 -1
```
