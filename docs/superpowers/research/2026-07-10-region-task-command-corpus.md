# 영역 지정 AI 작업 — 자연어 명령어 코퍼스 (50개)

- 작성일: 2026-07-10
- 목적: 실제 RPG 제작자가 "영역 지정 AI 작업" 팝오버/모달에 입력할 법한 한국어 명령을 폭넓게 시뮬레이션하고,
  현재 에디터 능력(도구셋) 기준으로 각 명령의 실현 가능성을 추정한다.
- 조사 대상: `src/editor/panels/regionTaskModal.ts`, `src/editor/selectionActionChips.ts`,
  `src/editor/regionTask/runRegionTask.ts` (특히 `buildRegionTaskMessage`의 도구 가이드),
  `src/editor/tools/**/*.ts` (도구 카탈로그 전수), `docs/superpowers/specs/2026-07-06-region-ai-task-design.md`.

## 요약

### 카테고리별 개수 (7분류, 총 50개)

| 분류 | 개수 |
|---|---|
| (1) 순수 타일 편집 | 7 |
| (2) 지형 구조물 | 8 |
| (3) 이벤트/NPC | 8 |
| (4) 복합 | 8 |
| (5) 스타일/다듬기 | 7 |
| (6) 편집/변형 | 6 |
| (7) 게임플레이 로직 | 6 |

### Feasibility 분포

| 판정 | 개수 | 비율 |
|---|---|---|
| 가능 | 28 | 56% |
| 부분 가능 | 19 | 38% |
| 불가 | 3 | 6% |

목표(현재 능력으로 뚜렷이 되는 것 ~60% / 도전적인 것 ~40%)에 근접 — "가능" 56%, "부분 가능 + 불가" 44%.

### 발견한 에디터 능력 (도구 카탈로그 요약)

영역 작업은 `AssistantSession` 위에서 도는 범용 툴콜 에이전트라, 아래 도구들을 조합해 한 턴에 여러 단계를 수행할 수 있다
(`runRegionTask`가 제안 결과를 `clipMapCellsToRegion`으로 사각형 하드-클립 후 스냅샷 1개로 적용).

- **지형/타일**: `paint_tiles`, `fill_region`(rect/circle/ellipse shape 지원 — 호수 등 원형에 필수), `clear_region`/`tile_erase`, `paint_road`/`lay_path`(오토타일 성형 도로), `tile_paint`/`tile_road`/`tile_scatter`/`tile_structure`(v2 경로)
- **구조물**: `build_house_kit`/`build_house`, `stamp_structure`, `build_wall`, `build_roof`, `place_door`, `place_window`, `build_castle`, `build_village`, `build_house_lots`, `create_farm_plot`, `make_hunting_ground`
- **소품 산포**: `place_props`, `scatter_object`
- **NPC/이벤트**: `place_npc`, `make_villager`, `set_npc_schedule`, `set_shop_stock`, `upsert_event`, `move_event`, `duplicate_event`, `remove_event`, `create_transfer_pair`(문/텔레포트 쌍), `place_battle_blocker`, `place_trap`, `make_chase_scene`, `script_cutscene`, `place_examine_hotspots`, `compile_puzzle`
- **퀘스트/스토리**: `create_quest`, `create_quest_flags`, `define_quest`, `verify_quest`, `generate_walkthrough`, `declare_story_flag`, `find_flag_usage`
- **전투/DB**: `simulate_battle`, `tune_enemy`, `set_encounter_table`, `upsert_item`, `upsert_enemy`, `upsert_troop`, `give_starter_monsters`
- **분위기**: `set_lighting_volume`, `set_scene_mood`
- **UI 프리셋(선택 칩)**: "🏠 구조물"(자유 구조물 배치 지시), "🎨 다듬기"(주변과 자연스럽게 이어붙이기) — 이미 즉시 실행 프리셋으로 존재

발견하지 못한 것(코퍼스에서 "불가"/"부분 가능"의 근거): 전용 **다리(bridge) 스탬프**, **좌우/상하 대칭(mirror) 변환 도구**, **간격 반복(repeat-pattern) 스탬프**, **전용 보물상자(treasure chest) 프리셋**, **세이브 포인트 이벤트 프리셋**이 도구 카탈로그에 없다. 이런 요청은 AI가 기존 도구(place_props, upsert_event, script_cutscene 등)를 즉흥 조합해 흉내내야 하며, 결과 품질이 보장되지 않는다.

