# Editor Validation Expectations

## Event validation location and UNSENT handoff (issue 693, 2026-09-08)

- The existing aggregate validator enriches issues with cause, expected value, correction
  hint and form locators. Index-based command paths are recalculated on every validation;
  repeated fork conditions additionally carry `conditionPath`. Native/M2 record pickers,
  coordinate axes and command movement steps use the existing form anchors.
- Bell navigation first reveals/selects the command, then focuses its inspector field.
  The shared custom-select enhancer transfers an already-focused native select to its
  trigger when reparenting it; no delayed focus job or polling is used.
- Copy offers Markdown/JSON from one `eventValidationDiagnosticReport` projection. It
  includes current-event errors only: rule-owned text, page ordinals, numeric paths and
  generated field anchors, never authored names/values, raw messages, logs or project data.
  This is separate from opt-in session diagnostics/export and needs no session recording.
- Ask local assistant minimizes (retains) the event editor and appends an editable UNSENT
  report through `prefillAiAssistantInput(..., {preserveDraft:true})`. Existing composer
  bytes survive. No send hook is called; an unavailable target restores the editor.
- `changeLifeSkillExp` renders its existing schema fields rather than an empty inspector.
  Native `spawnFieldEnemy` now adds only the validation-recovery fields to the existing
  command-form chain: troop, optional kill switch/graphic ID and area X/Y/W/H. Staged
  edits and optional clears preserve all other spawn/graphic data; rendering writes nothing.
- Page custom-route locators carry `openTestId`, `scopeTestId` and `selectTestId`. Navigation
  opens the existing route dialog, selects the exact current step and focuses its parameter.
  Explicit selection of switch/graphic/sound/NPC-transfer steps populates the existing
  parameter panel and edits only that local step. Initial/appended selection keeps the
  insertion-template behavior; route OK/Cancel remains the only commit/discard boundary.
  Export includes the generated step selection anchor, never its authored values.
- Focused contracts: `eventValidationDiagnostics`, `eventValidationFieldAnchors`,
  `eventValidationSelectFocus`, `eventValidationNavigationContract`, `eventValidationRecoveryFields`, `aiBootIntent`.
  Replay: `QA_BASE_URL=http://127.0.0.1:<isolated-port> node scripts/qa/issue693-validation.mjs`.
  It asserts disabled remote persistence, uses real editor/store/composer surfaces, and
  captures 1024/1280/1440 geometry and identical sanitized clipboard formats. Its local
  GET relay forwards actual Vite bytes to avoid workstation Chromium network-change errors.
  The replay includes `issue693-validation-recovery.mjs`: real spawn/route corrections,
  Cancel, preserved unrelated data and successful Save, with 45 exact field-focus viewport
  checks across all three sizes. It uses installed Chrome (`QA_BROWSER_CHANNEL`, default
  `chrome`); set `QA_OUTPUT` under `/dev/shm` on disk-constrained workstations.

## AI blocked-event relocation recovery (2026-09-06)

- `projectLint` now distinguishes known characters from interaction objects. A character's
  passage footprint must be passable (`event-character-impassable`, warning); a fixed
  wall-mounted door/sign remains valid when it has a reachable external approach.
  Blocking same-priority objects cannot use their own floor tile as proof of accessibility.
  Movable entities also need a legal footprint-aware step (`event-immobile`, warning).
  Ordinary post-write lint checks interaction positions against the start component
  when available, so enclosing an NPC/object without painting its own tile and
  disconnecting a floor pocket both produce advisory diagnostics.
  Character evidence includes `placementRole: "npc"`, social identity, schedule,
  movement/pushability, or bundled RTP people/actor/animal/monster sheets. `place_npc`
  stamps the optional persisted role, so fixed NPCs retain their semantics after a
  graphic replacement with an uploaded charset and save/reload. It does not assign
  a social `characterId`. Unknown legacy fixed custom sprites remain unclassified;
  neither custom sprites nor RTP object sheets alone are character evidence.
- Blocked-character, sealed-event, steppable-event and footprint diagnostics include
  `eventId` and `relocation: { eventId, searchRadius: 3, candidates }`. Each candidate
  is `{ name: "move_event", args: { mapId, eventId, x, y, from? } }`. Candidates preserve the
  full passage footprint, avoid other event bodies and the resolved player-start
  **body** (including 3x3), and require a usable interaction position. Character
  candidates additionally need a real `canMoveFootprint` step, with directional
  passage and `passRows`; a 2x2 pocket with a one-cell player corridor is not enough.
  On the start map (or an explicit lint reachability check), interaction positions
  must belong to the entry's tile-reachable component. Explicit
  `run_lint({reachability})` failures at event anchors receive the same recovery data.
