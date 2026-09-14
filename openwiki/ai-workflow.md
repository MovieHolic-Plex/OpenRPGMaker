# AI Workflow

This page describes how an agent should operate on this project using the local wiki.

## Before changing files

- Read `AGENTS.md`.
- Read `openwiki/PROJECT_WIKI.md`.
- Read one or more focused pages based on the requested change.
- Inspect the source files named by those pages.
- Decide which validation command or browser scenario will prove the change.

## While changing files

- Keep edits inside the owning boundary when possible.
- Do not change project schema without checking migrations, serialization, fixtures, and save/load tests.
- **Content authoring (maps, events, demo games, sample adventures): Supabase DB is required.** Do not ship work that only lives in memory, `blankProject`/`freshProject` temp sessions, or repo fixtures without a successful remote upsert + reload. See root `AGENTS.md` hard rule.
- Do not change runtime behavior only in UI glue if the rule belongs in `src/battle`, `src/player/interpreter`, or project data logic.
- AI assistant conversation history persistence lives in `src/ai/conversationStore.ts`; it uses browser `localStorage` only, is separate from project JSON/runtime session state, and is covered by `test/conversationStore.test.ts`.
- **사람 성향 기억**(`src/ai/preferenceMemory.ts` + `preferenceSignals.ts` + `preferenceDistiller.ts`)도 같은 관례로 `localStorage` 가 정본이다(`oprn:ai-preference-memory`, `oprn:ai-preference-signals`). **원격 미러는 아직 없다** — `test/supabaseRlsCoverage.node.test.mjs` 가 신규 마이그레이션의 anon GRANT 를 막고 클라이언트는 anon 키만 쓰므로 새 테이블을 브라우저에서 쓸 수 없다. Phase 8 인증 뒤에 다룬다. 시스템 프롬프트 주입 지점은 `src/ai/systemPromptEnvelope.ts` 한 곳이다. 상세: `openwiki/editor-ai-panel.md`.
- **AI activity logs** (every chat turn, region task, tileset analysis): `src/ai/activityLog.ts`. Always writes a ring buffer to `localStorage` (`oprn:ai-activity-logs`, max 100). Remote: prefers `rpg_zzu.ai_activity_logs` (migration `20260709000000_ai_activity_logs.sql`); if that table is missing (PGRST205), **falls back** to `rpg_zzu.ai_analysis_runs` with `tileset_id='__ai_activity__'`. DEV also POSTs to the Vite disk mirror → `output/ai-activity/` (`latest.json`, `index.json`, `activity.jsonl`, `<id>.json`). Region tasks call `recordAiActivityFromRegionLog` from `runRegionTask`. Chat turns write a pending start row, **upsert the same `turnLogId` after every tool_call** (tools + `reason` so far), then write the completed row in `aiTurnRunner` `finally`. 같은 id 의 빈 pending 시작 행은 이미 툴/이유를 담은 행을 덮어쓰지 않는다(`preferRicherActivityRecord`). 모든 모델 툴 호출은 스키마 필수 `reason` 한 줄이 없으면 실행되지 않는다(`src/ai/toolReason.ts`). 이유는 `toolCalls[].reason`, `audit` tool 행, `index.reasons`, 대화 `entries_json` 에 실려 로컬+원격에 같이 남는다. Console: `window.__oprnAiActivityLog`, `__oprnListAiActivityLogs()`. Tests: `test/aiActivityLog.test.ts`, `test/toolReason.test.ts`. Do not put API keys in logs.
- **디스크 미러 경로는 상수 하나뿐이다 (2026-08-23 실측):** 미러 엔드포인트는 `src/ai/activityLogEndpoint.ts` 의 `AI_ACTIVITY_DISK_ENDPOINT` (`/__rpgzzu/ai-activity`) 이고 `vite.config.ts` 가 같은 값을 복제한다. 브랜드 리네임 때 미들웨어만 바뀌고 클라이언트는 `/__oprn/ai-activity` 로 POST 하고 있었다 — 404 는 `fetch` 가 throw 하지 않으므로 미러가 조용히 죽어 `output/ai-activity/` 가 아예 생기지 않았고, 디스크를 읽는 `list-ai-activity`·`run-ai-village-lab` 의 `latest.json` 이 함께 죽어 있었다. 경로 문자열을 손으로 다시 적지 말 것. 드리프트는 `test/aiActivityLogEndpoint.test.ts` 가 고정하고, 미러 실패는 DEV 콘솔에 `[ai-activity]` 경고로 한 번 드러난다.
- **실패 턴 QA:** `npm run ai:log -- 20 --failed --tools` — 디스크 우선(원격은 `--remote`), 실패 턴만 골라 실패 툴콜의 `name`/`summary`/`issues`/`args` 까지 펼친다. `index.json` 요약 자체가 `ok`·`error`·`stoppedReason`·`failedTools` 를 들고 있어 파일 하나로 실패 분류가 된다.
- **Round lakes**: `fill_region` supports `shape: rect|ellipse|circle` (default rect). Circular/round water **must** use `shape=circle` (inscribed disk in `rect`). Region task guide and system prompt ban bare-rect fills for "원형/둥근" requests. Helper: `cellsInFillShape` in `constructionTools.ts`. Tests: `test/constructionToolsV3.test.ts` circle case.
- **Post-layout validation** (after tiles/props placed, before apply): `src/project/lint/layoutPlacementValidate.ts` — props on water, incomplete vertical trees (260/290), missing trees when instruction asks for trees. Wired in `runRegionTask` (blocks apply) and chat proposal accept (`aiProposalCard`). Not the same as per-tool `projectLint`. Tests: `test/layoutPlacementValidate.test.ts`.
- AI model routing is layered in `src/ai/llmClient.ts`: `model` is the supervisor model for planning, spatial reasoning, build specs, and final review; `liteModel` is the executor model for write-tool loops and repetitive batch helpers. `AssistantSession.sendUserMessage` uses a three-phase state machine when `liteModel` differs from `model`: plan on `model`, switch subsequent write-tool loop calls to `configForLiteModel`, then review on `model`. If review reports `재실행:`, the executor gets one repair pass before a final supervisor review. Region tasks, cluster/range/sample assist, and event-command natural-language conversion still pass an already-lite config and therefore stay on the lite path. **짧은 턴은 플래너 단계를 건너뛴다** (`src/ai/plannerSkip.ts`) — 질문·선택 영역·72자 미만이면서 마을/퀘스트 표지가 없으면 `action=direct` 를 듣기 위해 왕복하지 않고 본문 툴 루프로 간다. 진행 중인 WorkPlan 과 다단계 요청은 그대로 플래너를 탄다.
- 동기 도구 실행 앞에는 `yieldToUi` 가 브라우저에서 rAF 1틱을 내준다. 라이브 행·고스트가 `tool_started` 를 그릴 틈이다. Node/테스트는 즉시.
- **전송은 `chatCompletion` 하나뿐이다 — 우회 사본을 만들지 말 것 (2026-08-30):** OAuth/companion 분기, `X-Rpgzzu-Provider`·`Authorization` 조립, 엔드포인트 판정, 180초 타임아웃, 1회 재시도, `reportTransportHealth`/`reportModelDemotion` 은 전부 `src/ai/llmClient.ts` 의 `chatCompletion` 안에 있다. 마지막 예외였던 `src/editor/panels/tilesetAiClient.ts` 가 직접 `fetch` 를 때리며 이것들을 손으로 재구현하고 있었고, 에디터 AI 가 OAuth 전용이 된 뒤 그 사본만 갱신에서 빠져 **타일셋 AI 가 무증상으로 죽어 있었다(실측 2026-08-21)**. 지금은 `chatCompletion` 을 부르고, `readApiUrl`/`fetchWithTimeout`/`httpFailureMessage`/응답 파싱 사본은 삭제됐다. 실패 문구는 `humanizeLlmStatus` 가 만든다(옛 `HTTP <status> <본문>` 덤프 대신 401/402/429 조치 안내가 붙는다). JSON 전용 채널을 위해 `ChatRequest` 에 `response_format?: {type:"json_object"}` 와 `temperature?: number` 를 통과 필드로 추가했다. **버린 것**: `routing.max_input_per_1m` — 옛 게이트웨이 전용 필드로 companion 경로에서는 이미 보내지 않고 있었고, 비용은 lite 모델 선택으로 통제한다. Tests: `test/tilesetAiClient.test.ts`.
- **Default model path (2026-07-14):** `DEFAULT_MODEL` = `DEFAULT_LITE_MODEL` = `google/gemini-3.1-flash-lite`. Live region shop/table run: MiniMax supervisor added ~2min wall-clock for same NPC+table outcome as lite-only. Dual-model (MiniMax plan/review + lite execute) remains optional when user sets `model !== liteModel`.
- **Default model path:** `DEFAULT_MODEL` = `DEFAULT_LITE_MODEL` (single-model default; see `src/ai/llmClient.ts` for the current value — `test/aiLlmClient.test.ts` pins it in one place). Live region shop/table run (2026-07-14) showed a separate heavier supervisor added ~2min wall-clock for the same NPC+table outcome as lite-only, so dual-model (supervisor plan/review + lite execute) stays opt-in: it engages only when the user sets `model !== liteModel`.
- **Legacy propVocabId/group-id construction paths cleaned:** tests and build-palette prop preset use label `material` only (`꽃`, `침엽수`, …). `BUILD_PALETTE_PRESETS.prop` → `flower-props` (not bag). Deprecated `propVocabIdForYardDecor` removed. Remaining `propVocabId` reads in session/summary are dedupe/compat only.
- **Bag materials demoted:** `마을 소품` / `small-props` / harness `…-small-props` are **not valid place_props materials** (`src/project/materialPolicy.ts`). `resolveMaterialByLabel` rejects bag labels/ids; region material hints omit bag groups; build-palette “prop” uses concrete label `"꽃"`. Prefer specific labels (`나무 상자`, `침엽수`, `꽃`, …). Tests: `test/materialPolicy.test.ts`.
- **Multi-turn WorkPlan harness** (modern agent harnessing, 2025–2026 patterns):
  - **Research shape**: Anthropic planner→generator→evaluator; Ralph loop (re-inject on early exit); Claude TodoWrite-style plan tools in the ReAct loop; code is harness only (state, inject, caps, hooks) — never invents step content via regex.
  - **Planner = main LLM** (`ORCHESTRATOR_SYSTEM_PROMPT` + tool-less JSON in `runOrchestratorPlanner`): `direct | resume | new_plan | replan`. Authors layers/items with `instruction`, optional `doneWhen` (acceptance), `successTools`.
  - **Generator = tool loop** (lite when configured): only the *current* work item. Tools always include `get_work_plan`, `set_work_plan`, `complete_work_item`, `skip_work_item` so the main model can replan mid-run.
  - **Evaluator = existing review phase** (main model) after a burst ends.
  - **Ralph continue** (`shouldRalphContinue` + `formatRalphContinueMessage`): if the model returns no tools while the plan is incomplete, the harness re-injects the current item (up to `MAX_WORK_PLAN_AUTO_STEPS_PER_TURN`, default 256). Human "계속" is only needed after the safety cap — not after every item.
  - **볼륨 막대는 플래너가 선언한다 (2026-09-03, 코드 강제 계획 삭제):** `requestNeedsVolumePlan`·`volumeBarForRequest`·`buildVolumeWorkPlan`·`forceVolumeWorkPlanIfNeeded` 는 없다. 플래너 `new_plan/replan` JSON 의 `volume{authoredMaps,multiPageNpcs,shops,quests}` 만 `volume-contract:armed` 로 세우고, 미달 재주입(`HARNESS CONTINUE`, 턴당 8회)은 종전대로 코드가 한다. 플래너 `direct` 는 존중된다 — 정규식이 그 판정을 거부해 「이 마을에 상인 하나 추가해줘」가 맵 3장이 되던 경로(2026-09-03 실측)가 없다. 아래 2026-09-01 서술은 그 이전 상태다.
  - **볼륨 계약은 코드가 강제한다 (`src/ai/volumeContract.ts`, 2026-09-01):** 마을/RPG 요청에서 플래너 `action=direct` 는 거부되고 `buildVolumeWorkPlan` 이 들어간다. 모델이 툴 없이 퇴장하면 턴 시작 스냅샷 대비 맵·상태별 NPC·상점·퀘스트 델타가 막대에 못 미칠 때 `HARNESS CONTINUE` 를 재주입한다(턴당 8회). 한 줄 인사 NPC 는 `verifyPlacedNpcsHaveStatePages` 가 항목 완료를 막는다. 자율 드라이버는 계획이 끝나도 막대가 비면 「계속」을 **코드가** 보낸다. 사용자에게 「계속」을 부탁하지 않는다. Tests: `test/volumeContract.test.ts`, `test/volumeContractSession.test.ts`.
  - **런 계량 (`src/ai/runRecap.ts`, 2026-09-01):** 사용자 목표(자율 런이면 드라이버 전체)가 끝나면 세션이 토큰 델타·경과·과정(플래너/Ralph/볼륨/툴)을 `run-recap` 감사와 활동 로그 `result.recap` 에 남긴다. 채팅에는 `토큰 입력 N · 출력 M · Ss` 한 줄만 (`data-testid=ai-run-recap`). 과정 상세는 `npm run ai:log` / 하네스 모달. Tests: `test/runRecap.test.ts`.
  - **Harness = code** (`src/ai/workPlan.ts` + `src/ai/volumeContract.ts` + session): validate/store plan, inject current sprint, auto-advance on `successTools` or complete/skip, emit `work_plan` UI events, refuse early exit when volume is unmet.
  - **complete_work_item / auto-advance 가드**: `successTools`가 있으면 그 툴 성공 시에만 complete·`advanceWorkPlanFromTools` 가능. **successTools 없는 항목은 자동 완료 금지**(아무 쓰기 성공으로 다음 단계 넘김 thrash 차단). 실패 단계는 `skip_work_item`.
  - **산출물 게이트(`src/ai/workItemOutcome.ts`)**: `doneWhen` 은 자연어라 기계가 못 읽는다 — 툴 이름 매칭을 통과한 뒤 **결과물 상태**를 한 번 더 본다. 이 항목이 새로 만든 맵(`create_map`/`duplicate_map`/`run_interior_room_pipeline`)이 `create_map` 초기값 그대로(lower 단일 타일 + upper 전부 EMPTY + 타일 스택 없음 + 이벤트 0)면 자동 완료와 명시 `complete_work_item` 을 **둘 다** 막는다. 기존 맵은 검사하지 않는다(의도적으로 비워 둔 맵 오탐 방지). 탈출구는 `skip_work_item`.
    - 실측 근거(2026-08-28, project `oprn-4f65d09fb1`, "음 다른맵을 더 만들자"): 항목 `doneWhen`="맵이 생성되고 기본 지형이 칠해짐" · `successTools`=`["create_map"]` → create_map 성공 3초 만에 자동 완료, 페인팅 0회. 결과물은 잔디 단색 30×30·20×20 맵 2장(고유 타일 1종, 이벤트 0)이었고 `run_lint`·`evaluate_game_quality` 는 통과 판정을 냈다.
    - 플래너 프롬프트(`ORCHESTRATOR_SYSTEM_PROMPT` 7-successTools)도 같이 조였다: `successTools` 는 **`doneWhen` 의 모든 절**을 덮어야 하며, 생성 툴만 적는 것은 계약 위반이다.
  - **완성도 경고 → 자동 완료 차단**: `proposalCompletenessWarnings` 는 종전에 `maybeAutoApplyMilestone` 에서 자동 *적용*만 보류시켰고 항목은 이미 done 이었다. 이제 자동 완료 게이트(`autoCompleteGate`)가 경고를 완료 차단 사유로 쓴다. 교착 방지를 위해 **명시 `complete_work_item` 은 산출물 게이트만** 통과하면 되므로, 모델이 판단해 끝낼 수 있다. 차단은 `항목id::사유` 로 중복 제거해 감사 로그(`WorkPlan 자동 완료 차단: …`)와 오케스트레이션 메시지로 알린다.
    - 테스트: `test/workItemOutcome.test.ts`(단위), `test/aiWorkItemOutcomeGateSmoke.test.ts`(세션 통합 — 차단 / 채우면 완료 / 교착 없음).
    - **Placement quantities (2026-09-06, R4):** the no-BuildSpec fallback counts explicit placement clauses, not every numeric counter. Historical P2 falsely demanded 2 placements from two `1개` mentions (inventory and consumption), not `두 맵`. Quoted output, inventory/use/preservation clauses and existing-placement observations are not construction requests; mixed preserve-then-add requests still lint the additions. The shared boundary strips `[컨텍스트]` for both session gates and runner display. Modification/no-change warnings, BuildSpec coverage and shortfall thresholds remain active. This is conservative text lint, not a general natural-language parser. Regressions: `proposalCompleteness`, `aiMilestoneTurnAccounting`, `aiTurnAppliedAccounting`.
  - **실측 실패 모드 5종 완화 (2026-09-14, 근거 `.omo/evidence/ai-assistant-failure-modes.md`)**: 실사용자 프로젝트 58개의 사용자 입력 턴 166건 중 114건(68.7%)이 오류로 끝났고, 상위 원인이 전부 **편집기 자체 게이트**였다. 다섯 겳을 좌표로 고쳤다 — 보호 계약은 유지하고 거부 조건만 좁혔다.
    - **스펙 게이트(F2)**: 타일을 덮지 않는 `NON_TILE_SPATIAL_TOOLS`(`place_npc`·`place_battle_blocker`)는 "밑그림 없음" 만으로 차단하지 않는다(경계·plannedMap·기존 내용 보호는 그대로). 이번 작업 항목이 만들었고 기준선에 없는 맵은 `seedSpecForFreshItemMap` 이 `spec-gate-auto-seed` 경고로 암묵 밑그림을 세운다(쓰기 성공 시에만 커밋). 차단문은 그 호출의 영역으로 만든 **제출 가능한 `set_build_spec` 초안 JSON** 을 실어 보낸다. 테스트: `test/aiSpecGateFreshMap.test.ts`.
    - **완료 회계(F4)**: `completeWorkItemById` 에 `waiveMissingTools` 를 달았다 — 선언한 `successTools` 기록만 비었고 산출물 게이트가 통과하면 항목을 닫는다. 세션은 **같은 항목이 한 번 거부된 뒤**에만, 그리고 누락 툴에 검증 툴이 없을 때만 이 길을 열고 `work-item-tools-waived` 감사를 남긴다. `완료할 항목 id가 없습니다` 는 열린 항목 id·진행률을 실고, `openWorkItemIds` 는 `blocked` 를 포함한다. 테스트: `test/workItemCompletionWaiver.test.ts`.
    - **툴 인자 스키마(F1)**: 배열 자리의 단일 객체 정규화를 Command 스키마 설명문 조건에서 풀어 전 툴에 적용(`shouldWrapSingleObjectAsArray`), 실행 중 던져지는 `invalid-args` 오류에도 `invalidArgsExample`·`invalidArgsHint`·`invalidArgsRepair` 를 붙인다(`issueFromToolError`). 이미 자기 `repair:` 줄을 가진 툴은 건드리지 않는다.
    - **타일 어휘(F3)**: 그룹 이름·설명도 점수 후보에 들어간다(`tile_query` 가 보여 주는 이름과 해석기가 같아진다 — `꽃` → `꽃/자연 소품`). 낟말 커버리지 점수는 최대 65로 **자동 채택 임계 70 미만**이라 후보에만 쓰이고, 면 채우기 실패는 채울 수 있는 재료를 돌려준다(함정 바닥을 다시 권하는 순환 제거). 후보는 구조화 필드가 아니라 **메시지 본문**에 적힌다 — 모델은 `issues[].message` 문자열만 받는다. 테스트: `test/tileVocabularyNarratedLabels.test.ts`.
    - **독립 검수(F6)**: `parseIndependentReview` 는 산문에 싸인 판정 객체 **하나**만 읽는다(`revision`+`verdict` 둘 다 가진 균형 객체, 둘 이상이면 계속 거부). 프로토콜 위반은 `REVIEW_JSON_ONLY_REMINDER` 로 **한 번** 다시 요구하고, 재요구 응답도 취소·신선도·이미지 전달 검사를 똑같이 받는다. 테스트: `test/independentReview.test.ts`, `test/aiAssistantSession.test.ts`(산문 재요구).
  - **tile_query labels/vocab 타일셋**: `tilesetId` 생략 시 `mapId` 또는 `startMap` (`resolveQueryTilesetId`). 실내 맵에서 Combined Town 라벨 place_props 사고 방지. region 가이드에 `mapId` 명시.
  - **place_npc 상점 병합**: 근접(맨하탄≤2) 유사 이름/상점 역할이면 **명시 id여도** 기존 이벤트로 합침. 일반 NPC는 id 생략 시에만 병합.
  - **place_npc graphic diversity:** generic queries (`villager`/`npc`/`사람`/`주민`) pick from top-K via stable seed (`mapId:name:x,y`) and skip charset slots already used on the map (`pickNpcGraphic` + `usedCharsetGraphicKeysOnMap`). Specific roles (상인/할머니/기사…) still take the top match unless avoided.
  - **place_npc face sync:** `changeFace` is derived from the **resolved** charset after diversity pick (`faceGraphicFromEventGraphic`), not the raw query default — so people1#5 gets `easyrpg-faceset-people1-05`, not always `-00`.
  - **material 동의어**: `탁자`/`나무 탁자` 등 모호 쿼리만 확장 — 구체 라벨(`가로 탁자 중`)에 bare 탁자 부분매칭으로 타일셋 교차 오염하지 않음. 동의어는 오케스트레이션 대체재 아님.
  - Fallback `buildDefaultWorkPlan` only if planner API/parse fails on a long request.
