# 조수 v2 — JRPG 가 아닌 게임의 장치: 재고 · 셋째 묶음 · 고리 설계 (2026-11-11)

오너 2026-11-11: 「이제 필요한 도구들을 공격적으로 늘려야하는 거 아님? JRPG 만 만들게 아니잖아.」
이 쪽은 **무엇이 비었는지**를 장치(플레이어가 하는 것) 단위로 적는다. 재는 묶음은 `harness-data/assistant-capability/small-jobs-3.json`
(`--set 3`, 36가지 — 문서 `openwiki/harnesses/assistant-capability.md` 「셋째 묶음」). 도구를 늘리는 PR 은 이 표의 줄을 지우고, 그 줄의 일로 전/후를 잰다.

## 출발점 (모델 없음, main `7c5f3b7b62`)

- 편집기 도구 레지스트리 527개(`allTools`) 가운데 v2 풀(`request/toolGroups.ts v2ToolPool`)은 134개, 영어 사본(`tools/toolTextEn.ts`)은 132개.
- 청사진의 단계 종류는 다섯(`src/project/gameBlueprint.ts STEP_KINDS` — talk · find · battle · puzzle · choice)이고 경로 빌더(`story/blueprintPath.ts`)는
  단계를 한 줄 사슬(pickup · code · clue · ending)로 짓는다. 엔딩은 하나다.
- 장르를 아는 곳은 요청 낱말 넷(`request/genre.ts` — 공포 · 퍼즐 · 연애 · 몬스터)이다. 낱말을 늘리지 않는다(리팩토링 규칙 1) — 아래 「고리 설계」가 대안이다.
- 셋째 묶음 36건을 v2 에 넣어 본 값(`classifyRequest` + `exposeV2Tools`, 하네스 픽스처 그대로):

| | 값 |
|---|---|
| 손 정답이 부르는 도구가 모두 처음부터 실린 일 | 8 / 36 |
| 일부는 나중에(`load_tools` · 이름 호출) 닿는 일 | 14 |
| **v2 어디에도 없는 도구가 든 일** | **14** |
| 작은 일(`edit`)로 갈린 일 | 33 — 나머지 셋은 `life-petals-starter`(「…게임으로 만들어 줘」 → 게임 하나, 도구 58개 · 14.5만 자) · `farm-plot-starter`(「밭을 … 만들어 줘」 → 장소 짓기, 26개) · `action-slimes-starter`(「…맵으로 만들고」 → 장소 짓기, 50개) |

  닿지 않는 도구 열넷: `set_deadline_ending` `place_trap` `create_farm_plot` `define_crop` `upsert_fish_species` `configure_fishing` `place_storage_chest`
  `configure_monster_system` `give_starter_monsters` `place_trainer` `lock_door` `set_action_combat` `make_action_enemy` `set_dialogue_system` `manage_flag_slot`(열다섯 이름, 일 열넷).

## 빈틈의 네 갈래

| 표지 | 뜻 | 고치는 자리 |
|---|---|---|
| **U** | 도구는 있는데 v2 에 내놓지 않았다 | `toolGroups.ts` 풀 + `topics.ts` 주제 줄 + `toolTextEn.ts` 영어 글 |
| **W** | 내놓았지만(또는 내놓아도) 계약이 싼 모델에게 넓거나 깨지기 쉽다 — 큰 스키마 · 두 걸음 · 앞선 호출이 없으면 거절 · 한국어 거절 글 | 도구 자신(리팩토링 규칙 3) + `toolTextEn.ts` 의 `hide` |
| **N** | 런타임은 하는데 그 일을 하는 도구가 없다 — 이벤트 명령 JSON 을 손으로 써야 한다 | 새 도구(좁은 것) |
| **R** | 런타임에 없다 | 엔진 — 이 줄기의 PR 에서 짓지 않는다. 가장 작은 변경만 적는다 |

