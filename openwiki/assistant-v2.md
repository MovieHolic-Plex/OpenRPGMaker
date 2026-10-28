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
- 화면 검수 결함 나누기(2026-10-28 fix-gamepath, mt2 terra 1턴 575초 중 대부분이 고치기 반복 — 9→6→5→4→4, 남은 넷은 조명 막·타이틀 그림 잘림·화풍 차이인데 모델이 조명값만 바꾸며 돌았다): `vqa.ts` `vqaClassify` 가 결함마다 «동사로 고칠 수 있는가»를 낱말·대상으로 정한다. 모델 밖 = 검수 그림에 주인공 없음(`player-not-drawn`)·타이틀 그림에 제목/메뉴 없음(`shot-limit`)·오프닝 자막 크기(`runtime-text`)·화풍/시점 차이(`art-style`)·칩 배율(`sprite-scale`)·화면 배율/여백/잘림(`runtime-screen`)·HUD·맵 조명/분위기(`lighting`)·실내 출구 통로/문틀(`builder-exit`)·타일 짜임/빈 공백/격자(`builder-tiles`)·칩셋에 그림 없음(`missing-art`)·타이틀/오프닝 그림 자체의 잘림·구도·격자(`title-art`). 그 밖(가구 겹침·빈 방·물건·이벤트·대사·장르에 안 맞는 타이틀/오프닝 그림 고르기)은 고칠 수 있다. `vqaActionable(round, previous)` = fix(넘김) / ledger(모델 밖) / stuck(고칠 수 있는 종류인데 앞 판에도 그대로 — `vqaRepeated`). 고치기 지시·다시 시키기·고치기 머리글에는 fix 만 싣는다. fix 가 0 이면 `vqaShouldContinue` 가 멈추고 실행기가 남은 결함 보고 지시로 끝낸다(막음 연장 판도 fix 막음이 있을 때만). 모델 밖 결함은 실행 상태 `v2.vqa.outside` 「런타임/빌더 결함(모델 밖) [종류] …」로 한 번씩 남아 ai-activity 기록에 쌓인다(우리가 모아 고칠 목록). 남은 결함 수·출하 차단·최종 보고 목록은 장부로 뺀 것까지 그대로 센다(`vqaSummary` 는 「그중 모델 밖 N건」을 덧붙인다). 분류 표: 저장소 밖 `ledger/evidence/gamepath/06-vqa-classify.txt`(저장된 턴 기록의 실제 결함 52건: 고침 21·모델 밖 31).
- 화면 검수: 오프닝 프레임은 `bare:true`
  로 그려 「샷 id · ms」 글씨를 검수자에게 보이지 않는다(그 글씨를 세 판 내내 결함으로 짚었다).

### 2차 (2026-10-27, J98·J101~J106 — romance-j91·toy-j91 판정)

