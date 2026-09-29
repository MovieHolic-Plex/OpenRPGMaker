# 귀족 저택 · 정원

tilesetId `beodeul_city` · 그림 `public/assets/beodeul-city/beodeul-city-chipset.png`(텍스처 `tex_beodeul_city`, 23936칸, 16px 칸, 한 줄 128칸 — 번호 n 의 칸은 행 n÷128, 열 n%128). 칸 번호는 모두 이 시트의 0기준 번호다. 다른 칩셋 번호를 섞지 않는다.

귀족 구역 = 저택 한 채 + 바로 아래 정형 정원. 정원의 가운데 자갈길(3칸)이 저택 현관 계단 아래에서 시작해 정원 발치(아래 줄)로 나간다 —
그 발치 칸 아래가 거리다. 예시 「언덕 위」: `bd-manor-timber`(72,41) + `bd-garden-formal`(72,53), 거리 62행. 예시 「강어귀」: `bd-manor-vine`(4,40) + 정원(4,52), 거리 61행.
저택 키트는 부품(`bd-mpart-*`)을 조립표대로 겹친 결과다. 새 저택을 조립할 때는 표처럼 벽 칸 줄 → 창·문 → 지붕 → 박공·지붕창·굴뚝 → 담쟁이 순서로 겹친다.

### `bd-garden-formal` — 정형 정원 (대칭 자갈 십자길·산울타리·사이프러스 통) (17×9)
17x9칸 대칭 정형 정원(저택 참고 그림): 3칸 폭 자갈 중심길(현관 계단과 같은 폭)과 가로길 셋·바깥 세로길, 네 화단마다 위아래 산울타리, 바깥쪽 통 속 사이프러스, 가운데 통 속 둥근 관목, 안쪽 쌍등 가로등. 길은 아래 그림(걷기), 나머지는 위 그림.
- 배치: 저택 바로 아래에 붙인다: 정원 x = 저택 x + (저택 문 칸 x - 8), 정원 y = 저택 y + 저택 높이(계단 끝). bd-manor-timber/vine 은 문 칸 x=8, 높이 12 → 같은 x, y+12 에 놓으면 정원 (8,0) 길칸이 계단 바로 아래에 이어진다. 화단 잔디 칸은 비워 둬 맵의 잔디가 보인다.
- 역할:
```text
.C...CCFFFCC...C.
.SSSSSCFFFCSSSSS.
.SSSSSSFFFSSSSSS.
.SSSSS.FFF.SSSSS.
FCFFFCCFFFCCFFFCF
.SSSSSCFFFCSSSSS.
.SSSSSSFFFSSSSSS.
.SSSSS.FFF.SSSSS.
.......FFF.......
```

### `bd-garden-gate` — 정원 정문 (돌기둥·열린 쇠문) (5×3)
5x3칸: 항아리 얹은 돌기둥 둘 사이 3칸 쇠문(활짝 열려 기둥 쪽에 접혀 있음), 바닥은 자갈. 가운데 세 칸은 걸을 수 있다.
- 배치: 정원 아래쪽 끝 가운데 길(7~9칸) 위에 놓는다: 게이트 x = 정원 x + 6, y = 정원 y + 8.
- 역할:
```text
SCCCS
SCCCS
SCFCS
```

