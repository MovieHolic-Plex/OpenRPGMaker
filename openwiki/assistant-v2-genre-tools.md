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

## Terra 기준선 — 수리 전의 셋째 묶음 (실모델, main `03a604e917`, 2026-11-11)

`~/z-project/assistant-fable-runs/smalljobs/set3-base-03a604e917/` · 쪽 `~/claude-viz/assistant-small-jobs-set3.html`. Terra high · v2 · 일마다 새 픽스처 한 턴 · 상한 10분.

**통과 25/36** · 불합격 10 · 시간 초과 1. 도구 호출 741(오류 52), 중앙값 16호출 · 2.8분 · 입력 385k 토큰. 판정은 저장 문서의 기계 검사다 — 화면은 보지 않았다(화면 미검증).

| 원인 | 건 | 일 | 모델이 한 것 |
|---|---|---|---|
| 그 장치의 도구가 v2 에 없다(**U**) | 8 | `action-map` · `storage-chest` · `crop-turnip` · `fishing` · `deadline-ending` · `trap-checkpoint` · `lock-door-key` · `capture-on-blank` | `load_tools` 로 찾다가 «그 기능을 켜는 도구를 확인할 수 없다»고 보고(2건)하거나 아이템 · 이벤트로 흉내(작물: 아이템만 7번 · 기한: 공통 이벤트 손 조립 · 잠긴 문: 이동 이벤트 손 수정) |
| 장치 요청이 장소 짓기 · 게임 하나로 읽혔다(분류) | 3 | `farm-plot` · `action-slimes` · `life-petals` | 장소 · 게임 도구 27~59개가 실림. 밭은 타일 찍기로 끝 · 슬라임은 놓였지만 맵이 액션 전투가 아님 · 꽃잎 체력은 3번째 호출에 됐는데 게임 하나의 끝맺음을 68호출 돌다 맵 「동쪽 들판」을 지우고 시간 초과 |

**모델 없는 닿기 표가 실모델 결과를 맞혔다**(출발점의 8 · 14 · 14): 손 정답의 도구가 모두 처음부터 실린 8건은 **8 통과** · 일부가 나중(`load_tools`)인 14건은 **13 통과** · 닿지 않는 도구가 있던 14건은 **4 통과**
(첫 몬스터 고르기 · 트레이너 · 대사 기록 · 게이지 — 다른 도구로 돌아갔다). 불합격 10건이 모두 «닿지 않음»에서 나왔다.
통과한 일도 싸지 않다 — 이벤트 명령을 손으로 조립한다: 얘기한 사람 수로 갈리는 엔딩 42호출 · 선물 36 · 고백 32 · 두 엔딩 32 · 열쇠 뒤 추격 28 · 증거 내밀기 27 · 밤 시간표 26 · 제한 시간 25.

실행 사고 둘(쪽의 「판정에 대해 알아 둘 것」): 첫 실행은 실행 중에 같은 체크아웃의 소스를 고쳐 버렸다 — 조수 일꾼은 빌드가 아니라 소스에서 돈다(`set3-contaminated-03a604e917/`, 기준선이 아니다).
`accuse-ending-starter` 첫 시도는 편집기 기동에서 죽어(SQLite «database is locked», 모델 호출 0) 그 일만 한 번 다시 돌렸다.

## 첫 수리 — 내놓기 · 계약 다섯 · 분류 셋 (2026-11-11, 재고 표는 그 전 상태다)

재고 표의 U·W 가운데 작은 것부터 고쳤다. 표의 「v2」 칸은 고치기 전 값이고, 이 절이 지금 값이다.

**모델 없이 본 닿기(셋째 묶음 36건, `classifyRequest` + `exposeV2Tools`, 몬스터 잠금 신호는 실제 세션과 같게):**

