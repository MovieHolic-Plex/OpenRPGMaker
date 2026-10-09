# view34-audit — 산 고개

체커: `view34_check.py <png>:prop` (이 폴더 사본). 판정 OK/FRONT/NOTOP/TOPDOWN/EXEMPT.

## 전후
- 이전(감독자 목록): alpine_a/b, boulder_m, cairn, cairn_s, guard_post, heath_c, log_fallen, scree_a/b, stone_bridge, trail_post, trough, wall_seg
- 이후: 전 소품 OK, 비OK 0건

## 재작업 내용
- 소품 14종 윗면 T + 앞면 F 로 재작성. stone_bridge 는 상판(윗면)+앞 벽면, 아래 물길 폭 맞춤.
- 절벽은 이미 앞면 2칸(체커 대상 밖) — 눈으로 확인만.

## 이후 체커 결과
| 파일 | 분류 | T | F | T/F | 판정 |
|---|---|---|---|---|---|
| mountain-pass/parts/alpine_a.png | prop | 4 | 8 | 0.5 | OK | |
| mountain-pass/parts/alpine_b.png | prop | 4 | 9 | 0.444 | OK | |
| mountain-pass/parts/boulder_l.png | prop | 7 | 17 | 0.412 | OK | |
| mountain-pass/parts/boulder_m.png | prop | 6 | 11 | 0.545 | OK | |
| mountain-pass/parts/brazier.png | prop | 4 | 23 | 0.174 | OK | |
| mountain-pass/parts/cairn.png | prop | 3 | 20 | 0.15 | OK | |
| mountain-pass/parts/cairn_s.png | prop | 3 | 11 | 0.273 | OK | |
| mountain-pass/parts/campfire.png | prop | 3 | 8 | 0.375 | OK | |
| mountain-pass/parts/fir_l.png | prop | 7 | 56 | 0.125 | OK | |
| mountain-pass/parts/fir_m.png | prop | 6 | 41 | 0.146 | OK | |
| mountain-pass/parts/fir_m2.png | prop | 7 | 40 | 0.175 | OK | |
| mountain-pass/parts/fir_s.png | prop | 7 | 32 | 0.219 | OK | |
| mountain-pass/parts/guard_post.png | prop | 17 | 40 | 0.425 | OK | |
| mountain-pass/parts/heath_a.png | prop | 3 | 9 | 0.333 | OK | |
| mountain-pass/parts/heath_b.png | prop | 3 | 9 | 0.333 | OK | |
| mountain-pass/parts/heath_c.png | prop | 4 | 8 | 0.5 | OK | |
| mountain-pass/parts/log_fallen.png | prop | 4 | 9 | 0.444 | OK | |
| mountain-pass/parts/milestone.png | prop | 3 | 19 | 0.158 | OK | |
| mountain-pass/parts/scree_a.png | prop | 4 | 8 | 0.5 | OK | |
| mountain-pass/parts/scree_b.png | prop | 4 | 9 | 0.444 | OK | |
| mountain-pass/parts/shrine.png | prop | 4 | 30 | 0.133 | OK | |
| mountain-pass/parts/stone_bridge.png | prop | 10 | 51 | 0.196 | OK | |
| mountain-pass/parts/stump.png | prop | 5 | 6 | 0.833 | OK | |
| mountain-pass/parts/trail_post.png | prop | 3 | 23 | 0.13 | OK | |
| mountain-pass/parts/trough.png | prop | 4 | 9 | 0.444 | OK | |
| mountain-pass/parts/wall_seg.png | prop | 4 | 9 | 0.444 | OK | |
| mountain-pass/parts/wayside_cross.png | prop | 4 | 23 | 0.174 | OK | |

## 눈 검수(원본 해상도, 적대적)
- 전체 렌더를 좌우 반쪽씩 원본 크기로 확인. 땅은 1:1 위에서 본 그림, 기물은 윗면+앞면, 측면 없음.
- 남은 어색함: 고개 길이 칸 단위 계단식 가장자리(직각 꺾임) — 판자띠보다는 흙길이지만 굽이는 없음. coast/wheat 식 픽셀 길로 바꾸면 더 좋아짐.
