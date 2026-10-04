# 화산 동굴 — 고른 조각 22종

tilesetId `beodeul_city` · 그림 `public/assets/beodeul-city/beodeul-city-chipset.png`(텍스처 `tex_beodeul_city`, 27648칸, 16px 칸, 한 줄 128칸 — 번호 n 의 칸은 행 n÷128, 열 n%128). 0~23935 은 버들항 도시 칸, 23936~27647 은 고른 장소 조각 칸(이 용도). 다른 칩셋 번호를 섞지 않는다.

## 원래 계획 (tiledata/beodeul-variants/volcano-cave/plan.md 앞부분 — 목적·구역을 보고 새로 배치한다)
# 화산 동굴 (volcano-cave) — 계획

기준: 버들항 v6~v8 (16px 손 도트, 3/4, 빛 왼쪽 위, 1칸=16px=1m). 던전 방 묶음 범위(40×30~64×48) 안의 **56×44칸 한 장**.
생성 그림 없음 · 트레이싱 없음. 색은 버들항 칩셋 램프에서만 고른다. 용암은 **빨강(RD)·짚(SR) 램프만** 쓴다.

## 용도
식은 화산 밑을 걷는 한 판짜리 던전. 입구 → 옛 대장간 폐허(볼거리 1) → 용암 폭포 동굴(볼거리 2) → 바위다리로 강 건너 → 재 벌판·흑요석 제단(끝) → 다시 입구로 도는 고리.
초보 모험가가 「열기 → 폐허 → 폭포 → 다리 → 제단」 순서로 읽히게 한다.

## 구역 (칸 좌표 대략)
| 구역 | 자리 | 용도 |
|---|---|---|
| A 입구 동굴 | 남서 (x3~21, y31~42) | 시작. 남쪽 가장자리가 출입구. 횃불 2, 표지 돌무더기 |
| AB 통로 | x8~12, y22~31 | 세로 좁은 길. 오른쪽에 용암 호수 물가 |
| B 대장간 폐허 | 북서 (x4~24, y8~21) | **앵커 1**: 북벽에 붙은 큰 화덕, 모루·풀무·석탄·무너진 기둥 |
| BC 통로 | x23~29, y12~16 | B→C |
| C 폭포 동굴 | 북중~북동 (x24~47, y9~21) | **앵커 2**: 북벽에서 쏟아지는 용암 폭포와 웅덩이, 웅덩이에서 강이 남쪽으로 |
| 용암 강 | 웅덩이 → 동쪽 가장자리 → 서쪽으로 꺾어 호수(x15~21,y26~31) | 동선을 가르는 장애물. 두 번째 작은 폭포가 호수로 |
| 바위다리 | x32~35, y23~29 (세로) | C ↔ D 를 잇는 돌판 다리. 난간 낮은 돌 |
| D 재 벌판 | 남동 (x23~53, y28~42) | 재 바닥, 김 뿜는 틈, 흑요석 뾰족돌, **앵커 3**: 흑요석 제단 |

## 동선

## 조각 표
번호 = 그림 `volcano-cave-parts` 의 번호. 판정: after = 사용자가 AFTER 를 고름 · unpicked-after = 안 고름(AFTER) · before = BEFORE 사본 복원.
| # | 키트 | 이름 | 칸 | 종류 | 막힘 줄 | 판정 |
|---|---|---|---|---|---|---|
| 1 | `bd-pick-volcano-cave-altar` | 흑요석 제단 | 4×3 | 물체 | 2 | after |
| 2 | `bd-pick-volcano-cave-anvil` | 모루 | 1×1 | 물체 | 1 | after |
| 3 | `bd-pick-volcano-cave-bellows` | 풀무 | 2×2 | 물체 | 1 | after |
| 4 | `bd-pick-volcano-cave-bones` | 뼈 | 1×1 | 바닥 소품(걸음) | - | after |
| 5 | `bd-pick-volcano-cave-brazier` | 돌 화로 | 1×2 | 물체 | 1 | after |
| 6 | `bd-pick-volcano-cave-bridge` | 바위 다리 | 3×7 | 걸음 구조물(다리·계단·잔교) | - | after |
| 7 | `bd-pick-volcano-cave-coal-pile` | 숯더미 | 2×1 | 물체 | 1 | after |
| 8 | `bd-pick-volcano-cave-ember-a` | 불씨 자국 A | 1×1 | 바닥 소품(걸음) | - | after |
| 9 | `bd-pick-volcano-cave-fire-crystal` | 불 수정 | 1×1 | 물체 | 1 | after |
| 10 | `bd-pick-volcano-cave-furnace` | 대장간 큰 화덕 | 3×3 | 물체 | 2 | after |
| 11 | `bd-pick-volcano-cave-hanging-chain` | 벽에 걸린 사슬 | 1×2 | 물체 | 1 | before |
| 12 | `bd-pick-volcano-cave-ingots` | 주괴 더미 | 2×1 | 물체 | 1 | after |
| 13 | `bd-pick-volcano-cave-lava-fall-strip` | 용암 폭포 | 3×2 | 물·용암 표본 | - | after |
| 14 | `bd-pick-volcano-cave-lava-strip` | 용암 강 | 2×2 | 물·용암 표본 | - | after |
| 15 | `bd-pick-volcano-cave-pillar-broken-a` | 부러진 기둥 A | 1×2 | 물체 | 1 | after |
| 16 | `bd-pick-volcano-cave-pillar-broken-b` | 부러진 기둥 B | 1×2 | 물체 | 1 | after |
| 17 | `bd-pick-volcano-cave-pillar-fallen` | 쓰러진 기둥 | 2×1 | 물체 | 1 | after |
| 18 | `bd-pick-volcano-cave-spike-small` | 흑요석 뾰족돌 작은 것 | 1×1 | 물체 | 1 | after |
| 19 | `bd-pick-volcano-cave-spike-tall` | 흑요석 뾰족돌 큰 것 | 1×2 | 물체 | 1 | after |
| 20 | `bd-pick-volcano-cave-spike-wide` | 흑요석 뾰족돌 무리 | 2×2 | 물체 | 1 | after |
| 21 | `bd-pick-volcano-cave-stalagmite` | 석순 | 1×2 | 물체 | 1 | after |
| 22 | `bd-pick-volcano-cave-steam-vent` | 증기 구멍 | 1×1 | 물체 | 1 | after |

