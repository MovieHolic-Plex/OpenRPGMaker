# 산길 고개 — 고른 조각 27종

tilesetId `beodeul_city` · 그림 `public/assets/beodeul-city/beodeul-city-chipset.png`(텍스처 `tex_beodeul_city`, 27648칸, 16px 칸, 한 줄 128칸 — 번호 n 의 칸은 행 n÷128, 열 n%128). 0~23935 은 버들항 도시 칸, 23936~27647 은 고른 장소 조각 칸(이 용도). 다른 칩셋 번호를 섞지 않는다.

## 원래 계획 (tiledata/beodeul-variants/mountain-pass/plan.md 앞부분 — 목적·구역을 보고 새로 배치한다)
# 고갯길 (mountain-pass) — 버들항 변형 5-4

## 용도
서쪽 마을(왼쪽 아래 출구)과 동쪽 마을(오른쪽 아래 출구)을 잇는 산길 필드. 계곡에서 시작해 두 단 절벽을 지그재그로 올라
능선을 넘고, 다시 두 단을 내려온다. 강이 산을 둘로 가르므로 **능선을 넘지 않고는 반대편으로 갈 수 없다**(우회 없음).

## 크기·층
88x58칸(16px). 층 3단: lev0 계곡(y38~57), lev1 중턱 선반(y17~34), lev2 능선(y0~13).
절벽 앞면 3줄(y14~16, y35~37)은 시트 모양 그대로, 계단은 절벽 곧은 구간에만.

## 동선 (흙길 2칸 폭)
1. 서쪽 출구(0,~46) → 계곡 동쪽으로 → 계단①(x=58) 오른다.
2. 선반에서 서쪽으로 되돌아(지그) → 계단②(x=14) 능선으로.
3. 능선 y~8 을 동쪽으로: 초소 → 돌다리(강 머리) → 정상 쉼터 → 계단③(x=78) 내려간다.
4. 동쪽 선반 → 계단④(x=83) → 동쪽 계곡 → 동쪽 출구(87,~46).

## 구역·앵커
- 계곡 서쪽: **나귀꾼 쉼터**(작은 오두막·물통·건초통·모닥불), 곁길 1.
- 선반 서쪽: **은자의 오두막+사당**(곁길 2, 북쪽), **조망대**(곁길 3, 남쪽 벼랑 끝: 벤치·케른·울타리).
- 능선: **초소**(x~34, 봉화대·돌담), **돌다리**(x63~67, 강 머리 위, 폭포가 바로 옆 절벽으로 떨어진다), **정상 쉼터**(x70~76: 케른·모닥불·벤치·이정표·십자).
- 강: 능선 위 개울 → 폭포① → 선반 강(2칸) → 폭포② → 계곡 강(3칸) → 아래쪽 가장자리. 선반·계곡을 동서로 가른다.
- 동쪽 선반: 길가 사당+케른. 동쪽 계곡: 이정표, 작은 소나무 숲.