- Do not treat generated evidence, screenshots, or exported projects as source unless the task explicitly asks for evidence updates.
- Update the matching wiki page when the code change alters future navigation or risk.

**Opt-in NPC reward acceptance (2026-09-06; core plus session completion wiring):**
`IntentDeclaration.npcRewards` is declared by the existing `intentDeclarationClient` JSON request,
using `INTENT_SYSTEM_PROMPT` and `parseIntentDeclaration`. Only explicit create/modify requests
for NPC currency/item/collected-monster grants opt in; ordinary dialogue, questions and removals omit it.
No natural-language regex or final-command inference supplies these expectations.

```ts
npcRewards?: readonly {
  target: ({ eventId: string } | { eventName: string }) & { mapId?: string };
  grants: readonly ({ kind: "gold"; count?: number; id?: never; name?: never } | (({ id: string } | { name: string }) & {
    kind: "item" | "monster"; count?: number;
  }))[];
  oneTime?: boolean;
  choices?: readonly number[];
  repeatChoices?: readonly number[];
}[] | { readonly invalidReason: string };
```

- `parseNpcRewardRequirements(raw: unknown): NpcRewardRequirements` preserves malformed explicit
  contracts as `invalidReason`, not a neutral fallback. Arrays/grants must be nonempty; IDs or exact
  names are exclusive; explicit counts must be positive integers. No count means a positive delta.
  Names/IDs need not exist until completion. NPC names resolve from `event.name`, falling back to
  the first-page display name used by starter authoring; map scope is optional but resolution must
  be unique. Item/species names also require a unique exact DB match.
