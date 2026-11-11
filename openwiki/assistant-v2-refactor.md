# 조수 v2 리팩토링 — 목표 구조·규칙·진행표 (2026-11-11 시작)

오너 2026-11-11: 「조수 215개 파일을 니가 깔끔하게 직접 전부 리팩토링하는게 맞을거같거든? 지금 너무 엉망진창이야」.
`src/ai/v2` 를 고치는 모든 에이전트는 이 쪽을 먼저 읽는다. 구조 재점검의 근거는 `http://mdc-server:18301/assistant-structure-review.html`(같은 날).

## 왜

- `src/ai/v2` 는 2026-10-23 부터 19일 동안 215파일 · 41,421줄이 됐다. 더한 줄 45,768 · 지운 줄 4,562(10 대 1).
- 평면 폴더에 104파일. `verbs.ts` 한 파일이 2,357줄이고 v2 파일 62개를 끌어온다. `verbs.ts` ↔ `lanes/*` 35파일이 한 덩이로 서로를 끌어온다(순환).
- 요청을 낱말 목록(정규식) 201개로 가르고, 같은 결정(「게임 하나 만들기냐」)을 13파일 34곳이 따로 내린다.
- 「아직 안 끝났다」고 말하는 판정자가 열넷이고 결과 형식이 제각각(한국어 글)이라, 다음 호출을 글에서 정규식으로 다시 긁는다.
- 턴을 모는 정책(판정자 순서·화면 검수 항목 수명)이 `scripts/lib/assistantV2Runtime.ts` 에 있어 `src/` 가 다시 쓸 수 없다.
- 다른 곳이 쓰지 않는 export 284개, 아무도 끌어오지 않는 파일 2개, 테스트만 부르는 함수들이 있다.

## 목표 구조

의존은 아래 표의 위에서 아래로만 간다(아래 폴더가 위 폴더를 끌어오지 않는다).

| 폴더 | 맡는 일 | 지금 어디 있나 |
|---|---|---|
| `shared/` | 형·실행 환경·도달 계산 같은 밑바닥 | `types.ts` `env.ts` `buildRun.ts` `eventReach.ts` … |
| `request/` | 요청을 **한 번** 분류한 기록(범위·장르·소리·전투·세계). 요청 낱말 목록은 여기에만 둔다 | `game.ts` 의 `wants*` · `musicWords.ts` · `shipChecks.ts` 의 `wantsWholeGame` · `genreDefaults.ts` · `worldRequest.ts` · `prompt.ts` 의 `leanPromptFor` |
| `place/` | 장소를 짓는 것: 빌더, 세계 표, 실내 배치, 자리 고르기(「맞는 칸」 규칙 하나) | `builders/*` `world.ts` `worldPopulate.ts` `interior*.ts` `dungeonParts.ts` `people.ts` 의 자리 부분 |
| `story/` | 청사진·경로·사람·사건·퍼즐·추리 | `blueprint.ts` `blueprintPath.ts` `puzzle.ts` `people.ts` `events.ts` `mysteryCase.ts` … |
| `judge/` | 「안 끝났다」를 말하는 것 전부, 결과는 한 형식(코드·대상·고칠 호출) | `shipChecks.ts` `gameChecks.ts` `sceneCraft.ts` `combatChecks.ts` `discoverability.ts` `vqa.ts` `advisor.ts` `loop/gates.ts` `todo/checks.ts` |
| `finish/` | 끝맺음 자동 단계 한 줄 | `finish/stages/*`(41) + `finish/lanes/stages/*`(32) |
| `tools/` | 모델이 부르는 것: 동사 하나에 파일 하나, 노출, 옛 도구 어댑터 | `verbs.ts` `game.ts` 의 감싸개 · `toolExposure.ts` |
| `prompt/` | 지시문 카드와 조립 | `prompt.ts` + 여러 파일에 흩어진 `*_CARD` |
| `loop/` | 할 일 고리(목록·갈고리·인자 지키개·실패 글) | `loop/*` `todo/*` |
| `turn/` | 한 턴 구동과 세션 상태 | `scripts/lib/assistantV2Runtime.ts` 의 정책 부분 · `verbs.ts` 의 `V2Session` |

## 규칙 (리팩토링 중에도, 끝난 뒤에도)