## 조각 표
번호 = 그림 `mountain-pass-parts` 의 번호. 판정: after = 사용자가 AFTER 를 고름 · unpicked-after = 안 고름(AFTER) · before = BEFORE 사본 복원.
| # | 키트 | 이름 | 칸 | 종류 | 막힘 줄 | 판정 |
|---|---|---|---|---|---|---|
| 1 | `bd-pick-coast-cliff-road-fir-l` | 전나무 | 3×4 | 나무 | 1 | unpicked-after |
| 2 | `bd-pick-coast-cliff-road-fir-m` | 전나무 | 2×3 | 나무 | 1 | unpicked-after |
| 3 | `bd-pick-coast-cliff-road-fir-m2` | 전나무 | 2×3 | 나무 | 1 | unpicked-after |
| 4 | `bd-pick-coast-cliff-road-fir-s` | 전나무 | 2×3 | 나무 | 1 | unpicked-after |
| 5 | `bd-pick-coast-cliff-road-heath-a` | 낮은 헤더 덤불 A | 1×1 | 바닥 소품(걸음) | - | after |
| 6 | `bd-pick-coast-cliff-road-heath-b` | 낮은 헤더 덤불 B | 1×1 | 바닥 소품(걸음) | - | after |
| 7 | `bd-pick-coast-cliff-road-milestone` | 로마식 이정표 돌기둥 | 1×2 | 물체 | 1 | unpicked-after |
| 8 | `bd-pick-deep-forest-path-cairn` | 돌탑 | 1×2 | 물체 | 1 | before |
| 9 | `bd-pick-deep-forest-path-cairn-s` | 돌탑 | 1×1 | 물체 | 1 | before |
| 10 | `bd-pick-deep-forest-path-campfire` | 모닥불 | 1×1 | 물체 | 1 | unpicked-after |
| 11 | `bd-pick-deep-forest-path-heath-c` | 낮은 헤더 덤불 C | 1×1 | 바닥 소품(걸음) | - | before |
| 12 | `bd-pick-deep-forest-path-log-fallen` | 쓰러진 통나무 | 2×1 | 물체 | 1 | before |
| 13 | `bd-pick-deep-forest-path-stump` | 그루터기 | 1×1 | 물체 | 1 | before |
| 14 | `bd-pick-mountain-pass-alpine-a` | 고산 꽃 뭉치 A | 1×1 | 바닥 소품(걸음) | - | before |
| 15 | `bd-pick-mountain-pass-alpine-b` | 고산 꽃 뭉치 B | 1×1 | 바닥 소품(걸음) | - | before |
| 16 | `bd-pick-mountain-pass-boulder-l` | 큰 산바위 | 2×2 | 물체 | 1 | unpicked-after |
| 17 | `bd-pick-mountain-pass-boulder-m` | 작은 산바위 | 2×2 | 물체 | 1 | before |
| 18 | `bd-pick-mountain-pass-brazier` | 봉화대 | 1×2 | 물체 | 1 | unpicked-after |
| 19 | `bd-pick-mountain-pass-guard-post` | 초소 | 3×4 | 물체 | 2 | after |
| 20 | `bd-pick-mountain-pass-scree-a` | 자갈 무더기 A | 1×1 | 바닥 소품(걸음) | - | before |
| 21 | `bd-pick-mountain-pass-scree-b` | 자갈 무더기 B | 1×1 | 바닥 소품(걸음) | - | before |
| 22 | `bd-pick-mountain-pass-shrine` | 길가 사당 | 2×3 | 물체 | 2 | before |
| 23 | `bd-pick-mountain-pass-stone-bridge` | 능선 개울 돌다리 | 5×4 | 걸음 구조물(다리·계단·잔교) | - | before |
| 24 | `bd-pick-mountain-pass-trail-post` | 오솔길 표지 기둥 | 1×2 | 물체 | 1 | before |
| 25 | `bd-pick-mountain-pass-trough` | 말 물통 | 2×1 | 물체 | 1 | before |
| 26 | `bd-pick-mountain-pass-wall-seg` | 마른 돌담 마디 | 2×2 | 물체 | 1 | before |
| 27 | `bd-pick-mountain-pass-wayside-cross` | 길가 표지 십자 | 1×2 | 물체 | 1 | before |

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

### 5. `bd-pick-coast-cliff-road-heath-a` 낮은 헤더 덤불 A 1×1
역할 `W`
```
아래층
-1
윗층
27511
```

### 6. `bd-pick-coast-cliff-road-heath-b` 낮은 헤더 덤불 B 1×1
역할 `W`
```
아래층
-1
윗층
27512
```

### 7. `bd-pick-coast-cliff-road-milestone` 로마식 이정표 돌기둥 1×2
역할 `C / S`
```
아래층
-1
-1
윗층
27514
27515
```

### 8. `bd-pick-deep-forest-path-cairn` 돌탑 1×2
역할 `C / S`
```
아래층
-1
-1
윗층
27535
27536
```

