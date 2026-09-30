# 성 밖 마을 — 목조집 · 우물 광장

tilesetId `beodeul_city` · 그림 `public/assets/beodeul-city/beodeul-city-chipset.png`(텍스처 `tex_beodeul_city`, 23936칸, 16px 칸, 한 줄 128칸 — 번호 n 의 칸은 행 n÷128, 열 n%128). 칸 번호는 모두 이 시트의 0기준 번호다. 다른 칩셋 번호를 섞지 않는다.

성벽 밖(또는 항구 옆 어부 마을)은 포석 대신 `버들항 모랫길`, 반목조 집 대신 통나무·판자 목조집이다. 목조집도 문이 아래 줄이라 모랫길 북쪽 면에 늘어세운다.
우물 광장 `bd-out-well-plaza-sand`(9×8)는 둘레 모서리 칸이 비어 잔디가 보인다. 북쪽 트임(4~5칸째)과 남쪽 가장자리가 길과 닿는다.
예시 「언덕 위」: 모랫길 78~79행, 광장 (44,71) 을 큰 거리와 (48,70) 두 칸으로 잇는다. 예시 「강어귀」: 광장 (26,76), 북쪽 (30,75) 두 칸.

### `bd-out-cabin` — 외곽 통나무 오두막(박공 정면) (5×6)
가파른 통나무 지붕과 앞을 향한 박공(둥근 용마루 통나무 끝, 둥근 창), 통나무 벽에 꽃상자 창과 판자문, 왼쪽 지붕 위 돌 굴뚝, 덩굴. 성 밖 마을의 오두막. 조립: bd-out-gable-5 @(0,0), bd-out-logg-l @(0,4), bd-out-logg-window-box @(1,4), bd-out-logg-door @(2,4), bd-out-logg-wall @(3,4), bd-out-logg-r @(4,4), bd-out-ivy @(3,4), bd-out-chimney @(1,0).
- 배치: 문은 (2,5), 그 아래 칸이 문 앞 길. 굴뚝 머리 (1,0)은 C. 좌우 위 모서리 칸은 비어 있어 잔디가 보인다.
- 문 칸 (dx 2, dy 5) — 문 앞 = (x+2, y+6)
- 역할:
```text
.CSS.
SSSSS
SSSSS
SSSSS
SSSSS
SSSSS
```
조립표(부품 → 키트 안 칸 x,y; 뒤의 것이 위에 겹친다):

| 부품 | x | y |
|---|---|---|
| `bd-out-gable-5` | 0 | 0 |
| `bd-out-logg-l` | 0 | 4 |
| `bd-out-logg-window-box` | 1 | 4 |
| `bd-out-logg-door` | 2 | 4 |
| `bd-out-logg-wall` | 3 | 4 |
| `bd-out-logg-r` | 4 | 4 |
| `bd-out-ivy` | 3 | 4 |
| `bd-out-chimney` | 1 | 0 |

### `bd-out-cabin-small` — 외곽 작은 통나무 오두막 (4×4)
4x4 작은 통나무 오두막: 낮고 넓은 박공 지붕(짧은 용마루), 판자문과 덧문 창, 모서리 덩굴. 조립: bd-out-gable-4 @(0,0), bd-out-logg-l @(0,2), bd-out-logg-door-blue @(1,2), bd-out-logg-window-shut @(2,2), bd-out-logg-r @(3,2), bd-out-ivy-corner @(3,2).
- 배치: 문은 (1,3). 지붕 위쪽 모서리 칸은 비어 있다.
- 문 칸 (dx 1, dy 3) — 문 앞 = (x+1, y+4)
- 역할:
```text
SSSS
SSSS
SSSS
SSSS
```
조립표(부품 → 키트 안 칸 x,y; 뒤의 것이 위에 겹친다):

| 부품 | x | y |
|---|---|---|
| `bd-out-gable-4` | 0 | 0 |
| `bd-out-logg-l` | 0 | 2 |
| `bd-out-logg-door-blue` | 1 | 2 |
| `bd-out-logg-window-shut` | 2 | 2 |
| `bd-out-logg-r` | 3 | 2 |
| `bd-out-ivy-corner` | 3 | 2 |

