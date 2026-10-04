# 성벽 시장 — 3/4 감사 (view34_check.py + 눈)

검사기 사본: `view34_check.py`. 눈이 최종.

| 조각 | 검사기(전 → 후) | 눈 | 조치 |
|---|---|---|---|
| forge_yard | NOTOP → OK | 합격: 모루 윗면 4줄(밝음) + 앞 몸통, 통 둘은 윗면 타원 대신 윗판 띠 + 앞 널판 | 모루 윗면을 4줄 평평한 밝은 띠로, 석탄 색 올림 |
| sack_pile | FRONT → OK | 합격: 자루 주둥이 타원(윗면) + 앞 주름 | 자루마다 윗면 타원 추가 |
| trough | TOPDOWN → OK | 합격: 물 윗면 4줄 + 앞 널판 11줄 + 쇠테 + 짧은 다리 | 윗면 테두리 줄이고 앞면을 한 단 어둡게 |
| banner_red / banner_teal | TOPDOWN → TOPDOWN(거짓) | 합격(눈): 얇은 기둥 + 매단 천. 기둥 끝 금 마개, 아래에 돌 받침(윗면 2줄 + 앞면 2줄) 추가 | 돌 받침 추가. 검사기는 얇은 기둥을 못 잰다(EXEMPT 대상) |
| cloth_stall | OK | 합격: 차양 윗면 + 앞 진열대 | 변경 없음 |
| hay_bales | OK | 합격: 윗면 금빛 + 앞 짚결 | 변경 없음 |
| hitching_rail | OK | 합격: 가로대 윗줄 + 앞 + 기둥 윗면 | 변경 없음 |
| toll_booth | OK | 합격: 붉은 기와집(기둥 건물 아님), 지붕 윗면 + 앞 벽 | 변경 없음 |
| wagon | OK | 합격: 덮개 윗면 + 짐칸 옆 + 바퀴 | 변경 없음 |

검사기 위반: 전 5건(forge_yard, sack_pile, trough, banner×2) → 후 2건(banner×2, 얇은 기둥 거짓 경보, 눈 합격).
눈 위반: 전 4건(forge_yard, sack_pile, trough, 깃발 받침 없음) → 후 0건.
맵 검증: 도달 통과, 빈 바닥 창 최대 5%, 빈 덩이 ≤4칸.