- First-class currency (2026-09-07): `{kind:"gold",count:20}` has no ID/name and bypasses
  item/species lookup. Any currency ID/name field (including null) fails admission. Count is
  still exact when supplied and positive when omitted. Currency is authored with native
  `changeGold`; neither the parser nor completion coerces localized item names. A legitimate
  item ID `gold` or name `골드` remains inventory-only. Mixed grants require every currency,
  item and monster delta. Duplicate gold components in one requirement fail during admission,
  before the declaration can be adopted. The actionable error enters the existing single bounded
  shape-repair call with the complete original JSON; other grants/counts and `oneTime` are
  preserved. Never silently sum ambiguous amounts. Completion retains its duplicate guard for
  typed callers; already adopted contracts are not reset. Independent NPC gold grants remain valid.
- The declaration client gives malformed `npcRewards` one JSON-shape repair within the original
  20-second deadline. It retains the original non-reward intent fields and never accepts omission of
  the reward contract as a repair. Failed repairs remain blocking and are not cached. The session
  returns an error before planner/authoring calls for an invalid declaration; it cannot spend tools
  trying to repair request metadata that authoring tools cannot change.
  Shape-repair guidance requires an ID/name only for item/monster grants, never gold. Valid item
  declarations are not reinterpreted or reset, even if the item is named `골드`.