- Candidates carry the analyzed entry as `from: { x, y }` whenever one is known,
  including explicit `reachability[].from`. `move_event` declares this optional
  coordinate object and validates its integer coordinates, map bounds and current
  terrain passability before forwarding it to destination validation. Invalid or
  now-blocked explicit origins fail rather than silently reverting to the project
  start. Omitting `from` retains the existing start-map/default-local behavior.
  Candidates analyzed without a usable default entry omit `from`; identical known
  origins still share their candidate list and BFS within one lint invocation.
  `scripts/prove-ai-relocation-recovery.mts --explicit-origin` exercises the public
  paint/lint/move/scene chain across a full-height divider, preserving the exact
  candidate coordinates and activating the authored switch from the explicit side.
- Destination reservations and traversal blockers are separate. Reservations still
  cover every event's full body, including nonblocking events, to prevent stale
  recommendations from stacking authored entities. Interaction approaches and NPC
  movement instead use first-page passage rectangles only for `priority: "same"`
  with `overlapForbidden !== false` (the runtime default is true). A below-priority
  event, overlap-allowed event, or passRows overhang on a wall sign's sole approach
  must not make that sign inaccessible. NPC traversal also tests its own passage,
  not its reserved body; player-start destination protection still uses the full body.
- Interaction checks are trigger-aware. Nonblocking `touch`/`playerTouch` events
  require a reachable cell overlapping their trigger body, not merely reachable
  external adjacency. With no known origin, a legal incoming tile step is required.
  Blocking collision triggers need a legal incoming bump; action signs can still be
  inspected without traversing the wall itself. The same check owns lint, candidate
  advice and `move_event` execution, including directional passage dead ends.
- These are bounded static suggestions, not proof of a runtime playthrough. Tile BFS
  retains the existing event-ignoring semantics; conditional pages, scheduled destinations
  and connectivity through other maps are not simulated. Maps without an entry only
  receive local candidates. No safe candidate means an empty array, not fabricated
  coordinates or permission to carve a completed building.
- `commitChangeset` already runs lint after **every** write, so terrain edits that strand
  existing NPCs now return recovery evidence through the normal tool result. `run_lint`
  also returns relocation issues at the result level. `AssistantSession` preserves this
  payload for the model and escalates `move_event` into the next tool set. The shared
  context guidance requires considering relocation alongside terrain/path repair.
- Diagnostics never move entities themselves or add a new completion/apply gate. The
  assistant chooses whether to invoke a real `move_event`; that tool now classifies
  existing characters correctly rather than always treating them as wall objects.
  `resolveEventPlacement` receives the existing event for moves and revalidates the
  complete destination body, passage, movement and approach against the current
  draft before accepting even an already-passable anchor. Stale recommendations in
  one assistant batch resolve to a currently valid nearby position or fail with
  `move-event-impassable` and coordinates/read-tool guidance; they never overlap.
  Proposal/approval, undo and completed-house write protection remain on the existing
  execution path. Moving retains IDs, pages, commands and unrelated events/tiles.
- `EventPlacementAnalysis` is lazy and invocation-local: one dual body/blocker index per map,
  one real tile BFS per origin, and one candidate list per event/origin shared across
  diagnostics. `projectLint` and each `move_event` create fresh contexts; no cache
  survives edits. BFS uses a queue cursor instead of repeated `shift()`.
- Regression: `test/aiBlockedEventRelocation.test.ts` exercises the real assistant
  tool-response seam after a terrain edit, both choosing and declining relocation,
  same-batch stale advice, non-anchor occupancy/terrain/bounds, uploaded save/reload,
  lazy flood/body-scan bounds and mutation refresh, plus protected-house preservation.
  No sleeps or prompt-prose assertions. Public API proof:
  `npx vite-node scripts/prove-ai-relocation-recovery.mts` runs
  `paint_tiles` → `run_lint` → `move_event` → `run_scene_test` and observes an authored
  interaction switch. The proof asserts both the outer tool result and nested
  `scene.data.ok`, plus the expected switch in `finalState.switchesOn`.
  `--without-switch-command` removes the actual authored effect and must exit 1:
  the scene reports `sw_0001` OFF. Before the correction that same negative probe
  incorrectly exited 0. New regressions also walk/activate wall signs over each
  nonblocking approach variant, retain a solid-blocker control, and exercise the
  complete public recovery path for unreachable/reachable directional touch tiles.
  `--benchmark` measures identical warmed lint fixtures:
  reviewed/corrected 100x100 with 20 blocked NPCs **378/255 ms**; 256x256 with 60
  **6995/414 ms** on this Linux workstation. These are indicative single-run timings,
  not timing assertions or an explanation of the earlier full-gate timeout.

