# 역할 매핑 — v9 최종3 한 장짜리 → 17 역할

> `kit/roles.json` 이 정본이다. 이 문서는 `kit/tools/make_role_mapping_doc.py` 가 roles.json · fantasy 매니페스트 · fantasy-5act 템플릿에서 쓴다.

## 세어 둔 숫자

- 아이콘 **38종** (v9 최종2 는 39종이었으나 최종3 에서 `crater_lake`(분화구 호수)를 장소와 시트에서 뺐다 — 그 자리는 연못 지형).
- 장소 **31곳** = 아이콘 장소 30 + 천공섬 1 (`journey_plan_v9` 의 PLACES 31곳과 같다). 지시서의 「30곳」은 천공섬을 뺀 숫자다.
- 역할 **17개**. fantasy 세트는 17개 역할을 모두 채운다. 칸 수가 역할과 다른 아이콘(`fits:false`): **1종** — `castle_dark_grand`(5x5, 역할 capital 는 6x6).
  이 아이콘은 지도에 쓰이지 않았다(장소가 `city_capital` 6x6 을 쓴다). 빌더는 역할의 칸 수와 같은 아이콘만 후보로 삼는다.

## 역할 표 (칸 수 · fantasy 세트의 채움 · 이 역할을 쓰는 장소)

| 역할 id | 칸 | 이름 | fantasy 아이콘(맞는 것) | 장소(fantasy-5act) |
|---|---|---|---|---|
| `capital` | 6x6 | 수도 | `city_capital`, `castle_dark_grand(fits:false)` | 대성 |
| `fort_city` | 4x4 | 성곽 도시 | `city_fort` | 사바나 마을 |
| `harbor_city` | 5x4 | 항구 도시 | `city_harbor` | 내해 항구 |
| `castle` | 3x3 | 성·요새 | `castle_dark`, `pass_fortress`, `flame_fortress` | 고갯길 요새, 화염 요새 |
| `large_town` | 3x3 | 큰 마을 | `town_bell`, `town_red`, `town_snow`, `windmill_farm`, `harbor_town`, `log_village` | 강가 마을, 설원 마을, 동쪽 항구 |
| `village` | 2x2 | 촌락 | `village_wood`, `village_snow`, `igloo_camp`, `mine_town`, `monastery`, `adobe_village`, `treehouse_village`, `stilt_village` | 눈 촌락, 고원 마을, 사막 촌락, 정글 마을, 북동 눈 촌락, 남섬 마을 |
| `camp` | 2x2 | 야영지 | `tent_camp`, `oasis_camp` | 오아시스 촌락, 북섬 촌락 |
| `tower_small` | 1x2 | 작은 탑 | `lighthouse`, `witch_tower`, `mage_spire` | 해협 감시탑, 독늪 탑, 섬 탑 |
| `tower_great` | 2x4 | 거대한 탑 | `giant_tower` | 거대한 탑 |
| `cave` | 2x2 | 동굴 | `cave_rock`, `cave_vine` | 산기슭 동굴, 섬 동굴 |
| `ruin` | 2x2 | 폐허 | `desert_colonnade`, `stepped_pyramid`, `crypt` | 사막 폐허, 협곡 폐허, 섬 폐허 |
| `ruin_city` | 4x3 | 폐허 도시 | `ruined_city` | 폐허 도시 |
| `shrine` | 3x3 | 신전 | `desert_temple` | 사막 신전 |
| `landmark_nature` | 3x3 | 자연 랜드마크 | `giant_tree` | 거목 |
| `circle` | 2x2 | 돌원 | `stone_circle` | 고대 돌원 |
| `volcano` | 2x2 | 화산 | `volcano_altar` | 화산 |
| `floating` | 5x4 | 떠 있는 땅 | `sky_island` | 천공섬 |

## 아이콘 → 역할 (38종 전부)

