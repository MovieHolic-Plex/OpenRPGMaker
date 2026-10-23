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
| 5 고치기 | 모델 → 빌더 | `edit_place` 패치(구역·주인공 물건 near·크기·variant·dressing)로 같은 빌더를 다시. 맵당 3바퀴. |
| 6 보고 | 모델 | 「다 됐다」는 비평 major 0 + 기계 검사 통과일 때만. `missingArt` 는 그대로 보고. |

## 켜는 법

- 편집기 주소 `?assistant=v2`, 또는 `localStorage['oprn:assistant-v2'] = '1'`(`src/ai/v2/switch.ts`). `?assistant=v1` 이나 `'0'` 이면 끈다. **기본은 v1** — 기본을 바꾸는 것은 사용자 결정이다.
- 켜면 `aiPiAgentCommand.runPiCommand` 가 요청에 `assistantVersion:"v2"` 를 싣고 계획 턴을 건너뛴다. `aiChatPanel.plainPiTurn` 은 의도 분류 LLM 호출을 건너뛴다(v2 모델이 직접 해석).
  팀·목표·다듬기 모드는 v1 그대로 간다. 끝의 조화 검수(harmony review)도 v2 에선 끈다 — 비평가가 대신한다.
- 워커(`scripts/oh-my-pi-worker.ts`)는 `assistantVersion === "v2"` 면 `scripts/lib/assistantV2Runtime.ts runAssistantV2` 로 보낸다.

## 구조 — v1 실행기를 그대로 쓴다

`runAssistantV2` 는 v1 `runPiAgent` 를 부르되 `options.v2` 갈고리(`src/ai/v2/env.ts`)를 준다:

- `toolNames: ["__assistant_v2__"]` + `initialToolNames: []` → 레지스트리 도구 0개 노출. 대신 v2 동사 8개(`verbs.ts`):
  `make_place · edit_place · add_people · add_event · draw_object · place_object · inspect · ask_user`.
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