### 9. `bd-pick-deep-forest-path-cairn-s` 돌탑 1×1
역할 `S`
```
아래층
-1
윗층
27537
```

### 10. `bd-pick-deep-forest-path-campfire` 모닥불 1×1
역할 `S`
```
아래층
-1
윗층
27538
```

### 11. `bd-pick-deep-forest-path-heath-c` 낮은 헤더 덤불 C 1×1
역할 `W`
```
아래층
-1
윗층
27545
```

### 12. `bd-pick-deep-forest-path-log-fallen` 쓰러진 통나무 2×1
역할 `SS`
```
아래층
-1 -1
윗층
27552 27553
```

### 13. `bd-pick-deep-forest-path-stump` 그루터기 1×1
역할 `S`
```
아래층
-1
윗층
27569
```

### 14. `bd-pick-mountain-pass-alpine-a` 고산 꽃 뭉치 A 1×1
역할 `W`
```
아래층
-1
윗층
27576
```

### 15. `bd-pick-mountain-pass-alpine-b` 고산 꽃 뭉치 B 1×1
역할 `W`
```
아래층
-1
윗층
27577
```

### 16. `bd-pick-mountain-pass-boulder-l` 큰 산바위 2×2
역할 `CC / SS`
```
아래층
-1 -1
-1 -1
윗층
27578 27579
27580 27581
```

### 17. `bd-pick-mountain-pass-boulder-m` 작은 산바위 2×2
역할 `.. / SS`
```
아래층
-1 -1
-1 -1
윗층
-1 -1
27582 27583
```

### 18. `bd-pick-mountain-pass-brazier` 봉화대 1×2
역할 `C / S`
```
아래층
-1
-1
윗층
27584
27585
```

### 19. `bd-pick-mountain-pass-guard-post` 초소 3×4
역할 `CCC / CCC / SSS / SSS`
```
아래층
-1 -1 -1
-1 -1 -1
-1 -1 -1
-1 -1 -1
윗층
27586 27587 27588
27589 27590 27591
27592 27593 27594
27595 27596 27597
```

### 20. `bd-pick-mountain-pass-scree-a` 자갈 무더기 A 1×1
역할 `W`
```
아래층
-1
윗층
27598
```

### 21. `bd-pick-mountain-pass-scree-b` 자갈 무더기 B 1×1
역할 `W`
```
아래층
-1
윗층
27599
```

### 22. `bd-pick-mountain-pass-shrine` 길가 사당 2×3
역할 `CC / SS / SS`
```
아래층
-1 -1
-1 -1
-1 -1
윗층
27600 27601
27602 27603
27604 27605
```

### 23. `bd-pick-mountain-pass-stone-bridge` 능선 개울 돌다리 5×4
역할 `WWWWW / FFFFF / FFFFF / WWWWW`
```
아래층
-1 -1 -1 -1 -1
27611 27612 27613 27614 27615
27616 27617 27618 27619 27620
-1 -1 -1 -1 -1
윗층
27606 27607 27608 27609 27610
-1 -1 -1 -1 -1
-1 -1 -1 -1 -1
27621 27622 27623 27624 27625
```

### 24. `bd-pick-mountain-pass-trail-post` 오솔길 표지 기둥 1×2
역할 `C / S`
```
아래층
-1
-1
윗층
27626
27627
```

### 25. `bd-pick-mountain-pass-trough` 말 물통 2×1
역할 `SS`
```
아래층
-1 -1
윗층
27628 27629
```

### 26. `bd-pick-mountain-pass-wall-seg` 마른 돌담 마디 2×2
역할 `.. / SS`
```
아래층
-1 -1
-1 -1
윗층
-1 -1
27630 27631
```

### 27. `bd-pick-mountain-pass-wayside-cross` 길가 표지 십자 1×2
역할 `C / S`
```
아래층
-1
-1
윗층
27632
27633
```
