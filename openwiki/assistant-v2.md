# 조수 v2 — AI 는 정하고, 함수가 짓고, 다른 눈이 본다 (2026-10-23, 기본 꺼짐)

v1 조수는 모델이 칸 좌표·타일 번호·평면 문자열을 직접 쓰고 도구 400여 개 중에서 고른다. 실패의 대부분이
「모델이 좌표를 지어냄」(벽 속 NPC, 벽으로 걸어가는 컷신, 휑한 방)과 「다 됐다는 거짓 보고」였다.
v2 는 같은 실행기 위에서 역할을 나눈다.

| 단계 | 누가 | 무엇 |
|---|---|---|
| 1 해석 | 모델 | 요청 → 타입 있는 명세 하나(`src/ai/v2/types.ts` PlaceSpec·PersonSpec·EventSpec·ObjectSpec). 좌표 없음, 자리는 낱말. |
| 2 짓기 | 결정론 빌더 | 명세 → v1 결정론 도구 호출(`src/ai/v2/builders/*`, `people.ts`, `events.ts`, `drawObject.ts`). |
| 3 보기 | 코드 | 1배 그림 + 기계 검사(`checks.ts`: 도달·출입 착지·계단·NPC 도달·맨바닥·빈 칸). |
| 4 비평 | 다른 호출 | 요청 원문 + 1배 그림만 보는 독립 비평가(`critic.ts`, v1 `featureCriticPrompt` 루브릭 축 1·2·6). major 를 칸 좌표로. |
| 5 고치기 | 모델 → 빌더 | `edit_place` 패치(구역·주인공 물건 near·크기·variant·dressing)로 같은 빌더를 다시. 맵당 1바퀴(6차 속도 — 3바퀴는 바퀴마다 다시 짓기+비평 20~35초). |
| 6 보고 | 모델 | 「다 됐다」는 비평 major 0 + 기계 검사 통과일 때만. `missingArt` 는 그대로 보고. |

## 다양성 — 같은 요청이 같은 맵이 되지 않게 (2026-10-23)

`make_place` 가 처음 지을 때 명세에 무작위 `salt` 를 넣고, 고치기(`edit_place`)는 기록된 명세의 salt 를 물려받는다(모델은 쓰지 않는다).
빌더는 요청이 정하지 않은 결정만 salt 로 고른다: 마을(씨앗·땅 모양 terraces·숲 종류·맵 크기), 일본 거리·집(씨앗), 실내(배치 variant·씨앗, 선술집 견본은 좌우 뒤집기 × 손님 자리 두 판),
던전(종류가 없는 「던전」은 종류도). 던전 짓기 도구 쪽은 덩이 배치에 퍼짐 세 갈래(뭉침·구불·넓게)와 1층 입구 계단/문을 씨앗으로 고른다(`layouts.ts` `layoutBlobOnce`, `dungeonTools.ts`).
여전히 고정인 것: 역전 상점가(지역 문법 station_plaza 가 씨앗을 안 탄다)·일본 집 예제 구성·컷신 무대 자리. 눈가림 「같아 보임」 점수와 빌더 표본은 보고서(`~/claude-viz/assistant-v2-report.html`) 다양성 절.
빌더 증명에서 같은 명세를 다른 salt 로: `SALT=<n> CHECKS=1 bun scripts/qa/assistant-v2/builders.mts <out> <case>`.

## 게임 요소 — 퀘스트·아이템·전투·파티·스위치 (2026-10-24)

v2 동사는 장소·사람·연출만 다뤘다. 그래서 「심부름 퀘스트」「상점에 새 무기」「보스 전투 뒤 감사」를 옮길 길이 없었다.
`src/ai/v2/game.ts` 는 요청에 게임 낱말(`GAME_WORDS`: 퀘스트·아이템·상점·전투·파티·스위치·여관·낮/밤 …)이 있을 때만 v1 결정론 도구 30개를 그대로 싣는다.
도구는 `V2_GAME_TOOLS`: 읽기 → DB(upsert_item·enemy·troop·actor…) → 붙이기(place_npc·upsert_event·set_shop_stock·place_chest·set_encounter_table·create_quest·configure_time_system·set_npc_schedule).
그와 함께 `GAME_CARD` 를 지시에 싣는다. 맵 요청의 첫 턴은 가볍게 남는다.
연출 비트에는 `tint`(밤·저녁·새벽·세피아·clear — 컷신 뒤에도 남는다)·`camera`(자리·사람으로 옮겨 보여 주고 back 으로 복귀)·`look`(shadow·ghost·normal)·`vanish` 가 더해졌다.
v1 의 `script_cutscene` 비트로 옮긴다(`events.ts`).
비교 사례 40개는 `harness-data/space-craft/seed.json` 의 `game` 분류다(id `g-*`, 시작은 모두 같은 마을 + 촌장·대장장이).
출하 플레이어에서 이벤트마다 세 번 말 걸기·선택·전투·상점을 자동으로 해 본 뒤 상태 변화와 대사로 눈가림 채점한다. 결과는 보고서 「게임 요소 비교」 절에 있다.
못 하는 것: 이미 있는 마을에 강·다리 같은 지형 덧그리기(맵을 새로 짓지 않으면 못 한다).
음악 낱말(음악·배경음·브금·BGM·팡파르·사운드트랙·OST)이 있으면 `FALLEN_TIERS` 음악 단이 `recommend_bgm`·`store_find_music`·`store_install`·`set_game_audio`·`get_database_records` 를 싣는다.
맵·시스템 음악 연결이 바뀌었으면 마감 검사가 「playAudio 이벤트」를 더 요구하지 않는다(`gameChecks.ts` `audioBindingsChanged`). 기본은 조수가 묻지 않고 스토어 곡을 넣어 잇고, 걸지 않았으면 마감 검사가 `set_game_audio`(필요하면 `store_find_music` → `store_install`)를 요구한다. 사용자가 「먼저 묻기」를 켰을 때만 음악 카드가 질문으로 세져 관문이 재촉하지 않는다. 스토어 음악 길은 `openwiki/asset-store.md` 「조수가 스토어 음악을 찾아 넣는다」.

## 새 플레이어 길잡이 — 목표 줄·보이는 이야기 이벤트 (2026-10-26, J90~J96)

사람 판정자가 엔딩에 못 닿는 게임이 자동 플레이로는 통과했다(연애 j90: 투명 「집 현관」, 장난감 가게 j90: 오프닝이 옮긴 인형).
- `set_objective{text, at:'start' | eventId}` 동사(`src/ai/v2/discoverability.ts` planObjective) — UI 명령 `objectiveChip`(m2-214)을 넣어
  「현재 목표」 줄을 바꾼다(자리는 런타임이 주인공·인물·HUD 를 피해 고른다 — `runtime-pre-edit-routing.md` 「목표 안내창 자리」). 목표 줄은 상태라 불러오기·장면 재생성 뒤에도 남는다(`zoneFeedback.lastObjective`).
  이야기·연애 기본 HUD 와 `set_field_hud{off:true}` 는 목표 줄을 켜 둔다.
- 출하 막음(`shipChecks.shipBlockers`): `critical-invisible`(엔딩·이정표 이벤트가 투명이고 반짝임·작은 물건이 없음 — 건물 벽면 한 칸은 안 셈),
  `objective-missing`(목표 줄 없음·시작 목표 없음·이정표 뒤 목표 안 바뀜), `romance-gap`(연애 완료 검사 = 호감 변수 미연결 등을 경고가 아니라 막음).
- 자동 플레이(`qa/gameCheck/autoPlay`)는 컷신 `moveEvent` 가 옮긴 인물 칸으로 걸어간다(`sceneTestRunner.applyMoveEventForRunner`, 결과 `movedEvents`,
  저장 지점에서 이어 도는 판도 `initialEventPositions` 로 같은 자리).