## 칸 배열 (원점 = 키트 왼쪽 위, -1 = 그 층을 건드리지 않음)
역할 글자: `S` 윗부분 막힘(사람과 y 정렬) · `C` 윗부분 걸음 ★(사람 위에 그려짐) · `W` 윗부분 걸음(사람 아래, 다리·계단·바닥 얼룩) · `F` 땅 걸음 · `X` 땅 막힘 · `.` 빈 칸(-1, 찍는 자리의 그 층을 건드리지 않음).

### 1. `bd-pick-volcano-cave-altar` 흑요석 제단 4×3
역할 `CCCC / SSSS / SSSS`
```
아래층
-1 -1 -1 -1
-1 -1 -1 -1
-1 -1 -1 -1
윗층
27210 27211 27212 27213
27214 27215 27216 27217
27218 27219 27220 27221
```

### 2. `bd-pick-volcano-cave-anvil` 모루 1×1
역할 `S`
```
아래층
-1
윗층
27222
```

### 3. `bd-pick-volcano-cave-bellows` 풀무 2×2
역할 `CC / SS`
```
아래층
-1 -1
-1 -1
윗층
27223 27224
27225 27226
```

### 4. `bd-pick-volcano-cave-bones` 뼈 1×1
역할 `W`
```
아래층
-1
윗층
27227
```

### 5. `bd-pick-volcano-cave-brazier` 돌 화로 1×2
역할 `C / S`
```
아래층
-1
-1
윗층
27228
27229
```

### 6. `bd-pick-volcano-cave-bridge` 바위 다리 3×7
역할 `FFF / FFF / FFF / FFF / FFF / FFF / FFF`
```
아래층
27230 27231 27232
27233 27234 27235
27236 27237 27238
27239 27240 27241
27242 27243 27244
27245 27246 27247
27248 27249 27250
윗층
-1 -1 -1
-1 -1 -1
-1 -1 -1
-1 -1 -1
-1 -1 -1
-1 -1 -1
-1 -1 -1
```

### 7. `bd-pick-volcano-cave-coal-pile` 숯더미 2×1
역할 `SS`
```
아래층
-1 -1
윗층
27251 27252
```

### 8. `bd-pick-volcano-cave-ember-a` 불씨 자국 A 1×1
역할 `W`
```
아래층
-1
윗층
27253
```

### 9. `bd-pick-volcano-cave-fire-crystal` 불 수정 1×1
역할 `S`
```
아래층
-1
윗층
27254
```

### 10. `bd-pick-volcano-cave-furnace` 대장간 큰 화덕 3×3
역할 `CCC / SSS / SSS`
```
아래층
-1 -1 -1
-1 -1 -1
-1 -1 -1
윗층
27255 27256 27257
27258 27259 27260
27261 27262 27263
```

### 11. `bd-pick-volcano-cave-hanging-chain` 벽에 걸린 사슬 1×2
역할 `C / S`
```
아래층
-1
-1
윗층
27264
27265
```

### 12. `bd-pick-volcano-cave-ingots` 주괴 더미 2×1
역할 `SS`
```
아래층
-1 -1
윗층
27266 27267
```

### 13. `bd-pick-volcano-cave-lava-fall-strip` 용암 폭포 3×2
역할 `XXX / XXX`
```
아래층
27268 27272 27276
27280 27284 27288
윗층
-1 -1 -1
-1 -1 -1
```

### 14. `bd-pick-volcano-cave-lava-strip` 용암 강 2×2
역할 `XX / XX`
```
아래층
27292 27296
27300 27304
윗층
-1 -1
-1 -1
```

### 15. `bd-pick-volcano-cave-pillar-broken-a` 부러진 기둥 A 1×2
역할 `C / S`
```
아래층
-1
-1
윗층
27308
27309
```

### 16. `bd-pick-volcano-cave-pillar-broken-b` 부러진 기둥 B 1×2
역할 `C / S`
```
아래층
-1
-1
윗층
27310
27311
```

### 17. `bd-pick-volcano-cave-pillar-fallen` 쓰러진 기둥 2×1
역할 `SS`
```
아래층
-1 -1
윗층
27312 27313
```

### 18. `bd-pick-volcano-cave-spike-small` 흑요석 뾰족돌 작은 것 1×1
역할 `S`
```
아래층
-1
윗층
27314
```

### 19. `bd-pick-volcano-cave-spike-tall` 흑요석 뾰족돌 큰 것 1×2
역할 `C / S`
```
아래층
-1
-1
윗층
27315
27316
```

### 20. `bd-pick-volcano-cave-spike-wide` 흑요석 뾰족돌 무리 2×2
역할 `CC / SS`
```
아래층
-1 -1
-1 -1
윗층
27317 27318
27319 27320
```

### 21. `bd-pick-volcano-cave-stalagmite` 석순 1×2
역할 `C / S`
```
아래층
-1
-1
윗층
27321
27322
```

### 22. `bd-pick-volcano-cave-steam-vent` 증기 구멍 1×1
역할 `S`
```
아래층
-1
윗층
27323
```