| | 전(main `03a604e917`) | 후 |
|---|---|---|
| 손 정답 도구가 처음부터 다 실린 일 | 8 | **27** |
| 일부는 나중에(`load_tools`) | 14 | 8 |
| v2 어디에도 없는 도구가 든 일 | 14 | **1** (`starter-pick-blank` — 아래 「몬스터 잠금」) |
| 작은 일(`edit`)로 갈린 일 | 33 | **36** |
| 처음 싣는 도구 20개를 넘는 일 | 3 (58 · 26 · 50개) | 0 |

나중에 닿는 8건은 큰 도구가 정답인 일이다: `define_ending`(1.2만 자 — 엔딩 넷 · 기한 엔딩의 엔딩 정의) · `set_project_settings`(1.3만 자 — 배고픔 게이지의 `fieldHud.widgets`) ·
`upsert_event`(은신처 · 밀기의 손 풀이 한 갈래 — 그 일의 도구 `configure_object_behavior` 는 처음부터 실린다).
앞 묶음: 첫 묶음 30건 가운데 처음 싣는 도구가 달라진 일 2(자리가 남아 `add_event_page` · `find_empty_ground` 가 더 실렸다), 둘째 묶음 35건 가운데 1(`item-new-built` — 아래). 범위가 달라진 일 0.

**내놓은 도구 열다섯**(`request/toolGroups.ts V2_GENRE_TOOLS` — 풀에만 둔다: 이름 호출 · `load_tools` 로 닿고, 작은 일은 장치 주제가 맞을 때 처음부터):
`place_trap` · `lock_door` · `place_storage_chest` · `create_farm_plot` · `define_crop` · `upsert_fish_species` · `configure_fishing` · `set_deadline_ending` · `set_dialogue_system` ·
`set_action_combat` · `make_action_enemy` · `configure_monster_system` · `give_starter_monsters` · `place_trainer` · `manage_flag_slot`. 영어 글은 `tools/toolTextEn.ts`(한글 없음 — 한 호출의 모양 · 먼저 불러야 하는 것 · 쓰지 말아야 할 때).

**장치 주제**(`request/topics.ts DEVICE_TOPICS` — 그 장치를 짓는 도구가 따로 있는 주제. 장르 이름은 들지 않고 장치 낱말만):
`trap` · `lockDoor` · `storage` · `farm` · `fishing` · `deadline` · `readingAids` · `actionCombat` · `monsters` · `starter` · `trainer` · `codeLock` · `gauge` · `hidePush` · `chase` · `lifePetals` · `craft` · `sellPrice`.
장치 주제의 도구는 사건 쓰기(`upsert_event`, 실린 모양 1.2만 자)보다 먼저 실린다 — 글자 상한(3.4만 자)에서 밀리면 모델은 이벤트 명령으로 손 조립한다. `time` 주제도 도구를 받는다(`configure_time_system` · `set_npc_schedule`).

**큰 하위 스키마 걷기**(`hide` — 도구는 그대로 받는다): `make_chase_scene.onTouch`(9천 자, 죽이지 않는 추격자의 장면) → 실린 모양 1.1만 → 3천 자대 ·
`compile_puzzle.onSolve.beats`(8천 자) → 9.6천 → 2천 자대 · `make_action_enemy` 의 `actionProfile.extraAttacks` · `spawn.graphic` · `upsert_item.item.equipmentProfile`(1.3천 자 — 무기 · 방어구는 `upsert_equipment`).
`compile_puzzle` 의 영어 글은 종류를 틀리게 적고 있었다(「code-lock, push-block and more」 — 실제는 `switch-sequence` · `password` · `item-gate` · `push-switches`). 종류마다 한 호출의 모양으로 다시 썼다.

