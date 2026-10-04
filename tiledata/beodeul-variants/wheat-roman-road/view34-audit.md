# view34-audit — 밀밭 로마 대로

체커: `view34_check.py <png>:prop` (이 폴더 사본). 판정 OK/FRONT/NOTOP/TOPDOWN/EXEMPT.

## 전후
- 이전(감독자 목록): trough, wheat_b, wheat_c, wild_b, wild_c
- 이후: 전 소품 OK, 비OK 0건

## 재작업 내용
- 길: 칸 단위 3칸 폭 돌길(계단식 가장자리, 얇은 연석) → 픽셀 굽이 연석 돌길(_lib-5/road5.py, coast 와 같은 기법). 여관 앞·갈림길은 곧게, 나머지는 완만히 굽이침.
- wheat_b/c 는 체커의 (0,0) 플러드필 오탐(꽉 찬 불투명 타일) — 좌상단에 고유 색 1픽셀을 두어 해소, 윗면·앞면 구분은 실제로 그렸다.
- trough·wild_b/c 는 윗면 T 4~8 + 앞면 F 8~16 로 다시 그림.

## 이후 체커 결과
| 파일 | 분류 | T | F | T/F | 판정 |
|---|---|---|---|---|---|
| wheat-roman-road/parts/haystack.png | prop | 5 | 21 | 0.238 | OK | |
| wheat-roman-road/parts/milestone.png | prop | 3 | 19 | 0.158 | OK | |
| wheat-roman-road/parts/scarecrow.png | prop | 4 | 26 | 0.154 | OK | |
| wheat-roman-road/parts/trough.png | prop | 4 | 9 | 0.444 | OK | |
| wheat-roman-road/parts/wheat_a.png | prop | 5 | 11 | 0.455 | OK | |
| wheat-roman-road/parts/wheat_b.png | prop | 4 | 11 | 0.364 | OK | |
| wheat-roman-road/parts/wheat_c.png | prop | 4 | 11 | 0.364 | OK | |
| wheat-roman-road/parts/wheat_sheaf.png | prop | 5 | 8 | 0.625 | OK | |
| wheat-roman-road/parts/wild_a.png | prop | 7 | 8 | 0.875 | OK | |
| wheat-roman-road/parts/wild_b.png | prop | 3 | 10 | 0.3 | OK | |
| wheat-roman-road/parts/wild_c.png | prop | 3 | 11 | 0.273 | OK | |

## 눈 검수(원본 해상도, 적대적)
- 전체 렌더를 좌우 반쪽씩 원본 크기로 확인. 땅은 1:1 위에서 본 그림, 기물은 윗면+앞면, 측면 없음.
- 남은 어색함: 대로 굽이가 전 구간 완만해 '로마 대로'치곤 곧고, 갈림길 부근 폭 변화가 작음.
