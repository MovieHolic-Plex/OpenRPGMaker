# Editor Genre Packs

Genre packs are editor-side authoring guidance over the single canonical `Project` schema and the single player runtime. They are not alternate engines or schema variants.

## Ownership

- `src/project/genrePackId.ts` owns the six persisted IDs: `adventure-jrpg`, `monster-collect`, `horror-chase`, `story-cutscene`, `farm-life`, and `action-rpg`.
- `src/editor/genrePacks.ts` owns the machine-readable registry: starter, navigation, vocabulary, recipes, lint mappings, journeys, and runtime requirements.
- `src/editor/newProjectChoices.ts` owns the eight first-class new-project choices (label, blurb, art, tone, poster caption, featured tier, row art) and the order contract. It is the single source both surfaces derive from.
- `src/editor/welcomeGenrePresets.ts` maps all eight welcome presets to a real pack and blank-project system-preset recipe. The first-screen briefing and the new-project dialog show only three start choices (`monster-collect`, `story-cutscene`, `adventure-jrpg`). Horror, farm, partner-raise, and action-RPG stay in the choice catalog for existing projects and tools, and are not mounted on either start surface. `buildWelcomeGenrePresetPrompt` remains an optional AI enhancement; it is not the pack contract.
- `src/editor/welcomeGenreSystemPresetAction.ts` is the project-creation boundary shared by AI posters and confirmed manual system presets. It adopts the detached seed into the SQLite folder already opened by the shell, then requires `store.flush()` to return `saved` before releasing an AI intent. It does not create a LegacyDb row or provide transactional rollback.
- `src/project/genrePresets.ts` only applies standard `system.*` opt-ins. Player/runtime modules must not switch on `system.genre`.

`src/project/genrePackId.ts` is also the Phase 4 SSOT. Phase 4 code must import `GenrePackId`, `GENRE_PACK_IDS`, and `isGenrePackId` from that module. Welcome ids such as `horror-gallery` and `school-horror` are recipe/card ids mapped to canonical `horror-chase`; they are not aliases that persistence may accept.

## Safe blank-project system-preset flow

`action-rpg` selects `action-system`, enabling only `system.actionCombat`.
It never enables every map. The author opts in each intended arena via map
properties or `set_action_combat({enabled:true,mapId})`; other maps retain their
existing combat routing. The new-project dialog uses the same registry. The
action welcome prompt uses `actionArenaAuthoring.ts`, not the generic NPC/item
checklist. Static configuration checks system/map opt-in, a spawn whose first
troop enemy has an action profile, lint errors, and reference integrity.
It does not certify real combat playability.

`adventure-jrpg` selects `adventure-system` (2026-09-26). Before, it applied only
`system.genre`, so the gear (no AI) produced a blank project with a label. It now
fills `battleParty: "actors"`, `battleUiStyle: "ff"` (side view, ally sprites),
`menuUiStyle: "party-first"` and `companions {maxCompanions:3, formation:"line"}`
only when those fields are empty (`??=`), so applying the poster to an open
project keeps an author's choice. Requirements add `battle-troops`, `lint-errors`
and `reference-integrity`. Evidence: `verify-shots/gap-fixes/c1-before.json`,
`c1-after.json`, `c4-report.json`.

`createGenreBlankProjectSystemPresetPlan(packId, recipeId)` validates a selection without touching project state. Recipes declare `starterKind: "blank-project-system-preset"` plus the exact shared `system.*` fields they apply; they do not carry fictional executable adapter IDs. `materializeGenreBlankProjectSystemPreset(plan)` returns a detached `createBlankProject()` on the normal `Project` schema with the selected `system.genre` and shared system opt-ins. `authoredContentSeeded` is always `false`: a card label such as adventure village, gallery horror, or farm life is inspiration, not a promise that authored maps/events/records exist.

The live welcome DOM keeps AI creation and manual system setup separate. An illustrated preset poster opens the shared interview, then awaits `applyWelcomeGenreSystemPresetPlan` through `applySystemPreset(plan, brief)`. The detached seed includes the confirmed brief before adoption. The shell already owns the target SQLite folder; the action replaces the in-memory project and requires a successful flush before focusing the start map or releasing an AI prompt. A failed save keeps welcome visible with an inline alert and never starts generation; the candidate may already be in memory. The gear keeps an explicit confirmation, applies only the system preset, and returns no AI prompt. Free-text input and additional free-text world posters use the current project.

