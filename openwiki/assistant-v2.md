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

## 빌더가 하는 것 / 못 하는 것

- 실내(`builders/interior.ts`, 손 도트 v5): 방 종류 낱말 → layout, 주인공 물건(부품 사전 낱말, 「큰」은 가장 큰 것) 자리 찾기·견본 가구 밀어내기·도달 재검사,
  빈 바닥 덩이를 방 쓰임 한 벌로 메우기(≤15%), 올라가는 계단 → 위층(남쪽 출구 없음)·양방향 이동, 계단은 맨 북쪽 바깥 벽 방에, `dressing` 아늑하게.
  **못 함:** 남쪽 말고 다른 출구(뒷문) — 칩셋에 북벽 문 그림이 없다(보고됨).
- 마을(`village.ts` → `author_beodeul_town`), 던전·동굴(`dungeon.ts` → `author_dungeon`), 일본 도시 거리·집(`jpCity.ts` → `compose_jp_city_street`·`compose_jp_region`·jp 실내).
  마을 도구가 시작 칸을 옮기지 않아 `fixPlayerStart` 가 큰 땅으로 옮긴다.
- 사람(`people.ts` → `place_npc` 두 쪽: 첫 대화 → 자기 스위치 → 다음 대화), 자리 낱말(입구·광장·문 앞)을 걸어 닿고 길을 막지 않는 칸으로.
- 사건(`events.ts` → `script_cutscene`, 게임 시작 자동 1회), `probeCutscene` 문제를 경고로.
- 없는 물건(`drawObject.ts` → `generate_missing_object`): 그리기 카드만 띄운다(`draw_object` tool_end 가 카드를 연다 — `aiStoreCard.ts STORE_CARD_TOOLS`). 그린 뒤 후속 지시는 `place_object` 로 놓는다.
- 이미 있는 실내를 고칠 때 v2 기록이 없으면 맵 장소 꼬리표(`hand-layout-room`)의 방 구성으로 다시 지은 뒤 고친다(손으로 옮긴 가구는 견본으로 돌아간다 — 경고됨).

## 시험

- 모델 없이 빌더: `bun scripts/qa/assistant-v2/builders.mts <out> [caseId]` (사례 `builderCases.ts`).
- 모델 없이 동사: `bun scripts/qa/assistant-v2/verbs.mts <out> [--critic]`.
- 사람·사건·물건: `bun scripts/qa/assistant-v2/content.mts`.
- v1/v2 비교: `space-craft` 하네스의 `compare` 분류 10개(`harness-data/space-craft/seed.json`, `startBuild` 로 「이미 있는 맵」 시작 상태),
  ai-config `local-claude-sonnet-high.json`(v1) / `local-claude-sonnet-high-v2.json`(v2, `assistantVersion:"v2"` → 하네스가 스위치를 켠다).