### `bd-out-fence-run` — 외곽 나무 울타리(문틈) (4×1)
말뚝 울타리 4칸: 양 끝 울타리, 가운데 열린 문틈(기둥 둘 + 열린 문짝).
- 배치: 가운데 문틈 칸(2,0)은 걸어 지나간다(C: 기둥만 위에 그려짐).
- 역할:
```text
SSCS
```

### `bd-out-gable-3` — 외곽 나무집 박공 지붕 3칸 (3×3)
박공이 앞을 향한 가파른 나무 지붕(3칸 폭): 왼쪽 밝은 비탈·오른쪽 그늘 비탈, 둥근 통나무 용마루(연한 나이테 끝), 밝은 박공 널, 통나무 박공벽 과 둥근 창.
- 배치: 그 아래에 통나무/판자 벽 칸 줄(2줄)을 붙인다. 좌우 바깥 칸이 모서리(log-l/r 또는 plank-l/r).
- 역할:
```text
SSS
SSS
SSS
```

### `bd-out-gable-5` — 외곽 나무집 박공 지붕 5칸 (5×4)
박공이 앞을 향한 가파른 나무 지붕(5칸 폭): 왼쪽 밝은 비탈·오른쪽 그늘 비탈, 둥근 통나무 용마루(연한 나이테 끝), 밝은 박공 널, 통나무 박공벽 과 둥근 창.
- 배치: 그 아래에 통나무/판자 벽 칸 줄(2줄)을 붙인다. 좌우 바깥 칸이 모서리(log-l/r 또는 plank-l/r).
- 역할:
```text
.SSS.
SSSSS
SSSSS
SSSSS
```

### `bd-out-hay-barrels` — 외곽 건초·통·상자 (3×1)
통 둘과 건초를 쌓은 상자, 3칸x1줄.
- 배치: 집 옆이나 광장 가장자리에 놓는다.
- 역할:
```text
SSS
```

### `bd-out-house-plank` — 외곽 판자 2층집(간판) (8×6)
왼쪽은 옆박공 판자 본채(물결 끝단 널 지붕, 창 둘), 오른쪽은 박공이 앞을 향한 3칸 날개(둥근 통나무 기둥, 교차한 검 간판, 판자문 + 계단). 2층 겹판자 벽과 허리띠. 조립: bd-out-roof-hl @(0,0), bd-out-roof-m @(1,0), bd-out-roof-m2 @(2,0), bd-out-roof-m @(3,0), bd-out-roof-hr @(4,0), bd-out-ridge-end-l @(1,0), bd-out-ridge-end-r @(3,0), bd-out-gable-3 @(5,0), bd-out-plank-l @(0,3), bd-out-plank-window @(1,3), bd-out-plank-wall @(2,3), bd-out-plank-window-shut @(3,3), bd-out-plank-wall @(4,3), bd-out-plank-l @(5,3), bd-out-plank-door @(6,3), bd-out-plank-r @(7,3), bd-out-ivy @(4,4), bd-out-hanging-sign @(6,3), bd-out-chimney @(3,0).
- 배치: 문은 (6,5). 굴뚝은 지붕 앞 경사 위에 얹혀 있다(전부 X). 지붕 위 빈 칸은 잔디.
- 문 칸 (dx 6, dy 5) — 문 앞 = (x+6, y+6)
- 역할:
```text
SSSSSSSS
SSSSSSSS
SSSSSSSS
SSSSSSSS
SSSSSSSS
SSSSSSSS
```
조립표(부품 → 키트 안 칸 x,y; 뒤의 것이 위에 겹친다):

