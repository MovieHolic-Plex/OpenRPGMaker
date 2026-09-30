# 수로 (aqueduct-sewer) — 3/4 점검표

규칙: 바닥은 위에서 본 면, 물체는 윗면 T + 앞면 F 이며 옆면은 그리지 않는다. 빛은 위 왼쪽.

## 종류별 기준

| 종류 | T(윗면) | F(앞면) | 옆면 | 빛 | 해당 조각 |
|---|---|---|---|---|---|
| 벽 앞면(face_*) | 없음 (벽 윗면은 천장 띠) | 32px 2~3칸 전체, 쌓은 돌 줄눈·벽감 | 없음 | 위 왼쪽 | face_* |
| 천장·벽 윗면 띠 | 띠 8px + 굳은 경계선 1줄 | 벽 앞면과 접함, 밑에 1~2px 그림자 | 없음 | 위 왼쪽 | ceiling* |
| 바닥·물·무늬 | 위에서 본 면(의도) | - | - | - | floor_*, water_*, mosaic_*, grate_floor |
| 벽 부착물 | 납작 (벽에 붙음) | - | - | 위 왼쪽 | arch_*, torch_wall, banner_cult, chains, niche_*, vines_*, door_wood, secret_door |
| 기둥·원통 | 타원 윗면(머리) | 원통 몸통 + 받침 | 오른쪽 1px 명암만 | 위 왼쪽 | column_*, pipe_*, valve_wheel, dock_post, barrel |
| 상자·관·제단·탁자 | 밝은 윗면 4~8행 | 윗면보다 한 단 어두운 앞면 | 없음 | 위 왼쪽 | crate*, coffin, sarcophagus, altar_*, anvil_table, rack_32, straw_bed |
| 작은 소품 | 윗면 1~3행 + 앞면 | 앞면 | 없음 | 위 왼쪽 | bucket, brazier, candles, lantern_post, skulls, rubble*, bone_heap, driftwood |
| 걸이·단독 | 윗면 또는 고리 | 앞면 | 없음 | 위 왼쪽 | cage_hanging, iron_maiden, boat, stalagmite, rock_pillar |

## 체커(view34_check.py) 수치

- 조각 45개. 벽 부착물·바닥 무늬(면제) 21개.
- 면제 제외 24개 중 체커가 OK 아닌 것: 이전 11개 → 이후 9개.
- 눈 판정 위반: 이전 11개(다시 그림) → 이후 0개.
- 이후에도 체커가 OK 아닌 조각은 눈으로 확인한 오탐이다: 초·가로등 같은 가늘고 긴 물체, 돌림 무늬가 있는 앞면, 불규칙한 잔해는 행 중앙값 밝기 띠로 윗면을 못 찾는다. altar_cult 는 윗면 8행이 분명한데 체커가 NOTOP(T=0)으로 본다. 초가 윗면 위로 솟아 띠를 깨기 때문이다.

## 조각별 표