### `bd-manor-small` — 작은 저택 (반목조 11칸) (11×12)
11칸x12줄 작은 대칭 저택: 4면 지붕, 가운데 5칸 박공, 좌우 3칸 날개(굴뚝 둘), 창 열, 기둥 현관과 끝장식 계단. 조립: bd-mpart-roof-l @(0,1), bd-mpart-roof-m @(3,1), bd-mpart-roof-m @(4,1), bd-mpart-roof-m @(5,1), bd-mpart-roof-m @(6,1), bd-mpart-roof-m @(7,1), bd-mpart-roof-r @(8,1), bd-mpart-gable @(3,1), bd-mpart-chimney @(3,0), bd-mpart-chimney @(7,0), bd-mpart-bay-win-a-l @(0,4), bd-mpart-bay-plain-l @(1,4), bd-mpart-bay-win-lit-l @(2,4), bd-mpart-bay-win-b-r @(8,4), bd-mpart-bay-plain-r @(9,4), bd-mpart-bay-win-a-r @(10,4), bd-mpart-bay-win-b-l @(3,5), bd-mpart-door-bay @(4,5), bd-mpart-bay-win-a-r @(7,5), bd-mpart-porch @(4,7), bd-mpart-stairs @(3,10).
- 배치: 문은 (5,9). 문 앞 (5,10)은 계단 맨 윗칸.
- 문 칸 (dx 5, dy 9) — 문 앞 = (x+5, y+10)
- 역할:
```text
...C...C...
CSSSSSSSSSC
SSSSSSSSSSS
SSSSSSSSSSS
SSSSSSSSSSS
SSSSSSSSSSS
SSSSSSSSSSS
SSSSSSSSSSS
SSSSSSSSSSS
...SSSSS...
...SFFFS...
...SFFFS...
```
조립표(부품 → 키트 안 칸 x,y; 뒤의 것이 위에 겹친다):

| 부품 | x | y |
|---|---|---|
| `bd-mpart-roof-l` | 0 | 1 |
| `bd-mpart-roof-m` | 3 | 1 |
| `bd-mpart-roof-m` | 4 | 1 |
| `bd-mpart-roof-m` | 5 | 1 |
| `bd-mpart-roof-m` | 6 | 1 |
| `bd-mpart-roof-m` | 7 | 1 |
| `bd-mpart-roof-r` | 8 | 1 |
| `bd-mpart-gable` | 3 | 1 |
| `bd-mpart-chimney` | 3 | 0 |
| `bd-mpart-chimney` | 7 | 0 |
| `bd-mpart-bay-win-a-l` | 0 | 4 |
| `bd-mpart-bay-plain-l` | 1 | 4 |
| `bd-mpart-bay-win-lit-l` | 2 | 4 |
| `bd-mpart-bay-win-b-r` | 8 | 4 |
| `bd-mpart-bay-plain-r` | 9 | 4 |
| `bd-mpart-bay-win-a-r` | 10 | 4 |
| `bd-mpart-bay-win-b-l` | 3 | 5 |
| `bd-mpart-door-bay` | 4 | 5 |
| `bd-mpart-bay-win-a-r` | 7 | 5 |
| `bd-mpart-porch` | 4 | 7 |
| `bd-mpart-stairs` | 3 | 10 |