- `verifyNpcRewardsPlayable(project: Project, required: NpcRewardRequirements | undefined):
  WorkItemOutcomeVerdict` in `workItemOutcome.ts` is the exported core gate. Undefined is a no-op;
  invalid/missing/ambiguous contracts fail. `AssistantSession` captures a clone alongside adventure
  requirements, preserves it across driver/continuation, retry and replan, and replaces it on a new
  request or clears it for ask mode. Plan-only confirmation defers execution checks, not the contract.
- Session item acceptance snapshots only declared NPC event state at the existing work-item evidence
  boundary. Non-final DB/terrain/unrelated-NPC items do not inherit reward checks; items changing a
  declared target run the core verifier. The last item must satisfy the whole request, even when the
  plan omits the NPC. Explicit completion rechecks before the already-done shortcut; final skip cannot
  close an unmet goal. Final model output is checked again after authoring, including changed NPCs.
- The existing four-attempt repair budget and final incomplete notice cover direct requests as well
  as plans. Captured JSON is appended to each compacted model request and the planner summary, so
  disposable orchestration messages, retry and replan cannot drop or weaken it. No reward inference
  from commands or changes to retry/spec/auto-completion accounting are involved.
- Without a selected prerequisite witness, each NPC gets a fresh local scene starting on a
  passable unoccupied adjacent tile. `oneTime:true` runs two
  interactions in the SAME session, with runtime page re-selection and the declared zero-based
  choices. First deltas must match; the repeat must change no gold balance or item/species counts,
  including currency paid on the repeat of an item-only obligation. Text, claimed
  switches, preexisting inventory and `changeParty` cannot satisfy a reward.