## AI 타일 후검증 (2026-09-05)

- `verifyPostTilePlacement`(`src/project/lint/postTileVerify.ts`)는 AI가 타일을 깐 뒤를 본다. `build_roof`는 지붕이 **그 집 벽 연결 성분**을 덮었는지(`post-roof-incomplete`), `place_props`/`scatter_object`는 나무 요청인데 하층식생만 깔렸거나 나무 타일이 0이면(`post-tree-only-undergrowth` / `post-tree-missing`) warning 한다. 커밋 게이트는 막지 않는다. 고아 밑동·수관 보정은 기존 `repairTreePairs`가 맡는다.
- 쓰기 툴 성공 후(`src/editor/tools/toolRunner.ts`) `result.issues`와 `diff.warnings`에 붙이고, `run_lint`는 `verifyPlacedTiles`로 맵 전체의 미완성 지붕을 본다. 회귀: `test/postTileVerify.test.ts`.

## 이벤트 초안 검증 표면 (2026-08-28)

- 이벤트 편집기 검증 결과는 창 아래쪽 스트립이 아니라 타이틀바 오른쪽 **검토 알림 종**이다. 회귀: `test/eventEditorValidationBell.test.ts`(hidden/개수/최악 심각도/99+ 상한/항목 클릭 이동 + 팝오버 닫힘/바깥 클릭 닫힘) + `test/eventEditorUiDensity.test.ts`(편집면에 검증 chrome 이 없음). 심각도 계산과 개수는 `data-severity` / `data-count` 로 노출되므로 테스트는 문구가 아니라 이 값을 검사한다.
- `validateEventDraft` 자체의 판정 규칙은 아래 「Event editor aggregate gate」 절이 정본이다. 종은 그 결과의 표시 계층일 뿐이며 severity contract(error 는 Apply/OK/Test 차단, warning 은 진행 가능)를 바꾸지 않는다.

## event-unreachable lint rule (2026-08-27)

Historical rule below; the 2026-09-06 recovery section supersedes its own-tile shortcut
with interaction-position and movable-body checks.

- `projectLint`는 모든 맵 이벤트에 대해 자신의 칸과 4방향 이웃이 전부 통행 불가인 경우 warning 코드 `event-unreachable` 을 보고한다(mapId·event id·좌표 포함, 수정 지시: "통행 가능한 칸으로 옮기세요"). RM2K3 의미상 action 트리거 이벤트(문·간판)는 통행 불가 타일 위에 있어도 되므로, 통행 가능한 이웃이 하나라도 있으면 진단하지 않는다. `playerTouch-impassable` 과 대상이 겹칠 수 있지만 의미가 다르고 둘 다 발화해도 무방하다. 회귀: `test/projectLint.test.ts` 의 `event-unreachable` describe.

## P2 생활 시스템 무결성 (2026-08-25)

- P2 wire shape는 unsafe number, blank/duplicate definition ID, invalid rectangle, 빈 weighted catch/forage set, malformed museum reward를 normalization 전에 거부한다. 전역 reference validation은 fish→item, catch→fish, spot/area→map+bounds, forage→item, collection/museum item, museum reward item/switch/world-unlock/recipe를 검사한다.
- Repair는 dangling fish와 dependent catch, invalid forage row, stale condition/reward가 있는 museum reward 전체를 제거한다. stale required item 하나만 잘라 AND 보상을 더 쉽게 만들면 안 된다. Editor 삭제 가드는 UX 계층이며 이 권위를 대체하지 않는다.

## 생활 저작 표면 집중 검증 (2026-08-24)

