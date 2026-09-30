# 구역 안 조각 배치 — 왕성 · 저택 · 포룸 정답 좌표

Python 조립기(`scripts/content/lib/city_v6/city6_kits.py`)가 찍은 조각의 맵 좌표(왼쪽 위 칸, 폭·높이). 구역 키트 안의 그림이 이 조각들이다.
왕성은 궁전(23×8, 문 16,10) → 테라스 → 궁전 문 축의 말굽 계단(14,12 폭 5) → 원탑 넷(1·11·19·29열, 19행) → 성벽 → 성문루(14,19) → 도개교(15,23) → 둑길(15,26) → 계단(15,30) → 큰길 순서로 이어진다.
저택은 담(37,3 19×20) 안에 본채(39,3 문 45,11)·부엌·마차고·문지기 집·정원, 남쪽 쇠살문(44~45,22)이 유일한 출입구다.
포룸은 주랑(55,35)·신전(61,35 문 64,40, 기단 계단)·카페(69,35)·분수(63,43)·석상 둘·아치 문(55,45).

### castle (상자 [0, 0, 33, 33])

| 조각 | x | y | w | h | 비고 |
|---|---|---|---|---|---|
| castle.palace | 5 | 3 | 23 | 8 | [16, 10], ['wing 6 (2 storeys)', 'drum tower 3', 'centre block 5 (3 storeys, crow-stepped gable, great door)', 'drum tower 3', 'wing 6'] |
| castle.terrace | 4 | 11 | 25 | 1 |  |
| castle.grand_stair | 14 | 12 | 5 | 3 | terrain stair through the ashlar rock face, on the palace door axis |
| castle.tower_round | 1 | 19 | 3 | 4 |  |
| castle.tower_round | 11 | 19 | 3 | 4 |  |
| castle.tower_round | 19 | 19 | 3 | 4 |  |
| castle.tower_round | 29 | 19 | 3 | 4 |  |
| castle.wall_h | 4 | 19 | 7 | 4 | ground |
| castle.gatehouse | 14 | 19 | 5 | 4 | ground |
| castle.wall_h | 22 | 19 | 7 | 4 | ground |
| castle.drawbridge | 15 | 23 | 3 | 3 |  |
| castle.wall_stair | 4 | 18 | 2 | 1 | ground |
| castle.wall_stair | 27 | 18 | 2 | 1 | ground |
| castle.wall_v | 32 | 3 | 1 | 16 | ground |
| castle.stable | 1 | 3 | 3 | 5 | [1, 7] |
| castle.smithy | 29 | 9 | 3 | 5 | [30, 13] |
| castle.barracks | 29 | 3 | 3 | 5 | [30, 7] |
| castle.bailey | 1 | 1 | 31 | 18 |  |
| castle.causeway | 15 | 26 | 3 | 4 | paved approach: drawbridge -> causeway -> stair (15,30,3) -> main street; guardian statues at x13-14 and x18-19 |
### estate (상자 [36, 2, 56, 23])

| 조각 | x | y | w | h | 비고 |
|---|---|---|---|---|---|
| estate.wall | 37 | 3 | 19 | 20 | stucco + terracotta coping |
| estate.gate | 43 | 22 | 1 | 1 |  |
| estate.gate | 46 | 22 | 1 | 1 |  |
| estate.gate | 44 | 22 | 2 | 1 | iron_gate_open |
| estate.manor | 39 | 3 | 13 | 9 | [45, 11] |
| estate.kitchen | 52 | 3 | 3 | 3 |  |
| estate.coach_house | 52 | 7 | 3 | 5 | [53, 11] |
| estate.lodge | 51 | 16 | 3 | 5 | [52, 20] |
| estate.garden | 38 | 12 | 17 | 10 |  |
### forum (상자 [54, 34, 75, 47])

| 조각 | x | y | w | h | 비고 |
|---|---|---|---|---|---|
| forum.stoa | 55 | 35 | 5 | 5 |  |
| forum.temple | 61 | 35 | 7 | 7 | [64, 40] |
| forum.cafe | 69 | 35 | 6 | 5 | [71, 39] |
| forum.cafe_table | 69 | 41 | 2 | 2 |  |
| forum.cafe_parasol | 72 | 42 | 3 | 3 |  |
| forum.cafe_table | 69 | 44 | 2 | 2 |  |
| forum.menu_board | 68 | 40 | 1 | 2 |  |
| forum.planter_box | 74 | 40 | 1 | 2 |  |
| forum.fountain | 63 | 43 | 3 | 3 |  |
| forum.statue | 60 | 42 | 2 | 4 |  |
| forum.statue | 67 | 42 | 2 | 4 |  |
| forum.gate | 55 | 45 | 5 | 4 |  |
| windmill | 4 | 36 | 4 | 8 | west meadow (windmill) |