## 재고 — 장치마다

「v2」 칸: 처음 = 작은 일에 처음부터 실린다 · 나중 = `load_tools`/이름 호출로 닿는다 · 없음 = 풀에 없다. 「일」 칸은 셋째 묶음의 id 와 판정 종류(없으면 —).
런타임 파일은 그 장치를 실제로 돌리는 곳이다.

### 추리 · 추론

| 장치 | 런타임 | 편집기 도구 | v2 | 일 · 판정 | 빈틈 |
|---|---|---|---|---|---|
| 가진 물건 가운데 골라 **내민다**(증거 제시) | `presentItem` — `src/player/playScenePresentItem.ts` | 좁은 도구 없음(이벤트 명령) · 사건 통째는 `author_mystery_case` | `patch_event_page` 처음 — 명령 모양은 게임 카드 `gates` 한 줄뿐 | `evidence-present-starter` · `presentReacts` | **N** |
| 범인 지목 → 맞으면 엔딩, 틀리면 말 | 선택지 + `triggerEnding` — `src/player/interpreter/commandCatalog.ts` | `define_ending`(25,330자) + 이벤트 명령 | `define_ending` 나중 | `accuse-ending-starter` · `choiceEndings` | — |
| 단서를 **다 모아야** 열리는 말 | 조건 `all`/`item` — `src/project/session.ts evalCondition` | `upsert_item` + `add_event_page` | 처음 | `clues-all-gate-starter` · `itemsGatedText` | — |
| 사건 통째(용의자 · 알리바이 · 거짓말 반박 · 지목) | 위와 같다 | `author_mystery_case`(44,386자) · `check_mystery_case` | 없음 — 청사진 경로에서만 `story/mysteryCase.ts` 가 스스로 세운다 | — (게임 하나) | **U · W** |

### 연애 · 읽는 게임 · 여러 엔딩

| 장치 | 런타임 | 편집기 도구 | v2 | 일 · 판정 | 빈틈 |
|---|---|---|---|---|---|
| 말을 걸 때마다 **호감이 쌓이고** 문턱에서 말이 바뀐다 | `changeFriendship` · `friendshipAtLeast`(`session.ts`), 또는 변수 | 좁은 도구 없음 — `make_villager`(52,510자, `dialogue.when`)는 없음 | 이벤트 명령. 호감 키는 이벤트의 `characterId` 나 적은 `npcKey` 라야 한다(없으면 조용히 0) | `affection-grows-starter` · `affection-two-pages-built` · `affectionLine` | **N** |
| **선물**(건네면 하나 줄고 호감이 오른다) | `presentItem.consume` · `system.giftSystem` | `configure_game_systems`(선물 시스템) | 없음 | `gift-affection-starter` · `giftReacts` | **N · U** |
| 호감이 차야 되는 **고백 → 엔딩** | 엔딩 조건 `friendshipAtLeast` | `define_ending` | 나중 | `confess-ending-starter` · `affectionEnding` | — (호감 쌓기는 위 N) |
| **N일 기한** 엔딩 | `timeSystem.onDayEnd` — `src/player/playSceneTime.ts` | `set_deadline_ending` | 없음 | `deadline-ending-starter` · `deadlineEnding` | **U · W**(시간 시스템이 꺼져 있으면 거절한다 — 스스로 켜야 한다) |
| 연애 기본값(호감 하트 HUD · 관계 메뉴 · 하루 루프) | `system.socialLoop` | `apply_romance_preset` | 없음 — 게임 하나 요청의 낱말(`ROMANCE_SETUP_WORDS`)이 맞을 때만 `genreDefaults.ts` 가 깐다 | — | **U** |
| 선택으로 갈리는 **여러 엔딩** | `triggerEnding` | `define_ending` | 나중 | `two-endings-starter` · `choiceEndings` | — |
| 쌓인 깃발(누구와 얘기했나)로 갈리는 엔딩 | 조건 `all`/`switch`/`variable` | 이벤트 명령 | 처음 | `ending-by-talks-starter` · `flagsEnding` | — |
| 대사 기록(백로그) · 오토 · 스킵 | `src/project/dialogueSystem.ts` | `set_dialogue_system` | 없음 | `backlog-on-built` · `projectField` | **U** |
| 갤러리 · 엔딩 목록 | `system.gallery` | `set_vn_extras` | 없음 | — | **U** |
| 주간 일정 고르기(planSchedule · runSchedule) | `interpreter/commandCatalog.ts` | `upsert_schedule` · `list_schedules` | 없음 | — | **U** |
| 대사창 스킨 · 초상 | `set_vn_look` | `set_vn_look` | 나중 | — | — |