- Scene/tool evidence: `snapshotRewards` checkpoints `session.gold`, inventory and owned species counts;
  `expect.goldDelta` accepts an exact signed safe integer or `{atLeast:integer}` against that
  same scene session (scene-start baseline when no snapshot was taken). `finalState.gold` exposes
  that session's final balance on success and failure. `expect.gold` and `currencyDelta` are not
  supported aliases; malformed/unknown assertions fail tool preflight before executing steps.
  The provider schema exposes `goldDelta` without a type restriction, like walkthrough `value`,
  because strict provider schemas prohibit the scalar/object union; runtime preflight owns validation.
  `test/ohMyPiGoldRewardWire.bun.test.ts` captures this field at the actual installed SDK fetch
  boundary on Antigravity Gemini and Claude routes. It remains untyped (not STRING); numeric
  20/0 and `{atLeast:1}`/`{atLeast:0}` survive response parsing and execute in the real scene tool.
  String values are still rejected by runtime preflight. This offline test does not establish
  remote service acceptance of an untyped legacy Schema field.
  `expect.inventoryDelta` / `ownedMonsterDelta` map IDs to exact integers or `{atLeast:1}`;
  `interactionComplete:true` rejects a still-pending choice. `interact.eventId` asserts the physically
  selected NPC instead of directly executing authored commands. Out-of-range choices fail.
  `finalState.ownedMonsterCounts`, `monsterParty`, `monsterBox` prove party-full box delivery through
  `monsterInstances`. `give_starter_monsters` already authors the guarded choice event; no new kit.
