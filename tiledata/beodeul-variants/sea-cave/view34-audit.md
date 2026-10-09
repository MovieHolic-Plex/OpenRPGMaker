# 해식 동굴 (sea-cave) — 3/4 점검표

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

- 조각 27개. 벽 부착물·바닥 무늬(면제) 17개.
- 면제 제외 10개 중 체커가 OK 아닌 것: 이전 7개 → 이후 5개.
- 눈 판정 위반: 이전 5개(다시 그림) → 이후 0개.
- 이후에도 체커가 OK 아닌 조각은 눈으로 확인한 오탐이다: 초·가로등 같은 가늘고 긴 물체, 돌림 무늬가 있는 앞면, 불규칙한 잔해는 행 중앙값 밝기 띠로 윗면을 못 찾는다. 

## 조각별 표

| 조각 | 체커 이전 | 체커 이후 | T/F 이후 | 눈 판정 | 조치 |
|---|---|---|---|---|---|
| arch_dark | TOPDOWN | TOPDOWN | 16/15 | 면제(벽 부착물/바닥 무늬) | 면·대비 조정 |
| barrel | OK | OK | 3/12 | OK | 그대로 |
| boat | TOPDOWN | TOPDOWN | 10/6 | OK | 그대로 |
| bones | NOTOP | NOTOP | 0/6 | 면제(벽 부착물/바닥 무늬) | 그대로 |
| bucket | NOTOP | OK | 6/7 | OK | 다시 그림 |
| ceiling_cave | NOTOP | NOTOP | 0/48 | 면제(벽 부착물/바닥 무늬) | 면·대비 조정 |
| chains | NOTOP | NOTOP | 0/14 | 면제(벽 부착물/바닥 무늬) | 그대로 |
| crate | OK | OK | 4/10 | OK | 그대로 |
| dock_post | FRONT | OK | 7/13 | OK | 다시 그림 |
| driftwood | TOPDOWN | OK | 5/6 | OK | 다시 그림 |
| face_cave_2h | TOPDOWN | TOPDOWN | 28/3 | 면제(벽 부착물/바닥 무늬) | 면·대비 조정 |
| face_cave_3h | TOPDOWN | TOPDOWN | 44/3 | 면제(벽 부착물/바닥 무늬) | 면·대비 조정 |
| fish_net | TOPDOWN | TOPDOWN | 7/5 | 면제(벽 부착물/바닥 무늬) | 그대로 |
| floor_cave | TOPDOWN | TOPDOWN | 31/0 | 면제(벽 부착물/바닥 무늬) | 면·대비 조정 |
| floor_plank | OK | OK | 6/25 | 면제(벽 부착물/바닥 무늬) | 면·대비 조정 |
| floor_sand | OK | OK | 15/16 | 면제(벽 부착물/바닥 무늬) | 그대로 |
| floor_wetsand | TOPDOWN | TOPDOWN | 31/0 | 면제(벽 부착물/바닥 무늬) | 그대로 |
| glow_moss_floor | NOTOP | NOTOP | 0/16 | 면제(벽 부착물/바닥 무늬) | 그대로 |
| glow_mushroom | NOTOP | NOTOP | 0/11 | 면제(벽 부착물/바닥 무늬) | 그대로 |
| lantern_post | OK | TOPDOWN | 22/4 | OK | 다시 그림 |
| rock_pillar_2 | TOPDOWN | TOPDOWN | 17/14 | OK | 그대로 |
| rubble_cave | NOTOP | FRONT | 1/8 | OK | 다시 그림 |
| stalagmite_1 | NOTOP | NOTOP | 0/22 | OK | 그대로 |
| torch_wall | FRONT | FRONT | 2/11 | 면제(벽 부착물/바닥 무늬) | 그대로 |
| vines_2 | NOTOP | NOTOP | 0/27 | 면제(벽 부착물/바닥 무늬) | 그대로 |
| water_sea | NOTOP | NOTOP | 0/32 | 면제(벽 부착물/바닥 무늬) | 그대로 |
| water_tide | NOTOP | NOTOP | 0/32 | 면제(벽 부착물/바닥 무늬) | 그대로 |