### 공포 — 숨기 · 추격 · 함정 · 체력

| 장치 | 런타임 | 편집기 도구 | v2 | 일 · 판정 | 빈틈 |
|---|---|---|---|---|---|
| **쫓아오는 것**, 닿으면 게임 오버 | `src/player/horrorRuntime.ts` · `src/project/chaseBrain.ts` | `make_chase_scene`(26,513자 — `onTouch` 하위 스키마 19,506자) | 나중 | `chaser-starter` · `chaser` | **W**(큰 하위 스키마를 `hide` 해야 한다) |
| 무엇을 한 **뒤에 깨어나는** 추격자 | 페이지 조건(스위치) | `make_chase_scene.activateSwitch` | 나중 | `chase-after-key-starter` · `chaser`(`armedBy`) | **W** |
| **숨는 곳**(옷장 · 통) | `interaction.kind:"hiding"` — `src/player/nearbyActionTarget.ts` | `configure_object_behavior`(있는 이벤트 + `pageId` 가 있어야 한다) · `make_chase_scene.hidingSpots` | 나중 | `hiding-spot-starter` · `hidingSpot` | **W**(두 걸음: 물건 이벤트를 만들고 그 `pageId` 로 다시 부른다) · 그림 없음(야외 칩셋에 옷장 — `[art-gap]`) |
| 밟으면 죽는 **함정** + 그 맵 입구에서 다시 | `killPlayer` · `checkpointSave` — `src/player/checkpoints.ts` | `place_trap` | 없음(`make_horror_loop` 은 나중) | `trap-checkpoint-starter` · `deathTrap` | **U** |
| 전투 없는 **체력**(꽃잎) | 변수 + HUD — `src/player/fieldHud.ts` | `set_life_flower` | 나중 | `life-petals-starter` · `lifeGauge` | — (요청이 게임 하나로 갈린다) |
| 시야에 들키면(집주인 · 경비) | 조건 `eventSeesPlayer` — `src/player/npcPerception.ts` | `place_search_containers` · `set_field_detection` · `set_field_approach_style` | 첫째만 나중, 나머지 없음 | — | **U** |

### 농장 · 생활