### 가장 흔한 needs (빈도 상위)

1. `prop-scatter` (place_props 계열) — 다양한 장식/소품/자연물 산포
2. `npc-place` — NPC/주민 배치
3. `structure-template` — 집/성/여관 등 구조물 배치
4. `tile-paint` — 지형/바닥 채우기
5. `multi-step` — 여러 도구를 순서대로 조합하는 복합 지시 (카테고리 4 전부 + 일부 3/7)

### "불가" 판정의 공통 원인

세 건(다리, 좌우대칭, 세이브포인트) 모두 **해당 개념을 위한 전용 도구/어휘(vocab group)가 카탈로그에 없다**는 동일한 원인이다.
AI가 임기응변으로 기존 도구를 조합해 흉내낼 수는 있지만, `runRegionTask`의 배치 후 검증(`validateLayoutPlacement`)이나
결과 일관성을 보장할 전용 경로가 없어 "안 됨"으로 분류했다. "부분 가능"의 다수도 같은 계열 문제 — 도구는 있으나
(예: 잠금 문 = `place_door` + 별도 스위치 로직 수작업 조합) 결과 신뢰도가 지시 하나로 보장되지 않는 경우다.

---

## 50개 명령어 전체

| id | command | category | needs | feasibility |
|---|---|---|---|---|
| grass-fill-basic | 이 영역을 잔디로 채워줘 | 순수 타일 편집 | tile-paint | 가능 — fill_region으로 잔디 그룹 rect 채우기 |
| sand-beach-fill | 이 구역 바닥을 전부 모래사장으로 바꿔줘 | 순수 타일 편집 | tile-paint | 가능 — fill_region 모래 그룹 |
| round-pond | 여기 웅덩이를 둥근 호수로 만들어줘 | 순수 타일 편집 | tile-paint | 가능 — fill_region shape=circle + 물 그룹(가이드에 명시된 패턴) |
| dungeon-stone-floor | 돌바닥 던전 통로로 깔아줘 | 순수 타일 편집 | tile-paint | 가능 — fill_region 돌바닥 그룹 |
| split-grass-dirt | 이 영역 절반은 잔디, 절반은 흙길로 나눠줘 | 순수 타일 편집 | tile-paint, multi-step | 부분 가능 — fill_region 두 번 조합 가능하나 경계선 자연스러움은 AI 판단에 의존 |
| snow-cover | 여기 타일을 전부 눈밭으로 덮어줘 | 순수 타일 편집 | tile-paint | 부분 가능 — 타일셋에 눈 그룹이 있어야만 성립(현재 타일셋 보유 여부 불확실) |
| icy-floor | 바닥에 얼음 타일 깔아서 미끄러운 구간 만들어줘 | 순수 타일 편집 | tile-paint, passability | 부분 가능 — 시각 타일 교체는 가능하나 "미끄러움" 게임플레이 물리는 별도 시스템 부재 |
| small-cottage | 이 영역에 작은 오두막 한 채 지어줘 | 지형 구조물 | structure-template | 가능 — build_house_kit |
| walled-courtyard | 여기에 성벽으로 둘러싼 안뜰을 만들어줘 | 지형 구조물 | structure-template, wall-fence | 가능 — build_wall + fill_region 내부 바닥 |
| plaza-fountain-benches | 마을 광장에 분수대 놓고 주변에 벤치 배치해줘 | 지형 구조물 | prop-scatter | 부분 가능 — 벤치는 소품 그룹에 있으나 "분수대" 전용 소품 존재 여부 불확실 |
| river-bridge | 이 영역을 가로지르는 다리 놓아줘 (강 건너) | 지형 구조물 | structure-template | 불가 — 전용 다리 스탬프/어휘 그룹이 카탈로그에 없음 |
| curvy-forest-path | 숲길을 자연스러운 곡선으로 내줘 | 지형 구조물 | road | 가능 — lay_path/paint_road에 좌표열(points) 지정 |
| pasture-fence | 이 구역에 울타리를 둘러서 목장을 만들어줘 | 지형 구조물 | wall-fence, structure-template | 가능 — fence 그룹 존재(role 검색에 fence 포함) |
| castle-garden | 성 안뜰에 정원(화단+나무)을 조성해줘 | 지형 구조물 | prop-scatter | 가능 — place_props 화단/나무 그룹 |
| ruined-tower | 폐허가 된 탑 하나 세워줘 | 지형 구조물 | structure-template | 부분 가능 — stamp_structure/build_house_kit에 "폐허" 스타일 프리셋 존재 여부 불확실 |
| merchant-npc | 이 자리에 잡화점 상인 NPC 하나 배치해줘 | 이벤트/NPC | npc-place, shop | 가능 — place_npc + set_shop_stock |
| gate-guards | 여기 성문 앞에 경비병 두 명 세워줘 | 이벤트/NPC | npc-place | 가능 — place_npc ×2 |
| villager-patrol | 마을 사람들이 광장을 왔다갔다 순찰하게 해줘 | 이벤트/NPC | npc-place, npc-schedule | 가능 — set_npc_schedule |
| hidden-treasure-chest | 이 방에 보물상자를 하나 숨겨줘 | 이벤트/NPC | event-logic, item-give | 부분 가능 — 전용 "보물상자" 프리셋 없음, upsert_event/place_examine_hotspots로 즉흥 구현 |
| locked-door-key | 이 문을 열쇠가 있어야 열리는 잠긴 문으로 만들어줘 | 이벤트/NPC | event-logic, story-flag | 부분 가능 — place_door는 시각 배치뿐, 잠금 조건은 story flag/script_cutscene 수작업 조합 필요 |
| map-exit-teleport | 영역 끝에 있는 문을 다음 맵으로 이어지는 텔레포트로 만들어줘 | 이벤트/NPC | teleport | 가능 — create_transfer_pair |
| bridge-bandit | 이 다리 밑에 숨어있는 도적 NPC를 배치해줘 | 이벤트/NPC | npc-place | 가능 — place_npc (다리 자체는 기존 지형 전제) |
| monster-chase | 이 구역을 지나가면 몬스터가 쫓아오는 추격전을 만들어줘 | 이벤트/NPC | chase-scene | 가능 — make_chase_scene |
| blacksmith-full | 이 영역에 대장간을 짓고 대장장이 NPC와 무기 재고를 채워줘 | 복합 | structure-template, npc-place, shop, multi-step | 가능 — build_house_kit + place_npc + set_shop_stock/upsert_item |
| haunted-house | 폐가를 짓고 안에 유령 이벤트를 넣어서 조사하면 놀라는 연출 만들어줘 | 복합 | structure-template, event-logic, cutscene-script, multi-step | 부분 가능 — 구조물은 가능하나 "놀라는 연출"의 구체적 품질은 script_cutscene 자유도에 의존, 검증 어려움 |
| inn-with-guests | 이 공터에 여관을 짓고 손님 NPC 몇 명과 주인을 배치해줘 | 복합 | structure-template, npc-place, multi-step | 가능 — build_house_kit + place_npc ×N |
| shrine-altar-quest | 이 사당 구역에 제단을 놓고 조사하면 퀘스트가 시작되게 해줘 | 복합 | prop-scatter, event-logic, quest-logic, multi-step | 부분 가능 — place_props + place_examine_hotspots + create_quest 조합, 트리거 연결의 견고함은 미검증 |
| dungeon-room-trio | 이 던전 방에 함정과 보물상자, 그리고 지키는 몬스터를 배치해줘 | 복합 | trap, item-give, battle-encounter, multi-step | 부분 가능 — place_trap/place_battle_blocker는 있으나 보물상자 프리셋 부재로 전체 완성도 낮음 |
| farm-scene | 농장 구역을 만들어서 밭과 허수아비, 농부 아저씨를 배치해줘 | 복합 | structure-template, prop-scatter, npc-place, multi-step | 가능 — create_farm_plot + place_props(허수아비) + place_npc |
| festival-plaza | 이 광장에 축제 분위기 내게 등불이랑 좌판, 상인들 배치해줘 | 복합 | lighting-mood, prop-scatter, npc-place, multi-step | 가능 — set_lighting_volume + place_props + place_npc |
| beach-stall | 해변에 파라솔과 오두막 매점 짓고 상인 배치해줘 | 복합 | prop-scatter, structure-template, npc-place, multi-step | 가능 — place_props(파라솔) + build_house_kit + place_npc |
| blend-with-surroundings | 이 영역 지형을 주변이랑 자연스럽게 이어지도록 다듬어줘 | 스타일/다듬기 | tile-paint | 가능 — 선택 칩 "🎨 다듬기" 프리셋으로 이미 즉시 실행 지원 |
| make-village-old | 이 마을을 좀 더 낡고 오래된 느낌으로 바꿔줘 | 스타일/다듬기 | tile-paint, prop-scatter | 부분 가능 — "낡음" 표현이 타일셋 보유 자산(균열/이끼 텍스처)에 의존, 결과 일관성 낮을 수 있음 |
| lavish-castle-interior | 이 성 내부를 화려하고 고급스럽게 꾸며줘 | 스타일/다듬기 | prop-scatter, tile-paint | 부분 가능 — 추상적 지시라 place_props 조합에 크게 의존, 결과 편차 큼 |
| natural-flower-scatter | 여기 잔디밭에 꽃이랑 잡초를 자연스럽게 흩뿌려줘 | 스타일/다듬기 | prop-scatter | 가능 — place_props 자연 산포(밀도 파라미터) |
| desolate-ruins | 이 폐허 구역을 더 황폐하고 을씨년스럽게 만들어줘 | 스타일/다듬기 | tile-paint, prop-scatter | 부분 가능 — 추상적 분위기 지시, 결과 검증 기준 모호 |
| mossy-wall-overlay | 이 던전 벽을 이끼 낀 느낌으로 오버레이 해줘 | 스타일/다듬기 | tile-paint | 부분 가능 — set_group_overlay 기능은 있으나 이끼 오버레이 그룹 보유 여부 불확실 |
| dark-room-mood | 이 방을 어둡고 음산한 조명으로 바꿔줘 | 스타일/다듬기 | lighting-mood | 가능 — set_scene_mood |
| clear-to-empty | 이 영역을 싹 다 지워서 빈 땅으로 만들어줘 | 편집/변형 | clear-region | 가능 — clear_region/tile_erase |
| mirror-symmetry | 이 영역 타일을 좌우 대칭으로 만들어줘 | 편집/변형 | mirror-symmetry | 불가 — 대칭 변환 전용 도구가 카탈로그에 없음 |
| repeat-tree-pattern | 이 나무 배치를 영역 전체에 일정한 간격으로 반복시켜줘 | 편집/변형 | repeat-pattern, prop-scatter | 부분 가능 — 전용 격자 반복 스탬프는 없으나 place_props 밀도 파라미터로 근사 가능 |
| move-npc-corner | 여기 있는 NPC를 영역 반대쪽 구석으로 옮겨줘 | 편집/변형 | move-event | 가능 — move_event |
| duplicate-house | 이 집을 하나 더 복제해서 옆에 놓아줘 | 편집/변형 | duplicate-event, structure-template | 부분 가능 — duplicate_event는 이벤트 단위 복제, 건물 통짜 복제 전용 도구는 불확실 |
| widen-corridor | 이 영역의 좁은 통로를 넓혀줘 | 편집/변형 | tile-paint | 부분 가능 — 통로 폭 조정 전용 도구 없음, AI가 벽 제거+바닥 채우기로 근사해야 함 |
| slime-encounter-zone | 이 영역에 들어서면 슬라임이 나오는 인카운터 구역으로 설정해줘 | 게임플레이 로직 | battle-encounter | 가능 — set_encounter_table/make_hunting_ground |
| chest-potion-reward | 여기 상자를 열면 포션 아이템을 주는 이벤트 만들어줘 | 게임플레이 로직 | item-give, event-logic | 부분 가능 — upsert_item은 있으나 "상자 열기→아이템 지급" 전용 프리셋 부재 |
| shrine-first-quest | 이 사당을 조사하면 첫 번째 퀘스트가 시작되도록 만들어줘 | 게임플레이 로직 | quest-logic, event-logic | 가능 — place_examine_hotspots + create_quest/define_quest |
| switch-gated-bridge | 이 다리를 건너기 전에 스위치를 눌러야 열리게 해줘 | 게임플레이 로직 | event-logic, story-flag | 부분 가능 — declare_story_flag + script_cutscene 수작업 조합 필요, 검증 도구 없음 |
| auto-save-point | 이 구역을 지나가면 자동으로 세이브 포인트가 되게 해줘 | 게임플레이 로직 | event-logic | 불가 — 세이브 포인트 전용 이벤트 프리셋이 카탈로그에 없음 |
| well-legend-dialogue | 이 마을 우물을 조사하면 마을 전설 이야기를 들려주는 이벤트 만들어줘 | 게임플레이 로직 | event-logic, cutscene-script | 가능 — upsert_event + script_cutscene(대사) |