1. **요청 낱말 목록을 `request/` 밖에 새로 만들지 않는다.** 요청을 가르는 새 정규식이 필요하면 `request/` 의 분류 기록에 칸을 더한다.
2. **새 검사·관문을 평면 파일이나 `verbs.ts` 에 더하지 않는다.** `judge/` 에 두고 결과 형식을 따른다. 고칠 도구가 그 맵에서 실제로 듣는지 확인하지 않은 검사는 넣지 않는다.
3. **도구의 나쁜 기본값·거절은 도구에서 고친다.** 밖에서 감싸 오류 글을 정규식으로 읽는 감싸개를 더하지 않는다.
4. **새 v2 동사 이름은 옛 레지스트리 도구 이름과 겹치지 않는다**(이름으로 가르는 코드가 남아 있는 동안).
5. **한 파일 600줄을 넘기지 않는다.** export 는 다른 파일이 쓰는 것만. 테스트만 부르는 함수는 함수와 테스트를 같이 지운다.
6. **주석의 사고 기록은 「왜」 한 줄만.** 판 이름·칸 좌표·모델 이름은 위키(`assistant-v2.md`)에 둔다.
7. **옮기는 PR 은 동작을 바꾸지 않는다.** 동작을 바꾸는 수정은 따로 PR 로 낸다.

## 한 조각을 검증하는 법

옮기는 PR(R 조각)마다 셋을 본다. 로컬 테스트 러너는 돌리지 않는다.

1. `bun scripts/qa/assistant-v2/golden.mts <out.json>` 을 앞·뒤로 찍어 `--diff` 가 「같다 (155 요청)」 — 요청 51개 × 프로젝트 상태 3개 + 두 맵짜리 상태의 요청 2개의 지시문 블록·처음 싣는 도구·나중 싣는 도구가 한 글자도 안 바뀌었다.
2. 바꾼 파일 범위 `tsc`.
3. `gh workflow run ci-vitest-files --ref <브랜치> -f files="<test/aiV2*.test.ts …>"` — GitHub 러너에서 v2 테스트 45파일. 실패는 main 의 최신 ci-full 과 이름으로 대조해 새 실패 0(2026-11-10 기준 기존 실패 10건/7파일). ci-fast 는 v2 테스트를 돌리지 않는다.

장소·경로 빌더를 옮긴 조각은 `bun scripts/qa/assistant-v2/worldProbe.mts <out>` 도 앞·뒤로 돌린다.

턴 구동기(`turn/` · `loop/` · 판정자 차례)를 옮긴 조각은 `bun scripts/qa/assistant-v2/turnTrace.mts <out.json>` 도 앞·뒤로 찍어 `--diff` 가 「같다 (4개 장면)」 — 모델·검토자·화면 검수자를 대본으로 바꿔 `runAssistantV2` 를 네 요청(게임 전체 · «계속» · 작은 쓰기 · 질문)으로 돌리고 실행 상태·재주입 글·상태 카드·최종 보고·저장된 할 일을 찍는다. `golden.mts` 는 지시문과 도구 목록만 보므로 판정자 차례가 바뀐 것은 이것만 잡는다(`advisorRuns < 2` 를 `< 1` 로 바꾸면 네 장면 모두 「다르다」).

## 옮기는 도구 (`scripts/qa/assistant-v2/refactor/`)

손으로 자르고 붙이지 않는다. TS 문법 나무로 위치를 찾아 글을 옮긴다(파서는 `node_modules/typescript5` — 저장소의 `typescript` 는 7이라 JS API 가 없다).

| 도구 | 하는 일 |
|---|---|
| `movedecls.mts <repo> <from> <to> <이름…> [--header "…"]` | 최상위 선언을 다른 파일로 옮기고, 새 파일의 임포트를 만들고, 원래 파일·다른 파일들의 임포트를 고친다 |
| `reimport.mts <repo> <from> <to> <이름…>` | 이름을 다른 파일에서 끌어오게 저장소 전체의 임포트를 고친다 |
| `prune.mts <repo> <ops.json>` | 선언 지우기 · `export` 떼기 · 안 쓰는 임포트 지우기 |
| `tsloop.py <repo> <기준선.log> [--fix]` | v2 와 v2 를 끌어오는 파일만 `tsc` 로 보고 기준선에 없던 오류만 보인다. `--fix` 는 안 쓰게 된 선언·임포트를 걷는다 |
| `deadexports.py <repo>` | export 를 쓰임새로 가른다(A 어디서도 안 씀 · B 자기 파일만 · C 테스트만 · D 자기 파일+테스트) |
| `inventory.py <repo>` | 파일별 줄 수·의존·순환 재료 |
| `outline.mts` · `outline2.mts` | 파일의 최상위 선언 / 함수 본문의 문장 개요 |
| `localdeps.mts <repo> <file> <fn>` | 큰 함수 안 문장들이 어느 지역 이름을 쓰는지(쪼갤 자리 찾기) |
| `extractlocals.mts …` | 큰 함수의 지역 문장들을 다른 파일의 공장 함수로 뗀다(문맥 객체에서 받는다) |
| `mvfile.mts <repo> <from> <to> …` | 파일 옮기기 + 저장소 전체 임포트 고치기 |