| 장치 | 런타임 | 편집기 도구 | v2 | 일 · 판정 | 빈틈 |
|---|---|---|---|---|---|
| **밭**(괭이로 가는 칸) | `map.farmableArea` — `src/player/farming.ts` | `create_farm_plot` | 없음 | `farm-plot-starter` · `farmPlot` | **U**(요청이 장소 짓기로 갈린다) |
| **작물**(씨앗 → N일 → 수확) | `database.crops` | `define_crop` | 없음 | `crop-turnip-starter` · `cropDefined` | **U · W**(`seasons` 를 안 주면 새 작물을 거절한다 — 기본은 사계절이어야 한다) |
| **낚시** | `system.fishing` — `src/player/lifeFieldInteraction.ts` | `upsert_fish_species` · `configure_fishing` | 없음 | `fishing-built` · `fishingSpot` | **U**(세 호출: 아이템 → 어종 → 낚시터) |
| **제작법 + 제작대** | `craftRecipe` · `openCraftShop` — `interpreter/commandCatalog.ts` | `upsert_craft_recipe` · 제작 창을 여는 사람은 이벤트 명령 | 제작법 나중 | `craft-station-starter` · `craftStation` | **N**(제작 창을 여는 것을 놓는 도구 없음) |
| 시간 · 달력 | `src/player/playSceneTime.ts` | `configure_time_system` | 나중 | (아래 일들) | — |
| NPC **시간표**(밤에는 저기 가 있다) | `event.schedule` — `src/player/playSceneMapRuntime.ts` | `set_npc_schedule` | 나중 | `npc-night-schedule-starter` · `npcSchedule` | — |
| **시간대마다 다른 말** | 페이지 조건 `timePhase` | `add_event_page` | 처음 | `night-line-starter` · `timePhaseLine` | **W** — 영어 조건 글(`toolTextEn.ts COND`)이 `timePhase` · `friendshipAtLeast` · `gold` · `timer` 를 말하지 않는다 |
| **자면 다음 날** | `inn.advanceToMorning` · `sleepUntilMorning` | 이벤트 명령 | 처음 | `sleep-next-day-starter` · `sleepNextDay` | **N** |
| **보관 상자**(넣고 꺼낸다) | `openChest` | `place_storage_chest` | 없음 | `storage-chest-starter` · `storageChest` | **U** |
| 괭이 · 물뿌리개 규칙 · 가축 · 건물 · 집 장식 | `system.toolActions` · `farmAnimalBuildings` … | `upsert_tool_action` · `upsert_farm_animal_building` · `upsert_farm_building_type` · `set_session_farm_state` · `upsert_home_decoration_type` | 없음 | — | **U** |
| 기력 · 출하 · 꾸러미 · 가공 설비 | `system.energy` · `shipping` · `bundles` · `makers` — `src/player/dayTransition.ts` | `configure_life_economy` | 없음 | — | **U**(출하 상자를 맵에 놓는 명령은 찾지 못했다 — 정산만 있다) |
| 계절 채집 · 박물관 · 수집 도감 · 생활 스킬 | `seasonalForage` · `museum` · `collections` | `configure_seasonal_forage` · `configure_museum` · `configure_collections` · `upsert_life_skill` | 없음 | — | **U** |

### 몬스터 수집

| 장치 | 런타임 | 편집기 도구 | v2 | 일 · 판정 | 빈틈 |
|---|---|---|---|---|---|
| **포획** 켜기 | `system.monsterCollection` | `configure_monster_system` | 없음 | `capture-on-blank` · `projectField` | **U · W**(켜면 장르 잠금과 배우 73명의 그림이 같이 바뀐다 — 결과 글이 그것을 알려야 한다) |
| **첫 몬스터 고르기**(셋 중 하나, 한 번) | `giveMonster` | `give_starter_monsters` | 없음 | `starter-pick-blank` · `starterPick` | **U** |
| **눈이 마주치면** 다가와 싸우는 트레이너 | `detectionEncounter` — `src/player/npcDetectionEncounter.ts` | `place_trainer` | 없음 | `trainer-sight-blank` · `sightBattle` | **U** |
| 종 · 진화 · 상성 | `database.monsterSpecies` · `typeChart` | `define_monster_species`(5,183자) · `set_type_chart` | 없음 | — | **U** |
| 회복 센터 · 보관함 · 배지 문지기 · 풀숲 길 | `badgeCount` 조건 등 | `place_monster_center` · `place_monster_pc` · `place_badge_gate` · `author_wild_route` | 없음 | — | **U** |
| 필드 기술 장애물(바위깨기 · 서핑) | `partyKnowsSkill` | `place_field_obstacle` | 나중 — 영어 사본 없음 | — | **W** |
| 캠페인 통째 | — | `build_monster_game` | 도구로는 없음(게임 하나 경로가 스스로 부른다) | — | — |