### `bd-manor-timber` — 귀족 저택 (반목조, 가운데 박공) (17×12)
좌우 대칭 17칸x12줄 반목조 저택: 가파른 테라코타 4면 지붕, 가운데 5칸 급경사 박공(창 넷·둥근 창), 양 날개 지붕창·굴뚝, 아치 창과 꽃상자가 달린 벽칸 열과 층 사이 띠, 기둥 둘 박공 현관, 꼭지 장식 돌기둥 계단. 조립: bd-mpart-roof-l @(0,1), bd-mpart-roof-m @(3,1), bd-mpart-roof-m @(4,1), bd-mpart-roof-m @(5,1), bd-mpart-roof-m @(6,1), bd-mpart-roof-m @(7,1), bd-mpart-roof-m @(8,1), bd-mpart-roof-m @(9,1), bd-mpart-roof-m @(10,1), bd-mpart-roof-m @(11,1), bd-mpart-roof-m @(12,1), bd-mpart-roof-m @(13,1), bd-mpart-roof-r @(14,1), bd-mpart-gable @(6,1), bd-mpart-dormer @(2,2), bd-mpart-dormer-lit @(13,2), bd-mpart-chimney @(5,0), bd-mpart-chimney @(11,0), bd-mpart-bay-win-b-l @(0,4), bd-mpart-bay-plain-l @(1,4), bd-mpart-bay-win-a-l @(2,4), bd-mpart-bay-plain-l @(3,4), bd-mpart-bay-win-lit-l @(4,4), bd-mpart-bay-plain-l @(5,4), bd-mpart-bay-plain-r @(11,4), bd-mpart-bay-win-a-r @(12,4), bd-mpart-bay-plain-r @(13,4), bd-mpart-bay-win-b-r @(14,4), bd-mpart-bay-plain-r @(15,4), bd-mpart-bay-win-a-r @(16,4), bd-mpart-bay-win-a-l @(6,5), bd-mpart-door-bay @(7,5), bd-mpart-bay-win-b-r @(10,5), bd-mpart-porch @(7,7), bd-mpart-stairs @(6,10).
- 배치: 문은 (8,9). 문 앞 (8,10)은 계단 맨 윗칸(걸음). 정원 bd-garden-formal 은 같은 x 에서 바로 아래(y=12)에 붙인다.
- 문 칸 (dx 8, dy 9) — 문 앞 = (x+8, y+10)
- 역할:
```text
.....C.....C.....
CSSSSSSSSSSSSSSSC
SSSSSSSSSSSSSSSSS
SSSSSSSSSSSSSSSSS
SSSSSSSSSSSSSSSSS
SSSSSSSSSSSSSSSSS
SSSSSSSSSSSSSSSSS
SSSSSSSSSSSSSSSSS
SSSSSSSSSSSSSSSSS
......SSSSS......
......SFFFS......
......SFFFS......
```
조립표(부품 → 키트 안 칸 x,y; 뒤의 것이 위에 겹친다):

| 부품 | x | y |
|---|---|---|
| `bd-mpart-roof-l` | 0 | 1 |
| `bd-mpart-roof-m` | 3 | 1 |
| `bd-mpart-roof-m` | 4 | 1 |
| `bd-mpart-roof-m` | 5 | 1 |
| `bd-mpart-roof-m` | 6 | 1 |
| `bd-mpart-roof-m` | 7 | 1 |
| `bd-mpart-roof-m` | 8 | 1 |
| `bd-mpart-roof-m` | 9 | 1 |
| `bd-mpart-roof-m` | 10 | 1 |
| `bd-mpart-roof-m` | 11 | 1 |
| `bd-mpart-roof-m` | 12 | 1 |
| `bd-mpart-roof-m` | 13 | 1 |
| `bd-mpart-roof-r` | 14 | 1 |
| `bd-mpart-gable` | 6 | 1 |
| `bd-mpart-dormer` | 2 | 2 |
| `bd-mpart-dormer-lit` | 13 | 2 |
| `bd-mpart-chimney` | 5 | 0 |
| `bd-mpart-chimney` | 11 | 0 |
| `bd-mpart-bay-win-b-l` | 0 | 4 |
| `bd-mpart-bay-plain-l` | 1 | 4 |
| `bd-mpart-bay-win-a-l` | 2 | 4 |
| `bd-mpart-bay-plain-l` | 3 | 4 |
| `bd-mpart-bay-win-lit-l` | 4 | 4 |
| `bd-mpart-bay-plain-l` | 5 | 4 |
| `bd-mpart-bay-plain-r` | 11 | 4 |
| `bd-mpart-bay-win-a-r` | 12 | 4 |
| `bd-mpart-bay-plain-r` | 13 | 4 |
| `bd-mpart-bay-win-b-r` | 14 | 4 |
| `bd-mpart-bay-plain-r` | 15 | 4 |
| `bd-mpart-bay-win-a-r` | 16 | 4 |
| `bd-mpart-bay-win-a-l` | 6 | 5 |
| `bd-mpart-door-bay` | 7 | 5 |
| `bd-mpart-bay-win-b-r` | 10 | 5 |
| `bd-mpart-porch` | 7 | 7 |
| `bd-mpart-stairs` | 6 | 10 |

