# view34-audit — 깊은 숲길

체커: `view34_check.py <png>:prop` (이 폴더 사본). 판정 OK/FRONT/NOTOP/TOPDOWN/EXEMPT.

## 전후
- 이전(감독자 목록): cairn, cairn_s, chopping_block, fern_a/b/c, heath_c, hide_rack, hunter_post, log_fallen, ruin_gate, stones_a/b, toadstools_a/b/c, wild_b/c
- 이후: 전 소품 OK, 비OK 0건

## 재작업 내용
- 소품 19종 전부 윗면 T + 앞면 F 로 손 도트 재작성(_lib-5/parts5b.py). 옆면·정면 도안 제거, 빛은 왼쪽 위.
- 레이아웃(오솔길·개울·폐문·사냥꾼 초소)은 그대로 — 눈으로 봐서 위반 없음.

## 이후 체커 결과
| 파일 | 분류 | T | F | T/F | 판정 |
|---|---|---|---|---|---|
| deep-forest-path/parts/cairn.png | prop | 3 | 20 | 0.15 | OK | |
| deep-forest-path/parts/cairn_s.png | prop | 3 | 11 | 0.273 | OK | |
| deep-forest-path/parts/campfire.png | prop | 3 | 8 | 0.375 | OK | |
| deep-forest-path/parts/chopping_block.png | prop | 4 | 7 | 0.571 | OK | |
| deep-forest-path/parts/fern_a.png | prop | 3 | 9 | 0.333 | OK | |
| deep-forest-path/parts/fern_b.png | prop | 5 | 7 | 0.714 | OK | |
| deep-forest-path/parts/fern_c.png | prop | 5 | 9 | 0.556 | OK | |
| deep-forest-path/parts/fir_l.png | prop | 7 | 56 | 0.125 | OK | |
| deep-forest-path/parts/fir_m.png | prop | 6 | 41 | 0.146 | OK | |
| deep-forest-path/parts/fir_m2.png | prop | 7 | 40 | 0.175 | OK | |
| deep-forest-path/parts/fir_s.png | prop | 7 | 32 | 0.219 | OK | |
| deep-forest-path/parts/heath_a.png | prop | 3 | 9 | 0.333 | OK | |
| deep-forest-path/parts/heath_b.png | prop | 3 | 9 | 0.333 | OK | |
| deep-forest-path/parts/heath_c.png | prop | 4 | 8 | 0.5 | OK | |
| deep-forest-path/parts/hide_rack.png | prop | 4 | 25 | 0.16 | OK | |
| deep-forest-path/parts/hunter_post.png | prop | 3 | 24 | 0.125 | OK | |
| deep-forest-path/parts/log_fallen.png | prop | 4 | 9 | 0.444 | OK | |
| deep-forest-path/parts/ruin_gate.png | prop | 8 | 41 | 0.195 | OK | |
| deep-forest-path/parts/stones_a.png | prop | 3 | 12 | 0.25 | OK | |
| deep-forest-path/parts/stones_b.png | prop | 3 | 9 | 0.333 | OK | |
| deep-forest-path/parts/stones_c.png | prop | 3 | 8 | 0.375 | OK | |
| deep-forest-path/parts/stump.png | prop | 5 | 6 | 0.833 | OK | |
| deep-forest-path/parts/toadstools_a.png | prop | 3 | 10 | 0.3 | OK | |
| deep-forest-path/parts/toadstools_b.png | prop | 3 | 10 | 0.3 | OK | |
| deep-forest-path/parts/toadstools_c.png | prop | 3 | 10 | 0.3 | OK | |
| deep-forest-path/parts/wild_a.png | prop | 7 | 8 | 0.875 | OK | |
| deep-forest-path/parts/wild_b.png | prop | 3 | 10 | 0.3 | OK | |
| deep-forest-path/parts/wild_c.png | prop | 3 | 11 | 0.273 | OK | |

## 눈 검수(원본 해상도, 적대적)
- 전체 렌더를 좌우 반쪽씩 원본 크기로 확인. 땅은 1:1 위에서 본 그림, 기물은 윗면+앞면, 측면 없음.
- 남은 어색함: 오솔길이 직각 꺾임(칸 단위 흙길). 숲길이라 판자띠는 아니나 굽이가 없음. 폐문 ruin_gate 는 어두워 작게 보임.