### 퍼즐 · 탈출

| 장치 | 런타임 | 편집기 도구 | v2 | 일 · 판정 | 빈틈 |
|---|---|---|---|---|---|
| **암호 자물쇠** | `inputNumber` · 선택지 | `compile_puzzle kind:"password"`(21,525자) | 나중 | `password-safe-starter` · `passwordLock` | **W** — 지은 이벤트가 투명하다(그 칸에 물건 타일이 있어야 보인다), 숫자 선택지의 **맞는 숫자가 언제나 첫 칸**이다(첫 칸만 누르면 열린다 — 2026-11-11 실측), 스키마가 크다 |
| **밀 수 있는 것** | `interaction.kind:"pushable"` — `src/player/playSceneMovement.ts` | `configure_object_behavior` | 나중 | `push-rock-starter` · `pushable` | **W**(은신처와 같은 두 걸음) |
| **잠긴 문**(조건이 맞아야 지나간다) | 페이지 조건 | `lock_door` | 없음 | `lock-door-key-built` · `lockedTransfer` | **U** |
| **제한 시간** | `timer` 명령 · 조건 | `make_timed_escape`(무너지는 바닥 `area` 가 없으면 거절) | 없음 | `time-limit-starter` · `timeLimit` | **N**(「N초 안에 못 하면 게임 오버」만 하는 도구 없음) · **U** |
| 퍼즐 프리셋 20종 · 승강기 · 시간의 문 | — | `author_map_puzzle` · `list_puzzle_presets` · `place_lift` · `create_time_gate` | 없음 | — | **U** |

### 액션 전투

| 장치 | 런타임 | 편집기 도구 | v2 | 일 · 판정 | 빈틈 |
|---|---|---|---|---|---|
| 그 맵은 **실시간 전투** | `system.actionCombat` · `map.actionCombat` — `src/player/actionHud.ts` | `set_action_combat` | 없음 | `action-map-starter` · `actionMap` | **U** |
| **덤벼드는 적**(스폰) | `map.fieldSpawns` · `enemy.actionProfile` | `make_action_enemy`(3,947자) · `make_hunting_ground` | 없음 | `action-slimes-starter` · `actionSpawn` | **U · W**(부대의 첫 적이 그 적이어야 한다 — 틀리면 거절, 한국어 글) |
| 액션 전투를 실제로 돌려 보기 | 브라우저 | `run_action_combat_test` | 없음 | — | **U** |

### 상점 · 경제

| 장치 | 런타임 | 편집기 도구 | v2 | 일 · 판정 | 빈틈 |
|---|---|---|---|---|---|
| **판매가** | `system.sellPrices` | `set_sell_prices` | 나중 | `sell-price-built` · `sellPrice` | — |
| **통행료**(돈이 있으면 내고, 한 번만) | 조건 `gold` · `changeGold` | 이벤트 명령 | 처음 | `toll-gate-starter` · `paidGate` | — |
| 물건마다 **재고 한정** | `ShopStockEntry` 에 수량 칸이 없다 | — | — | — | **R** — 가장 작은 변경: `ShopStockEntry.quantity?` + 세션의 남은 수량 표(`session.shopStock[eventId][itemId]`) |
| 플레이어가 **가게를 운영**(손님이 와서 산다) | 없음 | — | — | — | **R** — 손님 NPC 스폰 + 진열대 판매 판정이 필요하다(작지 않다) |
| 상점 표현 · 업그레이드 | `shop.economy` · `system.itemUpgrades` | `configure_shop_presentation` · `upsert_item_upgrade` | 없음 | — | **U** |

### 생존 · 수치