### `bd-manor-tower` — 귀족 저택 (둥근 탑 딸린 본채) (14×11)
비대칭 14칸x11줄: 왼쪽에 3칸 둥근 회벽 탑(원뿔 테라코타 지붕, 층마다 아치 창), 오른쪽으로 길게 4면 지붕 본채(지붕창·현관 위 벽 박공·굴뚝), 문은 본채 오른쪽 3칸 현관(박공 지붕 기둥 현관, 꼭지 장식 계단). 조립: bd-mpart-roof-l @(2,1), bd-mpart-roof-m @(5,1), bd-mpart-roof-m @(6,1), bd-mpart-roof-m @(7,1), bd-mpart-roof-m @(8,1), bd-mpart-roof-m @(9,1), bd-mpart-roof-m @(10,1), bd-mpart-roof-r @(11,1), bd-mpart-dormer @(5,2), bd-mpart-gable-s @(8,1), bd-mpart-chimney @(7,0), bd-mpart-bay-plain-l @(2,4), bd-mpart-bay-win-a-l @(3,4), bd-mpart-bay-plain-l @(4,4), bd-mpart-bay-win-b-l @(5,4), bd-mpart-bay-plain-l @(6,4), bd-mpart-bay-win-a-l @(7,4), bd-mpart-door-bay @(8,4), bd-mpart-bay-win-lit-r @(11,4), bd-mpart-bay-plain-r @(12,4), bd-mpart-bay-win-b-r @(13,4), bd-mpart-porch @(8,6), bd-mpart-stairs @(7,9), bd-mpart-tower @(0,0).
- 배치: 문은 (9,8). 문 앞 (9,9)은 계단 맨 윗칸. 탑 아래쪽은 본채 앞 마당 쪽으로 튀어나오지 않아 같은 바닥선을 쓴다.
- 문 칸 (dx 9, dy 8) — 문 앞 = (x+9, y+9)
- 역할:
```text
.C.....C......
CSSSSSSSSSSSSC
SSSSSSSSSSSSSS
SSSSSSSSSSSSSS
SSSSSSSSSSSSSS
SSSSSSSSSSSSSS
SSSSSSSSSSSSSS
SSSSSSSSSSSSSS
SSSSSSSSSSSSSS
.......SFFFS..
.......SFFFS..
```
조립표(부품 → 키트 안 칸 x,y; 뒤의 것이 위에 겹친다):

| 부품 | x | y |
|---|---|---|
| `bd-mpart-roof-l` | 2 | 1 |
| `bd-mpart-roof-m` | 5 | 1 |
| `bd-mpart-roof-m` | 6 | 1 |
| `bd-mpart-roof-m` | 7 | 1 |
| `bd-mpart-roof-m` | 8 | 1 |
| `bd-mpart-roof-m` | 9 | 1 |
| `bd-mpart-roof-m` | 10 | 1 |
| `bd-mpart-roof-r` | 11 | 1 |
| `bd-mpart-dormer` | 5 | 2 |
| `bd-mpart-gable-s` | 8 | 1 |
| `bd-mpart-chimney` | 7 | 0 |
| `bd-mpart-bay-plain-l` | 2 | 4 |
| `bd-mpart-bay-win-a-l` | 3 | 4 |
| `bd-mpart-bay-plain-l` | 4 | 4 |
| `bd-mpart-bay-win-b-l` | 5 | 4 |
| `bd-mpart-bay-plain-l` | 6 | 4 |
| `bd-mpart-bay-win-a-l` | 7 | 4 |
| `bd-mpart-door-bay` | 8 | 4 |
| `bd-mpart-bay-win-lit-r` | 11 | 4 |
| `bd-mpart-bay-plain-r` | 12 | 4 |
| `bd-mpart-bay-win-b-r` | 13 | 4 |
| `bd-mpart-porch` | 8 | 6 |
| `bd-mpart-stairs` | 7 | 9 |
| `bd-mpart-tower` | 0 | 0 |