- 생활 기술·제작 UI 변경은 `test/databaseLifeCraftingView.test.ts`, `test/databaseSidebarNav.test.ts`, `test/databaseSidebarKeyboard.test.ts`, `test/databaseSystemView.test.ts`, `test/p0ProjectSchema.test.ts`를 실행한다. 테스트는 nav/count/view 연결, 기존 5개 레코드군과 energy/shipping/worldUnlock/bundle/maker의 구조화 CRUD, empty state, add/duplicate/delete, undo/dirty-state, 중복 ID 방어, complete nested serialize/deserialize 왕복, 28일 기본 계절 길이 편집을 검증해야 한다.
- `configure_time_system` 변경은 `test/timeSystem.test.ts`에서 tool schema에 `daysPerSeason`이 존재하고 실행 payload가 정규화 설정으로 전달되며 non-number project shape가 거부되는지 검증한다.
- NPC 일정 UI 변경은 `test/editorNpcSchedule.test.ts`와 event aggregate gate batch를 함께 실행한다. 빈 schedule에서 add/delete가 가능해야 하고 timePhase/hourRange/season/dayRange/map/x/y/facing/activity가 실제 project draft에 기록되어야 한다. map bounds/passability validator를 UI 편의상 우회하지 않는다.
- NPC 일정 map-reference 변경은 `test/npcScheduleReferenceIntegrity.test.ts`를 함께 실행한다. 전역 reference validation/lint는 orphan event host까지 순회하고 schedule row index를 보고해야 하며, repair와 map-deletion cascade는 invalid/target row만 제거하고 pages/commands/유효한 ordered duplicate rows를 보존해야 한다. scheduled event ID는 전역 runtime key 충돌을 막기 위해 유일해야 하지만 모두 unscheduled인 legacy duplicate IDs는 허용한다.
- 생활 참조 변경은 `test/lifeAuthoringReferences.test.ts`를 실행한다. `collectProjectReferenceIssues`는 레벨 보상의 switch/recipe, 제작·강화·판매·도구 행동 item, shipping allowed item, bundle requirement/reward item·switch·unlock·recipe, maker input/output, worldUnlock switch FK를 보고해야 한다. editor delete guard도 item/switch와 bundle reward가 참조하는 recipe/worldUnlock 삭제를 같은 범위에서 차단한다.
- P1 동물 참조 변경은 `test/p1ReferenceIntegrity.test.ts`와 `test/p1FoundationSchema.test.ts`를 실행하고, NPC 일정 회귀인 `test/npcScheduleReferenceIntegrity.test.ts`도 함께 확인한다. 정확한 배열 경로로 종/축사/시작 개체 중복 ID, feed/product item, 축사 map·좌표·허용 종, 개체 species/building/event·호환성·수용량을 보고해야 한다. repair는 잘못된 아이템 종과 그 시작 개체를 제거하고, dangling allowed species를 자르며, 잘못된·비호환·초과 축사 배정만 해제한다. 맵 삭제는 해당 맵의 축사 ID를 impact에 포함하고 축사 삭제와 개체 배정 해제를 한 cascade로 수행하며, 삭제된 맵에만 있던 event binding도 해제한다.
- 동일 아이템에 대한 판매가 행 중복과 도구 행동 id 중복도 `lifeAuthoringReferences`에서 검사한다. NPC 일정 테스트는 기존 범위를 다시 비활성화해 `hourRange`/`dayRange`가 실제로 삭제되는 회귀까지 포함한다.
- `databaseLifeCraftingView` 회귀는 중복 ID 입력/중복 판매가·amount item 추가 방어, shipping 비활성화 시 history/allowed 값 보존, 명시적 optional 설정 제거, `changeLifeSkillExp`/`craftRecipe`/`applyItemUpgrade` command-reference 삭제 및 rename 차단, bundle 보상 recipe/worldUnlock rename 차단, capability 9×9 clamp를 포함한다. 일정 회귀는 min/max 우회 clamp 및 앞선 `when:{}` shadow 경고도 포함한다.
- P0 수량/세이브 공격 회귀는 `test/p0SafetyHardening.test.ts`, `test/p0SessionPersistence.test.ts`, `test/p0ToolCapability.test.ts`, `test/p0ProjectSchema.test.ts`를 함께 실행한다. `1e300`, safe-integer지만 공통 stack cap을 넘는 값, 결과 overflow는 inventory/charge/domain state를 하나도 바꾸지 않아야 한다. 로드는 현재 project의 life-skill ID와 XP 기반 level만 보존하고 unsafe maker deadline을 버리며 bundle completion/reward receipt를 같은 집합으로 복원한다. capability는 shape/editor/runtime 모두 축 9·총 81 상한을 사용하고 farming 범위는 map bounds와 교차한 뒤 최대 81칸만 순회한다.
- 2차 경제 공격 회귀는 `test/p0EconomySafetyFollowup.test.ts`를 추가한다. chest save parse/direct restore는 `ITEM_QUANTITY_MAX` 밖의 row를 버리고, deposit/withdraw는 player와 chest를 함께 무변이로 실패해야 한다. craft는 중복 ingredient를 item별로 합산하고 output grant까지 한 atomic batch로 검증한 뒤에만 gold를 차감한다. shop buy는 full/`MAX+1`/`1e300` stack에서 player gold, trade count, merchant gold를 모두 유지해야 한다.
- 이 범위가 UI 코드 단위 구현으로 제한된 작업에서는 Playwright·Supabase authored-content 검증을 대신 실행하지 않는다. 병합 전 시각 QA는 `/` editor에서 Database → `생활 기술·제작`과 이벤트 편집기 → `NPC 일정`을 1024×768 / 1440×900로 확인한다.