| 부품 | x | y |
|---|---|---|
| `bd-out-roof-hl` | 0 | 0 |
| `bd-out-roof-m` | 1 | 0 |
| `bd-out-roof-m2` | 2 | 0 |
| `bd-out-roof-m` | 3 | 0 |
| `bd-out-roof-hr` | 4 | 0 |
| `bd-out-ridge-end-l` | 1 | 0 |
| `bd-out-ridge-end-r` | 3 | 0 |
| `bd-out-gable-3` | 5 | 0 |
| `bd-out-plank-l` | 0 | 3 |
| `bd-out-plank-window` | 1 | 3 |
| `bd-out-plank-wall` | 2 | 3 |
| `bd-out-plank-window-shut` | 3 | 3 |
| `bd-out-plank-wall` | 4 | 3 |
| `bd-out-plank-l` | 5 | 3 |
| `bd-out-plank-door` | 6 | 3 |
| `bd-out-plank-r` | 7 | 3 |
| `bd-out-ivy` | 4 | 4 |
| `bd-out-hanging-sign` | 6 | 3 |
| `bd-out-chimney` | 3 | 0 |

### `bd-out-longhouse` — 외곽 통나무 긴 집 (10×6)
옆박공 긴 통나무 집: 물결 끝단 널 지붕, 용마루 통나무 끝, 벽에 꽃상자 창과 덧문 창 둘, 판자문(초록), 용마루 위 돌 굴뚝, 모서리 덩굴. 조립: bd-out-roof-hl @(0,1), bd-out-roof-m @(1,1), bd-out-roof-m @(2,1), bd-out-roof-m2 @(3,1), bd-out-roof-m @(4,1), bd-out-roof-m @(5,1), bd-out-roof-m @(6,1), bd-out-roof-m2 @(7,1), bd-out-roof-m @(8,1), bd-out-roof-hr @(9,1), bd-out-ridge-end-l @(1,1), bd-out-ridge-end-r @(8,1), bd-out-log-l @(0,4), bd-out-log-wall @(1,4), bd-out-log-window-box @(2,4), bd-out-log-wall @(3,4), bd-out-log-door-green @(4,4), bd-out-log-wall @(5,4), bd-out-log-wall @(6,4), bd-out-log-wall @(7,4), bd-out-log-window-shut @(8,4), bd-out-log-r @(9,4), bd-out-ivy-corner @(5,4), bd-out-chimney @(6,0).
- 배치: 문은 (4,5). 굴뚝 머리 (6,0)은 C. 맨 윗줄은 굴뚝 자리만 있다.
- 문 칸 (dx 4, dy 5) — 문 앞 = (x+4, y+6)
- 역할:
```text
......C...
SSSSSSSSSS
SSSSSSSSSS
SSSSSSSSSS
SSSSSSSSSS
SSSSSSSSSS
```
조립표(부품 → 키트 안 칸 x,y; 뒤의 것이 위에 겹친다):

| 부품 | x | y |
|---|---|---|
| `bd-out-roof-hl` | 0 | 1 |
| `bd-out-roof-m` | 1 | 1 |
| `bd-out-roof-m` | 2 | 1 |
| `bd-out-roof-m2` | 3 | 1 |
| `bd-out-roof-m` | 4 | 1 |
| `bd-out-roof-m` | 5 | 1 |
| `bd-out-roof-m` | 6 | 1 |
| `bd-out-roof-m2` | 7 | 1 |
| `bd-out-roof-m` | 8 | 1 |
| `bd-out-roof-hr` | 9 | 1 |
| `bd-out-ridge-end-l` | 1 | 1 |
| `bd-out-ridge-end-r` | 8 | 1 |
| `bd-out-log-l` | 0 | 4 |
| `bd-out-log-wall` | 1 | 4 |
| `bd-out-log-window-box` | 2 | 4 |
| `bd-out-log-wall` | 3 | 4 |
| `bd-out-log-door-green` | 4 | 4 |
| `bd-out-log-wall` | 5 | 4 |
| `bd-out-log-wall` | 6 | 4 |
| `bd-out-log-wall` | 7 | 4 |
| `bd-out-log-window-shut` | 8 | 4 |
| `bd-out-log-r` | 9 | 4 |
| `bd-out-ivy-corner` | 5 | 4 |
| `bd-out-chimney` | 6 | 0 |