| 아이콘 | 칸 | 역할 | fits | 출처 묶음 |
|---|---|---|---|---|
| `castle_dark` | 3x3 | `castle` | true | 원래 v9 그림 유지 |
| `castle_dark_grand` | 5x5 | `capital` | **false** (6x6 필요) | 원래 v9 그림 유지 |
| `town_bell` | 3x3 | `large_town` | true | 마을·야영 3/4 |
| `town_red` | 3x3 | `large_town` | true | 마을·야영 3/4 |
| `town_snow` | 3x3 | `large_town` | true | 마을·야영 3/4 |
| `village_wood` | 2x2 | `village` | true | 마을·야영 3/4 |
| `village_snow` | 2x2 | `village` | true | 마을·야영 3/4 |
| `city_capital` | 6x6 | `capital` | true | 원래 v9 그림 유지 |
| `city_fort` | 4x4 | `fort_city` | true | 원래 v9 그림 유지 |
| `city_harbor` | 5x4 | `harbor_city` | true | 원래 v9 그림 유지 |
| `sky_island` | 5x4 | `floating` | true | 원래 v9 그림 유지 |
| `giant_tower` | 2x4 | `tower_great` | true | 탑 손 도트 |
| `ruined_city` | 4x3 | `ruin_city` | true | 원래 v9 그림 유지 |
| `giant_tree` | 3x3 | `landmark_nature` | true | 원래 v9 그림 유지 |
| `desert_temple` | 3x3 | `shrine` | true | 유적(fix34_ruins/icons) |
| `stone_circle` | 2x2 | `circle` | true | 원래 v9 그림 유지 |
| `lighthouse` | 1x2 | `tower_small` | true | 탑 손 도트 |
| `witch_tower` | 1x2 | `tower_small` | true | 탑 손 도트 |
| `mage_spire` | 1x2 | `tower_small` | true | 탑 손 도트 |
| `cave_rock` | 2x2 | `cave` | true | 동굴 2x2 |
| `cave_vine` | 2x2 | `cave` | true | 동굴 2x2 |
| `igloo_camp` | 2x2 | `village` | true | 마을·야영 3/4 |
| `mine_town` | 2x2 | `village` | true | 마을·야영 3/4 |
| `tent_camp` | 2x2 | `camp` | true | 마을·야영 3/4 |
| `monastery` | 2x2 | `village` | true | 수도원 2차 |
| `adobe_village` | 2x2 | `village` | true | 마을·야영 3/4 |
| `treehouse_village` | 2x2 | `village` | true | 마을·야영 3/4 |
| `oasis_camp` | 2x2 | `camp` | true | 마을·야영 3/4 |
| `stilt_village` | 2x2 | `village` | true | 마을·야영 3/4 |
| `windmill_farm` | 3x3 | `large_town` | true | 마을·야영 3/4 |
| `harbor_town` | 3x3 | `large_town` | true | 마을·야영 3/4 |
| `log_village` | 3x3 | `large_town` | true | 마을·야영 3/4 |
| `pass_fortress` | 3x3 | `castle` | true | 원래 v9 그림 유지 |
| `flame_fortress` | 3x3 | `castle` | true | 화염 요새 투영본 |
| `desert_colonnade` | 2x2 | `ruin` | true | 유적(fix34_ruins/icons) |
| `stepped_pyramid` | 2x2 | `ruin` | true | 유적(fix34_ruins/icons) |
| `crypt` | 2x2 | `ruin` | true | 유적(fix34_ruins/icons) |
| `volcano_altar` | 2x2 | `volcano` | true | 유적(fix34_ruins/icons) |

## 장소 → 역할 → fantasy 가 고른 아이콘

`pins` 는 fantasy 세트가 원래 한 장짜리에서 손으로 고른 배정을 그대로 고정한 것이다(그래서 화소 동일). pins 가 없는 세트는 같은 역할의 맞는 변형 중 `crc32(장소 id) % 변형 수` 로 결정한다.

| 장소 id | 역할 | 막 | 아이콘(pins) |
|---|---|---|---|
| 대성 | `capital` | 1막 | `city_capital` |
| 강가 마을 | `large_town` | 1막 | `windmill_farm` |
| 내해 항구 | `harbor_city` | 1막 | `city_harbor` |
| 설원 마을 | `large_town` | 1막 | `log_village` |
| 눈 촌락 | `village` | 1막 | `igloo_camp` |
| 고원 마을 | `village` | 1막 | `monastery` |
| 산기슭 동굴 | `cave` | 1막 | `cave_rock` |
| 사막 촌락 | `village` | 1막 | `adobe_village` |
| 사막 폐허 | `ruin` | 4막 | `desert_colonnade` |
| 정글 마을 | `village` | 2막 | `treehouse_village` |
| 고갯길 요새 | `castle` | 1막 | `pass_fortress` |
| 해협 감시탑 | `tower_small` | 4막 | `mage_spire` |
| 화산 | `volcano` | 3막 | `volcano_altar` |
| 화염 요새 | `castle` | 3막 | `flame_fortress` |
| 사바나 마을 | `fort_city` | 3막 | `city_fort` |
| 오아시스 촌락 | `camp` | 3막 | `oasis_camp` |
| 협곡 폐허 | `ruin` | 3막 | `stepped_pyramid` |
| 북동 눈 촌락 | `village` | 3막 | `mine_town` |
| 동쪽 항구 | `large_town` | 3막 | `harbor_town` |
| 독늪 탑 | `tower_small` | 3막 | `witch_tower` |
| 섬 동굴 | `cave` | 3막 | `cave_vine` |
| 섬 탑 | `tower_small` | 3막 | `lighthouse` |
| 남섬 마을 | `village` | 3막 | `stilt_village` |
| 섬 폐허 | `ruin` | 3막 | `crypt` |
| 북섬 촌락 | `camp` | 3막 | `tent_camp` |
| 거대한 탑 | `tower_great` | 2막 | `giant_tower` |
| 폐허 도시 | `ruin_city` | 3막 | `ruined_city` |
| 거목 | `landmark_nature` | 1막 | `giant_tree` |
| 사막 신전 | `shrine` | 4막 | `desert_temple` |
| 고대 돌원 | `circle` | 2막 | `stone_circle` |
| 천공섬 | `floating` | 5막 | `sky_island` |

