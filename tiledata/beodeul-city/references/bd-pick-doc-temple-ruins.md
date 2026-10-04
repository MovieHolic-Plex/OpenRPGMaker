# 신전 폐허 — 고른 조각 39종

tilesetId `beodeul_city` · 그림 `public/assets/beodeul-city/beodeul-city-chipset.png`(텍스처 `tex_beodeul_city`, 27648칸, 16px 칸, 한 줄 128칸 — 번호 n 의 칸은 행 n÷128, 열 n%128). 0~23935 은 버들항 도시 칸, 23936~27647 은 고른 장소 조각 칸(이 용도). 다른 칩셋 번호를 섞지 않는다.

## 원래 계획 (tiledata/beodeul-variants/temple-ruins/plan.md 앞부분 — 목적·구역을 보고 새로 배치한다)
# 고대 신전 폐허 (temple-ruins) — 계획

크기 58×44 (칸 16px = 1m). 3/4 시점, 왼쪽 위 빛, 앞면은 위 벽 아래에만.

## 목적
버들항 아래 강가 절벽에 묻힌 옛 신전. 바깥 폐허(진입로·앞뜰·성림)를 지나 무너진 열주를 넘고,
실내(대신랑·모자이크 홀)를 거쳐 내전의 제단 앞 내려가는 계단(최종 지점)에 닿는다.

## 구역 (앵커 = 한눈에 읽히는 물건)
| 구역 | 좌표 | 성격 | 앵커 |
|---|---|---|---|
| AP 진입로 | x3–13, y33–41 | 바깥. 풀+흙길, 무너진 문기둥 | 부러진 문기둥 한 쌍, 죽은 나무 |
| FC 앞뜰 | x18–47, y29–41 | 바깥 폐허. 폐허 포석 + 풀·흙 | 무너진 열주 두 줄, 쓰러진 기둥, 넝쿨 |
| OG 성림 | x52–56, y30–40 | 바깥. 작은 숲 제단 | 나무 둘, 돌 상 |
| NV 대신랑 | x14–45, y17–24 | 실내. 열주 홀 + 바닥 메달리온 | 모자이크 메달리온 7×7, 열주 2줄 |
| WC 유물실 | x3–9, y17–24 | 실내. 석관·항아리 벽감 | 벽감 줄, 석관 |
| EC 서고 | x50–55, y17–24 | 실내. 촛대·돌 궤 | 촛불 무리, 궤 |
| SA 내전 | x21–38, y4–11 | 실내. 제단 + 내려가는 계단 | 석제단, 화로 넷, 계단 |

## 길 (모든 방은 복도로 이어진다, 막다른 방 없음)
- 입구 (6,39) → AP → 복도 (14–17, 36–37) → FC
- FC ↔ OG: 복도 (48–51, 34–35)