| 장치 | 런타임 | 편집기 도구 | v2 | 일 · 판정 | 빈틈 |
|---|---|---|---|---|---|
| 화면의 **수치 게이지**(배고픔) | `fieldHud.widgets`(변수) — `src/player/fieldHud.ts` | `set_project_settings.fieldHud.widgets`(도구 19,707자) + 시작 값 `manage_flag_slot` | 앞 도구 나중 · 뒤 도구 없음(`set_session_start` 는 변수를 못 적는다) | `hunger-hud-starter` · `hudGauge` | **W · U** |
| 시간이 지나면 **수치가 준다** | 병렬 이벤트 + `wait` 로만 | — | — | — | **N** |
| **먹으면 수치가 찬다**(아이템 사용 → 변수) | 아이템은 HP · MP · 상태만 바꾼다. `type:"switch"` 아이템 + 병렬 공통 이벤트로 돌아가야 한다 | — | — | — | **R** — 가장 작은 변경: `ItemRecord.commonEventId?`(쓰면 그 공통 이벤트를 부른다, `src/player/playerItemUse.ts`) |

### 갈래별 합계

장치 56줄 가운데 **U 29 · W 13 · N 7 · R 3**(한 줄에 둘이 겹치면 둘 다 센다 · 빈틈 없음 12줄).
셋째 묶음의 일 36가지 가운데 빈틈이 있는 줄을 재는 것이 27가지, 지금도 닿는 길을 재는 것이 9가지다.

## 다음 PR 에서 고칠 것(차례)

1. **내놓기(U)** — 좁고 작은 것부터 풀과 주제 줄에: `place_trap` · `lock_door` · `place_storage_chest` · `create_farm_plot` · `define_crop` · `upsert_fish_species` · `configure_fishing` ·
   `set_deadline_ending` · `set_dialogue_system` · `set_action_combat` · `make_action_enemy` · `configure_monster_system` · `give_starter_monsters` · `place_trainer` · `manage_flag_slot`
   (모두 3,947자 이하 — 처음 싣는 상한 34,000자 안에서 주제가 맞을 때만 싣고 나머지는 `load_tools`). 영어 글은 `toolTextEn.ts` 에.
2. **계약(W)** — `set_deadline_ending` 이 시간 시스템을 스스로 켠다 · `define_crop` 의 `seasons` 기본 사계절 · `make_chase_scene` 의 `onTouch`/`caughtPenalty` 를 `hide` ·
   `compile_puzzle` 암호의 숫자 차례 섞기와 그 칸의 물건 그림 · `configure_object_behavior` 가 `pageId` 없이 지금 페이지를 고친다 · 영어 조건 글에 `timePhase` `friendshipAtLeast` `gold` `timer`.
3. **새 도구(N)** — 원시 명령을 손으로 쓰던 것을 좁은 도구 넷으로: 호감(말 걸기 · 선물 · 문턱 대사) · 증거 내밀기 반응 · 제한 시간 · 물건 하나를 은신처/밀 수 있는 것/제작대/침대로 놓기.
4. **분류** — 「…게임으로 만들어 줘」(장치 하나) · 「밭을 만들어 줘」 · 「…맵으로 만들고」 가 작은 일로 가게(요청 줄기와 맞춘다 — `request/` 는 그 줄기 것이다).

## 고리 설계 — 청사진이 한 줄 경로가 아닌 게임을 말하는 법 (제안 · 구현 전)

지금 청사진은 「시작 → 엔딩」 한 줄이다: 단계마다 앞 단계가 켠 것을 읽고, 엔딩은 하나, 되풀이하는 행동도 쌓이는 값도 없다.
연애(호감을 쌓는다) · 수집(N개를 모은다) · 생존(쫓기며 버틴다) · 농장(기르고 판다) · 추리(모아서 지목한다)는 **고리**가 있는 게임이다.
장르 낱말을 늘리는 대신 **모델이 청사진에 고리를 적고**, 경로 빌더가 그 고리를 이벤트로 짓고, 걷기 검사가 그 고리를 돌려 본다.

**청사진에 더하는 칸 셋**(`src/project/gameBlueprint.ts` — 모두 선택 칸, 옛 청사진은 그대로 읽힌다):