**`item-new-built`(둘째 묶음, main 에서도 실패하던 닿기)** — `a56e62967a`(비울 수 없는 enum 에 `none`)가 `upsert_event` · `upsert_item` 에 47자씩 더해, 「새 아이템 … 가격은 30G」에서 `upsert_item` 이 상한 3.4만 자를 **40자** 넘겨 밀렸다
(늘 싣는 것 9,884 + `upsert_event` 12,204 + `run_scene_test` 2,991 + `get_database_records` 892 + `upsert_troop` 3,156 = 29,127, 여기에 4,913). 상한은 그대로 두고 `upsert_item` 의 장비 칸을 걷어 3,632자로 — 여유 1,241자.

**계약 다섯**(도구 자신을 고쳤다 — 한 호출로 되고, 거절 대신 스스로 채우고, 알림은 영어):

| 도구 | 전 | 후 |
|---|---|---|
| `define_crop` | `seasons` 가 없으면 새 작물 거절 | 새 작물의 기본은 사계절 |
| `set_deadline_ending` | 시간 시스템이 꺼져 있으면 거절(`time-system-required`) | 기본 시계로 켠다(6시~새벽 2시 · 하루 끝에 저절로 잠든다) + 영어 알림 |
| `make_action_enemy` | 적 → 트룹(`upsert_troop`) → 스폰 → 맵 옵트인(`set_action_combat`) 네 호출. 트룹이 없거나 맵이 옵트인이 아니면 거절 · 주의 글 | `spawn.troopId` 생략 = 그 적 하나짜리 트룹을 만든다 · 그 맵을 액션 전투로 켠다 + 영어 알림. 검사가 다 지난 뒤에만 쓴다 |
| `compile_puzzle` `password` | 0 으로 시작하는 숫자 답은 선택지로 · 선택지의 **맞는 글자가 늘 첫 칸** · 그림 없는 칸이면 말없이 투명 | 숫자 1~6자리는 숫자 입력 · 보기 다섯은 같은 종류의 이어진 글자이고 맞는 자리는 답 · 자리 번호로 정한다 · 그 칸에 물건 타일이 없으면 가까이서 반짝이고 영어 알림 |
| `configure_object_behavior` | `pageId` 필수(읽으러 한 번 더 부른다) | 생략 = 첫 페이지 |

**분류 셋**(낱말 목록을 늘리지 않았다 — 문장의 꼴과 프로젝트 상태로):

- 「…을/를 … **맵으로** 만들고/바꿔」 — 있는 장소가 무엇이 되는지를 말한다. 「맵」은 장소 종류가 아니라 그 장소를 다시 가리킨다(`request/place.ts BECOMES_A_MAP`).
- 「마을 빈 땅**에** 밭을」 — 장소 낱말이 «어디에» 자리에 왔다(`AS_LOCATION`). 지을 것이 장소면(「마을에 집을 지어 줘」) 그 낱말이 따로 맞는다.
  둘 다 **장치 주제가 맞은 요청에만** 쓴다(`intent.ts` — 장치를 짓는 도구가 따로 있을 때만 장소 짓기에서 내린다). 「여관에 침대를 더 추가해 줘」처럼 장소 동사가 맡는 일은 종전대로 장소 짓기다.
- 「… **게임으로** 만들어 줘」 — 게임은 만든 결과다. **지은 것이 있는 프로젝트**에서는 그 게임을 고치라는 말이고(작은 일), 빈 프로젝트에서는 게임 하나다(`scope.ts INTO_A_GAME` + `intent.ts reshape`).
  청사진을 요구하는 관문(`tools/context.ts`)과 세계 고르기(`request/world.ts`)도 프로젝트를 같이 본 판정(`buildsWholeGame`)을 읽는다 — 글만 본 판정을 쓰면 고치기 요청에 청사진을 요구한다.

