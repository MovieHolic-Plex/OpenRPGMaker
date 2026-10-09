## 보정 기록 (2026-10-08, 손으로 덧붙인 절 — `--md` 로 다시 쓰면 지워지니 다시 붙일 것)

최악 순위에서 다른 에이전트가 고치는 중인 ice-age-field·desert-castle·sky-city 를 빼고 위 5개를 고쳤다.
윤곽은 모두 공용 깊이장 `tiledata/beodeul-kits/autotile_edge.py`(정원 연못 윤곽), 재질·화가는 장소 것 그대로. 같은 이름 파일을 덮어썼다.

| 장소 | 오토타일 | bad 전 → 후 | conv 전 → 후 | 보정 스크립트 | 전/후 시험 그림 |
|---|---|---|---|---|---|
| mountain-fortress | chasm | 1.000 → 0.143 | 32 → 0 | `mf_fix_chasm.py` (불투명 네모 → 투명 윤곽, 맞은편 바위벽·턱·볼) | `mountain-fortress-chasm-before/after.png` |
| tower-interior | pit | 1.000 → 0.147 | 32 → 0 | `ti_fix_pit.py` (불투명 네모 → 투명 윤곽, 안벽·바닥 턱·가시) | `tower-interior-pit-before/after.png` |
| time-rift | riftstone | 0.675 → 0.297 | 2 → 0 | `tr_fix_riftstone.py` (3x3 창 마스크 교체, 두께·뿌리 칸 안에서 끝남) | `time-rift-riftstone-before/after.png` |
| rain-ruin-town | puddle | 0.634 → 0.168 | 0 → 0 | `rr_fix_puddle.py` (같은 웅덩이 셰이더, 윤곽만 교체) | `rain-ruin-town-puddle-before/after.png` |
| prehistoric-village | lavapool | 0.631 → 0.163 | 0 → 0 | `pv_fix_lavapool.py` (같은 vf_lava 화가, 윤곽만 교체) | `prehistoric-village-lavapool-before/after.png` |

다음 보정 후보(게이트 FAIL, 제외 3곳 빼고): wasteland-world crack·claypan, graveyard-crypt mist, final-tower voidbreak, ice-cave frozenlake,
opera-stage spotlight-pool, rock-cave pool, future-ruins rust, airship deck-puddle.