### `bd-out-sand-patch` — 외곽 모래길 조각 6x4 (6×4)
성 밖 마을 길의 모래 바닥 표본: 6x4 불규칙 모래 조각, 가장자리 칸에는 잔디 가닥이 들쭉날쭉 섞인다(해시). 아래 그림만 있다(F).
- 배치: 가장자리 바깥 칸은 비어 있어 지도의 잔디가 보인다. 모래 타일 원본은 kits7_outskirts.sand_tile(seed).
- 역할:
```text
FFFFF.
FFFFFF
FFFFFF
FFFFFF
```

### `bd-out-well-plaza` — 외곽 우물 광장 (9×8)
불규칙한 원형 자갈 광장 9x8(연회색 둥근 돌 + 황갈색 틈, 바닥에 구운 그림), 가운데 돌 우물(양동이), 왼쪽 위 게시판(종이), 위쪽 둥근 관목 둘, 납작한 돌 무리 넷(둘은 바닥, 둘은 광장 밖 모서리 장식).
- 배치: 바깥 모서리 칸은 비어 있어 지도의 잔디가 보인다. 우물·게시판 윗줄은 C(플레이어 위에 그림), 아랫줄과 관목은 X. 광장 모서리 장식 돌 칸(7,0)(0,7)은 F(위 그림만).
- 역할:
```text
.FFSSF.C.
.CCFFFFF.
FSSFFFFFF
FFFCCFFFF
FFFSSFFFF
FFFFFFFFF
FFFFFFFF.
CFFF.F...
```

### `bd-out-well-plaza-sand` — 외곽 우물 광장 (모래길 위) (9×8)
불규칙한 원형 자갈 광장 9x8(연회색 둥근 돌 + 황갈색 틈, 바닥에 구운 그림), 가운데 돌 우물(양동이), 왼쪽 위 게시판(종이), 위쪽 둥근 관목 둘, 납작한 돌 무리 넷(둘은 바닥, 둘은 광장 밖 모서리 장식).
- 배치: 바깥 모서리 칸은 비어 있어 지도의 잔디가 보인다. 우물·게시판 윗줄은 C(플레이어 위에 그림), 아랫줄과 관목은 X. 광장 모서리 장식 돌 칸(7,0)(0,7)은 F(위 그림만).
- 역할:
```text
.FFSSF.C.
.CCFFFFF.
FSSFFFFFF
FFFCCFFFF
FFFSSFFFF
FFFFFFFFF
FFFFFFFF.
CFFF.F...
```

### `bd-out-woodpile` — 외곽 장작더미 (2×1)
쪼갠 장작을 쌓은 2칸 더미(둥근 단면이 앞을 향함).
- 배치: 집 옆 마당에 놓는다.
- 역할:
```text
SS
```

### `bd-out-woodshed` — 외곽 나무집 장작 헛간(붙임지붕) (3×3)
기둥 둘과 한쪽으로 기운 널 지붕 아래 쌓인 장작(둥근 단면), 3칸x3줄.
- 배치: 집 옆벽에 기대어 놓거나 마당에 단독으로 놓는다.
- 역할:
```text
SSS
SSS
SSS
```

