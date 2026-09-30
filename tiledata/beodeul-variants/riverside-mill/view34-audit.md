# 강가 물레방아 마을 — 3/4 감사 (view34_check.py + 눈)

검사기 사본: `view34_check.py`. 눈이 최종. 파일 이름은 그대로(덮어씀).

| 조각 | 검사기(전 → 후) | 눈 | 조치 |
|---|---|---|---|
| waterwheel | OK → OK | 전: 불합격(정면 원). 후: 합격 | 뒤 테를 4px 위로 민 초승달 = 바퀴 두께의 윗면. 앞 원은 그대로 아래 |
| flour_cart | FRONT → OK | 합격: 짐칸 윗테 + 자루 윗면 5줄 + 앞 널판 | 자루 윗면 5줄 밝게, 앞 한 단 어둡게, 짐칸 윗테 3줄 추가 |
| sluice_gate | NOTOP → OK | 합격: 가로보 윗면 5줄(밝음) + 앞 3줄 | 가로보를 윗면+앞면 두 면으로 |
| scarecrow | FRONT → FRONT(거짓) | 합격: 기둥 인물. 전엔 받침 없음 → 돌 받침(윗면 4줄 + 앞 2줄) 추가 | 받침 추가. 얇은 기둥이라 검사기가 못 잰다 |
| laundry_line | TOPDOWN → NOTOP(거짓) | 합격: 기둥 머리 + 돌 받침(윗면 4줄 + 앞 2줄). 천은 줄에 걸린 앞면이 본래 모양 | 기둥마다 받침 추가 |
| plank_footbridge | OK | 합격: 난간 + 널 바닥 윗면 + 앞면 + 다리발 | 변경 없음 |
| millstones | OK | 합격: 누운 맷돌 윗면 + 옆 | 변경 없음 |
| haystack | OK | 합격: 원뿔 짚가리, 윗 장대 | 변경 없음 |
| wheat_stooks_a / b | OK | 합격: 단 묶음(자연물) | 변경 없음 |

검사기 위반: 전 4건(flour_cart, laundry_line, scarecrow, sluice_gate) → 후 2건(scarecrow, laundry_line: 얇은 기둥 거짓 경보, 눈 합격).
눈 위반: 전 5건(waterwheel, flour_cart, sluice_gate, scarecrow 받침 없음, laundry_line 받침 없음) → 후 0건.
맵 검증: 도달 통과, 빈 바닥 창 최대 10%, 빈 덩이 ≤4칸.