- **목표 줄 「어디」(J105)**: `set_objective` 가 글에 다른 장소 이름이 나오거나 `where`(이벤트·장소 id/이름)를 받으면 그 입구의 방위를 붙인다 — 「(지하철역 입구: 동네 거리 남동쪽)」(`discoverability.withWhere`, 맵 3×3 방위 `mapRegion`). 이름만 대고 방위가 없는 목표는 `objective-missing` 이 짚는다. `at:'start'` 는 시작 맵 자동 실행에 이미 있는 목표를 바꾼다(조건 달린 오프닝 페이지여도).
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
- **바꾸는 것(아무도 고르지 않은 값만)**: 기본 제목 → 청사진 제목 · 타이틀 배경이 편집기 기본(`oprn-title-field`)·부적합 스틸·하늘만 있는 배경 층(`oprn-pano-night` 등)·이야기에 없는 풍토(눈·사막·바다)·공포가 아닌 게임의 공포 그림·지난번 자동 맵 화면이면 다시 고른다(`pickBlueprintTitleArt`) · 로고 질감·부제가 없으면 부제 「장르 · 장소」(기본 문구를 숨긴다) · 그림 장면이 기본 왕국 오프닝뿐이면 오프닝을 끈다.
- **타이틀 그림 고르기 규칙(2026-10-28 2판)**: 번들 그림은 장르·장소 낱말이 **강하게**(점수 ≥6) 맞을 때만 쓴다 — 공포 그림(초상화 복도·핏자국 빈 방·기괴)은 공포 장르에만, 그 밖에는 병원·사막·바다·하늘섬·설원·농장처럼 장소가 분명한 것만. 강하게 맞는 것이 없으면 **그 게임의 시작 맵(청사진 첫 장소와 이름이 같은 맵이 있으면 그 맵)을 도트 그대로 렌더한 화면** `map-view:<mapId>` 를 쓴다(방탈출 세 판이 모두 같은 핏자국 빈 방이 되던 것 → 각자 자기 방). 조선·무협·마법 학교·몬스터 수집은 낱말 검사 없이 바로 맵 화면이다. 런타임 `src/player/systemGraphics.ts applyTitleMapView` 가 `renderMapViewCanvas`(오프닝 맵 화면 배경과 같은 길)로 원 크기·안개 없이 그리고, `src/player/titleMapFraming.ts` 가 틀을 잡는다: 배율은 정수 1~2배(작은 방을 3배 넘게 늘리지 않는다), 그 배율로 화면보다 크면 가구·소품·이벤트가 가장 많은 창(시작 위치가 들면 가산), 작으면 가운데·둘레 검정. 위에 어두운 판(전체 비네트 + 글자 쪽 왼쪽 그라데이션)을 겹쳐 제목·부제·메뉴가 지붕·길과 섞이지 않게 한다. 비동기라 처음엔 검은 바탕, 다 그리면 `data-title-map-view-state="ready"`(배율 `data-title-map-view-scale`). 맵을 지우면(`remove_map`·편집기 삭제, `applyMapDeletions`) 그 맵을 가리키던 맵 화면 타이틀을 비우고, `remove_map` 은 같은 규칙으로 다시 고른다(전에는 무결성 검사가 삭제를 통째로 거절했다). 아직 빈 맵(단색)은 고르지 않는다 — 타이틀이 빈 시작 맵을 가리키면 빌더가 그 맵을 지우고 다시 짓는 `remove_map` 이 무결성 검사에 막혔다. 끝맺음 조립이 다시 고른다.
- **안 바꾸는 것**: 생성·업로드 그림, 연애 키아트, 저작자가 쓴 부제·로고 질감·직접 고른 번들 그림.
- **오프닝에 캐릭터 시트 금지**: `set_opening`/`edit_opening` 의 그림 장면과 연출 배경 층(`build_opening_animatic` 포함)에 걷기 칩(charset)·전투 칩·얼굴 시트(faceset)·전투 그림을 넣으면 거절한다(`characterSheetKind` — 업로드 kind, 번들 캐릭터 목록, id 의 charset/faceset 낱말). 시트 한 장 통째가 화면 가득 늘어나던 것을 막는다. 인물은 흉상·전신 그림이나 맵 장면으로.
- **격자선 스틸**: `oprn-still-manor-night`(저택 회랑) 그림에 약 78px 간격 격자선이 박혀 있어 `suitableForOpening:false` 로 뺐다(오프닝 프리셋 두 곳도 다른 스틸로). 고친 그림이 오면 되돌린다.
- **시간대 어긋남**: 출하 막힘 `assembly-time-mismatch` — 청사진(제목·목표·첫 단계), 타이틀 부제, 오프닝 첫 «지금» 장면(「…전」「그날」 같은 회상 장면은 뺀다)의 시간(아침·낮·저녁·밤)이 두 칸 이상 어긋나면 막는다(부제 「첫날 밤」 vs 오프닝 「입학식 날 아침」).
- **도구 인자 관대화**: `set_opening` 은 `scenes` 가 필수가 아니다 — `{enabled:false}` 는 지금 장면을 둔 채 끄고, 장면 하나를 객체로 보내도 받으며, 장면 없이 꺼져 있던 오프닝에 새 장면을 주면 켠다. `"false"` 글자도 받는다(argon 「같은 인자 모양 오류 7번」). `set_title_screen` 은 `bgm:`·`picture:` 머리를 떼고 대소문자를 맞추며, `backgroundResourceId:""` 는 청사진 그림으로 바꾼다(지우기만 하면 시스템 기본 눈 마을이 다시 나왔다). 없는 id·못 쓰는 그림 오류는 청사진 그림 id 를 한 줄로 알려 준다.

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
  마을 도구가 시작 칸을 옮기지 않아 `fixPlayerStart` 가 큰 땅으로 옮긴다.
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