Wiki verification, Playwright evidence, and focused test guidance for editor changes.

## AI editor-wide tool validation (2026-08-25)

- Run `test/aiEditorFullToolCoverage.test.ts`, `test/aiToolDiscoveryEscalation.test.ts`, and `test/aiEditorFullToolSafety.test.ts` together with provider-schema, hostile-argument, approval, plan exposure, quota, and message-budget tests. Required behavior: map metadata/tree/duplication writes, database utility CRUD facade, project/system settings, second-round discovery escalation, typed unknown/malformed failures, and approval-required classification for destructive calls.
- The 40-tool base selector remains a regression contract. Editor-wide reachability is proven by `find_tools` followed by a later-round schema exposure, not by raising the base cap or sending the whole catalog. Request payload compaction and the provider schema ceiling must remain green.
- Browser proof for an editor-wide assistant change must show (1) one non-map AI request changing actual project state, (2) one destructive request displaying approval while the pre-approval serialized project SHA stays unchanged, and (3) one multi-domain request with successful cross-domain tool/audit rows and a saveable project. Any authored QA project must be persisted to Supabase and reloaded by project id.

## Roguelike run validation (2026-08-24)

- `runControl` and `run` are registered native kinds and participate in command/condition coverage, project shape validation, reference validation, summaries, and story explanation.
- Project shape validation checks the action/query discriminant and its action-specific fields. Draft validation reports an empty run-condition flag as `condition.run.flag-empty`; run commands have no project-record references.
- Optional room metadata validation checks boolean `resetEventState`, non-empty unique slot ids, non-empty choices, unique choices within a slot, positive integer weights, integer floor bounds 1–9999, ordered floor ranges, and same-map `fieldSpawnId` references. `configure_roguelike_room` rejects invalid references before applying the edit; import validation remains the trust boundary for external JSON.
- The run itself is runtime session state and the Phase 0–3 work is engine/editor code only, so it does not require Supabase content persistence. Any demo/map authored with these commands or room slots still falls under the mandatory Supabase save-and-reload rule.

## Validation Expectations

- Draft validation reports a friendship page/fork condition that can never be true as warning code `condition.friendship.no-character-id` — empty `npcKey` plus a host event without `characterId` fails closed at runtime (`resolveSocialKey` never falls back to `event.id`). The issue field anchor is `event-page-friendship-condition-npc-key`, and the editor shows the same fact inline through `event-condition-friendship-requires-character-id`. Contract test: `test/friendshipConditionGate.test.ts`.

- **Always-true / always-false condition traps are author-visible (2026-08-29).** `validateCondition` used to `return` with no checks at all for `selfSwitch`, `gold`, `timer`, `timePhase`, `season`, `npcActivity`, and `battleResult`, so a condition that could never do what the author meant produced no issue. New codes, all `warning` severity because the projects that contain them are still valid and must not be blocked from Apply/OK:
  - `condition.timer.always-true` — a `N초 이하` threshold is satisfied when no timer is running, because all three evaluators read an absent timer as `0`. The runtime rule is a deliberate pinned contract; this warning is the author-facing half of it.
  - `condition.npcActivity.empty` — an empty activity string can never match `session.npcActivities[eventId]`.
  - `condition.npcActivity.unknown` — the activity is not written by any NPC schedule in the project. This one **is** provable, unlike the removed `battleResult` inference below: `session.npcActivities[eventId]` has exactly one shipping writer, `setActivity` in `src/player/npcSchedules.ts`, and it only ever stores a schedule entry's `activity` field (`src/testing/sceneTestRunner.ts` mirrors it for the scene harness). An activity string that appears in no schedule therefore has no producer. The set is built once per validation run by `collectNpcActivitySuggestions` and carried on `referenceSets().npcActivities`. Wording stays advisory rather than claiming "항상 거짓", because a save file written before the author renamed a schedule activity can still hold the old value until the schedule pass clears it. Contract test: `test/npcActivitySuggestions.test.ts`.
  - `condition.timePhase.no-time-system` / `condition.season.no-time-system` — without `system.timeSystem`, `gameTime` is undefined and `conditionMatchesTimePhase` / `conditionMatchesSeason` are permanently false.
  - `condition.gold.impossible` — the comparison cannot hold anywhere in the reachable gold range.
  Contract test: `test/eventDraftValidator.test.ts`.