- 컨셉 카드 한 줄(「… (회상 스토리)」)도 `wantsWholeGame` — 1턴부터 출하 검사·화면 검수가 돈다.
- 화면 검수 결함 나누기(2026-10-28 fix-gamepath, mt2 terra 1턴 575초 중 대부분이 고치기 반복 — 9→6→5→4→4, 남은 넷은 조명 막·타이틀 그림 잘림·화풍 차이인데 모델이 조명값만 바꾸며 돌았다): `vqa.ts` `vqaClassify` 가 결함마다 «동사로 고칠 수 있는가»를 낱말·대상으로 정한다. 모델 밖 = 검수 그림에 주인공 없음(`player-not-drawn`)·타이틀 그림에 제목/메뉴 없음(`shot-limit`)·오프닝 자막 크기(`runtime-text`)·화풍/시점 차이(`art-style`)·칩 배율(`sprite-scale`)·화면 배율/여백/잘림(`runtime-screen`)·HUD·맵 조명/분위기(`lighting`)·실내 출구 통로/문틀(`builder-exit`)·타일 짜임/빈 공백/격자(`builder-tiles`)·칩셋에 그림 없음(`missing-art`)·타이틀/오프닝 그림 자체의 잘림·구도·격자(`title-art`). 그 밖(가구 겹침·빈 방·물건·이벤트·대사·장르에 안 맞는 타이틀/오프닝 그림 고르기)은 고칠 수 있다. `vqaActionable(round, previous)` = fix(넘김) / ledger(모델 밖) / stuck(고칠 수 있는 종류인데 앞 판에도 그대로 — `vqaRepeated`). 고치기 지시·다시 시키기·고치기 머리글에는 fix 만 싣는다. fix 가 0 이면 `vqaShouldContinue` 가 멈추고 실행기가 남은 결함 보고 지시로 끝낸다(막음 연장 판도 fix 막음이 있을 때만). 모델 밖 결함은 실행 상태 `v2.vqa.outside` 「런타임/빌더 결함(모델 밖) [종류] …」로 한 번씩 남아 ai-activity 기록에 쌓인다(우리가 모아 고칠 목록). 남은 결함 수·출하 차단·최종 보고 목록은 장부로 뺀 것까지 그대로 센다(`vqaSummary` 는 「그중 모델 밖 N건」을 덧붙인다). 분류 표: 저장소 밖 `ledger/evidence/gamepath/06-vqa-classify.txt`(저장된 턴 기록의 실제 결함 52건: 고침 21·모델 밖 31). 빈 맵(맵 대상이고 «빈 맵»·기본 잔디·오브젝트 없음·플레이스홀더 낱말 — `EMPTY_MAP`)은 `missing-art` 보다 먼저 «고칠 수 있음»으로 본다(장소를 짓거나 쓰지 않는 맵을 지운다; 2026-10-28 mt3 flash 에서 빈 시작 맵이 모델 밖으로 빠져 남았다).
- 끝맺음 뒤 청사진(2026-10-28 mt3 flash 턴 1: 첫 끝맺음엔 청사진이 없었고 화면 검수 고치기 차례에 `write_blueprint` 만 부른 뒤 끝나 장소 0): 실행기 `autoBuild`(장소 → 경로 → 출구·이동 칸 마감 → 조립 기본값)를 끝맺음 ① 에서만이 아니라, 그 뒤 차례에서 청사진이 처음 생겼거나 다시 끊겼을 때(`lateBuildPending`)도 부른다 — 지었으면 `v2.blueprint.late` 를 남기고 화면 검수를 지은 뒤 그림으로 다시 돈다.
- 쓰지 않는 빈 시작 맵(`blankStart.ts` `retireBlankStart`): 청사진 장소 맵이 하나라도 있으면 바닥 한 가지·위층 없음·이벤트는 이동뿐인 맵을 지우고, 그 맵이 시작이었으면 시작을 청사진 첫 장소의 걸어 닿는 칸으로 옮긴다. 다른 맵에서 그 빈 맵으로 가던 이동 이벤트도 지운다(남은 막다른 틈은 `exitDress` 가 문 그림으로 닫는다 — 문 이름 이벤트가 없으면 맵의 그림 없는 엔딩 장치, 예: 방탈출 «비밀번호 입력»이 잠긴 문이 된다). 장소 자동 짓기는 빈 시작 맵과 잇지 않고 짓고 끝에 이걸 부른다. 끝맺음 `session.clearLanes`(`verbs.ts`)의 순서는 `retireBlankStart` → `sealEscapeExits` → 추격자 은신처 → 맵마다 `dressInteriorExits`·`clearTransferLanes` 다(`editor-ai-tools.md` 「갇힌 방에서 걸어 나가는 길」과 같은 순서).
- 최종 답의 제공자 오류 문장(`finalReport.ts`, 2026-10-28 mt3 flash 세 턴·mt2 argon 턴 3: 검토 뒤 마지막 호출이 «I seem to be encountering an error…»·«Sorry, something went wrong»·«I'm having a hard time…»를 돌려줘 그게 사용자 답이 됐다): 한글 없는 짧은 영어 사과·오류 문장은 `isProviderErrorReply` 로 걸러 대화창에 보내지 않는다(`v2.answer.provider_error` 상태만) — 앞의 정직한 보고가 마지막 답으로 남고, 검토자 재료(draft)도 그 보고 그대로다. 앞 보고가 없으면 `assembledReport`(맵 목록·청사진 경로 기계 확인 결과)를 보낸다.
- 화면 검수: 오프닝 프레임은 `bare:true`
  로 그려 「샷 id · ms」 글씨를 검수자에게 보이지 않는다(그 글씨를 세 판 내내 결함으로 짚었다).

### 2차 (2026-10-27, J98·J101~J106 — romance-j91·toy-j91 판정)

- **목표 줄 「어디」(J105)**: `set_objective` 가 글에 다른 장소 이름이 나오거나 `where`(이벤트·장소 id/이름)를 받으면 그 입구의 방위를 붙인다 — 「(지하철역 입구: 남동쪽)」(`discoverability.withWhere`, 맵 3×3 방위 `mapRegion`). 같은 맵의 대상은 이벤트 이름만 붙이고(글에 이미 있으면 아무것도 안 붙임), 자리는 조사 칸 반짝이·목표 화살표에 맡긴다 — 2026-10-29 VQA 트리아지 B: 「(책장: 잠긴 서재 가운데)」 꼬리가 개발 메모처럼 읽히고 목표 칩을 4~5줄로 접었다(12건). 재생 `scripts/qa/assistant-v2/objectiveTailCheck.mts`. 이름만 대고 방위가 없는 목표는 `objective-missing` 이 짚는다. **방위는 목표가 걸리는 자리에서 본 첫 출구(2026-10-29 vm2 jrpg)**: 맵 3×3 방위는 「서쪽」 띠의 문을 「서쪽」이라 했다.
그런데 플레이어는 이미 맵 서쪽 끝(1,4)이었고 문은 26칸 남쪽이었다(terra). 그래서 시작 목표는 시작 자리에서, 이벤트 목표는 그 이벤트 자리에서 본 8방(`bearingWord`, 2칸 안은 「바로 옆」)을 쓴다.
다른 맵은 `mapRoute` 의 첫 출구를 가리킨다. 바로 가는 문이 없으면 「(첫 맵 입구: 방위 → 목적지 · 대상)」, 있으면 「(맵 입구: 방위 → 대상 이벤트)」이고, 「→」 뒤는 그 맵에 들어선 뒤 런타임 목표 표시가 짚을 이름이다.
시작 목표의 「어디」는 `where` 가 없으면 청사진 첫 단계 이벤트다. flash 판에서는 시작 목표가 3칸 위 「마을 시작」을 건너뛰고 동굴 입구를 가리켰다.
끝맺음 조립(`applyShipDefaults` 뒤)의 `refreshObjectiveRoutes` 가 「(… 입구: …)」 꼬리를 마지막 연결로 다시 쓴다. 문·맵은 목표를 건 뒤에도 바뀌기 때문이다.
같은 함수는 전투 승리 스위치로 잠긴 대상도 고친다(`battleGateHolders`). `gateBattleSteps` 가 「마왕과의 결전」을 보스 승리 뒤로 잠그면, 그 앞에 걸린 목표(`stepObjectives` 는 잠그기 전에 돈다)는 여전히 결전 이벤트를 가리킨다. 그래서 그 목표의 꼬리·글을 보스로 돌린다. 이름 없는 보스 이벤트에는 부대 이름을 붙인다. 런타임 표시는 이름으로 대상을 짚기 때문이다. 실측 2026-10-29 vm2 terra jrpg: 표시가 1칸 옆 결전을 짚었고 보스는 표시 0이었다. 같은 판의 출하 검사 막힘 「동굴 (13,29)→보스 (27,9) 길 없음」은 끊긴 동굴이 아니었다. 레버로 치우는 바위 길을 옛 자동 플레이가 열지 못한 오탐이며, `8052e6c1aa` 에서 고쳤다.
`objectiveGaps` 는 `startObjectiveReachGap` 도 본다. 시작 자리에서 첫 목표 대상까지 걸어갈 수 없거나, 입구를 약속했는데 시작 맵에 그 출구가 없으면 짚는다.
재생은 `scripts/qa/assistant-v2/objectiveRouteReplay.mts <run-dir>... [--write <폴더>]` 로 한다. 전/후 목표 글, 맵마다 표시 대상, 첫 대상 도달, 자동 플레이를 나란히 적는다. `at:'start'` 는 시작 맵 자동 실행에 이미 있는 목표를 바꾼다(조건 달린 오프닝 페이지여도).
- **목표 줄 보강(2026-10-28 mt3 argon escape — 「조사할 위치를 잡는 데 헤맸다」)**: ① `where` 만 주고 `eventId`·`at` 없는 호출은 시작 목표가 이미 있고 `where` 이벤트에 이정표(스위치 켜기·아이템 얻기)가 있으며 글이 그 이벤트 이름을 담지 않으면 «그 이벤트 뒤의 다음 목표»로 건다(전에는 시작 목표를 덮어 게임 시작부터 마지막 목표가 떴다). ② 글에 이벤트 이름(두 글자 이상)만 나와도 그 자리 방위를 붙인다(`namedEvent`). ③ 「어디」가 끝내 없으면 청사진 단계로 채운다 — 시작 목표는 첫 단계 이벤트, 단계 이벤트 뒤 목표는 다음 단계 이벤트. ④ `build_blueprint_path` 는 목표 줄이 없는 단계 이벤트마다 이정표 뒤에 다음 단계 `action` + 그 이벤트 자리를, 시작 목표가 없으면 `playerGoal` 을 건다(`blueprintPath.stepObjectives`, 사슬 고리 순서대로 — 번호 단계 앞에 덧붙인 단서 고리면 「<단서>을 살펴보자」; 모델이 같은 이벤트에 `set_objective` 를 부르면 같은 자리를 바꾼다). 새 시작 목표 이벤트는 시작점에서 가까운 걷는 칸에 둔다(막힌 칸이면 upsert_event 가 거절해 시작 목표가 통째로 빠졌다). ⑤ 청사진 `needs`·`gives` 가 배열이나 배열 JSON 글(`"[]"`, `"[\"첫 번째 단서\"]"`)로 오면 「, 」로 이은 사람 말로 풀고 빈 배열은 없음으로 읽는다(`gameBlueprint.blueprintListText` — 화면에 「[]이(가) 있어야 할 것 같다」가 나왔다).
- **열쇠 문·회복 길(2026-10-29 vm1 flash jrpg — 「전투 못 이김」·「열쇠가 어디에도 쓰이지 않았다」)**: `build_blueprint_path` 는 경로를 짓거나(또는 이미 있어 그대로 두거나) 끝에 두 가지를 결정적으로 맞춘다. ① 청사진 단계의 `needs` 가 열쇠 낱말(열쇠·키·key)이고 그 단계 맵이 앞 단계 맵과 다르면, 앞 맵에서 그 맵으로 옮기는 문 이벤트를 잠근다 — 첫 페이지 「<열쇠>이 있어야 들어갈 수 있을 것 같다」, 원래 페이지들에 그 아이템 조건(`blueprintPath.gateKeyedEntrances`). 청사진에 `needs` 가 없으면 잠그지 않는다. ② 전투가 있는데 HP 를 되찾을 길(`combatChecks.healingSources`)이 0이면 시작 맵 시작점에서 3칸 이상 걷는 칸에 「회복의 샘」(`place_savepoint` heal·both, id `ev_heal_spring`)과 시작 소지품 회복약 3개(이름이 「…약」인 약 가운데 한 개로 선두 영웅 HP 4분의 1 이상 채우는 가장 싼 것)를 넣고, 전투 맵 이름이 나오는 목표 글 괄호에 「회복의 샘: <맵> <방위>」를 붙인다(`healingAccess.ensureHealingAccess`). 조수 v2 던전 빌더도 적을 둔 뒤 같은 함수를 부른다. 출하 검사 `combat-no-healing`(shipChecks)이 같은 결함을 고칠 수 있는 항목으로 짚는다(끝맺음 관문은 `combatProblems` no-healing 한 줄만 — 겹치지 않게 거른다).
- **싸워 이기는 단계(2026-10-29 vm1 flash jrpg — 보스를 지나쳐 「마왕과의 결전」 조사만으로 엔딩)**: 번호 단계와 같은 방식. 청사진 단계의 이벤트 이름이나 행동에 전투 낱말(결전·전투·처치·쓰러뜨·물리치·격파·토벌·대결·boss…, 행동은 대화·듣기 단계 제외)이 있으면 `blueprint.isBattleStep`. 넘어가는(엔딩·스위치·아이템·이동) 페이지마다 전투 승리 갈래(`fork battleResult victory`·`victoryBranch`) 안에만 넘어가는 명령이 있거나, 승리 갈래에서만 켜지는 스위치(`victoryGatedSwitches`)를 조건으로 걸어야 한다 — 아니면 출하 검사 `blueprint-battle-bypass`(`battleStepBypass`). `build_blueprint_path` 는 끝에 `gateBattleSteps` 로 고친다: 그 맵에 보스·수문장 전투(이름·적 그룹에 boss/보스, 또는 도망 불가)가 있으면 넘어가는 페이지에 그 승리 스위치 조건을 더하고 바로 앞에 「먼저 <보스>를 쓰러뜨려야 한다」 페이지를 두며, 보스 승리 뒤 목표 줄이 그 단계 이벤트를 가리키게 한다. 보스가 없으면 그 페이지 안에서 시작 파티에 맞춘 보스 그룹(`pickFittedTroops`)과 싸우고 원래 명령은 승리 갈래에서만 한다. 떠도는 잡몹은 이겨야 할 상대로 걸지 않는다.
- **목표 줄 글자 크기(J105)**: 논리 해상도 1024×768 무대에서 7px 그대로라 읽을 수 없었다. `fieldHud.ts` 가 무대에 `--play-ui-scale`(높이/240)을 걸고 목표 줄 `font-size`·`top` 이 그것을 곱한다.
- **set_objective 가 늘 실패하던 원인**: 조수 「통째 다시 보내기」 거부(`assistantRewriteGuard`)가 동사의 `upsert_event` 까지 막았다 — `replacePages:true` 로 보낸다.
- **차 간격(J102)**: 한국 거리 구성기 차 간격 6초 → 14초(버스 40초). 6초면 차선마다 줄이 서 횡단보도 밖에서는 못 건넜다.
- **그려진 입구(J103·J104)**: 출하 막힘 `entrance-off-art` — 투명 출입구·이야기 이벤트가 문·계단·스크린도어 그림 옆(대각 포함, 또는 바닥 한 칸 건너) 맨바닥에 있고 그 그림 칸에 이벤트가 없으면 막는다. 「도어」(스크린도어)를 문 낱말에 넣었다. `create_transfer_pair` 는 3×3 계단 그림 가운데를 받아도 착지점 옆 그림 칸에 문을 세운다.
- **이튿날 같은 대사(J106)**: 출하 막힘 `dialogue-repeat` — 하루 변수(`+=` 로 오르고 페이지 조건 `>=` 로 두 번 넘게 읽힘) 구간 페이지가 여러 날을 덮는데 그 안에서 날로 가르지 않으면 막는다.
- **짙은 화면 색(J98)**: 출하 막힘 `field-tint-heavy` — 페이지가 알파 0.4 이상 화면 색을 남긴 채 끝나면 막는다. v2 컷신 `tint:'night'` 기본값 0.5 → 0.3.
- **엔딩 제목 중복(J101)**: 엔딩 마지막 장에서 부제가 큰 글자와 같으면 부제를 뺀다(`playSceneOverlays`).
- **오프닝 「없음」은 오진이었다**: 저장본은 애니메틱을 `meta.oprnCinematicTimelines` 캡슐에 넣고 `system.opening` 에는 정지 그림 대체본을 둔다. 내보낸 JSON 을 `decodeCinematicWire` 없이 읽으면 오프닝이 한 장뿐으로 보인다.
- **자동 플레이 부딪힘 문(J97, #3740)**: 장면 실행기가 막힌 문 그림 칸의 same 층 접촉 이벤트를 부딪힘으로 연다(런타임과 같다).

## 게임 조립 기본값 — 타이틀·오프닝을 청사진에 맞춘다 (2026-10-28 스위트 조립 장부)

방탈출 세 판(flash·argon·terra)의 타이틀이 편집기 기본 눈 덮인 산촌 + 「A NEW ADVENTURE / 이야기가 시작되는 곳」, 오프닝은 기본 「강을 낀 왕국」이었다.
고르기를 모델에 맡기지 않는다 — `src/project/blueprintAssembly.ts` 의 `applyBlueprintAssembly` 가 청사진(`project.gameBlueprint`)으로 결정적으로 깐다.

- **부르는 곳**: `write_blueprint`(모델·설계자 청사진 둘 다) 직후, 그리고 게임 전체 요청의 끝맺음 관문 직전(`scripts/lib/assistantV2Runtime.ts` afterMain, 체크포인트 `blueprint_assembly`). 두 번 불러도 같다.
- **바꾸는 것(아무도 고르지 않은 값만)**: 기본 제목·프로젝트 id 슬러그(`isPlaceholderTitle` — 「suite-mt3-1028-flash-escape」 가 meta.title → 청사진 title 로 흘러 타이틀에 그대로 나왔다, 2026-10-29 VQA 트리아지 B blocker) → 청사진 제목, 청사진 제목도 슬러그면 첫 장소 이름(방탈출이면 「밀실 탈출」, `blueprintDisplayTitle`) · meta.title 이 슬러그면 같은 제목 · 타이틀 배경이 편집기 기본(`oprn-title-field`)·부적합 스틸·하늘만 있는 배경 층(`oprn-pano-night` 등)·이야기에 없는 풍토(눈·사막·바다)·공포가 아닌 게임의 공포 그림·지난번 자동 맵 화면이면 다시 고른다(`pickBlueprintTitleArt`) · 로고 질감·부제가 없으면 부제 「장르 · 장소」(기본 문구를 숨긴다) — 제목에 든 낱말은 빼고(「멈춘 시계의 방」 아래 「방탈출 · 멈춘 시계의 방」 반복), 장르 칸 기본값 「게임」 은 장르가 아니다(목표·엔딩 글에 탈출·밀실이 있으면 「방탈출」, `blueprintGenreWord`). 남는 것이 없으면 방탈출은 「단서를 모아 문을 열어라」, 그 밖은 부제를 안 깐다. 재생 `scripts/qa/assistant-v2/titleAssemblyCheck.mts` · 그림 장면이 기본 왕국 오프닝뿐이면 오프닝을 끈다(청사진이 있으면 아래 기본 오프닝이 그 자리를 채운다).
- **타이틀 그림 고르기 규칙(2026-10-28 2판)**: 번들 그림은 장르·장소 낱말이 **강하게**(점수 ≥6) 맞을 때만 쓴다 — 공포 그림(초상화 복도·핏자국 빈 방·기괴)은 공포 장르에만, 그 밖에는 병원·사막·바다·하늘섬·설원·농장처럼 장소가 분명한 것만. 강하게 맞는 것이 없으면 **그 게임의 시작 맵(청사진 첫 장소와 이름이 같은 맵이 있으면 그 맵)을 도트 그대로 렌더한 화면** `map-view:<mapId>` 를 쓴다(방탈출 세 판이 모두 같은 핏자국 빈 방이 되던 것 → 각자 자기 방). 조선·무협·마법 학교·몬스터 수집은 낱말 검사 없이 바로 맵 화면이다. 런타임 `src/player/systemGraphics.ts applyTitleMapView` 가 `renderMapViewCanvas`(오프닝 맵 화면 배경과 같은 길)로 원 크기·안개 없이 그리고, `src/player/titleMapFraming.ts` 가 틀을 잡는다: 배율은 정수 1~2배(작은 방을 3배 넘게 늘리지 않는다), 그 배율로 화면보다 크면 가구·소품·이벤트가 가장 많은 창(시작 위치가 들면 가산), 작으면 가운데·둘레 검정. 위에 어두운 판(전체 비네트 + 글자 쪽 왼쪽 그라데이션)을 겹쳐 제목·부제·메뉴가 지붕·길과 섞이지 않게 한다. 비동기라 처음엔 검은 바탕, 다 그리면 `data-title-map-view-state="ready"`(배율 `data-title-map-view-scale`). 맵을 지우면(`remove_map`·편집기 삭제, `applyMapDeletions`) 그 맵을 가리키던 맵 화면 타이틀을 비우고, `remove_map` 은 같은 규칙으로 다시 고른다(전에는 무결성 검사가 삭제를 통째로 거절했다). 아직 빈 맵(단색)은 고르지 않는다 — 타이틀이 빈 시작 맵을 가리키면 빌더가 그 맵을 지우고 다시 짓는 `remove_map` 이 무결성 검사에 막혔다. 끝맺음 조립이 다시 고른다.
- **안 바꾸는 것**: 생성·업로드 그림, 연애 키아트, 저작자가 쓴 부제·로고 질감·직접 고른 번들 그림.
- **청사진 기본 오프닝(2026-10-28 3판)**: 장부·턴 기록의 오프닝 결함(장르와 무관한 프리셋 스틸, 회화풍 스틸 vs 도트 게임, 오프닝 없음·꺼짐)을 결정적으로 메운다 — `src/editor/tools/blueprintOpening.ts applyBlueprintOpening`. 청사진 쓰기(`write_blueprint`)와 끝맺음 조립(`assistantV2Runtime`) 둘 다 부르며, 시작 맵이 아직 빈 맵이면 건너뛴다. **바꾸는 경우만**: 오프닝 없음·장면 0·꺼짐, 전에 이 함수가 지은 것(장면 id `bp-open-N`), 그림이 전부 «이야기에 강하게 맞지 않는 번들 스틸»이나 캐릭터 시트뿐(`blueprintOpeningReplaceable`). 생성·업로드 그림·맵 화면·글 장면 오프닝은 모델이 만든 것으로 보고 둔다. **장면**: 연출 샷(384×216, 4.2초) 2~4개를 `OPENING_ANIMATIC_TOOLS`(create_opening_animatic_shot·place_opening_background·set_opening_caption) 그대로 불러 같은 검사를 거친다 — 시작 맵 전경(볼 것이 가장 많은 창, 시작 위치 근처면 생략) → 청사진 단계 장소 맵 1~2곳(같은 장소의 층 「…지하 1층/2층」은 하나만) → 시작 맵의 주인공 시작 위치(줌 2, 작은 방은 오린 자리가 전경과 32px 칸까지 같으면 더 당기거나 전경을 반대쪽 끝으로 옮긴다 — 도구가 같은 배경 재사용을 거절한다). 마지막 장면이 끝나면 런타임이 시작 위치로 들어간다. 도중에 도구가 거절하면 원래 오프닝으로 되돌린다(반쯤 지은 오프닝 금지). **글(새 모델 호출 없음)**: 목표(playerGoal)는 첫 장면, 첫 단계 행동은 가운데, 첫 단계 느낌+「…」은 마지막 장면. `narrationLine` 이 괄호·영문 id 를 빼고 「4자리」「지하 2층」 같은 수량을 덜어 내며, 그래도 숫자가 남거나 숫자·힌트·정답·「암호는/비밀번호가」·컷신·스위치·이벤트·플레이어 낱말이 든 문장은 버리고, 「게임이 시작되면」 머리를 지운 뒤 46자로 자른다.
- **오프닝에 캐릭터 시트 금지**: `set_opening`/`edit_opening` 의 그림 장면과 연출 배경 층(`build_opening_animatic` 포함)에 걷기 칩(charset)·전투 칩·얼굴 시트(faceset)·전투 그림을 넣으면 거절한다(`characterSheetKind` — 업로드 kind, 번들 캐릭터 목록, id 의 charset/faceset 낱말). 시트 한 장 통째가 화면 가득 늘어나던 것을 막는다. 인물은 흉상·전신 그림이나 맵 장면으로.
- **격자선 스틸**: `oprn-still-manor-night`(저택 회랑) 그림에 약 78px 간격 격자선이 박혀 있어 `suitableForOpening:false` 로 뺐다(오프닝 프리셋 두 곳도 다른 스틸로). 고친 그림이 오면 되돌린다.
- **시간대 어긋남**: 출하 막힘 `assembly-time-mismatch` — 청사진(제목·목표·첫 단계), 타이틀 부제, 오프닝 첫 «지금» 장면(「…전」「그날」 같은 회상 장면은 뺀다)의 시간(아침·낮·저녁·밤)이 두 칸 이상 어긋나면 막는다(부제 「첫날 밤」 vs 오프닝 「입학식 날 아침」).
- **출하 기본값 채우기(2026-10-29 vm1)**: 싼 모델이 끝내 못 고친 출하 검사 열(`battle-bgm`·`battle-background`·`party-faces`·`hero-look`·`party-names`·`window-look`·`game-over`·`entrance-off-art`·`ending-closure`·`default-place-leak`)을 끝맺음 조립이 `src/ai/v2/shipDefaults.ts applyShipDefaults` 로 결정적으로 채운다(`applyBlueprintAssembly`·기본 오프닝 뒤, 같은 체크포인트 `blueprint_assembly`). 무엇이 남았는지는 출하 검사 함수(`editorDefaultsLeft`·`endingClosureProblems`·`defaultPlaceLeaks`·`offArtEntrances`) 자체로 판단한다 — 검사가 짚지 않으면 아무것도 안 바꾼다(모델이 고른 값은 그대로). **전투 곡**: 이 프로젝트에서 재생되는 음악 목록(`listAudioResources`)의 전투 곡 중 편집기 기본이 아닌 것, 마왕·공포 이야기는 어둡고 묵직한 곡 먼저, EasyRPG 곡은 마지막. **전투 배경**: 배경 없는 전투 맵에 런타임 `resolveBattleBackdrop` 의 맵 단계 순서(기후 → 던전·동굴 → 장소 이름 → 실내 칩셋)로 고른 값을 맵 `battleBackground` 로 적는다. 아무것도 못 고르면 들어오는 길(이동 명령 + 청사진 단계 순서)을 거꾸로 따라 가장 가까운 던전·동굴 조상의 배경(argon/jrpg 「마왕의 방」 → 「마왕의 동굴」 → 동굴), 없으면 바로 들어오는 맵의 배경, 그것도 없으면 숲. **파티**: 편집기 기본 칩이면 이름·청사진 이야기 낱말(마법·기사·마왕·소녀…, 여성 낱말이면 여성 칩)로 공용 칩을 고른다 — 짝 얼굴이 검토된 칩만, 그 짝 얼굴도 같이. 칩은 모델이 골랐고 얼굴만 기본이면 그 칩의 짝 얼굴, 짝이 없으면 얼굴을 비운다. **엔딩 맺음**: 부족한 것만 — 줄이 모자라면 청사진 `ending.how`·`feeling`·마지막 단계 행동, 인물 매듭이 없으면 「<주인공>은 <첫 장소>에서 시작한 이 여정을 끝까지 걸어냈다」, 그림이 없으면 이야기 종류별 맺음 스틸(강하게 맞는 번들 그림 → 설원·사막·공포·판타지·추리·학교/탈출·농장 → 농장). 엔딩 화면은 `map-view:` 를 못 그리므로 스틸만 쓴다. **기본 지명**: 제목·엔딩 이름·맺음 글의 「버들항」을 첫 장소에서 지명을 뺀 보통 이름(「마을」)으로 바꾼다. 제목이 보통 이름 하나만 남으면 고친 엔딩 이름으로. 맵 이름은 그대로 둔다. **파티 이름**: 편집기 기본 이름(「주인공」)이면 칩 이름표·이야기 낱말의 성별로 이름 목록(남 도윤·하람·이안·시온·태오·라온 / 여 서린·유하·아린·하은·소이·나래)에서 청사진 제목+인물 id 해시로 하나, 다른 인물·이벤트 이름과 겹치면 다음. 모습 뒤·엔딩 맺음 앞에 돈다. **창 모양**: 대사창 룩·창 스킨·메뉴 모양 어느 것도 안 골랐으면 ESC 메뉴 모양 `menuUiStyle` 만 고른다 — 추리·탈출·공포는 `journal`, 싸우는 판타지는 `classic`, 그 밖은 `field-list`. **게임 오버**: 공포는 `horror` 「붙잡혔다」, 그 밖은 `classic` 「쓰러졌다」, 본문은 주인공 이름으로 한 줄(`normalizeGameOverSettings`). **입구 그림**: `offArtEntrances`(출하 검사와 같은 판정)가 짚은 이벤트를 그림 칸으로 옮기고, 그 칸이 막힌 칸이면 모든 페이지를 `priority:'same'`·겹침 금지로(부딪혀 열림). 다른 맵에서 그 칸으로 도착하는 이동이나 시작 위치가 그 칸이면 옮기지 않는다(밟자마자 되돌아가는 왕복). 장소 이름이 칩셋 id 같은 영문 슬러그(`beodeul_city`)면 `blueprintPlaceName` 이 장소로 치지 않는다(타이틀 「beodeul_city 탈출」).
- **끝맺음 순서 한 곳(2026-10-29 vm1 재생)**: 마지막 차례의 자동 짓기는 `src/ai/v2/finishAutoBuild.ts` `runFinishAutoBuild` 하나다 — 런타임(`scripts/lib/assistantV2Runtime.ts` autoBuild)과 재생 스크립트 `scripts/qa/assistant-v2/finishReplay.mts` 가 같은 함수를 부른다(순서: 장소 짓기 → 청사진 경로(열쇠 문·단계 전투·**못 이기는 단계 전투 맞추기**·회복) → `clearLanes` → 온 게임 요청이면 `applyBlueprintAssembly` → 기본 오프닝 → `applyShipDefaults`). 재생은 `--followup "<후속 요청>"` 으로 첫 요청과 후속을 런타임처럼 합친 과제를 쓴다(첫 요청만 쓰면 「…RPG 만들어 줘」가 `wantsWholeGame` 에 안 걸려 조립·출하 검사가 통째로 빠졌다). 결과에 출하 막힘(`shipBlockers`) 열이 있다.
- **단계 전투 맞추기**(`blueprintPath.ts` `fitUnwinnableStepBattles`): 청사진 단계 맵의 길막 전투(도망 불가·보스/마왕 이름)를 시작 파티(최고 초기 레벨)로 12번 모의 전투해 승률이 0.5 미만이면 `fitTroopCopy(...,"boss")` 사본으로 바꾼다. 몬스터 파티 게임은 건너뛴다(argon/flash jrpg: 맞추지 않은 마왕에게 승률 0%).
- **지난 목표·죽은 엔딩 조건**(`shipDefaults.ts`): `staleMilestoneTargets`(목표를 안 바꾸는 이정표 이벤트, 엔딩 제외)가 짚은 이벤트에 다음 청사진 단계 이벤트 이름(없으면 그 이정표를 읽는 첫 이벤트 이름)으로 「…을/를 찾아가자」 목표를 붙인다(deepseek/jrpg `objective-missing`). 새 출하 검사 `ending-condition-unset`(`shipChecks.ts endingConditionsUnset`): `triggerEnding` 이 겨누는 엔딩의 스위치·변수 조건을 아무 명령도 안 켜면 막힘 — 고치기는 그 조건만 지운다(`dropDeadEndingConditions`, flash/escape `switch_escape_success`). 「켜는 곳」은 페이지 조건·fork 조건 밖의 명령과 시작 세션 값이다(`writtenStateIds`).
- **시작 칸 틈**(`exitDress.ts closeGaps`): 막다른 틈을 메울 때 시작 위치가 그 틈 위면 가장 가까운 지나갈 수 있는 빈 칸(이벤트·틈 아님)으로 시작을 옮긴다(terra/escape: 시작이 벽에 묻혀 `start-position-blocked`).
- **빈 껍데기 맵 치우기**(`blankStart.ts retireOrphanMaps`, 끝맺음 `clearLanes` 의 `sealEscapeExits` 바로 뒤): 이벤트도 들어오는 이동도 없는 맵(게임 점검 `orphan-empty-map`)을 지운다 — 같은 이름의 쓰는 맵이 따로 있거나(장소를 두 번 지은 빈 사본: vm1 argon/jrpg 「시작 마을」·「마왕의 방」, flash/mystery 「2층 객실」) 청사진 장소가 아닌 맵(탈출 봉인이 끊은 argon/escape 「밀실 뒷방」)만. 그 이름의 유일한 청사진 장소 맵은 남긴다.
- **번호 단계 판별 넓힘**(`blueprint.ts isCodeStep`): 이름·행동에 「비밀번호 입력」류 낱말이 없어도 `needs` 가 번호·암호 단서이고 행동이 여는(열·풀·번호) 단계면 번호 단계다(vm2 flash 「금고 열기 — 단서를 조합해 얻은 번호로 금고를 연다」 needs 「비밀번호 단서」 → 조사만으로 열쇠가 나왔다). 그러면 `blueprint-code-bypass` 로 경로 빌더가 금고를 번호 입력 고리로 다시 짓는다. 앞 단계 단서 이벤트를 그대로 두는 경우엔 따로 쪽지를 세우지 않고 그 이벤트의 얻는 페이지 대사에 「<단서>: 네 자리 숫자 「NNNN」가 적혀 있다」를 넣는다(`tellCode`). 그대로 둔 이벤트의 「X 조사를 살펴보았다」(이름 그대로)는 「X를 살펴보았다」로(`lookLine`·`fixLookLines`).
- **방탈출 출구를 남쪽 벽 틈으로**(`exitDress.ts southExitDoor`): 방탈출에서 문 노릇 이벤트가 그림 없는 칸이고 북벽 발치에 문 그림 자리가 없으면(가구로 꽉 참), 남쪽 벽 틈(없으면 바닥과 맞닿은 남쪽 띠 한 칸을 바닥으로 튼다 — 가운데에 가까운 칸)에 문 이벤트를 옮기고, 칩셋에 `doormat` 이 있으면 틈 앞 바닥에 깐다. 틈의 시작 칸은 틈 앞으로, 조용한 시작 목표 이벤트는 문이 있던 자리로. 옮겨서 다른 조사 칸이 닿지 않게 되면 하지 않는다. vm2 terra 「멈춘 시계의 방」: 잠긴 출구 (1,6) 구석 → 남쪽 틈 (3,7)(판정자가 출구로 본 통로), flash 「잠긴 방」: 방 한가운데 보이지 않던 문 (5,4) → 새로 튼 남쪽 틈 (4,8). 북벽 쪽은 gamepath 작업자 미완 변경을 얹었다 — 방탈출이면 남쪽 틈이 없어도 출구가 안 보일 때 북벽 문을 찾고, 바닥에 선 옛 문 그림을 걷고, 북벽 발치의 한 칸 소품을 출구가 있던 칸으로 옮겨 그 자리에 문을 세운다(조사 칸이 막히면 되돌림).
- **도구 인자 관대화**: `set_opening` 은 `scenes` 가 필수가 아니다 — `{enabled:false}` 는 지금 장면을 둔 채 끄고, 장면 하나를 객체로 보내도 받으며, 장면 없이 꺼져 있던 오프닝에 새 장면을 주면 켠다. `"false"` 글자도 받는다(argon 「같은 인자 모양 오류 7번」). `set_title_screen` 은 `bgm:`·`picture:` 머리를 떼고 대소문자를 맞추며, `backgroundResourceId:""` 는 청사진 그림으로 바꾼다(지우기만 하면 시스템 기본 눈 마을이 다시 나왔다). 없는 id·못 쓰는 그림 오류는 청사진 그림 id 를 한 줄로 알려 준다.

## 모델 호출 무응답 한도·고치기 차례 상한 (2026-10-29 vm1 argon)

- **호출 단위 무응답 한도**(`src/ai/piAgent/providerRetry.ts` `modelStallLimits`·`withModelStallLimits`, 적용은 `scripts/lib/piAgentRuntime.ts` 의 streamFn):
  첫 이벤트 `OPRN_MODEL_FIRST_EVENT_TIMEOUT_MS`(기본 180000) · 이벤트 사이 `OPRN_MODEL_IDLE_TIMEOUT_MS`(기본 90000) 를 호출 옵션으로 넘긴다(pi-ai 는 호출 옵션을 환경 변수·모델 compat 보다 먼저 본다).
  이미 정해진 값보다 짧을 때만 줄이고, 0 이면 우리 상한 없음. 사용자 지정(openai-compat:*) 엔드포인트는 늘 씌운다 — 엔드포인트 「첫 토큰 대기」 600초가 토큰 사이 감시까지 10분으로 늘려 호출 하나가 10분씩 잡혔다.
  다른 제공자는 OPRN_MODEL_* 를 명시했을 때만. 감시가 끊은 호출(「timed out while waiting for the first event」·「stalled while waiting for the next event」)은 같은 기록으로
  `OPRN_MODEL_STALL_RETRIES`(기본 2)번 다시 요청(`provider_stall_retry`)하고, 그래도 조용하면 차례를 실패 문장으로 끝낸다(`provider_stall_giveup` + error — 적용한 변경은 남는다). 확인: `bun scripts/qa/model-stall-probe.mts`(헤더만 보내고 침묵하는 가짜 끝점).
- **화면 검수 고치기 차례 상한**(`src/ai/v2/vqaFixBudget.ts`, 실행기가 v2 도구 실행 앞에 낀다): 고치기 지시를 낸 차례마다 쓰기 도구 `OPRN_V2_VQA_FIX_MAX_CALLS`(12)회 · `OPRN_V2_VQA_FIX_MAX_MS`(600000) ·
  같은 도구+같은 인자 실패 `OPRN_V2_VQA_FIX_SAME_FAILS`(2) · 같은 도구 실패 `OPRN_V2_VQA_FIX_TOOL_FAILS`(4). 넘으면 실행하지 않고 «남은 결함으로 보고하라» 거절을 돌려주며 `v2.vqa.fix_cap` 을 한 번 남긴다.
  읽기 도구(inspect·list_·find_·get_·read_)는 세지 않는다. 판 사이 반복은 기존 `vqaActionable`(두 판 연속 그대로 = stuck)·`VQA_MAX_ROUNDS` 가 막는다 — 이 상한은 **한 차례 안**의 반복이다
  (vm1 escape 001: 1판 결함 6건 뒤 고치기 차례 하나가 move_object 를 20번 넘게, 반은 같은 「길이 막혀 되돌림」 거절로 부르며 45분 상한까지 갔다).
- **결정 카드와 글 답**(`src/harnesses/assistant-capability/node/wholeGameSession.mjs`): 맵 소실 확인 같은 결정 카드는 글로 답할 수 없다. 카드가 열린 채 `.txt` 가 오면
  하네스가 먼저 「그만두기」(내용을 지우지 않는 쪽)를 누르고 보낸다. 그전에는 실행이 카드 단추를 기다리며 체크포인트 적용을 30분 잡고(`piCheckpointBroker`),
  보낸 글은 그 뒤에 갇혀 다음 턴이 0블록으로 45분 멈췄다(vm1 argon escape 003→004·jrpg 003→004 — 「모델 무응답」으로 보였던 턴의 실제 원인).

## 켜는 법

- 편집기 주소 `?assistant=v2`, 또는 `localStorage['oprn:assistant-v2'] = '1'`(`src/ai/v2/switch.ts`). `?assistant=v1` 이나 `'0'` 이면 끈다. **기본은 v1** — 기본을 바꾸는 것은 사용자 결정이다.
- 켜면 `aiPiAgentCommand.runPiCommand` 가 요청에 `assistantVersion:"v2"` 를 싣고 계획 턴을 건너뛴다. `aiChatPanel.plainPiTurn` 은 의도 분류 LLM 호출을 건너뛴다(v2 모델이 직접 해석).
  팀·목표·다듬기 모드는 v1 그대로 간다. 끝의 조화 검수(harmony review)도 v2 에선 끈다 — 비평가가 대신한다.
- 워커(`scripts/oh-my-pi-worker.ts`)는 `assistantVersion === "v2"` 면 `scripts/lib/assistantV2Runtime.ts runAssistantV2` 로 보낸다.

## 구조 — v1 실행기를 그대로 쓴다

`runAssistantV2` 는 v1 `runPiAgent` 를 부르되 `options.v2` 갈고리(`src/ai/v2/env.ts`)를 준다:

- `toolNames: ["__assistant_v2__"]` + `initialToolNames: []` → 레지스트리 도구 0개 노출. 대신 v2 동사 8개(`verbs.ts`):
  `make_place · edit_place · add_people · add_event · draw_object · place_object · inspect · ask_user`.
- 동사 인자 중 감싸는 칸 하나(`make_place` 의 spec, `add_people` 의 people 등)는 `src/ai/v2/flatWrapper.ts` 가 최상위로 펴 보여 주고 실행 직전에 다시 감싼다. 예전에 감싸 보낸 호출도 통과한다. 목록과 최상위 칸이 같이 오면, 필수 칸이 찬 최상위는 한 명 더로 붙이고, 한 명짜리 목록의 빈 칸은 채우며, 필수 칸이 빈 찌꺼기는 목록 전체를 거절하지 않고 버린다. 객체 칸은 최상위 값으로 빈 자리를 채우고, 이미 감싼 값이 있으면 그 값을 남긴다.
- 동사는 `wrapTool` 을 거친다 → 체크포인트·실시간 시공 재생(constructionLogs)·맵 소유권·맵별 대기열·사용량 집계·로컬 CLI 엔진이 v1 과 같다.
  동사 안에서 `env.checkpoint` 로 **첫 짓기를 비평 전에** 편집기에 싣는다(사용자는 비평을 기다리지 않는다).
- `options.v2` 가 있으면 v1 의 낱말별 지시(regex system prompt)·몬스터/오프닝 제작·완료 검사·배치 품질 권고·특징 확인표가 꺼진다. 없으면 v1 은 한 줄도 달라지지 않는다.
- 시스템 지시(`prompt.ts`) = 역할·고리·규칙 + 지식 카드 7장(실내·마을·던전·일본 도시·사람·사건·없는 물건, 각 ≤900자) + 지금 프로젝트 맵 목록. 약 5천 자.
- 비평가는 `env.sideChat`(= v1 `eventAssistChat`, 같은 모델) — 사용량은 `stats.review` 로 따로 모인다.
- 끝맺음 관문(`v2FinishGate`): 고칠 수 있는 major·기계 실패가 남은 장소가 있으면 한 바퀴 더 돌게 한다.
- 빈 자리표시 시작 맵(`isPlaceholderMap`)을 `edit_place` 로 「고치려」 하면서 구역(`addZones`)을 주면, 고칠 장소가 없으니 그 패치로 그 맵 자리에 실내를 `make_place` 로 짓는다(2026-10-29 방 과제: 10개 중 4개가 edit_place(map_blank_start) 실패 한 번으로 빈 맵인 채 끝났다).
- 고치기가 더 나쁘면 되돌린다: `edit_place` 뒤 (기계 실패 + 비평 major) 수가 앞보다 늘면 앞 프로젝트로 되돌리고 `reverted:true` 를 돌려준다(바퀴는 쓴 것으로 센다).
- 마을·던전·거리 빌더는 소품 하나하나·`dressing` 을 받지 않는다 — 그런 패치는 바퀴를 쓰지 않고 거절한다(같은 맵이 또 나와 바퀴만 쓰던 것).
- 실패한 동사·예외도 `guard` 가 tool_end 에 ok:false·이유로 싣는다.

## 빌더가 하는 것 / 못 하는 것

- 실내(`builders/interior.ts`, 손 도트 v5 — 주인공 물건이 고른 칩셋보다 v5 에 더 많이 있으면 v5 로): 방 종류 낱말 → layout, 주인공 물건(부품 사전 낱말, 「큰」은 가장 큰 것) 자리 찾기·견본 가구 밀어내기·도달 재검사,
  빈 바닥 덩이를 방 쓰임 한 벌로 메우기(≤15%), 올라가는 계단 → 위층(남쪽 출구 없음)·양방향 이동, 계단은 맨 북쪽 바깥 벽 방에, `dressing` 아늑하게.
  장소 견본(`builders/interiorVenues.ts`): 이름·구역 낱말이 천문대면 『폴른 스타』 r28 관측 홀(둥근 지붕·큰 망원경), 선술집·주점·여관이면 통나무 벽·널마루 홀(바·벽난로·식탁·계단).
  견본 고르기는 그 방 종류 맵 → 이국 맵(zozo·카지노·광산…) 아닌 것 순(선술집이 zozo 돌바닥으로 지어졌다).
  북쪽 출구(`exits:["north"]`·「북쪽 뒷문」): 맨 북쪽 방 북벽 발치에 `locked door`(쇠띠 나무문, 서 있는 문 그림)를 놓고 벽면에 `round arch` 문틀을 함께 걸어(문만 두면 벽장처럼 읽혔다) 작은 뒷방을 지어 양방향으로 잇는다. 동·서 출구는 못 함(보고됨).
  요청한 주인공 물건이 최종 맵에 없으면 `anchor-missing` 실패 검사로 센다(되돌리기·완료 관문에 걸린다).
- 마을(`village.ts` → `author_beodeul_town`), 던전·동굴(`dungeon.ts` → `author_dungeon`), 일본 도시 거리·집(`jpCity.ts` → `compose_jp_city_street`·`compose_jp_region`·jp 실내).
  주택가·골목 요청(상가 낱말 없음)은 소품이 다 안 들어가도 상가 짜임으로 넘어가지 않는다. 씨앗 고르기에서 공원은 소품 셋 무게.
  시작 맵 위에 마을을 지을 때 `author_beodeul_town` 은 시작 칸을 통행 보장 칸으로 두지 않고 짓는다(칠하기 도구가 그 칸만 물을 건너뛰어 강 속 풀밭 네모가 남았다),
  다 지은 뒤 시작 칸이 막혔으면 `openStartCell`(`startOnBuiltMap.ts`)로 옮긴다. 시작 칸이 큰 땅 밖이면 `fixPlayerStart` 도 같은 함수로 옮긴다 —
  옛 시작 칸에 가까운, 맵 끝 두 줄 밖의 사방 트인 칸(이벤트 바로 위·아래 칸 피함). 예전 「아래 가운데」 끌기는 맵 맨 아랫줄에 세워 주인공 발이 화면 끝에 걸렸다(2026-10-29 야외 VQA).
  사람 자리(`resolveWhere`)는 시작 칸 바로 위·아래 칸을 쓰지 않는다(3/4 에서 몸이 겹친다).
  마을은 집이 서면 「완성된 집 보호」로 AI 가 다시 지을 수 없다 — 그래서 집 수(houseCount)는 짓기 전에 사본 위에서 씨앗 다섯 개를 시험해 고른다.
  던전 다시 짓기는 사본 위에서 통째로(위층 지우기 → 1층 `rebuild:true` → 성공할 때만 반영). `variant` 는 씨앗을 민다. 요청한 적 낱말은 적 그룹 이름과 맞춰 `troops.field` 로,
  도구가 보이는 적을 0 마리 놓았으면(작은 동굴) 입구에서 먼 칸에 `place_field_enemy` 로 서너 마리를 세운다.
  테마 낱말(숲·독늪·화산·얼음·피라미드·마법사의 탑·이세계/마계 …)은 도구의 던전 `type` 14가지로, 함정→`gimmick:sandpit`·늪/화산→`bridge`·얼음→`iceslide`. 탑은 위로, 나머지는 아래로 내려간다(피라미드 보스는 맨 아래층).
  요청한 적·보스 낱말은 같은 그림 복제 적(`upsert_enemy`/`upsert_troop`, 도구가 쓸 세기로 맞춤)으로, 보스는 필드 적·층 수문장과 다른 그림만. 지은 뒤 층마다 보이는 적 3마리(탑 2), 마지막 층 가장 깊은 곳(보스 방)에 상자.
  레버 장치는 레버를 요청할 때만(통로 가운데 쇠창살 조각의 원인). 씨앗 4개(여러 층 3개)를 사본에서 지어 다리·장치·적·상자 수가 가장 맞는 것을 고른다.
  보스는 그림 배율 2.5배(`graphic.scale`, `scaleMode:auto`)에 몸 3×2(`footprint`, `passRows:1` — 발밑 한 줄만 막음)로 크게 그린다. 몸 여섯 칸이 빈 바닥이고 발밑 줄을 막아도 전에 닿던 칸이 다 닿는 자리여야 하며,
  안 되면 보스방 안 가장 가까운 자리로 `move_event`. 장치로만 이어지는 보스방은 보스 덩이 안 가장 먼 칸에서 잰다. 층 수문장은 길목을 지키므로 옮기지 않고 그 자리에 맞을 때만 2배.
- 몬스터 수집 첫 마을(`builders/monsterTown.ts`, `style:'monster'`): v1 `build_monster_game`(빈 프로젝트 전용, 지연 재료는 `PlaceBuilder.prepare` 로 기다림)을 `gymCount` 기본 1(맵 19개)로 부르고,
  첫 마을 묶음(마을·북쪽 1번길·연구소·센터·집·도구점·2층)만 결과·비평 대상으로 돌려준다. 맵 이름을 「주인공의 집」「몬스터 센터」로, 첫 길 이름을 마을 이름에 맞추고, 생성기 기본 주민 넷을 뺀다(마을 사람은 `add_people`).
  뒤 캠페인도 함께 생기는 것은 경고로 보고한다. 다시 짓기·고치기는 못 한다. 연구소 겉모습은 일반 집 키트(지붕 색만 다름) — 칩셋에 연구소 건물 키트가 없다.
- 조선(`builders/joseon.ts`, `style:'joseon'`, 빌더 목록 맨 앞, 2026-10-28): 「조선 시대 한양 사극」 요청에 모델이 `style:"joseon"` 을 줬는데 마을 빌더가 style 을 안 보고 버들항 유럽식 목조 마을을, 주막·포도청은 판타지 실내 v5 를 지었다.
  이제 `make_place`·`make_game` 이 원문 요청·명세에 조선 낱말(조선·한양·사극·고려·한옥·양반·저잣거리·포도청·관아·동헌·사또·주막·암행어사·바람의나라)이 있으면 style 을 `joseon` 으로 바꾼다(`localizeCultureSpec` — style 이 fantasy 여도. 마법 학교·센고쿠·일본·현대·몬스터·무협 style 은 그대로).
  조선 칩셋으로 한 장을 짓는 결정론 경로는 등록 장소뿐이라 낱말로 하나를 골라 `import_region_reference` 한다: village/street → 이름이 성·도성이면 국내성(96×96), 촌·시골이면 마을 20호(64×56), 아니면 요청 원문 해시(`hints.requestKey`)로 둘 중 하나 — 게임마다 다르고 같은 요청은 같다(이름·테마에 저잣거리·장터·시장이면 `dress_joseon_market` 좌판), interior → 주막·관아(포도청·동헌)·대장간·약방·서당·궁 어좌전·침전·회랑·서고·민가(이름 낱말 먼저), cave/dungeon → 동굴, 이름에 사냥터·들판 → 사냥터.
  빈 시작 맵은 같은 id 로 다시 쓴다(시작 위치는 남쪽 가운데 걸을 수 있는 칸). 방 여러 개(주막 + 뒷방)는 둘째 구역부터 등록 방을 새 맵으로 가져와 첫 방의 북벽 밑 걸을 수 있는 칸(들어오는 칸에서 먼 순)과 그 방의 들어오는 칸을 `create_transfer_pair` 로 잇는다. 등록 방은 종류마다 한 장뿐이라 방 그림은 판마다 같다. 주인공 물건은 등록 방 가구 그대로다(경고). 조선 지식 카드는 조선 낱말이 있거나 지금 맵이 joseon_baram 일 때만 싣는다.
  같은 함수가 일본 현대 낱말(일본·도쿄·오사카·교토…, 센고쿠·에도 낱말이 없을 때)이 있는 village 를 `jp-modern` 으로 보내 일본 빌더가 짓게 한다. 무협(무림·강호·객잔·문파)은 전용 칩셋이 번들에 없어 마을·실내가 버들항·v5 로 지어지고 missingArt 로 알린다.
- 마법 학교(`builders/wizarding.ts`, `style:'wizarding'`, 조선 다음·실내 빌더 앞, 2026-10-28): 요청·명세에 마법학교·기숙사·호그와트·마법 수업·퀴디치 낱말이 있으면 실내·마을 명세의 style 을 `wizarding` 으로(`localizeCultureSpec`, 명세 낱말이 요청 낱말보다 먼저).
  구역(방)마다 `build_wizarding_space` 한 번 — 공간은 이름 낱말로: 휴게실·기숙사 침실·복도(shared 변형)·연회장/입학 홀·마법약 교실(교실·수업)·도서관(서재·연구실)·병동·온실·부엉이 탑·천문탑/시계탑(clocktower)·우체국·지팡이 가게·과자점 창고·퀴디치·호수·숲 마차, 일반 「홀」은 맨 뒤. 첫 방은 장소 이름이 먼저(「천문탑 관측실」).
  첫 방에 남문(정문) + 다른 방 셋까지 북·동·서 문을 내고 다른 방의 남문과 `create_transfer_pair` 로 잇는다(넷째 방부터는 경고). 시드는 요청 해시, density 는 size.
  주인공 물건은 세트 기물 이름으로 찾아 `furniture` 로 먼저 놓고, 없으면 가장 가까운 기물로 바꿔 경고한다(망원경 → 검사 열람대, 별자리표·지도 → 양피지 기록 탁자). 판타지 v5 로 도망가지 않는다 —
  예전에는 「주인공 물건이 v5 에 더 많으면 v5」로 학교가 통나무 여관풍이 됐고, wizarding_world 로 방 종류 견본을 지으면 가구 없는 빈 돌방 다섯이 섰다.
- 두 선택 대화 장면(`scene.ts`, 동사 `add_scene`): 확정 연애 기획(romance-scene 계약)이 있으면 `author_romance_scene` → 상대 그림을 짝 얼굴 칩으로 바꾸고 상대 줄 앞에만 얼굴(`withSpeakerFaces`, 주인공 줄은 얼굴 지움) → `inspect_romance_scene`.
  현대 무대(일본 도시·학교 칩셋)인데 주인공이 판타지 기본 걷기 그림이면 `upsert_actor` 로 남학생 칩(짝 얼굴 포함)으로 갈아입힌다(외형 프리셋을 쓰는 배우는 그대로).
  계약이 없으면 `place_npc` 한 번(첫 대화 + 선택별 반응·자기 스위치 A/B + 선택별 재대화 쪽)을 세우고 `runSceneTest` 로 두 선택·재대화를 돌린다. 출하 플레이어 확인 `scripts/qa/runtime/v2-romance-scene.scenario.mjs`.
- 조건 카드: 몬스터 마을 카드는 요청 낱말(포켓몬·몬스터 수집·연구소…)이나 보는 맵이 몬스터 계열일 때, 대화 장면 카드는 연애 계약이 있거나 요청에 대화 장면·선택지·고백 낱말이 있을 때만 싣는다(`prompt.ts conditionalCards`, 각 ≈420자).
- 사람 그림: 장르 잠금이 강제 중이면 허용 칩만 고른다. 「몬스터 수집」 꼬리표는 적 낱말로 보지 않는다(Scarloxy 주민 칩이 통째로 빠져 할아버지가 소년 그림이 됐다). 바깥 맵에서는 같은 부름의 사람끼리 바로 옆에 세우지 않는다.
- 사람(`people.ts` → `place_npc` 두 쪽: 첫 대화 → 자기 스위치 → 다음 대화), 자리 낱말(입구·광장·문 앞)을 걸어 닿고 길을 막지 않는 칸으로.
  바깥 맵 사람은 길(칸 이름표·태그로 판정한 길 칸) 위보다 길가를 고른다(점수 +8).
- 사건(`events.ts` → `script_cutscene`, 게임 시작 자동 1회), `probeCutscene` 문제를 경고로.
- 없는 물건(`drawObject.ts` → `generate_missing_object`): 그리기 카드만 띄운다(`draw_object` tool_end 가 카드를 연다 — `aiStoreCard.ts STORE_CARD_TOOLS`). 그린 뒤 후속 지시는 `place_object` 로 놓는다.
- 이미 있는 실내를 고칠 때(v2 기록 없음): ① 방 종류만 / 종류+크기로 다시 지어 네 층 타일이 원래와 **똑같으면** 그 인자에서 고친다(`adoptExactInterior` → `interiorEditFromArgs` — 견본 가구 비키기·뒷문 자리가 된다).
  ② 다르면 다시 짓지 않고 덧찍는다(`builders/interiorEdit.ts` — 빈 바닥 덩이에 쓰임 한 벌 `stamp_object`, 길 막으면 되돌림). 어느 쪽이든 바닥·벽 재질은 원래 것.
- 컷신 걷기는 실제 통행 격자에서 런타임 길찾기(`planApproach`)로 따라가 본다 — 3걸음 미만·못 닿음이면 목표를 고치고 `cutscene-walk` 검사로 남긴다. 비평은 걷는 길의 프레임(최대 5장)을 본다(`critiqueStaging`).
- 자리 낱말(`resolveWhere`): 방 이름(홀·부엌…), 「X 옆/앞/뒤」(칸 이름표로 물건 찾기), 한쪽·벽 쪽·북/남/동/서쪽 벽·구석·창가·가운데.

## 시험

- 모델 없이 빌더: `bun scripts/qa/assistant-v2/builders.mts <out> [caseId]` (사례 `builderCases.ts`).
- 모델 없이 동사: `bun scripts/qa/assistant-v2/verbs.mts <out> [--critic]`.
- 사람·사건·물건: `bun scripts/qa/assistant-v2/content.mts`.
- v1/v2 비교: `space-craft` 하네스의 `compare` 분류(cmp-monster-town·cmp-romance-scene 포함 — 연애 사례는 `startBrief` 로 확정 기획·계약 씨앗까지 심는다)(`harness-data/space-craft/seed.json`, `startBuild` 로 「이미 있는 맵」 시작 상태),
  ai-config `local-claude-sonnet-high.json`(v1) / `local-claude-sonnet-high-v2.json`(v2, `assistantVersion:"v2"` → 하네스가 스위치를 켠다).

## v1 비교 결과 (2026-10-23, 코드 e06766bd8d)

같은 모델(로컬 CLI Sonnet 5.5 high, Argon 할당량 막힘 → 둘 다 «조수 대용»), 실제 입력창, 사례마다 새 프로젝트, 저장 재로드 10/10.
점수는 v1/v2 를 모르는 Opus 검수자 둘이 A/B 1배 그림으로(같은 사례는 같은 검수자). 보고서 `~/claude-viz/assistant-v2-report.html`.

| | v1 | v2 |
|---|---|---|
| 눈가림 평균(10점) | 6.7 | 5.5 (v1 6승·v2 3승·무 1) |
| 조수 시간 합 | 38분 | 20분 (큰 실내 9~11분 → 2~3분) |
| 토큰(본+비평, 캐시 포함) | 15.0M | 0.82M |

v2 가 이긴 것: 마을(광장), 동굴(보이는 적), 던전(근소). 크게 진 것: 천문대(큰 망원경이 작은 것으로 밀림), 컷신(목표 칸이 집에 막혀 1~2걸음 — 미리보기 검사가 못 잡음),
방 고치기(북쪽 문 불가 + 다시 짓기에서 바닥이 돌로 바뀜). 선술집도 바닥이 돌이라 짐. **기본은 v1 유지.**
다음 손볼 곳: 「큰 ○○」 주인공 물건 지키기, 테마별 바닥 재질 고정, 컷신 걷기 경로를 실제로 따라가는 검사, 실내 북벽 문 그림, 자리 낱말(«홀 한쪽»), 역할에 맞는 NPC 그림·얼굴.