**몬스터 잠금은 그대로다.** `configure_monster_system` · `give_starter_monsters` · `place_trainer` 는 역방향 장르 잠금(`src/project/genreLockMonsterAssets.ts`)의 몬스터 전용 도구다 —
몬스터 수집 게임이거나 그 요청 턴(`isMonsterRequestTurn`)에만 보인다. 「야생 몬스터를 잡을 수 있게」 · 「트레이너 … 몬스터 배틀」은 그 턴으로 읽혀 도구가 실리고,
「박사 … 몬스터 세 마리 중에 한 마리」(`starter-pick-blank`)는 읽히지 않아 `give_starter_monsters` 가 안 보인다. 잠금의 낱말은 이 줄기에서 고치지 않았다 — 그 일은 `giveMonster` 명령으로 손 조립하거나 되물어야 한다.

## Terra «후» — 첫 수리의 머리에서 다시 잰 셋째 묶음 (`63fc86119c`, 2026-11-12)

깨끗한 떼어 낸 체크아웃에서 Terra high + v2 로 36가지를 다시 돌렸다(`~/z-project/assistant-fable-runs/smalljobs/set3-after-63fc86119c/`, 기반 오류 0 · 시간 초과 0 · 재시도 없음).
이 표는 Terra 끼리만 견준다 — 뒤의 측정은 Haiku 5.5 high 이고 두 모델의 수치를 한 칸에 놓지 않는다.

| | 전 `03a604e917` | 후 `63fc86119c` |
|---|---|---|
| 통과 | 25/36 | **32/36** |
| 호출 합 · 중앙값 | 741 · 16 | 653 · 17 |
| 입력 토큰 | 16.4M | 13.7M |
| 곁 수정이 적힌 일 | 21 | 17 |
| 도구 오류 | 52 | 58 |