```ts
interface GameBlueprint {
  // … 지금 칸 …
  /** 쌓이거나 줄어드는 값 — 호감 · 모은 수 · 꽃잎 · 번 돈. 이름은 플레이어가 읽는 말. */
  meters?: { id: string; name: string; start: number; show?: "hud" | "menu" | "none" }[];
  /** 고리 — 등뼈(steps)의 두 단계 사이에 걸린다: after 가 끝나면 열리고, 목표에 닿으면 opens 단계가 열린다. */
  loops?: GameBlueprintLoop[];
  /** 엔딩 여럿 — 위에서부터 처음 맞는 것. 마지막은 조건 없는 기본. 없으면 지금의 ending 하나. */
  endings?: { name: string; how: string; when?: { meter: string; atLeast: number } | { choice: string } }[];
}
interface GameBlueprintLoop {
  id: string;                                    // l1, l2 …
  kind: "raise" | "collect" | "survive" | "grow" | "deduce";
  after?: string;                                // 이 단계 뒤에 시작(없으면 처음부터)
  opens?: string;                                // 목표에 닿으면 열리는 단계(그 단계의 needs 가 된다)
  meter?: string;                                // 이 고리가 움직이는 값
  goal?: number;                                 // 목표 값(기본 3)
  place: string; who?: string;                   // 어디서 · 누구와
  // 종류마다 한두 칸만 더 — 아래 표
}
```

**종류마다 — 모델이 적는 것 · 빌더가 짓는 것 · 걷기 검사가 보는 것:**

| kind | 모델이 더 적는 칸 | 빌더가 짓는 것(있는 함수 · 도구) | 검사(모델 없음) |
|---|---|---|---|
| `raise` — 관계를 쌓는다 | `who` · `ways: ("talk" \| "gift")[]` · `gift?`(아이템 이름) · 문턱 대사 `lines` | 그 사람 이벤트에 말 걸기 +1 · 선물 +2(하나 줄어든다) · 문턱 페이지. 값은 호감도(`changeFriendship`, `characterId` 를 단다) · 표시(`show`)는 HUD/관계 메뉴 | `goal` 번 말을 걸면 `opens` 가 열리고 그 전에는 잠긴 말(`affectionLine` · `affectionEnding` · `giftReacts` 와 같은 따라가기) |
| `collect` — N개를 모은다 | `thing`(이름) · `count` · `places: string[]`(흩어 둘 장소) | 장소마다 한 번만 주는 줍기(`place_chest look:"item"` · 조사 지점) + 모은 수 변수 + HUD 「n/N」. 그림이 없으면 `[art-gap]` | 시작에서 걸어서 N개에 모두 닿고(잠긴 단계를 지나지 않고), N개째에 `opens` 가 열리며 N−1개로는 안 열린다(`itemsGatedText` · `flagsEnding`) |
| `survive` — 쫓기며 · 시간 안에 · 체력이 남아 있게 | `threat: "chaser" \| "timer" \| "hazard"` · `seconds?` · `life?`(meter) · `safe?: ("hide" \| "checkpoint")[]` | `after` 단계가 켠 스위치로 깨어나는 추격자(`make_chase_scene.activateSwitch`) · 은신처 · 들어설 때 체크포인트 · 타이머 시작/시간 초과 · 체력 값(`set_life_flower`) — `opens` 단계가 위협을 끈다 | `after` 전에는 위협이 없다 · 뒤에는 닿으면/0초면/0장이면 끝난다 · `opens` 뒤에는 꺼진다 · 체크포인트 · 은신처에 닿는다(`chaser armedBy` · `timeLimit` · `lifeGauge` · `deathTrap`) |
| `grow` — 기르고 판다 | `product`(작물·물고기·제작물 이름) · `days` · `sellTo`(상점 사람) · `goal`(번 돈) | 시간 시스템 · 밭+작물+씨앗 상점(또는 낚시터 · 제작법) · 판매가 · 번 돈 값 | 시작 돈으로 씨앗을 살 수 있다 · `days` ≤ 기한 · 판매가 × 거둘 수 있는 수 ≥ `goal` · `goal` 에서 `opens` 가 열린다(`cropDefined` · `farmPlot` · `sellPrice` + 셈) |
| `deduce` — 모아서 지목한다 | `suspects: string[]` · `culprit` · `clues: {name, place, points: string}[]` · `accuse`(누구 앞에서) | 단서 줍기 · 용의자마다 증거 내밀기 반응 · 지목 선택지(맞으면 `opens` 또는 엔딩, 틀리면 말·나쁜 엔딩) — 지금의 `story/mysteryCase.ts` 가 이 선언을 받아 짓는다 | `check_mystery_case` 의 특정 가능성 + 지목을 길마다 따라가기(`presentReacts` · `choiceEndings`) |