| 조각 | 체커 이전 | 체커 이후 | T/F 이후 | 눈 판정 | 조치 |
|---|---|---|---|---|---|
| altar_cult | NOTOP | TOPDOWN | 15/13 | OK | 다시 그림 |
| arch_bars | NOTOP | NOTOP | 0/32 | 면제(벽 부착물/바닥 무늬) | 면·대비 조정 |
| arch_dark | TOPDOWN | TOPDOWN | 16/15 | 면제(벽 부착물/바닥 무늬) | 면·대비 조정 |
| arch_water | TOPDOWN | TOPDOWN | 16/15 | 면제(벽 부착물/바닥 무늬) | 면·대비 조정 |
| banner_cult | NOTOP | NOTOP | 0/30 | 면제(벽 부착물/바닥 무늬) | 그대로 |
| barrel | OK | OK | 3/12 | OK | 그대로 |
| bone_heap | OK | OK | 7/8 | OK | 그대로 |
| bones | NOTOP | NOTOP | 0/6 | 면제(벽 부착물/바닥 무늬) | 그대로 |
| brazier | OK | OK | 4/10 | OK | 다시 그림 |
| bridge_ew_stone | OK | OK | 3/11 | OK | 그대로 |
| bridge_ns_stone | TOPDOWN | TOPDOWN | 14/2 | OK | 그대로 |
| bucket | NOTOP | OK | 6/7 | OK | 다시 그림 |
| candles | TOPDOWN | TOPDOWN | 8/7 | OK | 다시 그림 |
| ceiling | TOPDOWN | TOPDOWN | 37/10 | 면제(벽 부착물/바닥 무늬) | 면·대비 조정 |
| chains | NOTOP | NOTOP | 0/14 | 면제(벽 부착물/바닥 무늬) | 그대로 |
| coffin | TOPDOWN | TOPDOWN | 10/10 | OK | 그대로 |
| column_sewer | NOTOP | OK | 5/27 | OK | 다시 그림 |
| column_sewer_broken | NOTOP | FRONT | 2/13 | OK | 다시 그림 |
| crate | OK | OK | 4/10 | OK | 그대로 |
| crate_stack | OK | OK | 4/18 | OK | 그대로 |
| face_cata_2h | NOTOP | NOTOP | 0/32 | 면제(벽 부착물/바닥 무늬) | 면·대비 조정 |
| face_cata_3h | NOTOP | NOTOP | 0/48 | 면제(벽 부착물/바닥 무늬) | 면·대비 조정 |
| face_sewer_1h | NOTOP | NOTOP | 0/16 | 면제(벽 부착물/바닥 무늬) | 그대로 |
| face_sewer_2h | NOTOP | NOTOP | 0/32 | 면제(벽 부착물/바닥 무늬) | 면·대비 조정 |
| face_sewer_3h | OK | OK | 22/25 | 면제(벽 부착물/바닥 무늬) | 면·대비 조정 |
| fallen_column | OK | OK | 4/7 | OK | 그대로 |
| floor_bone | OK | OK | 14/17 | 면제(벽 부착물/바닥 무늬) | 면·대비 조정 |
| floor_cata | NOTOP | NOTOP | 0/32 | 면제(벽 부착물/바닥 무늬) | 면·대비 조정 |
| floor_darkcata | NOTOP | NOTOP | 0/32 | 면제(벽 부착물/바닥 무늬) | 면·대비 조정 |
| floor_plank | OK | OK | 6/25 | 면제(벽 부착물/바닥 무늬) | 면·대비 조정 |
| floor_sewer | NOTOP | NOTOP | 0/32 | 면제(벽 부착물/바닥 무늬) | 그대로 |
| grate_floor | NOTOP | NOTOP | 0/12 | 면제(벽 부착물/바닥 무늬) | 그대로 |
| lantern_post | OK | TOPDOWN | 22/4 | OK | 다시 그림 |
| manifold_3 | OK | OK | 7/23 | OK | 그대로 |
| pipe_copper | TOPDOWN | TOPDOWN | 4/4 | OK | 그대로 |
| pipe_copper_elbow | OK | OK | 4/8 | OK | 그대로 |
| pipe_copper_leak | OK | OK | 4/8 | OK | 그대로 |
| rubble | NOTOP | FRONT | 1/8 | OK | 다시 그림 |
| secret_door | OK | OK | 13/15 | 면제(벽 부착물/바닥 무늬) | 그대로 |
| skulls | NOTOP | OK | 3/7 | OK | 다시 그림 |
| stairs_up_face | OK | OK | 14/17 | OK | 그대로 |
| straw_bed | OK | OK | 3/10 | OK | 다시 그림 |
| torch_wall | FRONT | FRONT | 2/11 | 면제(벽 부착물/바닥 무늬) | 그대로 |
| valve_wheel | FRONT | NOTOP | 0/26 | OK | 다시 그림 |
| water_sew | NOTOP | NOTOP | 0/32 | 면제(벽 부착물/바닥 무늬) | 그대로 |