- Tests: `test/npcRewardAcceptance.test.ts`, `test/npcRewardSession.test.ts`,
  `test/npcGoldReward.test.ts`, `test/intentDeclarationClient.test.ts`, existing scene/quest gates.
  Currency regressions use native 37 -> 57 -> 57 interactions, inventory/currency separation,
  exact-count failures, provider normalization, unchanged verification-history identity and the
  same session lifecycle suite for gold and item/monster contracts. Session tests run actual
  `sendUserMessage`, real authoring tools, and the real scene verifier with a scripted model boundary.
  Evidence: `.omo/evidence/assistant-tool-reliability/rewards` (session follow-up: `session-wiring/`). Existing unrelated capture failures in
  `monsterCollection.test.ts:125,166` remain untouched; no battle or content/DB changes.
- Currency evidence remains `.omo/evidence/npc-gold-0907/`. Archived Round8's item substitution
  is still failed currency evidence; neither that change nor the prerequisite extension repairs
  a live declaration, ledger or game.

### Request-bound NPC prerequisite proof (CR-NPC-PREREQ-01, 2026-09-07)

- `verify_npc_reward({requirementIndex, prelude})` is an AssistantSession tool, not a general
  editor mutation or a historical scene receipt. The contract note lists zero-based indices
  and exact selectors. The complete raw input is validated before execution. Unknown fields,
  including generic `reason`, are rejected; this tool alone bypasses reason-schema decoration.
  The global contextBuilder reason instruction and tool description explicitly name the same
  exception; ordinary tool schemas still require reason. Tests assert wire fields, not prose.