### `bd-manor-vine` — 귀족 저택 (담쟁이 덮인 반목조) (17×12)
bd-manor-timber 와 같은 뼈대에 담쟁이(지붕 좌우 끝, 벽 기둥, 현관 기둥)와 벽 밑 덤불을 얹은 변형. 오래된 저택 느낌. 조립: bd-mpart-roof-l @(0,1), bd-mpart-roof-m @(3,1), bd-mpart-roof-m @(4,1), bd-mpart-roof-m @(5,1), bd-mpart-roof-m @(6,1), bd-mpart-roof-m @(7,1), bd-mpart-roof-m @(8,1), bd-mpart-roof-m @(9,1), bd-mpart-roof-m @(10,1), bd-mpart-roof-m @(11,1), bd-mpart-roof-m @(12,1), bd-mpart-roof-m @(13,1), bd-mpart-roof-r @(14,1), bd-mpart-gable @(6,1), bd-mpart-dormer @(2,2), bd-mpart-dormer-lit @(13,2), bd-mpart-chimney @(5,0), bd-mpart-chimney @(11,0), bd-mpart-bay-win-b-l @(0,4), bd-mpart-bay-plain-l @(1,4), bd-mpart-bay-win-a-l @(2,4), bd-mpart-bay-plain-l @(3,4), bd-mpart-bay-win-lit-l @(4,4), bd-mpart-bay-plain-l @(5,4), bd-mpart-bay-plain-r @(11,4), bd-mpart-bay-win-a-r @(12,4), bd-mpart-bay-plain-r @(13,4), bd-mpart-bay-win-b-r @(14,4), bd-mpart-bay-plain-r @(15,4), bd-mpart-bay-win-a-r @(16,4), bd-mpart-bay-win-a-l @(6,5), bd-mpart-door-bay @(7,5), bd-mpart-bay-win-b-r @(10,5), bd-mpart-porch @(7,7), bd-mpart-stairs @(6,10), bd-mpart-ivy-eave-l @(0,2), bd-mpart-ivy-eave-r @(14,2), bd-mpart-ivy-wall-a @(1,5), bd-mpart-ivy-wall-b @(4,5), bd-mpart-ivy-wall-b @(12,5), bd-mpart-ivy-wall-a @(15,4), bd-mpart-ivy-wall-a @(7,7), bd-mpart-ivy-wall-b @(9,7), bd-mpart-ivy-wall-a @(5,4), bd-mpart-bush-c @(1,7), bd-mpart-bush-e @(4,7), bd-mpart-bush-e @(11,7), bd-mpart-bush-c @(14,7), bd-mpart-bush-c @(5,8), bd-mpart-bush-e @(10,8).
- 배치: 문은 (8,9). 충돌은 timber 와 같고 덤불이 앉은 칸은 막힘.
- 문 칸 (dx 8, dy 9) — 문 앞 = (x+8, y+10)
- 역할:
```text
.....C.....C.....
CSSSSSSSSSSSSSSSC
SSSSSSSSSSSSSSSSS
SSSSSSSSSSSSSSSSS
SSSSSSSSSSSSSSSSS
SSSSSSSSSSSSSSSSS
SSSSSSSSSSSSSSSSS
SSSSSSSSSSSSSSSSS
SSSSSSSSSSSSSSSSS
.....SSSSSSS.....
......SFFFS......
......SFFFS......
```
조립표(부품 → 키트 안 칸 x,y; 뒤의 것이 위에 겹친다):

