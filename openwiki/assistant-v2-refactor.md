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
| `finish/` | 끝맺음 자동 단계 한 줄 | `finish/stages/*`(41) + `lanes/stages/*`(32) |
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

1. `bun scripts/qa/assistant-v2/golden.mts <out.json>` 을 앞·뒤로 찍어 `--diff` 가 「같다 (126 요청)」 — 요청 42개 × 프로젝트 상태 3개의 지시문 블록·처음 싣는 도구·나중 싣는 도구가 한 글자도 안 바뀌었다.
2. 바꾼 파일 범위 `tsc`.
3. `gh workflow run ci-vitest-files --ref <브랜치> -f files="<test/aiV2*.test.ts …>"` — GitHub 러너에서 v2 테스트 45파일. 실패는 main 의 최신 ci-full 과 이름으로 대조해 새 실패 0(2026-11-10 기준 기존 실패 10건/7파일). ci-fast 는 v2 테스트를 돌리지 않는다.

장소·경로 빌더를 옮긴 조각은 `bun scripts/qa/assistant-v2/worldProbe.mts <out>` 도 앞·뒤로 돌린다.

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
| R3 | `turn/`: 실행기 스크립트의 판정자 조율을 `src/ai/v2/turn` 으로 | |
| R4 | `request/`: 요청 글(과 프로젝트)을 가르는 최상위 선언을 `request/` 아홉 파일로(동작 그대로) — `scope`(게임 하나·한 곳·고치기·이어 하기·쓰기 요청) · `audio`(옛 `musicWords.ts`) · `combat` · `place` · `genre` · `asks`(날씨·흔들림·엔딩·장면…) · `title` · `toolGroups`(낱말 → 도구 묶음, 옛 `game.ts` 의 묶음들) · `world`(옛 `worldRequest.ts`). `shipChecks.ts` 에는 `REQUESTED_FEATURES`(낱말+프로젝트 검사+고칠 글이 한 표) 만 남았다. 함수 본문 안의 익명 정규식(`gameChecks.ts` 약 25곳, `finishGate.ts` 2곳, `verbs.ts` 1곳)은 본문을 건드리지 않아 그대로다 | 끝 |
| R5 | `judge/`: 검사들을 한 폴더로, 그 뒤 한 결과 형식으로 | |
| R6 | `finish/` 와 `lanes/` 를 한 줄로 | |
| R7 | `place/` `story/` `shared/`: 남은 평면 파일 정리, 600줄 넘는 파일 쪼개기 | 진행 중 — **place/ (옮기기만, 42파일):** `builders/*` 18 → `place/builders/*`, 평면 24 → `place/`(`worldPopulate` · `interiorCatalog` `interiorLayout` `interiorSpace` `interiorWalls` · `dungeonParts` · `exitDress` `deadEndRoads` `edgeExitRoads` `lockedDoors` `reliefShortcut` `landingPockets` `underRoof` · `placementRules` · `designAreas` `designRooms` `roomIdeas` `roomParts` `roomPurpose` `layoutReview` · `placeGuess` `mapNames` `modelSeed` `drawObject`). `place/` 는 `request/` 와 평면 파일만 끌어온다. 평면에 남긴 것: `transferSpot`(`request/place.ts` 가 형 `Side` 를 끌어와 request→place 가 된다 — `Side` 를 `shared/` 로 뺀 뒤) · `dungeonGates` `caveGates`(이름이 `*Gates` — judge 조각과 겹치지 않게) · `blankStart`(`blueprintPath` 를 끌어온다 — place→story) · `healingAccess`(빌더가 끌어오는데 판정 파일을 읽는다) · `interiorRoomChecks`(`*Checks`) · `makeGame`(장소+이야기+요청 낱말). 쪼개기·`shared/` 는 아직 |
| R8 | `prompt/`: 흩어진 카드 모으기 | |

동작을 바꾸는 조각(구조 재점검의 권고 — R 조각과 섞지 않는다):

| 조각 | 무엇 |
|---|---|
| B1 | 요청 분류를 한 번만 하고 기록해 모든 곳이 읽게(34곳의 따로 판정 없애기). 작은 일은 그 일의 검사만 |
| B2 | 완료 판정: 화면 검수는 «건넨 막음»만 완료를 막고 다듬기·모델 밖은 장부로. 겹침 판정(`vqaSameDefect`)·항목 열쇠(대상+결함 글)·자동 오프닝 분류·무대 오프닝 찍기·맵 칸 수·검토자의 출하 차단 중복 삭제. 새 파일 `turn/vqaItems.ts`. 규칙은 `assistant-v2.md` 「완료 판정」 — PR 열림(리드 머지) |
| B3 | 자리 규칙 하나 · 통행 기준 채우기 · 무대 오프닝. **B3a 끝**: 자리 고르기를 `place/{cells,personSpot,where}.ts` 로 떼고(`people.ts` 1,073 → 332줄), `move_event` 가 `dx,dy` · `where` 를 받아 고른 칸을 돌려준다. **B3b 끝**: 빈 야외 땅을 이름표가 아니라 칸 정보로 읽고(`src/project/openGround.ts`) 그 칩셋의 야외 소품으로 채운다 — 세계 야외 맵 12장 「맨땅 0%」 → 한 번 호출로 채움. **B3c 끝**: `author_opening_stage` 가 끝맺음이 깐 `bp-open-*` 장면을 걷고, 무대가 있으면 끝맺음이 다시 깔지 않는다. 무대 칸은 생략할 수 있다 |
| B4 | 턴 사이 기억: 막힌 항목은 막힌 채로(시도·마지막 실패·부른 동사·막힌 이유), 대상 지문이 바뀌었거나 요청이 짚은 것만 다시 연다. 화면 검수 장부를 `assistantTodo.memory.vqa` 로 이어 받는다. 검토자·리드 항목 열쇠를 지적 글로. 새 파일 `turn/carryOver.ts`. 규칙은 `assistant-v2.md` 「턴 사이 기억」 — PR 열림(리드 머지). 장소 설계(세션)는 아직 |
| B5 | 감싸개 여섯 겹을 도구 안으로. **B5a 끝**: 트룹의 빈 members · 필드 적의 patrol/graphic · 이동 쌍의 doorAt(같은 칸·막힌 문앞)을 도구가 스스로 읽는다 — `withSchemaFillCleanup` 은 아이템 한 규칙만 남겼다. 남은 것(B5b): 이동 쌍 뒤 단계 재시도 · 칩 관문 · 조우 · 그림 찾기 상한 |
| B6 | 작은 일 하네스를 v2 + Terra 로 돌리기, 오분류 요청 모음을 CI 에 |

## 알려 둘 것

- 리팩토링 동안 다른 작업 줄기가 `src/ai/v2` 에 관문·낱말 목록을 더하면 옮긴 파일과 충돌하고 같은 모양이 다시 쌓인다(2026-11-04~10 에 하루 8~12커밋). 조수 수정은 위 규칙을 따르고, 옮긴 뒤의 경로로 다시 맞춘다.
- `golden.mts` 는 숲길 도구 설명의 무작위 설계 과제(`forestBrief.ts`)를 씨앗으로 고정해 찍는다.