Controls (including keyboard input) are blocked during the interview and saving. Cancelling the interview is a no-op. `finishEditorBoot` applies the selected engine settings before handoff; `applyWelcomeGenrePresetToOpenProject` skips the fixed world-canon seed whenever a confirmed game brief exists, so a horror collection game does not regain the default hopeful/fairytale tone.

**AI handoff ordering:** the menu's new-project seed carries `gameDesignBrief.generationPending: true` into `createProjectFolderWithSeed`. The bridge creates the folder and the page reloads. Only the new project's boot consumes this marker in `src/editor/projectInterviewStartup.ts`: clear and save the claim, check the same project/brief is still open, then queue the prompt. Saving must succeed first; disconnected AI gets a draft instead of auto-send. A normal subsequent reload cannot auto-send again. A crash between claiming and publishing can leave the brief unsent; `프로젝트 → 게임 기획...` can reopen and hand it back to the composer. The panel's registered boot target still awaits `whenAiChatPanelSettled()` before applying an intent, so history adoption cannot erase a premature send. Do not send to the old store before the folder reload.

## Preset AI connection gate and first team build (2026-09-27)

- Both preset entrances (welcome poster, the 새 프로젝트 genre) call `ensureAiConnectedForPreset` from `src/editor/ui/aiConnectGate.ts` **before** the interview. It refreshes companion status first; if connected it returns immediately with no UI. Otherwise an alertdialog (「AI 를 먼저 연결해 주세요」, 팀장·시공·검수 roster, current status line) offers 「나중에」 (stay on the start surface) or 「AI 연결하기」.
- 「AI 연결하기」 hides the gate, opens AI settings above app modals, and waits for `AI_SETTINGS_CLOSED_EVENT`; then it refreshes again and either resolves `true` (interview continues) or reshows the gate with 「아직 연결되지 않았어요」. Arm the wait **after** `openAiSettingsModal()` — it calls `closeAiSettingsModal()` first, which fires the closed event even with no modal open.
- The gate is injected (`EditorWelcomeOptions.ensureAiConnected`, `NewProjectDialogOptions.ensureAiConnected`), so component tests without it keep the old flow. The ⚙ system preset, blank project, and free-text welcome input do not pass the gate.
- The first preset build runs as a team for that one turn: `setPendingAiBootIntent(..., { team: true })` → `AiBootIntentTarget.send/prefill(text, display, { team: true })` → `plainPiTurn(text, { team: true })` → `classifyPlainPiTurn({ piTeam: true })`. `AiConfig.piTeam` is unchanged, so later requests stay single unless the user turns team on. A prefilled draft keeps the team flag through `composerHandoff.team` only while the visible text is unchanged; read-only dials and village contracts still demote to single.
- Browser evidence: `scripts/capture-preset-ai-gate.mjs` → `verify-shots/preset-ai-connect-gate/SUMMARY.json` + PNG (companion `/auth/status` stubbed signed-out then signed-in; no model calls or project writes).

## Playable first segment — code builds it, code judges it (2026-09-28)

AI-only preset first builds could not be finished: of 24 live runs on 2026-09-27, none reached an end. The largest (17 maps) had no ending; the 4-map run had three unlinked empty maps, no starter and no capture item (`runGameCheck`). The segment is therefore guaranteed by code, not by the prompt.

- `src/project/playableSegment.ts` builds a skeleton for the three start-surface genres with the real editor tools (`runTool`). All share: key action on the start map (`ev_segment_starter`, sets `sw_segment_key`) → door east (`create_transfer_pair`) → `map_segment_route` → `ev_segment_end`, which opens only after the key switch and calls `triggerEnding ending_first_segment`.
  - monster-collect: professor via `give_starter_monsters` (switch spliced after each `giveMonster`), five `item_capture_orb` in the starting inventory, route via `author_wild_route` with a grass-only Lv3 wild slime `troop_segment_wild` (species formula — the default `troop_slime` beats a Lv5 starter).
  - adventure-jrpg: village chief quest, random encounters on the route, and a `canLose:false` gatekeeper battle (`troop_slime_pair`, 5/5 simulated wins for the Lv1 hero) before the ending.
  - story-cutscene: a memory object to inspect, then the far end.