- **`battleResult` gets no impossibility check at all, and must not get one back (2026-08-29).** Both forms of the former `condition.battleResult.no-preceding-battle` warning were removed, together with the project-wide `battleProcessing` scan and the same-page preceding-battle walk that existed only to support them. The inference is unsound in every form: `battleResult` is *persistent session state*, so a battle in a different event or a common event sets it and it survives, which makes command order inside one page irrelevant. Battles also start with no `battleProcessing` command at all — random map encounters and field spawns produce a battle step whose `ownerEventId` is undefined (`src/player/playSceneBattle.ts`), so a project whose battles are all random encounters contains zero `battleProcessing` commands and the project-wide form false-positived on every page-level `battleResult` condition in it. This warning had already been narrowed once for the same reason; needing a second narrowing was the signal that the inference itself was wrong rather than its threshold. `battleResult` stays in the `validateCondition` switch as an explicit no-check case so the `const exhaustive: never` gate keeps compiling. Do not reintroduce this warning in any form — an unprovable warning on a legitimate authoring pattern is noise.

- Database visual-shell changes must enumerate every registered tab from the product registry rather than a hand-picked subset. At desktop and narrow acceptance widths, assert one invariant `.db-shared-workspace` frame, stable sidebar/workspace geometry, and no document overflow, then capture and inspect screenshots for every tab. Title-screen changes additionally require the real test-play window at its authored runtime viewport.


- Wiki-only edits should pass `npm run openwiki:verify`.
- Event and database UI repairs should have focused Playwright evidence. Task 10 added separate event and database stabilization specs under `test/e2e/`: the event spec covers event delete confirmation and shop branch persistence, and the database spec covers Database dirty discard, command-reference delete blocking, Common Event nested command editing, troop battle-event page switching, and enemy action switch picker behavior.
- For future editor workflow changes, run the smallest focused Vitest or Playwright path that proves the touched surface, then record the exact command and pass/fail excerpt under task evidence.
- Authoring-launcher/journey changes must prove all four actions reach their real surfaces, task/layout changes preserve `EditorUiMode`, acknowledgement is project-scoped but is never completion, and exact reference issues stay visible (task button title + Data stage list with a repair route) **without blocking any Test boundary** — the fail-closed gate was removed 2026-08-29, so coverage must prove the four Test entries still open with broken references. Regression coverage must invoke field, selected-event, troop, random-troop, and legacy Quick Battle exports directly; checking only the editor event dispatcher misses map-list, event context-menu, event-editor, and database basic-record callers. Broken references must stop modal creation, `startSession`, and runtime creation. Test completion requires actual `PlayScene` readiness plus a fingerprint matching the current committed project; click, synchronous `renderPlayer` return, failed boot, stale boot, and post-test authored mutation must all stay pending; a success event received while references are broken now counts, because the boot really happened. At 1024px, evidence text remains at least 11px and every visible independent button is at least 24×24px and unclipped. Focused unit batch: `npm test -- test/authoringTasks.test.ts test/authoringJourney.test.ts test/commandRegistry.test.ts test/selectedEventTestModal.test.ts test/quickBattleAuthoringGate.test.ts test/loadNewRemoteProject.test.ts`; browser contract: `npx playwright test test/e2e/authoring-journey.spec.ts`.
- For event-command parity changes, include focused tests for the support table, command-list/picker badge metadata, `projectLint` warning output, and write-tool `ToolResult.issues` propagation. `projectLint` reports non-full map/common/troop-event runtime support as warning code `runtime-support:<commandKind>`; `upsert_event` and `upsert_common_event` summaries also report the unsupported-command count.
- Native support assertions must exercise the context-specific `COMMAND_GUARANTEES` path. A picker label or source-text grep is not evidence: prove the inserted row badge, draft warning, and `projectLint` result against a known partial native command. Context-free calls are intentionally conservative.

## Desktop UI integration matrix (2026-08-11)