| 부품 | x | y |
|---|---|---|
| `bd-mpart-roof-l` | 0 | 1 |
| `bd-mpart-roof-m` | 3 | 1 |
| `bd-mpart-roof-m` | 4 | 1 |
| `bd-mpart-roof-m` | 5 | 1 |
| `bd-mpart-roof-m` | 6 | 1 |
| `bd-mpart-roof-m` | 7 | 1 |
| `bd-mpart-roof-m` | 8 | 1 |
| `bd-mpart-roof-m` | 9 | 1 |
| `bd-mpart-roof-m` | 10 | 1 |
| `bd-mpart-roof-m` | 11 | 1 |
| `bd-mpart-roof-m` | 12 | 1 |
| `bd-mpart-roof-m` | 13 | 1 |
| `bd-mpart-roof-r` | 14 | 1 |
| `bd-mpart-gable` | 6 | 1 |
| `bd-mpart-dormer` | 2 | 2 |
| `bd-mpart-dormer-lit` | 13 | 2 |
| `bd-mpart-chimney` | 5 | 0 |
| `bd-mpart-chimney` | 11 | 0 |
| `bd-mpart-bay-win-b-l` | 0 | 4 |
| `bd-mpart-bay-plain-l` | 1 | 4 |
| `bd-mpart-bay-win-a-l` | 2 | 4 |
| `bd-mpart-bay-plain-l` | 3 | 4 |
| `bd-mpart-bay-win-lit-l` | 4 | 4 |
| `bd-mpart-bay-plain-l` | 5 | 4 |
| `bd-mpart-bay-plain-r` | 11 | 4 |
| `bd-mpart-bay-win-a-r` | 12 | 4 |
| `bd-mpart-bay-plain-r` | 13 | 4 |
| `bd-mpart-bay-win-b-r` | 14 | 4 |
| `bd-mpart-bay-plain-r` | 15 | 4 |
| `bd-mpart-bay-win-a-r` | 16 | 4 |
| `bd-mpart-bay-win-a-l` | 6 | 5 |
| `bd-mpart-door-bay` | 7 | 5 |
| `bd-mpart-bay-win-b-r` | 10 | 5 |
| `bd-mpart-porch` | 7 | 7 |
| `bd-mpart-stairs` | 6 | 10 |
| `bd-mpart-ivy-eave-l` | 0 | 2 |
| `bd-mpart-ivy-eave-r` | 14 | 2 |
| `bd-mpart-ivy-wall-a` | 1 | 5 |
| `bd-mpart-ivy-wall-b` | 4 | 5 |
| `bd-mpart-ivy-wall-b` | 12 | 5 |
| `bd-mpart-ivy-wall-a` | 15 | 4 |
| `bd-mpart-ivy-wall-a` | 7 | 7 |
| `bd-mpart-ivy-wall-b` | 9 | 7 |
| `bd-mpart-ivy-wall-a` | 5 | 4 |
| `bd-mpart-bush-c` | 1 | 7 |
| `bd-mpart-bush-e` | 4 | 7 |
| `bd-mpart-bush-e` | 11 | 7 |
| `bd-mpart-bush-c` | 14 | 7 |
| `bd-mpart-bush-c` | 5 | 8 |
| `bd-mpart-bush-e` | 10 | 8 |