- `judgePlayableSegment` passes only when `runGameCheck`'s headless autoplay reaches `ending_first_segment`. Any other ending is not a pass. It proves start → partner → route → segment end is walkable; it does not judge fun or looks.
- Runner fix found by this gate: `sceneTestRunner` used to keep executing an event after a lost `canLose:false` battle, so an ending behind an unbeatable gatekeeper counted as reached. It now stops the event there, like the shipped player (`playSceneInterpreter`).
- Seeding: `withVerifiedPlayableSegment` runs in `prepareProjectInterviewStartup` (menu and desktop start screen) and in `applyWelcomeGenreSystemPresetPlan` when a brief exists (welcome poster). The ⚙ system preset (no brief) never gets a skeleton. A skeleton that fails its own judgement is not planted.
- Contract: `playableSegmentContract()` (`playableSegmentContract.ts`, no heavy imports) is added to the builder system prompt and the orchestrator prompt when the project has the skeleton.
- Gate 1, team runtime (`scripts/lib/piTeamRuntime.ts`): for a `장르 프리셋:` task on a passing skeleton, `finish` is rejected with the blocker list up to two times.
- Gate 2, browser (`aiPiAgentCommand.ts`): the final merged result, and the partial live result of a failed or stopped run, is judged. On failure nothing more is applied; already published live checkpoints are reverted to the passing start state with `applyProjectWithHistory` (undo brings the AI result back), unless the user edited the project during the run.
- Both gates are limited to the preset first build. Later requests may move or extend the segment freely.
- Genres without a skeleton (farm, horror, partner, action) keep the previous AI-only flow and are not gated.
- Regression: `test/playableSegment.test.ts` (reload pass, cut end/door/starter fail, other genres untouched). A bun probe with a stub team verified finish rejection then acceptance after repair. Not verified: a live model run through the gates.

## Preset interview and confirmed design (2026-09-22)


- The start surfaces offer blank plus the three supported games. The question bank still covers the other catalog presets. `src/editor/projectInterviewQuestions.ts` owns five ordered slots per preset: experience, activity, progression, detail, scope. Wording is specific to collection, gallery/school horror, JRPG, story, farming, partner raising, or action. Monster horror/mystery/warmth and gallery mistrust/chase/warmth change the consequential fourth question. Free-text premises get a contextual fourth question without guessing their tone.
- `src/editor/ui/projectInterviewDialog.ts` is shared by the welcome poster and new-project dialog. It is draft-only until the editable summary is confirmed. Choices, free text, back/edit, explicit recommendations, cancellation, modal-stack Escape and focus restoration are supported. The layer is above the existing new-project modal.
- Free text can explicitly answer later slots. `src/ai/projectInterviewAnswers.ts` uses the bounded `project-interview` AI surface to extract only verbatim quotes for unanswered slots. An unavailable endpoint, failure or 12-second timeout falls back to the remaining local questions and preserves the original answer. No invented recommendation is labelled as user text. Final confirmation always shows all five answers, including any extracted quotes and recommendation provenance.
- `Project.gameDesignBrief` persists the preset, original answers and sources, editable confirmed summary, and optional reload handoff marker. The latest summary takes priority over raw earlier answers and preset defaults. The preset's engine mechanics remain separate from its tone.
- `buildWelcomeGenrePresetPrompt` uses the confirmed brief instead of fixed tone/content quotas. Legacy context and Pi builder/team/reviewer prompts include the saved brief on later turns. First scope is a complete playable segment, not a promise of an already generated game.
- `프로젝트 → 게임 기획...` reopens existing briefs, saves changes with a project snapshot, and prefills the composer without auto-sending. Blank projects and manual system-only setup do not need an interview. The menu preserves its name/genre/screen-size setup stages before the five game-design questions. `screenSize` still configures the seed viewport.