## 조각 표
번호 = 그림 `temple-ruins-parts` 의 번호. 판정: after = 사용자가 AFTER 를 고름 · unpicked-after = 안 고름(AFTER) · before = BEFORE 사본 복원.
| # | 키트 | 이름 | 칸 | 종류 | 막힘 줄 | 판정 |
|---|---|---|---|---|---|---|
| 1 | `bd-pick-aqueduct-sewer-arch-bars` | 벽 아치 | 2×2 | 물체 | 1 | after |
| 2 | `bd-pick-aqueduct-sewer-arch-dark` | 벽 아치 | 2×2 | 물체 | 1 | after |
| 3 | `bd-pick-aqueduct-sewer-barrel` | 통 | 1×1 | 물체 | 1 | unpicked-after |
| 4 | `bd-pick-aqueduct-sewer-bones` | 흩어진 뼈 | 1×1 | 바닥 소품(걸음) | - | unpicked-after |
| 5 | `bd-pick-aqueduct-sewer-brazier` | 화로 | 1×1 | 물체 | 1 | after |
| 6 | `bd-pick-aqueduct-sewer-bucket` | 양동이 | 1×1 | 물체 | 1 | after |
| 7 | `bd-pick-aqueduct-sewer-candles` | 촛불 세 자루 | 1×1 | 물체 | 1 | after |
| 8 | `bd-pick-aqueduct-sewer-ceiling` | 어두운 천장 + 밝은 테두리 | 3×3 | 벽 앞면·절벽·천장 표본 | - | after |
| 9 | `bd-pick-aqueduct-sewer-coffin` | 관 | 2×2 | 물체 | 1 | unpicked-after |
| 10 | `bd-pick-aqueduct-sewer-crate` | 나무 상자 | 1×1 | 물체 | 1 | unpicked-after |
| 11 | `bd-pick-aqueduct-sewer-lantern-post` | 등불 기둥 | 1×2 | 물체 | 1 | after |
| 12 | `bd-pick-aqueduct-sewer-skulls` | 해골 무더기 | 1×1 | 물체 | 1 | after |
| 13 | `bd-pick-aqueduct-sewer-torch-wall` | 벽 횃불 | 1×1 | 물체 | 1 | unpicked-after |
| 14 | `bd-pick-castle-catacombs-altar-stone` | 돌 제단 | 2×2 | 물체 | 1 | unpicked-after |
| 15 | `bd-pick-castle-catacombs-niche-shroud` | 벽감 | 1×1 | 물체 | 1 | unpicked-after |
| 16 | `bd-pick-castle-catacombs-niche-skull` | 벽감 | 1×1 | 물체 | 1 | unpicked-after |
| 17 | `bd-pick-castle-catacombs-niche-urn` | 벽감 | 1×1 | 물체 | 1 | unpicked-after |
| 18 | `bd-pick-temple-ruins-column-temple` | 신전 돌 기둥 | 1×2 | 물체 | 1 | after |
| 19 | `bd-pick-temple-ruins-column-temple-broken` | 부러진 신전 기둥 그루터기 | 1×2 | 물체 | 1 | after |
| 20 | `bd-pick-temple-ruins-column-temple-tall` | 키 큰 신전 기둥 | 1×3 | 물체 | 1 | after |
| 21 | `bd-pick-temple-ruins-cypress-ruin` | 폐허에 자란 사이프러스 | 1×3 | 나무 | 1 | unpicked-after |
| 22 | `bd-pick-temple-ruins-door-wood` | 나무 문 | 1×2 | 물체 | 1 | unpicked-after |
| 23 | `bd-pick-temple-ruins-face-temple-2h` | 벽 앞면 신전 돌 2칸 높이 | 3×2 | 벽 앞면·절벽·천장 표본 | - | after |
| 24 | `bd-pick-temple-ruins-face-temple-3h` | 벽 앞면 신전 돌 3칸 높이 | 3×3 | 벽 앞면·절벽·천장 표본 | - | after |
| 25 | `bd-pick-temple-ruins-fallen-column-temple` | 쓰러진 신전 기둥 | 2×1 | 물체 | 1 | unpicked-after |
| 26 | `bd-pick-temple-ruins-floor-dirt` | 바닥 흙 | 2×2 | 바닥 표본 | - | unpicked-after |
| 27 | `bd-pick-temple-ruins-floor-grass` | 바닥 풀 | 2×2 | 바닥 표본 | - | unpicked-after |
| 28 | `bd-pick-temple-ruins-floor-ruin` | 바닥 폐허 | 2×2 | 바닥 표본 | - | unpicked-after |
| 29 | `bd-pick-temple-ruins-floor-trav` | 바닥 트래버틴 | 2×2 | 바닥 표본 | - | unpicked-after |
| 30 | `bd-pick-temple-ruins-mosaic-medallion-5x5` | 내전 바닥 작은 모자이크 메달리온 | 5×5 | 바닥 표본 | - | unpicked-after |
| 31 | `bd-pick-temple-ruins-mosaic-medallion-7x7` | 대신랑 바닥 모자이크 메달리온 | 7×7 | 바닥 표본 | - | unpicked-after |
| 32 | `bd-pick-temple-ruins-roof-baldachin` | 성림 제단 닫집 | 4×4 | 물체 | 2 | after |
| 33 | `bd-pick-temple-ruins-roof-hip-shrine` | 진입로 작은 사당 | 3×3 | 물체 | 2 | after |
| 34 | `bd-pick-temple-ruins-roof-hip-storehouse` | 서쪽 이끼 낀 돌 창고 | 4×4 | 물체 | 2 | after |
| 35 | `bd-pick-temple-ruins-roof-naiskos-pediment` | 동쪽 소신전 | 5×5 | 물체 | 3 | after |
| 36 | `bd-pick-temple-ruins-rubble-temple` | 무너진 대리석 부스러기 | 1×1 | 바닥 소품(걸음) | - | after |
| 37 | `bd-pick-temple-ruins-ruined-wall-2` | 서 있는 낮은 폐허 벽 조각 | 2×2 | 물체 | 1 | after |
| 38 | `bd-pick-temple-ruins-stairs-down` | 바닥에서 아래로 내려가는 계단 한 칸 | 1×1 | 걸음 구조물(다리·계단·잔교) | - | unpicked-after |
| 39 | `bd-pick-temple-ruins-vines-2` | 앞면을 타고 내린 덩굴 | 1×2 | 물체 | 1 | unpicked-after |