**기한**은 고리가 아니라 청사진의 한 칸이다: `clock?: { days: number; onEnd: string }`(`onEnd` = endings 의 이름) → 시간 시스템 + `set_deadline_ending`. 검사는 `deadlineEnding`.

**왜 이 모양인가.**

- **등뼈는 그대로다.** 고리는 두 단계 사이에 걸리고 고리의 목표가 다음 단계의 `needs` 다 — 그래서 지금의 사슬 깊이 · 닿기 · 잠김 글 검사가 그대로 돈다. 걷기 검사(`walkBlueprint`)는 잠긴 단계에서 「그 고리를 `goal` 번 돈다」 한 걸음만 더한다.
- **장르 낱말이 필요 없다.** 「연애 게임」을 낱말로 알지 않는다 — 청사진에 `raise` 고리가 있으면 관계 메뉴와 호감 표시를 깔고, `survive` 가 있으면 공포 HUD · 어둠을, `grow` 가 있으면 시계를 깐다.
  `genreDefaults.ts` 의 `ROMANCE_SETUP_WORDS` · `request/genre.ts` 의 공포 · 퍼즐 · 몬스터 낱말은 고리 종류를 읽는 것으로 하나씩 바꿀 수 있다.
- **싼 모델의 몫은 작다.** 고리 하나에 칸 여섯 안팎, 고르는 값은 enum, 숫자는 기본값이 있다. 대사는 지금처럼 `build_blueprint_path` 의 단계 글로 따로 준다.
- **엔딩 여럿**은 `endings[]` 의 `when` 으로 — 빌더가 엔딩마다 정의하고 마지막 단계의 이벤트가 위에서부터 조건을 보아 부른다. 선택으로 갈리는 엔딩은 지금의 `choice` 단계가 `{choice}` 로 가리킨다.

**넣는 차례(승인되면).** ① 칸 · 읽기 · 걷기 검사 뼈대 + `collect`(지금의 줍기 고리를 그대로 쓴다) → ② `raise` + `endings[]` → ③ `survive` → ④ `deduce`(`mysteryCase.ts` 의 낱말 추정을 선언 읽기로) → ⑤ `grow` + `clock`.
걸음마다 셋째 묶음의 그 가족으로 작은 일 전/후를 재고, `genre-seed.json` 의 그 장르 한 판을 Terra 로 돌린다.

**위험.** 청사진이 길어진다(쓰는 글자 상한을 종류별 칸 수로 묶는다) · 엔딩이 여럿이면 «엔딩 하나»를 가정한 끝맺음 검사(`judge/storyFlowChecks` · `shipChecks`)를 같이 고쳐야 한다 ·
`grow` 는 밭 · 호수 같은 장소 종류와 그림이 세계마다 있어야 한다(없으면 `[art-gap]`) · `survive` 의 은신처는 칩셋에 숨을 가구가 있을 때만 보인다.