Browser evidence: `verify-shots/new-project-interview/SUMMARY.md` and `scripts/capture-project-interview.mjs`. These inspect real UI components in isolation, with the welcome save callback stubbed and no live model or canonical project writes. They do not prove end-to-end generated gameplay or SQLite reload. Focused regression cases were authored but not executed locally under the session's test restriction.

## Vocabulary and readiness

`resolveGenreVocabulary` provides pack-specific authoring labels without putting farm terms into shared editor core. Supplying `packId` explicitly lets existing pilots, including `createFarmingDemoProject`, be measured without rewriting or relabeling their authored content.

Do not use one ambiguous `ready` flag. The contract has two stages:

1. `evaluateGenrePackConfiguration(project, packId)` evaluates authored/static capability checks and returns `configured`. The farm pilot checks time/gifts, farmable-area presence and in-bounds rectangles, a reachable start-to-farm route, crop records and item references, a hoe and watering can in starting inventory, at least one referenced seed in starting inventory, zero lint errors, and zero reference issues.
2. `evaluateGenrePackPlayableReadiness(project, packId)` is deliberately fail-closed: `playable` is always `false`, and a configured project reports `unverified`. There is no public caller-supplied receipt factory. Phase 4 must add a file-backed or runner-backed evidence adapter before this contract can report playable.

These checks reuse the canonical `Project`, `projectLint`, `collectProjectReferenceIssues`, collision/reachability helpers, and runtime journey ids. They are advisory authoring evidence, not a second schema or genre-specific runtime. Phase 4 must import the IDs from `src/project/genrePackId.ts` and supply evidence from a real runner-owned artifact; it must not synthesize evidence from a button click, default seed, or caller-shaped `{ booted, journeyIds }` object.

## Dialog layering and receipt fixtures (2026-09-08)

The new-project dialog `src/editor/ui/newProjectDialog.ts` registers with `modalStack` and
unregisters on every settled result. Escape cancels only that layer; it must not dismiss an
underlying Database window. `src/editor/panels/newProjectDialog.ts` was a stale duplicate of
the same surface (last touched 2026-09-05, called only by tests) and was removed on 2026-09-11 —
its Escape-layer coverage moved onto the live `ui/` module.
`test/modalEscapeLayerGate.test.ts` exercises the real dialog and Database world route.
Receipt CLI fixtures must fingerprint the normalized loaded project: text-only title graphics
without a resource are intentionally omitted during loading. Valid evidence alone does not
make a blank project ready; missing authored commands remain `incomplete` and unsupported
commands remain `blocked` (`test/genrePackReceiptCli.test.ts`).

## Validation

## Two new-project surfaces, one choice model (2026-09-11)

`newProjectChoices.ts` is the single source; both surfaces are views of it.

| | First-screen briefing | `새 프로젝트` dialog |
|---|---|---|
| Module | `src/editor/editorWelcome.ts` | `src/editor/ui/newProjectDialog.ts` |
| Chrome | inline posters above the canvas, no Escape layer | modal overlay via `modalStack` |
| Returns | `EditorWelcomeResult` (`prompt`, `systemPresetPlan`) | `{ title, choiceId, screenSize, gameDesignBrief? }` |
| Art | poster `thumb` | `newProjectChoiceRowThumb` (falls back to `thumb`) |

Before the merge the two lists had drifted apart with no shared record: `story-cutscene` read
"회상 스토리" on the first screen and "스토리 컷신" in the dialog, and `horror-chase` was two
first-screen posters but a single dialog row named "공포 추격". A name chosen on the first screen
then appeared to vanish. `test/newProjectDialog.test.ts` now asserts that every dialog row's
label and blurb are character-identical to the first-screen poster's.

The dialog row id is a **choice id**, not a `GenrePackId`. `horror-chase` carries two names
(`horror-gallery`, `school-horror`) and only the choice id can tell them apart; deriving the AI
prompt from the pack id silently picked one of them. `menu.ts` resolves the pack for the seed but
the preset for the prompt from `choiceId`.

Row art is separated only where a poster's art is shared with a sibling of the same pack — the
dialog shows every option at once, so duplicated art makes the choice unreadable.
`newProjectChoiceRowThumb` owns that rule.