- Actions: `walk {mapId,to,adjacent?}`, one-tile `move {mapId,dir}`, `face {mapId,dir}`,
  `interact {mapId,eventId}` and `choose {mapId,index}`. Every mapId asserts the current map,
  never teleports. No state, start position, RNG, grants/counts, choices for protected phases,
  expectations, snapshots, receipts or caller verdicts are admitted. Limits: 256 actions,
  4096 movement steps and 100000 total interpreter instructions over the entire replay.
- `npcRewardWitnesses` binds the cloned program to the captured requirement object's lifetime
  and index, plus the original uniquely resolved map/event pair. A same-named or same-ID
  replacement elsewhere cannot inherit it. New requests/ask mode clear candidates; continuation,
  retry, replan and work-item/milestone evidence resets do not. A valid replacement is selected
  before execution; its failure never falls back to an old pass or fresh-local verification.
- `verifyNpcRewardsPlayable` replays every selected witness on a private current-project clone
  at every applicable completion gate. One actual authored-start session runs prelude, claim
  and repeat. Changed keys, chest pages, links, landings, collision, NPCs, DB or start state
  therefore receive fresh execution, not a cached verdict. The result reports phase, compiled
  failed-step index, counters, claim/repeat deltas and final reward counts, all host-generated.
- Pending choices cannot be abandoned. Cancellation/invalid choices and unfinished interactions
  are unverified. Every bound-NPC interaction before the protected claim snapshot must have zero
  requested-component delta, including the host-owned approach (which retains protected transfer
  and foreign-event restrictions). Snapshot entry is tracked independently of the reported phase.
  Check each completed interaction, not just the end of a multi-touch walk; synchronous baselines
  stay local across nested events, while held choices retain theirs until completion. Unrelated
  prerequisite rewards remain legitimate: never compare the claim to authored starting balances.
  Claim baselines are taken after the route and host approach; repeat immediately re-interacts with
  no navigation and must change no gold, inventory or owned-monster counts, even undeclared ones.
- `SceneRewardProof` is a host-only runner capability, outside ordinary scene-input schemas.
  Restrictions execute at `runEventView` and interpreter `executeCommand`, not a page scan or
  log parser. Protected transfers and foreign event/autorun/chaser entry are denied; callMapEvent
  is unsupported throughout witness execution, including nested/common-event frames. Optional
  interpreter hooks make instruction/loop/stack exhaustion unverified instead of normal done.
  Ordinary scene/game execution has no such hooks and retains its behavior.
  Proof start positions and transfer landings use the shared `isPassableLanding` authority,
  not legacy directional-bit OR: a one-way tile without a compatible exit is unverified even
  when an adjacent NPC can pay without walking. Ordinary movement/scene behavior is unchanged.