## 부품 사전 (`manor-parts`)
- `bd-mpart-bay-plain-l` 1×5 — 저택 민벽 벽칸 (왼기둥): 역할 `S / S / S / S / S`
- `bd-mpart-bay-plain-r` 1×5 — 저택 민벽 벽칸 (오른기둥): 역할 `S / S / S / S / S`
- `bd-mpart-bay-win-a-l` 1×5 — 저택 창 벽칸 붉은 꽃 (왼기둥): 역할 `S / S / S / S / S`
- `bd-mpart-bay-win-a-r` 1×5 — 저택 창 벽칸 붉은 꽃 (오른기둥): 역할 `S / S / S / S / S`
- `bd-mpart-bay-win-b-l` 1×5 — 저택 창 벽칸 흰 꽃·초록 틀 (왼기둥): 역할 `S / S / S / S / S`
- `bd-mpart-bay-win-b-r` 1×5 — 저택 창 벽칸 흰 꽃·초록 틀 (오른기둥): 역할 `S / S / S / S / S`
- `bd-mpart-bay-win-lit-l` 1×5 — 저택 창 벽칸 불 켠 창 (왼기둥): 역할 `S / S / S / S / S`
- `bd-mpart-bay-win-lit-r` 1×5 — 저택 창 벽칸 불 켠 창 (오른기둥): 역할 `S / S / S / S / S`
- `bd-mpart-bush-c` 2×2 — 벽 밑 덤불(짙은 둥근): 역할 `SS / SS`
- `bd-mpart-bush-e` 2×2 — 벽 밑 덤불(밝은 둥근): 역할 `SS / SS`
- `bd-mpart-chimney` 1×2 — 저택 굴뚝: 역할 `C / S`
- `bd-mpart-cypress-tub` 1×3 — 통 속 사이프러스: 역할 `C / C / S`
- `bd-mpart-door-bay` 3×5 — 저택 현관 벽칸(3칸): 역할 `SSS / SSS / SSS / SSS / SSS`
- `bd-mpart-dormer` 2×2 — 지붕 창(다락 박공창): 역할 `SS / SS`
- `bd-mpart-dormer-lit` 2×2 — 지붕 창(불 켠 창): 역할 `SS / SS`
- `bd-mpart-flower-patch` 1×1 — 화단 꽃무더기: 역할 `S`
- `bd-mpart-gable` 5×4 — 저택 가운데 박공(급경사): 역할 `.CSC. / CSSSC / SSSSS / SSSSS`
- `bd-mpart-gable-s` 3×3 — 현관 위 벽 박공(3칸): 역할 `.S. / SSS / SSS`
- `bd-mpart-hedge` 1×1 — 다듬은 산울타리 조각: 역할 `S`
- `bd-mpart-ivy-arch` 3×3 — 담쟁이 아치(정원 입구): 역할 `SCS / S.S / S.S`
- `bd-mpart-ivy-eave-l` 3×3 — 담쟁이(처마 왼쪽): 역할 `SS. / SS. / S..`
- `bd-mpart-ivy-eave-r` 3×3 — 담쟁이(처마 오른쪽): 역할 `.SS / .SS / ..S`
- `bd-mpart-ivy-wall-a` 1×3 — 담쟁이(벽 기둥 타고): 역할 `S / S / S`
- `bd-mpart-ivy-wall-b` 1×3 — 담쟁이(벽 기둥 타고) b: 역할 `S / S / S`
- `bd-mpart-lamp-post` 1×3 — 정원 가로등(쌍등): 역할 `C / C / S`
- `bd-mpart-low-wall` 1×1 — 낮은 정원 돌담 조각: 역할 `S`
- `bd-mpart-porch` 3×3 — 기둥 박공 현관 지붕: 역할 `SSS / SCS / S.S`
- `bd-mpart-rail` 1×1 — 낮은 난간(난간동자) 조각: 역할 `S`
- `bd-mpart-roof-l` 3×3 — 저택 지붕 좌끝(4면 지붕): 역할 `CSS / SSS / SSS`
- `bd-mpart-roof-m` 1×3 — 저택 지붕 가운데: 역할 `S / S / S`
- `bd-mpart-roof-r` 3×3 — 저택 지붕 우끝(4면 지붕): 역할 `SSC / SSS / SSS`
- `bd-mpart-shrub-tub` 1×2 — 통 속 둥근 관목: 역할 `C / S`
- `bd-mpart-stairs` 5×2 — 돌계단과 끝장식 기둥: 역할 `SFFFS / SFFFS`
- `bd-mpart-tower` 3×9 — 저택 둥근 옆탑(원뿔 지붕): 역할 `.C. / CSC / SSS / SSS / SSS / SSS / SSS / SSS / SSS`