한 조각의 흐름: 기준선 `tsc` 로그를 뜬다 → `movedecls` → `tsloop --fix` 를 새 오류 0 까지 → `deadexports` 의 A·B 를 `prune` → `golden --diff` → 커밋.

## 진행표

| 조각 | 무엇 | 상태 |
|---|---|---|
| R0 | 안전망: `golden.mts` · 이 문서 · 파일 목록(`scripts/qa/assistant-v2/refactor/inventory.py`) | 끝 (#4544) |
| R1 | 죽은 것 지우기: 끌어오는 곳 없는 파일 2개 삭제, 어디서도 안 쓰는 선언 15개와 그에 딸린 것 삭제, 테스트만 부르던 함수 3개(`vqaFixRetry` `vqaFollowUp` `advisorFollowUp`)와 스크립트만 부르던 `v2FinishGate` 삭제, 자기 파일만 쓰는 export 266개에서 `export` 떼기. 41,421 → 40,884줄 | 끝 |
| R2a | `V2Session` 을 `turn/session.ts` 로 — `verbs` ↔ `lanes` 35파일 순환이 끊겼다(남은 순환은 두 파일짜리 다섯) | 끝 |
| R2b | 끝맺음 관문 → `judge/finishGate.ts`, 고치기 안내 → `judge/placeFix.ts`, 장소 스키마 → `tools/placeSchema.ts`, `stageOpensBattle` → `story/stageBattle.ts`. `verbs.ts` 2,357 → 1,921줄 | 끝 |
| R2c | `createV2Tools` 쪼개기: 공유 지역 상태 → `tools/context.ts`(`makeVerbContext` · 형 `VerbContext`), 동사 공장 → `tools/verbs/{blueprint,place,people,puzzle,art,objects,makeGame,read}.ts`, 세션에 거는 끝맺음 함수 → `tools/sessionHooks.ts`, 밑받침 → `tools/support.ts`. `verbs.ts` 는 131줄(묶기만) | 끝 |
| R3 | `turn/`: 실행기 스크립트(`scripts/lib/assistantV2Runtime.ts` 571 → 74줄, 그림 찍기와 `runPiAgent` 끼우기만 남음)의 턴 정책을 `src/ai/v2/turn` 으로 — 지역 `let` 24개는 `context.ts` 의 상태 객체 하나로, 나머지는 `events`(이벤트 모으기) · `modelHooks`(도구 싣기·상태 카드·리드 계획) · `recheck`(기계 확인·기억 싣기) · `reinject`(재주입) · `autoBuild`(끝맺음 자동 짓기) · `vqaRound`(화면 검수 한 판) · `afterMain`(판정자 차례) · `finishTurn`(최종 보고) · `support`(스위치·시간 재기) · `turn.ts`(조립). 문장 순서 그대로, 파일마다 200줄 아래 | 끝 (#4557) |
| R4 | `request/`: 요청 글(과 프로젝트)을 가르는 최상위 선언을 `request/` 아홉 파일로(동작 그대로) — `scope`(게임 하나·한 곳·고치기·이어 하기·쓰기 요청) · `audio`(옛 `musicWords.ts`) · `combat` · `place` · `genre` · `asks`(날씨·흔들림·엔딩·장면…) · `title` · `toolGroups`(낱말 → 도구 묶음, 옛 `game.ts` 의 묶음들) · `world`(옛 `worldRequest.ts`). `shipChecks.ts` 에는 `REQUESTED_FEATURES`(낱말+프로젝트 검사+고칠 글이 한 표) 만 남았다. 함수 본문 안의 익명 정규식(`gameChecks.ts` 약 25곳, `finishGate.ts` 2곳, `verbs.ts` 1곳)은 본문을 건드리지 않아 그대로다 | 끝 |
| R5 | `judge/`: 검사들을 한 폴더로, 그 뒤 한 결과 형식으로. **옮기기 끝**(`mvfile.mts`, 본문 그대로): `vqa` `advisor` `finalReport` `sceneCraft` `gameChecks` `combatChecks` `discoverability` `playCheck` `hudTitleChecks` `puzzleChecks` → `judge/` 같은 이름, `loop/gates.ts` → `judge/gates.ts`, `todo/checks.ts` → `judge/todoChecks.ts`. `shipChecks.ts` 는 남았다(요청 분류와 얽힌 표 — B1 뒤). 한 결과 형식(코드·대상·고칠 호출)과 600줄 넘는 셋(`gameChecks` `discoverability` `todoChecks`) 쪼개기는 아직. **R5b(옮기기만, 19파일)**: 평면에 남아 있던 검사 16개 → `judge/`(`shipChecks` `lookChecks` `enemyChecks` `interiorRoomChecks` `puzzleGates` `audioVarietyLint` `examineLint` `eventReach` `actDepth` `mapCount` `questCount` `reloadCheck` `imageCheck` `vqaLighting` `critic`, `checks.ts` 는 이름을 `judge/machineChecks.ts` 로). 검사가 아닌 셋은 제자리로 — `dungeonGates`(바깥 → 던전 문 자리를 정해 놓는다) · `caveGates`(맨땅 동굴 출입구에 갱구 그림을 세운다) → `place/`, `healingAccess`(회복의 샘·회복약·보급 상점·시작 돈을 넣는다) → `story/`. **R5c(쪼개기, `movedecls.mts`)**: 600줄 넘던 다섯을 내용 이름으로 — `todoChecks` 1,142 → `todoChecks`(판정 입구·종류별 검사 425) · `todoCheckFacts`(같이 쓰는 읽기 416) · `todoRoomChecks`(실내 방 검사 370); `discoverability` 1,083 → `discoverability`(이야기 이벤트가 보이나·목표 빈틈·문·날짜·색조 434) · `objectiveCommand` 17 · `objectiveWhere`(목표 꼬리의 「어디」 246) · `objectiveRoutes`(꼬리 다시 맞추기 197) · `objectivePlan`(set_objective 계획 214); `gameChecks` 1,053 → `gameChecks`(`gameContentProblems` 한 함수 446줄 + 놓기 검사, 517) · `gameCheckReads` 213 · `storyFlowChecks` 229 · `sideEffectChecks` 107; `shipChecks` 766 → `shipChecks` 397 · `shipCheckReads` 33 · `shipArtChecks` 191 · `requestedFeatures` 72 · `wholeGameRekick` 106; `eventReach` 696 → `judge/eventReach`(닿기 읽기 253) · `place/reachRepairs`(닿게 고치기 454 — 판정이 아니라 놓기다). 본문에서 바뀐 것은 한 곳: 할 일 검사의 판정 글 언어 깃발 대입 두 줄을 `setEnglish()` 로(다른 파일의 `let` 은 대입할 수 없다). `judge/` 에 600줄 넘는 파일 없음 | 옮기기 끝 (#4559 · R5b · R5c) |
| R6 | `finish/` 와 `lanes/` 를 한 줄로. **R6a(옮기기만)**: `lanes/**` 34파일 → `finish/lanes/**`(`mvfile.mts`, 임포트 31파일). **R6b(형 하나)**: `LaneStage`·`LaneCtx`·`LaneScope` 를 없애고 마감 단계 32개도 `FinishStage` 다 — `phase` 가 `blueprint`·`assembly`·`reload`(끝맺음 실행기)와 `lane-project`·`lane-map`(마감 실행기) 다섯, 문맥은 `FinishCtx` 하나, 순서 세우기는 `finish/stageOrder.ts orderedStages` 하나(둘이던 복사본). 실행기 둘과 도는 순서·조건은 그대로(`session.clearLanes` 갈고리도 그대로) — 마감을 끝맺음 실행기 안으로 넣는 일은 `tools/sessionHooks.ts` 의 기록·체크포인트 자리를 바꾸는 동작 변경이라 하지 않았다 | R6a · R6b 끝 |
| R7 | `place/` `story/` `shared/`: 남은 평면 파일 정리, 600줄 넘는 파일 쪼개기 | 진행 중 — `place/` (#4553) · `story/` (#4555) · 평면 13 → `shared/` `place/` `story/` `turn/` `finish/` (#4571) · `place/` 큰 파일 셋 쪼개기 (#4582) · `story/` 큰 파일 셋(`blueprint` `shipDefaults` `monsterRouteLevels`) 쪼개기 (#4583) · `story/` 큰 파일 둘(`blueprintPath` `mysteryCase`) 쪼개기 (#4584) · 도구 겉면 넷 → `tools/` (#4585) · `story/events.ts` 에서 무대 · 걷기 · 사람 도우미 떼기 (#4586). 내역은 아래 「R7 내역」. 남음: `story/events.ts` 의 `buildEvent`(한 함수 679줄 — 아래 내역) |
| R8 | `prompt/`: 흩어진 카드 모으기 | 진행 중 — **요청 줄기 몫 끝(옮기기만):** `prompt.ts` → `prompt/systemPrompt.ts`(조립만) + `core.ts`(핵심 지시) · `placeSpecs.ts`(장소 카드 묶음·색인 줄·실내 목록) · `projectBrief.ts`; `game.ts` 의 카드 → `prompt/gameCard.ts`(게임 카드) · `mapEditCards.ts`(덧그리기·채우기); `forestBrief.ts` · `priorRequests.ts` → `prompt/`. `game.ts` 에는 감싸개만 남았다. 남은 것: `blankStart.ts`(빈 시작 맵 치우기 — 장소 정리라 `place/`) · `genreDefaults.ts`(장르 기본값 깔기 — `story/shipDefaults.ts` 옆)은 카드도 요청 읽기도 아니라 그대로 뒀다. `PEOPLE_CARD` `BLUEPRINT_CARD` `MAKE_GAME_CARD` `EVENT_CARD` 와 `place/builders/*_CARD` 는 그 파일을 옮기는 줄기가 끝난 뒤에 모은다 |

동작을 바꾸는 조각(구조 재점검의 권고 — R 조각과 섞지 않는다):

| 조각 | 무엇 |
|---|---|
| B1 | 요청 분류를 한 번만 하고 기록해 모든 곳이 읽게(34곳의 따로 판정 없애기). 작은 일은 그 일의 검사만 — **요청 쪽 끝**: `request/intent.ts`(`classifyRequest` → 범위·까닭·소리·전투·도구 묶음) + `request/readers.ts`(옛 이름은 기록을 읽기만), 오분류 규칙 수정, 말뭉치 `test/aiV2RequestIntent.test.ts`. 「작은 일은 그 일의 검사만」은 판정 줄기의 일로 남았다(`assistant-v2.md` 「요청 의도」) |
| B1-지시문 | 지시문과 처음 싣는 도구를 요청 의도에서 예산을 두고 짓는다(요청 줄기) — 작은 일은 그 일의 카드·도구만(`request/topics.ts` 주제 38개 · `smallJobTools` 18개+`load_tools`+`todo` = 20, Terra 30건의 부른 기록으로 고름), 게임 카드 줄마다 주제 표지(`game.ts` `GAME_LINES`), 실내 목록은 실내를 짓는 요청에만, 어긋나던 지시 넷 정리, `furnish_outdoor_area`·`move_event dx,dy` 반영. 게임 낱말이 없는 작은 일도 게임 도구 묶음을 받는다(`classifyRequest` 의 `editsBuilt` — 이벤트 찾기·옮기기). 이미 있는 맵 둘을 잇기만 하는 요청은 작은 일(`scope.ts` `linkedExistingMaps`). 작은 일은 그 일을 하는 도구에 늘 닿는다(풀 전부 `load_tools` · `SMALL_BY_TOPIC` 줄 · 기록 이름 `recordTopicsNamed`, `test/aiV2SmallJobReach.test.ts`). 예산 시험 `test/aiV2PromptBudget.test.ts` (`assistant-v2.md` 「지시문·도구 예산」) |
| B2 | 완료 판정: 화면 검수는 «건넨 막음»만 완료를 막고 다듬기·모델 밖은 장부로. 겹침 판정(`vqaSameDefect`)·항목 열쇠(대상+결함 글)·자동 오프닝 분류·무대 오프닝 찍기·맵 칸 수·검토자의 출하 차단 중복 삭제. 새 파일 `turn/vqaItems.ts`. 규칙은 `assistant-v2.md` 「완료 판정」 — 끝 (#4549) |
| B3 | 자리 규칙 하나 · 통행 기준 채우기 · 무대 오프닝. **B3a 끝**: 자리 고르기를 `place/{cells,personSpot,where}.ts` 로 떼고(`people.ts` 1,073 → 332줄), `move_event` 가 `dx,dy` · `where` 를 받아 고른 칸을 돌려준다. **B3b 끝**: 빈 야외 땅을 이름표가 아니라 칸 정보로 읽고(`src/project/openGround.ts`) 그 칩셋의 야외 소품으로 채운다 — 세계 야외 맵 12장 「맨땅 0%」 → 한 번 호출로 채움. **B3c 끝**: `author_opening_stage` 가 끝맺음이 깐 `bp-open-*` 장면을 걷고, 무대가 있으면 끝맺음이 다시 깔지 않는다. 무대 칸은 생략할 수 있다 |
| B4 | 턴 사이 기억: 막힌 항목은 막힌 채로(시도·마지막 실패·부른 동사·막힌 이유), 대상 지문이 바뀌었거나 요청이 짚은 것만 다시 연다. 화면 검수 장부를 `assistantTodo.memory.vqa` 로 이어 받는다. 검토자·리드 항목 열쇠를 지적 글로. 새 파일 `turn/carryOver.ts`. 규칙은 `assistant-v2.md` 「턴 사이 기억」 — 끝 (#4550). **B4b**: 장소 설계도 턴을 넘긴다 — `tools/placeMemory.ts`(`assistantTodo.memory.places`, 맵 지문이 그대로일 때만 `session.pastPlaces` 로 되살림), 다음 턴의 `edit_place` · `move_object` · `review_layout` 이 그 설계에서 고친다. 설계 없는 맵·한 번에 짜는 장소(`onePass`)의 거절 글은 이유와 그 맵에서 되는 도구를 이른다. 규칙은 `assistant-v2.md` 「장소 설계는 턴을 넘어 남는다」 |
| B5 | 감싸개 여섯 겹을 도구 안으로. **B5a 끝**: 트룹의 빈 members · 필드 적의 patrol/graphic · 이동 쌍의 doorAt(같은 칸·막힌 문앞)을 도구가 스스로 읽는다 — `withSchemaFillCleanup` 은 아이템 한 규칙만 남겼다. 남은 것(B5b): 이동 쌍 뒤 단계 재시도 · 칩 관문 · 조우 · 그림 찾기 상한 |
| B6 | 작은 일 하네스를 v2 + Terra 로 돌리기, 오분류 요청 모음을 CI 에 — **재는 쪽은 있음**: 작은 일 30가지 묶음·판정 자기검사·실행기·보고서(`npm run harness -- assistant-capability small-jobs --model terra-high --v2`, 문서 `openwiki/harnesses/assistant-capability.md` 「작은 일 30가지」). 이후 도구·분류 수정은 이 표로 전/후를 잰다. 기준선(2026-11-11, main `46274bc35f`): 통과 23/30 · 호출 중앙값 18 · 3.5분 — 불합격 원인 넷(마무리 단계 `clear_transfer_lanes` 가 사람을 옮김 2, 눈 칩셋 `find_empty_ground` 0% 2, 고른 도구 묶음에 도구 없음 2, 할 일 확인이 요청보다 좁음 1)과 만든 게임의 타이틀·엔딩 재작업 비용은 그 문서 「기준선」. 오분류 모음의 CI 연결은 아직 |
| B7 | 판정 코드 안의 요청 읽기를 `request/` 로: 글만 보던 `wantsWholeGame(task)` 여덟 곳(`gameChecks` ×3 · `combatChecks` · `pathBattleBudget` · `finishGate` · `turn/support vqaEnabled` · `reload-check`)이 `buildsWholeGame(project, task)` 를 묻고, `gameChecks`(과 거기서 갈라진 `storyFlowChecks` · `sideEffectChecks`) · `finishGate` 의 익명 정규식과 `REQUESTED_FEATURES` 의 낱말이 `request/readers.ts` 의 읽는 함수가 됐다(낱말 그대로 — 2,790줄 × 32개 맞댐 0). 바뀌는 동작은 하나: 게임 하나 청사진을 잇는 「계속」 턴이 검사·화면 검수에서도 게임 하나다. 규칙·근거는 `assistant-v2.md` 「이어 하기 턴의 판정」. 남은 것: `tools/context.ts` 의 청사진 재촉 두 곳 |

### R7 내역 (옮기기만 — 본문 그대로)

- **place/ (#4553, 옮기기만, 42파일):** `builders/*` 18 → `place/builders/*`, 평면 24 → `place/`(`worldPopulate` · `interiorCatalog` `interiorLayout` `interiorSpace` `interiorWalls` · `dungeonParts` · `exitDress` `deadEndRoads` `edgeExitRoads` `lockedDoors` `reliefShortcut` `landingPockets` `underRoof` · `placementRules` · `designAreas` `designRooms` `roomIdeas` `roomParts` `roomPurpose` `layoutReview` · `placeGuess` `mapNames` `modelSeed` `drawObject`). `place/` 는 `request/` 와 평면 파일만 끌어온다.
- **story/ (#4555, 옮기기만, 23파일):** 평면 23 → `story/`(`blueprintPath` · `puzzle` `clueObjects` `codeClues` `rereadPage` · `events` `scene` `sceneVerbs` `restoreEvent` `horrorSounds` · `mysteryCase` · `examineArt` `examineSpot` `guideTexts` `objectiveTargets` · `personName` `stepArt` `stepSubjects` `stepPeopleRoadside` · `pathBattleBudget` `bossTalkBattles` `monsterRouteLevels` · `shipDefaults`).
- **평면 13 + 옛 입구 1 (#4571):**
  - `shared/` ← `types` `env` `buildRun` `helpers` `switch` `stageWrites`. `stageWrites`(끝맺음 단계가 쓴 칸의 기록)는 finish · judge · tools · turn 이 같이 읽고 v2 의 다른 파일을 끌어오지 않는 밑바닥이라 여기다 — `finish/` 에 두면 judge→finish 가 된다.
  - `place/` ← `people` `transferSpot` `world`. `world` 는 세계 표 · 장소 명세 · 청사진 장소 고치기 · 세계 카드 — 장소를 짓는 쪽의 재료다.
  - `story/` ← `blueprint` `makeGame`. `makeGame` 은 장소 목록 · 잇기 · 사람 · 사건을 한 계획으로 짓는 길이고 `blueprint` 가 그 `walkGame` 을 끌어온다.
  - `turn/` ← `split`(리드 · 워커 나누기). `finish/` ← `stepSkip`(끝맺음 결과의 단계 건너뛰기 검사 — 재생 스크립트만 부른다).
  - `finishAutoBuild.ts`(다시 내보내기 두 줄)는 지웠다 — 부르던 넷이 `finish/index` 를 바로 끌어온다.
  - 폴더 방향을 맞추려고 옮긴 선언 셋: 형 `Side`(`transferSpot` → `shared/types`) · `blueprintDesignerFromEnv`(`blueprint` → `shared/env`) · `CODE_STEP_WORDS`(`blueprint` → `shared/stepWords.ts`).
- **600줄 넘던 `place/` 파일 셋 쪼개기 (#4582, 선언을 글 그대로 옮김 — movedecls):**
  - `exitDress.ts`(767→577) → `exitTransfers.ts`(198): 가구 · 벽에 묻힌 이동 칸 치우기(`dropBuriedTransfers`), 문 그림 밑으로 이동 칸 옮기기(`doorFloorTransfers`).
  - `builders/dungeon.ts`(677→521) → `builders/dungeonFoes.ts`(170): 적 · 보스 그림 고르기, 트룹 만들기(`ensureFoeTroop`) · 층별 트룹 계획(`planTroops`).
  - `builders/interior.ts`(1667→499) → `interiorKind.ts`(190, 방 종류 · 타일셋 · 낱말) · `interiorFill.ts`(365, 한 번 짓기 · 빈 바닥 채우기 · 견본 고르기) · `interiorShape.ts`(99, 방 모양 · 재질) · `interiorCosy.ts`(116, 쓰임에 맞는 소품 · 빈 방 꾸미기) · `interiorFloors.ts`(270, 장소 견본 · 뒷문 · 위층) · `interiorRebuild.ts`(202, 그대로 받아들이기 · 고침 인자 · 물건 옮기기). `interior.ts` 에는 `interiorBuilder` 객체(한 덩어리 453줄)가 남는다.
- **600줄 넘던 `story/` 파일 셋 쪼개기 (#4583, movedecls):**
  - `blueprint.ts`(706→558) → `blueprintRepair.ts`(151): 조건이 빈 단계 채우기(`fillUnsetStepConditions`) · 열린 단계 잠그기(`gateOpenSteps`).
  - `shipDefaults.ts`(933→456) → `shipLookDefaults.ts`(295, HUD · 전투 음악 · 전투 배경 · 파티 모습과 이름 · 창 모습) · `shipObjectiveDefaults.ts`(195, 목표 글 · 목표 자리 고치기).
  - `monsterRouteLevels.ts`(1078→182) → `monsterCampaign.ts`(164, 캠페인 읽기 · 관문 레벨) · `monsterFitBudget.ts`(100, 맞춤 시간 예산) · `monsterCampaignGifts.ts`(265, 스타터 · 회복 · 선물) · `monsterRequiredBattles.ts`(394, 필수 전투 맞춤).
  - `test/aiV2FitBudget.test.ts` 의 모듈 바꿔치기 하나를 둘로 나눴다 — 가로채던 두 함수가 두 파일로 갈렸다(하는 일 같음).
- **600줄 넘던 `story/` 파일 둘 쪼개기 (#4584, movedecls):**
  - `blueprintPath.ts`(1240→427) → `blueprintPathNames.ts`(60, 이름 맞추기 · 조사 · 맵 찾기) · `blueprintPathGates.ts`(301, 열쇠 · 입장 잠금 · 잠긴 쪽 가리키기) · `blueprintPathBattles.ts`(357, 단계 전투 잠금 · 순서 · 못 이기는 전투 맞춤) · `blueprintPathText.ts`(132, 단계 글 지키기 · 목표 글).
  - `mysteryCase.ts`(1471→408) → `mysteryCaseRead.ts`(142, 사건 읽기 · 낱말 · 용의자) · `mysteryCaseLines.ts`(271, 범인 대사 · 증거 이름 맞추기 · 심문) · `mysteryEvidencePlaces.ts`(199, 증거 자리) · `mysteryClues.ts`(158, 남은 단서 안내) · `mysteryObjectives.ts`(123, 목표 글) · `mysteryCaseRepair.ts`(228, 사건 깊이 · 새는 이름 · 결말 지름길 막기).
- **도구 겉면 넷 → `tools/` (#4585, 옮기기만 — mvfile):** `verbs`(동사 도구 묶음을 만드는 입구) · `flatWrapper`(감싸는 칸 펴기) · `toolExposure`(처음 싣는 도구 · 나중 싣는 도구) · `toolTextEn`(도구 글 영어 사본). `test/agentRules.test.ts` 가 파일 경로로 읽는 글도 새 자리로 고쳤다. v2 최상위에는 `game.ts` `blankStart.ts` `genreDefaults.ts` 가 남는다(request 줄기 몫).
- **`story/events.ts`(1217→747) 에서 `buildEvent` 밖의 선언 떼기 (#4586, movedecls):** `eventStage.ts`(189, 무대 흉내 `StageSim` · 걷기 기록 · 장면 사진 틀) · `eventWalks.ts`(201, 길 따라 걷기 · 다가가기 · 도착 칸 · 주인공 둘레 자리) · `eventCast.ts`(107, 주인공 가리기 · 얼굴 · NPC 찾기 · 장면 뒤 한마디 · 고르는 말).
  - `events.ts` 는 600줄을 넘긴 채 남는다 — `buildEvent` 한 함수가 679줄이다. 함수 안 문장들은 다시 대입되는 지역 변수(`map` 은 `refresh()` 가 사람을 만들 때마다 바꾼다, `start` `actorSeq` `hostEventId` …)를 같이 쓰고 중간에 `return fail(…)` 로 나간다. `extractlocals` 는 바깥 지역 이름을 문맥 객체에서 한 번 풀어 받으므로 옮긴 쪽이 낡은 `map` 을 보게 된다 — 글 그대로 옮겨서는 못 쪼갠다. 상태를 객체 하나로 모으는 코드 변경이 먼저다(B 조각).
- **거꾸로 가는 임포트(고치지 않았다 — 선언 하나 옮겨서는 안 풀리거나 다른 줄기의 파일):**
  - request→place: `request/world.ts` → `place/world`. 그 파일의 두 함수(`worldForRequest` · `composedWorldFor`)가 세계 표를 읽는다 — 둘을 `place/world.ts` 로 옮기면 풀린다.
  - shared→place: `shared/types.ts` → `place/interiorLayout`(형 `InteriorLayout` · `LayoutPatch`). 형 사슬이 `interiorWalls` · `interiorRoomChecks` 로 이어진다.
  - place→judge · story→judge: `judge/` 에 있는 «읽기 도우미»를 짓는 쪽이 끌어온다 — `judge/eventReach`(place 11파일 · story 12파일), `judge/objectiveCommand` `objectiveWhere` `objectivePlan`(story 의 `blueprintPath*` `mystery*` `guideTexts` `objectiveTargets` `ship*Defaults` `healingAccess`), 그 밖에 `interiorWalls` → `judge/interiorRoomChecks`, `events` `eventStage` → `judge/machineChecks`, `shipDefaults` → `judge/shipChecks` `shipArtChecks` `discoverability`, `pathBattleBudget` `healingAccess` → `judge/combatChecks`. story→loop/todo: `sceneVerbs` → `loop/argGuard` `todo/names`. 이 때문에 폴더로 보면 place · story 가 judge(↔loop↔turn)와 순환한다 — `eventReach` · `objective*` 같은 읽기 도우미를 `shared/` 로 내리는 조각에서 푼다(judge 줄기의 파일이라 여기서는 옮기지 않았다).

## 알려 둘 것

- 리팩토링 동안 다른 작업 줄기가 `src/ai/v2` 에 관문·낱말 목록을 더하면 옮긴 파일과 충돌하고 같은 모양이 다시 쌓인다(2026-11-04~10 에 하루 8~12커밋). 조수 수정은 위 규칙을 따르고, 옮긴 뒤의 경로로 다시 맞춘다.
- `golden.mts` 는 숲길 도구 설명의 무작위 설계 과제(`forestBrief.ts`)를 씨앗으로 고정해 찍는다.