## 부품 사전 (`outskirts-parts`)
- `bd-out-chimney` 1×2 — 외곽 나무집 굴뚝: 역할 `S / S`
- `bd-out-gable-4` 4×2 — 외곽 나무집 박공 지붕 4칸(작은 집): 역할 `SSSS / SSSS`
- `bd-out-hanging-sign` 1×1 — 외곽 나무집 걸이 간판: 역할 `S`
- `bd-out-ivy` 1×2 — 외곽 나무집 덩굴 벽칸: 역할 `S / S`
- `bd-out-ivy-corner` 1×2 — 외곽 나무집 덩굴 모서리: 역할 `S / S`
- `bd-out-log-arch` 1×2 — 외곽 통나무 벽 아치창칸: 역할 `S / S`
- `bd-out-log-door` 1×2 — 외곽 통나무 벽 문칸(갈색): 역할 `S / S`
- `bd-out-log-door-blue` 1×2 — 외곽 통나무 벽 문칸(청회색): 역할 `S / S`
- `bd-out-log-door-green` 1×2 — 외곽 통나무 벽 문칸(초록): 역할 `S / S`
- `bd-out-log-door-red` 1×2 — 외곽 통나무 벽 문칸(붉은갈색): 역할 `S / S`
- `bd-out-log-l` 1×2 — 외곽 통나무 벽 좌모서리: 역할 `S / S`
- `bd-out-log-r` 1×2 — 외곽 통나무 벽 우모서리: 역할 `S / S`
- `bd-out-log-wall` 1×2 — 외곽 통나무 벽 칸: 역할 `S / S`
- `bd-out-log-window` 1×2 — 외곽 통나무 벽 창칸: 역할 `S / S`
- `bd-out-log-window-box` 1×2 — 외곽 통나무 벽 꽃상자창칸: 역할 `S / S`
- `bd-out-log-window-shut` 1×2 — 외곽 통나무 벽 덧문창칸: 역할 `S / S`
- `bd-out-logg-arch` 1×2 — 외곽 통나무 벽 아치창칸 (박공벽 아래): 역할 `S / S`
- `bd-out-logg-door` 1×2 — 외곽 통나무 벽 문칸(갈색) (박공벽 아래): 역할 `S / S`
- `bd-out-logg-door-blue` 1×2 — 외곽 통나무 벽 문칸(청회색) (박공벽 아래): 역할 `S / S`
- `bd-out-logg-door-green` 1×2 — 외곽 통나무 벽 문칸(초록) (박공벽 아래): 역할 `S / S`
- `bd-out-logg-door-red` 1×2 — 외곽 통나무 벽 문칸(붉은갈색) (박공벽 아래): 역할 `S / S`
- `bd-out-logg-l` 1×2 — 외곽 통나무 벽 좌모서리 (박공벽 아래): 역할 `S / S`
- `bd-out-logg-r` 1×2 — 외곽 통나무 벽 우모서리 (박공벽 아래): 역할 `S / S`
- `bd-out-logg-wall` 1×2 — 외곽 통나무 벽 칸 (박공벽 아래): 역할 `S / S`
- `bd-out-logg-window` 1×2 — 외곽 통나무 벽 창칸 (박공벽 아래): 역할 `S / S`
- `bd-out-logg-window-box` 1×2 — 외곽 통나무 벽 꽃상자창칸 (박공벽 아래): 역할 `S / S`
- `bd-out-logg-window-shut` 1×2 — 외곽 통나무 벽 덧문창칸 (박공벽 아래): 역할 `S / S`
- `bd-out-plank-door` 1×3 — 외곽 판자 벽 문칸: 역할 `S / S / S`
- `bd-out-plank-l` 1×3 — 외곽 판자 벽 좌기둥: 역할 `S / S / S`
- `bd-out-plank-r` 1×3 — 외곽 판자 벽 우기둥: 역할 `S / S / S`
- `bd-out-plank-wall` 1×3 — 외곽 판자 벽 칸: 역할 `S / S / S`
- `bd-out-plank-window` 1×3 — 외곽 판자 벽 창칸: 역할 `S / S / S`
- `bd-out-plank-window-shut` 1×3 — 외곽 판자 벽 덧문창칸: 역할 `S / S / S`
- `bd-out-ridge-end-l` 1×1 — 용마루 통나무 단면 좌: 역할 `S`
- `bd-out-ridge-end-r` 1×1 — 용마루 통나무 단면 우: 역할 `S`
- `bd-out-roof-hl` 1×3 — 외곽 나무집 지붕 모임(추녀) 좌끝: 역할 `S / S / S`
- `bd-out-roof-hr` 1×3 — 외곽 나무집 지붕 모임(추녀) 우끝: 역할 `S / S / S`
- `bd-out-roof-l` 1×3 — 외곽 나무집 지붕 좌끝: 역할 `S / S / S`
- `bd-out-roof-m` 1×3 — 외곽 나무집 지붕 가운데: 역할 `S / S / S`
- `bd-out-roof-m2` 1×3 — 외곽 나무집 지붕 가운데(손본 자국·이끼): 역할 `S / S / S`
- `bd-out-roof-r` 1×3 — 외곽 나무집 지붕 우끝: 역할 `S / S / S`
- `bd-out-signpost` 1×2 — 외곽 이정표: 역할 `C / S`