Automation boot detection moved to `src/editor/automationBootContext.ts`. It used to exist twice
with different rules (only the welcome copy knew `?forceWelcome=1`), so first-screen QA had to
satisfy two separate sets.

- `test/genrePackRegistry.test.ts`: exact registry set, complete machine data, all-eight welcome mappings, honest blank-system-preset results, detached preset isolation, farm configuration negative controls, and fail-closed playability.
- `test/genrePersistence.test.ts`: official-ID serialization roundtrip and rejection of arbitrary IDs.
- `test/actionGenreAuthoring.test.ts`: action registry entry points, save/load, map opt-in isolation, and existing-genre routing.
- `test/editorWelcome.test.ts`: the live DOM exposes the confirmed system-preset action separately from AI, renders only the three start posters, and defers auto-send until project preparation succeeds, staying mounted on failure.
- `test/newProjectPresetHandoff.test.ts`: saved-brief boot claim, deferred flush, save failure, project switch, offline draft and duplicate-send prevention. `studioBarActions.test.ts` covers the folder seed and absence of sends to the old project.
- `test/gameDesignBrief.test.ts` and `test/projectInterviewDialog.test.ts`: schema roundtrip, missing/invalid metadata, question branches, explicit confirmation, provenance, skipped slots, and cancel/edit isolation.
- `test/welcomeGenreSystemPresetAction.test.ts`: detached seed includes the confirmed brief before adoption; adoption failure does not focus or release a result.
- `test/e2e/director-first-briefing.spec.ts`: Chromium boots the production editor welcome and gates the three start posters. The extra-worlds toggle is absent.

When extending packs, add capability requirements that the shared runtime already understands. Add a shared runtime capability first if none exists; never add a genre branch to player code.
# 예제로 시작하기와 인터뷰 반영 과정 (2026-10-01)

시작 화면과 메뉴의 새 프로젝트는 같은 `src/start/projectStart.ts` 정본을 읽는다.
처음에는 세 장르의 **플레이 가능한 예제**, 빈 프로젝트, AI 기획 중에서 고른다.
예제는 이름을 확인하고 화면 크기를 필요할 때 펼친 뒤 만든다. AI 연결과 인터뷰는 AI 기획 경로에서만 요구한다.

- 씨앗: `editor/projectStartSeed.ts`. 기존 `createStarterMap`과 `withVerifiedPlayableSegment`를 재사용한다.
  새 타일 조립법을 만들지 않는다. 판정을 통과하지 못하면 생성 오류를 보여 준다.
  예제는 작은 마을 → 장르별 길 → 구간 끝이며 새 SQLite 폴더에 저장한다.
- 첫 편집: `panels/firstRunGuide.ts`가 기존 오른쪽 조수 도크를 사용한다. 대사 수정 → 테스트 플레이를 안내한다.
  안내 중 조수·팀 레일을 접고, 조수 열기를 누르면 기존 도크를 돌려준다. 기존 사용자 프로젝트에는 안내 플래그를 추가하지 않는다.
  `flags.firstRunGuide`, `starterExample`, `firstRunDialogueEdited`, `firstRunTested`는 기존 boolean flags 계약으로 저장된다.
  대사는 store의 맵 변이 API와 감사 descriptor를 통과한다. 테스트 완료는 같은 문서 fingerprint의 실제 boot 성공에서만 기록한다.
- 인터뷰: `projectInterviewDialog.ts`가 답변 영수증, 다섯 기획 항목의 진행, 누적 답변을 표시한다.
  기본 1200ms의 읽기 시간과 450ms의 다음 질문 인계를 사용한다. 실제 자유 답변 추출과 읽기 시간은 함께 진행한다.
  로컬 선택 확인은 AI가 생성한 해석으로 표시하지 않는다. 추출 실패는 기존 답변을 보존하고 나머지를 직접 묻는다.
  취소/닫기는 추출 요청과 표시 타이머를 함께 중단하며 늦은 완료가 모달을 다시 열지 않는다.
  `presentationDelayMs: 0`은 결정적 호출자용이며 제품 기본값은 아니다.

화면·저장 증거: `verify-shots/project-first-run/`. 이 세션에서는 AGENTS의 제한에 따라 gates/vitest를 실행하지 않았다.