- Treat `1024×768`, `1280×800`, and `1440×900` as the Beginner/Standard/Expert shell matrix. Assert body/document width containment, contained menu and focus rectangles, visible status controls, AI-first column order, and no mobile/touch fallback claim below the `1024px` floor.
- Cover the Database dock toggle, AI collapsed restore/composer reachability, and Test Play fit-without-crop/title roving-focus paths through trusted browser input. Confirm shared application dialogs have accessible title/message references, deterministic focus, Tab/Shift+Tab wrapping, topmost-only Escape, and attached-opener restoration.
- Event editor evidence must cover `1586×992`, `1280×900`, `1024×768`, and `960×900`: no top strip/workbench/validation/footer overlap or document horizontal overflow; visible add/copy/delete/fullscreen/close controls; keyboard-operable resizers whose ARIA value changes; and trusted header Test/Save plus destructive-cancel paths. `test/e2e/eventEditorMockupShots.spec.ts` writes fresh screenshots and `viewport-matrix.json` under `output/evidence/event-editor-balanced/`, plus a `1536×1024` selected-command screenshot and region geometry in `final-layout.json`. Fixed sleeps are forbidden; wait on the exact visible/state signal.
- Browser policy allows only the documented optional `127.0.0.1:17831` developer bridge refusal (and intentionally aborted requests); any other console error, page error, or failed request is a failure. Store fresh screenshots and metrics with their viewport and localStorage setup.
- Tasks involving Modern Exteriors packaging, custom atlas layers, canonical remote seed/reload, or the Modern remote browser diagnostic remain blocked until redistribution rights are repository-visible. Do not use a local fixture, a blank-project route, or a DB write as a substitute for that blocked proof.



## Event editor aggregate gate (2026-07-30)
- `src/editor/eventDraftValidator.ts` walks every page and nested choices/fork/loop/shop/inn/promotion/evolution/battle-result branch using the same encoded command paths as the renderer. Label checks mirror interpreter stack visibility: duplicates are fatal only inside one command-list frame, nested frames may jump to ancestor labels, and parent/sibling frames cannot jump into inactive branches. The gate also aggregates recursive condition references, native and explicit M2 field references, map coordinates, empty shops, active movement/schedule references, runtime support, invisible collision, un-gated auto/parallel pages, and empty/no-op guidance. Coordinate coverage includes event/schedule/transfer/change-tile locations, living and active custom-route transfers, fixed light/animation targets, field-spawn rectangles, and applicable M2 map/current-map positions; picture coordinates remain screen-space and are not map-bounds checked. Camera Control bounds apply only when its runtime target resolves to a map-tile position. M2 validation follows command semantics rather than field names alone: discriminator-only fields apply only in their active mode, Spawn Event requires an existing cross-map template/prefab while treating `eventId` as output and blank `mapId` as the current map, Remove Event accepts current/dynamically spawned targets, optional Region Trigger references validate only when present, and Pathfind Move coordinates use current-map bounds. Future `Command` and `Condition` union additions must fail TypeScript exhaustiveness until classified.
- Severity contract: `error` blocks Apply, OK, and selected-event Test; `warning` is surfaced but may proceed; `info` is guidance. Runtime-skipped editor-only annotations such as M2 Comment are warnings, not fatal authoring errors. A failed action keeps the draft/modal open and navigates to the first error. Command issues select their row; field issues focus their control and automatically open enclosing `<details>`. Event x/y and existing tool-authored NPC schedules therefore expose compact repair controls, while living/custom movement errors target their existing controls. Do not replace aggregation with first-error validation.
- Focused supervisor batch: `npx vitest run test/eventDrafts.test.ts test/eventDraftVault.test.ts test/eventDraftValidator.test.ts test/eventBeginnerTemplates.test.ts test/eventTestSandbox.test.ts test/eventEditorTrustLoop.test.ts test/selectedEventTestModal.test.ts --configLoader runner`. UI completion additionally requires a practical browser check of empty templates, validation navigation, picker keyboard behavior, and the selected-event return-to-editor path.
- Safe tilemap harness changes should cover detached session serialization, checkpoint capture, room-only reroll preservation, lock enforcement, direct no-AI start, bidirectional transfer reachability, stale-base rejection, fresh review of replacement candidates, one guarded full/partial apply, one full-project undo, read-only NPC/time metrics, and the region review timeline/issues/blocker UI. Focused command: `npm test -- test/tilemapHarnessOverhaul.test.ts test/pendingRegionApply.test.ts test/roomHarnessEngine.test.ts test/regionTaskModalEnhancements.test.ts --pool=threads --maxWorkers=1 --no-file-parallelism --reporter=verbose`; also run `npm run typecheck:app`.


