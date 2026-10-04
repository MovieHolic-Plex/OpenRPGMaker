# view34-audit — 해안 절벽길

체커: `view34_check.py <png>:prop` (이 폴더 사본). 판정 OK/FRONT/NOTOP/TOPDOWN/EXEMPT.

## 전후
- 이전(감독자 목록): driftwood, heath_c, rowboat
- 이후: 전 소품 OK, 비OK 0건

## 재작업 내용
- 길: 직선 판자띠 → 굽이치는 픽셀 연석 돌길(연석 돌덩이·돌판·닳은 가운데·바퀴 자국·흘러나온 흙). 중심선 road_c/반폭 road_hw, 칸 포장(terrain.paving)은 투명으로 바꿔 덮어씀.
- 절벽: 앞면 한 줄 → 서쪽 2단(고원 lev2 / 풀 선반 lev1 / 물 lev0) 앞면 3줄 + 계단 2곳 + 선반 구역(벤치·그물틀·통).
- 절벽 위 덤불 반복 → RIMP 7종(양치·돌·들꽃)을 낭떠러지 3칸 안에 p0.42 로 섞고 heath 는 잡음값으로 3단계 밀도.

## 이후 체커 결과
| 파일 | 분류 | T | F | T/F | 판정 |
|---|---|---|---|---|---|
| coast-cliff-road/parts/driftwood.png | prop | 4 | 8 | 0.5 | OK | |
| coast-cliff-road/parts/fir_l.png | prop | 7 | 56 | 0.125 | OK | |
| coast-cliff-road/parts/fir_m.png | prop | 6 | 41 | 0.146 | OK | |
| coast-cliff-road/parts/fir_m2.png | prop | 7 | 40 | 0.175 | OK | |
| coast-cliff-road/parts/fir_s.png | prop | 7 | 32 | 0.219 | OK | |
| coast-cliff-road/parts/haystack.png | prop | 5 | 21 | 0.238 | OK | |
| coast-cliff-road/parts/heath_a.png | prop | 3 | 9 | 0.333 | OK | |
| coast-cliff-road/parts/heath_b.png | prop | 3 | 9 | 0.333 | OK | |
| coast-cliff-road/parts/heath_c.png | prop | 4 | 8 | 0.5 | OK | |
| coast-cliff-road/parts/milestone.png | prop | 3 | 19 | 0.158 | OK | |
| coast-cliff-road/parts/rowboat.png | prop | 5 | 8 | 0.625 | OK | |
| coast-cliff-road/parts/sea_rock_l.png | prop | 6 | 12 | 0.5 | OK | |
| coast-cliff-road/parts/sea_rock_s.png | prop | 6 | 7 | 0.857 | OK | |
| coast-cliff-road/parts/sheep_a.png | prop | 4 | 5 | 0.8 | OK | |
| coast-cliff-road/parts/sheep_b.png | prop | 4 | 5 | 0.8 | OK | |
| coast-cliff-road/parts/shrine.png | prop | 4 | 30 | 0.133 | OK | |
| coast-cliff-road/parts/trough.png | prop | 4 | 9 | 0.444 | OK | |
| coast-cliff-road/parts/wayside_cross.png | prop | 4 | 23 | 0.174 | OK | |

## 눈 검수(원본 해상도, 적대적)
- 전체 렌더를 좌우 반쪽씩 원본 크기로 확인. 땅은 1:1 위에서 본 그림, 기물은 윗면+앞면, 측면 없음.
- 남은 어색함: 절벽 위 돌무더기(stones_a/c) 무리가 조금 반복적으로 보임.