- Native text, choices, supported state/reward/flow commands and cosmetic chest frame changes
  work. Native authored waits up to 60000ms each are simulated, not wall-clock sleeps. Battle,
  shop, number/key/name input, calendar hooks, movement-route/relocation, M2 fallback and other
  unsupported operations fail closed. Common-event state is not seeded or repaired: the current
  scene start does not populate session.commonEvents, so a missing common call is unverified.
- Schedule prerequisite map/chest authoring first, separate transfer linking next, NPC authoring
  and journey verification last via set_work_plan. Keep one-map authoring targets and all existing
  completion, immutable-promise, unrelated failed-check, image, history and baseline obligations.
  Do not remove a gate, synthesize a key or move reward timing to obtain completion.
- This proves a reachable reward claim on the supplied legitimate route, not whole-game or
  universal-path correctness. Regression seams: `npcPrerequisite.test.ts`,
  `npcPrerequisiteSession.test.ts`; evidence: `.omo/evidence/npc-prerequisite-0907/`.
  P1 host-approach regressions: `npcApproach.test.ts`; red/green source-only receipts:
  `.omo/evidence/npc-approach-p1-0907/`. This is not live-game or final source approval.

## After changing files

- Run the lightest relevant validation first.
- Run broader checks when the change crosses module boundaries.
- For UI/editor work, drive the editor through a browser or Playwright scenario and save evidence.
- Report what was verified and what remains unverified.

## Tool-calling architecture (human review map)

For a structural map of tool calling (exposure, pin+cap 40, region vs chat, box/wood-box incident), read:

- `docs/2026-07-10-tool-calling-architecture-review.md`

**Stack (after 2026-07-10 simplify + 2026-07-11 material labels):** LLM surface is **v3 construction + builders + `paint_road` + `tile_query` + non-tile domains**. Construction primitives take **`material` (tile label/description only)** — not `*VocabId` / harness group ids. Discover labels with `tile_query ask:"labels"`. Old v2 place wrappers are **removed** from the registry. Legacy v1 names stay for `getTool`/tests as `deprecated` engines. UI tool browser lists `activeTools()` only.

Auto-generated schema dump (not policy): `docs/tool-catalog.md`.

## Headless Tool and MCP Access

- Use `node scripts/rpgzzu-tools.mjs --project test/fixtures/projects/battle-v3.json get_project_summary '{}'` to run editor tools outside the browser.
- Use `node scripts/rpgzzu-tools.mjs --list` to inspect the headless tool catalog and each tool's read/write mode.
- Use `node scripts/rpgzzu-mcp-server.mjs --project <project.json|project.rpgzzu> [--audit-log output/tool-audit.jsonl]` for MCP over stdio.
- The MCP server uses JSON-RPC 2.0 with `Content-Length` stdio framing and exposes `initialize`, `tools/list`, and `tools/call`.
- Headless/MCP execution is read-only for project storage: read tools run normally, write tools only produce dry-run summaries/diffs/issues.
- Do not add store save, project commit, or remote transport imports to `src/headless/` or the headless scripts; audit logs may record tool name, args, summary, and ok status, but never project JSON.

## Live editor AI assistant MCP (same UI session)

Use this when an external agent should drive the **in-editor AI chat panel** so a human can watch the stream/proposals on screen.

1. Start bridge MCP: `npm run mcp:assistant` (HTTP `http://127.0.0.1:17831` + MCP stdio).
2. Start the editor: `npm run dev` (DEV auto-connects the bridge; force with `?aiBridge=1`, disable with `?aiBridge=0`, port with `?aiBridgePort=17831`).
3. Ensure the editor's selected AI provider is connected (OAuth or API key).
4. Point the MCP client at `scripts/rpgzzu-assistant-mcp.mjs` (stdio). For AGY: `agy mcp add rpgzzu-assistant node scripts/rpgzzu-assistant-mcp.mjs`.

The stdio bridge accepts both newline-delimited MCP JSON-RPC (AGY 1.1.x) and legacy `Content-Length` framing and replies using the format detected from the first request. After registration, verify `assistant_ping` and `assistant_status`; `agy mcp list` only proves configuration, not a live browser connection.

MCP tools:

- `assistant_ping` — browser hello recently?
- `assistant_send` `{ text, timeoutMs? }` — send through live panel; returns audit + harness when the turn ends
- `assistant_status` / `assistant_audit` / `assistant_harness` / `assistant_abort`

Browser also exposes `window.__rpgzzuAiBridge` for console debugging. Implementation: `src/editor/aiAssistantBridge.ts` + registration in `aiChatPanel.ts`. Bridge binds **localhost only**.

## Refreshing the wiki

Never put credentials in wiki files.

Use `npm run openwiki:verify` to check that required pages and AI entry points are present.