## 칸 배열 (원점 = 키트 왼쪽 위, -1 = 그 층을 건드리지 않음)
역할 글자: `S` 윗부분 막힘(사람과 y 정렬) · `C` 윗부분 걸음 ★(사람 위에 그려짐) · `W` 윗부분 걸음(사람 아래, 다리·계단·바닥 얼룩) · `F` 땅 걸음 · `X` 땅 막힘 · `.` 빈 칸(-1, 찍는 자리의 그 층을 건드리지 않음).

### 1. `bd-pick-aqueduct-sewer-arch-bars` 벽 아치 2×2
역할 `CC / SS`
```
아래층
-1 -1
-1 -1
윗층
26568 26569
26570 26571
```

### 2. `bd-pick-aqueduct-sewer-arch-dark` 벽 아치 2×2
역할 `CC / SS`
```
아래층
-1 -1
-1 -1
윗층
26572 26573
26574 26575
```

### 3. `bd-pick-aqueduct-sewer-barrel` 통 1×1
역할 `S`
```
아래층
-1
윗층
26580
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

### 9. `bd-pick-aqueduct-sewer-coffin` 관 2×2
역할 `CC / SS`
```
아래층
-1 -1
-1 -1
윗층
26599 26600
26601 26602
```

### 10. `bd-pick-aqueduct-sewer-crate` 나무 상자 1×1
역할 `S`
```
아래층
-1
윗층
26606
```

### 11. `bd-pick-aqueduct-sewer-lantern-post` 등불 기둥 1×2
역할 `C / S`
```
아래층
-1
-1
윗층
26655
26656
```

### 12. `bd-pick-aqueduct-sewer-skulls` 해골 무더기 1×1
역할 `S`
```
아래층
-1
윗층
26669
```

### 13. `bd-pick-aqueduct-sewer-torch-wall` 벽 횃불 1×1
역할 `S`
```
아래층
-1
윗층
26673
```

### 14. `bd-pick-castle-catacombs-altar-stone` 돌 제단 2×2
역할 `CC / SS`
```
아래층
-1 -1
-1 -1
윗층
26682 26683
26684 26685
```

### 15. `bd-pick-castle-catacombs-niche-shroud` 벽감 1×1
역할 `S`
```
아래층
-1
윗층
26713
```

### 16. `bd-pick-castle-catacombs-niche-skull` 벽감 1×1
역할 `S`
```
아래층
-1
윗층
26714
```

### 17. `bd-pick-castle-catacombs-niche-urn` 벽감 1×1
역할 `S`
```
아래층
-1
윗층
26715
```

### 18. `bd-pick-temple-ruins-column-temple` 신전 돌 기둥 1×2
역할 `C / S`
```
아래층
-1
-1
윗층
26785
26786
```

### 19. `bd-pick-temple-ruins-column-temple-broken` 부러진 신전 기둥 그루터기 1×2
역할 `. / S`
```
아래층
-1
-1
윗층
-1
26787
```

### 20. `bd-pick-temple-ruins-column-temple-tall` 키 큰 신전 기둥 1×3
역할 `C / C / S`
```
아래층
-1
-1
-1
윗층
26785
26788
26789
```

### 21. `bd-pick-temple-ruins-cypress-ruin` 폐허에 자란 사이프러스 1×3
역할 `C / C / S`
```
아래층
-1
-1
-1
윗층
26790
26791
26792
```

### 22. `bd-pick-temple-ruins-door-wood` 나무 문 1×2
역할 `C / S`
```
아래층
-1
-1
윗층
26793
26794
```

### 23. `bd-pick-temple-ruins-face-temple-2h` 벽 앞면 신전 돌 2칸 높이 3×2
역할 `XXX / XXX`
```
아래층
26795 26796 26797
26798 26799 26800
윗층
-1 -1 -1
-1 -1 -1
```

### 24. `bd-pick-temple-ruins-face-temple-3h` 벽 앞면 신전 돌 3칸 높이 3×3
역할 `XXX / XXX / XXX`
```
아래층
26795 26796 26797
26801 26802 26803
26804 26805 26806
윗층
-1 -1 -1
-1 -1 -1
-1 -1 -1
```

### 25. `bd-pick-temple-ruins-fallen-column-temple` 쓰러진 신전 기둥 2×1
역할 `SS`
```
아래층
-1 -1
윗층
26807 26808
```

### 26. `bd-pick-temple-ruins-floor-dirt` 바닥 흙 2×2
역할 `FF / FF`
```
아래층
26809 26810
26811 26810
윗층
-1 -1
-1 -1
```

### 27. `bd-pick-temple-ruins-floor-grass` 바닥 풀 2×2
역할 `FF / FF`
```
아래층
26812 26813
26812 26814
윗층
-1 -1
-1 -1
```

### 28. `bd-pick-temple-ruins-floor-ruin` 바닥 폐허 2×2
역할 `FF / FF`
```
아래층
26815 26816
26815 26816
윗층
-1 -1
-1 -1
```

### 29. `bd-pick-temple-ruins-floor-trav` 바닥 트래버틴 2×2
역할 `FF / FF`
```
아래층
26817 26818
26819 26819
윗층
-1 -1
-1 -1
```

### 30. `bd-pick-temple-ruins-mosaic-medallion-5x5` 내전 바닥 작은 모자이크 메달리온 5×5
역할 `WWWWW / WFFFW / WFFFW / WFFFW / WWWWW`
```
아래층
-1 -1 -1 -1 -1
-1 26826 26827 26828 -1
-1 26831 26832 26833 -1
-1 26836 26837 26838 -1
-1 -1 -1 -1 -1
윗층
26820 26821 26822 26823 26824
26825 -1 -1 -1 26829
26830 -1 -1 -1 26834
26835 -1 -1 -1 26839
26840 26841 26842 26843 26844
```

### 31. `bd-pick-temple-ruins-mosaic-medallion-7x7` 대신랑 바닥 모자이크 메달리온 7×7
역할 `.WWWWW. / WWFFFWW / WFFFFFW / WFFFFFW / WFFFFFW / WWFFFWW / .WWWWW.`
```
아래층
-1 -1 -1 -1 -1 -1 -1
-1 -1 26852 26853 26854 -1 -1
-1 26858 26859 26860 26861 26862 -1
-1 26865 26866 26867 26868 26869 -1
-1 26872 26873 26874 26875 26876 -1
-1 -1 26880 26881 26882 -1 -1
-1 -1 -1 -1 -1 -1 -1
윗층
-1 26845 26846 26847 26848 26849 -1
26850 26851 -1 -1 -1 26855 26856
26857 -1 -1 -1 -1 -1 26863
26864 -1 -1 -1 -1 -1 26870
26871 -1 -1 -1 -1 -1 26877
26878 26879 -1 -1 -1 26883 26884
-1 26885 26886 26887 26888 26889 -1
```

### 32. `bd-pick-temple-ruins-roof-baldachin` 성림 제단 닫집 4×4
역할 `CCCC / CCCC / SSSS / SSSS`
```
아래층
-1 -1 -1 -1
-1 -1 -1 -1
-1 -1 -1 -1
-1 -1 -1 -1
윗층
26890 26891 26892 26893
26894 26895 26896 26897
26898 26899 26900 26901
26902 26903 26904 26905
```

### 33. `bd-pick-temple-ruins-roof-hip-shrine` 진입로 작은 사당 3×3
역할 `CCC / SSS / SSS`
```
아래층
-1 -1 -1
-1 -1 -1
-1 -1 -1
윗층
26906 26907 26908
26909 26910 26911
26912 26913 26914
```

### 34. `bd-pick-temple-ruins-roof-hip-storehouse` 서쪽 이끼 낀 돌 창고 4×4
역할 `CCCC / CCCC / SSSS / SSSS`
```
아래층
-1 -1 -1 -1
-1 -1 -1 -1
-1 -1 -1 -1
-1 -1 -1 -1
윗층
26915 26916 26917 26918
26919 26920 26921 26922
26923 26924 26925 26926
26927 26928 26929 26930
```

### 35. `bd-pick-temple-ruins-roof-naiskos-pediment` 동쪽 소신전 5×5
역할 `CCCCC / CCCCC / SSSSS / SSSSS / SSSSS`
```
아래층
-1 -1 -1 -1 -1
-1 -1 -1 -1 -1
-1 -1 -1 -1 -1
-1 -1 -1 -1 -1
-1 -1 -1 -1 -1
윗층
26931 26932 26933 26934 26935
26936 26937 26938 26939 26940
26941 26942 26943 26944 26945
26946 26947 26948 26949 26950
26951 26952 26953 26954 26955
```

### 36. `bd-pick-temple-ruins-rubble-temple` 무너진 대리석 부스러기 1×1
역할 `W`
```
아래층
-1
윗층
26956
```

### 37. `bd-pick-temple-ruins-ruined-wall-2` 서 있는 낮은 폐허 벽 조각 2×2
역할 `CC / SS`
```
아래층
-1 -1
-1 -1
윗층
26957 26958
26959 26960
```

### 38. `bd-pick-temple-ruins-stairs-down` 바닥에서 아래로 내려가는 계단 한 칸 1×1
역할 `F`
```
아래층
26961
윗층
-1
```

### 39. `bd-pick-temple-ruins-vines-2` 앞면을 타고 내린 덩굴 1×2
역할 `C / S`
```
아래층
-1
-1
윗층
26962
26963
```