- All repository Vitest entry points run through `scripts/run-vitest.mjs` with `--configLoader bundle`. On Windows, the wrapper resolves the Vitest CLI and root to an uppercase drive letter before spawning Node. This avoids Vitest issue [#10692](https://github.com/vitest-dev/vitest/issues/10692), where lowercase `c:` CLI URLs and uppercase `C:` Vite URLs can load two runtime copies and fail before collection with `suite.config`/`current suite` errors. `scripts/verify-gates.mjs` uses the same wrapper and rejects a report with `numTotalTests === 0`; do not replace this with a pool pin, alias, externalization, or cache workaround without proving focused collection and `npm run gates -- --json` from an isolated worktree.

## P2 spatial integrity (2026-08-25)

- `collectProjectReferenceIssues` validates duplicate type/instance IDs; building cost item, decoration placement-item, map, and graphic references; placement type/level/orientation references; rotated footprint bounds/passability; and collisions with earlier P2 placements or authored legacy placeables. Paths identify the exact collection and array index.
- `repairProjectReferences` keeps the first duplicate, removes definitions with dangling item/graphic references, prunes missing allowed-map IDs, and drops orphaned/out-of-bounds/overlapping starting placements. Repair never chooses a replacement item/type and never creates inventory value.
- Database item deletion is blocked by building costs and decoration placement items. Building/decor type deletion is blocked while a starting placement uses it. Map deletion impact reports separate P2 building/decor counts and IDs, removes only target-map placements, and prunes the deleted map from type allowlists.
- Mandatory focused regression: `test/p2SpatialReferenceIntegrity.test.ts` plus `test/mapDeletionIntegrity.test.ts`, `test/p1ReferenceIntegrity.test.ts`, and `test/npcScheduleReferenceIntegrity.test.ts`.

- **배치 조건이 산문에서 실제 기하 검사로 바뀌었다 (2026-08-30, PR #316).** `checkPlacementSurface`
  (`src/project/placementSurface.ts:126`)가 사각의 밑변을 기준으로 **통행 가능성 데이터**만 보고
  판정한다 — 벽 = 통행 불가 또는 맵 밖, 바닥 = 맵 안이고 통행 가능. `PlacementZone` 은
  `anyFloor|clearArea|openFloor|againstWall|corner|wallFace` 이고 `facing` 은 `againstWall` 에서만
  뜻을 가진다(`src/project/types/base.ts:117-129`).

  **의도 탐지가 없다.** 지시문·그룹 이름·`placementRules` 산문을 읽는 경로가 하나도 없다. 이것이
  중요한 이유는 PR #312 가 정확히 그 반대 때문에 게이트를 풀어야 했기 때문이다 — 부분일치 정규식이
  "나무 상자", "나무 바닥", 맵 이름이 실린 `[컨텍스트]` footer 까지 매치해 실제로 타일을 깐 제안을
  통째로 반려했다. 실측 확인: 맵 이름 `"화덕 마을 [컨텍스트] 부엌"` + 그룹 `"화덕 상자"` +
  산문 규칙을 놓고 방 한가운데에 놓아도 위반 0건이다.

  **새 lint 코드 `cluster-rule:surface:<groupId>` 는 severity 가 `error` 지만 커밋을 막지 않는다.**
  `commitChangeset` 이 `issue.severity === "error" && !issue.code.startsWith("cluster-rule:")` 로
  차단 대상을 고르기 때문이다(`src/editor/tools/changeset.ts:221`). 즉 규칙 감사 패널에는 보이고
  AI 제안·커밋은 통과한다 — 이 레포의 "문제 신호는 보이게, 작업은 막지 않게" 관례와 같다.

  판정은 **세 값**이다. 인스턴스 자신의 타일이 지형을 덮어쓴 경우는 `undecidable` 로 표시하고
  건너뛰며(`clusterRuleValidators.ts:110-130`), 잘못된 params 는 조용히 무시한다. 확신할 수 없을 때
  위반이라고 말하지 않는 것이 오탐을 막는 장치다.

  구조물 킷의 `hard` 조건은 사람 팔레트가 찍는 시점에 거부한다(`structurePlacementActions.ts`) —
  킷마다 옵트인이고, `soft` 는 경고로 내려가며, 오류 문구가 고칠 자리를 지목한다("데이터베이스 → 구조물 →
  [편집] → AI 메타 탭의 «배치 조건»"). 구조물 스탬프 LLM 노출은 2026-09-04 에 등록 자체가 제거됐다.
  `list_structure_kits` 는 조회만 하고 시공 경로를 안내하지 않는다.