- 못 넘던 11건 가운데 **9건이 통과**했다(함정 체크포인트 · 꽃잎 체력 · 밭 · 순무 · 낚시 · 창고 상자 · 잠긴 문 · 액션 맵 · 액션 슬라임). 꽃잎 체력은 시간 초과 68호출 → 16호출.
- **그대로 2건** — 기한 엔딩 · 빈 프로젝트의 포획. **뒷걸음 2건** — 은신처 · 시야 트레이너. 넷 다 «도구가 풀에 없다»의 한 겹 아래다(아래 절).
- 둘 다 통과한 23건의 호출은 461 → 433 으로 사실상 같다. 좁은 도구(#4635)는 이 머리에 없다.
- 화면은 보지 않았다(기계 판정). 일마다의 표: `~/z-project/assistant-fable-runs/genre-tools/set3-before-after.md`.

## 셋째 수리 — 도구가 닿은 뒤에 드러난 겹 (2026-11-12, «후» 실행의 머리에는 없다)

도구가 닿자 다음 겹이 보였다. 모두 **조수 경로(`createPiToolset` + 칩 관문)에서만** 나는 거절이라 `runTool` 만 부르는 시험 · 닿기 표에는 안 잡혔다 —
정답 풀이를 조수 경로로 부르는 탐침(`~/z-project/assistant-fable-runs/genre-tools/piPathProbe.mts`)이 그것을 본다(57풀이 중 18이 거절 · 숨김. 대부분은 정답 풀이가 «안 본 칩»을 직접 적어서이고 그것은 관문이 옳다).

| 일 | 실행에서 본 것 | 고친 것 |
|---|---|---|
| 기한 엔딩 | `set_deadline_ending` 이 `tiers:[{endingId, friendshipAtLeast:0}]` 를 «마지막 항목은 문턱 없이»로 일곱 번 거절. 싼 모델은 선택 칸을 0 으로 채워 보낸다 | 0 이하의 문턱은 문턱 없는 기본 결말로 읽는다. 기본 결말 뒤의 같은 엔딩 겹침은 걷어 낸다(다른 엔딩이면 여전히 거절) — `endingTools.ts` |
| 빈 프로젝트의 포획 | `configure_monster_system` 이 여섯 번 «캐릭터 그림 선택을 되돌렸습니다». 장르 잠금이 출연진 칩을 수집 게임 출연진으로 갈아 끼웠는데 칩 관문은 그것을 모델의 선택으로 읽었다 | `choosesOwnGraphic: true` — 이 도구는 칩 인자가 없다 |
| 시야 트레이너 | `place_trainer` 가 처음부터 실리자 모델이 그것만 열 번 불렀고, 배우 칩으로 아홉 번 거절됐다. 얇은 몬스터 도구가 빈 프로젝트에서 처음 불리면 `toolRunner` 가 잠금을 걸고 잠금이 배우 칩을 바꾼다 | 그 호출에서 잠금이 바꾼 배우 칩(`toolRunner.ts`)과 `graphic` 을 안 줬을 때 도구가 고른 조련사 칩(`trainerTools.ts`)을 `noteToolChosenGraphic` 으로 관문에 알린다 |
| 은신처 | 모델이 통을 사람이 선 칸 위에 찍었고 `stamp_object` 는 경고만 했다. 모델이 경고를 따라 사람을 옮겨 판정이 «시키지 않은 옮김»으로 떨어졌다 | `onOverlap:"nearest"` 는 사람이 선 칸(그림 칸 전부)도 비켜 찍고 «그 사람은 옮기지 않았다»고 알린다. 기본(`refuse`) · `replace` 는 그대로 — `sharedObjectTools.ts` |

Haiku 로 같은 묶음을 다시 재자(아래 «Haiku» 절) 다섯째가 나왔다:

| 일 | 실행에서 본 것 | 고친 것 |
|---|---|---|
| 기한 엔딩(Haiku) | `set_deadline_ending` 은 한 호출에 됐다. 그 도구의 경고(«forceSleep 을 켜거나…»)를 따라 모델이 `configure_time_system{enabled, forceSleep:true}` 를 부르자 하루 끝 연결(`onDayEnd`)이 사라졌다 — 그 도구가 안 보낸 칸을 기본값으로 되돌렸다 | 이미 켜진 시계에서는 보낸 칸만 바뀐다(배속 · 하루 끝 시각 · 계절 길이 · 강제 취침 · `onDayEnd`). 처음부터 다시 잡으려면 끄고 다시 켠다 — `timeTools.ts` |

**관문도 잠금도 풀지 않았다.** 칩 관문(`src/ai/piAgent/charsetSelectionGate.ts`)은 한 줄도 바꾸지 않았다 — 모델이 보지 않은 칩을 직접 적으면 지금도 되돌린다(`test/piGateToolChosenChips.test.ts` 가 그 줄을 지킨다).
바뀐 것은 «이 칩은 모델이 고르지 않았다»를 도구 쪽이 알리는 기존 통로(`toolChosenGraphics.ts`)를 두 곳 더 쓴 것뿐이다. 종 그림에 대한 장르 잠금의 거절(`place_trainer` 에 금지 그림을 물려받은 종을 주면)은 그대로다.

남는 것: 은신처의 뒷걸음이 #4630 의 도구 목록 때문인지는 표본 하나로 말할 수 없다(두 실행의 처음 목록은 `configure_object_behavior` 하나만 다르고, 모델의 길은 `find_empty_ground` 를 먼저 불렀느냐에서 갈렸다).
`place_storage_chest` 는 그림 인자가 없는데 표시가 빠져 있었다 — `place_chest` · `place_savepoint` 와 같이 `choosesOwnGraphic: true` 를 붙였다. `make_chase_scene` 은 `graphic:{query}` 로 고른 칩이 관문에 한 번 걸린다(실행에서는 한 호출 더 쓰고 통과) — 낱말로 고른 칩을 모델의 선택으로 볼지는 관문의 계약이라 건드리지 않았다.

## Haiku — 같은 묶음을 Claude Haiku 5.5 high 로 (2026-11-12, 이 뒤의 측정은 Haiku)

Terra 측정을 접은 뒤(오너 결정 2026-11-12) 셋째 묶음을 Haiku 로 전 · 후 다시 쟀다. **Haiku 는 Pi 고리가 아니라 Claude Code 고리(`local-cli:claude`)로 돈다** —
도구 풀과 처음 목록은 같은 함수(`toolExposure.ts`)가 정하지만, 이 고리는 목록을 얼려 두고 `load_tools` 가 스키마를 글로 돌려준 뒤 `call_tool{name,args}` 로 부른다.
그래서 **통과 · 까닭의 갈래는 Terra 와 견줄 수 있고 호출 수 · 토큰 · 시간은 견주지 않는다.** 돌리는 법 · 기록에서 모델을 확인하는 법은 `~/z-project/assistant-fable-runs/HAIKU-RUN.md` «small-jobs».

| | 전 main `00a1e0603f` | 후 #4630 머리 `2575cd8fdb` |
|---|---|---|
| 통과 | 21/36 | **29/36** |
| 환산 비용(CLI 보고 · 구독 한도 사용) | $1.52 | $0.93 |
| 호출 합 | 921 | 778 |
| 곁 수정이 적힌 일 | 22 | 17 |

- 전의 15건 가운데 **10건이 통과**했다. 남은 5건과 뒷걸음 2건(기한 엔딩 · 시야 트레이너 — Terra 와 같은 두 일)의 까닭은 넷이다:
  1. **시작 저장본의 빈 맵 「동쪽 들판」이 지워진다**(암호 금고 · 꽃잎 체력 · 엔딩 표지판 — 셋 다 요청한 것은 지었다). main 의 «빈 시작 맵 치우기»(`blankStart.ts retireSeedStart`, #4623)가
     픽스처의 둘째 맵(id `map_blank_start`, 바닥 한 가지 · 이벤트 없음)을 새 프로젝트의 자리표시로 읽는다. 시작 맵은 다른 맵이고 그 맵은 이름까지 붙은 사용자의 맵이다. 이 줄기의 변경과 무관하고 전에도 네 일에 같은 줄이 있다 — 고치지 않았다(다른 일꾼의 파일).
  2. 장르 잠금 · 도구가 고른 칩을 칩 관문이 되돌린다(포획 · 트레이너) — Terra 와 같다. 위 «셋째 수리».
  3. 시계를 다시 설정하자 기한 판정 연결이 끊겼다(기한 엔딩) — 위 «셋째 수리»의 다섯째 줄. Terra 의 0 문턱 거절은 Haiku 에서는 나지 않았다(문턱 칸을 비워 보냈다).
  4. 은신처: 모델이 그림이 없다고 보고 `draw_object` 로 그리기 카드를 올린 뒤 아무것도 놓지 않았다. 전에도 불합격이고 까닭이 다르다(투명 이벤트).
- 전의 깨진 두 일(부하 급등 때의 시간 초과 · 편집기 기동 실패 — 모델 결과가 아니다)은 그 둘만 다시 돌렸다. 실행 폴더의 `disclosures.json` 에 적었다.
- 쪽: `~/claude-viz/assistant-small-jobs-set3-haiku.html` · 표 `~/z-project/assistant-fable-runs/genre-tools/set3-haiku-before-after.md`. 화면은 보지 않았다.

## 남은 것(차례)

1. **새 도구(N)** — 이벤트 명령을 손으로 쓰는 장치 넷을 좁은 도구로: 호감(말 걸기 · 선물 · 문턱 대사) · 증거 내밀기 반응 · 제한 시간(「N초 안에 못 하면」) · 물건 하나를 은신처/밀 수 있는 것/제작대/침대로 **놓기**(지금은 물건 이벤트를 먼저 세우고 `configure_object_behavior`).
2. **수치 게이지** — `set_project_settings.fieldHud.widgets`(1.3만 자 도구)를 거치지 않는 좁은 길(`set_field_hud` 에 변수 위젯, 또는 게이지 도구 하나).
3. **영어 조건 글**(`toolTextEn.ts COND`)에 `timePhase` · `friendshipAtLeast` · `gold` · `timer` — 게임 하나 경로의 지시문과 같이 본다.
4. 내놓지 않은 큰 묶음: 사건 통째(`author_mystery_case`) · 연애 기본값(`apply_romance_preset`) · 생활 경제(`configure_life_economy`) · 몬스터 종 · 센터 · 배지 — 고리 설계의 종류가 정해지면 그 빌더가 부른다(모델에게 4만 자 도구를 싣지 않는다).

## 런타임 빈틈 — 엔진 PR 제안 둘 (제안 · 구현 전)

재고의 **R** 셋 가운데 작은 둘. 하나에 PR 하나, 스키마 칸 하나씩이다. 가게 운영(손님이 와서 산다)은 작지 않아 여기 넣지 않는다.

**① 재고가 한정된 상점 물건 — `ShopStockEntry.quantity?`**

- 지금: `ShopStockEntry { itemId, seasons?, priceOverride?, displayTileId?, priceBySeason? }`(`src/project/types/events.ts`) — 수량 칸이 없어 「회복약은 3개까지만 판다」를 적을 수 없다.
- 스키마: `quantity?: number`(이 상점이 파는 총 개수, 없으면 무한) · `restock?: "never" | "daily"`(없으면 never — daily 는 시간 시스템의 하루 끝에 되찬다).
- 세션: `PlaySession.shopSold?: Record<string /* mapId:eventId */, Record<ItemId, number>>` — 세이브에 든다. `src/project/shopStock.ts` 의 진열 해석이 남은 수(`quantity − sold`)를 같이 돌려준다.
- 런타임: 사는 길에서 남은 수를 넘겨 살 수 없고(수량 고르기의 상한), 상점 창이 「남은 N」을 보이고 0 이면 흐리게. 하루 끝(`dayTransition.ts`)에 `daily` 를 비운다.
- 읽기 · 검증: `io/shapeCommandFields.ts`(1 이상의 정수) · 저장 · 재로드 왕복. 도구: `set_shop_stock` 의 항목에 `quantity`.
- 검사(작은 일): 상점을 따라가 그 물건을 `quantity` 번 사면 그다음은 못 산다 · 다른 물건은 그대로.

**② 쓰면 사건이 도는 아이템 — `ItemRecord.commonEventId?`**

- 지금: 아이템 사용(`src/player/playerItemUse.ts useItemFromMenu`)은 HP · MP · 상태 · 기술 · 스위치(`type:"switch"` + `switchId`)만 바꾼다. 「빵을 먹으면 배고픔 +30」은 스위치 아이템 + 그 스위치를 보는 병렬 공통 이벤트로 돌아가야 한다(한 번 켜진 스위치는 다시 못 쓴다 — 소모품이 안 된다).
- 스키마: `commonEventId?: string` — 메뉴에서 쓰면(다른 효과를 적용한 뒤) 메뉴가 닫히고 그 공통 이벤트가 한 번 돈다. 다른 효과가 없는 아이템도 이 칸이 있으면 쓸 수 있다.
- 런타임: `useItemFromMenu` 가 `{ kind: "used", runCommonEventId }` 를 돌려주고 필드 장면이 메뉴를 닫은 뒤 인터프리터에 넣는다(스위치 아이템이 메뉴를 닫는 길과 같다). 전투 중 사용은 첫 판에서 뺀다(필드 · 메뉴만).
- 읽기 · 검증: 없는 공통 이벤트 id 는 저장 검증에서 거절(`orphan FK` 권한표에 한 줄) · 도구: `upsert_item` 의 `item.commonEventId`.
- 검사(작은 일): 그 아이템을 쓰면 수가 하나 줄고 공통 이벤트의 명령(변수 +30)이 돈다 · 안 쓰면 그대로.

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
